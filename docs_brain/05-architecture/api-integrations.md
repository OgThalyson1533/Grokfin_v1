---
tipo: arquitetura
tags: [api, integração, supabase, ai, exchange]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🌐 API Integrations — Integrações Externas

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[05-architecture/state-management|State Management]] | Próximo: [[05-architecture/analytics-engine|Analytics Engine →]]
> **Relacionados:** [[03-database/schema-reference]] · [[06-decisions/adrs#ADR-004]] · [[07-bugs-fixes/known-issues#DT-03]]

---

## 1. Supabase (Backend Principal)

### Configuração
```javascript
// js/services/supabase.js
const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || '[hardcoded]';
const SUPABASE_KEY = localStorage.getItem('SUPABASE_KEY') || '[hardcoded]';

export const supabaseClient = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;  // modo offline
```

Débito de segurança: [[07-bugs-fixes/known-issues#DT-03]]
Decisão de arquitetura: [[06-decisions/adrs#ADR-004]]
Schema completo: [[03-database/schema-reference]]

### Endpoints Usados

| Operação | API Call |
|---|---|
| Auth: login | `supabase.auth.signInWithPassword()` |
| Auth: cadastro | `supabase.auth.signUp()` |
| Auth: sessão | `supabase.auth.getSession()` |
| Auth: logout | `supabase.auth.signOut()` |
| Read tabela | `supabase.from('table').select('*').eq('user_id', uid)` |
| Upsert | `supabase.from('table').upsert(data, { onConflict: 'id' })` |
| Delete específico | `supabase.from('table').delete().eq('id', id)` |
| Delete não-listados | `supabase.from('table').delete().eq('user_id', uid).not('id', 'in', ids)` |

### Padrão de Upsert
```javascript
const { error } = await supabaseClient
  .from('transactions')
  .upsert(
    state.transactions.map(tx => ({
      id: tx.id,
      user_id: userId,
      description: tx.desc,   // camelCase → snake_case
      value: tx.value,
      // ... outros campos
    })),
    { onConflict: 'id' }
  );
if (error) console.error('[Sync] transactions:', error);
```

Mapeamento completo: [[03-database/schema-reference#transactions]]

### RLS (Row Level Security)
Toda query é automaticamente filtrada por `user_id = auth.uid()`.
Sem acesso cross-user via anon key.
Detalhes: [[03-database/schema-reference#Políticas RLS]]

---

## 2. AwesomeAPI (Câmbio)

### Endpoint
```
GET https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL
```

### Resposta Esperada
```json
{
  "USDBRL": { "ask": "5.92", "pctChange": "0.15" },
  "EURBRL": { "ask": "6.41", "pctChange": "-0.08" },
  "BTCBRL": { "ask": "305000.00", "pctChange": "1.2" }
}
```

### Mapeamento para State
```javascript
state.exchange = {
  usd: parseFloat(data.USDBRL.ask),
  eur: parseFloat(data.EURBRL.ask),
  btc: parseFloat(data.BTCBRL.ask),
  trend: { usd: parseFloat(data.USDBRL.pctChange), ... },
  lastSync: new Date().toISOString()
};
```

### Cache Strategy
- Cache de **4 horas** via `state.exchange.lastSync`
- Fallback: `{ usd: 5.90, eur: 6.40, btc: 300000 }` se API falhar
- Módulo: `js/services/exchange.js`

Fluxo: [[02-business-rules/functional-flows#Fluxo 8]]
Regras: [[02-business-rules/domain-rules#Câmbio]]

---

## 3. AI Proxy (`/api/ai-proxy`)

### Propósito
Proxy (Edge Function Supabase ou servidor) que recebe requisições do cliente e faz forward para Google Gemini ou Anthropic Claude. **Evita expor API keys no frontend.**

### Request Format (cliente → proxy)
```javascript
fetch('/api/ai-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'gemini' | 'claude',
    apiKey: userApiKey,    // key DO usuário (não servidor)
    mode: 'text' | 'image',
    payload: { /* payload específico da API */ }
  })
})
```

### Payload Gemini (Texto)
```javascript
{
  provider: 'gemini', apiKey: 'AIza...',
  mode: 'text',
  payload: {
    contents: [{ parts: [{ text: contextPrompt + userMessage }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
  }
}
```

### Payload Claude (Texto)
```javascript
{
  provider: 'claude', apiKey: 'sk-ant-...',
  mode: 'text',
  payload: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [/* histórico + pergunta */]
  }
}
```

### Timeout
- 20 segundos via `AbortController`
- Retorna: `'Timeout — verifique sua conexão.'`

Fluxo do chat: [[02-business-rules/functional-flows#Fluxo 5]]
Módulo: [[05-architecture/module-map#chat-ui.js]]
Regras: [[02-business-rules/domain-rules#Assistente AI]]

---

## 4. Supabase Storage

### Bucket: `receipts`
- Upload de comprovantes de transação
- Referenciado em `tx.receipt` (URL)
- Status: **parcialmente implementado** (campo existe no schema, upload não totalmente integrado)

---

## Diagrama de Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                     │
│                                                           │
│  [app.html] ←─ state.js (RAM) ────────► localStorage    │
│       │              │                                    │
│       │         saveState() / syncToSupabase()            │
│       │              │                                    │
└───────┼──────────────┼───────────────────────────────────┘
        │              │
        │              ▼
        │    ┌─────────────────────┐
        │    │   Supabase          │
        │    │   PostgreSQL + Auth │
        │    │   RLS por user_id   │
        │    └─────────────────────┘
        │
        │    ┌─────────────────────┐
        ├───►│   AwesomeAPI        │ ← câmbio USD/EUR/BTC (cache 4h)
        │    └─────────────────────┘
        │
        │    ┌─────────────────────┐
        └───►│   /api/ai-proxy     │ ──► Google Gemini
             │   (Edge Function)   │ ──► Anthropic Claude
             └─────────────────────┘
```

---

## Tratamento de Erros

### Política de Sync
- `Promise.allSettled()` garante que falha em 1 entidade não bloqueia outras
- Erros: `console.error('[Sync] entidade:', error)` — sem retry automático imediato
- Retry: `withRetry(fn, maxAttempts=3)` com backoff exponencial (500ms, 1s, 2s)

### Modo Offline
- `supabaseClient === null` → todas as operações de sync são no-op silenciosas
- App funciona completamente no localStorage
- Risco de perda de dados: [[07-bugs-fixes/known-issues#RISCO-01]]

---

## Variáveis de Ambiente Necessárias

| Variável | Onde Configurar | Exemplo |
|---|---|---|
| `SUPABASE_URL` | `localStorage['SUPABASE_URL']` | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | `localStorage['SUPABASE_KEY']` | `eyJhbGci...` (anon key) |
| `GEMINI_KEY` | `state.profile.geminiKey` (UI → tab-9) | `AIzaSy...` |
| `CLAUDE_KEY` | `state.profile.claudeKey` (UI → tab-9) | `sk-ant-...` |

Débito de segurança: [[07-bugs-fixes/known-issues#DT-03]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[05-architecture/analytics-engine|Analytics Engine →]]
