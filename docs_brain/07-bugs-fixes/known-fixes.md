# Known Fixes — Registro de Bugs Corrigidos

> Todos os comentários `[FIX]` encontrados no código-fonte, centralizados aqui.  
> Atualizar sempre que um novo fix for aplicado.

#bug

---

## SQL / Supabase

### FIX SQL #1 — INSERT policy ausente em `profiles`
**Arquivo**: `supabase/schema.sql`  
**Sintoma**: novos usuários não conseguiam criar perfil. O upsert inicial falhava silenciosamente com RLS ativo.  
**Causa**: apenas policies de SELECT e UPDATE existiam. INSERT estava bloqueado.  
**Fix**:
```sql
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

---

### FIX SQL #2 — `updated_at` e trigger ausentes em `card_invoices`
**Arquivo**: `supabase/schema.sql`  
**Sintoma**: atualizações de faturas não podiam ser rastreadas. Upsert multi-device não detectava conflitos de tempo.  
**Fix**:
```sql
ALTER TABLE public.card_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE TRIGGER update_card_invoices_modtime
  BEFORE UPDATE ON public.card_invoices FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### FIX SQL #3 — Campos ausentes em `transactions`
**Arquivo**: `supabase/schema.sql`  
**Campos adicionados**: `payment`, `card_id`, `recurring_template`, `installments`, `installment_current`

---

### FIX SQL #4 — `onboarding_completed` ausente em `profiles`
**Arquivo**: `supabase/schema.sql`  
**Fix**: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;`

---

## Transações

### FIX TX #1 — Campo `notes` (observações livres)
**Arquivo**: `supabase/schema.sql`, `js/services/sync.js`  
**Adicionado**: campo `notes TEXT` em transactions para observações livres do usuário.

### FIX TX #2 — Campo `attachment_url` (comprovante)
**Arquivo**: `supabase/schema.sql`, `js/services/sync.js`  
**Adicionado**: campo `attachment_url TEXT` para URL do comprovante no Supabase Storage.

---

## JavaScript / Frontend

### FIX #1 — `saveState()` não persistia nada
**Arquivo**: `js/state.js`  
**Sintoma**: alterações no state nunca eram salvas no localStorage.  
**Causa**: `saveState()` era chamado sem argumento por toda a app, mas a função esperava `state` como parâmetro — chegava como `undefined`.  
**Fix**: removido o parâmetro. A função agora usa diretamente o `state` exportado do módulo.

---

### FIX #2 — Tab Mercado nunca renderizava
**Arquivo**: `js/app.js`  
**Sintoma**: a aba Mercado (índice 9) sempre ficava em branco.  
**Causa**: `renderMarketTab()` não estava no ciclo global `renderAll()`.  
**Fix**:
```js
if (state.ui.activeTab === 9) renderMarketTab(false);
```

---

### FIX #3 — `fetchExchangeRates()` nunca chamado
**Arquivo**: `js/app.js`  
**Sintoma**: cotações de câmbio sempre mostravam valores estáticos do seed (USD 5.92, EUR 6.45).  
**Causa**: a função existia mas nunca era invocada no boot.  
**Fix**: adicionada chamada em `initApp()` com `.then()` para atualizar o state em background sem bloquear o boot.

---

### FIX #4 — `ensureChatSeed()` nunca chamado
**Arquivo**: `js/app.js`  
**Sintoma**: chat abria completamente vazio para novos usuários (sem mensagem de boas-vindas).  
**Fix**: adicionada chamada a `ensureChatSeed()` após os binds de evento.

---

### FIX #5 — `mapCurrentActiveTab` limitava ao índice 5
**Arquivo**: `js/state.js`  
**Sintoma**: tabs 6, 7 e 8 (Cartões, Fluxo, Invest.) nunca eram restauradas após recarregar a página.  
**Causa**: o mapeamento só cobria índices 0-5.  
**Fix**: expandido para cobrir todos os 10 índices (0-9).

---

### FIX — Modelo de passivo CC no cálculo de saldo
**Arquivo**: `js/state.js`, `js/services/sync.js`  
**Contexto**: despesas de cartão de crédito não devem reduzir o saldo imediatamente.  
**Fix**: implementada a condição `isCcExpense` que exclui transações CC do cálculo de `state.balance`.  
Ver [[credit-card-liability-model]] e [[ADR-001-liability-model]].

---

### FIX — Calendário financeiro não atualizava
**Arquivo**: `js/app.js`  
**Sintoma**: calendário embutido no HTML não refletia mudanças após interações.  
**Fix**: adicionada chamada a `window.finCalRender()` no final de `renderAll()` (se a função existir).

---

### FIX — AI indicator estático no header do chat
**Arquivo**: `js/app.js`  
**Sintoma**: badges `#ai-active-indicator` e `#ai-mode-label` sempre mostravam "Modo básico" independentemente do provider configurado.  
**Fix**: adicionada função `updateAIIndicator()` chamada na inicialização para refletir o provider real.

---

### FIX — Validação de FK em transactions antes do upsert
**Arquivo**: `js/services/sync.js`  
**Sintoma**: transações com `accountId` ou `cardId` legados causavam FK violation no Supabase, quebrando o sync inteiro.  
**Fix**: validação dos IDs contra conjuntos de IDs reais cadastrados antes de montar o payload do upsert.
```js
const validAccountIds = new Set((state.accounts || []).map(a => cleanUUID(a.id)));
const safeAccountId = validAccountIds.has(rawAccountId) ? rawAccountId : null;
```

---

### FIX — Goals: upsert não removia metas deletadas
**Arquivo**: `js/services/sync.js`  
**Sintoma**: metas excluídas localmente reapareciam após sync com Supabase.  
**Causa**: o upsert só insere/atualiza, nunca remove registros.  
**Fix**: goals agora usam delete-then-insert. Ver [[sync-strategy]].

---

## Como registrar novos fixes

Ao corrigir um bug, adicionar aqui:
1. **Nome do fix** (com referência ao arquivo)
2. **Sintoma observado**
3. **Causa raiz**
4. **Fix aplicado** (código ou descrição)
5. Link para nota relacionada se aplicável
