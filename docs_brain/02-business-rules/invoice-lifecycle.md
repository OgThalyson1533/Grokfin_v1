# Ciclo de Vida da Fatura (faturas_ciclo)

> Documenta os três estados de uma fatura e as funções SQL que executam cada transição.

#regra-negocio #supabase

---

## Estados Possíveis

```
aberta ──► fechada ──► paga
```

| Status | Significado |
|---|---|
| `aberta` | Fatura em aberto, acumulando itens de crédito |
| `fechada` | Passou da data de fechamento; débito gerado na conta mas ainda não pago |
| `paga` | Fatura liquidada; limite do cartão restaurado; débito na conta efetivado |

---

## Tabela `faturas_ciclo`

Campos-chave:

| Campo | Tipo | Descrição |
|---|---|---|
| `card_id` | UUID FK | Cartão ao qual a fatura pertence |
| `reference_month` | INTEGER | Mês de referência (1-12) |
| `reference_year` | INTEGER | Ano de referência |
| `closing_date` | DATE | Data de fechamento da fatura |
| `due_date` | DATE | Data de vencimento |
| `status` | TEXT | `'aberta'` \| `'fechada'` \| `'paga'` |
| `total_amount` | NUMERIC | Valor total da fatura |
| `debit_transaction_id` | UUID FK | Transação gerada na conta corrente ao fechar |

Constraint de unicidade: `UNIQUE(card_id, reference_month, reference_year)`

---

## Transição 1: aberta → fechada

**Gatilho**: função `fechar_faturas_e_cobrar()` via pg_cron  
**Condição**: `CURRENT_DATE = (due_date - INTERVAL '2 days')` (2 dias antes do vencimento)

```sql
-- O que acontece:
-- 1. Gera transação de débito na conta corrente do usuário
INSERT INTO transactions (user_id, date, description, category, amount, payment, account_id, status)
VALUES (
  fatura.user_id,
  fatura.due_date,
  'Fatura Cartão ' || card_name,
  'Pagamento de Cartão',
  -(fatura.total_amount),    -- valor negativo = saída
  'fatura',
  fatura.default_account_id,
  'pendente'                 -- ainda não debitou do saldo real
) RETURNING id INTO nova_transacao_id;

-- 2. Atualiza fatura: vincula à transação gerada
UPDATE faturas_ciclo
SET status = 'fechada', debit_transaction_id = nova_transacao_id
WHERE id = fatura.id;
```

---

## Transição 2: fechada → paga

**Gatilho**: UI → usuário clica em "Pagar Fatura" → chama RPC `liquidar_fatura(p_invoice_id, p_acc_id)`

```sql
CREATE OR REPLACE FUNCTION liquidar_fatura(p_invoice_id UUID, p_acc_id UUID)
RETURNS boolean AS $$
BEGIN
  -- Passo 1: Efetiva o débito na conta corrente (reduz state.balance)
  UPDATE transactions
  SET status = 'efetivado', account_id = COALESCE(p_acc_id, account_id)
  WHERE id = (SELECT debit_transaction_id FROM faturas_ciclo WHERE id = p_invoice_id);

  -- Passo 2: Efetiva as compras de crédito vinculadas (restaura limite do cartão)
  UPDATE transactions
  SET status = 'efetivado'
  WHERE invoice_id = p_invoice_id AND payment = 'credito';

  -- Passo 3: Fecha a fatura
  UPDATE faturas_ciclo SET status = 'paga' WHERE id = p_invoice_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### ⚠️ Ordem dos passos importa

Os 3 UPDATEs **devem** acontecer nesta sequência:
1. Primeiro efetiva o débito (para que o saldo bancário reflita a saída)
2. Depois efetiva as compras CC (para restaurar o limite do cartão na view)
3. Por último muda o status da fatura (confirma a operação como um todo)

Inverter ou pular qualquer passo deixa o sistema em estado inconsistente.

---

## Limite Disponível em Tempo Real

View `card_status_view` calcula o limite disponível excluindo apenas transações `status = 'pendente'`:

```sql
(c.card_limit - COALESCE(SUM(t.amount), 0)) AS limite_disponivel
-- Filtro: t.payment = 'credito' AND t.status = 'pendente'
```

Quando `liquidar_fatura()` efetiva as compras (passo 2), elas saem do filtro `pendente` e o limite é automaticamente restaurado na view.

---

## Relacionamentos

- [[credit-card-liability-model]] — por que o saldo não muda na compra
- [[schema-overview]] — estrutura completa das tabelas
- [[functions-rpcs]] — detalhes das funções SQL
