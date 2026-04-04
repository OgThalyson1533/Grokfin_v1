---
tipo: ux-patterns
tags: [ux, ui, padrões, interação, navegação]
backlinks: [[MOC — GrokFin Elite v6]]
---

# ✨ UX Patterns — Padrões de Experiência e Interação

> **Navegar:** [[MOC — GrokFin Elite v6]] | ← [[04-design-system/design-tokens|Design Tokens]]
> **Relacionados:** [[02-business-rules/functional-flows]] · [[05-architecture/module-map]]

---

## Estrutura de Navegação

### Modelo de Abas (0–10)

```
Barra inferior fixa:
[Home] [Conta] [Metas] [Invest.] [Relatórios] [☰ Mais]
  0      1       2        3          4              →

Painel "Mais" (sheet deslizável de baixo):
Grid 5 colunas:
[Cartões] [Bancos] [Cashflow] [Mercado] [Perfil]
    5         6         7          8        9
```

Módulo: [[05-architecture/module-map#navigation.js]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 1]]

### Transição entre Abas
1. Click → `switchTab(N)` [navigation.js]
2. Tab anterior oculta: `display: none`
3. Tab nova: `display: block` + scroll ao topo
4. URL hash atualizado: `#tab-N`
5. Render específico acionado

### Painel "Mais"
- Abre com `transform: translateY(0)` + backdrop escuro
- Fecha por: swipe down · click no backdrop · botão fechar · ao navegar
- Swipe detection: `touchstart` / `touchend`

---

## Padrões de Modais

### Modal Padrão
```
Overlay escuro (backdrop)
└─► Panel centralizado (glass-panel)
    ├─ Header: título + botão X
    ├─ Body: conteúdo scrollável
    └─ Footer: [Cancelar] [Confirmar]
```
Animação: `scale(0.95) + opacity(0)` → `scale(1) + opacity(1)` em 200ms.

### Modal de Transação (Liquid Glass)

```
[Abas Entrada / Saída]
[Campo: Descrição]
[Campo: Valor (currency input)]
[Campo: Data (Flatpickr)]
[Seletor: Conta ou Cartão (ModernFloxSelect)]
[Seletor: Categoria (combo dropdown com ícones)]

[▼ Mais detalhes (.tx-more-details-area — expansível)]
  [Toggle: Pagamento Realizado]
  [Seção Parcelamento] ← visível: isCard && isSaida && !isRecurring
  [Seção Recorrência]  ← visível: !!contaId selecionado
  [Campo: Notas]
  [Upload: Comprovante]

[Botão: Salvar]
```

Regras de visibilidade:
- Parcelamento: `isCard && isSaida && !isRecurringActive`
- Recorrência: `!!contaId`
- Recorrente + cartão → oculta parcelamento

Design: [[04-design-system/design-tokens#Modal de Transação]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 2]]
Débito: [[07-bugs-fixes/known-issues#DT-01]]

---

## Componentes Interativos

### `ModernFloxSelect` — Dropdown Rico
- **Trigger:** ícone + texto selecionado + chevron
- **Dropdown:** lista com busca (`input` filtra em tempo real)
- **Opções:** ícone colorido + título + subtitle (ex: saldo da conta)
- **Estado selecionado:** classe `.is-selected`
- **Deletar:** botão X nas categorias customizadas (`.delete-cat-btn`)
- **Fechamento:** click fora do dropdown

Módulo: [[05-architecture/module-map#transactions-ui.js]]

### Currency Input
- Aceita: `1000`, `1.000,50`, `1000.50`, `1,5`
- `parseCurrencyInput()` normaliza para `float` (em `utils/format.js`)
- Sem máscara automática — input text com parser no submit

### Selection de Data (Flatpickr)
```
Input estilizado + tema dark customizado
├─ Seleção de mês/ano via cabeçalho
├─ Atalhos: "Hoje" como default
└─ Formato: dd/mm/yyyy
```

Format: `parseDateBR()` em `utils/date.js`

### Progress Rings (SVG)
Três variantes:
1. **Surplus Ring** — gauge de saúde (home)
2. **Goal Ring** — por meta (carrossel)
3. **Gauge HF** — semicírculo com ponteiro (metas premium)

Design: [[04-design-system/design-tokens#Gauge High Fidelity]]

---

## Padrões de Feedback

### Toast Notifications
- Posição: **canto inferior direito** (`#toast-container` fixo)
- Duração: 3500ms padrão
- Animação: `translateY(14px)→0 + opacity` em 280ms
- Tipos: `success` · `danger` · `info`
- Função: `showToast(msg, type, duration)` em `utils/dom.js`

Design: [[04-design-system/design-tokens#Toast Notifications]]

### Estados Vazios (Empty State)
```html
<div class="empty-state">
  <div class="empty-icon"><!-- ícone grande --></div>
  <p class="empty-title"><!-- título --></p>
  <p class="empty-desc"><!-- descrição --></p>
  <button><!-- CTA primário --></button>
</div>
```

### Indicadores de Loading
- Chat: 3 pontos pulsantes (`.typing-dot`)
- Botões: sem spinner (UX imediata via state local)

---

## Padrões de Lista (Transações)

### Linha de Transação
```
[Checkbox] [Ícone/cat] [Desc + Cat/Data] [Badges] [Valor] [Editar] [Excluir]
```
- Valor: verde se positivo, vermelho se negativo
- Status pendente: badge amber
- Origem cartão: badge violet
- Ações inline: aparecem no hover

### Ordenação Colunar
Headers clicáveis com `window.sortTxTable(col)`:
- 1º click: direção padrão (desc para data/valor)
- 2º click: inverte direção
- Indicador: ↑↓ no header ativo

Débito técnico de ordenação: [[07-bugs-fixes/known-issues#DT-04]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 9]]

### Paginação
```
[← Anterior] [1-20 de 67] [Próxima →]
```
- Controles: `txPageNext()` / `txPagePrev()` na `window`
- Seletor: 10, 20, 50, 100 itens por página

---

## Badges de Pagamento

| Método | Estilo |
|---|---|
| Cartão crédito | violet/purple (`.payment-badge-card`) |
| PIX | cyan (`.payment-badge-pix`) |
| Dinheiro | green (`.payment-badge-dinheiro`) |
| Débito | amber (`.payment-badge-debito`) |

Design: [[04-design-system/design-tokens#Paleta de Status]]

---

## Insight Cards

```css
.insight-tip      { border-left: 3px solid rgba(0,245,255,.4);
                    background: rgba(0,245,255,.05); }
.insight-alert    { border-left: 3px solid rgba(255,102,133,.4);
                    background: rgba(255,102,133,.05); }
.insight-positive { border-left: 3px solid rgba(0,255,133,.4);
                    background: rgba(0,255,133,.05); }
```

Gerados por: [[05-architecture/analytics-engine]] → `overspend`, `urgentGoal`, `trend3m`

---

## Padrões do Chat (AI Sidebar)

### Layout
```
Sidebar deslizável da direita (420px)
├─ Header: logo + título + fechar
├─ Sugestões contextuais (3 botões)
├─ Área de mensagens (scroll independente)
│   ├─ User: alinhado à direita (fundo emerald)
│   └─ AI: alinhado à esquerda (glass + ícone robot)
├─ Input de texto
├─ [Scanner] [Microfone] [Enviar]
└─ Backdrop escuro (fecha ao clicar)
```

### Sugestões Contextuais (`buildContextualSuggestions`)
Geradas a partir de: `overspend`, `urgentGoal`, `runwayMonths`, `topCategory`

### Marcação no Chat (`richText()`)
```
**texto** → <strong>texto</strong>
_texto_   → <em>texto</em>
```

Módulo: [[05-architecture/module-map#chat-ui.js]]
Regras: [[02-business-rules/domain-rules#Assistente AI]]
Fluxo: [[02-business-rules/functional-flows#Fluxo 5]]

---

## Micro-Animações

| Contexto | Animação |
|---|---|
| Abertura de modal | `scale(0.95)→1 + opacity 0→1` (200ms) |
| Lista de transações | `fadeUp` com delay incremental (`.animation-delay-*`) |
| Cards de metas | `fadeUp` com delay 50ms por card |
| Carrossel de eventos | `slideInRight` com delay incremental |
| Saldo numérico | `animateValue()` — easeOutQuart scrolling |
| Progress ring | `stroke-dashoffset .6s ease` |
| Gauge HF | `1.5s cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Toast aparece | `translateY(14px)→0 + opacity (280ms)` |
| Hover nos cards | `translateY(-2px) + box-shadow (250ms)` |
| Mic gravando | `micPulse`: glow vermelho pulsante (1.2s loop) |

Design: [[04-design-system/design-tokens#Animações Globais]]

---

## Responsividade e Mobile UX

- **Mobile-first:** 360–400px como alvo principal
- Sem breakpoints tablet/desktop (app 100% mobile)
- `@media (max-width: 400px)` → calendário menor
- `@media (max-width: 359px)` → grid "Mais" 5→4 colunas
- **Touch:** swipe-down fecha o painel "Mais"
- **Barra inferior:** `position: fixed; bottom: 0` + glass
- **Padding:** `padding-bottom: 5rem` nas abas (não sobrepõe nav)
- **Scrollbars:** finas, semitransparentes; `scrollbar-width: none` em carouseis

Bug fix de overflow: [[07-bugs-fixes/known-fixes#FIX-005]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | ← [[04-design-system/design-tokens|Design Tokens]]
