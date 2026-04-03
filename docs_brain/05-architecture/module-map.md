# Module Map — Arquitetura de Módulos

> Mapa de dependências e responsabilidades de cada arquivo JS.  
> Fonte: `js/app.js` (orquestrador central)

#arquitetura

---

## Hierarquia de Módulos

```
app.js  ← ORQUESTRADOR CENTRAL (entry point)
│
├── state.js          ← Estado único da aplicação
│   ├── config.js
│   ├── utils/math.js
│   ├── utils/date.js
│   └── services/sync.js
│
├── services/
│   ├── auth.js       ← Supabase Auth (signIn, signUp, signOut)
│   ├── supabase.js   ← Client Supabase (instância única)
│   ├── sync.js       ← Push/Pull Supabase (diff-based, paralelo)
│   ├── exchange.js   ← Cotações de câmbio (USD, EUR, BTC)
│   ├── transactions.js
│   ├── cards.js
│   ├── goals.js
│   ├── investments.js
│   └── market.js
│
├── analytics/
│   └── engine.js     ← calculateAnalytics, processRecurrences, getPeriodRange
│
├── ui/               ← Cada módulo: bind* (eventos) + render* (DOM)
│   ├── navigation.js
│   ├── dashboard-ui.js   ← renderDashboard, renderHomeWidgets, renderReport
│   ├── transactions-ui.js
│   ├── goals-ui.js
│   ├── cards-ui.js
│   ├── banks-ui.js
│   ├── cashflow-ui.js
│   ├── investments-ui.js
│   ├── chat-ui.js        ← Chat IA (Claude/Gemini/básico)
│   ├── profile-ui.js
│   ├── market-ui.js
│   ├── reports-ui.js
│   ├── charts.js         ← Chart.js (renderCharts)
│   ├── onboarding.js
│   └── navigation.js
│
└── utils/
    ├── date.js       ← parseDateBR, formatDateBR, addMonths
    ├── dom.js        ← showToast, helpers DOM
    ├── format.js     ← formatMoney, formatNumber, formatPercent
    └── math.js       ← uid(), clamp()
```

---

## Convenção de Módulo UI

Todo módulo em `js/ui/` segue o padrão:

```js
// Bind de eventos (chamado uma vez na inicialização)
export function bindXxxEvents() { ... }

// Render (chamado no ciclo renderAll)
export function renderXxx(analytics?) { ... }
```

O `renderAll()` é debounced via `requestAnimationFrame` para evitar múltiplos renders no mesmo frame.

---

## Globals Expostos em `window`

```js
window.renderAll      // = window.appRenderAll — ciclo global de render
window.appState       // state object — para acesso do calendário inline no HTML
window.showToast      // utilitário de notificação
window.renderHeaderMeta
window.finCalRender   // renderização do calendário financeiro (definido no HTML)
```

---

## Config Central (`js/config.js`)

| Exportação | Tipo | Descrição |
|---|---|---|
| `STORAGE_KEY` | string | `'grokfin_hybrid_pwa_state'` |
| `NAV_LABELS` | string[] | Labels das 11 abas |
| `NAV_HASHES` | string[] | Hashes de URL das 11 abas |
| `NAV_ICONS` | string[] | Classes FontAwesome de cada aba |
| `TX_PAGE_SIZE` | number | 20 transações por página |
| `CATEGORIES_LIST` | string[] | Categorias canônicas para orçamento |
| `PAYMENT_METHODS` | object[] | Formas de pagamento disponíveis |
| `iconByCategory` | object | Categoria → ícone FA |
| `toneByCategory` | object | Categoria → classe CSS de tone |
| `iconForCategory()` | function | |
| `toneForCategory()` | function | |

---

## Abas (Tabs)

| Índice | Label | Hash | Módulo de Render |
|---|---|---|---|
| 0 | Home | `home` | `dashboard-ui.js` |
| 1 | Análise | `analise` | `dashboard-ui.js` |
| 2 | Conta | `conta` | `transactions-ui.js` |
| 3 | Chat | `chat` | `chat-ui.js` |
| 4 | Metas | `metas` | `goals-ui.js` |
| 5 | Perfil | `perfil` | `profile-ui.js` |
| 6 | Cartões | `cartoes` | `cards-ui.js` |
| 7 | Fluxo | `fluxo` | `cashflow-ui.js` |
| 8 | Invest. | `investimentos` | `investments-ui.js` |
| 9 | Mercado | `mercado` | `market-ui.js` |
| 10 | Relatórios | `relatorios` | `reports-ui.js` |
