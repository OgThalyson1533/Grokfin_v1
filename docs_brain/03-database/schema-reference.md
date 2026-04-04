---
tipo: banco-de-dados
tags: [schema, supabase, postgresql, rls]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🗃️ Schema Reference — Banco de Dados Supabase

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[04-design-system/design-tokens|Design Tokens →]]
> **Relacionados:** [[05-architecture/state-management]] · [[02-business-rules/domain-rules]] · [[05-architecture/api-integrations]]

---

## Visão Geral das Tabelas

```
public
├── profiles          (1:1 com auth.users)
├── transactions      (N por usuário)
├── goals             (N por usuário)
├── investments       (N por usuário)
├── accounts          (contas bancárias, N por usuário)
├── cards             (cartões de crédito, N por usuário)
├── invoices          (faturas de cartão, N por card)
├── fixed_expenses    (recorrências, N por usuário)
└── budgets           (1 por usuário — JSON de categoria→limite)
```

Arquivo fonte: `supabase/schema.sql`

---

## Políticas RLS

**Todas as tabelas têm RLS habilitado.** Padrão:

```sql
-- SELECT / UPDATE / DELETE
USING (user_id = auth.uid())

-- INSERT
WITH CHECK (user_id = auth.uid())
```

Sem acesso cross-user possível via anon key.
Decisão arquitetural: [[06-decisions/adrs#ADR-004]]

---

## `profiles`

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  display_name    TEXT,
  nickname        TEXT,
  avatar_url      TEXT,
  gemini_key      TEXT,      -- API key Gemini
  claude_key      TEXT,      -- API key Claude
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Mapeamento state → DB:**
| `state.profile.*` | DB column |
|---|---|
| `displayName` | `display_name` |
| `nickname` | `nickname` |
| `avatar` | `avatar_url` |
| `geminiKey` | `gemini_key` |
| `claudeKey` | `claude_key` |

Regra: [[02-business-rules/domain-rules#Segurança e Isolamento de Dados]]

---

## `transactions`

```sql
CREATE TABLE transactions (
  id                TEXT PRIMARY KEY,            -- uid('tx...')
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  description       TEXT NOT NULL,              -- state.desc
  value             NUMERIC(15,2) NOT NULL,     -- positivo=entrada, negativo=saída
  category          TEXT DEFAULT 'Rotina',
  payment_method    TEXT DEFAULT 'conta',       -- 'pix'|'cartao_credito'|'cartao_debito'|'dinheiro'|'conta'
  date              TEXT NOT NULL,              -- 'dd/mm/yyyy'
  status            TEXT DEFAULT 'concluido',
  account_id        TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  card_id           TEXT REFERENCES cards(id) ON DELETE SET NULL,
  installments      INTEGER DEFAULT 1,
  installment_number INTEGER DEFAULT 1,
  recurring_id      TEXT REFERENCES fixed_expenses(id) ON DELETE SET NULL,
  notes             TEXT,
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**Mapeamento state → DB:**
| `state.transactions[n].*` | DB column |
|---|---|
| `id` | `id` |
| `desc` | `description` |
| `value` | `value` |
| `cat` | `category` |
| `payment` | `payment_method` |
| `date` | `date` |
| `status` | `status` |
| `accountId` | `account_id` |
| `cardId` | `card_id` |
| `installments` | `installments` |
| `installmentNumber` | `installment_number` |
| `recurringId` | `recurring_id` |
| `notes` | `notes` |
| `receipt` | `receipt_url` |

Regras: [[02-business-rules/domain-rules#Transações]]

---

## `goals`

```sql
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  target      NUMERIC(15,2) NOT NULL,  -- state.total
  current     NUMERIC(15,2) DEFAULT 0, -- state.atual
  deadline    DATE,
  icon        TEXT,
  color       TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Mapeamento state → DB:**
| `state.goals[n].*` | DB column |
|---|---|
| `nome` | `name` |
| `total` | `target` |
| `atual` | `current` |
| `deadline` | `deadline` |
| `imageUrl` | `image_url` |

Regras: [[02-business-rules/domain-rules#Metas Financeiras]]
Cálculos: [[05-architecture/analytics-engine#Meta Urgente]]

---

## `accounts`

```sql
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  bank            TEXT,
  initial_balance NUMERIC(15,2) DEFAULT 0,
  type            TEXT DEFAULT 'corrente',
  color           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Mapeamento state → DB:**
| `state.accounts[n].*` | DB column |
|---|---|
| `name` | `name` |
| `bank` | `bank` |
| `initialBalance` | `initial_balance` |
| `type` | `type` |
| `color` | `color` |

Regras: [[02-business-rules/domain-rules#Contas Bancárias]]
Bug histórico (mapeamento): [[07-bugs-fixes/known-fixes#FIX-006]]

---

## `cards`

```sql
CREATE TABLE cards (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  name         TEXT NOT NULL,
  card_limit   NUMERIC(15,2) NOT NULL,
  used         NUMERIC(15,2) DEFAULT 0,
  card_type    TEXT DEFAULT 'VISA',
  closing_day  INTEGER DEFAULT 1,
  due_day      INTEGER DEFAULT 10,
  color        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Mapeamento state → DB:**
| `state.cards[n].*` | DB column |
|---|---|
| `limit` | `card_limit` |
| `cardType` | `card_type` |
| `closingDay` | `closing_day` |
| `dueDay` | `due_day` |

Regras: [[02-business-rules/domain-rules#Cartões de Crédito]]
Bug histórico (FK ordering): [[07-bugs-fixes/known-fixes#FIX-003]]

---

## `invoices`

```sql
CREATE TABLE invoices (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  card_id     TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,   -- 'YYYY-MM'
  amount      NUMERIC(15,2) DEFAULT 0,
  status      TEXT DEFAULT 'aberta',
  due_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, month)
);
```

Regras: [[02-business-rules/domain-rules#Ciclo da Fatura]]

---

## `fixed_expenses`

```sql
CREATE TABLE fixed_expenses (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  value       NUMERIC(15,2) NOT NULL,
  day         INTEGER NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  is_income   BOOLEAN DEFAULT FALSE,
  category    TEXT,
  account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Regras: [[02-business-rules/domain-rules#Recorrências]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 7]]

---

## `budgets`

```sql
CREATE TABLE budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  data       JSONB NOT NULL DEFAULT '{}',  -- { "Alimentação": 1500 }
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Regras: [[02-business-rules/domain-rules#Orçamentos]]
Cálculos: [[05-architecture/analytics-engine#Budget Use]]

---

## Estratégias de Sync

| Entidade | Estratégia em `sync.js` |
|---|---|
| `transactions` | Upsert por `id` + delete de IDs removidos localmente |
| `goals` | DELETE tudo + INSERT (garante consistência) |
| `accounts` | Upsert por `id` |
| `cards` | Upsert por `id` (ANTES de transactions — FK) |
| `invoices` | Upsert por `(card_id, month)` — UNIQUE constraint |
| `fixed_expenses` | Upsert por `id` |
| `budgets` | Upsert por `user_id` (UNIQUE — 1 por usuário) |
| `profiles` | Upsert por `user_id` |

> ⚠️ Ordem obrigatória: `accounts` → `cards` → `transactions`

Fluxo de sync: [[02-business-rules/functional-flows#Fluxo 3]]
API: [[05-architecture/api-integrations#Supabase]]

---

## Índices Performance-Críticos

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_card ON transactions(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_transactions_account ON transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_invoices_card_month ON invoices(card_id, month);
```

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[04-design-system/design-tokens|Design Tokens →]]
