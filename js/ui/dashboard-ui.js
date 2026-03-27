/**
 * js/ui/dashboard-ui.js
 * Lógica do dashboard, relatórios e insights.
 */

import { state } from '../state.js';
import { formatMoney, formatNumber, formatPercent, formatMoneyShort, escapeHtml, richText } from '../utils/format.js';
import { clamp } from '../utils/math.js';
import { toneForCategory } from '../config.js';
import { buildPrimaryInsight, buildSmartInsights, getHealthCaption } from '../analytics/engine.js';
import { formatLongDate, formatShortTime } from '../utils/date.js';
import { syncActiveViewLabel, switchTab } from './navigation.js';

let currentInsight = { label: 'Aplicar', action: { type: 'noop' } };

export function setTrendChip(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.className = `mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${value >= 0 ? 'status-up' : 'status-down'}`;
  element.textContent = `${value >= 0 ? '+' : ''}${formatPercent(value, 2)}`;
}

export function renderHeaderMeta(analytics) {
  const refDateEl = document.getElementById('header-ref-date');
  const lastUpdateEl = document.getElementById('sidebar-last-update');
  const scoreEl = document.getElementById('sidebar-score');
  
  if (refDateEl) refDateEl.textContent = formatLongDate(analytics.ref);
  if (lastUpdateEl) lastUpdateEl.textContent = formatShortTime(state.lastUpdated);
  if (scoreEl) scoreEl.textContent = `${analytics.healthScore}/100`;
  syncActiveViewLabel(state.ui.activeTab ?? 0);
}

export function renderDashboard(analytics) {
  const el = id => document.getElementById(id);
  
  if (el('saldo-total')) el('saldo-total').textContent = formatMoney(state.balance);
  if (el('dashboard-income')) el('dashboard-income').textContent = formatMoney(analytics.incomes);
  if (el('dashboard-expense')) el('dashboard-expense').textContent = formatMoney(analytics.expenses);
  if (el('dashboard-runway')) el('dashboard-runway').textContent = `${formatNumber(analytics.runwayMonths, 1)} meses`;
  if (el('dashboard-burn')) el('dashboard-burn').textContent = formatMoney(analytics.burnDaily);

  const monthlyNetChip = document.getElementById('monthly-net-chip');
  if (monthlyNetChip) {
    monthlyNetChip.className = `pill ${analytics.net >= 0 ? 'status-up' : 'status-down'}`;
    monthlyNetChip.innerHTML = `<i class="fa-solid ${analytics.net >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${analytics.net >= 0 ? '+' : '-'}${formatMoney(Math.abs(analytics.net))} no mês`;
  }

  // Evolução Receitas vs Mês Anterior
  const incomeEvo = el('income-evo');
  if (incomeEvo) {
    if (analytics.lastMonthIncomes > 0) {
      const diff = ((analytics.incomes - analytics.lastMonthIncomes) / analytics.lastMonthIncomes) * 100;
      incomeEvo.textContent = `${diff >= 0 ? '+' : ''}${formatPercent(diff, 0)}`;
      incomeEvo.className = `absolute right-3.5 top-3.5 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border text-white/90 ${diff >= 0 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`;
    } else {
      incomeEvo.textContent = '--';
      incomeEvo.className = 'absolute right-3.5 top-3.5 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/5';
    }
  }

  // Evolução Despesas vs Mês Anterior
  const expenseEvo = el('expense-evo');
  if (expenseEvo) {
    if (analytics.lastMonthExpenses > 0) {
      const diff = ((analytics.expenses - analytics.lastMonthExpenses) / analytics.lastMonthExpenses) * 100;
      expenseEvo.textContent = `${diff > 0 ? '+' : ''}${formatPercent(diff, 0)}`;
      // Aumento de despesa é negativo visualmente (vermelho), redução é positivo (verde)
      expenseEvo.className = `absolute right-3.5 top-3.5 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border text-white/90 ${diff <= 0 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`;
    } else {
      expenseEvo.textContent = '--';
      expenseEvo.className = 'absolute right-3.5 top-3.5 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/5';
    }
  }

  if (el('usd-rate')) el('usd-rate').textContent = formatNumber(state.exchange.usd, 2);
  if (el('eur-rate')) el('eur-rate').textContent = formatNumber(state.exchange.eur, 2);
  if (el('btc-rate')) el('btc-rate').textContent = formatMoneyShort(state.exchange.btc).replace('R$ ', '');
  setTrendChip('usd-trend', state.exchange.trend.usd);
  setTrendChip('eur-trend', state.exchange.trend.eur);
  setTrendChip('btc-trend', state.exchange.trend.btc);

  if (el('health-score')) el('health-score').textContent = analytics.healthScore;
  if (el('health-caption')) el('health-caption').textContent = getHealthCaption(analytics.healthScore);

  const savingRate = clamp(analytics.savingRate, 0, 100);
  const savingChip = document.getElementById('saving-rate-chip');
  if (savingChip) {
    savingChip.className = `pill ${analytics.savingRate >= 20 ? 'status-up' : analytics.savingRate >= 10 ? 'status-neutral' : 'status-down'}`;
    savingChip.textContent = formatPercent(analytics.savingRate, 1);
  }
  if (el('saving-rate-label')) el('saving-rate-label').textContent = formatPercent(analytics.savingRate, 1);
  if (el('saving-rate-bar')) el('saving-rate-bar').style.width = `${savingRate}%`;

  const urgentGoal = analytics.urgentGoal;
  if (el('urgent-goal-label')) el('urgent-goal-label').textContent = urgentGoal ? `${urgentGoal.progress}%` : '--';
  if (el('urgent-goal-bar')) el('urgent-goal-bar').style.width = urgentGoal ? `${urgentGoal.progress}%` : '0%';

  if (el('top-category-name')) el('top-category-name').textContent = analytics.topCategory.name;
  if (el('top-category-value')) el('top-category-value').textContent = formatMoney(analytics.topCategory.value);
  if (el('avg-ticket')) el('avg-ticket').textContent = formatMoney(analytics.avgTicket);

  const healthSummary = analytics.overspend
    ? `A principal pressão está em ${analytics.overspend.cat}, acima do orçamento planejado. Um ajuste curto nessa categoria melhora o caixa sem mexer nas metas.`
    : analytics.savingRate >= 20
      ? `Você está poupando acima de 20% da renda do mês, com base boa para acelerar metas ou reforçar reserva.`
      : `Seu caixa ainda está saudável, mas o mês pede mais consistência para transformar renda em patrimônio.`;
  if (el('health-summary')) el('health-summary').textContent = healthSummary;

  const categoryHighlights = document.getElementById('category-highlights');
  if (categoryHighlights) {
    categoryHighlights.innerHTML = analytics.categories.length
      ? analytics.categories.slice(0, 4).map(([name, value]) => `
          <span class="pill ${toneForCategory(name)}">${escapeHtml(name)} • ${formatPercent((value / analytics.expenses) * 100, 0)}</span>
        `).join('')
      : '<span class="pill">Sem despesas suficientes para leitura</span>';
  }

  currentInsight = buildPrimaryInsight(analytics, state);
  if (el('insight-main')) el('insight-main').innerHTML = richText(currentInsight.text);
  if (el('insight-apply-btn')) el('insight-apply-btn').textContent = currentInsight.label;
  if (el('chat-side-insight')) el('chat-side-insight').innerHTML = richText(currentInsight.text);

  // Components
  renderSurplusRing(analytics);
  renderSmartInsights(analytics);
}

export function renderSurplusRing(analytics) {
  const pct = document.getElementById('surplus-pct');
  const caption = document.getElementById('surplus-caption');
  const ring = document.getElementById('surplus-ring-fill');
  const incEl = document.getElementById('surplus-income');
  const expEl = document.getElementById('surplus-expense');
  if (!pct || !ring) return;

  const rate = analytics.incomes > 0 ? Math.max(0, (analytics.net / analytics.incomes) * 100) : 0;
  const circumference = 427.3;
  const offset = circumference - (circumference * Math.min(rate, 100) / 100);

  pct.textContent = formatPercent(rate, 1);
  ring.style.strokeDashoffset = offset;

  if (rate >= 25) {
    caption.textContent = 'Excelente! Você está construindo patrimônio.';
    caption.style.color = '#5cf0b0';
    ring.style.stroke = 'url(#surplusGrad)';
  } else if (rate >= 10) {
    caption.textContent = 'Bom ritmo — tente chegar a 25%.';
    caption.style.color = '#fde784';
    ring.style.stroke = '#facc15';
  } else if (rate > 0) {
    caption.textContent = 'Margem baixa — corte gastos supérfluos.';
    caption.style.color = '#ff9ab1';
    ring.style.stroke = '#ff6685';
  } else {
    caption.textContent = 'Gastos superam a receita este mês.';
    caption.style.color = '#ff6685';
    ring.style.stroke = '#ff6685';
  }

  if (incEl) incEl.textContent = formatMoneyShort(analytics.incomes);
  if (expEl) expEl.textContent = formatMoneyShort(analytics.expenses);
}

export function renderSmartInsights(analytics) {
  const grid = document.getElementById('smart-insights-grid');
  if (!grid) return;
  const insights = buildSmartInsights(analytics, state);
  grid.innerHTML = insights.map(i => `
    <div class="insight-${i.type} rounded-2xl p-4">
      <div class="flex items-start gap-3">
        <span class="text-lg mt-0.5">${i.icon}</span>
        <div>
          <p class="text-sm font-bold text-white mb-1">${i.title}</p>
          <p class="text-sm text-white/65 leading-relaxed">${i.text}</p>
          ${i.action ? `<button class="mt-3 text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 bg-white/8 text-white/80 hover:bg-white/15 transition-colors" data-quick-action="${i.action}">${i.actionLabel}</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

export function renderReport(analytics) {
  const el = id => document.getElementById(id);
  
  if (el('report-net')) el('report-net').textContent = formatMoney(analytics.net);
  if (el('report-saving-rate')) el('report-saving-rate').textContent = formatPercent(analytics.savingRate, 1);
  if (el('report-runway')) el('report-runway').textContent = `${formatNumber(analytics.runwayMonths, 1)} meses`;

  const strengths = [];
  const alerts = [];

  if (analytics.net >= 0) {
    strengths.push(`Fluxo líquido positivo de **${formatMoney(analytics.net)}** no mês.`);
  } else {
    alerts.push(`O mês está com fluxo líquido negativo de **${formatMoney(Math.abs(analytics.net))}**.`);
  }

  if (analytics.runwayMonths >= 6) {
    strengths.push(`Seu caixa cobre cerca de **${formatNumber(analytics.runwayMonths, 1)} meses** do ritmo atual de gasto.`);
  } else {
    alerts.push(`O runway está em **${formatNumber(analytics.runwayMonths, 1)} meses**, pedindo mais colchão de liquidez.`);
  }

  if (analytics.urgentGoal) {
    strengths.push(`A meta **${analytics.urgentGoal.nome}** já está em **${analytics.urgentGoal.progress}%**.`);
  }

  if (analytics.overspend) {
    alerts.push(`A categoria **${analytics.overspend.cat}** já ultrapassou o orçamento planejado.`);
  } else {
    strengths.push('Nenhuma categoria principal rompeu o orçamento mensal cadastrado.');
  }

  if (analytics.savingRate < 15) {
    alerts.push(`A taxa de poupança está em **${formatPercent(analytics.savingRate, 1)}**, abaixo do ideal para acelerar patrimônio.`);
  }

  const threeMonthProjection = analytics.projection[2]?.value || state.balance;
  const sixMonthProjection = analytics.projection[5]?.value || state.balance;

  const categoriesBars = analytics.categories.length
    ? analytics.categories.map(([name, value]) => {
        const limit = state.budgets[name] || null;
        const ratio = limit ? value / limit : null;
        const width = analytics.expenses > 0 ? clamp((value / analytics.expenses) * 100, 6, 100) : 0;
        const marker = ratio && ratio > 1 ? 'status-down' : ratio && ratio > 0.8 ? 'status-neutral' : 'status-up';
        return `
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium text-white">${escapeHtml(name)}</span>
              <span class="text-white/58">${formatMoney(value)} ${limit ? `• limite ${formatMoney(limit)}` : ''}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
            <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${marker}">
              ${ratio ? `${formatPercent(ratio * 100, 0)} do orçamento` : 'Sem teto cadastrado'}
            </span>
          </div>
        `;
      }).join('')
    : '<p class="text-white/55">Ainda não existem despesas suficientes para gerar um mapa de categoria.</p>';

  const goalsHtml = analytics.goalsDetailed.length
    ? analytics.goalsDetailed.map(goal => `
        <div class="rounded-3xl border border-white/8 bg-white/4 p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="font-semibold text-white">${escapeHtml(goal.nome)}</p>
            <span class="pill ${goal.progress >= 80 ? 'status-up' : goal.progress >= 45 ? 'status-neutral' : 'status-down'}">${goal.progress}%</span>
          </div>
          <p class="mt-2 text-sm text-white/55">Faltam ${formatMoney(goal.remaining)} • aporte mensal ideal ${formatMoney(goal.monthlyNeed)}</p>
          <div class="mt-4 progress-track"><div class="progress-fill" style="width:${goal.progress}%"></div></div>
        </div>
      `).join('')
    : '<p class="text-white/55">Sem metas cadastradas.</p>';

  const rc = document.getElementById('report-content');
  if (rc) {
    rc.innerHTML = `
      <section class="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div class="rounded-3xl border border-white/8 bg-white/4 p-6">
          <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Diagnóstico executivo</p>
          <h4 class="mt-4 text-2xl font-black text-white">Seu dinheiro fecha o mês com ${formatMoney(analytics.net)} de fluxo líquido.</h4>
          <p class="mt-4 text-base leading-relaxed text-white/76">
            A principal pressão está em <strong class="text-white">${escapeHtml(analytics.topCategory?.name || 'N/A')}</strong>, enquanto o score da saúde financeira hoje está em <strong class="text-white">${analytics.healthScore || 0}/100</strong>.
            ${analytics.overspend ? `A categoria ${escapeHtml(analytics.overspend.cat)} já passou do orçamento e merece ajuste imediato.` : 'Como nenhum orçamento principal foi rompido, o cenário é favorável para acelerar metas.'}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span class="pill"><i class="fa-solid fa-arrow-trend-up text-emerald-300"></i> fluxo ${analytics.net >= 0 ? 'positivo' : 'negativo'}</span>
            <span class="pill"><i class="fa-solid fa-wallet text-cyan-300"></i> runway ${formatNumber(analytics.runwayMonths, 1)} meses</span>
            <span class="pill"><i class="fa-solid fa-bullseye text-violet-300"></i> metas ${formatPercent(analytics.goalsProgress, 0)}</span>
          </div>
        </div>

        <div class="rounded-3xl border border-white/8 bg-white/4 p-6">
          <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Cenário 90 dias</p>
          <div class="mt-4 space-y-4">
            <div class="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[.18em] text-white/34">Em 3 meses</p>
              <p class="mt-2 text-2xl font-black text-white">${formatMoney(threeMonthProjection)}</p>
            </div>
            <div class="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[.18em] text-white/34">Em 6 meses</p>
              <p class="mt-2 text-2xl font-black text-white">${formatMoney(sixMonthProjection)}</p>
            </div>
            <p class="text-sm leading-relaxed text-white/72">
              Mantendo o ritmo atual, seu patrimônio projetado continua crescendo. O melhor uso desse excedente depende de travar vazamentos ou acelerar metas.
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-3xl border border-white/8 bg-white/4 p-6">
          <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Forças do mês</p>
          <div class="mt-5 space-y-3">
            ${strengths.map(item => `
              <div class="rounded-2xl border border-emerald-300/12 bg-emerald-300/6 p-4 text-sm leading-relaxed text-white/80">
                ${richText(item)}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="rounded-3xl border border-white/8 bg-white/4 p-6">
          <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Pontos de atenção</p>
          <div class="mt-5 space-y-3">
            ${(alerts.length ? alerts : ['Nenhum alerta crítico neste momento.']).map(item => `
              <div class="rounded-2xl border border-rose-300/12 bg-rose-300/6 p-4 text-sm leading-relaxed text-white/80">
                ${richText(item)}
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-white/8 bg-white/4 p-6">
        <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Mapa de categorias</p>
        <div class="mt-5 space-y-5">
          ${categoriesBars}
        </div>
      </section>

      <section class="rounded-3xl border border-white/8 bg-white/4 p-6">
        <p class="text-xs font-bold uppercase tracking-[.22em] text-cyan-200/60">Radar de metas</p>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          ${goalsHtml}
        </div>
      </section>
    `;
  }
}

export function bindDashboardEvents() {
  const el = id => document.getElementById(id);
  
  el('refresh-btn')?.addEventListener('click', () => {
    if (window.renderAll) window.renderAll();
  });

  // [FIX #4] Listener de manage-budgets-btn removido daqui.
  // O listener real (openBudgetModal) está em cashflow-ui.js.
  // Manter aqui causava race condition: o toast falso ganhava.

  document.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.quickAction;
      if (action === 'open-goals') switchTab(4);
      else if (action === 'open-report') switchTab(1);
      else if (action === 'open-transactions') switchTab(2);
      else if (action === 'ask-burn' || action === 'open-chat') {
        switchTab(3);
        const input = document.getElementById('chat-input');
        if (input && action === 'ask-burn') {
          input.value = "Quanto estou queimando por dia?";
          setTimeout(() => document.getElementById('chat-send-btn')?.click(), 100);
        }
      }
      else if (action === 'apply-insight') {
         switchTab(1);
         import('../utils/dom.js').then(m => m.showToast('Recomendação avaliada e aplicada no diagnóstico.', 'success'));
      }
    });
  });
  
  document.querySelectorAll('[data-chat-prompt]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(3);
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = btn.dataset.chatPrompt;
        setTimeout(() => document.getElementById('chat-send-btn')?.click(), 100);
      }
    });
  });
}

// ══════════════════════════════════════════════════════════
// NOVO HOME — renderização dos componentes visuais mobile
// ══════════════════════════════════════════════════════════

/** Atualiza saudação e avatar no novo home */
export function renderHomeHeader() {
  const profile = state.profile || {};
  const name = profile.displayName || profile.nickname || 'Usuário';
  const initials = name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'GF';

  const el = id => document.getElementById(id);
  if (el('home-display-name')) el('home-display-name').textContent = name.split(' ')[0];
  if (el('home-avatar-initials')) el('home-avatar-initials').textContent = initials;
}

/** Renderiza rings de metas no home */
export function renderHomeGoals() {
  const container = document.getElementById('home-goals-rings');
  if (!container) return;

  const goals = state.goals || [];
  if (!goals.length) {
    container.innerHTML = `
      <div class="flex flex-col items-center gap-2 cursor-pointer" onclick="switchTab(4)">
        <div class="w-16 h-16 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
          <i class="fa-solid fa-plus text-white/25 text-lg"></i>
        </div>
        <p class="text-[10px] text-white/35 text-center w-16">Nova meta</p>
      </div>`;
    return;
  }

  const CIRCUMFERENCE = 2 * Math.PI * 26; // r=26
  const icons = ['fa-bag-shopping','fa-house','fa-car-side','fa-utensils','fa-heart-pulse','fa-bullseye','fa-seedling','fa-plane'];

  container.innerHTML = goals.slice(0, 8).map((g, i) => {
    const pct = Math.min(100, g.target > 0 ? Math.round((g.current / g.target) * 100) : 0);
    const offset = CIRCUMFERENCE * (1 - pct / 100);
    const color = pct >= 80 ? '#00ff85' : pct >= 40 ? '#00f5ff' : '#a855f7';
    const icon = icons[i % icons.length];
    const shortName = (g.name || 'Meta').slice(0, 8);

    return `
      <div class="flex flex-col items-center gap-1.5 cursor-pointer" onclick="switchTab(4)" title="${escapeHtml(g.name||'Meta')} — ${pct}%">
        <div class="relative w-16 h-16">
          <svg width="64" height="64" viewBox="0 0 64 64" class="absolute inset-0 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="3"/>
            <circle cx="32" cy="32" r="26" fill="none" stroke="${color}" stroke-width="3"
              stroke-dasharray="${CIRCUMFERENCE.toFixed(1)}"
              stroke-dashoffset="${offset.toFixed(1)}"
              stroke-linecap="round"
              style="filter:drop-shadow(0 0 4px ${color}88)"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <i class="fa-solid ${icon} text-white/60 text-sm"></i>
          </div>
        </div>
        <p class="text-[9px] font-semibold text-white/50 text-center truncate w-16">${escapeHtml(shortName)}</p>
        <p class="text-[9px] font-bold text-center" style="color:${color}">${pct}%</p>
      </div>`;
  }).join('');
}

/** Renderiza análise IA no card do home */
export function renderHomeAIInsight(analytics) {
  const el = document.getElementById('home-ai-insight');
  if (!el) return;
  const insight = buildPrimaryInsight(analytics, state);
  el.innerHTML = richText(insight.text || 'Adicione transações para gerar análise personalizada.');
}

/** Renderiza próximos 7 dias (gastos fixos próximos) */
export function renderHomeUpcoming() {
  const container = document.getElementById('home-upcoming-cards');
  const countEl   = document.getElementById('home-upcoming-count');
  if (!container) return;

  const today = new Date();
  const todayDay = today.getDate();
  const in7 = new Date(today); in7.setDate(todayDay + 7);

  // Pega fixedExpenses que vencem nos próximos 7 dias
  const upcoming = (state.fixedExpenses || [])
    .filter(e => e.active !== false && !e.isIncome)
    .map(e => {
      // Determina a próxima data de vencimento neste mês ou próximo
      let d = new Date(today.getFullYear(), today.getMonth(), e.day || 1);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, e.day || 1);
      return { ...e, nextDate: d };
    })
    .filter(e => e.nextDate <= in7)
    .sort((a, b) => a.nextDate - b.nextDate)
    .slice(0, 6);

  if (countEl) countEl.textContent = upcoming.length;

  if (!upcoming.length) {
    container.innerHTML = `
      <div class="w-36 rounded-2xl border border-white/8 bg-white/4 p-3 flex flex-col gap-1">
        <i class="fa-regular fa-calendar-check text-white/20 text-lg mb-1"></i>
        <p class="text-xs text-white/30">Sem compromissos nos próximos 7 dias</p>
      </div>`;
    return;
  }

  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  container.innerHTML = upcoming.map(e => {
    const d = e.nextDate;
    const dateStr = `${String(d.getDate()).padStart(2,'0')}/${months[d.getMonth()]}`;
    const isNear = (d - today) < 2 * 86400000; // menos de 2 dias = urgente
    return `
      <div class="w-36 rounded-2xl border ${isNear ? 'border-rose-400/25 bg-rose-400/6' : 'border-white/8 bg-white/4'} p-3 flex flex-col gap-1.5 cursor-pointer shrink-0"
           onclick="switchTab(7)">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold ${isNear ? 'text-rose-300' : 'text-white/50'}">${dateStr}</span>
          <span class="w-5 h-5 rounded-full ${isNear ? 'bg-rose-400/20 border border-rose-400/30' : 'bg-emerald-400/15 border border-emerald-400/20'} flex items-center justify-center">
            <i class="fa-solid fa-circle text-[6px] ${isNear ? 'text-rose-400' : 'text-emerald-400'}"></i>
          </span>
        </div>
        <p class="text-xs font-semibold text-white/80 truncate">${escapeHtml(e.name || 'Compromisso')}</p>
        <p class="text-sm font-black text-white">${formatMoneyShort(Math.abs(e.value))}</p>
      </div>`;
  }).join('');
}

/** Renderiza top gastos por categoria */
export function renderHomeTopGastos(analytics) {
  const container = document.getElementById('home-top-gastos');
  if (!container) return;

  const cats = (analytics.categories || []).slice(0, 4);
  if (!cats.length) {
    container.innerHTML = `<div class="col-span-4 rounded-2xl border border-white/8 bg-white/4 p-4 text-center text-xs text-white/30">Sem transações no mês</div>`;
    return;
  }

  const icons = {
    'Alimentação':'fa-bowl-food', 'Transporte':'fa-car-side',
    'Lazer':'fa-film', 'Moradia':'fa-house',
    'Investimentos':'fa-chart-line', 'Assinaturas':'fa-repeat',
    'Saúde':'fa-heart-pulse', 'Metas':'fa-bullseye', 'Rotina':'fa-bag-shopping'
  };
  const bgColors = ['bg-amber-400/10','bg-cyan-400/10','bg-violet-400/10','bg-rose-400/10'];
  const iconColors = ['text-amber-300','text-cyan-300','text-violet-300','text-rose-300'];
  const borderColors = ['border-amber-400/20','border-cyan-400/20','border-violet-400/20','border-rose-400/20'];

  container.innerHTML = cats.map(([name, value], i) => `
    <div class="rounded-2xl border ${borderColors[i%4]} ${bgColors[i%4]} p-3 flex flex-col gap-2 cursor-pointer"
         onclick="switchTab(2)">
      <div class="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
        <i class="fa-solid ${icons[name] || 'fa-wallet'} ${iconColors[i%4]} text-sm"></i>
      </div>
      <div>
        <p class="text-[10px] text-white/40 truncate leading-none mb-0.5">${escapeHtml(name)}</p>
        <p class="text-sm font-black text-white leading-tight">${formatMoneyShort(value)}</p>
      </div>
    </div>`).join('');
}

/** Renderiza todos os widgets do novo home */
export function renderHomeWidgets(analytics) {
  renderHomeHeader();
  // burn diário no subtitle
  const burnEl = document.getElementById('home-burn-daily');
  if (burnEl) burnEl.textContent = formatMoney(analytics.burnDaily || 0);
  renderHomeGoals();
  renderHomeAIInsight(analytics);
  renderHomeUpcoming();
  renderHomeTopGastos(analytics);
}
