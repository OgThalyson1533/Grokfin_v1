# Color Tokens — Design System

> Todas as variáveis CSS de cor do GroKFin Elite v6.  
> Fonte: `css/base.css`

#design

---

## CSS Custom Properties (`:root`)

```css
:root {
  /* Backgrounds */
  --bg-0: #06080f;    /* Mais escuro — fundo absoluto */
  --bg-1: #0a0d16;    /* Background principal do body */
  --bg-2: #111624;    /* Superfícies elevadas */

  /* Panels */
  --panel:        rgba(255,255,255,.055);   /* Card/painel padrão */
  --panel-strong: rgba(255,255,255,.075);   /* Card com mais destaque */
  --line:         rgba(255,255,255,.085);   /* Bordas sutis */

  /* Text */
  --text-soft:  rgba(255,255,255,.58);  /* Texto secundário */
  --text-faint: rgba(255,255,255,.40);  /* Texto terciário/placeholder */

  /* Brand Colors */
  --brand:   #00f5ff;   /* Ciano elétrico — cor primária */
  --brand-2: #00ff85;   /* Verde neon — cor secundária */
  --violet:  #a855f7;   /* Violeta — accent */
  --amber:   #facc15;   /* Âmbar — avisos/destaques */
  --danger:  #ff6685;   /* Rosa/vermelho — erros e alertas */
}
```

---

## Paleta de Cores Semânticas

### Status (pills de tendência)

| Classe | Texto | Background | Borda |
|---|---|---|---|
| `.status-up` | `#5cf0b0` | `rgba(16,185,129,.12)` | `rgba(16,185,129,.18)` |
| `.status-down` | `#ff9ab1` | `rgba(244,63,94,.12)` | `rgba(244,63,94,.18)` |
| `.status-neutral` | `#9ac9ff` | `rgba(59,130,246,.12)` | `rgba(59,130,246,.18)` |

### Tones (badges de categoria)

| Classe | Texto | Background | Borda |
|---|---|---|---|
| `.tone-success` | `#78f0be` | `rgba(16,185,129,.12)` | `rgba(16,185,129,.18)` |
| `.tone-danger` | `#ff9ab1` | `rgba(244,63,94,.12)` | `rgba(244,63,94,.18)` |
| `.tone-cyan` | `#8ef9ff` | `rgba(0,245,255,.10)` | `rgba(0,245,255,.16)` |
| `.tone-amber` | `#fde784` | `rgba(250,204,21,.11)` | `rgba(250,204,21,.18)` |
| `.tone-violet` | `#d6b0ff` | `rgba(168,85,247,.12)` | `rgba(168,85,247,.18)` |
| `.tone-slate` | `rgba(255,255,255,.85)` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.08)` |

### Insights (cards de análise)

| Classe | Borda esquerda | Background |
|---|---|---|
| `.insight-tip` | `rgba(0,245,255,.4)` | `rgba(0,245,255,.05)` |
| `.insight-alert` | `rgba(255,102,133,.4)` | `rgba(255,102,133,.05)` |
| `.insight-positive` | `rgba(0,255,133,.4)` | `rgba(0,255,133,.05)` |

### Payment Badges

| Classe | Texto | Background | Borda |
|---|---|---|---|
| `.payment-badge-card` | `#c4b5fd` | `rgba(124,58,237,.15)` | `rgba(124,58,237,.25)` |
| `.payment-badge-pix` | `#67e8f9` | `rgba(0,245,255,.1)` | `rgba(0,245,255,.2)` |
| `.payment-badge-dinheiro` | `#6ee7b7` | `rgba(0,255,133,.1)` | `rgba(0,255,133,.2)` |

---

## Mapeamento Categoria → Tone

Definido em `js/config.js`:

```js
export const toneByCategory = {
  'Receita':       'tone-success',
  'Alimentação':   'tone-cyan',
  'Transporte':    'tone-amber',
  'Lazer':         'tone-violet',
  'Moradia':       'tone-slate',
  'Investimentos': 'tone-cyan',
  'Assinaturas':   'tone-violet',
  'Saúde':         'tone-danger',
  'Metas':         'tone-success',
  'Rotina':        'tone-slate'
};
```

---

## Background do Body

```css
body {
  background:
    radial-gradient(circle at 10% 15%, rgba(0,245,255,.10), transparent 25%),
    radial-gradient(circle at 80% 0%,  rgba(168,85,247,.12), transparent 22%),
    radial-gradient(circle at 80% 85%, rgba(0,255,133,.08), transparent 25%),
    linear-gradient(180deg, #0b0f1b 0%, #090c15 45%, #05070d 100%);
}
```

Grid overlay sutil com `opacity: .25`:
```css
background-image:
  linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
background-size: 40px 40px;
```

---

## Scrollbar Customizada

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: rgba(255,255,255,.03); }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,245,255,.36); } /* --brand hover */
```

---

## Tipografia

- **Font**: Inter (Google Fonts) — weights 300, 400, 500, 600, 700, 800, 900
- **Cor de texto padrão**: white (sobre fundo escuro)
- **Placeholder**: `rgba(255,255,255,.30)`
- **Chart.js**: `Chart.defaults.color = 'rgba(255,255,255,.58)'` (= `--text-soft`)
