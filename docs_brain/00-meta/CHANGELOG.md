# CHANGELOG — GroKFin Elite

> Histórico de versões da aplicação. Atualizar a cada ciclo significativo.

---

## v6 (atual — 2026-04)

### Adicionado
- Modelo de passivo de cartão de crédito: despesas CC não reduzem saldo imediato
- Tabela `faturas_ciclo` com ciclo aberta → fechada → paga
- View `card_status_view` para limite disponível em tempo real
- RPC `liquidar_fatura()` — liquidação ACID de fatura
- Função `fechar_faturas_e_cobrar()` para automação via pg_cron
- Tabela `custom_categories` — categorias personalizadas por usuário
- Campo `notes` e `attachment_url` em transactions
- Campo `status` (pendente/efetivado) em transactions
- Campo `invoice_id` em transactions (FK para faturas_ciclo)
- Campo `default_account_id` em cards (FK para accounts)
- Módulo `banks-ui.js` e `reports-ui.js`

### Corrigido
- `saveState()` não recebia o parâmetro `state` (era chamado sem argumento) — agora usa o state exportado diretamente
- `fetchExchangeRates()` nunca era chamado — cotações sempre vinham do seed estático
- `ensureChatSeed()` nunca era chamado — chat abria vazio para novos usuários
- Tab Mercado nunca era renderizada no ciclo global `renderAll()`
- `mapCurrentActiveTab` limitava erroneamente ao índice 5 (bloqueava tabs 6-8)

---

## v5 / v4 (histórico)

- Sync paralelo com `Promise.allSettled` (antes sequencial — ~6x mais lento)
- Retry automático com exponential backoff (3 tentativas: 500ms / 1s / 2s)
- Diff-based sync com `quickHash` — evita re-upsert de dados não alterados
- Memoização de `calculateAnalytics` para evitar recálculo em renders repetidos
- Novos indicadores de analytics: `trend3m`, `volatility`, `scoreBreakdown`, `nextFixedEvent`
- `cleanUUID()` para sanitizar IDs legados com prefixos (tx-, goal-, card-...)

---

## v3 / v2 (histórico)

- Primeira versão modular (separação em `js/ui/`, `js/services/`, `js/utils/`)
- Integração Supabase com RLS por `auth.uid()`
- Onboarding de novos usuários
- Módulos: dashboard, transactions, goals, cards, investments, cashflow, chat, profile, market
