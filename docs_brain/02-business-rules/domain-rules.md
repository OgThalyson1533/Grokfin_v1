---
tipo: regras-de-negocio
tags: [domínio, regras, invariantes]
backlinks: [[MOC — GrokFin Elite v6]]
---

# ⚖️ Domain Rules — Regras de Negócio

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[02-business-rules/functional-flows|Functional Flows →]]
> **Relacionados:** [[03-database/schema-reference]] · [[05-architecture/state-management]] · [[05-architecture/analytics-engine]]

---

## 1. Transações

### 1.1 Tipos e Polaridade
- **Entradas** → `value > 0` (salário, receitas, reembolsos)
- **Saídas** → `value < 0` (despesas, pagamentos, transferências)
- O sinal do `value` é a **fonte de verdade** para o tipo

Schema da tabela: [[03-database/schema-reference#transactions]]

### 1.2 Origem
Uma transação pode ser vinculada a:
- **Conta bancária** (`accountId` preenchido): afeta o saldo calculado da conta — [[03-database/schema-reference#accounts]]
- **Cartão de crédito** (`cardId` preenchido): afeta `card.used`, NÃO o saldo → ver [[#Cartões de Crédito]]
- **Nenhuma** (`accountId = null`, `cardId = null`): afeta `state.balance` (conta principal implícita)

### 1.3 Parcelamento
- Disponível apenas para **cartões em saídas**
- Uma compra de N parcelas gera N transações com `installments=N` e `installmentNumber=1..N`
- Parcelamento e Recorrência são **mutuamente exclusivos** no UI
- UI: [[04-design-system/ux-patterns#Modal de Transação — Liquid Glass Design]]

### 1.4 Status
- `concluido` → transação confirmada/paga
- `pendente` → agendada ou não realizada
- Transações pendentes de cartão **não são incluídas** no saldo disponível

### 1.5 Invariantes
- `id` deve ser único globalmente (`uid('tx')` de `utils/math.js`)
- `date` sempre `'dd/mm/yyyy'` (string BR) — usar `parseDateBR()` para cálculos
- `cat` deve ser string não vazia
- `value` deve ser número finito

---

## 2. Cartões de Crédito

### 2.1 Modelo de Passivo
> ⚠️ Regra crítica — cartões são **passivos**, não contas.

- Gasto no cartão → `card.used += |value|` + transação com `cardId`
- O saldo em conta **NÃO diminui** ao gastar no cartão
- Somente ao **pagar a fatura** o dinheiro sai da conta

Schema: [[03-database/schema-reference#cards]] · [[03-database/schema-reference#invoices]]
Decisão: [[06-decisions/adrs#ADR-007]]

### 2.2 Ciclo da Fatura
```
Transações com cardId
  → acumuladas em invoice (mês 'YYYY-MM')
    → no dia de fechamento: fatura "fecha" (status = 'fechada')
      → no dia de vencimento: pagamento esperado
        → ao pagar: status = 'paga' + transação de saída na conta bancária
```

### 2.3 Limite Disponível
```javascript
available = card.limit - card.used;
```

---

## 3. Contas Bancárias

### 3.1 Saldo Calculado (NUNCA armazenar)
```javascript
realBalance = account.initialBalance + 
  state.transactions
    .filter(t => t.accountId === account.id)
    .reduce((sum, t) => sum + t.value, 0);
```

Schema: [[03-database/schema-reference#accounts]]

### 3.2 Tipos de Conta
- `corrente` — conta corrente bancária
- `poupanca` — conta poupança
- `digital` — carteira digital (Nubank, PicPay, Mercado Pago)

---

## 4. Metas Financeiras

### 4.1 Progresso
```javascript
progress = (goal.atual / goal.total) * 100;
remaining = goal.total - goal.atual;
```

### 4.2 Aporte Mensal Necessário
```javascript
monthsLeft = Math.max(1, daysBetween(today, deadline) / 30);
monthlyNeed = remaining / monthsLeft;
```

### 4.3 Urgência
Meta mais urgente = menor `monthsLeft` com maior `remaining` relativo.
Calculada em: [[05-architecture/analytics-engine#Meta Urgente]]

### 4.4 Conclusão
Meta concluída quando `atual >= total`.

Schema: [[03-database/schema-reference#goals]]

---

## 5. Orçamentos

### 5.1 Modelo
```javascript
state.budgets = { [categoria]: limiteMensal }  // valores em R$
```

### 5.2 Utilização e Alertas
```javascript
ratio = |used| / limit;
// ratio > 0.8 = alerta amarelo
// ratio > 1.0 = alerta vermelho (overspend)
```

Cálculo em: [[05-architecture/analytics-engine#Budget Use]]
Schema: [[03-database/schema-reference#budgets]]

---

## 6. Recorrências (Despesas/Receitas Fixas)

### 6.1 Processamento
- `app.js` executa `processRecurrences()` na inicialização
- Verifica se já foi lançada no mês via `recurringId`
- **Idempotente:** nunca lança em duplicata

### 6.2 Invariantes
- `active = true` → processada mensalmente
- `value > 0` → receita | `value < 0` → despesa
- `day` → dia do mês para lançar

Fluxo completo: [[02-business-rules/functional-flows#Fluxo 7]]
Schema: [[03-database/schema-reference#fixed_expenses]]

---

## 7. Health Score (0–100)

### 7.1 Composição

| Eixo | Peso máx | Critério |
|---|---|---|
| Taxa de poupança | 35 | ≥ 30% → 35pts; linear até 0% |
| Runway | 25 | ≥ 6 meses → 25pts; linear até 0 |
| Metas ativas | 20 | ≥ 2 metas com progresso → 20pts |
| Orçamento | 20 | Sem estouros → 20pts; −5 por estourado |

### 7.2 Classificação
| Score | Status |
|---|---|
| 82–100 | 🏆 Excelente |
| 68–81 | ✅ Bom |
| 50–67 | ⚠️ Atenção |
| 0–49 | 🔴 Crítico |

Cálculo detalhado: [[05-architecture/analytics-engine#Health Score]]

---

## 8. Assistente AI (Chat)

### 8.1 Camadas de Processamento
1. **NLP Transacional** — registra transações por linguagem natural (zero custo)
2. **Motor regex local** — 16 casos de uso financeiros (zero custo)
3. **API externa** — Gemini ou Claude (requer chave do usuário)

Decisão: [[06-decisions/adrs#ADR-008]]
Módulo: [[05-architecture/module-map#chat-ui.js]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 5]]

### 8.2 Rate Limit
- Máximo 10 mensagens por minuto (sliding window 60s)
- Protege custo de API

---

## 9. Câmbio (Mercado)

- Fonte: AwesomeAPI → [[05-architecture/api-integrations#AwesomeAPI]]
- Cache 4h em `state.exchange.lastSync`
- Fallback: USD 5.90, EUR 6.40, BTC 300.000
- Módulo: `market-ui.js`

---

## 10. Segurança e Isolamento de Dados

- **RLS:** todas as tabelas filtram por `user_id = auth.uid()` → [[03-database/schema-reference#Políticas RLS]]
- **API Keys AI:** armazenadas em `state.profile` e enviadas via proxy → [[05-architecture/api-integrations#AI Proxy]]
- **Supabase anon key:** segura no frontend pois RLS bloqueia acesso cross-user → [[06-decisions/adrs#ADR-004]]

---

## 11. Dados de Demonstração (New User)

- `isNewUser: true` + transação de demonstração `desc: 'Pendência'`
- Orçamentos pré-configurados
- `buildSeedState()` em `state.js`
- Débitos: [[07-bugs-fixes/known-issues#DT-01]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[02-business-rules/functional-flows|Functional Flows →]]
