# Migrations Log — Histórico de Patches

> Registro cronológico de todas as migrações e patches aplicados ao banco.  
> Fonte: comentários em `supabase/schema.sql` e `supabase/migration_credit_cards.sql`

#supabase

---

## Como aplicar migrações

Todas as migrações são idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).  
Execute no **Supabase SQL Editor** — não no psql direto (para manter o audit log do Supabase).

---

## Migration v1 — Schema Inicial

**Arquivo**: `supabase/schema.sql` (seção inicial)  
**Tabelas criadas**: profiles, accounts, transactions, cards, card_invoices, goals, investments, fixed_expenses, budgets, exchange_rate_cache

---

## Patch v1 — FIX SQL #1: INSERT policy em profiles

**Problema**: novos usuários não conseguiam criar perfil. O upsert inicial falhava silenciosamente com RLS habilitado mas sem policy de INSERT.

```sql
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

---

## Patch v1 — FIX SQL #2: updated_at em card_invoices

**Problema**: `card_invoices` não tinha `updated_at` nem trigger. Atualizações de faturas não podiam ser rastreadas e o upsert multi-device não detectava conflitos de tempo.

```sql
ALTER TABLE public.card_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TRIGGER update_card_invoices_modtime
  BEFORE UPDATE ON public.card_invoices FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Patch v1 — FIX SQL #3: campos adicionais em transactions

```sql
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS card_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_template BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_current INTEGER DEFAULT 1;
```

---

## Patch v1 — FIX SQL #4: onboarding flag em profiles

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
```

---

## Migration v2 — Performance e Features

**Arquivo**: `supabase/schema.sql` (seção MIGRATION SCRIPT v2)

### v2 #1: Índices de performance

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_user_date     ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id    ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_card_invoices_card_id      ON public.card_invoices(card_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id              ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id     ON public.fixed_expenses(user_id);
```

### v2 #2: INSERT policy em budgets (idempotente)

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Users can insert own budgets'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
```

### v2 #3: notes e attachment_url em transactions

```sql
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
```

### v2 #4: Trigger para criar perfil no signup

```sql
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
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Migration v3 — Credit Cards Core Banking

**Arquivo**: `supabase/migration_credit_cards.sql`

### Novas tabelas
- `faturas_ciclo` — ciclo de faturas por cartão/mês/ano
- `custom_categories` — categorias personalizadas por usuário

### Alterações em tabelas existentes
```sql
-- cards: conta padrão para débito de fatura
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS default_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- transactions: status e vínculo com fatura
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'efetivado' CHECK (status IN ('pendente', 'efetivado'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.faturas_ciclo(id) ON DELETE SET NULL;
```

### Nova view
- `card_status_view` — limite disponível em tempo real

### Novas funções
- `fechar_faturas_e_cobrar()` — automação de fechamento (pg_cron)
- `liquidar_fatura(p_invoice_id, p_acc_id)` — RPC de pagamento

---

## Próximas Migrações Planejadas

- [ ] Bucket de Storage para comprovantes (já no schema, confirmar políticas)
- [ ] pg_cron job agendado para `fechar_faturas_e_cobrar()`
