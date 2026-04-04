---
tipo: changelog
tags: [changelog, histórico]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 📋 CHANGELOG — GrokFin Elite v6

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[00-meta/README|README]]

---

## [2026-04-04] — Mapeamento Cognitivo Completo (docs_brain)

### Adicionado
- `MOC — GrokFin Elite v6.md` — hub central do grafo de conhecimento
- [[00-meta/README]] — índice e guia de uso rápido
- [[01-ai-context/system-snapshot]] — snapshot comprimido para contexto de IA
- [[01-ai-context/ai-system-prompt]] — prompt de sistema pronto para colar
- [[02-business-rules/domain-rules]] — regras de negócio de todos os domínios
- [[02-business-rules/functional-flows]] — 11 fluxos funcionais documentados
- [[03-database/schema-reference]] — schema SQL completo com mapeamentos state↔DB
- [[04-design-system/design-tokens]] — tokens visuais, componentes e linguagem
- [[04-design-system/ux-patterns]] — padrões de UX, navegação e interação
- [[05-architecture/module-map]] — catálogo completo de módulos com grafo de deps
- [[05-architecture/state-management]] — fluxo de estado, persistência e sync
- [[05-architecture/api-integrations]] — Supabase, AwesomeAPI, AI Proxy
- [[05-architecture/analytics-engine]] — motor de análise com cálculos detalhados
- [[06-decisions/adrs]] — 10 Architecture Decision Records
- [[07-bugs-fixes/known-issues]] — débitos técnicos, riscos ativos
- [[07-bugs-fixes/known-fixes]] — correções aplicadas (histórico)

---

## [2026-04-01] — Migração Modal Nova Transação (Liquid Glass)

### Alterado
- `js/ui/transactions-ui.js` — classe `ModernFloxSelect` (dropdown rico com busca)
- `css/components.css` — estilos do modal Liquid Glass
- `app.html` — HTML do modal atualizado

### Corrigido
- Calendário Flatpickr integrado ao modal
- Balances de contas bancárias exibidos no dropdown de conta
- Ícones de categoria renderizando corretamente (FA→Lucide mapeado)

**Débitos abertos:** → [[07-bugs-fixes/known-issues#DT-01]]

---

## [2026-03-31] — Persistência e Sincronização

### Corrigido (FIX-003)
- Ordem de sync: cards agora sincronizam ANTES das transactions
- Violação de FK ao salvar transações de cartão → [[07-bugs-fixes/known-fixes#FIX-003]]

### Corrigido (FIX-006)
- Campo `initial_balance` não estava sendo mapeado ao criar contas bancárias → [[07-bugs-fixes/known-fixes#FIX-006]]

---

## [2026-03-30] — Módulo Bancos e Integração de Contas

### Adicionado
- `js/ui/banks-ui.js` — módulo completo de contas bancárias
- Seletor de conta no modal de transações (populate via [[02-business-rules/domain-rules#Contas Bancárias]])
- Filtro de origem (banco/cartão) na lista de transações

### Corrigido
- Gastos no cartão não afetam mais `state.balance` → [[02-business-rules/domain-rules#Cartões de Crédito]]
- Metas carregam corretamente do Supabase → [[07-bugs-fixes/known-fixes#FIX-007]]

---

## [2026-03-20] — Motor de Analytics e Chat AI

### Adicionado
- `js/analytics/engine.js` — motor memoizado → [[05-architecture/analytics-engine]]
- `js/ui/chat-ui.js` — 16 casos de uso NLP + fallback API → [[02-business-rules/domain-rules#Assistente AI]]
- Rate limiter (10 msgs/min) no chat

---

## [2026-03-15] — Estrutura Inicial

### Adicionado
- Estrutura base: `app.html`, `app.js`, `state.js` → [[05-architecture/module-map]]
- Supabase integrado → [[05-architecture/api-integrations]]
- Sistema de abas 0–10 → [[04-design-system/ux-patterns#Estrutura de Navegação]]
- Módulos UI iniciais: dashboard, transactions, goals, investments

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]]
