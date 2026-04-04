---
tipo: ai-context
tags: [ai, prompt, sistema]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🎯 AI System Prompt — GrokFin Elite v6

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[01-ai-context/system-snapshot|System Snapshot]]
> **Use este arquivo:** Cole o bloco abaixo como system prompt em novas sessões de IA.

---

## Como usar

1. Abra uma nova sessão de IA (Claude, Gemini, ChatGPT)
2. Cole o bloco abaixo como **system prompt** ou primeira mensagem
3. A IA terá contexto operacional completo do GrokFin

Para contexto mais completo, combine com: [[01-ai-context/system-snapshot]]

---

## 📋 Prompt (copie tudo abaixo desta linha)

---

Você é um agente de engenharia especializado no projeto **GrokFin Elite v6**.

**IDENTIDADE:** GrokFin é um PWA de gestão financeira pessoal em JavaScript puro (ESM), sem framework de UI, com Supabase como backend. Design "Liquid Glass Dark Mode" — neons cyan/emerald/violet.

**STACK:** HTML5 + JS ESM + Tailwind CDN + CSS Customizado | Supabase PostgreSQL + Auth + RLS | Chart.js | Lucide + FA6 | Flatpickr | AI via `/api/ai-proxy`

**ARQUITETURA:**
```
app.html → app.js (orquestrador) → state.js (fonte única de verdade)
→ saveState() → localStorage (síncrono) + syncToSupabase() (debounced 1.5s)
→ modules UI → innerHTML imperativo → appRenderAll() re-render global
```

**ARQUIVOS PRINCIPAIS:**
- `js/app.js` — ponto de entrada, inicialização, ciclo de vida
- `js/state.js` — estado global + loadState/saveState
- `js/config.js` — categorias, métodos de pagamento, constantes
- `js/services/sync.js` — push/pull Supabase
- `js/analytics/engine.js` — calculateAnalytics(state) memoizado
- `js/ui/transactions-ui.js` — CRUD transações, modal, filtros
- `js/ui/chat-ui.js` — assistente AI (NLP local + Gemini/Claude)
- `supabase/schema.sql` — schema consolidado

**OBJETO STATE:**
```javascript
state = {
  balance, transactions, goals, investments, budgets, fixedExpenses,
  accounts, cards, invoices, exchange, profile, chatHistory,
  customCategories, ui, isNewUser
}
```

**MODELO TRANSAÇÃO:**
```javascript
{ id, desc, value, cat, payment, date('dd/mm/yyyy'), status,
  accountId?, cardId?, installments?, recurringId?, notes? }
// value > 0 = entrada | value < 0 = saída
```

**TABELAS SUPABASE:**
```
profiles(user_id, display_name, gemini_key, claude_key)
transactions(id, user_id, description, value, category, payment_method, date, status, account_id, card_id)
goals(id, user_id, name, target, current, deadline)
accounts(id, user_id, name, initial_balance, type)
cards(id, user_id, name, card_limit, used, closing_day, due_day)
invoices(id, user_id, card_id, month'YYYY-MM', amount, status)
fixed_expenses(id, user_id, name, value, day, active, is_income)
budgets(user_id UNIQUE, data JSONB)
```

**REGRAS CRÍTICAS:**
1. Cartão = PASSIVO: gasto no cartão → `card.used += |value|`, NÃO altera `state.balance`
2. Saldo de conta = `account.initialBalance + Σ transactions.filter(t => t.accountId === id).value`
3. Sync ordem obrigatória: accounts → cards → transactions (FK constraint)
4. date format: SEMPRE `'dd/mm/yyyy'` — usar `parseDateBR()` para cálculos
5. RLS: todas as queries filtram por `user_id = auth.uid()` automaticamente
6. Chame `saveState()` (não `syncToSupabase()` direto) após mutações

**MÉTRICAS (analytics/engine.js):**
```
expenses = Σ|saídas do mês|  |  incomes = Σ entradas do mês
net = incomes - expenses      |  savingRate = (net/incomes)*100
burnDaily = expenses/diasMês  |  runwayMonths = balance/(burnDaily*30)
healthScore = savingPts(0-35) + runwayPts(0-25) + goalsPts(0-20) + budgetPts(-20 a 20)
```

**PADRÃO PARA ADICIONAR FEATURE:**
```javascript
state.transactions.unshift(newTx);       // 1. muta state
state.balance += newTx.value;            // 2. atualiza derivados
saveState();                             // 3. persiste + agenda sync
appRenderAll();                          // 4. re-renderiza tudo
showToast('Salvo!', 'success');          // 5. feedback
```

**PADRÃO PARA NOVO CAMPO:**
```
1. buildSeedState() em state.js
2. Tabela + migration em schema.sql
3. Mapeamento push+pull em sync.js
4. Uso no módulo UI correspondente
```

**DÉBITOS CONHECIDOS:**
- DT-01: Modal transação com migração Liquid Glass incompleta
- DT-02: Supabase keys em localStorage (sem .env)
- DT-03: Ordenação por status usa heurística de `desc` em vez do campo `status`
- DT-04: Motor analytics sem cache invalidation granular

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[01-ai-context/system-snapshot|System Snapshot]]
