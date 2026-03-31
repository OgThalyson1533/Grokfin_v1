-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: CREDIT CARDS CORE BANKING (Faturas, Vínculos Opcionais)
-- Execute este script no SQL Editor do seu Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- A conta principal onde a fatura costuma ser debitada
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS default_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 11. INVOICE CYCLES (Faturas Ciclo)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.faturas_ciclo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  reference_month INTEGER NOT NULL, -- Ex: 1 a 12
  reference_year INTEGER NOT NULL,  -- Ex: 2026
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
  total_amount NUMERIC(12, 2) DEFAULT 0,
  debit_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL, -- Transação lançada na conta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, reference_month, reference_year)
);

ALTER TABLE public.faturas_ciclo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invoices cycle" 
  ON public.faturas_ciclo FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_faturas_ciclo_modtime
BEFORE UPDATE ON public.faturas_ciclo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Modificando TRANSACTIONS para interagir com a visão de Passivos
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'efetivado' CHECK (status IN ('pendente', 'efetivado'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.faturas_ciclo(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 12. VIEWS (Limite Disponível em Tempo Real)
-- ═══════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.card_status_view;
CREATE OR REPLACE VIEW public.card_status_view AS
SELECT 
  c.id AS card_id,
  c.user_id,
  c.name,
  c.card_limit,
  c.closing_day,
  c.due_day,
  COALESCE(SUM(t.amount), 0) AS total_consumido,
  -- Limite Disponível = Limite Total - (Transações no Crédito pendentes 'ainda não liquidadas na CC')
  (c.card_limit - COALESCE(SUM(t.amount), 0)) AS limite_disponivel
FROM 
  public.cards c
LEFT JOIN 
  public.transactions t ON t.card_id = c.id 
  AND t.payment = 'credito' 
  AND t.status = 'pendente' -- pendente atesta que é uma dívida em aberto no modelo de passivo
GROUP BY 
  c.id, c.user_id, c.name, c.card_limit, c.closing_day, c.due_day;

-- ═══════════════════════════════════════════════════════════════════
-- 13. AUTOMAÇÃO DE FECHAMENTO (PG_CRON FUNCTION)
-- ═══════════════════════════════════════════════════════════════════
-- Roda diariamente para cobrar fatura faltando exatos 2 dias para o vencimento
CREATE OR REPLACE FUNCTION fechar_faturas_e_cobrar()
RETURNS void AS $$
DECLARE
  fatura RECORD;
  nova_transacao_id UUID;
BEGIN
  FOR fatura IN 
    SELECT f.*, c.default_account_id, c.name as card_name
    FROM public.faturas_ciclo f
    JOIN public.cards c ON c.id = f.card_id
    WHERE f.status = 'aberta' AND CURRENT_DATE = (f.due_date - INTERVAL '2 days'::interval)::DATE
  LOOP
    -- Registra transação como Saída do limite bancário
    INSERT INTO public.transactions (user_id, date, description, category, amount, payment, account_id, status)
    VALUES (
      fatura.user_id,
      fatura.due_date,
      'Fatura Cartão ' || fatura.card_name,
      'Pagamento de Cartão',
      -(fatura.total_amount), 
      'fatura',
      fatura.default_account_id,
      'pendente'
    ) RETURNING id INTO nova_transacao_id;

    -- Atualiza e vincula a fatura e o lançamento
    UPDATE public.faturas_ciclo 
    SET status = 'fechada', debit_transaction_id = nova_transacao_id 
    WHERE id = fatura.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- 14. LIQUIDAÇÃO ACID DE FATURA (RPC)
-- ═══════════════════════════════════════════════════════════════════
-- Chamado pela UI quando usuário clica em "Pagar Fatura"
CREATE OR REPLACE FUNCTION liquidar_fatura(p_invoice_id UUID, p_acc_id UUID)
RETURNS boolean AS $$
DECLARE 
  fatura_debit_tx UUID;
BEGIN
  -- Identifica qual transação na conta corrente corresponde ao débito (se existir)
  SELECT debit_transaction_id INTO fatura_debit_tx 
  FROM public.faturas_ciclo 
  WHERE id = p_invoice_id;

  -- 1. Efetivação do débito na conta
  IF fatura_debit_tx IS NOT NULL THEN
     UPDATE public.transactions 
     SET status = 'efetivado', account_id = COALESCE(p_acc_id, account_id) 
     WHERE id = fatura_debit_tx;
  END IF;

  -- 2. Restauração do limite do cartão (Liquidamos as compras pendentes do crédito contidas nessa fatura)
  UPDATE public.transactions 
  SET status = 'efetivado'
  WHERE invoice_id = p_invoice_id AND payment = 'credito';

  -- 3. Fatura encerrada
  UPDATE public.faturas_ciclo SET status = 'paga' WHERE id = p_invoice_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
