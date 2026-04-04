---
tipo: bugs
tags: [bugs, débitos, riscos, issues]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🐛 Known Issues — Débitos Técnicos e Riscos

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[06-decisions/adrs|ADRs]] | Próximo: [[07-bugs-fixes/known-fixes|Known Fixes →]]
> **Relacionados:** [[05-architecture/module-map]] · [[04-design-system/ux-patterns]] · [[05-architecture/api-integrations]]

---

## Débitos Técnicos Ativos

### DT-01 — Modal Nova Transação (Liquid Glass incompleta) {#DT-01}

**Prioridade:** 🔴 Alta | **Status:** Em progresso

**Descrição:** A migração para o design Liquid Glass está em andamento. A estrutura e os dropdowns (`ModernFloxSelect`) estão implementados, mas a confirmação de exclusão de categoria ainda pode usar o `confirm()` nativo em vez de modal customizado.

**Impacto:** UX inconsistente — estética do modal não totalmente alinhada ao design system.

**Arquivos:**
- `js/ui/transactions-ui.js` (linhas ~46–51, `.delete-cat-btn` handler)
- `css/components.css` (`.tx-more-details-area`, `.tx-type-tabs`)
- `app.html` (HTML do modal)

**Design referência:** [[04-design-system/design-tokens#Modal de Transação]]
**UX referência:** [[04-design-system/ux-patterns#Modal de Transação]]

---

### DT-02 — Confirmação de Exclusão de Categoria sem Modal Premium {#DT-02}

**Prioridade:** 🟡 Média | **Status:** Pendente

**Descrição:** Exclusão de categorias customizadas usa `#delete-cat-confirm-modal` no código, mas o modal correspondente pode estar incompleto em `app.html`.

**Impacto:** Fallback para `confirm()` nativo — quebra a identidade visual premium.

**Fix sugerido:** Criar modal genérico de confirmação reutilizável com design Liquid Glass.

---

### DT-03 — Supabase Keys em localStorage (sem .env) {#DT-03}

**Prioridade:** 🔴 Alta (Segurança) | **Status:** Pendente

**Descrição:** As chaves de API do Supabase são lidas de `localStorage['SUPABASE_URL']` e `localStorage['SUPABASE_KEY']`. Sem variáveis de ambiente em build time.

**Mitigação ativa:** A `anon key` do Supabase só tem permissão via RLS — dados de outros usuários não são acessíveis. Ver [[03-database/schema-reference#Políticas RLS]].

**Impacto:** Requer configuração manual em cada novo dispositivo/browser.

**Arquivo:** `js/services/supabase.js`
**Decisão original:** [[06-decisions/adrs#ADR-004]]

---

### DT-04 — Ordenação por Status usa Heurística de Descrição {#DT-04}

**Prioridade:** 🟢 Baixa | **Status:** Pendente

**Descrição:** Em `getFilteredTransactions()`, a ordenação pelo campo "status" usa:
```javascript
// ATUAL (incorreto)
const sA = (a.desc === 'Pendência') ? 0 : 1;
// CORRETO
const sA = a.status === 'pendente' ? 0 : 1;
```

**Impacto:** Ordenação por status imprecisa para transações com outros nomes além de 'Pendência'.

**Arquivo:** `js/ui/transactions-ui.js` (função `getFilteredTransactions`)
**Decisão original:** [[06-decisions/adrs#ADR-009]] (date format como string cria complexidades similares)

---

### DT-05 — Motor de Analytics sem Cache Invalidation Granular {#DT-05}

**Prioridade:** 🟢 Baixa | **Status:** Pendente

**Descrição:** `calculateAnalytics()` invalida o cache na mudança de `state.transactions` OU `state.goals`. Mudanças em `profile`, `exchange` ou `ui` também disparam JSON.stringify desnecessário.

**Impacto:** Performance em dispositivos lentos com muitas transações (>500).

**Arquivo:** `js/analytics/engine.js`
**Melhoria futura:** Hash incremental (contador de versão por entidade).

Engine: [[05-architecture/analytics-engine#Performance]]

---

## Riscos Monitorados

### RISCO-01 — Perda de Dados em Conflito de Sync {#RISCO-01}

**Nível:** ⚠️ Médio

**Descrição:** Se o usuário editar dados em dois dispositivos offline simultaneamente, o último sync vence (last-write-wins). Pode causar perda silenciosa de dados.

**Mitigação:** Não há resolução de conflitos. Recomendação ao usuário: não usar em múltiplos dispositivos offline simultaneamente.

**ADR relacionado:** [[06-decisions/adrs#ADR-003]]
**Estado:** [[05-architecture/state-management#Sincronização Multi-Dispositivo]]

---

### RISCO-02 — localStorage Limitado (~5MB) {#RISCO-02}

**Nível:** 🟡 Baixo-Médio

**Descrição:** Usuários com muitas transações e histórico de chat podem aproximar o limite.

**Mitigação:** `chatHistory` limitado a 50 mensagens. Sem limpeza automática de transações antigas.

**Sinal de alerta:** `QuotaExceededError` no console (saveState falha silenciosamente).

---

### RISCO-03 — Dependência de CDNs Externos {#RISCO-03}

**Nível:** 🟢 Baixo

**Recursos externos:** Tailwind CSS, FontAwesome, Lucide, Flatpickr, Chart.js

**Mitigação:** PWA com service worker pode cachear recursos. Sem SW ou sem cache inicial, app falha em modo offline.

---

### RISCO-04 — Regex NLP Frágeis no Chat {#RISCO-04}

**Nível:** ⚠️ Médio

**Descrição:** O motor regex de 16 casos de uso é sensível a variações de linguagem natural, gírias, composição de frases.

**Mitigação:** Fallback para API externa se configurada. Usuário vê resposta genérica se nenhuma camada detectar a intent.

**Arquivo:** `js/ui/chat-ui.js`
**Regras:** [[02-business-rules/domain-rules#Assistente AI]]
**ADR:** [[06-decisions/adrs#ADR-008]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[07-bugs-fixes/known-fixes|Known Fixes →]]
