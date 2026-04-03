# Component Classes — Catálogo de UI

> Todas as classes utilitárias de componente do GroKFin Elite v6.  
> Fonte: `css/components.css`, `css/nav.css`, `css/transactions.css`

#design

---

## Pills

```css
.pill {
  display: inline-flex; align-items: center; gap: .5rem;
  padding: .45rem .75rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.78);
  font-size: .75rem; font-weight: 600; letter-spacing: .03em;
}
```

Combinar com `.tone-*` para pills coloridas por categoria.

---

## Progress Bar

```css
.progress-track {
  height: 10px; width: 100%;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, var(--brand), var(--violet) 55%, var(--brand-2));
  /* Shimmer no final */
}
.progress-fill::after {
  content: ''; position: absolute;
  top: 0; right: 0; bottom: 0; width: 28px;
  background: rgba(255,255,255,.34);
  filter: blur(8px);
}
```

---

## Section Kicker (subtítulo de seção)

```css
.section-kicker {
  display: inline-flex; align-items: center; gap: .6rem;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.045);
  border-radius: 999px;
  padding: .55rem .85rem;
  font-size: .75rem; font-weight: 700; color: rgba(255,255,255,.76);
}
```

---

## Toast

```css
.toast {
  min-width: 280px; max-width: 420px;
  transform: translateY(14px); opacity: 0;
  transition: all .28s ease;
}
.toast.show { transform: translateY(0); opacity: 1; }
```

Tipos de toast: `info` (ciano), `success` (verde), `danger` (vermelho).  
Disparado via `window.showToast(mensagem, tipo)` — `js/utils/dom.js`.

---

## Surplus Ring (SVG)

```css
.surplus-ring          { transform: rotate(-90deg); transform-origin: center; }
.surplus-ring-track    { fill: none; stroke: rgba(255,255,255,.06); stroke-width: 10; }
.surplus-ring-fill     { fill: none; stroke-width: 10; stroke-linecap: round;
                         transition: stroke-dashoffset .6s ease; }
```

---

## Recurring Badge

```css
.recurring-badge {
  background: rgba(168,85,247,.15);
  border: 1px solid rgba(168,85,247,.25);
  color: #d6b0ff;
}
```

---

## Chat — Recording State

```css
@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,102,133,.50); }
  50%       { box-shadow: 0 0 0 8px rgba(255,102,133,.0); }
}

#chat-mic-btn.recording {
  background: linear-gradient(135deg, #ff6685, #ff4466) !important;
  color: #fff !important;
  border-color: rgba(255,100,133,.40) !important;
  animation: micPulse 1.2s ease infinite;
}
```

---

## Chat Input — Focus Ring

```css
.chat-input-wrap:focus-within {
  border-color: rgba(0,245,255,.35) !important;
  box-shadow: 0 0 0 3px rgba(0,245,255,.08);
}
```

---

## Typing Indicator (dots animados)

```css
.typing-dot {
  width: 7px; height: 7px;
  border-radius: 999px;
  background: var(--brand);
  animation: typing 1.2s infinite ease-in-out both;
  margin: 0 2px;
}
.typing-dot:nth-child(2) { animation-delay: .14s; }
.typing-dot:nth-child(3) { animation-delay: .28s; }

@keyframes typing {
  0%, 80%, 100% { transform: translateY(0) scale(.45); opacity: .45; }
  40%           { transform: translateY(-3px) scale(1); opacity: 1; }
}
```

Uso: `<span class="typing-dot"></span>` × 3

---

## Animações de Tab

```css
/* Staggered fade-in para filhos do painel ativo */
.tab-panel.active > * {
  opacity: 0;
  animation: staggeredFade .5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
/* Delays: nth-child(1) = 0.05s ... nth-child(8+) = 0.40s */

@keyframes staggeredFade {
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes popIn {
  0%   { opacity: 0; transform: scale(0.95) translateY(10px); }
  70%  { transform: scale(1.02) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
```

---

## Accessibility — Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

Todas as animações respeitam a preferência do sistema operacional.

---

## Select Options — Dark Fix

```css
select option {
  background: #0c111b;
  color: white;
}
```

Necessário pois browsers ignoram `backdrop-filter` e `background` do `<select>` nativo — o background branco dos options quebra o tema escuro sem este fix.
