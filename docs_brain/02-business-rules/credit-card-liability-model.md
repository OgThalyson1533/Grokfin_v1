# 🔴 Modelo de Passivo — Cartão de Crédito

> **Regra mais crítica do GroKFin.** Qualquer dev novo que não entender isso vai "corrigir" e quebrar o app.

#regra-negocio

---

## A Regra

> **Despesas em cartão de crédito NÃO reduzem o saldo disponível no momento da compra.**

O saldo (`state.balance`) só é afetado quando a **fatura é paga** (status `'paga'`).

Isso é o modelo correto de passivo contábil: a despesa no crédito cria uma dívida (passivo), não um débito imediato no caixa.

---

## Como está implementado

### 1. `state.js` → `saveState()` (cálculo do saldo)

```js
const isCcExpense = t => t.value < 0 && (
  t.payment === 'cartao_credito' ||
  (t.cardId && !t.accountId)   // vinculada a cartão sem conta bancária
);

state.balance = state.transactions
  .filter(t => !isCcExpense(t))
  .reduce((acc, t) => acc + t.value, 0);
```

### 2. `sync.js` → `syncFromSupabase()` (pull do banco)

```js
const isCcExpense = t => t.value < 0 && (
  t.payment === 'cartao_credito' || (t.cardId && !t.accountId)
);
state.balance = state.transactions
  .filter(t => !isCcExpense(t))
  .reduce((acc, t) => acc + t.value, 0);
```

### 3. `schema.sql` → View `card_status_view`

```sql
-- Limite disponível = limite total - transações CC com status 'pendente'
(c.card_limit - COALESCE(SUM(t.amount), 0)) AS limite_disponivel

-- Filtro: só transações pendentes (dívida em aberto)
AND t.payment = 'credito'
AND t.status = 'pendente'
```

---

## Fluxo Completo de uma Compra no Crédito

```
1. Usuário lança compra: value=-500, payment='cartao_credito', status='pendente'
   → state.balance NÃO muda
   → Limite do cartão reduz em R$ 500 (via card_status_view)

2. Fatura fecha → fechar_faturas_e_cobrar() (pg_cron)
   → Gera transação na conta corrente: value=-500, status='pendente'
   → Fatura: status='fechada'

3. Usuário paga fatura → liquidar_fatura() (RPC)
   → Transação da conta: status='efetivado' → state.balance reduz R$ 500
   → Transações CC da fatura: status='efetivado' → limite restaurado
   → Fatura: status='paga'
```

---

## Discriminador de Despesa CC

A condição exata usada em todo o app:

```js
const isCcExpense = t =>
  t.value < 0 &&
  (t.payment === 'cartao_credito' || (t.cardId && !t.accountId));
```

**Nunca alterar esta condição sem atualizar todos os pontos onde ela aparece.**

Pontos de uso:
- `js/state.js` → `saveState()`
- `js/services/sync.js` → `syncFromSupabase()`

---

## Por que não simplesmente somar tudo?

Porque o usuário precisa saber quanto dinheiro **real** ele tem na conta bancária, separado das dívidas no crédito que ainda não venceram. Somar tudo daria um saldo errado (mais baixo) e assustaria o usuário desnecessariamente.

Ver também: [[ADR-001-liability-model]]
