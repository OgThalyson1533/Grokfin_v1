/**
 * js/ui/dashboard-ui.js
 * Lógica do dashboard, relatórios e insights.
 */

import { state } from '../state.js';
import { animateValue, formatMoney, formatNumber, formatPercent, formatMoneyShort, escapeHtml, richText } from '../utils/format.js';
import { clamp } from '../utils/math.js';
import { toneForCategory } from '../config.js';
import { buildPrimaryInsight, buildSmartInsights, getHealthCaption, calculateAnalyticsForPeriod, getPeriodRange } from '../analytics/engine.js';
import { formatLongDate, formatShortTime } from '../utils/date.js';
import { syncActiveViewLabel, switchTab } from './navigation.js';

let currentInsight = { label: 'Aplicar', action: { type: 'noop' } };

// ── Calendar interaction state ─────────────────────────────────────────────
let _calByDay   = null;
let _calYear    = null;
let _calMonth   = null;
let _calTooltip = null;
let _calModal   = null;

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
  
  if (el('saldo-total')) animateValue(el('saldo-total'), 0, state.balance, 1500, formatNumber);
  if (el('dashboard-income')) animateValue(el('dashboard-income'), 0, analytics.incomes, 1500, formatMoney);
  if (el('dashboard-expense')) animateValue(el('dashboard-expense'), 0, analytics.expenses, 1500, formatMoney);
  if (el('dashboard-runway')) el('dashboard-runway').textContent = `${formatNumber(analytics.runwayMonths, 1)} meses`;
  if (el('dashboard-burn')) animateValue(el('dashboard-burn'), 0, analytics.burnDaily, 1500, formatMoney);

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

  // Re-render gauge when user edits the health target input
  window.addEventListener('grokfin:gauge-target-changed', () => {
    if (_lastGaugeArgs) renderHealthGauge(..._lastGaugeArgs);
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

  const el = id => document.getElementById(id);
  // Nome no header (aparece em 2 lugares)
  ['home-display-name'].forEach(id => { if (el(id)) el(id).textContent = name.split(' ')[0]; });
  // Avatar no header
  const headerAvatar = el('header-avatar-img');
  if (headerAvatar && profile.avatarImage) headerAvatar.src = profile.avatarImage;
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

  const R = 28, C = 2 * Math.PI * R; // circumference

  container.innerHTML = goals.slice(0, 8).map((g) => {
    const nome = g.nome || g.name || 'Meta';
    const atual = Number(g.atual ?? g.current ?? 0);
    const total = Number(g.total ?? g.target ?? 0);
    const pct   = total > 0 ? Math.min(100, Math.round((atual / total) * 100)) : 0;
    const offset = C * (1 - pct / 100);
    const color  = pct >= 80 ? '#00ff85' : pct >= 40 ? '#00f5ff' : '#a855f7';
    const shortName = nome.slice(0, 10);

    // Try to show goal image as ring background thumbnail
    const imgUrl = g.customImage || g.img || '';
    const innerContent = imgUrl
      ? `<div class="absolute inset-[5px] rounded-full bg-cover bg-center opacity-60" style="background-image:url('${imgUrl}')"></div>`
      : `<i class="fa-solid fa-bullseye text-white/30 text-sm"></i>`;

    return `
      <div class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0" onclick="switchTab(4)" title="${escapeHtml(nome)} — ${pct}%">
        <div class="relative w-[68px] h-[68px]">
          <svg width="68" height="68" viewBox="0 0 68 68" style="position:absolute;inset:0;transform:rotate(-90deg)">
            <circle cx="34" cy="34" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="3.5"/>
            <circle cx="34" cy="34" r="${R}" fill="none" stroke="${color}" stroke-width="3.5"
              stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
              stroke-linecap="round"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            ${innerContent}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none" style="background:${color}22;color:${color};border:1px solid ${color}44">${pct}%</div>
        </div>
        <p class="text-[9px] font-semibold text-white/45 text-center truncate w-[68px] mt-1">${escapeHtml(shortName)}</p>
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

  const el = id => document.getElementById(id);

  // Burn diário
  if (el('home-burn-daily')) animateValue(el('home-burn-daily'), 0, analytics.burnDaily || 0, 1500, formatMoney);

  // Net chip
  const netChip = el('home-net-chip');
  if (netChip) {
    const net = analytics.net || 0;
    netChip.className = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${net >= 0 ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300' : 'border-rose-400/20 bg-rose-400/8 text-rose-300'}`;
    netChip.innerHTML = `<i class="fa-solid ${net >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-[10px]"></i> ${net >= 0 ? '+' : ''}${formatMoneyShort(net)}`;
  }

  // Score / runway / saving — desktop e mobile (ids diferentes)
  const score = analytics.healthScore ?? '--';
  const caption = getHealthCaption(analytics.healthScore || 0);
  const runway = analytics.runwayMonths != null ? `${formatNumber(analytics.runwayMonths, 1)} m` : '--';
  const saving = analytics.savingRate != null ? `${formatNumber(analytics.savingRate, 0)}%` : '0%';

  ['home-health-score', 'home-health-score-m'].forEach(id => { if (el(id)) el(id).textContent = score; });
  if (el('home-health-caption')) el('home-health-caption').textContent = caption;
  ['home-runway', 'home-runway-m'].forEach(id => { if (el(id)) el(id).textContent = runway; });
  ['home-saving', 'home-saving-m'].forEach(id => { if (el(id)) el(id).textContent = saving; });

  renderHomeGoals();
  renderHomeAIInsight(analytics);
  renderHomeUpcoming();
  renderHomeLineChart();
  renderHomeFinancialCalendar();

  // New period-aware widgets
  const filter = state.ui.homeFilter || 'this_month';
  const periodData = calculateAnalyticsForPeriod(state, filter);
  renderPeriodFilter(filter);
  renderHealthGauge(periodData, filter, analytics);
  renderCategoryBars(periodData);
  renderPerformanceComparison(periodData);
  renderPaymentMethods(periodData);
  renderIncomeSource(periodData);
}

// ── Instância do gráfico de linha do home (evita leak) ──
let _homeLineChart = null;
let _homeLineChartTheme = null; // theme the chart was built with

/** Gráfico de linha: Receita vs Despesa (últimos 6 meses) */
export function renderHomeLineChart() {
  const canvas = document.getElementById('home-line-chart');
  const emptyEl = document.getElementById('home-line-chart-empty');
  if (!canvas || !window.Chart) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'ocean-glass';
  const isLight = currentTheme === 'light';

  // Destroy and recreate when theme changes so axis/tooltip colors update
  if (_homeLineChart && _homeLineChartTheme !== currentTheme) {
    _homeLineChart.destroy();
    _homeLineChart = null;
    _homeLineChartTheme = null;
  }

  const today = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const txMonth = (state.transactions || []).filter(t => {
      const td = _parseDateBRLocal(t.date);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    const income  = txMonth.filter(t => t.value > 0).reduce((a, t) => a + t.value, 0);
    const expense = txMonth.filter(t => t.value < 0).reduce((a, t) => a + Math.abs(t.value), 0);
    months.push({
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d),
      income,
      expense
    });
  }

  const hasData = months.some(m => m.income > 0 || m.expense > 0);
  if (!hasData) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  canvas.style.display = '';
  if (emptyEl) emptyEl.classList.add('hidden');

  // Se o gráfico já existe, apenas atualiza os dados — evita destroy/recreate
  // que causa colapso do canvas e scroll indesejado para o final da página.
  if (_homeLineChart) {
    _homeLineChart.data.labels = months.map(m => m.label);
    _homeLineChart.data.datasets[0].data = months.map(m => m.income);
    _homeLineChart.data.datasets[1].data = months.map(m => m.expense);
    _homeLineChart.update('active');
    return;
  }

  const ctx = canvas.getContext('2d');

  const tickColor    = isLight ? 'rgba(0,0,0,.45)'   : 'rgba(255,255,255,.40)';
  const gridColor    = isLight ? 'rgba(0,0,0,.06)'   : 'rgba(255,255,255,.04)';
  const tooltipBg    = isLight ? 'rgba(255,255,255,.97)' : 'rgba(6,9,17,.92)';
  const tooltipBrd   = isLight ? 'rgba(0,0,0,.12)'   : 'rgba(255,255,255,.08)';

  const gradientHeight = Math.max(300, canvas.height || 300);

  const gradIncome = ctx.createLinearGradient(0, 0, 0, gradientHeight);
  gradIncome.addColorStop(0, 'rgba(52,211,153,.30)');
  gradIncome.addColorStop(1, 'rgba(52,211,153,0)');

  const gradExpense = ctx.createLinearGradient(0, 0, 0, gradientHeight);
  gradExpense.addColorStop(0, 'rgba(251,113,133,.25)');
  gradExpense.addColorStop(1, 'rgba(251,113,133,0)');

  _homeLineChart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Receita',
          data: months.map(m => m.income),
          borderColor: '#34d399',
          backgroundColor: gradIncome,
          borderWidth: 2,
          pointBackgroundColor: '#34d399',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Despesa',
          data: months.map(m => m.expense),
          borderColor: '#fb7185',
          backgroundColor: gradExpense,
          borderWidth: 2,
          pointBackgroundColor: '#fb7185',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBrd,
          borderWidth: 1,
          padding: 12,
          titleColor: isLight ? '#111' : '#fff',
          bodyColor:  isLight ? '#374151' : 'rgba(255,255,255,.75)',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 10 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 10 },
            callback: v => formatMoneyShort(v)
          }
        }
      }
    }
  });
  _homeLineChartTheme = currentTheme;
}

/** Auxiliar: parseia data BR (dd/mm/yyyy) sem importar módulo */
function _parseDateBRLocal(str = '') {
  if (!str) return new Date(NaN);
  const parts = str.split('/');
  if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return new Date(str);
}

window._homeCalendarMonthOffset = 0;
window.changeCalendarMonth = (offset) => {
  window._homeCalendarMonthOffset += offset;
  import('./dashboard-ui.js').then(m => m.renderHomeFinancialCalendar());
};

// ── Calendar Tooltip + Modal helpers ──────────────────────────────────────

// Touch detection — same heuristic as the reference implementation
const _isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function _fmtMoney(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ── Category → emoji icon ──────────────────────────────────────────────────
function _iconForCat(cat = '') {
  const map = {
    'Alimentação': '🛒', 'Moradia': '🏠', 'Transporte': '🚗',
    'Lazer': '🎬', 'Saúde': '💊', 'Investimentos': '📈',
    'Assinaturas': '📡', 'Metas': '🎯', 'Receita': '💰',
    'Cartão': '💳', 'Educação': '📚', 'Roupas': '👗',
  };
  return map[cat] || (cat ? '📌' : '💸');
}

// ── Tooltip singleton ──────────────────────────────────────────────────────
function _getTooltip() {
  if (!_calTooltip) {
    _calTooltip = document.createElement('div');
    _calTooltip.className = 'cal-tooltip';
    _calTooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_calTooltip);
  }
  return _calTooltip;
}

// ── Modal singleton ────────────────────────────────────────────────────────
function _getModal() {
  if (!_calModal) {
    _calModal = document.createElement('div');
    _calModal.className = 'cal-modal-overlay';
    _calModal.setAttribute('role', 'dialog');
    _calModal.setAttribute('aria-modal', 'true');
    _calModal.innerHTML = `
      <div class="cal-modal-sheet">
        <div class="cal-modal-drag-handle"></div>
        <div class="cal-modal-header">
          <span class="cal-modal-title" id="cal-modal-title"></span>
          <button class="cal-modal-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="cal-modal-body" id="cal-modal-body"></div>
      </div>`;
    document.body.appendChild(_calModal);
    _calModal.querySelector('.cal-modal-close').addEventListener('click', _closeModal);
    _calModal.addEventListener('click', e => { if (e.target === _calModal) _closeModal(); });
  }
  return _calModal;
}

function _closeModal() {
  if (!_calModal) return;
  _calModal.classList.remove('active');
}

function _hideTooltip() {
  if (_calTooltip) _calTooltip.classList.remove('visible');
}

// ── Tooltip content builder ────────────────────────────────────────────────
function _buildTooltipHtml(data) {
  if (!data) return '';
  const net = data.income - data.expense;
  const netColor = net >= 0 ? '#66fcf1' : '#ff4b4b';

  const txs     = data.transactions || [];
  const income3 = [...txs].filter(t => t.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
  const expense3= [...txs].filter(t => t.value < 0).sort((a, b) => a.value - b.value).slice(0, 3);

  const txRows = (arr, cls) => arr.map(t =>
    `<div class="cal-tip-row">
       <span class="cal-tip-desc">${escapeHtml(t.desc || t.cat || '')}</span>
       <span class="cal-tip-val ${cls}">${_fmtMoney(Math.abs(t.value))}</span>
     </div>`
  ).join('');

  const cardBadges = [
    ...(data.cardClose || []).map(n => `<span class="cal-tip-badge badge-close">✂ ${escapeHtml(n)}</span>`),
    ...(data.cardDue   || []).map(n => `<span class="cal-tip-badge badge-due">💳 ${escapeHtml(n)}</span>`)
  ].join('');

  const fixedBadges = (data.fixedEvents || []).map(f =>
    `<span class="cal-tip-badge badge-fixed">${f.isIncome ? '↑' : '↓'} ${escapeHtml(f.name)}</span>`
  ).join('');

  return `
    <div class="cal-tip-net" style="color:${netColor}">${net >= 0 ? '+' : ''}${_fmtMoney(net)}</div>
    ${income3.length  ? `<div class="cal-tip-section">Receitas</div>${txRows(income3, 'tip-in')}`   : ''}
    ${expense3.length ? `<div class="cal-tip-section">Despesas</div>${txRows(expense3, 'tip-out')}` : ''}
    ${cardBadges || fixedBadges ? `<div class="cal-tip-badges">${cardBadges}${fixedBadges}</div>` : ''}`;
}

// ── Modal content builder ──────────────────────────────────────────────────
function _buildModalHtml(data) {
  if (!data) return '<p style="opacity:.5;font-size:.85rem;text-align:center;padding:2rem 0">Nenhum evento neste dia.</p>';

  const txs     = data.transactions || [];
  const incomes = txs.filter(t => t.value > 0).sort((a, b) => b.value - a.value);
  const expenses= txs.filter(t => t.value < 0).sort((a, b) => a.value - b.value);

  const txBlock = (arr, label, cls, sign) => {
    if (!arr.length) return '';
    return `<div class="cal-modal-section">${label}</div>` +
      arr.map(t => `
        <div class="cal-modal-tx-row">
          <div class="cal-modal-tx-left">
            <span class="cal-modal-tx-icon">${_iconForCat(t.cat)}</span>
            <div class="cal-modal-tx-info">
              <span class="cal-modal-tx-desc">${escapeHtml(t.desc || '—')}</span>
              <span class="cal-modal-tx-cat">${escapeHtml(t.cat || '')}</span>
            </div>
          </div>
          <span class="cal-modal-tx-val ${cls}">${sign}${_fmtMoney(Math.abs(t.value))}</span>
        </div>`).join('');
  };

  const cardLines = [
    ...(data.cardClose || []).map(n => `<div class="cal-modal-event-row badge-close">✂ Fecha fatura — ${escapeHtml(n)}</div>`),
    ...(data.cardDue   || []).map(n => `<div class="cal-modal-event-row badge-due">💳 Vencimento — ${escapeHtml(n)}</div>`)
  ].join('');

  const fixedLines = (data.fixedEvents || []).map(f =>
    `<div class="cal-modal-event-row badge-fixed">${f.isIncome ? '↑' : '↓'} ${escapeHtml(f.name)} (despesa fixa)</div>`
  ).join('');

  const net = data.income - data.expense;
  const netColor = net >= 0 ? '#66fcf1' : '#ff4b4b';

  return `
    <div class="cal-modal-summary">
      <span style="color:#66fcf1">+ ${_fmtMoney(data.income)}</span>
      <span style="color:#888">·</span>
      <span style="color:#ff4b4b">- ${_fmtMoney(data.expense)}</span>
      <span style="color:#888">·</span>
      <span style="color:${netColor};font-weight:800">Líquido: ${net >= 0 ? '+' : ''}${_fmtMoney(net)}</span>
    </div>
    ${cardLines}${fixedLines}
    ${txBlock(incomes,  'Receitas', 'tip-in',  '+ ')}
    ${txBlock(expenses, 'Despesas', 'tip-out', '- ')}
    ${!txs.length && !cardLines && !fixedLines
      ? '<p style="opacity:.5;font-size:.85rem;text-align:center;padding:1rem 0">Nenhuma transação.</p>'
      : ''}`;
}

// ── Open modal ─────────────────────────────────────────────────────────────
function _openModal(dayNum) {
  const data = _calByDay ? _calByDay[dayNum] : null;
  const modal = _getModal();
  const dateStr = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(_calYear, _calMonth, dayNum));
  modal.querySelector('#cal-modal-title').textContent = dateStr;
  modal.querySelector('#cal-modal-body').innerHTML = _buildModalHtml(data);
  modal.classList.add('active');
}

// ── Bind calendar interactions (event delegation) ──────────────────────────
function _bindCalendarInteractions(container) {
  // Clone to flush any stale listeners from previous render
  const fresh = container.cloneNode(true);
  container.parentNode.replaceChild(fresh, container);

  const isTouch = _isTouchDevice();
  let _lastHoveredDay = null;

  if (!isTouch) {
    // --- Tooltip: follows the cursor via mousemove ---
    fresh.addEventListener('mousemove', e => {
      const cell = e.target.closest('[data-day]');
      if (!cell) { _hideTooltip(); _lastHoveredDay = null; return; }

      const day  = Number(cell.dataset.day);
      const data = _calByDay?.[day];
      if (!data || (!data.transactions?.length && !data.cardClose?.length && !data.cardDue?.length && !data.fixedEvents?.length)) {
        _hideTooltip(); _lastHoveredDay = null; return;
      }

      const tip = _getTooltip();

      // Rebuild HTML only when we enter a new day
      if (day !== _lastHoveredDay) {
        tip.innerHTML = _buildTooltipHtml(data);
        _lastHoveredDay = day;
      }

      // Position: centred above cursor (CSS transform: translate(-50%,-110%) handles centering)
      // Use clientX/clientY because tooltip is position:fixed
      tip.style.left = e.clientX + 'px';
      tip.style.top  = (e.clientY - 15) + 'px';
      tip.classList.add('visible');
    });

    fresh.addEventListener('mouseleave', () => {
      _hideTooltip();
      _lastHoveredDay = null;
    });
  }

  // --- Modal / Bottom-sheet: click on any device ---
  fresh.addEventListener('click', e => {
    const cell = e.target.closest('[data-day]');
    if (!cell) return;
    if (isTouch) e.preventDefault(); // prevent ghost hover on mobile
    _hideTooltip();
    _openModal(Number(cell.dataset.day));
  });
}

/** Calendário financeiro: mostra entradas/saídas por dia do mês selecionado */
export function renderHomeFinancialCalendar() {
  const container = document.getElementById('home-financial-calendar');
  const label = document.getElementById('home-cal-month-label');
  if (!container) return;

  const todayStr = new Date();
  const baseDate = new Date(todayStr.getFullYear(), todayStr.getMonth() + (window._homeCalendarMonthOffset || 0), 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const today = new Date();

  if (label) {
    label.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(baseDate);
  }

  // Agrupa transações do mês por dia
  const byDay = {};
  (state.transactions || []).forEach(t => {
    const d = _parseDateBRLocal(t.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = { income: 0, expense: 0, transactions: [] };
      if (!byDay[day].transactions) byDay[day].transactions = [];
      byDay[day].transactions.push(t);
      if (t.value > 0) byDay[day].income  += t.value;
      else             byDay[day].expense += Math.abs(t.value);
    }
  });

  // Eventos de cartão de crédito (fechamento e vencimento)
  (state.cards || []).forEach(card => {
    if (card.cardType !== 'credito') return;
    if (card.closing) {
      const d = Math.min(card.closing, new Date(year, month + 1, 0).getDate());
      if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
      if (!byDay[d].cardClose) byDay[d].cardClose = [];
      byDay[d].cardClose.push(card.name);
    }
    if (card.due) {
      const d = Math.min(card.due, new Date(year, month + 1, 0).getDate());
      if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
      if (!byDay[d].cardDue) byDay[d].cardDue = [];
      byDay[d].cardDue.push(card.name);
    }
  });

  // Eventos de despesas fixas agendadas no mês
  (state.fixedExpenses || []).forEach(f => {
    if (!f.active || !f.day || !f.value) return;
    const d = Math.min(f.day, new Date(year, month + 1, 0).getDate());
    if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
    if (!byDay[d].fixedEvents) byDay[d].fixedEvents = [];
    byDay[d].fixedEvents.push({ name: f.name, isIncome: !!f.isIncome });
  });

  // Dias do mês
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  
  const todayNum = today.getDate();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  let headerHtml = `<div class="fin-cal-header">` +
    weekdays.map(w => `<span>${w}</span>`).join('') + `</div>`;

  let cells = '';
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    let dayNum, isOther = false;
    if (i < firstDay) {
      dayNum  = daysInPrev - firstDay + i + 1;
      isOther = true;
    } else if (i >= firstDay + daysInMonth) {
      dayNum  = i - firstDay - daysInMonth + 1;
      isOther = true;
    } else {
      dayNum = i - firstDay + 1;
    }

    const isToday = isCurrentMonth && !isOther && dayNum === todayNum;
    const data = !isOther ? byDay[dayNum] : null;
    const dayAttr = !isOther ? `data-day="${dayNum}"` : '';

    cells += `<div class="fin-cal-day${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}" ${dayAttr}>
      <span class="fin-cal-day-num">${dayNum}</span>
      ${data && data.income  > 0 ? `<span class="fin-cal-pill-in">+${formatMoneyShort(data.income)}</span>`  : ''}
      ${data && data.expense > 0 ? `<span class="fin-cal-pill-out">-${formatMoneyShort(data.expense)}</span>` : ''}
      ${data?.cardClose?.length  ? `<span class="fin-cal-pill-card-close">✂ Fecha</span>` : ''}
      ${data?.cardDue?.length    ? `<span class="fin-cal-pill-card-due">💳 Vence</span>` : ''}
      ${data?.fixedEvents?.length ? `<span class="fin-cal-pill-fixed">⚡${data.fixedEvents.length}</span>` : ''}
    </div>`;
  }

  container.innerHTML = headerHtml + `<div class="fin-cal-grid">${cells}</div>`;

  // Store for interaction handlers and bind events
  _calByDay  = byDay;
  _calYear   = year;
  _calMonth  = month;
  _bindCalendarInteractions(container);
}

// ══════════════════════════════════════════════════════════
// NEW HOME WIDGETS — Period-aware widgets
// ══════════════════════════════════════════════════════════

const PERIOD_LABELS = {
  this_month:  'Este mês',
  last_month:  'Mês anterior',
  '3_months':  '3 meses',
  '6_months':  '6 meses',
  this_year:   'Este ano'
};

/** Renderiza os pills de filtro de período e bind de cliques */
export function renderPeriodFilter(activeFilter) {
  const container = document.getElementById('home-period-filter');
  if (!container) return;

  container.querySelectorAll('.home-period-pill').forEach(btn => {
    const period = btn.dataset.period;
    if (period === activeFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    // Bind once — avoid duplicating listeners
    if (!btn._periodBound) {
      btn._periodBound = true;
      btn.addEventListener('click', () => {
        state.ui.homeFilter = period;
        import('../state.js').then(m => m.saveState());
        if (window.renderAll) window.renderAll();
      });
    }
  });

  // Update the period chip below the balance
  const chipLabel = document.getElementById('home-period-label-chip');
  if (chipLabel) chipLabel.textContent = PERIOD_LABELS[activeFilter] || 'no período';
}

// Cache last args so the gauge can re-render when target changes
let _lastGaugeArgs = null;

/** Gauge High Fidelity — Medidor de Saúde Financeira */
export function renderHealthGauge(periodData, filter, analytics) {
  _lastGaugeArgs = [periodData, filter, analytics];
  const completedBar  = document.getElementById('gauge-hf-completed-bar');
  const plannedBar    = document.getElementById('gauge-hf-planned-bar');
  const pointerGroup  = document.getElementById('gauge-hf-pointer');
  const valCompleted  = document.getElementById('gauge-hf-val-completed');
  const valPlanned    = document.getElementById('gauge-hf-val-planned');
  const periodLabelEl = document.getElementById('home-gauge-period-label');
  if (!completedBar) return;

  const exp = periodData.expenses || 0;
  const inc = Math.max(periodData.incomes || 0, 0.01);
  const riskRatio = clamp((exp / inc) * 100, 0, 100);

  // healthScore: 100 = perfeito (sem gastos), 0 = gasto total da renda
  const healthScore = Math.round(clamp(100 - riskRatio, 0, 100));
  // Meta: lida do input editável; padrão 70
  const targetInput = document.getElementById('gauge-target-edit');
  const TARGET_HEALTH = targetInput ? (parseInt(targetInput.value) || 70) : 70;

  const circumference = Math.PI * 80; // ~251.32

  const pCompleted = healthScore / 100;
  const pPlanned   = TARGET_HEALTH / 100;

  completedBar.style.strokeDashoffset = String(circumference - pCompleted * circumference);
  plannedBar.style.strokeDashoffset   = String(circumference - pPlanned   * circumference);

  const pointerAngle = pPlanned * 180;
  if (pointerGroup) pointerGroup.style.transform = `rotate(${pointerAngle}deg)`;

  if (valPlanned) valPlanned.textContent = `/${TARGET_HEALTH}`;

  // Animação do número
  if (valCompleted) {
    const start = parseInt(valCompleted.textContent) || 0;
    const end   = healthScore;
    let startTs = null;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / 1500, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      valCompleted.textContent = Math.floor(ease * (end - start) + start);
      if (p < 1) requestAnimationFrame(step);
      else valCompleted.textContent = end;
    };
    requestAnimationFrame(step);
  }

  if (periodLabelEl) periodLabelEl.textContent = PERIOD_LABELS[filter] || 'Período';

  // Breakdown bars
  const total = Math.max(periodData.incomes, periodData.expenses, 1);
  const set     = (id, val) => { const e = document.getElementById(id); if (e) e.style.width = `${clamp((val/total)*100, 0, 100)}%`; };
  const setText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = formatMoneyShort(val); };

  set('gauge-variable-bar', periodData.variableExpenses);
  set('gauge-fixed-bar',    periodData.fixedCosts);
  set('gauge-surplus-bar',  periodData.surplus);
  setText('gauge-variable-val', periodData.variableExpenses);
  setText('gauge-fixed-val',    periodData.fixedCosts);
  setText('gauge-surplus-val',  periodData.surplus);

  // KPIs legados (ocultos, mantidos para compatibilidade)
  const el = id => document.getElementById(id);
  if (el('gauge-kpi-expenses')) el('gauge-kpi-expenses').textContent = formatMoneyShort(periodData.expenses);
  if (el('gauge-kpi-incomes'))  el('gauge-kpi-incomes').textContent  = formatMoneyShort(periodData.incomes);
  if (el('gauge-kpi-fixed'))    el('gauge-kpi-fixed').textContent    = formatMoneyShort(periodData.fixedCosts);
  const netEl = el('gauge-kpi-net');
  if (netEl) {
    netEl.textContent = formatMoneyShort(periodData.net);
    netEl.className = `text-sm font-black mt-0.5 ${periodData.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
  }
}

let _categoryDonutChart = null;

let _incomeSourceChart = null;

/** Gráfico de rosca — Fonte de Renda por categoria */
export function renderIncomeSource(periodData) {
  const container = document.getElementById('home-income-source');
  if (!container) return;

  // Collect income transactions by category
  const filter = window.state?.ui?.homeFilter || 'this_month';
  const { start, end } = (window._getPeriodRange || (() => ({ start: new Date(0), end: new Date() })))(filter);

  // Use the categories from incomes in the current period
  const incomeItems = (window.state?.transactions || []).filter(t => {
    if (t.value <= 0) return false;
    // check period via periodData already filtered
    return true; // periodData already has the right txns — we derive from it
  });

  // Build income-category map from periodData transactions (use all incomes in periodData)
  const incomeCatMap = {};
  const total = periodData.incomes || 0;

  // periodData doesn't expose raw txns, so re-derive from global state
  try {
    const { calculateAnalyticsForPeriod } = window.__analyticsEngine__ || {};
    // fallback: use categories from state directly for the period
  } catch (e) {}

  // Safe: derive from state.transactions filtered by same period logic in periodData
  const txs = window.state?.transactions || [];
  const pd = periodData.period || {};
  const pStart = pd.start ? new Date(pd.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const pEnd   = pd.end   ? new Date(pd.end)   : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  txs.forEach(t => {
    if (t.value <= 0) return;
    const parts = (t.date || '').split('/');
    const d = parts.length === 3 ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : null;
    if (!d || d < pStart || d > pEnd) return;
    const cat = t.cat || 'Outros';
    incomeCatMap[cat] = (incomeCatMap[cat] || 0) + t.value;
  });

  const cats = Object.entries(incomeCatMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const grandTotal = cats.reduce((s, c) => s + c[1], 0);

  if (!cats.length) {
    if (_incomeSourceChart) { _incomeSourceChart.destroy(); _incomeSourceChart = null; }
    container.innerHTML = '<p class="text-xs text-white/25 text-center py-6">Sem entradas no período</p>';
    return;
  }

  const bgColors = ['#34d399', '#00f5ff', '#a855f7', '#facc15', '#38bdf8', '#fb7185', '#f97316'];

  if (!document.getElementById('home-income-donut')) {
    container.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-center">
          <div class="relative" style="width:140px;height:140px">
            <canvas id="home-income-donut"></canvas>
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-[9px] text-white/35 uppercase tracking-widest leading-none mb-1">Total</span>
              <span class="text-base font-black text-white leading-none" id="home-income-total"></span>
            </div>
          </div>
        </div>
        <div class="space-y-2" id="home-income-legend"></div>
      </div>
    `;
  }

  const totalEl = document.getElementById('home-income-total');
  if (totalEl) totalEl.textContent = formatMoneyShort(grandTotal);

  const canvas = document.getElementById('home-income-donut');
  const legend = document.getElementById('home-income-legend');
  if (!canvas || !window.Chart) return;

  if (_incomeSourceChart) { _incomeSourceChart.destroy(); _incomeSourceChart = null; }

  _incomeSourceChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c[0]),
      datasets: [{
        data: cats.map(c => c[1]),
        backgroundColor: bgColors.slice(0, cats.length),
        borderWidth: 0,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(6,9,17,.92)',
          borderColor: 'rgba(255,255,255,.08)',
          borderWidth: 1,
          padding: 10,
          callbacks: { label: ctx => ` ${ctx.label}: ${formatMoney(ctx.raw)}` }
        }
      }
    }
  });

  if (legend) {
    legend.innerHTML = cats.map((cat, i) => {
      const pct = grandTotal > 0 ? ((cat[1] / grandTotal) * 100).toFixed(0) : 0;
      const color = bgColors[i % bgColors.length];
      return `
        <div class="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${color}"></span>
            <span class="text-white/75 truncate max-w-[100px]" title="${escapeHtml(cat[0] || '')}">${escapeHtml(cat[0] || '')}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-white font-bold">${formatMoneyShort(cat[1])}</span>
            <span class="text-[10px] text-white/35 w-7 text-right">${pct}%</span>
          </div>
        </div>`;
    }).join('');
  }
}


/** Gastos por categoria — gráfico de rosca avançado */
export function renderCategoryBars(periodData) {
  const container = document.getElementById('home-category-bars');
  if (!container) return;

  const cats = (periodData.categories || []).slice(0, 8);
  if (!cats.length) {
    if (_categoryDonutChart) { _categoryDonutChart.destroy(); _categoryDonutChart = null; }
    container.innerHTML = '<div class="text-xs text-white/30 text-center py-4">Sem transações no período</div>';
    return;
  }

  // Injeta canvas e legenda
  if (!document.getElementById('home-category-donut')) {
    container.innerHTML = `
      <div class="flex flex-col md:flex-row items-center gap-8">
        <div class="relative w-48 h-48 shrink-0">
          <canvas id="home-category-donut"></canvas>
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="text-[10px] text-white/40 uppercase tracking-widest leading-none mb-1.5">Total</span>
            <span class="text-xl font-black text-white leading-none" id="home-category-total">${formatMoneyShort(periodData.expenses)}</span>
          </div>
        </div>
        <div class="flex-1 w-full flex flex-col gap-3" id="home-category-legend"></div>
      </div>
    `;
  } else {
    const totalEl = document.getElementById('home-category-total');
    if (totalEl) totalEl.textContent = formatMoneyShort(periodData.expenses);
  }

  const canvas = document.getElementById('home-category-donut');
  const legend = document.getElementById('home-category-legend');
  if (!canvas || !window.Chart) return;

  const bgColors = ['#a855f7', '#00f5ff', '#34d399', '#facc15', '#f97316', '#fb7185', '#38bdf8', '#818cf8'];

  const labels = cats.map(c => c[0]);
  const data = cats.map(c => c[1]);
  const bg = cats.map((_, i) => bgColors[i % bgColors.length]);

  if (_categoryDonutChart) {
    _categoryDonutChart.destroy();
  }

  _categoryDonutChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bg,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(6,9,17,.92)',
          borderColor: 'rgba(255,255,255,.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
          }
        }
      }
    }
  });

  legend.innerHTML = cats.map((cat, i) => {
    const val = cat[1];
    const pct = periodData.expenses > 0 ? (val / periodData.expenses) * 100 : 0;
    const color = bgColors[i % bgColors.length];
    const budget = window.state?.budgets?.[cat[0]] || 0;
    const overBudget = budget > 0 && val > budget;
    return `
      <div class="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
        <div class="flex items-center gap-3">
          <span class="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]" style="background:${color}"></span>
          <span class="text-white/85 font-medium truncate w-24" title="${escapeHtml(cat[0] || '')}">${escapeHtml(cat[0] || '')}</span>
          ${overBudget ? '<span class="text-[9px] font-bold text-rose-300 border border-rose-400/30 bg-rose-400/10 rounded-full px-1.5 py-0.5">⚠ Limite</span>' : ''}
        </div>
        <div class="flex items-center gap-3">
          <span class="text-white font-bold">${formatMoneyShort(val)}</span>
          <span class="text-[10px] text-white/40 w-8 text-right font-medium">${Math.round(pct)}%</span>
        </div>
      </div>
    `;
  }).join('');
}

/** Comparativo de Desempenho — 4 cards período atual vs anterior */
export function renderPerformanceComparison(periodData) {
  const container = document.getElementById('home-comparison-cards');
  if (!container) return;

  const cards = [
    { label: 'Receitas',      icon: 'fa-arrow-trend-up',   accentClass: 'cc-green',  iconBg: 'rgba(52,211,153,.15)',  iconColor: '#34d399', data: periodData.comparison?.incomes,   format: formatMoneyShort, positive: v => v >= 0 },
    { label: 'Gastos',        icon: 'fa-arrow-trend-down', accentClass: 'cc-red',    iconBg: 'rgba(251,113,133,.15)', iconColor: '#fb7185', data: periodData.comparison?.expenses,  format: formatMoneyShort, positive: v => v <= 0 },
    { label: 'Saldo Líquido', icon: 'fa-scale-balanced',   accentClass: 'cc-cyan',   iconBg: 'rgba(0,245,255,.12)',   iconColor: '#00f5ff', data: periodData.comparison?.net,       format: formatMoneyShort, positive: v => v >= 0 },
    { label: 'Ticket Médio',  icon: 'fa-receipt',          accentClass: 'cc-violet', iconBg: 'rgba(168,85,247,.15)', iconColor: '#c084fc', data: periodData.comparison?.avgTicket, format: formatMoneyShort, positive: v => v <= 0 }
  ];

  container.innerHTML = cards.map(card => {
    const d = card.data;
    const current  = d?.current  ?? 0;
    const previous = d?.previous ?? 0;
    const pct      = d?.pct;
    const hasPrev  = previous > 0;
    const isPositive = pct !== null && card.positive(pct);
    const chipHtml = hasPrev && pct !== null
      ? `<span class="text-[10px] font-bold rounded-full px-2 py-0.5 border ${isPositive ? 'bg-emerald-400/12 text-emerald-300 border-emerald-400/25' : 'bg-rose-400/12 text-rose-300 border-rose-400/25'}">${isPositive ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%</span>`
      : `<span class="text-[10px] font-semibold text-white/25 rounded-full px-2 py-0.5 border border-white/8">—</span>`;
    const valueColor = current >= 0 ? 'text-white' : 'text-rose-300';
    return `
      <div class="compare-card ${card.accentClass}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="pay-icon-badge" style="background:${card.iconBg}">
              <i class="fa-solid ${card.icon} text-xs" style="color:${card.iconColor}"></i>
            </span>
            <span class="text-[10px] uppercase tracking-widest text-white/45 font-bold">${card.label}</span>
          </div>
          ${chipHtml}
        </div>
        <p class="text-xl font-black ${valueColor} leading-tight sensitive-value">${card.format(current)}</p>
        <p class="text-[10px] ${hasPrev ? 'text-white/32' : 'text-white/18'} sensitive-value">${hasPrev ? `Anterior: ${card.format(previous)}` : 'Sem dados anteriores'}</p>
      </div>`;
  }).join('');
}

/** Método de Pagamento — entradas e saídas por método */
export function renderPaymentMethods(periodData) {
  const incEl = document.getElementById('home-payment-incomes');
  const expEl = document.getElementById('home-payment-expenses');
  if (!incEl || !expEl) return;

  const { incomes, expenses, totalIn, totalOut } = periodData.paymentStats || { incomes: [], expenses: [], totalIn: 0, totalOut: 0 };

  const methodColors = {
    'pix':           '#00f5ff',
    'credito':       '#a855f7',
    'debito':        '#facc15',
    'dinheiro':      '#34d399',
    'transferencia': '#38bdf8',
    'boleto':        '#fb7185',
    'conta':         '#94a3b8',
  };

  function renderMethodList(list, total, emptyMsg) {
    if (!list.length) return `<p class="text-xs text-white/25 text-center py-3">${emptyMsg}</p>`;
    return list.map(m => {
      const color = methodColors[m.key] || '#9ca3af';
      return `
        <div class="payment-method-row">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg flex items-center justify-center" style="background:${color}22;border:1px solid ${color}44">
                <i class="fa-solid ${m.icon} text-[10px]" style="color:${color}"></i>
              </span>
              <span class="text-xs font-semibold text-white/80">${m.label}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-white/70">${formatMoneyShort(m.value)}</span>
              <span class="text-[10px] text-white/35 min-w-[32px] text-right">${formatPercent(m.pct, 0)}</span>
            </div>
          </div>
          <div class="progress-track" style="height:5px">
            <div class="progress-fill" style="width:${clamp(m.pct, 0, 100)}%;background:linear-gradient(90deg,${color},${color}88);transition:width .5s ease"></div>
          </div>
        </div>`;
    }).join('');
  }

  incEl.innerHTML = renderMethodList(incomes, totalIn,  'Sem entradas no período');
  expEl.innerHTML = renderMethodList(expenses, totalOut, 'Sem saídas no período');
}



// Inline script moved from app.html
(function initFinancialCalendar() {

    /* ── [FIX] Lê transações reais do state da aplicação ── */
    function getRealTransactions() {
      return (window.appState && Array.isArray(window.appState.transactions))
        ? window.appState.transactions
        : [];
    }

    /* ── Agrupa transações por data (YYYY-MM-DD) ── */
    /* Transações no state usam formato "DD/MM/YYYY" → convertemos aqui */
    function buildDayMap(transactions) {
      const map = {};
      transactions.forEach(tx => {
        if (!tx.date) return;
        let key = tx.date;
        // Converte "DD/MM/YYYY" → "YYYY-MM-DD"
        if (tx.date.includes('/')) {
          const parts = tx.date.split('/');
          if (parts.length === 3) key = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (!map[key]) map[key] = { entrada: 0, saida: 0 };
        const v = Math.abs(tx.value ?? tx.amount ?? tx.valor ?? 0);
        const isIncome = tx.value > 0 || tx.tipo === 'entrada';
        if (isIncome) map[key].entrada += v;
        else           map[key].saida  += v;
      });
      return map;
    }

    /* ── Formata moeda compacta (R$ 1.200 → "1,2k") ── */
    function fmtCompact(val) {
      if (val >= 1000) return 'R$ ' + (val/1000).toFixed(1).replace('.',',') + 'k';
      return 'R$ ' + val.toFixed(2).replace('.',',');
    }

    /* ── Renderiza o grid do calendário ── */
    function renderCalendar(year, month) {
      const grid  = document.getElementById('fin-cal-grid');
      const label = document.getElementById('fin-cal-month-label');
      if (!grid || !label) return;

      const today = new Date();
      const firstDay = new Date(year, month, 1);
      const lastDay  = new Date(year, month + 1, 0);
      const startDow = firstDay.getDay(); // 0 = Dom
      const daysInMonth = lastDay.getDate();

      // Rótulo
      const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                          'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      label.textContent = `${monthNames[month]} ${year}`;

      // [FIX] Usa transações reais do state em vez de dados mock
      const dayMap = buildDayMap(getRealTransactions());

      grid.innerHTML = '';

      // Dias do mês anterior (fill start)
      const prevLastDay = new Date(year, month, 0).getDate();
      for (let i = startDow - 1; i >= 0; i--) {
        const d = prevLastDay - i;
        const cell = document.createElement('div');
        cell.className = 'fin-cal-day other-month';
        cell.innerHTML = `<span class="fin-cal-day-num">${d}</span>`;
        grid.appendChild(cell);
      }

      // Dias do mês atual
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const key = `${year}-${mm}-${dd}`;
        const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());

        const cell = document.createElement('div');
        cell.className = 'fin-cal-day' + (isToday ? ' today' : '');

        let html = `<span class="fin-cal-day-num">${d}</span>`;

        if (dayMap[key]) {
          const { entrada, saida } = dayMap[key];
          if (entrada > 0) {
            html += `<span class="fin-cal-tag fin-cal-tag--in">+${fmtCompact(entrada)}</span>`;
          }
          if (saida > 0) {
            html += `<span class="fin-cal-tag fin-cal-tag--out">-${fmtCompact(saida)}</span>`;
          }
        }

        cell.innerHTML = html;
        grid.appendChild(cell);
      }

      // Dias do próximo mês (fill end — até completar 6 linhas se necessário)
      const totalCells = grid.children.length;
      const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let d = 1; d <= remaining; d++) {
        const cell = document.createElement('div');
        cell.className = 'fin-cal-day other-month';
        cell.innerHTML = `<span class="fin-cal-day-num">${d}</span>`;
        grid.appendChild(cell);
      }
    }

    /* ── Estado e event listeners ── */
    function setup() {
      const prevBtn = document.getElementById('fin-cal-prev');
      const nextBtn = document.getElementById('fin-cal-next');
      if (!prevBtn || !nextBtn) return;

      const now = new Date();
      let curYear  = now.getFullYear();
      let curMonth = now.getMonth();

      renderCalendar(curYear, curMonth);

      // [FIX] Expõe a função para que o renderAll do app refresque o calendário
      // ao salvar/editar transações sem precisar navegar de aba
      window.finCalRender = () => renderCalendar(curYear, curMonth);

      prevBtn.addEventListener('click', () => {
        curMonth--;
        if (curMonth < 0) { curMonth = 11; curYear--; }
        renderCalendar(curYear, curMonth);
      });

      nextBtn.addEventListener('click', () => {
        curMonth++;
        if (curMonth > 11) { curMonth = 0; curYear++; }
        renderCalendar(curYear, curMonth);
      });
    }

    if (document.getElementById('fin-cal-grid')) {
      setup();
    } else {
      const obs = new MutationObserver(() => {
        if (document.getElementById('fin-cal-grid')) { obs.disconnect(); setup(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

  })();