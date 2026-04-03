# ADR-001 — Modelo de Passivo para Cartão de Crédito

**Status**: Aceito  
**Data**: 2026-04  
**Autores**: Thalyson (dev/product owner)

#adr #regra-negocio

---

## Contexto

O GroKFin precisa representar corretamente o impacto financeiro de compras no cartão de crédito. Existem duas abordagens possíveis:

**Opção A — Débito imediato**: A compra no cartão reduz o saldo disponível no momento da compra, assim como uma compra no débito ou Pix.

**Opção B — Modelo de passivo**: A compra no cartão cria uma *dívida futura* (passivo). O saldo bancário só é afetado quando a fatura é efetivamente paga.

---

## Decisão

Adotamos a **Opção B — Modelo de Passivo**.

---

## Justificativa

1. **Comportamento real do dinheiro**: ao comprar no crédito, o dinheiro na conta corrente não sai imediatamente. O usuário ainda tem aquele dinheiro disponível para outros fins até o vencimento da fatura.

2. **Clareza para o usuário**: mostrar o saldo bancário real (sem deduzir CC) é menos confuso. O usuário já sabe que tem uma dívida futura; o app exibe o limite disponível do cartão separadamente.

3. **Separação de visões**: o app mantém dois indicadores distintos:
   - `state.balance` = caixa real (quanto dinheiro está nas contas bancárias)
   - `card.used` = comprometimento futuro no crédito

4. **Modelo contábil correto**: em contabilidade, uma compra no crédito é um passivo, não um débito no caixa. Essa abordagem alinha o app com princípios contábeis.

---

## Consequências

### Positivas
- O usuário vê seu saldo real a qualquer momento
- Dívidas de cartão são visíveis separadamente (limite usado)
- Ao pagar a fatura, o impacto no saldo é explícito e rastreável

### Negativas (trade-offs)
- Complexidade extra de implementação: é necessário distinguir o tipo de pagamento em cada transação
- Dois campos distintos para acompanhar (saldo + limite CC)
- A visão de "saldo total líquido" requer soma manual: `balance - totalCcDebt`

### Pontos de atenção
- A condição `isCcExpense` deve ser mantida consistente em **todos** os pontos de cálculo de saldo
- Qualquer dev novo precisa entender essa distinção antes de mexer em cálculos de saldo

---

## Implementação

Ver [[credit-card-liability-model]] para todos os pontos de implementação no código.

```js
// Discriminador — NÃO alterar sem revisar todos os pontos de uso
const isCcExpense = t =>
  t.value < 0 &&
  (t.payment === 'cartao_credito' || (t.cardId && !t.accountId));
```

---

## Alternativas Consideradas e Rejeitadas

**Opção A (débito imediato)**: Rejeitada porque não reflete a realidade financeira e confunde o usuário sobre seu saldo disponível real.

**Modelo híbrido (deduz CC mas mostra "saldo com crédito disponível")**: Considerado mas rejeitado por adicionar complexidade de UI sem benefício claro sobre o modelo atual.
