# RLS Policies — Row Level Security

> Todas as políticas de segurança do Supabase. Toda tabela tem RLS habilitado.  
> Fonte: `supabase/schema.sql`

#supabase

---

## Padrão Geral

Quase todas as tabelas usam a mesma política `FOR ALL`:

```sql
CREATE POLICY "Users can manage own [tabela]"
  ON public.[tabela] FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Isso cobre SELECT, INSERT, UPDATE e DELETE em uma única policy.

---

## Policies por Tabela

### `profiles`

Três policies separadas (não usa FOR ALL — perfil tem INSERT separado por causa de bug histórico):

```sql
-- SELECT
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

-- INSERT (adicionada em FIX SQL #1 — estava ausente causando falha silenciosa no signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
```

> ⚠️ Note: profiles usa `id` (não `user_id`) como FK para `auth.users`.

### `accounts`
```sql
CREATE POLICY "Users can manage own accounts"
  ON public.accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### `transactions`
```sql
CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL USING (auth.uid() = user_id);
```

### `cards`
```sql
CREATE POLICY "Users can manage own cards"
  ON public.cards FOR ALL USING (auth.uid() = user_id);
```

### `card_invoices`
Policy mais complexa — verifica ownership via join com `cards`:

```sql
CREATE POLICY "Users can manage own card invoices"
  ON public.card_invoices FOR ALL
  USING (
    auth.uid() = user_id
    AND card_id IN (SELECT id FROM public.cards WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND card_id IN (SELECT id FROM public.cards WHERE user_id = auth.uid())
  );
```

### `faturas_ciclo`
```sql
CREATE POLICY "Users can manage own invoices cycle"
  ON public.faturas_ciclo FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### `goals`, `investments`, `fixed_expenses`, `custom_categories`
Padrão FOR ALL com `user_id`.

### `budgets`
```sql
-- Policy principal (FOR ALL)
CREATE POLICY "Users can manage own budgets"
  ON public.budgets FOR ALL USING (auth.uid() = user_id);

-- Policy de INSERT explícita (adicionada em Migration v2 #2 se não existir)
CREATE POLICY "Users can insert own budgets"
  ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### `exchange_rate_cache`
Leitura global para autenticados (sem filtro de user_id):

```sql
CREATE POLICY "Authenticated users can read exchange rates"
  ON public.exchange_rate_cache FOR SELECT
  USING (auth.role() = 'authenticated');
```

### Storage — `transaction-attachments`

```sql
-- Upload: só o próprio usuário (pasta = user_id)
CREATE POLICY "Owners can upload/read attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'transaction-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Leitura: só o próprio usuário
CREATE POLICY "Owners can read attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'transaction-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Fixes Históricos em RLS

| Fix | Tabela | Problema | Solução |
|---|---|---|---|
| FIX SQL #1 | profiles | INSERT policy ausente — novos usuários não criavam perfil | Adicionada policy de INSERT |
| Migration v2 #2 | budgets | INSERT policy ausente em bancos existentes | Script idempotente com `DO $$ IF NOT EXISTS` |

---

## Como testar RLS no Supabase Dashboard

1. Acesse **Authentication → Policies**
2. Para testar como um usuário específico: SQL Editor → `SET request.jwt.claims.sub = 'uuid-do-usuario';`
3. Verifique que SELECT retorna apenas dados do usuário autenticado
