---
tipo: arquitetura
tags: [estado, persistência, sincronização, state]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🔄 State Management — Gerenciamento de Estado

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[05-architecture/module-map|Module Map]] | Próximo: [[05-architecture/api-integrations|API Integrations →]]
> **Relacionados:** [[03-database/schema-reference]] · [[02-business-rules/functional-flows]] · [[06-decisions/adrs#ADR-002]] · [[06-decisions/adrs#ADR-003]]

---

## Princípio Fundamental

> **"Single Source of Truth com persistência híbrida"**

```
Mutação → state (RAM) → saveState() → localStorage (síncrono)
                                     → syncToSupabase() (async, debounced 1.5s)
```

Decisão arquitetural: [[06-decisions/adrs#ADR-002]] | [[06-decisions/adrs#ADR-003]]

**Regra de ouro:**
```javascript
// ✅ CORRETO — sempre muta state, depois salva e re-renderiza
state.transactions.unshift(newTx);
saveState();
appRenderAll();

// ❌ ERRADO — nunca DOM como fonte de dados
const val = document.getElementById('saldo').textContent;

// ❌ ERRADO — nunca chama sync diretamente
await syncToSupabase();
```

---

## Estrutura Completa do `state`

```typescript
interface AppState {
  // ─── Saldo ───────────────────────────────────────────────────────────────
  balance: number;                    // conta principal (R$)
  
  // ─── Transações ──────────────────────────────────────────────────────────
  transactions: Transaction[];
  
  // ─── Metas ───────────────────────────────────────────────────────────────
  goals: Goal[];
  
  // ─── Investimentos ───────────────────────────────────────────────────────
  investments: Investment[];
  
  // ─── Orçamentos ──────────────────────────────────────────────────────────
  budgets: Record<string, number>;    // { "Alimentação": 1500 }
  
  // ─── Recorrências ────────────────────────────────────────────────────────
  fixedExpenses: FixedExpense[];
  
  // ─── Contas Bancárias ────────────────────────────────────────────────────
  accounts: Account[];
  
  // ─── Cartões ─────────────────────────────────────────────────────────────
  cards: Card[];
  invoices: Invoice[];
  
  // ─── Câmbio ──────────────────────────────────────────────────────────────
  exchange: { usd, eur, btc, trend: {usd, eur, btc}, lastSync: string | null };
  
  // ─── Perfil ──────────────────────────────────────────────────────────────
  profile: { displayName, nickname?, avatar?, email?, geminiKey?, claudeKey? };
  
  // ─── Chat AI ─────────────────────────────────────────────────────────────
  chatHistory: ChatMessage[];         // limitado a 50 msgs
  
  // ─── Categorias Customizadas ─────────────────────────────────────────────
  customCategories: string[];
  
  // ─── UI (NÃO sincronizado com Supabase) ──────────────────────────────────
  ui: UiState;
  
  // ─── Flags ───────────────────────────────────────────────────────────────
  isNewUser: boolean;
  lastSync?: string;
}
```

Interfaces completas dos modelos: [[03-database/schema-reference]]

---

## Interfaces dos Modelos

### Transaction
```typescript
interface Transaction {
  id: string;                          // uid('tx...')
  desc: string;
  value: number;                       // + entrada | − saída
  cat: string;                         // ver config.js
  payment: 'pix'|'cartao_credito'|'cartao_debito'|'dinheiro'|'conta';
  date: string;                        // 'dd/mm/yyyy'
  status: 'concluido' | 'pendente';
  accountId?: string;                  // FK accounts.id
  cardId?: string;                     // FK cards.id
  installments?: number;
  installmentNumber?: number;
  recurringId?: string;                // FK fixed_expenses.id
  notes?: string;
  receipt?: string;
}
```

Regras: [[02-business-rules/domain-rules#Transações]]
Schema DB: [[03-database/schema-reference#transactions]]

### Account
```typescript
interface Account {
  id: string;
  name: string;
  bank?: string;
  initialBalance: number;
  type: 'corrente' | 'poupanca' | 'digital';
  color?: string;
}
// Saldo real = initialBalance + Σ transactions.filter(t.accountId === id).value
```

Regras: [[02-business-rules/domain-rules#Contas Bancárias]]

### Card
```typescript
interface Card {
  id: string;
  name: string;
  limit: number;
  used: number;
  cardType: 'VISA' | 'Mastercard' | 'Elo' | 'Amex';
  closingDay: number;
  dueDay: number;
  color?: string;
}
```

Regras: [[02-business-rules/domain-rules#Cartões de Crédito]]

---

## Estado da UI (`state.ui`)

```typescript
interface UiState {
  activeTab: number;         // 0–10
  txSearch: string;
  txCategory: string;        // 'all' ou nome de categoria
  txType: string;            // 'all'|'entrada'|'saida'
  txStatus: string;          // 'all'|'concluido'|'pendente'
  txSort: string;            // 'date-desc'|'date-asc'|'value-desc'|...
  txOrigin: string;          // 'all'|'bank'|'card'
  txPage: number;            // 0-indexed
  txPageSize: number;        // default 20
  txDateStart?: string;      // 'YYYY-MM-DD'
  txDateEnd?: string;
  maisSheetOpen: boolean;
}
```

> **Importante:** `state.ui` é persistido apenas no `localStorage`. **Não é sincronizado com o Supabase** — é estado efêmero de sessão.

---

## `loadState()`

```
1. Tenta ler 'grokfinState' do localStorage
2. Se encontrar: parse JSON + deep merge com buildSeedState() (garante campos novos)
3. Se não encontrar: cria estado inicial com buildSeedState()
4. Após autenticação: syncFromSupabase() sobrescreve com dados remotos
```

---

## `saveState()`

```
1. JSON.stringify(state) → localStorage['grokfinState'] (SÍNCRONO, ~0ms)
2. clearTimeout(_saveTimer) — cancela debounce anterior
3. setTimeout(syncToSupabase, 1500) — agenda sync assíncrono
```

---

## `syncToSupabase()` — Push

```
1. Verifica: supabaseClient && auth.user — se null, no-op silencioso
2. Promise.allSettled (paralelo, erros não bloqueiam):
   accounts → upsert por id          (ANTES das transactions — FK)
   cards    → upsert por id          (ANTES das transactions — FK)
   profiles → upsert por user_id
   transactions → upsert + delete removidos
   goals    → DELETE all + INSERT    (garantia de consistência)
   invoices → upsert por (card_id, month)
   fixed_expenses → upsert por id
   budgets  → upsert por user_id
3. Erros individuais: console.error sem bloquear
```

Fluxo: [[02-business-rules/functional-flows#Fluxo 3]]
Schema: [[03-database/schema-reference#Estratégias de Sync]]
Bug histórico FK: [[07-bugs-fixes/known-fixes#FIX-003]]

---

## `syncFromSupabase()` — Pull

```
1. SELECT de todos os dados (auth.uid() via RLS)
2. Substitui state local pelos dados remotos
3. appRenderAll() com dados atualizados
```

Executado em: inicialização do app + após login
Fluxo: [[02-business-rules/functional-flows#Fluxo 1]]

---

## Cálculo de Saldo

```javascript
// ✅ Saldo da conta principal
state.balance

// ✅ Saldo real de uma conta bancária específica (DERIVADO)
const realBalance = account.initialBalance +
  state.transactions
    .filter(t => t.accountId === account.id)
    .reduce((sum, t) => sum + t.value, 0);

// ✅ Limite disponível no cartão
const available = card.limit - card.used;
```

Regras: [[02-business-rules/domain-rules#Saldo Calculado]]

---

## Sincronização Multi-Dispositivo

```
Dispositivo A → cria transação → saveState() → syncToSupabase() → Supabase
Dispositivo B → abre app → syncFromSupabase() ← Supabase
```

**Modelo:** last-write-wins. Sem resolução de conflitos sofisticada.
**Risco:** [[07-bugs-fixes/known-issues#RISCO-01]]
Decisão: [[06-decisions/adrs#ADR-003]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[05-architecture/module-map|Module Map]] | [[05-architecture/api-integrations|API Integrations →]]
