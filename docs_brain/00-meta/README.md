# GroKFin — Segundo Cérebro (docs_brain)

> Vault do Obsidian para centralizar contexto de IA, regras de negócio, arquitetura e design system do **GroKFin Elite v6**.

## Propósito

Este vault existe para que qualquer sessão de IA (Claude, Gemini, etc.) ou desenvolvedor retome o trabalho com contexto completo, sem precisar reler o código-fonte do zero.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `00-meta/` | README, changelog e roadmap do vault |
| `01-ai-context/` | Prompts-base, providers de IA e shape do state injetado |
| `02-business-rules/` | Regras de negócio críticas: passivo CC, faturas, sync |
| `03-database/` | Schema Supabase, RLS policies, migrations, RPCs |
| `04-design-system/` | Tokens de cor, glassmorphism, classes de componente |
| `05-architecture/` | Mapa de módulos, state management, boot sequence |
| `06-decisions/` | ADRs — Architecture Decision Records |
| `07-bugs-fixes/` | Registro de todos os fixes documentados no código |

## Convenções

- **Tags Obsidian**: use `#regra-negocio`, `#supabase`, `#design`, `#bug`, `#adr`
- **Links internos**: prefira `[[nome-do-arquivo]]` para navegar entre notas
- **Badges de urgência**: `🔴 crítico` · `🟡 importante` · `🟢 documentação`
- **Atualize este vault** sempre que uma decisão de arquitetura for tomada ou um bug crítico for corrigido

## Versão do App Documentada

- **App**: GroKFin Elite v6
- **Supabase Schema**: v2 (com migrations de credit cards)
- **Storage Key**: `grokfin_hybrid_pwa_state`
- **Última atualização do vault**: 2026-04-02
