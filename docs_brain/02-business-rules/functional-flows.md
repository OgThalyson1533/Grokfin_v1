---
tipo: fluxos-funcionais
tags: [fluxo, processo, interação]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🔄 Functional Flows — Fluxos Funcionais

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[02-business-rules/domain-rules|Domain Rules]]
> **Relacionados:** [[05-architecture/state-management]] · [[05-architecture/module-map]] · [[03-database/schema-reference]]

---

## Fluxo 1: Inicialização da Aplicação

```
Browser abre app.html
└─► DOMContentLoaded → initApp() [app.js]
    ├─ loadState()            → localStorage → merge com seed
    ├─ syncFromSupabase()     → pull dados do Supabase (se autenticado)
    ├─ fetchExchangeRates()   → AwesomeAPI (cache 4h)
    ├─ processRecurrences()   → lança fixedExpenses do mês → ver Fluxo 7
    ├─ setupNavigation()      → inicializa hash routing
    ├─ setupEventListeners()  → bindings do modal, chat, painel "Mais"
    └─ appRenderAll()         → renderiza todas as abas
```

- Módulos: [[05-architecture/module-map#app.js]]
- Estado: [[05-architecture/state-management#loadState]]
- Exchange: [[05-architecture/api-integrations#AwesomeAPI]]

---

## Fluxo 2: Criar Nova Transação

```
Click "Nova Transação" → openTxModal()
    ├─ populateAccountSelect() → lista contas + cartões
    ├─ populateCategorySelect() → categorias base + custom
    └─ Exibe modal [Liquid Glass]

Usuário preenche:
    ├─ _syncTypeTabs() → atualiza visual entrada/saída
    └─ _updateFormContext() → mostra/oculta parcelamento, recorrência

Click "Salvar" → handleSubmitTransaction()
    ├─ Cria objeto Transaction com uid('tx')
    ├─ Se cartão: card.used += |value| (NÃO altera state.balance)
    ├─ Se conta/principal: state.balance += value
    ├─ Se parcelado: gera N transações
    ├─ state.transactions.unshift(tx)
    ├─ saveState() → localStorage + Supabase (debounced 1.5s)
    └─ appRenderAll()
```

- Regras: [[02-business-rules/domain-rules#Transações]] · [[02-business-rules/domain-rules#Cartões de Crédito]]
- UI: [[04-design-system/ux-patterns#Modal de Transação]]
- Schema: [[03-database/schema-reference#transactions]]

---

## Fluxo 3: Sincronização com Supabase

```
saveState() → localStorage (SÍNCRONO) + setTimeout 1500ms → syncToSupabase()

syncToSupabase() [sync.js] — push paralelo (Promise.allSettled):
    ├─ profiles    → upsert (user_id)
    ├─ accounts    → upsert por id  ← ANTES das transactions
    ├─ cards       → upsert por id  ← ANTES das transactions
    ├─ transactions→ upsert por id + delete de removidos
    ├─ goals       → DELETE all + INSERT (garantia de consistência)
    ├─ invoices    → upsert por (card_id, month)
    ├─ fixed_expenses → upsert por id
    └─ budgets     → upsert (user_id único)
```

- Estratégias: [[03-database/schema-reference#Estratégias de Sync]]
- Estado: [[05-architecture/state-management#syncToSupabase]]
- API: [[05-architecture/api-integrations#Supabase]]

> ⚠️ Ordem obrigatória: `accounts` e `cards` ANTES de `transactions` (FK constraint)

---

## Fluxo 4: Autenticação

```
Login → signIn(email, password) [auth.js]
    ├─ supabase.auth.signInWithPassword()
    ├─ window.currentUser = user
    ├─ syncFromSupabase() → carrega dados
    └─ appRenderAll()

Logout → signOut()
    ├─ supabase.auth.signOut()
    ├─ Limpa localStorage
    └─ Redireciona para login

Auto-login → supabase.auth.getSession() no init
```

- Módulo: [[05-architecture/module-map#auth.js]]
- API: [[05-architecture/api-integrations#Supabase]]
- RLS: [[03-database/schema-reference#Políticas RLS]]

---

## Fluxo 5: Chat com Assistente AI

```
Usuário digita → sendChatMessage()
    ├─ checkChatRateLimit() → máx 10/min
    ├─ pushChatMessage('user', text)
    ├─ setChatTyping(true)
    │
    ├─ [Camada 1] handleBotTransaction(text)
    │   ├─ Detecta intent: recebi/gastei/comprei...
    │   ├─ Extrai: valor, categoria, pagamento, data
    │   ├─ Cria transação → state + saveState() + appRenderAll()
    │   └─ Retorna resposta humanizada
    │
    ├─ [Camada 2] buildAssistantReply(text) — NLP regex local
    │   └─ 16 casos: saldo, metas, orçamento, câmbio, score...
    │
    └─ [Camada 3] API externa (se apiKey configurada)
        ├─ getAIProvider(key) → 'gemini'|'claude'
        ├─ Injeta contexto financeiro no system prompt
        └─ callAIProxy('/api/ai-proxy') → resposta IA
```

- Módulo: [[05-architecture/module-map#chat-ui.js]]
- Regras: [[02-business-rules/domain-rules#Assistente AI]]
- API: [[05-architecture/api-integrations#AI Proxy]]
- UX: [[04-design-system/ux-patterns#Padrões do Chat]]

---

## Fluxo 6: Análise Financeira (Dashboard)

```
appRenderAll() → renderDashboard()
    └─ calculateAnalytics(state) [engine.js — memoizado]
        ├─ Filtra transações do mês corrente
        ├─ Calcula: expenses, incomes, net, savingRate
        ├─ Calcula: burnDaily, runwayMonths
        ├─ Calcula: healthScore (4 eixos ponderados)
        ├─ Agrupa categorias por valor (top 10)
        ├─ Calcula budgetUse e overspend
        ├─ Identifica: topCategory, urgentGoal, nextFixedEvent
        └─ Calcula: trend3m, lastMonthExpenses/Incomes

renderDashboard() usa analytics para:
    ├─ Saldo animado (animateValue)
    ├─ Gauge de score (SVG ring)
    ├─ Calendário financeiro (FinCal grid 7×N)
    ├─ Carrossel de metas (rings SVG por meta)
    ├─ Próximos eventos (fixedExpenses ordenados por daysUntil)
    └─ Insights contextuais (cards overspend, urgentGoal)
```

- Engine: [[05-architecture/analytics-engine]]
- UX: [[04-design-system/ux-patterns#Micro-Animações]]
- Design: [[04-design-system/design-tokens#Gauge High Fidelity]]

---

## Fluxo 7: Recorrências Mensais

```
initApp() → processRecurrences()
    ├─ Para cada fixedExpense onde active = true:
    │   ├─ Verifica: transaction WHERE recurringId = fe.id AND isSameMonth(date)
    │   ├─ Se NÃO existe: cria transação automática com recurringId = fe.id
    │   └─ Se JÁ existe: skip (idempotente)
    └─ Se houve novos lançamentos: saveState() + appRenderAll()
```

- Regras: [[02-business-rules/domain-rules#Recorrências]]
- Schema: [[03-database/schema-reference#fixed_expenses]]

---

## Fluxo 8: Cotações de Câmbio

```
initApp() → fetchExchangeRates() [exchange.js]
    ├─ Verifica cache: state.exchange.lastSync + 4h
    ├─ Se cache válido: usa state sem chamar API
    └─ Se expirado:
        ├─ GET economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL
        ├─ state.exchange = { usd, eur, btc, trend, lastSync }
        ├─ saveState()
        └─ renderMarket()

Em caso de falha: usa state.exchange existente OU defaults
```

- API: [[05-architecture/api-integrations#AwesomeAPI]]
- Regras: [[02-business-rules/domain-rules#Câmbio]]

---

## Fluxo 9: Filtros de Transações

```
Usuário aplica filtro → triggerTxFilter() / debounceTxFilter()
    ├─ Atualiza state.ui.tx* → state.ui.txPage = 0
    └─ renderTransactions()

getFilteredTransactions():
    [1] busca textual: normalizeText(desc + cat + date)
    [2] categoria: tx.cat === state.ui.txCategory
    [3] tipo: tx.value > 0 (entrada) ou < 0 (saída)
    [4] origem: bank (sem cardId) ou card (com cardId)
    [5] status: tx.status === 'pendente'|'concluido'
    [6] período: parseDateBR(tx.date) >= start && <= end
    [7] ordenação: por data|value|desc com asc|desc

Paginação: fullList.slice(page * pageSize, (page+1) * pageSize)
```

- UI: [[04-design-system/ux-patterns#Padrões de Lista]]
- Estado: [[05-architecture/state-management#Estado da UI]]

---

## Fluxo 10: Exclusão em Massa de Transações

```
Seleção → toggleTxRow(checkbox, txId)
    └─ selectedTxIds.add/delete(txId) → updateBulkActionsBar()

Click "Excluir Selecionados" → bulkDeleteTx()
    └─ Abre modal confirmação #tx-bulk-delete-overlay

Confirmação → _executeBulkDelete()
    ├─ deleteRemoteTransaction(id) → DELETE Supabase (fire-and-forget)
    ├─ state.transactions.filter() → remove localmente
    ├─ state.balance -= tx.value (se não for cartão)
    ├─ selectedTxIds.clear()
    ├─ saveState()
    └─ appRenderAll() + showToast()
```

- API: [[05-architecture/api-integrations#Supabase]]
- UX: [[04-design-system/ux-patterns#Padrões de Feedback]]

---

## Fluxo 11: Aporte em Meta

```
Click "Aportar" → openGoalContribution(goalId)
    └─ Exibe modal com valor sugerido (monthlyNeed)

Confirmação → contributeToGoal(goalId, value)
    ├─ goal.atual += value
    ├─ Cria transação de saída (cat = 'Investimentos')
    ├─ state.balance -= value
    ├─ saveState()
    └─ appRenderAll()
```

- Regras: [[02-business-rules/domain-rules#Metas Financeiras]]
- Engine: [[05-architecture/analytics-engine#Meta Urgente]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[02-business-rules/domain-rules|Domain Rules]]
