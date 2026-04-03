# AI Providers — GroKFin Chat

> Documentação dos provedores de IA integrados ao chat financeiro.  
> Fonte: `js/ui/chat-ui.js` → função `getAIProvider(apiKey)`.

#ai-context

---

## Lógica de Seleção de Provider

```js
// Fonte: chat-ui.js → getAIProvider()
// Prioridade: Claude > Gemini > modo básico

function getAIProvider(apiKey) {
  if (apiKey?.startsWith('sk-ant-')) return 'claude';
  if (apiKey?.startsWith('AIza'))   return 'gemini';
  return 'basic';
}
```

A chave é lida de: `localStorage.getItem('grokfin_anthropic_key')`

---

## Claude (Anthropic)

- **Modelo**: `claude-sonnet-4-20250514` (ou similar)
- **Indicador de UI**: badge roxo `✦ Claude ativo` no header do chat
- **Label no header**: `Claude conectado`
- **Subtítulo**: `IA Claude ativa · Lê saldo, metas, categorias, câmbio e comprovantes`
- **Capacidades extras**: leitura de comprovantes (imagem/PDF via vision)

## Gemini (Google)

- **Modelo**: `gemini-pro`
- **Indicador de UI**: badge ciano/verde `✦ Gemini ativo`
- **Label no header**: `Gemini conectado`
- **Subtítulo**: `IA Gemini ativa · Lê saldo, metas, categorias, câmbio e comprovantes`

## Modo Básico (sem chave)

- Sem chamada à API externa
- Indicador oculto (`display: none`)
- **Label no header**: `Modo básico`
- Responde apenas com lógica local pré-programada (sem LLM)

---

## Indicador Visual no Header do Chat

Elementos de DOM afetados:
- `#ai-active-indicator` — badge colorido no header
- `#ai-mode-label` — texto do modo atual
- `#ai-chat-subtitle` — subtítulo descritivo

Esses elementos são atualizados na inicialização em `app.js` → função `updateAIIndicator()`.

---

## Notas de Segurança

- A chave de API **nunca é enviada ao backend** — chamadas feitas direto do browser (client-side)
- Para produção com usuários reais, considerar proxy server para não expor a chave
- A chave fica em `localStorage` sob `grokfin_anthropic_key`
