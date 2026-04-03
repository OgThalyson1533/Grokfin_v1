# Glassmorphism — Componentes de Vidro

> Classes CSS para cards, panels e efeitos de vidro translúcido.  
> Fonte: `css/glass.css`

#design

---

## `.glass-panel`

Painel base com fundo translúcido e blur:

```css
.glass-panel {
  background:
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.035));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--line);  /* rgba(255,255,255,.085) */
  box-shadow: 0 18px 45px rgba(0,0,0,.25);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.35s ease,
              border-color 0.35s ease;
}
```

**Hover** (compartilhado com `.overview-card`):
```css
.glass-panel:hover, .overview-card:hover {
  transform: translateY(-4px) scale(1.015);
  box-shadow: 0 24px 64px rgba(0,245,255,.10),
              0 0 0 1px rgba(0,245,255,.08) inset;
  border-color: rgba(0,245,255,.25);
}
```

---

## `.overview-card`

Cards do dashboard (KPIs, métricas). Mesmo hover que `.glass-panel`.

```css
.overview-card {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.35s ease,
              border-color 0.35s ease;
}
```

---

## `.card-hover`

Hover mais dramático — para cartões de crédito e cards de metas:

```css
.card-hover { transition: transform .35s ease, border-color .35s ease, box-shadow .35s ease; }

.card-hover:hover {
  transform: translateY(-6px);
  border-color: rgba(0,245,255,.18);
  box-shadow: 0 26px 60px rgba(0,0,0,.32),
              0 0 0 1px rgba(0,245,255,.06) inset;
}
```

---

## `.gradient-border`

Wrapper com borda gradiente ciano/violeta/verde:

```css
.gradient-border {
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(0,245,255,.50),
    rgba(168,85,247,.45),
    rgba(0,255,133,.45));
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
}
```

Uso: envolver um elemento com `.gradient-border` + o conteúdo dentro com background sólido.

---

## `.neon-title`

Títulos com brilho sutil em ciano:

```css
.neon-title {
  color: #e6fdff;
  text-shadow: 0 0 32px rgba(0,245,255,.20);
}
```

---

## Chat Bubbles

```css
/* Mensagens do usuário */
.message-bubble-user {
  background: linear-gradient(135deg, #00f5ff 0%, #36f1c8 100%);
  color: #041219;  /* texto escuro sobre fundo claro */
  box-shadow: 0 12px 30px rgba(0,255,133,.16);
}

/* Mensagens da IA */
.message-bubble-ai {
  background: rgba(255,255,255,.065);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
```

---

## Goal Card Overlay

Cards de metas têm um overlay gradiente para legibilidade do texto sobre imagem:

```css
.goal-card::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg,
    rgba(6,9,17,.15) 0%,
    rgba(6,9,17,.25) 30%,
    rgba(6,9,17,.90) 100%);
}
```

---

## Curva de Easing Padrão

Todos os hovers e animações de cards usam:

```css
cubic-bezier(0.16, 1, 0.3, 1)
```

Esta curva é do tipo "spring" — rápida no início, suave ao final. Dá a sensação de físico elástico.

---

## Profile Banner e Input

```css
.profile-input {
  border-radius: 1rem;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  transition: border-color .26s ease, box-shadow .26s ease, background .26s ease;
}

.profile-input:focus {
  border-color: rgba(0,245,255,.30);
  box-shadow: 0 0 0 4px rgba(0,245,255,.08);   /* focus ring ciano */
  background: rgba(255,255,255,.065);
}
```

**Padrão de focus ring**: `0 0 0 4px rgba(0,245,255,.08)` — usar em todos os inputs do app.
