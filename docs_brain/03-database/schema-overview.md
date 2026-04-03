# Schema Overview — Supabase

> Visão geral das 12 tabelas, 1 view e funções do banco GroKFin Elite v6.  
> Fonte: `supabase/schema.sql` + `supabase/migration_credit_cards.sql`

#supabase

---

## Diagrama de Entidades

```
auth.users (Supabase)
    │
    ├── profiles (1:1)
    ├── accounts (1:N)
    ├── transactions (1:N) ──► accounts (N:1)
    │                    ──► cards (N:1)
    │                    ──► faturas_ciclo (N:1)
    ├── cards (1:N) ──► accounts (default_account_id)
    │    └── card_invoices (1:N)
    │    └── faturas_ciclo (1:N) ──► transactions (debit_transaction_id)
    ├── goals (1:N)
    ├── investments (1:N)
    ├── fixed_expenses (1:N)
    ├── budgets (1:N, PK composta: user_id + category)
    ├── custom_categories (1:N)
    └── exchange_rate_cache (global, sem user_id)
```

---

## Tabelas

### 1. `profiles`
Extensão do `auth.users` com dados de perfil customizados.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | FK → auth.users |
| `nickname` | TEXT | "Navigator" |
| `display_name` | TEXT | Nome exibido |
| `handle` | TEXT UNIQUE | "@grokfin.user" |
| `bio` | TEXT | |
| `avatar_url` | TEXT | URL Supabase Storage |
| `banner_url` | TEXT | URL Supabase Storage |
| `onboarding_completed` | BOOLEAN | false = novo usuário |

### 2. `accounts` (Bancos/Contas)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `name` | TEXT | Ex: "Nubank", "Bradesco" |
| `account_type` | TEXT | Default: 'Conta Corrente' |
| `initial_balance` | NUMERIC(12,2) | |

### 3. `transactions`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `date` | DATE | Formato ISO no banco, DD/MM/YYYY no JS |
| `description` | TEXT | |
| `category` | TEXT | |
| `amount` | NUMERIC(12,2) | Positivo=receita, Negativo=despesa |
| `payment` | TEXT | pix/dinheiro/cartao_credito/cartao_debito/conta/boleto/fatura |
| `account_id` | UUID FK | FK → accounts |
| `card_id` | UUID | FK → cards (sem constraint declarada) |
| `status` | TEXT | 'pendente' \| 'efetivado' |
| `invoice_id` | UUID FK | FK → faturas_ciclo |
| `recurring_template` | BOOLEAN | |
| `installments` | INTEGER | |
| `installment_current` | INTEGER | |
| `notes` | TEXT | Observações livres |
| `attachment_url` | TEXT | URL comprovante no Storage |

### 4. `cards`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | "Nubank Ultravioleta" |
| `flag` | TEXT | Visa/Mastercard/etc. |
| `card_type` | TEXT | 'credito' \| 'debito' |
| `color` | TEXT | Cor do cartão no UI |
| `card_limit` | NUMERIC(12,2) | |
| `closing_day` | INTEGER | Dia de fechamento |
| `due_day` | INTEGER | Dia de vencimento |
| `default_account_id` | UUID FK | Conta vinculada para débito de fatura |

### 5. `card_invoices`
Itens avulsos da fatura (não vinculados a transactions).

### 6. `faturas_ciclo`
Ver [[invoice-lifecycle]] para detalhes completos.

### 7. `goals`

| Campo | Tipo | Notas |
|---|---|---|
| `name` | TEXT | |
| `current_amount` | NUMERIC(12,2) | Progresso atual |
| `target_amount` | NUMERIC(12,2) | Meta |
| `theme` | TEXT | Tema visual |
| `custom_image` | TEXT | URL ou dataURL |
| `deadline` | TIMESTAMPTZ | |

### 8. `investments`

| Campo | Tipo | Notas |
|---|---|---|
| `type` | TEXT | Ações, FII, Cripto, Renda Fixa... |
| `subtype` | TEXT | |
| `current_value` | NUMERIC(12,2) | Valor atual de mercado |
| `cost_basis` | NUMERIC(12,2) | Custo de aquisição |

### 9. `fixed_expenses`

| Campo | Tipo | Notas |
|---|---|---|
| `amount` | NUMERIC(12,2) | Sempre positivo |
| `execution_day` | INTEGER | Dia do mês |
| `is_income` | BOOLEAN | true = receita fixa |
| `is_active` | BOOLEAN | |

### 10. `budgets`
PK composta: `(user_id, category)` — um limite por categoria por usuário.

### 11. `custom_categories`
`UNIQUE(user_id, name)` — nome entre 2-50 caracteres.

### 12. `exchange_rate_cache`
Cache global de cotações. Sem `user_id`. Leitura para todos autenticados.

---

## View

### `card_status_view`
Calcula limite disponível em tempo real. Ver [[functions-rpcs]].

---

## Índices criados

```sql
idx_transactions_user_date      → (user_id, date DESC)
idx_transactions_user_category  → (user_id, category)
idx_transactions_account_id     → (account_id)
idx_card_invoices_card_id       → (card_id)
idx_goals_user_id               → (user_id)
idx_fixed_expenses_user_id      → (user_id)
idx_accounts_user_id            → (user_id)
idx_custom_categories_user      → (user_id)
```

---

## Padrões comuns a todas as tabelas

- **RLS habilitado** em todas as tabelas
- **`updated_at`** com trigger automático `update_updated_at_column()`
- **`ON DELETE CASCADE`** para `user_id` → deleta tudo ao remover usuário
- **`NUMERIC(12,2)`** para todos os valores monetários
