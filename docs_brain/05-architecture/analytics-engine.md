---
tipo: arquitetura
tags: [analytics, métricas, engine, cálculo]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 📊 Analytics Engine — Motor de Análise Financeira

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[05-architecture/api-integrations|API Integrations]]
> **Arquivo:** `js/analytics/engine.js`
> **Relacionados:** [[02-business-rules/domain-rules]] · [[05-architecture/state-management]] · [[04-design-system/ux-patterns#Insight Cards]]

---

## Visão Geral

```javascript
// Assinatura
export function calculateAnalytics(state) → AnalyticsResult

// Memoização
// Cache invalidado quando: state.transactions ou state.goals mudam
// Evita recálculo desnecessário a cada render
```

Decisão: [[06-decisions/adrs#ADR-005]] (renderização imperativa — re-render global a cada mutação)
Débito de cache: [[07-bugs-fixes/known-issues#DT-05]]

---

## Objeto de Retorno (`AnalyticsResult`)

```typescript
interface AnalyticsResult {
  // Resumo do Mês
  expenses: number;              // Σ |saídas| do mês
  incomes: number;               // Σ entradas do mês
  net: number;                   // incomes - expenses
  savingRate: number;            // % poupança

  // Burn Rate e Runway
  burnDaily: number;             // gasto diário médio
  runwayMonths: number;          // meses de fôlego no saldo

  // Score
  healthScore: number;           // 0–100
  scoreBreakdown: {
    saving: number;              // 0–35
    runway: number;              // 0–25
    goals: number;               // 0–20
    budget: number;              // -20 a 20
  };

  // Categorias
  categories: Array<[string, number]>;  // ordenado por valor desc
  topCategory: { name: string; value: number };

  // Orçamentos
  budgetUse: Array<{ cat, value, limit, ratio }>;
  overspend: { cat, value, limit, ratio } | null;

  // Metas
  urgentGoal: {
    nome, total, atual, progress, remaining,
    monthlyNeed, daysLeft, deadline?
  } | null;

  // Evento Fixo
  nextFixedEvent: { name, value, day, daysUntil } | null;

  // Comparativo
  lastMonthExpenses: number;
  lastMonthIncomes: number;
  trend3m: number;               // % variação 3 meses

  // Transações
  monthTransactions: Transaction[];
}
```

---

## Filtragem por Mês Atual

```javascript
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

const monthTransactions = state.transactions.filter(tx => {
  const txDate = parseDateBR(tx.date);  // 'dd/mm/yyyy' → Date
  return txDate.getMonth() === currentMonth
      && txDate.getFullYear() === currentYear;
});
```

Parser: `utils/date.js` → `parseDateBR()`

---

## Expenses e Incomes

```javascript
const expenses = monthTransactions
  .filter(tx => tx.value < 0)
  .reduce((sum, tx) => sum + Math.abs(tx.value), 0);

const incomes = monthTransactions
  .filter(tx => tx.value > 0)
  .reduce((sum, tx) => sum + tx.value, 0);
```

Regras: [[02-business-rules/domain-rules#Transações]]

---

## Saving Rate

```javascript
const net = incomes - expenses;
const savingRate = incomes > 0 ? (net / incomes) * 100 : 0;
```

---

## Burn Rate e Runway

```javascript
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const burnDaily = expenses / daysInMonth;
const runwayMonths = burnDaily > 0
  ? state.balance / (burnDaily * 30)
  : 99;  // fôlego infinito se sem gastos
```

---

## Health Score (0–100)

```javascript
// Eixo 1: Taxa de Poupança (max 35pts)
const savingPts = Math.min(35, Math.max(0, (savingRate / 30) * 35));
// 0% saving = 0pts | 30%+ saving = 35pts (linear)

// Eixo 2: Runway (max 25pts)
const runwayPts = Math.min(25, Math.max(0, (runwayMonths / 6) * 25));
// 0 meses = 0pts | 6+ meses = 25pts (linear)

// Eixo 3: Metas Ativas (max 20pts)
const activeGoals = (state.goals || []).filter(g => g.atual < g.total).length;
const goalsPts = Math.min(20, activeGoals * 10);
// 0 metas = 0pts | 2+ metas = 20pts

// Eixo 4: Orçamento (-20 a 20pts)
const overspendings = budgetUse.filter(b => b.ratio > 1).length;
const budgetPts = Math.max(-20, 20 - (overspendings * 5));
// Sem estouros = 20pts | -5pts por orçamento estourado

const healthScore = Math.round(
  Math.max(0, Math.min(100, savingPts + runwayPts + goalsPts + budgetPts))
);
```

Classificações: [[02-business-rules/domain-rules#Health Score]]

---

## Categorias

```javascript
const catMap = new Map();
monthTransactions
  .filter(tx => tx.value < 0)
  .forEach(tx => {
    const prev = catMap.get(tx.cat) || 0;
    catMap.set(tx.cat, prev + Math.abs(tx.value));
  });

const categories = [...catMap.entries()]
  .sort((a, b) => b[1] - a[1]);  // Array<[cat, value]>

const topCategory = categories[0]
  ? { name: categories[0][0], value: categories[0][1] }
  : { name: '-', value: 0 };
```

---

## Budget Use

```javascript
const budgetUse = Object.entries(state.budgets || {})
  .filter(([, limit]) => limit > 0)
  .map(([cat, limit]) => {
    const value = catMap.get(cat) || 0;
    return { cat, value, limit, ratio: value / limit };
    // ratio > 1.0 = orçamento estourado
  });

const overspend = [...budgetUse]
  .filter(b => b.ratio > 1)
  .sort((a, b) => b.ratio - a.ratio)[0] || null;
```

Regras: [[02-business-rules/domain-rules#Orçamentos]]
Schema: [[03-database/schema-reference#budgets]]

---

## Meta Urgente

```javascript
const urgentGoal = (state.goals || [])
  .filter(g => g.atual < g.total && g.deadline)
  .map(g => {
    const daysLeft = Math.max(0,
      Math.ceil((new Date(g.deadline) - now) / 86400000));
    const monthsLeft = Math.max(1, daysLeft / 30);
    const remaining = g.total - g.atual;
    const monthlyNeed = remaining / monthsLeft;
    const progress = Math.round((g.atual / g.total) * 100);
    return { ...g, progress, remaining, monthlyNeed, daysLeft };
  })
  .sort((a, b) => a.daysLeft - b.daysLeft)[0] || null;
```

Regras: [[02-business-rules/domain-rules#Urgência]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 11]]

---

## Próximo Evento Fixo

```javascript
const today = now.getDate();
const nextFixedEvent = (state.fixedExpenses || [])
  .filter(fe => fe.active !== false)
  .map(fe => ({
    ...fe,
    daysUntil: fe.day >= today
      ? fe.day - today                     // ainda neste mês
      : daysInMonth - today + fe.day       // próximo mês
  }))
  .sort((a, b) => a.daysUntil - b.daysUntil)[0] || null;
```

Regras: [[02-business-rules/domain-rules#Recorrências]]

---

## Tendência 3 Meses

```javascript
// Calcula despesas de 3 meses anteriores
const last3avg = average([
  getMonthExpenses(1),  // 1 mês atrás
  getMonthExpenses(2),  // 2 meses atrás
  getMonthExpenses(3)   // 3 meses atrás
]);

const trend3m = last3avg > 0
  ? ((expenses - last3avg) / last3avg) * 100
  : 0;
// > 0 = gastando mais que a média | < 0 = melhorando
```

---

## Uso nos Módulos Consumidores

| Módulo | Métricas Usadas |
|---|---|
| `dashboard-ui.js` | Todas — score, calendário, widgets, carrossel |
| `chat-ui.js` | incomes, expenses, net, savingRate, score, burn, runway |
| `reports-ui.js` | trend3m, categories, budgetUse |
| `cashflow-ui.js` | nextFixedEvent, burnDaily |
| `chat-ui.js` → sugestões | overspend, urgentGoal, runwayMonths, topCategory |

Módulo dashboard: [[05-architecture/module-map#dashboard-ui.js]]
Chat: [[05-architecture/module-map#chat-ui.js]]

---

## Performance

### Memoização
```javascript
let _memo = null;
let _memoKey = null;

export function calculateAnalytics(state) {
  // Hash simplificada: serializa apenas os dados que afetam o cálculo
  const key = JSON.stringify(state.transactions) + JSON.stringify(state.goals);
  if (_memo && _memoKey === key) return _memo;

  const result = _compute(state);
  _memo = result;
  _memoKey = key;
  return result;
}
```

### Complexidade Temporal
```
O(n)     → filtragem de transações por mês
O(n log n) → ordenação de categorias por valor
O(m)     → cálculo de urgência de metas (m = metas)
Total: O(n log n) onde n = número de transações
```

**Custo de memoização:** `JSON.stringify(transactions)` pode ser lento para >500 transações.
Débito: [[07-bugs-fixes/known-issues#DT-05]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[05-architecture/api-integrations|API Integrations]]
