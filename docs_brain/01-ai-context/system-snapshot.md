---
tipo: ai-context
tags: [ai, contexto, snapshot]
backlinks: [[MOC — GrokFin Elite v6]]
---

# ⚡ System Snapshot — Contexto Comprimido para IA

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[01-ai-context/ai-system-prompt|AI System Prompt →]]
> **Relacionados:** [[05-architecture/module-map]] · [[05-architecture/state-management]] · [[02-business-rules/domain-rules]]

---

## IDENTIDADE DO SISTEMA

GrokFin Elite v6 é um **PWA de gestão financeira pessoal** em JavaScript puro (ESM), sem framework de UI, com Supabase como Backend-as-a-Service. Design "Liquid Glass Dark Mode" com neons cyan/emerald/violet.

Ver ADRs completos em: [[06-decisions/adrs]]

---

## ARQUITETURA EM UMA LINHA

```
app.html (HTML único) → app.js (orquestrador) → state.js (fonte única de verdade)
→ modules UI → renderização imperativa DOM
→ saveState() → LocalStorage + Supabase (debounced sync)
```

Detalhes em: [[05-architecture/module-map]] | [[05-architecture/state-management]]

---

## ARQUIVOS CRÍTICOS

| Arquivo | Papel | Detalhes |
|---|---|---|
| `js/app.js` | Ponto de entrada, init, ciclo de vida | [[05-architecture/module-map#app.js]] |
| `js/state.js` | Estado global + loadState + saveState | [[05-architecture/state-management]] |
| `js/config.js` | Constantes, categorias, métodos pagamento | [[05-architecture/module-map#config.js]] |
| `js/services/supabase.js` | Cliente Supabase | [[05-architecture/api-integrations#Supabase]] |
| `js/services/auth.js` | Autenticação (login/logout/session) | [[05-architecture/module-map#auth.js]] |
| `js/services/sync.js` | Sincronização bidirecional Supabase | [[05-architecture/state-management#Fluxo de Persistência]] |
| `js/analytics/engine.js` | Motor de análise financeira (memoizado) | [[05-architecture/analytics-engine]] |
| `js/ui/navigation.js` | Navegação entre abas | [[04-design-system/ux-patterns#Estrutura de Navegação]] |
| `js/ui/transactions-ui.js` | CRUD de transações + modal | [[05-architecture/module-map#transactions-ui.js]] |
| `js/ui/dashboard-ui.js` | Home, relatórios, insights | [[05-architecture/module-map#dashboard-ui.js]] |
| `js/ui/chat-ui.js` | Assistente AI | [[02-business-rules/domain-rules#Assistente AI]] |
| `supabase/schema.sql` | Schema consolidado do banco | [[03-database/schema-reference]] |
| `css/base.css` | Variáveis de design, reset, animações | [[04-design-system/design-tokens]] |
| `css/components.css` | Componentes visuais | [[04-design-system/design-tokens#Componentes Visuais]] |

---

## OBJETO STATE (Estrutura Canônica)

```javascript
state = {
  balance: Number,              // saldo em conta (conta principal)
  transactions: Array<Tx>,      // todas as transações
  goals: Array<Goal>,           // metas financeiras
  investments: Array<Investment>,
  budgets: Object<cat, Number>, // limite mensal por categoria
  fixedExpenses: Array<Fixed>,  // despesas/receitas recorrentes
  accounts: Array<Account>,     // contas bancárias reais
  cards: Array<Card>,           // cartões de crédito
  invoices: Array<Invoice>,     // faturas de cartão
  exchange: { usd, eur, btc, trend, lastSync },
  chatHistory: Array<Message>,  // últimas 50 msgs
  profile: { displayName, nickname, avatar, geminiKey, claudeKey },
  ui: { activeTab, txSearch, txCategory, txType, txStatus, txSort,
        txOrigin, txPage, txPageSize, txDateStart, txDateEnd },
  isNewUser: Boolean,
  customCategories: Array<string>,
}
```

Schema completo em: [[05-architecture/state-management#Estrutura Completa do State]]
Mapeamento DB em: [[03-database/schema-reference]]

---

## REGRAS DE NEGÓCIO ESSENCIAIS

1. **Saldo:** `state.balance` = conta principal. Cartões **NÃO reduzem** o saldo → [[02-business-rules/domain-rules#Cartões de Crédito]]
2. **Fatura:** pagar fatura = transação negativa na conta → [[02-business-rules/domain-rules#Ciclo da Fatura]]
3. **Recorrências:** idempotentes, verificar `recurringId` antes de lançar → [[02-business-rules/functional-flows#Fluxo 7]]
4. **Sync:** `saveState()` → debounce 1.5s → `syncToSupabase()`. Nunca chamar sync direto → [[05-architecture/state-management#Fluxo de Persistência]]
5. **RLS:** Supabase isola dados por `user_id` → [[03-database/schema-reference#Políticas RLS]]

---

## MÉTRICAS CALCULADAS

| Métrica | Fórmula | Detalhes |
|---|---|---|
| `expenses` | Σ saídas do mês | [[05-architecture/analytics-engine#Expenses e Incomes]] |
| `incomes` | Σ entradas do mês | [[05-architecture/analytics-engine#Expenses e Incomes]] |
| `net` | incomes − expenses | [[05-architecture/analytics-engine]] |
| `savingRate` | (net / incomes) × 100 | [[05-architecture/analytics-engine#Saving Rate]] |
| `burnDaily` | expenses / diasDoMês | [[05-architecture/analytics-engine#Burn Rate e Runway]] |
| `runwayMonths` | balance / (burnDaily × 30) | [[05-architecture/analytics-engine#Burn Rate e Runway]] |
| `healthScore` | 0–100 (4 eixos ponderados) | [[05-architecture/analytics-engine#Health Score]] |

---

## DÉBITOS TÉCNICOS CONHECIDOS

| ID | Descrição | Link |
|---|---|---|
| DT-01 | Modal Nova Transação migração incompleta | [[07-bugs-fixes/known-issues#DT-01]] |
| DT-02 | Supabase keys em localStorage (sem .env) | [[07-bugs-fixes/known-issues#DT-03]] |
| DT-03 | Ordenação por status usa heurística | [[07-bugs-fixes/known-issues#DT-04]] |
| DT-04 | Analytics sem cache invalidation granular | [[07-bugs-fixes/known-issues#DT-05]] |

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[01-ai-context/ai-system-prompt|AI System Prompt →]]
