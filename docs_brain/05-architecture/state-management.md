# State Management — Gerenciamento de Estado

> Como o state único funciona, como é carregado, salvo e migrado.  
> Fonte: `js/state.js`

#arquitetura

---

## Princípio Fundamental

> O `state` exportado de `state.js` é a **única fonte de verdade** da aplicação inteira.

Todos os módulos de UI lêem e mutam diretamente este objeto. Não há Vuex, Redux ou Context — é um objeto JS simples compartilhado via módulo ES.

```js
// state.js
export const state = {};  // Mutado in-place por toda a app
```

---

## Inicialização (Boot)

```
1. buildSeedState()         → estado padrão (zerado, com dados demo)
2. loadState()              → merge com localStorage (ou legado)
3. Object.assign(state, …)  → popula o state exportado
4. syncFromSupabase(state)  → sobrescreve com dados da nuvem (se autenticado)
5. saveState()              → persiste o estado final
6. renderAll()              → render inicial
```

---

## `buildSeedState()`

Gera o estado inicial para novos usuários:

```js
{
  isNewUser: true,
  balance: 1550,                // Saldo demo
  exchange: { usd: 5.92, eur: 6.45, btc: 312450, trend: {...} },
  cards: [],
  accounts: [],
  investments: [],
  fixedExpenses: [],
  budgets: {
    'Moradia': 0, 'Alimentação': 0, 'Transporte': 0,
    'Lazer': 0, 'Investimentos': 0, 'Assinaturas': 0,
    'Saúde': 0, 'Metas': 0
  },
  goals: [],
  customCategories: [],
  transactions: [/* 4 transações demo */],
  profile: {
    bannerImage: createDefaultBannerDataUrl(),  // SVG gerado inline
    avatarImage: createDefaultAvatarDataUrl(),  // SVG com iniciais
    nickname: 'Navigator',
    displayName: 'GrokFin User',
    handle: '@grokfin.user'
  },
  ui: { activeTab: 0, txSearch: '', txPage: 0, txPageSize: 10, homeFilter: 'this_month', ... },
  chatHistory: [],
  lastUpdated: new Date().toISOString()
}
```

---

## `loadState()` — Merge com localStorage

```js
// Chaves de localStorage consultadas:
const STORAGE_KEY        = 'grokfin_hybrid_pwa_state'; // atual
const LEGACY_STORAGE_KEY = 'grokfin_elite_v4_state';   // migração legado
```

Estratégia de merge:
- Arrays: usa o salvo se não-vazio, senão seed
- Objetos (exchange, ui, budgets, profile): spread seed + spread salvo
- `isNewUser`: preserva o salvo se existir
- `activeTab`: mapeado via `mapCurrentActiveTab()` ou `mapLegacyActiveTab()`

---

## `saveState()` — Persistência

```js
export function saveState() {
  // 1. Recalcula state.balance (exclui CC pendente)
  // 2. Salva em localStorage (trunca chatHistory para 40 mensagens)
  // 3. Dispara sync para Supabase com debounce de 2500ms
  //    (apenas se !state.isNewUser)
}
```

**Fallback de localStorage cheio**: salva versão slim sem `chatHistory`, `bannerImage` e `avatarImage`.

---

## `cleanUUID()` — Sanitização de IDs

IDs criados localmente no formato legado (`tx-abc123`, `goal-xyz`) são convertidos para UUID válido antes de qualquer upsert no Supabase:

```js
export function cleanUUID(idStr) {
  // Caso 1: já é UUID válido (36 chars, 5 segmentos) → retorna como está
  // Caso 2: tem prefixo conhecido → remove prefixo → re-testa
  // Caso 3: ainda inválido → gera hash determinístico:
  //   `00000000-0000-4000-8000-${hex12}`
  //   (UUID v4 fake, mas estável para o mesmo input)
}
```

Prefixos reconhecidos: `tx-`, `goal-`, `card-`, `inv-`, `fx-`, `ctx-`, `msg-`

---

## Migração de Tabs (legado)

```js
// Legado v4 tinha 5 tabs com índices diferentes
function mapLegacyActiveTab(index) {
  const mapping = { 0: 0, 1: 2, 2: 4, 3: 3, 4: 1 };
  return mapping[index] ?? Math.min(Math.max(index, 0), 9);
}

// Versão atual: mapeamento 1:1 até índice 9
function mapCurrentActiveTab(index) {
  return mapping[index] ?? Math.min(Math.max(index, 0), 9);
}
```

---

## isNewUser — Lógica de Onboarding

```js
// Marca como não-novo quando o usuário cria conteúdo real
if (state.isNewUser && (state.goals.length > 0 || state.transactions.length > 0)) {
  state.isNewUser = false;
}

// Do Supabase:
state.isNewUser = !isOnboardingCompleted && !txs?.length && !goals?.length;
```

O flag `isNewUser` também bloqueia o sync automático para o Supabase, evitando poluir o banco com dados demo.

---

## Avatar e Banner Padrão

Gerados como SVG inline (não dependem de assets externos):

- **Banner**: gradiente `#09111c → #0a1322 → #071019` com glows ciano/violeta/verde + logo "G"
- **Avatar**: fundo escuro `#08111C` + círculo gradiente ciano/verde + iniciais do nome

Quando o usuário faz upload via Supabase Storage, `avatarImageUrl` e `bannerImageUrl` substituem as versões SVG.
