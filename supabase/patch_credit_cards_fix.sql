-- ==============================================================================
-- PATCH: Correção de Nomenclatura do Método de Pagamento ('credito' -> 'cartao_credito')
-- Execute este script no SQL Editor do seu Supabase para corrigir a contabilização do limite.
-- ==============================================================================

-- 1. Recriando a View com a string correta enviada pelo Frontend
DROP VIEW IF EXISTS public.card_status_view;
CREATE OR REPLACE VIEW public.card_status_view AS
SELECT 
  c.id AS card_id,
  c.user_id,
  c.name,
  c.card_limit,
  c.closing_day,
  c.due_day,
  COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'pendente'), 0) AS total_consumido,
  -- Limite Disponível = Limite Total - (Transações no Crédito pendentes 'ainda não liquidadas na CC')
  (c.card_limit - COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'pendente'), 0)) AS limite_disponivel
FROM 
  public.cards c
LEFT JOIN 
  public.transactions t ON t.card_id = c.id 
  AND t.payment = 'cartao_credito' -- CORREÇÃO AQUI (Antes era 'credito')
  AND t.status = 'pendente' 
GROUP BY 
  c.id, c.user_id, c.name, c.card_limit, c.closing_day, c.due_day;


-- 2. Recriando a Função de Liquidação com a string correta
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
  WHERE invoice_id = p_invoice_id AND payment = 'cartao_credito'; -- CORREÇÃO AQUI

  -- 3. Fatura encerrada
  UPDATE public.faturas_ciclo SET status = 'paga' WHERE id = p_invoice_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
