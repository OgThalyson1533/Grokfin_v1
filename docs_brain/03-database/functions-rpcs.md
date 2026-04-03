# Funções SQL e RPCs — Supabase

> Todas as funções PL/pgSQL do banco. Fontes: `schema.sql`, `migration_credit_cards.sql`.

#supabase

---

## `update_updated_at_column()` — Trigger Genérico

Função utilitária usada por triggers em **todas** as tabelas.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
```

Aplicada via trigger `BEFORE UPDATE FOR EACH ROW` em:
profiles, accounts, transactions, cards, card_invoices, faturas_ciclo, goals, investments, fixed_expenses, budgets

---

## `handle_new_user()` — Auto-criação de Perfil

Dispara automaticamente quando um novo usuário é criado no Supabase Auth.

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
```

**Trigger associado**: `on_auth_user_created` AFTER INSERT ON auth.users

> `SECURITY DEFINER` — executa com os privilégios do owner da função, não do caller.  
> `SET search_path = public` — evita search_path injection.

---

## `fechar_faturas_e_cobrar()` — Automação de Fechamento

**Tipo**: função de automação (deve ser agendada via pg_cron)  
**Frequência recomendada**: diária (ex: `0 6 * * *`)  
**Condição de disparo**: fatura `aberta` com vencimento em exatamente 2 dias

```sql
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
    WHERE f.status = 'aberta'
      AND CURRENT_DATE = (f.due_date - INTERVAL '2 days'::interval)::DATE
  LOOP
    -- Gera transação de débito na conta
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

    -- Vincula transação e fecha fatura
    UPDATE public.faturas_ciclo
    SET status = 'fechada', debit_transaction_id = nova_transacao_id
    WHERE id = fatura.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Como agendar via pg_cron

```sql
SELECT cron.schedule('fechar-faturas-diario', '0 6 * * *', 'SELECT fechar_faturas_e_cobrar();');
```

---

## `liquidar_fatura(p_invoice_id, p_acc_id)` — RPC de Pagamento

**Tipo**: RPC chamada pela UI  
**Chamada**: quando usuário clica em "Pagar Fatura"  
**Retorno**: `boolean` (true = sucesso)

```sql
CREATE OR REPLACE FUNCTION liquidar_fatura(p_invoice_id UUID, p_acc_id UUID)
RETURNS boolean AS $$
DECLARE
  fatura_debit_tx UUID;
BEGIN
  SELECT debit_transaction_id INTO fatura_debit_tx
  FROM public.faturas_ciclo WHERE id = p_invoice_id;

  -- Passo 1: Efetiva o débito na conta → saldo bancário reduz
  IF fatura_debit_tx IS NOT NULL THEN
    UPDATE public.transactions
    SET status = 'efetivado', account_id = COALESCE(p_acc_id, account_id)
    WHERE id = fatura_debit_tx;
  END IF;

  -- Passo 2: Efetiva compras CC → limite do cartão restaurado
  UPDATE public.transactions
  SET status = 'efetivado'
  WHERE invoice_id = p_invoice_id AND payment = 'credito';

  -- Passo 3: Encerra fatura
  UPDATE public.faturas_ciclo SET status = 'paga' WHERE id = p_invoice_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### Como chamar da UI (JS)

```js
const { data, error } = await supabase.rpc('liquidar_fatura', {
  p_invoice_id: faturaId,
  p_acc_id: contaId
});
```

---

## View `card_status_view`

```sql
CREATE OR REPLACE VIEW public.card_status_view AS
SELECT
  c.id AS card_id,
  c.user_id,
  c.name,
  c.card_limit,
  c.closing_day,
  c.due_day,
  COALESCE(SUM(t.amount), 0) AS total_consumido,
  (c.card_limit - COALESCE(SUM(t.amount), 0)) AS limite_disponivel
FROM public.cards c
LEFT JOIN public.transactions t
  ON t.card_id = c.id
  AND t.payment = 'credito'
  AND t.status = 'pendente'
GROUP BY c.id, c.user_id, c.name, c.card_limit, c.closing_day, c.due_day;
```

> **Nota**: a view não tem RLS própria. O filtro de segurança deve ser feito na query:  
> `SELECT * FROM card_status_view WHERE user_id = auth.uid()`
