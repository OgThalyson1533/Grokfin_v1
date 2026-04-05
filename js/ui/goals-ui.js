/**
 * js/ui/goals-ui.js — v2 (Reformulação completa)
 * Cards com ring SVG, countdown de dias, velocidade de aporte,
 * modal com preview de imagem, estado vazio ilustrado.
 */

import { state, saveState }                        from '../state.js';
import { uid }                                     from '../utils/math.js';
import { formatMoney, formatPercent, escapeHtml,
         richText, parseCurrencyInput }             from '../utils/format.js';
import { addMonths, formatDateBR }                 from '../utils/date.js';
import { getGoalProgress, getMonthlyNeed }         from '../analytics/engine.js';
import { showToast, normalizeText }                from '../utils/dom.js';

/* ─── Catálogo de temas ───────────────────────────────────────── */
export const GOAL_THEME_CATALOG = {
  generic:     { label: 'Objetivo',   icon: 'fa-bullseye',          img: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1200&auto=format&fit=crop', color: '#00f5ff' },
  home:        { label: 'Casa',        icon: 'fa-house',             img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop', color: '#f59e0b' },
  travel:      { label: 'Viagem',      icon: 'fa-plane',             img: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=1200&auto=format&fit=crop', color: '#06b6d4' },
  vehicle:     { label: 'Veículo',     icon: 'fa-car-side',          img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=1200&auto=format&fit=crop', color: '#8b5cf6' },
  reserve:     { label: 'Reserva',     icon: 'fa-shield-halved',     img: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?q=80&w=1200&auto=format&fit=crop', color: '#10b981' },
  game:        { label: 'Games',       icon: 'fa-gamepad',           img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop', color: '#a855f7' },
  tech:        { label: 'Tecnologia',  icon: 'fa-microchip',         img: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1200&auto=format&fit=crop', color: '#3b82f6' },
  education:   { label: 'Educação',    icon: 'fa-graduation-cap',    img: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200&auto=format&fit=crop', color: '#f97316' },
  celebration: { label: 'Celebração',  icon: 'fa-champagne-glasses', img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1200&auto=format&fit=crop', color: '#ec4899' },
  bike:        { label: 'Mobilidade',  icon: 'fa-person-biking',     img: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=1200&auto=format&fit=crop', color: '#84cc16' },
};

export const GOAL_THEME_RULES = [
  { theme: 'game',        keys: ['videogame','video game','video-game','game','gamer','console','ps5','playstation','xbox','nintendo','switch'] },
  { theme: 'home',        keys: ['casa','imovel','imóvel','apto','apartamento','condominio','condomínio'] },
  { theme: 'travel',      keys: ['japao','japão','viagem','praia','rio','fortaleza','europa','ferias','férias','intercambio','intercâmbio'] },
  { theme: 'vehicle',     keys: ['carro','moto','veiculo','veículo'] },
  { theme: 'reserve',     keys: ['reserva','emergencia','emergência','seguranca','segurança'] },
  { theme: 'tech',        keys: ['pc','notebook','setup','studio','escritorio','escritório','macbook','iphone','celular','tablet','camera','câmera'] },
  { theme: 'education',   keys: ['faculdade','curso','mba','pos','pós','idioma','certificacao','certificação','estudo','educacao','educação'] },
  { theme: 'celebration', keys: ['casamento','festa','aniversario','aniversário','lua de mel','evento'] },
  { theme: 'bike',        keys: ['bike','bicicleta','ciclismo'] },
];

/* ─── Helpers ────────────────────────────────────────────────── */
export function detectGoalTheme(name = '', explicitTheme = 'auto') {
  if (explicitTheme && explicitTheme !== 'auto' && GOAL_THEME_CATALOG[explicitTheme]) return explicitTheme;
  const normalized = normalizeText(name);
  const rule = GOAL_THEME_RULES.find(item => item.keys.some(k => normalized.includes(normalizeText(k))));
  return rule?.theme || 'generic';
}

export function getGoalThemeLabel(theme = 'generic') {
  return GOAL_THEME_CATALOG[theme]?.label || GOAL_THEME_CATALOG.generic.label;
}

const _unsplashCache = {};
const _unsplashAccessKey = 'ixMO39pKTehyhN0EZBYhf7VA-1SdP6YSgTm0ouHkk0U';

export async function pickGoalImageAsync(name, explicitTheme = 'auto') {
  if (name && name.trim().length > 0) {
    const q = name.trim().toLowerCase();
    if (_unsplashCache[q]) return _unsplashCache[q];
    try {
      const res = await fetch('https://api.unsplash.com/photos/random?query=' + encodeURIComponent(q) + '&orientation=landscape&client_id=' + _unsplashAccessKey);
      if (res.ok) {
        const data = await res.json();
        if (data?.urls?.regular) {
          _unsplashCache[q] = data.urls.regular;
          return data.urls.regular;
        }
      }
    } catch (e) { console.warn('Unsplash API error:', e); }
  }
  const theme = detectGoalTheme(name, explicitTheme);
  return GOAL_THEME_CATALOG[theme]?.img || GOAL_THEME_CATALOG.generic.img;
}

export function estimateGoalTarget(name, explicitTheme = 'auto') {
  const theme = detectGoalTheme(name, explicitTheme);
  const map = { reserve:30000, home:90000, vehicle:65000, travel:18000, game:4500, tech:9000, education:15000, celebration:20000, bike:6500 };
  return map[theme] || 18000;
}

export function estimateGoalDeadline(name, explicitTheme = 'auto') {
  const normalized = normalizeText(name);
  const explicitYear = normalized.match(/20\d{2}/);
  if (explicitYear) return new Date(Number(explicitYear[0]), 11, 1).toISOString();
  const theme = detectGoalTheme(name, explicitTheme);
  const mapMonths = { reserve:6, travel:12, home:24, vehicle:18, education:14 };
  return addMonths(new Date(), mapMonths[theme] || 10).toISOString();
}

export function formatMonthYear(dateIso) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(dateIso));
}

function daysUntil(dateIso) {
  const now  = new Date(); now.setHours(0,0,0,0);
  const dead = new Date(dateIso); dead.setHours(0,0,0,0);
  return Math.ceil((dead - now) / 86400000);
}

function buildRingSVG(pct, color, size) {
  size = size || 54;
  const strokeWidth = size <= 60 ? 3.5 : 7;
  const R   = (size / 2) - (strokeWidth / 2);
  const C   = 2 * Math.PI * R;
  const off = C * (1 - Math.min(pct, 100) / 100);
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="transform:rotate(-90deg); position:absolute; top:0; left:0;" aria-hidden="true">' +
    '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + R + '" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="' + strokeWidth + '"/>' +
    '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="' + strokeWidth + '"' +
    ' stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"' +
    ' stroke-linecap="round" style="transition:stroke-dashoffset .6s ease"/>' +
    '</svg>';
}

/* ─── Estado interno ──────────────────────────────────────────── */
let _editingGoalId = null;
let _goalToDelete  = null;

/* ══════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════════════════ */
export function renderGoals(analytics) {
  const goalsContainer    = document.getElementById('goals-container');
  const overviewContainer = document.getElementById('goals-overview');
  if (!goalsContainer || !overviewContainer) return;

  const totalSaved     = state.goals.reduce(function(a, g) { return a + Number(g.atual || 0); }, 0);
  const totalTarget    = state.goals.reduce(function(a, g) { return a + Number(g.total || 0); }, 0);
  const avgProgress    = analytics.goalsProgress || 0;
  const monthlyNeedAll = state.goals.reduce(function(a, g) { return a + getMonthlyNeed(g); }, 0);

  overviewContainer.innerHTML =
    '<div class="stat-card">' +
      '<div class="stat-header-label"><i class="fa-solid fa-star opacity-40"></i> Total Guardado</div>' +
      '<div class="stat-value">' + formatMoney(totalSaved) + '</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-header-label"><i class="fa-solid fa-calendar-plus opacity-40"></i> Aporte Mensal</div>' +
      '<div class="stat-value">' + formatMoney(monthlyNeedAll) + '</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-header-label"><i class="fa-solid fa-arrow-trend-up opacity-40"></i> Progresso Médio</div>' +
      '<div class="stat-value">' + formatPercent(avgProgress, 0) + '</div>' +
    '</div>';

  /* Estado vazio */
  if (!state.goals.length) {
    goalsContainer.innerHTML =
      '<div class="goal-empty-state col-span-full mt-8">' +
        '<div class="goal-empty-icon">' +
          '<i class="fa-solid fa-bullseye text-4xl" style="background:linear-gradient(135deg,#00f5ff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent"></i>' +
        '</div>' +
        '<h4 class="text-xl font-black text-white mt-4">Nenhuma meta criada ainda</h4>' +
        '<p class="text-sm text-white/45 mt-2 max-w-xs text-center leading-relaxed">Defina para onde quer levar seu dinheiro. Cada meta vira um plano com data, aporte mensal e progresso visual.</p>' +
        '<button onclick="document.getElementById(\'goal-add-btn\').click()" class="mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95 bg-white">' +
          '<i class="fa-solid fa-plus"></i> Criar primeira meta' +
        '</button>' +
      '</div>';
    return;
  }

  /* Cards v3 */
  goalsContainer.innerHTML = state.goals.map(function(rawGoal) {
    var goal = Object.assign({}, rawGoal, {
      nome:  rawGoal.nome  || rawGoal.name   || 'Meta',
      atual: Number(rawGoal.atual || rawGoal.current || 0),
      total: Number(rawGoal.total || rawGoal.target  || 0),
    });

    var progress    = getGoalProgress(goal);
    var monthlyNeed = getMonthlyNeed(goal);
    var remaining   = Math.max(0, goal.total - goal.atual);
    var theme       = detectGoalTheme(goal.nome, goal.theme || 'auto');
    var catalog     = GOAL_THEME_CATALOG[theme] || GOAL_THEME_CATALOG.generic;
    var themeColor  = catalog.color;
    var goalImage   = goal.customImage || goal.img || catalog.img;
    var suggested   = monthlyNeed > 0 ? monthlyNeed : (remaining > 0 ? Math.min(remaining, 500) : 0);
    var isDone      = progress >= 100;

    var inputPh = isDone ? 'Concluído' : formatMoney(suggested);
    var opacityProp = isDone ? 'opacity:0.5;' : '';

    return '<article class="goal-card-v3 group" data-goal-id="' + goal.id + '">' +
      '<div class="goal-bg" style="background-image:url(\'' + goalImage + '\')"></div>' +
      '<div class="goal-overlay"></div>' +
      '<div class="goal-content">' +

        /* Topo do Card */
        '<div class="goal-top">' +
          '<div class="progress-circle-wrap">' +
            buildRingSVG(progress, themeColor, 54) +
            '<span class="progress-circle-pct">' + progress + '%</span>' +
          '</div>' +
          '<div class="goal-target">' +
            '<span>Alvo</span>' +
            '<strong>' + formatMoney(goal.total) + '</strong>' +
          '</div>' +
        '</div>' +

        /* Meio/Baixo */
        '<div class="goal-bottom">' +
          '<div class="goal-info">' +
            '<h2>' + escapeHtml(goal.nome) + '</h2>' +
            '<div class="goal-stats">' +
              '<div><p>Guardado</p><strong>' + formatMoney(goal.atual) + '</strong></div>' +
              '<div><p>Mensal</p><strong>' + (isDone ? '--' : formatMoney(monthlyNeed)) + '</strong></div>' +
            '</div>' +
          '</div>' +

          /* Action Bar */
          '<div class="action-bar">' +
            '<input type="text" id="goal-invest-' + goal.id + '" class="input-aporte" placeholder="' + inputPh + '" ' + (isDone ? 'disabled' : '') + ' style="' + opacityProp + '">' +
            (isDone ? '' : '<button data-goal-contribute="' + goal.id + '" class="btn-aportar">+</button>') +
            '<button data-goal-brief="' + goal.id + '" class="btn-icon" title="Analisar com IA">' +
              '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1a1 1 0 0 1-1 1h-1v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1H4a1 1 0 0 1-1-1v-1a7 7 0 0 1 7-7h1V5.73A2 2 0 1 1 12 2zm-3 10a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zm6 0a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1z"/></svg>' +
            '</button>' +
            '<button onclick="openEditGoal(\'' + goal.id + '\')" class="btn-icon" title="Editar"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
            '<button onclick="confirmDeleteGoal(\'' + goal.id + '\')" class="btn-icon delete" title="Excluir"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</article>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════════ */
export function openAddGoal() {
  _editingGoalId = null;
  _resetModal();
  document.getElementById('goal-modal-title').textContent = 'Nova Meta';
  var d = new Date(); d.setFullYear(d.getFullYear() + 1);
  document.getElementById('goal-modal-deadline').value =
    d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  document.getElementById('goal-modal-overlay')?.classList.remove('hidden');
  _updateModalPreview();
}

function _resetModal() {
  ['goal-modal-name','goal-modal-total','goal-modal-atual'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var t = document.getElementById('goal-modal-theme'); if (t) t.value = 'auto';
  document.getElementById('goal-modal-error')?.classList.add('hidden');
}

export function openEditGoal(id) {
  var goal = state.goals.find(function(g) { return g.id === id; });
  if (!goal) return;
  _editingGoalId = id;
  document.getElementById('goal-modal-title').textContent = 'Editar Meta';
  document.getElementById('goal-modal-name').value  = goal.nome;
  document.getElementById('goal-modal-total').value = goal.total.toFixed(2).replace('.', ',');
  document.getElementById('goal-modal-atual').value = goal.atual.toFixed(2).replace('.', ',');
  document.getElementById('goal-modal-theme').value = goal.theme || 'auto';
  var d = goal.deadline ? new Date(goal.deadline) : addMonths(new Date(), 12);
  if (Number.isNaN(d.getTime())) d = addMonths(new Date(), 12);
  document.getElementById('goal-modal-deadline').value =
    d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  document.getElementById('goal-modal-error')?.classList.add('hidden');
  document.getElementById('goal-modal-overlay')?.classList.remove('hidden');
  _updateModalPreview();
}

async function _updateModalPreview() {
  var nameEl    = document.getElementById('goal-modal-name');
  var themeEl   = document.getElementById('goal-modal-theme');
  var previewEl = document.getElementById('goal-modal-img-preview');
  var iconEl    = document.getElementById('goal-modal-theme-icon');
  if (!previewEl) return;
  var name     = (nameEl && nameEl.value) || '';
  var theme    = (themeEl && themeEl.value) || 'auto';
  var resolved = detectGoalTheme(name, theme);
  var catalog  = GOAL_THEME_CATALOG[resolved] || GOAL_THEME_CATALOG.generic;
  
  if (iconEl) { iconEl.className = 'fa-solid ' + catalog.icon; iconEl.style.color = catalog.color; }
  
  try {
    var imgSrc = await pickGoalImageAsync(name, theme);
    if (nameEl && nameEl.value !== name && name !== '') return;
    previewEl.style.backgroundImage = "url('" + imgSrc + "')";
  } catch(e) {
    previewEl.style.backgroundImage = "url('" + catalog.img + "')";
  }
}

/* ══════════════════════════════════════════════════════════════
   APORTE
══════════════════════════════════════════════════════════════ */
export function applyGoalContribution(goalId, amount, options) {
  options = options || {};
  var goal = state.goals.find(function(item) { return item.id === goalId; });
  if (!goal) return { ok: false, message: 'Meta não encontrada.' };
  var remaining = Math.max(0, goal.total - goal.atual);
  if (remaining <= 0) return { ok: false, message: 'Já concluída.' };
  var requested = Math.min(Number(amount) || 0, remaining);
  if (requested <= 0) {
    if (options.notify !== false) showToast('Informe um valor acima de zero.', 'warning');
    return { ok: false, message: 'Valor inválido.' };
  }
  if (requested > state.balance) {
    if (options.notify !== false) showToast('Saldo insuficiente. Disponível: ' + formatMoney(state.balance) + '.', 'danger');
    return { ok: false, message: 'Saldo insuficiente.' };
  }
  goal.atual    = Number((goal.atual + requested).toFixed(2));
  state.balance = Number((state.balance - requested).toFixed(2));
  state.transactions.unshift({ id: uid('tx'), date: formatDateBR(new Date()), desc: 'Aporte meta: ' + goal.nome, cat: 'Metas', value: -requested });
  saveState();
  if (options.notify !== false) showToast(formatMoney(requested) + ' aportado em "' + goal.nome + '". 🎯', 'success');
  if (window.appRenderAll) window.appRenderAll();
  return { ok: true, message: 'Apliquei ' + formatMoney(requested) + ' em ' + goal.nome + '.' };
}

/* ══════════════════════════════════════════════════════════════
   SALVAR MODAL
══════════════════════════════════════════════════════════════ */
export async function saveGoalModal() {
  var name        = document.getElementById('goal-modal-name').value.trim();
  var target      = parseCurrencyInput(document.getElementById('goal-modal-total').value);
  var current     = parseCurrencyInput(document.getElementById('goal-modal-atual').value) || 0;
  var deadlineStr = document.getElementById('goal-modal-deadline').value;
  var themeInput  = document.getElementById('goal-modal-theme').value;
  var errEl       = document.getElementById('goal-modal-error');
  var saveBtn     = document.getElementById('goal-modal-save');
  
  if (!name) { _showModalErr(errEl, 'Preencha o nome da meta.'); return; }
  var resolvedTheme = detectGoalTheme(name, themeInput);
  if (!target) target = estimateGoalTarget(name, resolvedTheme);
  if (!target) { _showModalErr(errEl, 'Informe o valor alvo.'); return; }
  var deadline = deadlineStr ? new Date(deadlineStr + 'T12:00:00Z').toISOString() : estimateGoalDeadline(name, resolvedTheme);
  if (errEl) errEl.classList.add('hidden');

  var originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

  var imgSrc = await pickGoalImageAsync(name, themeInput);

  if (_editingGoalId) {
    var idx = state.goals.findIndex(function(g) { return g.id === _editingGoalId; });
    if (idx >= 0) {
      var g = state.goals[idx];
      var diff = current - g.atual;
      if (diff > 0 && state.balance < diff) { 
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
        _showModalErr(errEl, 'Saldo insuficiente para atualizar o valor guardado.'); return; 
      }
      state.balance -= diff;
      state.goals[idx] = Object.assign({}, g, { nome: name, total: target, atual: current, deadline: deadline, theme: resolvedTheme, img: imgSrc });
      saveState(); showToast('Meta atualizada com sucesso.', 'success');
    }
  } else {
    if (current > 0 && state.balance < current) { 
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
        _showModalErr(errEl, 'Saldo insuficiente para o valor inicial.'); return; 
    }
    if (current > 0) {
      state.balance -= current;
      state.transactions.unshift({ id: uid('tx'), date: formatDateBR(new Date()), desc: 'Depósito inicial: ' + name, cat: 'Metas', value: -current });
    }
    state.goals.unshift({ id: uid('goal'), nome: name, atual: current, total: target, theme: resolvedTheme, img: imgSrc, deadline: deadline });
    saveState(); showToast('Meta "' + name + '" criada! 🎯', 'success');
  }
  
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
  document.getElementById('goal-modal-overlay')?.classList.add('hidden');
  if (window.appRenderAll) window.appRenderAll();
}

function _showModalErr(el, msg) {
  if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
}

/* ══════════════════════════════════════════════════════════════
   EXCLUIR
══════════════════════════════════════════════════════════════ */
export function confirmDeleteGoal(id) {
  _goalToDelete = id;
  var goal = state.goals.find(function(g) { return g.id === id; });
  var nameEl = document.getElementById('goal-delete-name');
  if (nameEl && goal) nameEl.textContent = goal.nome;
  document.getElementById('goal-delete-overlay')?.classList.remove('hidden');
}

export function deleteGoal() {
  if (!_goalToDelete) return;
  var goal = state.goals.find(function(g) { return g.id === _goalToDelete; });
  if (goal && goal.atual > 0) {
    state.balance += goal.atual;
    state.transactions.unshift({ id: uid('tx'), date: formatDateBR(new Date()), desc: 'Resgate meta: ' + goal.nome, cat: 'Metas', value: goal.atual });
  }
  // Remove a meta do state antes de salvar
  // O saveState() → syncToSupabase() agora trata corretamente arrays vazios,
  // enviando um DELETE geral quando não há mais metas. Não é necessário um
  // delete direto paralelo (que causava race conditions e duplicidade).
  state.goals = state.goals.filter(function(g) { return g.id !== _goalToDelete; });
  _goalToDelete = null;
  saveState();
  document.getElementById('goal-delete-overlay')?.classList.add('hidden');
  showToast('Meta excluída. Valor devolvido ao saldo.', 'info');
  if (window.appRenderAll) window.appRenderAll();
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL + BIND EVENTOS
══════════════════════════════════════════════════════════════ */
window.openEditGoal      = openEditGoal;
window.confirmDeleteGoal = confirmDeleteGoal;

export function bindGoalEvents() {
  document.getElementById('goal-add-btn')?.addEventListener('click', openAddGoal);
  ['goal-modal-cancel','goal-modal-close'].forEach(function(id) {
    document.getElementById(id)?.addEventListener('click', function() {
      document.getElementById('goal-modal-overlay')?.classList.add('hidden');
    });
  });
  document.getElementById('goal-modal-save')?.addEventListener('click', saveGoalModal);
  document.getElementById('goal-modal-overlay')?.addEventListener('click', function(e) {
    if (e.target === document.getElementById('goal-modal-overlay'))
      document.getElementById('goal-modal-overlay')?.classList.add('hidden');
  });
  var previewTimeout;
  document.getElementById('goal-modal-name')?.addEventListener('input', function() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(_updateModalPreview, 800);
  });
  document.getElementById('goal-modal-theme')?.addEventListener('change', _updateModalPreview);
  document.getElementById('goal-delete-cancel')?.addEventListener('click', function() {
    document.getElementById('goal-delete-overlay')?.classList.add('hidden');
  });
  document.getElementById('goal-delete-confirm')?.addEventListener('click', deleteGoal);
  document.getElementById('goal-delete-overlay')?.addEventListener('click', function(e) {
    if (e.target === document.getElementById('goal-delete-overlay')) {
      _goalToDelete = null;
      document.getElementById('goal-delete-overlay')?.classList.add('hidden');
    }
  });

  var container = document.getElementById('goals-container');
  container?.addEventListener('click', function(e) {
    var contBtn = e.target.closest('[data-goal-contribute]');
    if (contBtn) {
      var gid     = contBtn.dataset.goalContribute;
      var inputEl = document.getElementById('goal-invest-' + gid);
      var val     = inputEl ? parseCurrencyInput(inputEl.value) : 0;
      if (val <= 0 && inputEl && inputEl.placeholder) val = parseCurrencyInput(inputEl.placeholder);
      if (val > 0) applyGoalContribution(gid, val);
      else showToast('Informe um valor acima de zero.', 'warning');
      return;
    }
    var briefBtn = e.target.closest('[data-goal-brief]');
    if (briefBtn && window.toggleAiSidePanel && window.sendChatPrompt) {
      e.preventDefault();
      var g = state.goals.find(function(x) { return x.id === briefBtn.dataset.goalBrief; });
      if (g) { 
        window.toggleAiSidePanel(true); 
        window.sendChatPrompt('Resuma o plano para a meta "' + g.nome + '". O que devo fazer este mês?'); 
      }
    }
  });
  container?.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var inputEl = e.target.closest('input[id^="goal-invest-"]');
    if (!inputEl) return;
    e.preventDefault();
    var gid = inputEl.id.replace('goal-invest-', '');
    var val = parseCurrencyInput(inputEl.value);
    if (val <= 0 && inputEl.placeholder) val = parseCurrencyInput(inputEl.placeholder);
    if (val > 0) applyGoalContribution(gid, val);
    else showToast('Informe um valor acima de zero.', 'warning');
  });
}
