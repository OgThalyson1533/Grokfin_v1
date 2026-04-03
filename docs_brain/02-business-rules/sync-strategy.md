# Estratégia de Sync — Supabase

> Como o GroKFin sincroniza dados locais (localStorage) com o Supabase.  
> Fonte: `js/services/sync.js`

#regra-negocio #supabase

---

## Visão Geral

O sync é **bidirecional** com prioridade para o remoto:

```
Boot: Supabase → localStorage → state  (pull remoto sobrescreve local)
Uso:  state → localStorage → Supabase  (push com debounce de 2.5s)
```

---

## Pull (syncFromSupabase)

Todas as tabelas são buscadas **em paralelo** com `Promise.all`:

```js
const [profile, txs, goals, fixed, buds, cards, invoices, invs, customCats, accountsData]
  = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
    supabase.from('goals').select('*').eq('user_id', uid),
    // ... (8 queries em paralelo)
  ]);
```

Antes do v5, essas queries eram **8 awaits sequenciais** (~6x mais lento).

---

## Push (syncToSupabase)

### Diff-based: só sincroniza o que mudou

```js
function quickHash(obj) {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return s.length + '|' + h;
}

const _lastSyncHash = {};
function hasChanged(key, data) {
  const h = quickHash(data);
  if (_lastSyncHash[key] === h) return false;
  _lastSyncHash[key] = h;
  return true;
}
```

Se o hash não mudou desde o último sync, **a entidade é pulada completamente**.

### Paralelismo com isolamento de falhas

```js
const results = await Promise.allSettled(tasks);
// Promise.allSettled (não Promise.all):
// → Uma entidade falhando não cancela as demais
```

### Retry com exponential backoff

```js
async function upsertWithRetry(table, rows, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    // delays: 0ms / 500ms / 1000ms
    const { error } = await supabase.from(table).upsert(rows);
    if (!error) return { ok: true };
    if (error.code?.startsWith('4')) return { ok: false, error }; // erro permanente, não retenta
  }
}
```

Erros com código 4xx (cliente) não são retentados — são permanentes.

---

## ⚠️ Exceção: Goals usa delete-then-insert

Todas as entidades usam **upsert**. Goals são a **única exceção**:

```js
// Goals: delete remoto → insert local
// Motivo: upsert puro nunca remove — metas deletadas localmente
//         ficavam "fantasmas" no Supabase para sempre.
await supabase.from('goals').delete().eq('user_id', uid);
await upsertWithRetry('goals', goalRows);
```

**Risco**: se o delete passar mas o insert falhar, o usuário perde as metas remotas.  
Mitigação atual: `try/catch` com log de erro crítico.

---

## Validação de FK antes do upsert (transactions)

```js
const validAccountIds = new Set((state.accounts || []).map(a => cleanUUID(a.id)));
const validCardIds    = new Set((state.cards    || []).map(c => cleanUUID(c.id)));

// Só envia account_id se for uma conta real cadastrada
const safeAccountId = (rawAccountId && validAccountIds.has(rawAccountId)) ? rawAccountId : null;
const safeCardId    = (rawCardId    && validCardIds.has(rawCardId))       ? rawCardId    : null;
```

Sem isso, transações com `accountId` legado causavam FK violation e quebravam o sync inteiro.

---

## Debounce do push automático

```js
// Em saveState() — disparado após qualquer mutação
clearTimeout(_syncTimeout);
_syncTimeout = setTimeout(() => {
  syncToSupabase(state).catch(e => console.error('[Sync] Falha auto-sync:', e));
}, 2500); // 2.5 segundos de debounce
```

O push só ocorre para usuários não-novos (`!state.isNewUser`).

---

## Ordem de sincronização (cards + faturas)

Cards e suas faturas têm dependência de FK — cartão deve existir antes das faturas:

```js
tasks.push(
  upsertWithRetry('cards', cardRows).then(r => {
    if (r.ok && invoiceRows.length) return upsertWithRetry('card_invoices', invoiceRows);
  })
);
// Esse bloco como um todo corre em paralelo com os outros (accounts, transactions, etc.)
```

---

## cleanUUID — Sanitização de IDs

Ver [[state-management]] para detalhes completos.

IDs legados com prefixos (`tx-abc123`, `goal-xyz`) são convertidos para UUID válido:

```js
export function cleanUUID(idStr) {
  // Remove prefixos conhecidos: tx-, goal-, card-, inv-, fx-, ctx-, msg-
  // Se ainda não for UUID válido, gera hash determinístico:
  //   `00000000-0000-4000-8000-${hex12digits}`
}
```
