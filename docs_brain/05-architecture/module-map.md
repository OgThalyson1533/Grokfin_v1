---
tipo: arquitetura
tags: [módulos, dependências, catálogo]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 📦 Module Map — Catálogo de Módulos

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[05-architecture/state-management|State Management →]]
> **Relacionados:** [[02-business-rules/functional-flows]] · [[04-design-system/ux-patterns]]

---

## Grafo de Dependências

```
app.js
├── state.js ←──────────────────────────────────────────────────────────────┐
│   └── [todos os módulos importam daqui]                                    │
├── config.js                                                                 │
├── services/                                                                 │
│   ├── supabase.js          (cliente — inicializado 1x)                     │
│   ├── auth.js              → supabase.js                                   │
│   ├── sync.js              → supabase.js, state.js ──────────────────────►│
│   ├── exchange.js          → state.js                                      │
│   └── transactions.js      → supabase.js (operações atômicas)              │
├── analytics/                                                                │
│   └── engine.js            → state.js (memoizado)                         │
├── ui/                                                                       │
│   ├── navigation.js        → state.js                                      │
│   ├── dashboard-ui.js      → engine.js, state.js, charts.js               │
│   ├── transactions-ui.js   → state.js, config.js                          │
│   ├── goals-ui.js          → state.js                                      │
│   ├── investments-ui.js    → state.js                                      │
│   ├── cards-ui.js          → state.js                                      │
│   ├── banks-ui.js          → state.js                                      │
│   ├── cashflow-ui.js       → engine.js, state.js                          │
│   ├── market-ui.js         → state.js (exchange)                          │
│   ├── reports-ui.js        → engine.js, state.js                          │
│   ├── chat-ui.js           → engine.js, state.js                          │
│   ├── profile-ui.js        → state.js, auth.js                            │
│   ├── charts.js            → (Chart.js wrapper)                            │
│   └── onboarding.js        → state.js                                      │
└── utils/                                                                    │
    ├── format.js            (puro, zero deps)                                │
    ├── dom.js               → format.js                                     │
    ├── date.js              (puro)                                           │
    └── math.js              (uid gerador, puro)                              │
```

---

## Padrão de Render Global

```javascript
window.appRenderAll = function() {
  renderDashboard();     // tab-0: home widgets
  renderTransactions();  // tab-1: lista de transações
  renderGoals();         // tab-2
  renderInvestments();   // tab-3
  renderCards();         // tab-5
  renderBanks();         // tab-6
  renderCashflow();      // tab-7
  renderMarket();        // tab-8
  renderProfile();       // tab-9
  renderReports();       // tab-4/10
  renderChat();          // sidebar AI
  lucide.createIcons();  // re-hydrate ícones Lucide
};
```

---

## Catálogo de Módulos

### `js/app.js` — Orquestrador Central
- **Função:** Ponto de entrada. Inicialização, ciclo de vida, bindings globais
- **Ciclo:** `initApp()` → `setupAuth()` → `loadState()` → `syncFromSupabase()` → `fetchExchangeRates()` → `processRecurrences()` → `appRenderAll()`
- **Expõe (global):** `window.appRenderAll`, `window.openTxModal`, `window.closeModal`, `window.navigateTo`

Fluxo de init: [[02-business-rules/functional-flows#Fluxo 1]]

---

### `js/state.js` — Estado Global
- **Função:** Fonte única de verdade — objeto `state` + operações de persistência
- **Expõe:** `state` (objeto mutável), `loadState()`, `saveState()`
- **Debounce:** 1500ms antes de acionar `syncToSupabase()`
- **Seed:** `buildSeedState()` → estado inicial para novos usuários

Documentação completa: [[05-architecture/state-management]]

---

### `js/config.js` — Constantes do Domínio
- **Expõe:** `CATEGORIES_LIST`, `PAYMENT_METHODS`, `NAV_LABELS`, `toneForCategory()`, `iconForCategory()`
- **Categorias:** Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Assinaturas, Investimentos, Receita, Rotina + customizadas
- **Métodos de pagamento:** `pix`, `cartao_credito`, `cartao_debito`, `dinheiro`, `conta`

---

### `js/services/supabase.js` — Cliente Supabase
- **Função:** Inicializa e exporta `supabaseClient`
- **Config:** `localStorage['SUPABASE_URL']` + `localStorage['SUPABASE_KEY']`
- **Modo offline:** `supabaseClient = null` se keys ausentes

Decisão: [[06-decisions/adrs#ADR-004]]
Integrações: [[05-architecture/api-integrations#Supabase]]

---

### `js/services/auth.js` — Autenticação
- **Funções:** `initAuth()`, `signIn()`, `signUp()`, `signOut()`, `getSession()`
- **Expõe:** `window.currentUser`

Fluxo: [[02-business-rules/functional-flows#Fluxo 4]]

---

### `js/services/sync.js` — Sincronização Bidirecional
- **Funções:** `syncToSupabase()`, `syncFromSupabase()`, `deleteRemoteTransaction(id)`
- **Estratégias por entidade:** ver [[03-database/schema-reference#Estratégias de Sync]]
- **Resiliência:** `Promise.allSettled` + retry com backoff exponencial

Fluxo: [[02-business-rules/functional-flows#Fluxo 3]]
Bug histórico FK: [[07-bugs-fixes/known-fixes#FIX-003]]

---

### `js/services/exchange.js` — Câmbio
- **Fonte:** AwesomeAPI (USD/EUR/BTC-BRL) com cache 4h
- **Fallback:** USD 5.90, EUR 6.40, BTC 300k se API falhar

Fluxo: [[02-business-rules/functional-flows#Fluxo 8]]
Integrações: [[05-architecture/api-integrations#AwesomeAPI]]

---

### `js/analytics/engine.js` — Motor Analítico
- **Função:** Calcula todas as métricas financeiras a partir do `state` (memoizado)
- **Retorna:** `AnalyticsResult` completo

Documentação completa: [[05-architecture/analytics-engine]]

---

### `js/ui/navigation.js` — Navegação
- **Função:** Troca de abas 0–10, hash routing, painel "Mais", sidebar
- **Globais:** `window.switchTab(n)`, `window.toggleMaisPanel()`, `window.closeMaisPanel()`

UX: [[04-design-system/ux-patterns#Estrutura de Navegação]]
Bug fix de binding global: [[07-bugs-fixes/known-fixes#FIX-004]]

---

### `js/ui/transactions-ui.js` — Transações
- **Função:** Lista filtrada + paginada, modal CRUD completo
- **Classe:** `ModernFloxSelect` — dropdown customizado rico
- **Filtros:** busca, categoria, tipo, status, origem, período, ordenação
- **Bulk:** seleção múltipla, exclusão em massa

UX: [[04-design-system/ux-patterns#Padrões de Lista]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 2]] · [[02-business-rules/functional-flows#Fluxo 9]]
Débito: [[07-bugs-fixes/known-issues#DT-01]]

---

### `js/ui/dashboard-ui.js` — Dashboard / Home
- **Widgets:** Saldo animado, gauge score, calendário financeiro, carrossel metas, próximos eventos, top gastos, insights

Deps: `calculateAnalytics()`, `charts.js`

---

### `js/ui/chat-ui.js` — Assistente AI
- **3 camadas:** NLP transacional → regex local (16 casos) → API externa
- **Rate limit:** 10 msgs/minuto
- **Context injection:** snapshot financeiro completo no system prompt

Fluxo: [[02-business-rules/functional-flows#Fluxo 5]]
Regras: [[02-business-rules/domain-rules#Assistente AI]]
API: [[05-architecture/api-integrations#AI Proxy]]

---

### `js/ui/goals-ui.js` — Metas
- **Função:** Cards de objetivos + ring de progresso + aporte manual
- **Cálculos:** progress%, monthlyNeed, daysLeft, projeção

Regras: [[02-business-rules/domain-rules#Metas Financeiras]]
Engine: [[05-architecture/analytics-engine#Meta Urgente]]

---

### `js/ui/cards-ui.js` — Cartões de Crédito
- **Função:** Gerencia cartões, faturas mensais, limite disponível
- **Modelo:** `Card { id, name, limit, used, closingDay, dueDay }`

Regras: [[02-business-rules/domain-rules#Cartões de Crédito]]
Schema: [[03-database/schema-reference#cards]]

---

### `js/ui/banks-ui.js` — Contas Bancárias
- **Função:** CRUD de contas, exibe saldo calculado

Regras: [[02-business-rules/domain-rules#Contas Bancárias]]
Schema: [[03-database/schema-reference#accounts]]
Bug fix: [[07-bugs-fixes/known-fixes#FIX-006]]

---

### `js/utils/format.js` — Formatadores (puro)
- `formatMoney()`, `formatNumber()`, `formatPercent()`, `formatMoneyShort()`
- `escapeHtml()`, `richText()`, `parseCurrencyInput()`, `animateValue()`

### `js/utils/dom.js` — Utilitários DOM
- `normalizeText()` (remove acentos), `sanitizeHandle()`, `showToast()`
- Bug fix acentos: [[07-bugs-fixes/known-fixes#FIX-008]]

### `js/utils/date.js` — Utilitários de Data
- `parseDateBR()` — `'dd/mm/yyyy'` → `Date`
- `formatShortTime()`, `getMonthRange()`

### `js/utils/math.js` — Matemáticos
- `uid(prefix)` → gera ID único com timestamp + random

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[05-architecture/state-management|State Management →]]
