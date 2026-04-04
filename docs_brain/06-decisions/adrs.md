---
tipo: decisoes-arquiteturais
tags: [adr, arquitetura, decisão, rationale]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🏛️ ADRs — Architecture Decision Records

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[07-bugs-fixes/known-issues|Known Issues →]]
> **Relacionados:** [[05-architecture/module-map]] · [[05-architecture/state-management]] · [[03-database/schema-reference]]

---

## ADR-001: JavaScript ESM sem Bundler {#ADR-001}

**Status:** Aceito | **Data:** 2026-01

### Contexto
O projeto precisava ser simples de hospedar e iterar sem pipeline de build complexo.

### Decisão
Usar `<script type="module">` nativamente. Zero Webpack, Zero Vite, Zero build step.

### Consequências
- ✅ Deploy imediato via arquivos estáticos
- ✅ Source maps nativos, debugging direto no browser
- ✅ Sem "black box" de bundler
- ❌ Sem tree-shaking automático
- ❌ Sem TypeScript nativo
- ❌ Sem hot module replacement

Impacto em: [[05-architecture/module-map]] (estrutura de importações)

---

## ADR-002: Estado Global Mutável (sem Redux/Zustand) {#ADR-002}

**Status:** Aceito | **Data:** 2026-01

### Contexto
Precisávamos de gerenciamento de estado simples sem overhead de biblioteca.

### Decisão
Único objeto `state` exportado de `state.js`, mutado diretamente. Renderização imperativa via `appRenderAll()` após mutações.

### Consequências
- ✅ Simples, sem actions/reducers
- ✅ `console.log(state)` é o único debugger necessário
- ✅ Sem virtual DOM overhead
- ❌ Sem reatividade automática (render manual obrigatório)
- ❌ Risco de mutações não rastreadas

Detalhes: [[05-architecture/state-management]]

---

## ADR-003: Persistência Híbrida (LocalStorage + Supabase) {#ADR-003}

**Status:** Aceito | **Data:** 2026-01

### Contexto
App precisa funcionar offline e sincronizar quando conectado.

### Decisão
- **LocalStorage:** Síncrono e imediato (zero latência percebida)
- **Supabase:** Async debounced 1.5s após última mutação
- **Pull na inicialização:** Supabase sobrescreve estado local

### Consequências
- ✅ App offline-ready
- ✅ Multi-dispositivo via Supabase
- ✅ Zero latência percebida nas operações
- ❌ Sem resolução de conflitos sofisticada (last-write-wins)
- ❌ Sem sync em tempo real

Risco: [[07-bugs-fixes/known-issues#RISCO-01]]
Detalhes: [[05-architecture/state-management#Sincronização Multi-Dispositivo]]

---

## ADR-004: Supabase como Backend-as-a-Service {#ADR-004}

**Status:** Aceito | **Data:** 2026-01

### Contexto
Precisávamos de backend com auth, banco e storage sem gerenciar servidor.

### Decisão
Supabase (PostgreSQL + Auth + RLS + Storage + Edge Functions).

### Consequências
- ✅ Auth pronto com email/password e JWT
- ✅ RLS elimina lógica de autorização no cliente
- ✅ PostgreSQL real — queries complexas possíveis
- ✅ Edge Functions para proxy de AI
- ❌ Vendor lock-in
- ❌ Limites do plano free

Schema: [[03-database/schema-reference]]
API: [[05-architecture/api-integrations#Supabase]]

---

## ADR-005: Renderização Imperativa (sem React/Vue) {#ADR-005}

**Status:** Aceito | **Data:** 2026-01

### Contexto
UI complexa sem equipe especializada em frameworks de UI.

### Decisão
Renderização via `innerHTML` + template strings. Cada módulo UI tem `render*()` que gera HTML e injeta no DOM.

### Consequências
- ✅ HTML legível, sem JSX
- ✅ Sem overhead de reconciliação vDOM
- ✅ Controle total sobre o DOM
- ❌ Rerenderização completa de elementos (sem diff)
- ❌ Perda de estado de formulário entre renders
- ❌ Event listeners precisam ser re-attached

Impacto: [[04-design-system/ux-patterns]] (cada render re-chama `lucide.createIcons()`)

---

## ADR-006: CSS Híbrido (Tailwind + Custom) {#ADR-006}

**Status:** Aceito | **Data:** 2026-01

### Contexto
Precisávamos de sistema de utilitários rápido mas também de componentes visuais únicos.

### Decisão
- **Tailwind CSS (CDN):** utilitários de layout, espaçamento, tipografia
- **CSS Customizado** (`base.css` + `components.css`): variáveis de design, glassmorphism, animações

### Consequências
- ✅ Velocidade de desenvolvimento com Tailwind
- ✅ Identidade visual única via CSS customizado
- ❌ Tailwind CDN aumenta o tamanho inicial
- ❌ Mistura de paradigmas (utility vs semantic)

Design system: [[04-design-system/design-tokens]]

---

## ADR-007: Cartões de Crédito como Passivo {#ADR-007}

**Status:** Aceito | **Data:** 2026-02

### Contexto
Apps de finance tratam cartão de formas incompatíveis.

### Decisão
Cartões são **passivos**: gastos NÃO reduzem `state.balance`. Apenas o pagamento da fatura reduz o saldo.

### Consequências
- ✅ Reflete a realidade financeira corretamente
- ✅ Saldo disponível em conta é preciso
- ❌ UI precisa comunicar claramente
- ❌ Rastreamento separado: `card.used` + fatura

Regras: [[02-business-rules/domain-rules#Cartões de Crédito]]
Bug fix relacionado: [[07-bugs-fixes/known-fixes#FIX-002]]

---

## ADR-008: AI com NLP Local + Fallback para API {#ADR-008}

**Status:** Aceito | **Data:** 2026-02

### Contexto
Assistente AI é feature core mas custo de API é imprevisível.

### Decisão
3 camadas em cascata:
1. **NLP Transacional** (zero custo, 100% local)
2. **Motor regex** (zero custo, 16 casos de uso)
3. **API externa** (Gemini/Claude, somente se necessário)

### Consequências
- ✅ 80% das interações sem custo de API
- ✅ Funciona offline para queries básicas
- ✅ Rate limit (10/min) protege custo
- ❌ Motor regex frágil a variações de linguagem
- ❌ Usuário precisa de sua própria API key

Módulo: [[05-architecture/module-map#chat-ui.js]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 5]]
API: [[05-architecture/api-integrations#AI Proxy]]

---

## ADR-009: Date Format `'dd/mm/yyyy'` (string, não Date) {#ADR-009}

**Status:** Aceito (com ressalvas) | **Data:** 2026-01

### Contexto
Datas precisam ser exibidas em formato BR e persistidas no banco.

### Decisão
Armazenar como string `'dd/mm/yyyy'` diretamente. Converter para `Date` só quando necessário.

### Consequências
- ✅ Exibição direta no UI sem formatação
- ❌ Ordenação por string não funciona sem `parseDateBR()`
- ❌ Queries SQL por data mais complexas
- ❌ Problema de fuso horário latente

Bug fix de ordenação: [[07-bugs-fixes/known-issues#DT-04]]
Utilitário: `utils/date.js → parseDateBR()`

---

## ADR-010: Single HTML File (`app.html`) {#ADR-010}

**Status:** Aceito | **Data:** 2026-01

### Contexto
App mobile-first com navegação de abas. Sem roteamento de páginas.

### Decisão
Todo HTML em `app.html` (~161KB). Cada "aba" é um `<div id="tab-N">` com `display: none/block`.

### Consequências
- ✅ Zero navegação de página (UX nativa de app)
- ✅ Sem router de client-side
- ✅ Cacheável como um único arquivo (PWA)
- ❌ ~161KB de HTML parseado de uma vez
- ❌ Difícil de manter a medida que cresce
- ❌ Sem code splitting

Navegação: [[04-design-system/ux-patterns#Estrutura de Navegação]]
Módulo: [[05-architecture/module-map#navigation.js]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[07-bugs-fixes/known-issues|Known Issues →]]
