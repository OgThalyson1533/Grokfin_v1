---
tipo: MOC
projeto: GrokFin Elite v6
atualizado: 2026-04-04
tags: [MOC, index, navegação]
---

# 🧠 MOC — GrokFin Elite v6
> **Map of Content** — ponto de entrada central para toda a base cognitiva do projeto.
> Navegue por aqui para alcançar qualquer documento da estrutura.

---

## 🗺️ Grafo de Navegação

```
                        ┌─────────────────────┐
                        │  MOC — GrokFin v6   │  ← VOCÊ ESTÁ AQUI
                        └──────────┬──────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
  ┌───────────────┐      ┌─────────────────┐      ┌────────────────┐
  │  00 • Meta    │      │  01 • Contexto  │      │ 02 • Negócio   │
  │  & Changelog  │      │  AI Snapshot    │      │ Regras+Fluxos  │
  └───────┬───────┘      └────────┬────────┘      └───────┬────────┘
          │                       │                        │
          └───────────────────────┼────────────────────────┘
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
  ┌───────────────┐      ┌─────────────────┐      ┌────────────────┐
  │  03 • Banco   │      │ 04 • Design     │      │ 05 • Arquitet. │
  │  de Dados     │      │ Tokens + UX     │      │ Módulos+Engine │
  └───────┬───────┘      └────────┬────────┘      └───────┬────────┘
          │                       │                        │
          └───────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐       ┌───────────────────┐
          │  06 • Decisões  │       │  07 • Bugs & Fixes│
          │  ADRs           │       │  Débitos Técnicos │
          └─────────────────┘       └───────────────────┘
```

---

## 📁 00 — Meta & Projeto
> Visão geral, changelog e guia de uso do docs_brain.

- [[00-meta/README|📖 README — Guia do docs_brain]]
- [[00-meta/CHANGELOG|📋 CHANGELOG — Histórico de mudanças]]

---

## 🤖 01 — Contexto para IA
> Arquivos otimizados para ingestão por IA como contexto de sessão.

- [[01-ai-context/system-snapshot|⚡ System Snapshot — Contexto comprimido]]
- [[01-ai-context/ai-system-prompt|🎯 AI System Prompt — Pronto para colar]]

---

## 📐 02 — Regras de Negócio
> Domínios funcionais, invariantes e fluxos do sistema.

- [[02-business-rules/domain-rules|⚖️ Domain Rules — Regras e invariantes]]
- [[02-business-rules/functional-flows|🔄 Functional Flows — 11 fluxos funcionais]]

---

## 🗄️ 03 — Banco de Dados
> Schema SQL, modelos, RLS e estratégias de sincronização.

- [[03-database/schema-reference|🗃️ Schema Reference — Tabelas e mapeamentos]]

---

## 🎨 04 — Design System
> Tokens visuais, componentes e padrões de experiência.

- [[04-design-system/design-tokens|🎨 Design Tokens — Cores, CSS e componentes]]
- [[04-design-system/ux-patterns|✨ UX Patterns — Navegação, modais e micro-animações]]

---

## 🏗️ 05 — Arquitetura
> Módulos, estado, APIs e motor de análise.

- [[05-architecture/module-map|📦 Module Map — Grafo de dependências]]
- [[05-architecture/state-management|🔄 State Management — Fluxo de persistência]]
- [[05-architecture/api-integrations|🌐 API Integrations — Supabase, Exchange, AI]]
- [[05-architecture/analytics-engine|📊 Analytics Engine — Cálculos e métricas]]

---

## 📜 06 — Decisões Arquiteturais
> O "porquê" de cada escolha técnica do projeto.

- [[06-decisions/adrs|🏛️ ADRs — 10 Architecture Decision Records]]

---

## 🐛 07 — Bugs & Fixes
> Problemas conhecidos, correções e débitos técnicos.

- [[07-bugs-fixes/known-issues|🐛 Known Issues — Débitos e riscos ativos]]
- [[07-bugs-fixes/known-fixes|✅ Known Fixes — Correções aplicadas]]

---

## 🔑 Conceitos-Chave (Links Rápidos)

| Conceito | Documento |
|---|---|
| Como o estado funciona | [[05-architecture/state-management]] |
| Modelo de uma transação | [[03-database/schema-reference]] |
| Por que cartão é passivo | [[02-business-rules/domain-rules]] |
| Como o healthScore é calculado | [[05-architecture/analytics-engine]] |
| Por que não usa bundler | [[06-decisions/adrs]] |
| Quais bugs existem hoje | [[07-bugs-fixes/known-issues]] |
| Como adicionar uma feature | [[01-ai-context/ai-system-prompt]] |
| Variáveis CSS do design | [[04-design-system/design-tokens]] |
| Fluxo de inicialização | [[02-business-rules/functional-flows]] |

---

## 🧭 Sobre este MOC

Este arquivo é o **nó central** do grafo cognitivo do GrokFin no Obsidian.
Todo documento do `docs_brain` referencia este MOC e é referenciado por ele,
garantindo conectividade total no grafo de conhecimento.

**Backlinks esperados:** todos os demais arquivos de `docs_brain/` linkam para cá via `[[MOC — GrokFin Elite v6]]`.
