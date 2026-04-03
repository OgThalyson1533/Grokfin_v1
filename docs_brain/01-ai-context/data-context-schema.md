# Data Context Schema — Shape do State para a IA

> Descreve os campos do `state` que são injetados como contexto nas chamadas à IA.  
> Fonte: `js/state.js` → `buildSeedState()` e `loadState()`.

#ai-context #supabase

---

## State Completo (shape canônico)

```ts
interface AppState {
  isNewUser: boolean;
  balance: number;           // Saldo real (já EXCLUINDO despesas CC pendentes)
  lastUpdated: string;       // ISO 8601

  exchange: {
    usd: number;             // Cotação USD → BRL
    eur: number;             // Cotação EUR → BRL
    btc: number;             // Cotação BTC → BRL
    trend: { usd: number; eur: number; btc: number }; // Variação %
  };

  profile: {
    nickname: string;        // Ex: "Navigator"
    displayName: string;     // Nome completo
    handle: string;          // Ex: "@grokfin.user"
    bio: string;
    avatarImage: string;     // dataURL ou URL remota
    bannerImage: string;
    avatarImageUrl: string;  // URL Supabase Storage (preferencial)
    bannerImageUrl: string;
  };

  transactions: Transaction[];
  goals: Goal[];
  cards: Card[];
  accounts: Account[];
  investments: Investment[];
  fixedExpenses: FixedExpense[];
  budgets: Record<string, number>;   // { "Alimentação": 800, ... }
  customCategories: string[];
  chatHistory: ChatMessage[];

  ui: {
    activeTab: number;       // 0-10
    txSearch: string;
    txCategory: string;
    txSort: string;
    txDateStart: string | null;
    txDateEnd: string | null;
    txPage: number;
    txPageSize: number;
    homeFilter: 'this_month' | 'last_month' | '3_months' | '6_months' | 'this_year';
  };
}
```

---

## Tipos Internos

```ts
interface Transaction {
  id: string;             // UUID (sanitizado por cleanUUID)
  date: string;           // "DD/MM/YYYY" — formato BR, NÃO ISO
  desc: string;
  cat: string;            // Categoria
  value: number;          // Positivo = receita, Negativo = despesa
  payment: string;        // 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'conta' | 'boleto'
  cardId: string | null;
  accountId: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  status: 'pendente' | 'efetivado';
  recurringTemplate: boolean;
  installments: number;
  installmentCurrent: number;
}

interface Card {
  id: string;
  name: string;
  flag: string;           // 'Visa' | 'Mastercard' | etc.
  cardType: string;       // 'credito' | 'debito'
  color: string;
  limit: number;
  used: number;           // Soma das faturas pendentes
  closing: number | null; // Dia de fechamento
  due: number | null;     // Dia de vencimento
  invoices: Invoice[];
}

interface Goal {
  id: string;
  nome: string;
  atual: number;
  total: number;
  theme: string;
  img: string | null;
  deadline: string | null;
}

interface Account {
  id: string;
  name: string;
  accountType: string;   // 'Conta Corrente' | 'Poupança' | etc.
  initialBalance: number;
}

interface Investment {
  id: string;
  name: string;
  type: string;
  subtype: string;
  value: number;         // Valor atual
  cost: number;          // Custo de aquisição (cost basis)
}

interface FixedExpense {
  id: string;
  name: string;
  cat: string;
  value: number;         // Sempre positivo — isIncome define se é entrada ou saída
  day: number;           // Dia do mês de execução
  isIncome: boolean;
  active: boolean;
}
```

---

## ⚠️ Pegadinhas Importantes para a IA

1. **Datas são DD/MM/YYYY** — nunca ISO no frontend. Converter antes de comparar.
2. **`value` é sempre o sinal do lançamento**: negativo = despesa, positivo = receita.
3. **`balance` já exclui CC pendente** — não somar transações CC manualmente sobre ele.
4. **`used` em Card** é calculado localmente das faturas — pode divergir do Supabase antes do sync.
5. **`customCategories`** são strings simples, sem ID.

---

## Storage Key no localStorage

```
grokfin_hybrid_pwa_state
```

O chatHistory é truncado para as últimas **40 mensagens** antes de salvar (para não estourar localStorage).
