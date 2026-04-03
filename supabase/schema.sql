-- ═══════════════════════════════════════════════════════════════════════════
--  GROKFIN ELITE V6 — SUPABASE SCHEMA CONSOLIDADO
--  Arquivo único, idempotente. Pode ser executado em banco novo ou existente.
--  Gerado em 2026-04-02 — substitui schema.sql, migration_credit_cards.sql,
--  patch_credit_cards_fix.sql e seed.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÃO UTILITÁRIA — atualiza updated_at automaticamente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
--    Estende auth.users com dados de perfil customizados.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nickname             TEXT,
  display_name         TEXT,
  handle               TEXT UNIQUE,
  bio                  TEXT,
  avatar_url           TEXT,
  banner_url           TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: cria perfil automaticamente ao registrar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, nickname, handle, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'GrokFin User'),
    'Navigator',
    '@' || LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'display_name', 'user'), ' ', '.')),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTS (Contas Bancárias)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  account_type    TEXT DEFAULT 'Conta Corrente',
  initial_balance NUMERIC(12, 2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Users can manage own accounts') THEN
    CREATE POLICY "Users can manage own accounts"
      ON public.accounts FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_accounts_modtime ON public.accounts;
CREATE TRIGGER update_accounts_modtime
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date                DATE NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL, -- positivo = receita, negativo = despesa
  payment             TEXT,
  account_id          UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  card_id             UUID,
  invoice_id          UUID,                    -- referência para faturas_ciclo (FK adicionada abaixo)
  recurring_template  BOOLEAN DEFAULT FALSE,
  installments        INTEGER DEFAULT 1,
  installment_current INTEGER DEFAULT 1,
  notes               TEXT,
  attachment_url      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- status: coluna separada para evitar re-criação com CHECK diferente
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'efetivado';

-- [FIX] Garante CHECK expandido para todos os valores usados pelo app.
-- Estratégia: drop constraint por nome se existir, depois recria.
DO $$ BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pendente', 'efetivado', 'concluido', 'vencido'));
EXCEPTION WHEN others THEN
  NULL; -- ignora se a tabela ainda não existia
END $$;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can manage own transactions') THEN
    CREATE POLICY "Users can manage own transactions"
      ON public.transactions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_transactions_modtime ON public.transactions;
CREATE TRIGGER update_transactions_modtime
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_transactions_user_date     ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id    ON public.transactions(account_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CARDS (Cartões de Crédito/Débito)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cards (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name               TEXT NOT NULL,
  flag               TEXT,
  card_type          TEXT DEFAULT 'credito',
  color              TEXT,
  card_limit         NUMERIC(12, 2) DEFAULT 0,
  closing_day        INTEGER,
  due_day            INTEGER,
  default_account_id UUID,                  -- FK para accounts adicionada abaixo
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Garante coluna default_account_id em bancos migrados
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS default_account_id UUID;

DO $$ BEGIN
  ALTER TABLE public.cards
    ADD CONSTRAINT cards_default_account_id_fkey
    FOREIGN KEY (default_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Users can manage own cards') THEN
    CREATE POLICY "Users can manage own cards"
      ON public.cards FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_cards_modtime ON public.cards;
CREATE TRIGGER update_cards_modtime
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CARD INVOICES (Itens de Fatura Avulsos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_invoices (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  card_id             UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL,
  installments        INTEGER DEFAULT 1,
  installment_current INTEGER DEFAULT 1,
  tx_ref_id           UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Garante coluna em bancos existentes
ALTER TABLE public.card_invoices ADD COLUMN IF NOT EXISTS tx_ref_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.card_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'card_invoices' AND policyname = 'Users can manage own card invoices') THEN
    CREATE POLICY "Users can manage own card invoices"
      ON public.card_invoices FOR ALL
      USING (auth.uid() = user_id AND card_id IN (SELECT id FROM public.cards WHERE user_id = auth.uid()))
      WITH CHECK (auth.uid() = user_id AND card_id IN (SELECT id FROM public.cards WHERE user_id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_card_invoices_modtime ON public.card_invoices;
CREATE TRIGGER update_card_invoices_modtime
  BEFORE UPDATE ON public.card_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_card_invoices_card_id ON public.card_invoices(card_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. GOALS (Metas Financeiras)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name           TEXT NOT NULL,
  current_amount NUMERIC(12, 2) DEFAULT 0,
  target_amount  NUMERIC(12, 2) NOT NULL,
  theme          TEXT,
  custom_image   TEXT,
  deadline       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Users can manage own goals') THEN
    CREATE POLICY "Users can manage own goals"
      ON public.goals FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_goals_modtime ON public.goals;
CREATE TRIGGER update_goals_modtime
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INVESTMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  subtype       TEXT,
  current_value NUMERIC(12, 2) DEFAULT 0,
  cost_basis    NUMERIC(12, 2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investments' AND policyname = 'Users can manage own investments') THEN
    CREATE POLICY "Users can manage own investments"
      ON public.investments FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_investments_modtime ON public.investments;
CREATE TRIGGER update_investments_modtime
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FIXED EXPENSES / INCOMES (Lançamentos Recorrentes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL,
  execution_day INTEGER NOT NULL,
  is_income     BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixed_expenses' AND policyname = 'Users can manage own fixed expenses') THEN
    CREATE POLICY "Users can manage own fixed expenses"
      ON public.fixed_expenses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_fixed_expenses_modtime ON public.fixed_expenses;
CREATE TRIGGER update_fixed_expenses_modtime
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON public.fixed_expenses(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. BUDGETS (Envelopes Orçamentários)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  category     TEXT NOT NULL,
  limit_amount NUMERIC(12, 2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Users can manage own budgets') THEN
    CREATE POLICY "Users can manage own budgets"
      ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_budgets_modtime ON public.budgets;
CREATE TRIGGER update_budgets_modtime
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CUSTOM CATEGORIES (Categorias Personalizadas por Usuário)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_categories' AND policyname = 'Users can manage own custom categories') THEN
    CREATE POLICY "Users can manage own custom categories"
      ON public.custom_categories FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_categories_user ON public.custom_categories(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. EXCHANGE RATE CACHE (Cache Global de Cotações)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exchange_rate_cache (
  currency_code TEXT PRIMARY KEY,
  rate          NUMERIC(16, 6) NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exchange_rate_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rate_cache' AND policyname = 'Authenticated users can read exchange rates') THEN
    CREATE POLICY "Authenticated users can read exchange rates"
      ON public.exchange_rate_cache FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FATURAS CICLO (Ciclos de Fatura por Cartão/Mês)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.faturas_ciclo (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id              UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  user_id              UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  reference_month      INTEGER NOT NULL,  -- 1..12
  reference_year       INTEGER NOT NULL,  -- ex: 2026
  closing_date         DATE NOT NULL,
  due_date             DATE NOT NULL,
  status               TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
  total_amount         NUMERIC(12, 2) DEFAULT 0,
  debit_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, reference_month, reference_year)
);

ALTER TABLE public.faturas_ciclo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faturas_ciclo' AND policyname = 'Users can manage own invoices cycle') THEN
    CREATE POLICY "Users can manage own invoices cycle"
      ON public.faturas_ciclo FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_faturas_ciclo_modtime ON public.faturas_ciclo;
CREATE TRIGGER update_faturas_ciclo_modtime
  BEFORE UPDATE ON public.faturas_ciclo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FK de transactions.invoice_id → faturas_ciclo (adicionada após criação das duas tabelas)
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.faturas_ciclo(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. CHAT MESSAGES (Histórico de Chat com IA por Usuário)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Users can manage own chat messages') THEN
    CREATE POLICY "Users can manage own chat messages"
      ON public.chat_messages FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages(user_id, created_at ASC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. STORAGE — Bucket para Anexos de Transações
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Owners can upload/read attachments'
  ) THEN
    CREATE POLICY "Owners can upload/read attachments"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'transaction-attachments'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Owners can read attachments'
  ) THEN
    CREATE POLICY "Owners can read attachments"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'transaction-attachments'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. VIEW — card_status_view (Limite Disponível em Tempo Real)
--     [FIX] payment = 'cartao_credito' (era 'credito' — valor incorreto do app)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.card_status_view;
CREATE OR REPLACE VIEW public.card_status_view AS
SELECT
  c.id          AS card_id,
  c.user_id,
  c.name,
  c.card_limit,
  c.closing_day,
  c.due_day,
  COALESCE(SUM(ABS(t.amount)), 0)                             AS total_consumido,
  c.card_limit - COALESCE(SUM(ABS(t.amount)), 0)             AS limite_disponivel
FROM public.cards c
LEFT JOIN public.transactions t
  ON  t.card_id = c.id
  AND t.payment = 'cartao_credito'   -- [FIX] valor real usado pelo app
  AND t.status  = 'pendente'
GROUP BY c.id, c.user_id, c.name, c.card_limit, c.closing_day, c.due_day;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. FUNÇÃO — fechar_faturas_e_cobrar (pg_cron: roda diariamente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fechar_faturas_e_cobrar()
RETURNS void AS $$
DECLARE
  fatura RECORD;
  nova_transacao_id UUID;
BEGIN
  FOR fatura IN
    SELECT f.*, c.default_account_id, c.name AS card_name
    FROM public.faturas_ciclo f
    JOIN public.cards c ON c.id = f.card_id
    WHERE f.status = 'aberta'
      AND CURRENT_DATE = (f.due_date - INTERVAL '2 days')::DATE
  LOOP
    INSERT INTO public.transactions
      (user_id, date, description, category, amount, payment, account_id, status)
    VALUES (
      fatura.user_id,
      fatura.due_date,
      'Fatura Cartão ' || fatura.card_name,
      'Pagamento de Cartão',
      -(fatura.total_amount),
      'fatura',
      fatura.default_account_id,
      'pendente'
    )
    RETURNING id INTO nova_transacao_id;

    UPDATE public.faturas_ciclo
    SET status = 'fechada', debit_transaction_id = nova_transacao_id
    WHERE id = fatura.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. RPC — liquidar_fatura (chamada pela UI em "Pagar Fatura")
--     [FIX] payment = 'cartao_credito' (era 'credito')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.liquidar_fatura(p_invoice_id UUID, p_acc_id UUID)
RETURNS boolean AS $$
DECLARE
  fatura_debit_tx UUID;
BEGIN
  SELECT debit_transaction_id INTO fatura_debit_tx
  FROM public.faturas_ciclo
  WHERE id = p_invoice_id;

  -- 1. Efetivar débito na conta corrente (se já registrado)
  IF fatura_debit_tx IS NOT NULL THEN
    UPDATE public.transactions
    SET status = 'efetivado', account_id = COALESCE(p_acc_id, account_id)
    WHERE id = fatura_debit_tx;
  END IF;

  -- 2. Restaurar limite: efetivar compras pendentes vinculadas a essa fatura
  UPDATE public.transactions
  SET status = 'efetivado'
  WHERE invoice_id = p_invoice_id
    AND payment = 'cartao_credito';   -- [FIX] valor real usado pelo app

  -- 3. Encerrar fatura
  UPDATE public.faturas_ciclo SET status = 'paga' WHERE id = p_invoice_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
