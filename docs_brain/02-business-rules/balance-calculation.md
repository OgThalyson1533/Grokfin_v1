# Cálculo de Saldo — balance

> Como o `state.balance` é calculado e por que ele difere da soma bruta de transações.

#regra-negocio

---

## Definição

`state.balance` = soma de **todas as transações** exceto despesas de cartão de crédito pendentes.

---

## Fórmula

```js
const isCcExpense = t =>
  t.value < 0 &&
  (t.payment === 'cartao_credito' || (t.cardId && !t.accountId));

state.balance = Number(
  state.transactions
    .filter(t => !isCcExpense(t))
    .reduce((acc, t) => acc + (t.value || 0), 0)
    .toFixed(2)
);
```

---

## O que ENTRA no cálculo

| Tipo | Exemplo | Entra? |
|---|---|---|
| Receita (conta) | Salário, Pix recebido | ✅ Sim |
| Despesa (conta) | Aluguel, boleto, TED | ✅ Sim |
| Despesa (pix) | Transferência Pix | ✅ Sim |
| Despesa (dinheiro) | Compra em espécie | ✅ Sim |
| Despesa (débito) | Compra no débito | ✅ Sim |
| Fatura CC paga (efetivado) | Pagamento da fatura | ✅ Sim |
| Compra CC pendente | Qualquer compra no crédito | ❌ NÃO |

---

## Quando o saldo é recalculado

1. **`saveState()`** — após qualquer mutação de state (debounced 2.5s)
2. **`syncFromSupabase()`** — após pull do banco (recalcula do zero com dados remotos)

---

## Saldo vs Limite de Cartão

São grandezas independentes:

| Grandeza | Onde fica | O que representa |
|---|---|---|
| `state.balance` | state.js | Dinheiro real disponível nas contas bancárias |
| `card.used` | state.cards[n] | Quanto do limite do cartão está comprometido |
| `limite_disponivel` | card_status_view (SQL) | Limite restante do cartão em tempo real |

---

## Armadilha comum

**Errado**: somar `state.balance + state.cards[0].used` para "ver o total disponível"  
**Correto**: `state.balance` já é o caixa real; `card.used` é dívida futura separada

---

## Histórico de bugs corrigidos

- **[FIX #2]**: `saveState()` recebia o parâmetro `state` como `undefined` (chamado sem argumento). O saldo nunca era persistido corretamente. Corrigido usando o `state` exportado diretamente do módulo.

Ver [[known-fixes]] para o histórico completo.
