---
tipo: fixes
tags: [fixes, correções, histórico]
backlinks: [[MOC — GrokFin Elite v6]]
---

# ✅ Known Fixes — Correções Aplicadas

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[07-bugs-fixes/known-issues|Known Issues]]
> **Relacionados:** [[05-architecture/state-management]] · [[03-database/schema-reference]] · [[02-business-rules/functional-flows]]

---

## FIX-001 — Aba Mercado não renderizava no ciclo global {#FIX-001}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** `renderMarket()` não era chamada, aba Mercado mostrava conteúdo stale.

**Causa raiz:** Esquecimento ao registrar o módulo no ciclo de render global de `app.js`.

**Correção:**
```javascript
// app.js — appRenderAll()
+ renderMarket();  // adicionado
```

**Arquivo:** `js/app.js`
**Ciclo de render:** [[05-architecture/module-map#Padrão de Render Global]]

---

## FIX-002 — Saldo incluía despesas pendentes de cartão {#FIX-002}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** `state.balance` diminuía ao registrar gastos no cartão de crédito.

**Causa raiz:** Falta de verificação `if (!tx.cardId)` antes de atualizar `state.balance`.

**Correção:**
```javascript
// handleSubmitTransaction() — transactions-ui.js
- state.balance += newTx.value;
+ if (!newTx.cardId) state.balance += newTx.value;
+ if (newTx.cardId) { const card = state.cards.find(c => c.id === newTx.cardId);
+   if (card) card.used += Math.abs(newTx.value); }
```

**Arquivo:** `js/ui/transactions-ui.js`
**ADR relacionado:** [[06-decisions/adrs#ADR-007]] (cartão como passivo)
**Regra:** [[02-business-rules/domain-rules#Cartões de Crédito]]

---

## FIX-003 — Foreign Keys inválidas em transactions para cards {#FIX-003}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** Erro de FK violation no Supabase ao salvar transações de cartão.

**Causa raiz:** `card_id` era enviado para o Supabase antes de `cards` serem sincronizados, criando FK orphan.

**Correção:** Reordenada a sequência de sync em `syncToSupabase()`:
```
ANTES: transactions → cards → accounts
DEPOIS: accounts → cards → transactions  ✅
```

**Arquivo:** `js/services/sync.js`
**Fluxo:** [[02-business-rules/functional-flows#Fluxo 3]]
**Schema:** [[03-database/schema-reference#Estratégias de Sync]]

---

## FIX-004 — Funções de navegação não acessíveis via onclick {#FIX-004}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** Botões com `onclick="switchTab(N)"` geravam `ReferenceError` no console.

**Causa raiz:** Funções definidas como `export function` em módulos ESM não são acessíveis no escopo global `window`.

**Correção:**
```javascript
// navigation.js — após definição das funções
+ window.switchTab = switchTab;
+ window.toggleMaisPanel = toggleMaisPanel;
+ window.closeMaisPanel = closeMaisPanel;
```

**Arquivo:** `js/ui/navigation.js`
**ADR:** [[06-decisions/adrs#ADR-001]] (ESM sem bundler — consequência esperada)

---

## FIX-005 — Calendário financeiro estourava layout em telas estreitas {#FIX-005}

**Data:** 2026-04 | **Status:** ✅ Resolvido

**Sintoma:** Tags de valor (`.fin-cal-tag`) transbordavam da célula do calendário em telas <400px.

**Causa raiz:** Falta de `min-width: 0` e `overflow: hidden` nas células do grid CSS.

**Correção:**
```css
/* css/components.css */
.fin-cal-day {
+ min-width: 0;
+ overflow: hidden;
+ box-sizing: border-box;
}
.fin-cal-tag {
+ display: block;
+ max-width: 100%;
+ overflow: hidden;
+ text-overflow: ellipsis;
}
```

**Arquivo:** `css/components.css`
**Design:** [[04-design-system/design-tokens#Calendário Financeiro]]

---

## FIX-006 — Dados não persistiam ao criar conta bancária {#FIX-006}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** Contas criadas em `banks-ui.js` não apareciam após refresh.

**Causa raiz:** `sync.js` não mapeava o campo `initial_balance` corretamente (camelCase → snake_case).

**Correção:**
```javascript
// sync.js — upsert de accounts
{
  id: account.id,
  user_id: userId,
  name: account.name,
- initialBalance: account.initialBalance,  // ❌ não existe no DB
+ initial_balance: account.initialBalance,  // ✅ snake_case
  type: account.type,
  color: account.color,
}
```

**Arquivo:** `js/services/sync.js`
**Schema:** [[03-database/schema-reference#accounts]]

---

## FIX-007 — Metas não carregavam do Supabase após sync {#FIX-007}

**Data:** 2026-03 | **Status:** ✅ Resolvido

**Sintoma:** Metas criadas em um dispositivo não apareciam ao abrir em outro.

**Causa raiz:** `syncFromSupabase()` não mapeava corretamente `name→nome`, `target→total`, `current→atual`.

**Correção:**
```javascript
// sync.js — pull de goals
state.goals = goalsData.map(g => ({
  id: g.id,
- name: g.name,    // ❌ state usa 'nome'
+ nome: g.name,    // ✅
- target: g.target, // ❌ state usa 'total'
+ total: g.target,  // ✅
- current: g.current, // ❌ state usa 'atual'
+ atual: g.current,   // ✅
  deadline: g.deadline,
  icon: g.icon,
  color: g.color,
  imageUrl: g.image_url,
}));
```

**Arquivo:** `js/services/sync.js`
**Schema:** [[03-database/schema-reference#goals]]
**Regras:** [[02-business-rules/domain-rules#Metas Financeiras]]

---

## FIX-008 — Busca de transações não normalizava acentos {#FIX-008}

**Data:** 2026-04 | **Status:** ✅ Resolvido

**Sintoma:** Buscar "alimentacao" não encontrava transações com categoria "Alimentação".

**Causa raiz:** A busca comparava strings brutas sem remover diacríticos.

**Correção:**
```javascript
// transactions-ui.js — getFilteredTransactions()
function normalizeText(text) {
  return (text || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
// Aplicar em ambos os lados da comparação:
const searchNorm = normalizeText(state.ui.txSearch);
const match = normalizeText(tx.desc + tx.cat + tx.date).includes(searchNorm);
```

**Arquivo:** `js/utils/dom.js` + `js/ui/transactions-ui.js`
**Módulo:** [[05-architecture/module-map#dom.js]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[07-bugs-fixes/known-issues|Known Issues]]
