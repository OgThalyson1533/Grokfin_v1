---
tipo: design-system
tags: [design, tokens, css, componentes, visual]
backlinks: [[MOC — GrokFin Elite v6]]
---

# 🎨 Design Tokens — Sistema Visual

> **Navegar:** [[MOC — GrokFin Elite v6]] | Próximo: [[04-design-system/ux-patterns|UX Patterns →]]
> **Relacionados:** [[02-business-rules/domain-rules]] · [[05-architecture/module-map]]

---

## Identidade Visual

- **Filosofia:** Dark mode-first + Glassmorphism + Neons controlados
- **Paleta de neons:** Cyan `#00f5ff`, Emerald `#10b981`, Violet `#a855f7`
- **Background:** Escuro profundo `#060911` com cards de vidro translúcido

Decisão arquitetural: [[06-decisions/adrs#ADR-006]]
Arquivo base: `css/base.css` | Componentes: `css/components.css`

---

## Variáveis CSS Globais (`css/base.css`)

```css
:root {
  /* Cores de Marca */
  --brand:      #00f5ff;             /* cyan primário */
  --brand-2:    #10b981;             /* emerald secundário */
  --violet:     #a855f7;             /* violet accent */
  
  /* Backgrounds */
  --bg-base:    #060911;
  --bg-card:    rgba(255,255,255,.035);
  --bg-hover:   rgba(255,255,255,.06);
  
  /* Texto */
  --text-primary:     rgba(255,255,255,.92);
  --text-secondary:   rgba(255,255,255,.60);
  --text-placeholder: rgba(255,255,255,.30);
  
  /* Borders */
  --border-subtle:    rgba(255,255,255,.08);
  --border-focus:     rgba(0,245,255,.30);
  
  /* Semântico */
  --success-color:  #5cf0b0;   /* positivo / entrada */
  --danger-color:   #ff9ab1;   /* negativo / saída */
  --warning-color:  #fde784;   /* alerta */
  --info-color:     #9ac9ff;   /* neutro */
  
  /* Liquid Glass (modal Nova Transação) */
  --tx-accent-cyan:   rgba(0,245,255,0.15);
  --tx-accent-green:  rgba(52,211,153,0.15);
  --tx-accent-purple: rgba(168,85,247,0.15);
}
```

---

## Paleta de Status / Tonalidades

| Classe | Fundo | Cor texto | Bordas | Uso |
|---|---|---|---|---|
| `.status-up` | rgba(16,185,129,.12) | #5cf0b0 | rgba(16,185,129,.18) | Entrada, positivo |
| `.status-down` | rgba(244,63,94,.12) | #ff9ab1 | rgba(244,63,94,.18) | Saída, negativo |
| `.tone-cyan` | rgba(0,245,255,.10) | #8ef9ff | rgba(0,245,255,.16) | Destaque cyan |
| `.tone-amber` | rgba(250,204,21,.11) | #fde784 | rgba(250,204,21,.18) | Alerta |
| `.tone-violet` | rgba(168,85,247,.12) | #d6b0ff | rgba(168,85,247,.18) | Premium |
| `.tone-success` | rgba(16,185,129,.12) | #78f0be | rgba(16,185,129,.18) | Sucesso |
| `.tone-danger` | rgba(244,63,94,.12) | #ff9ab1 | rgba(244,63,94,.18) | Erro |
| `.tone-slate` | rgba(255,255,255,.06) | rgba(255,255,255,.85) | rgba(255,255,255,.08) | Neutro |

Uso prático em: [[04-design-system/ux-patterns#Badges de Pagamento]] · [[04-design-system/ux-patterns#Insight Cards]]

---

## Componentes Visuais

### `.pill` — Chip genérico
```css
display: inline-flex; align-items: center; gap: .5rem;
padding: .45rem .75rem;
border-radius: 999px;
border: 1px solid rgba(255,255,255,.08);
background: rgba(255,255,255,.05);
```

### `.glass-panel` — Painel de Vidro
```css
background: rgba(255,255,255,.04–.08);
border: 1px solid rgba(255,255,255,.08–.12);
border-radius: 1.5rem–2rem;
backdrop-filter: blur(12px–20px);
```

### `.progress-track` + `.progress-fill`
```css
/* track */
height: 10px; border-radius: 999px;
background: rgba(255,255,255,.08);

/* fill — gradiente animado */
background: linear-gradient(90deg, var(--brand), var(--violet) 55%, var(--brand-2));
transition: width .6s ease;
```

### `.surplus-ring` — Gauge SVG Circular
- `stroke-dasharray` + `stroke-dashoffset` com transição `.6s ease`
- Track (fundo) + Fill (arco animado) com gradiente
- Usado na home do dashboard

### `.fin-cal` — Calendário Financeiro
```css
/* Container */
display: grid; grid-template-columns: repeat(7, 1fr);

/* Célula */
.fin-cal-day { min-height: 54px; }
.fin-cal-day.today { border: 1px solid var(--brand); }

/* Tags */
.fin-cal-tag--in  { background: rgba(16,185,129,.15); color: #78f0be; }
.fin-cal-tag--out { background: rgba(244,63,94,.15);  color: #ff9ab1; }
```

Padrão de uso: [[04-design-system/ux-patterns#Padrões de Feedback]]
Bug fix responsivo: [[07-bugs-fixes/known-fixes#FIX-005]]

---

## Modal de Transação — Liquid Glass

Variáveis `--tx-*` + design system específico do modal.

### Abas Entrada/Saída (`.tx-type-tabs`)
```css
/* Container: grid 2 colunas */
background: rgba(255,255,255,.04); border-radius: 1rem;

/* Tab ativa Entrada */
.tx-type-tab--entrada.active {
  background: rgba(52,211,153,.12);
  border-color: rgba(52,211,153,.28);
  color: #6ee7b7;
}
/* Tab ativa Saída */
.tx-type-tab--saida.active {
  background: rgba(251,113,133,.12);
  border-color: rgba(251,113,133,.28);
  color: #fda4af;
}
```

### Seção Expansível (`.tx-more-details-area`)
```css
max-height: 0; opacity: 0;
transition: max-height .38s cubic-bezier(.4,0,.2,1), opacity .28s ease;
.open { max-height: 400px; opacity: 1; }
```

Débito ativo: [[07-bugs-fixes/known-issues#DT-01]]
UX completa: [[04-design-system/ux-patterns#Modal de Transação]]

---

## Gauge High Fidelity (`.gauge-hf-*`)

Semicírculo SVG premium para indicadores de metas:
- `.gauge-hf-track` — arco de fundo cinza
- `.gauge-hf-completed` — arco de progresso (gradiente via `<linearGradient>`)
- `.gauge-hf-planned` — marcador pontilhado (valor planejado)
- `.gauge-hf-pointer` — ponteiro animado com `transform-origin`
- Animação: `1.5s cubic-bezier(0.2, 0.8, 0.2, 1)`

---

## Animações Globais (`css/base.css`)

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,102,133,.50); }
  50%       { box-shadow: 0 0 0 8px rgba(255,102,133,.0); }
}
```

Todas as animações: [[04-design-system/ux-patterns#Micro-Animações]]

---

## Toast Notifications

```css
/* success */ border-emerald-300/20 bg-emerald-300/10 text-emerald-200
/* danger  */ border-rose-300/20    bg-rose-300/10    text-rose-200
/* info    */ border-cyan-300/20    bg-cyan-300/10    text-cyan-200

/* Entrada: translateY(14px)→0 + opacity 0→1 em .28s ease */
```

Uso no código: `showToast(msg, type)` em `utils/dom.js`

---

## Ícones

| Biblioteca | Uso | Re-hidratação |
|---|---|---|
| **Lucide** | UI geral, categorias, ações | `lucide.createIcons()` após cada innerHTML |
| **FontAwesome 6** | Interface legada, chat | Classes `fa-solid fa-*` |

**Mapeamento FA → Lucide (categorias):**
```
fa-bowl-food  → utensils    | fa-car-side  → car
fa-film       → clapperboard | fa-house     → home
fa-heart-pulse → heart      | fa-chart-line → trending-up
fa-bag-shopping → shopping-bag | fa-bolt    → zap
```

---

## Tipografia

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Escala de tamanhos usada */
0.62–0.75rem → labels, badges
0.80–0.85rem → subtextos
0.95–1.00rem → corpo
1.10–1.25rem → títulos de seção
1.50rem+     → saldo, valores grandes

/* Pesos */
400 → corpo | 600–700 → destaque | 800–900 → valores principais
```

---

## Responsividade

- **Mobile-first:** 360–400px como alvo principal
- `@media (max-width: 400px)` → calendário reduz `min-height` das células
- `@media (max-width: 359px)` → grid "Mais" 5→4 colunas
- Scrollbars custom: finas, semitransparentes; `scrollbar-width: none` em carouseis

UX patterns responsivos: [[04-design-system/ux-patterns#Responsividade e Mobile UX]]

---

← [[MOC — GrokFin Elite v6|← Voltar ao MOC]] | [[04-design-system/ux-patterns|UX Patterns →]]
