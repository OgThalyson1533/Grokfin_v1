/**
 * js/ui/goals-ui.js
 * Lógica de metas, temas, aportes e modais.
 */

import { state, saveState } from '../state.js';
import { uid } from '../utils/math.js';
import { formatMoney, formatPercent, escapeHtml, richText, parseCurrencyInput } from '../utils/format.js';
import { addMonths, formatDateBR } from '../utils/date.js';
import { getGoalProgress, getMonthlyNeed } from '../analytics/engine.js';
import { showToast, normalizeText } from '../utils/dom.js';

/* --- Goal Themes Catalog --- */
export const GOAL_THEME_CATALOG = {
  generic: { label: 'Objetivo', img: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1200&auto=format&fit=crop' },
  home: { label: 'Casa', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop' },
  travel: { label: 'Viagem', img: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=1200&auto=format&fit=crop' },
  vehicle: { label: 'Veículo', img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=1200&auto=format&fit=crop' },
  reserve: { label: 'Reserva', img: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?q=80&w=1200&auto=format&fit=crop' },
  game: { label: 'Games', img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop' },
  tech: { label: 'Tecnologia', img: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1200&auto=format&fit=crop' },
  education: { label: 'Educação', img: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200&auto=format&fit=crop' },
  celebration: { label: 'Celebração', img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1200&auto=format&fit=crop' },
  bike: { label: 'Mobilidade', img: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=1200&auto=format&fit=crop' }
};

export const GOAL_THEME_RULES = [
  { theme: 'game', keys: ['videogame', 'video game', 'video-game', 'game', 'gamer', 'console', 'ps5', 'playstation', 'xbox', 'nintendo', 'switch'] },
  { theme: 'home', keys: ['casa', 'imovel', 'imóvel', 'apto', 'apartamento', 'condominio', 'condomínio'] },
  { theme: 'travel', keys: ['japao', 'japão', 'viagem', 'praia', 'rio', 'fortaleza', 'europa', 'ferias', 'férias', 'intercambio', 'intercâmbio'] },
  { theme: 'vehicle', keys: ['carro', 'moto', 'veiculo', 'veículo'] },
  { theme: 'reserve', keys: ['reserva', 'emergencia', 'emergência', 'seguranca', 'segurança'] },
  { theme: 'tech', keys: ['pc', 'notebook', 'setup', 'studio', 'escritorio', 'escritório', 'macbook', 'iphone', 'celular', 'tablet', 'camera', 'câmera'] },
  { theme: 'education', keys: ['faculdade', 'curso', 'mba', 'pos', 'pós', 'idioma', 'certificacao', 'certificação', 'estudo', 'educacao', 'educação'] },
  { theme: 'celebration', keys: ['casamento', 'festa', 'aniversario', 'aniversário', 'lua de mel', 'evento'] },
  { theme: 'bike', keys: ['bike', 'bicicleta', 'ciclismo'] }
];

export function detectGoalTheme(name = '', explicitTheme = 'auto') {
  if (explicitTheme && explicitTheme !== 'auto' && GOAL_THEME_CATALOG[explicitTheme]) {
    return explicitTheme;
  }
  const normalized = normalizeText(name);
  const rule = GOAL_THEME_RULES.find(item => item.keys.some(key => normalized.includes(normalizeText(key))));
  return rule?.theme || 'generic';
}

export function getGoalThemeLabel(theme = 'generic') {
  return GOAL_THEME_CATALOG[theme]?.label || GOAL_THEME_CATALOG.generic.label;
}

export function pickGoalImage(name, explicitTheme = 'auto') {
  const theme = detectGoalTheme(name, explicitTheme);
  return GOAL_THEME_CATALOG[theme]?.img || GOAL_THEME_CATALOG.generic.img;
}

export function estimateGoalTarget(name, explicitTheme = 'auto') {
  const theme = detectGoalTheme(name, explicitTheme);
  const map = { reserve: 30000, home: 90000, vehicle: 65000, travel: 18000, game: 4500, tech: 9000, education: 15000, celebration: 20000, bike: 6500 };
  return map[theme] || 18000;
}

export function estimateGoalDeadline(name, explicitTheme = 'auto') {
  const normalized = normalizeText(name);
  const explicitYear = normalized.match(/20\d{2}/);
  if (explicitYear) return new Date(Number(explicitYear[0]), 11, 1).toISOString();
  const theme = detectGoalTheme(name, explicitTheme);
  const mapMonths = { reserve: 6, travel: 12, home: 24, vehicle: 18, education: 14 };
  return addMonths(new Date(), mapMonths[theme] || 10).toISOString();
}

export function formatMonthYear(dateIso) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(dateIso));
}

let _editingGoalId = null;
let _goalToDelete = null;

export function renderGoals(analytics) {
  const goalsContainer = document.getElementById('goals-container');
  const overviewContainer = document.getElementById('goals-overview');
  if (!goalsContainer || !overviewContainer) return;

  const totalSaved = state.goals.reduce((acc, goal) => acc + goal.atual, 0);
  const avgProgress = analytics.goalsProgress || 0;
  const monthlyNeedTotal = state.goals.reduce((acc, goal) => acc + getMonthlyNeed(goal), 0);

  overviewContainer.innerHTML = `
    <div class="glass-panel rounded-3xl p-5">
      <p class="text-xs font-bold uppercase tracking-[.18em] text-white/32">Guardado em metas</p>
      <p class="mt-3 text-3xl font-black text-white">${formatMoney(totalSaved)}</p>
    </div>
    <div class="glass-panel rounded-3xl p-5">
      <p class="text-xs font-bold uppercase tracking-[.18em] text-white/32">Aporte mensal sugerido</p>
      <p class="mt-3 text-3xl font-black text-cyan-200">${formatMoney(monthlyNeedTotal)}</p>
    </div>
    <div class="glass-panel rounded-3xl p-5">
      <p class="text-xs font-bold uppercase tracking-[.18em] text-white/32">Progresso médio</p>
      <p class="mt-3 text-3xl font-black text-emerald-300">${formatPercent(avgProgress, 0)}</p>
    </div>
  `;

  goalsContainer.innerHTML = state.goals.length
    ? state.goals.map(goal => {
        // Normalise field names (support both local keys and Supabase-mapped keys)
        goal = {
          ...goal,
          nome: goal.nome ?? goal.name ?? 'Meta',
          atual: Number(goal.atual ?? goal.current ?? 0),
          total: Number(goal.total ?? goal.target ?? 0),
        };
        const progress = getGoalProgress(goal);
        const monthlyNeed = getMonthlyNeed(goal);
        const remaining = Math.max(0, goal.total - goal.atual);
        const contribution = Math.max(0, Math.min(monthlyNeed || remaining, remaining, Math.max(state.balance - 800, 0) || Math.min(state.balance, remaining)));
        const statusClass = progress >= 80 ? 'status-up' : progress >= 45 ? 'status-neutral' : 'status-down';
        const theme = detectGoalTheme(goal.nome, goal.theme || 'auto');
        const themeLabel = getGoalThemeLabel(theme);
        const goalImage = goal.customImage || pickGoalImage(goal.nome, goal.theme || theme);

        let smartTip = '';
        if (progress >= 100) {
          smartTip = '<i class="fa-solid fa-trophy text-emerald-300"></i> Meta atingida! Considere investir o valor ou iniciar um novo objetivo.';
        } else if (contribution > 0 && contribution < monthlyNeed) {
          const shortage = monthlyNeed - contribution;
          smartTip = `<i class="fa-solid fa-arrow-trend-up text-fuchsia-300"></i> Aporte sugerido de ${formatMoney(monthlyNeed)}. Faltam ${formatMoney(shortage)} este mês para manter o prazo.`;
        } else if (contribution >= monthlyNeed && monthlyNeed > 0) {
          smartTip = '<i class="fa-solid fa-fire text-orange-400"></i> No ritmo perfeito! Você está cobrindo o aporte mensal necessário.';
        } else {
          smartTip = '<i class="fa-solid fa-lightbulb text-cyan-300"></i> Qualquer valor poupado agora acelera o seu prazo original.';
        }

        return `
          <article class="goal-card group glass-panel card-hover relative isolate min-h-[24rem] flex flex-col overflow-hidden rounded-[30px] p-6 sm:p-7">
            <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-70" style="background-image:url('${goalImage}')"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-[#060911]/72 via-[#060911]/45 to-transparent z-0"></div>
            
            <div class="relative z-10 flex h-full flex-col">
              <div class="flex items-start justify-between gap-3 mb-auto">
                <div class="flex flex-wrap gap-2">
                  <span class="pill ${statusClass}">${progress}% concluída</span>
                  <span class="pill tone-slate"><i class="fa-solid fa-image text-cyan-300"></i> ${escapeHtml(themeLabel)}</span>
                </div>
                <span class="pill shrink-0 whitespace-nowrap">${escapeHtml(formatMonthYear(goal.deadline))}</span>
              </div>

              <div class="mt-6 flex flex-col gap-5">
                <div>
                  <h4 class="text-2xl font-black text-white leading-tight">${escapeHtml(goal.nome)}</h4>
                  <p class="mt-2 text-sm font-medium text-white/70">Alvo ${formatMoney(goal.total)} <span class="mx-1">•</span> Faltam ${formatMoney(remaining)}</p>
                </div>

                <div>
                  <div class="mb-2 flex items-center justify-between text-sm">
                    <span class="font-semibold text-white/80"><span class="text-white">${formatMoney(goal.atual)}</span> guardados</span>
                    <strong class="text-white bg-white/10 px-2 py-0.5 rounded-md">${progress}%</strong>
                  </div>
                  <div class="progress-track h-2.5 bg-black/40 border border-white/5"><div class="progress-fill shadow-[0_0_10px_rgba(0,245,255,0.4)]" style="width:${progress}%"></div></div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
                    <p class="text-[10px] sm:text-xs uppercase tracking-[.15em] text-white/40 font-bold">Aporte ideal</p>
                    <p class="mt-1.5 text-lg font-black text-cyan-300">${formatMoney(monthlyNeed)}</p>
                  </div>
                  <div class="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
                    <p class="text-[10px] sm:text-xs uppercase tracking-[.15em] text-white/40 font-bold">Prazo</p>
                    <p class="mt-1.5 text-lg font-black text-white">${escapeHtml(formatMonthYear(goal.deadline))}</p>
                  </div>
                </div>

                <!-- Smart Intelligence Box -->
                <div class="rounded-xl bg-gradient-to-r from-white/5 to-transparent border-l-2 border-cyan-400 p-3 text-[13px] leading-relaxed text-white/75 font-medium shadow-inner">
                  ${smartTip}
                </div>

                <div class="mt-2 flex flex-wrap gap-2 sm:gap-3 items-center">
                  ${contribution > 0 ? `
                    <div class="flex-1 min-w-[160px] flex items-stretch rounded-2xl bg-black/40 border border-white/20 p-1 focus-within:border-cyan-400/50 transition-colors shadow-inner">
                      <div class="flex items-center pl-3">
                         <span class="text-xs font-bold text-white/40 mr-1">R$</span>
                         <input id="goal-invest-${goal.id}" type="text" inputmode="decimal" class="w-full bg-transparent text-sm font-black text-white outline-none placeholder-white/20" value="${contribution.toFixed(2).replace('.', ',')}" />
                      </div>
                      <button data-goal-contribute="${goal.id}" class="rounded-xl shrink-0 bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2 text-xs font-black tracking-wide text-black shadow-[0_0_12px_rgba(0,245,255,0.2)] transition-transform hover:scale-[1.02] active:scale-95">
                        NOVO APORTE
                      </button>
                    </div>
                  ` : `
                    <button class="flex-1 min-w-[120px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 sm:py-3.5 text-sm font-black text-white/40 pointer-events-none">
                      ✅ Meta Concluída
                    </button>
                  `}
                  <button data-goal-brief="${goal.id}" class="shrink-0 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 w-12 h-11 sm:h-12 text-white transition-colors hover:bg-white/15" title="Ler com IA">
                    <i class="fa-solid fa-robot"></i>
                  </button>
                  <button onclick="openEditGoal('${goal.id}')" class="shrink-0 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 w-12 h-11 sm:h-12 text-white transition-colors hover:bg-white/15" title="Editar meta">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button onclick="confirmDeleteGoal('${goal.id}')" class="shrink-0 flex items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 w-12 h-11 sm:h-12 text-rose-400 transition-colors hover:bg-rose-500/20" title="Excluir meta">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join('')
    : `
      <div class="glass-panel col-span-full rounded-[28px] p-10 text-center text-white/55">
        Ainda não existem metas cadastradas.
      </div>
    `;
}

export function openAddGoal() {
  _editingGoalId = null;
  document.getElementById('goal-modal-title').textContent = 'Nova Meta';
  document.getElementById('goal-modal-name').value = '';
  document.getElementById('goal-modal-total').value = '';
  document.getElementById('goal-modal-atual').value = '';
  document.getElementById('goal-modal-theme').value = 'auto';
  
  // Set default deadline to 1 year from now
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  document.getElementById('goal-modal-deadline').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  document.getElementById('goal-modal-error')?.classList.add('hidden');
  document.getElementById('goal-modal-overlay')?.classList.remove('hidden');
}

export function applyGoalContribution(goalId, amount, options = {}) {
  const goal = state.goals.find(item => item.id === goalId);
  if (!goal) return { ok: false, message: 'Meta não encontrada.' };

  const remaining = Math.max(0, goal.total - goal.atual);
  if (remaining <= 0) return { ok: false, message: 'Já concluída.' };

  const liquidAvailable = state.balance > 1500 ? state.balance - 800 : state.balance;
  const applied = Math.min(Number(amount) || getMonthlyNeed(goal), remaining, liquidAvailable);
  
  if (applied <= 0) return { ok: false, message: 'Saldo insuficiente.' };

  goal.atual = Number((goal.atual + applied).toFixed(2));
  state.balance = Number((state.balance - applied).toFixed(2));
  state.transactions.unshift({
    id: uid('tx'),
    date: formatDateBR(new Date()),
    desc: `Aporte meta: ${goal.nome}`,
    cat: 'Metas',
    value: -applied
  });
  
  saveState();
  if (options.notify !== false) showToast(`Aporte de ${formatMoney(applied)} aplicado.`, 'success');
  if (window.appRenderAll) window.appRenderAll();

  return { ok: true, message: `Apliquei ${formatMoney(applied)} em ${goal.nome}.` };
}

export function openEditGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  _editingGoalId = id;
  
  document.getElementById('goal-modal-title').textContent = 'Editar Meta';
  document.getElementById('goal-modal-name').value = goal.nome;
  // [FIX #2] IDs corretos conforme o HTML: goal-modal-total e goal-modal-atual
  document.getElementById('goal-modal-total').value = goal.total.toFixed(2).replace('.', ',');
  document.getElementById('goal-modal-atual').value = goal.atual.toFixed(2).replace('.', ',');
  document.getElementById('goal-modal-theme').value = goal.theme || 'auto';
  
  const d = goal.deadline ? new Date(goal.deadline) : addMonths(new Date(), 12);
  const safeDate = Number.isNaN(d.getTime()) ? addMonths(new Date(), 12) : d;
  document.getElementById('goal-modal-deadline').value = `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')}`;
  
  // Sem campo customimg no HTML — ignorado
  document.getElementById('goal-modal-error')?.classList.add('hidden');
  document.getElementById('goal-modal-overlay')?.classList.remove('hidden');
}

export function confirmDeleteGoal(id) {
  _goalToDelete = id;
  document.getElementById('goal-delete-overlay')?.classList.remove('hidden');
}

export function deleteGoal() {
  if (!_goalToDelete) return;
  const goal = state.goals.find(g => g.id === _goalToDelete);
  if (goal) {
    state.balance += goal.atual;
    state.transactions.unshift({
      id: uid('tx'),
      date: formatDateBR(new Date()),
      desc: `Resgate meta: ${goal.nome}`,
      cat: 'Metas',
      value: goal.atual
    });
  }

  // [FIX] Metas excluídas localmente voltavam no próximo syncFromSupabase
  const goalIdToDelete = _goalToDelete;
  import('../services/supabase.js').then(({ supabase, isSupabaseConfigured }) => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.from('goals').delete().eq('id', goalIdToDelete)
      .catch(e => console.error('[Goals] Falha ao deletar meta remota:', e));
  });

  state.goals = state.goals.filter(g => g.id !== _goalToDelete);
  _goalToDelete = null;
  saveState();
  document.getElementById('goal-delete-overlay')?.classList.add('hidden');
  showToast('Meta excluída e valor devolvido.', 'info');
  if (window.appRenderAll) window.appRenderAll();
}

export function saveGoalModal() {
  const name = document.getElementById('goal-modal-name').value.trim();
  const targetInputVal = document.getElementById('goal-modal-total').value;
  let target = parseCurrencyInput(targetInputVal);
  const current = parseCurrencyInput(document.getElementById('goal-modal-atual').value) || 0;
  const deadlineStr = document.getElementById('goal-modal-deadline').value;
  const themeInput = document.getElementById('goal-modal-theme').value;
  const errEl = document.getElementById('goal-modal-error');

  if (!name) {
    errEl.textContent = 'Preencha o nome da meta.';
    errEl.classList.remove('hidden');
    return;
  }

  // Preenchimento inteligente se o alvo não foi informado ou for 0
  const resolvedTheme = detectGoalTheme(name, themeInput);
  if (!target) {
     target = estimateGoalTarget(name, resolvedTheme);
  }
  
  // Se ainda for inválido
  if (!target) {
     errEl.textContent = 'Preencha o valor alvo válido.';
     errEl.classList.remove('hidden');
     return;
  }

  let deadline = deadlineStr ? new Date(deadlineStr + 'T12:00:00Z').toISOString() : estimateGoalDeadline(name, resolvedTheme);

  if (_editingGoalId) {
    const idx = state.goals.findIndex(g => g.id === _editingGoalId);
    if (idx >= 0) {
      const g = state.goals[idx];
      const diff = current - g.atual;
      if (diff > 0 && state.balance < diff) {
        errEl.textContent = 'Saldo insuficiente para atualizar o valor guardado.';
        errEl.classList.remove('hidden');
        return;
      }
      state.balance -= diff;
      
      state.goals[idx] = { 
        ...g, nome: name, total: target, atual: current, deadline, 
        theme: resolvedTheme
      };
      
      // Atualizar img se mudou o tema
      state.goals[idx].img = pickGoalImage(name, themeInput);
      
      saveState();
      showToast('Meta atualizada com sucesso.', 'success');
    }
  } else {
    // Modo de criação de nova meta
    const goal = {
      id: uid('goal'),
      nome: name,
      atual: current,
      total: target,
      theme: resolvedTheme,
      img: pickGoalImage(name, themeInput),
      deadline: deadline
    };
    
    // Se a meta já começar com saldo guardado
    if (current > 0) {
      if (state.balance < current) {
        errEl.textContent = 'Saldo insuficiente para o valor inicial guardado.';
        errEl.classList.remove('hidden');
        return;
      }
      state.balance -= current;
      state.transactions.unshift({
        id: uid('tx'),
        date: formatDateBR(new Date()),
        desc: `Depósito inicial: ${name}`,
        cat: 'Metas',
        value: -current
      });
    }

    state.goals.unshift(goal);
    saveState();
    showToast(`Meta "${name}" criada com sucesso.`, 'success');
  }
  
  document.getElementById('goal-modal-overlay')?.classList.add('hidden');
  if (window.appRenderAll) window.appRenderAll();
}

// Expõe IMEDIATAMENTE no escopo global — antes do bindGoalEvents —
// para que os onclick inline dos cards de meta funcionem assim que forem
// renderizados, inclusive em re-renders via appRenderAll.
window.openEditGoal      = openEditGoal;
window.confirmDeleteGoal = confirmDeleteGoal;

export function bindGoalEvents() {
  // Bind Nova Meta button to open the modal
  document.getElementById('goal-add-btn')?.addEventListener('click', openAddGoal);
  document.getElementById('goal-modal-cancel')?.addEventListener('click', () => document.getElementById('goal-modal-overlay')?.classList.add('hidden'));
  document.getElementById('goal-modal-close')?.addEventListener('click', () => document.getElementById('goal-modal-overlay')?.classList.add('hidden'));
  document.getElementById('goal-modal-save')?.addEventListener('click', saveGoalModal);
  
  document.getElementById('goal-delete-cancel')?.addEventListener('click', () => document.getElementById('goal-delete-overlay')?.classList.add('hidden'));
  document.getElementById('goal-delete-confirm')?.addEventListener('click', deleteGoal);
  document.getElementById('goal-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('goal-modal-overlay')) {
      document.getElementById('goal-modal-overlay')?.classList.add('hidden');
    }
  });
  document.getElementById('goal-delete-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('goal-delete-overlay')) {
      _goalToDelete = null;
      document.getElementById('goal-delete-overlay')?.classList.add('hidden');
    }
  });

  // Delegate contribution/brief events
  document.getElementById('goals-container')?.addEventListener('click', e => {
    const contBtn = e.target.closest('[data-goal-contribute]');
    if (contBtn) {
      const gid = contBtn.dataset.goalContribute;
      const inputEl = document.getElementById(`goal-invest-${gid}`);
      const val = inputEl ? parseCurrencyInput(inputEl.value) : Number(contBtn.dataset.amount);
      if (val > 0) {
        applyGoalContribution(gid, val);
      } else {
        import('../utils/dom.js').then(m => m.showToast('Informe um valor acima de zero.', 'warning'));
      }
    }
    const briefBtn = e.target.closest('[data-goal-brief]');
    if (briefBtn && window.switchTab && window.sendChatPrompt) {
      const g = state.goals.find(x => x.id === briefBtn.dataset.goalBrief);
      if (g) {
        window.switchTab(3);
        window.sendChatPrompt(`Resuma o plano para a meta "${g.nome}". O que devo fazer este mês?`);
      }
    }
  });
  document.getElementById('goals-container')?.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const inputEl = e.target.closest('input[id^="goal-invest-"]');
    if (!inputEl) return;
    e.preventDefault();
    const gid = inputEl.id.replace('goal-invest-', '');
    const val = parseCurrencyInput(inputEl.value);
    if (val > 0) applyGoalContribution(gid, val);
    else import('../utils/dom.js').then(m => m.showToast('Informe um valor acima de zero.', 'warning'));
  });
}
