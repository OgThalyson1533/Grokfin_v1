---
tipo: meta
tags: [readme, guia, índice]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 📖 README — Guia do docs_brain

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[00-meta/CHANGELOG|CHANGELOG →]]

---

## O que é o docs_brain?

O `docs_brain` é a **base de conhecimento cognitiva** do GrokFin Elite v6.
Estruturado para funcionar como memória operacional navegável — tanto para humanos via Obsidian quanto para IAs via ingestão de contexto.

---

## 🗂️ Estrutura de Pastas

| Pasta | Conteúdo | Link |
|---|---|---|
| `00-meta/` | Índice, changelog, guia | [[00-meta/CHANGELOG]] |
| `01-ai-context/` | Snapshots e prompts para IA | [[01-ai-context/system-snapshot]] · [[01-ai-context/ai-system-prompt]] |
| `02-business-rules/` | Domínios e fluxos funcionais | [[02-business-rules/domain-rules]] · [[02-business-rules/functional-flows]] |
| `03-database/` | Schema SQL, RLS, mapeamentos | [[03-database/schema-reference]] |
| `04-design-system/` | Tokens, componentes, UX | [[04-design-system/design-tokens]] · [[04-design-system/ux-patterns]] |
| `05-architecture/` | Módulos, estado, APIs, engine | [[05-architecture/module-map]] · [[05-architecture/state-management]] · [[05-architecture/api-integrations]] · [[05-architecture/analytics-engine]] |
| `06-decisions/` | Architecture Decision Records | [[06-decisions/adrs]] |
| `07-bugs-fixes/` | Bugs, fixes, débitos | [[07-bugs-fixes/known-issues]] · [[07-bugs-fixes/known-fixes]] |

---

## ⚡ Guia de Uso Rápido (para IA)

Ao receber uma tarefa no GrokFin, leia nesta ordem:

1. **[[05-architecture/module-map]]** → Identifique qual módulo é responsável
2. **[[02-business-rules/domain-rules]]** → Entenda as regras do domínio
3. **[[03-database/schema-reference]]** → Valide o modelo de dados (state ↔ DB)
4. **[[05-architecture/state-management]]** → Entenda o fluxo de estado
5. **[[07-bugs-fixes/known-issues]]** → Verifique débitos antes de codificar

---

## 🔑 Stack do Projeto

```
Frontend:  HTML5 + JavaScript ESM (sem bundler) + Tailwind CSS + CSS Customizado
Backend:   Supabase (PostgreSQL + Auth + RLS)
Charts:    Chart.js
AI:        Google Gemini / Anthropic Claude (via proxy /api/ai-proxy)
Exchange:  AwesomeAPI (USD/EUR/BTC-BRL)
Icons:     Lucide + FontAwesome 6
Calendar:  Flatpickr
```

---

## 🗺️ Abas da Aplicação

| Tab | ID | Módulo UI | Descrição |
|---|---|---|---|
| 0 | `tab-0` | `dashboard-ui.js` | Home — saldo, calendário, metas, próximos eventos |
| 1 | `tab-1` | `transactions-ui.js` | Conta — transações, filtros, CRUD |
| 2 | `tab-2` | `goals-ui.js` | Metas — objetivos e aporte |
| 3 | `tab-3` | `investments-ui.js` | Investimentos — carteira |
| 4 | `tab-4` | `reports-ui.js` | Relatórios — análises e gráficos |
| 5 | `tab-5` | `cards-ui.js` | Cartões — faturas e crédito |
| 6 | `tab-6` | `banks-ui.js` | Bancos — contas bancárias |
| 7 | `tab-7` | `cashflow-ui.js` | Cashflow — projeção de fluxo |
| 8 | `tab-8` | `market-ui.js` | Mercado — cotações |
| 9 | `tab-9` | `profile-ui.js` | Perfil — configurações, chaves AI |
| 10 | `tab-10` | `reports-ui.js` | Relatórios avançados |

Tabs 5–10 ficam dentro do painel "Mais" (`#mais-sheet-panel`).

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]]
