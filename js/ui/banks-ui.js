/**
 * js/ui/banks-ui.js
 * Lógica da seção Contas Bancárias (Aba 6 - Bancos e Cartões), renderização e modais.
 */

import { state, saveState } from '../state.js';
import { uid } from '../utils/math.js';
import { formatMoney, escapeHtml, parseCurrencyInput } from '../utils/format.js';
import { showToast } from '../utils/dom.js';
import { isSupabaseConfigured } from '../services/supabase.js';

let _editingBankId = null;

const BANK_ICONS = {
  corrente: 'fa-building-columns',
  poupanca: 'fa-piggy-bank',
  investimento: 'fa-chart-line',
  caixa: 'fa-wallet'
};

export function renderBanks() {
  const grid = document.getElementById('banks-grid');
  if (!grid) return;
  
  if (!state.accounts || !state.accounts.length) {
    grid.innerHTML = '<div class="glass-panel col-span-full rounded-[28px] p-10 text-center text-white/45">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</div>';
    return;
  }
  
  grid.innerHTML = state.accounts.map(account => {
    const color = account.color || '#00f5ff';
    const icon = BANK_ICONS[account.accountType] || 'fa-building-columns';
    const typeLabelMap = {
      corrente: 'Conta Corrente',
      poupanca: 'Poupança',
      investimento: 'Investimento',
      caixa: 'Caixa / Dinheiro'
    };
    
    // Cálculo do saldo real com base nas transações da conta
    const txs = (state.transactions || []).filter(t => t.accountId === account.id);
    const currentBalance = (account.initialBalance || 0) + txs.reduce((sum, t) => sum + (t.value || 0), 0);

    
    return `
      <div class="glass-panel card-hover rounded-[28px] p-6 relative overflow-hidden" style="border: 1px solid ${color}33">
        <div class="absolute inset-0 opacity-[0.03]" style="background:radial-gradient(circle at 80% 20%, ${color}, transparent 70%)"></div>
        <div class="relative">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white" style="background:${color}40; border: 1px solid ${color}60;">
                 <i class="fa-solid ${icon}" style="color: ${color}"></i>
              </div>
              <div>
                <p class="font-bold text-white text-sm">${escapeHtml(account.name)}</p>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-white/40 mt-0.5">
                  ${typeLabelMap[account.accountType] || 'Conta'}
                </p>
              </div>
            </div>
            <div class="flex gap-1">
              <button onclick="event.stopPropagation();window.banksUI.openEditBank('${account.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-400/70 hover:bg-cyan-400/10 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
              <button onclick="event.stopPropagation();window.banksUI.deleteBank('${account.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-rose-400/60 hover:bg-rose-400/10 transition-colors"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>
          </div>
          <div class="space-y-1 mt-6">
            <span class="text-xs uppercase tracking-widest font-bold text-white/30">Saldo</span>
            <div class="text-2xl font-black text-white tracking-tight">${formatMoney(currentBalance)}</div>
          </div>
          <!-- Sparkline Chart -->
          <div class="mt-4 h-12 w-full opacity-60">
            <canvas id="sparkline-acc-${account.id}"></canvas>
          </div>
        </div>
      </div>`;
  }).join('');

  // Renderizar os minigráficos (Sparklines) após montar o HTML
  setTimeout(() => {
    if (typeof window.Chart === 'undefined') return;
    state.accounts.forEach(account => {
      const el = document.getElementById(`sparkline-acc-${account.id}`);
      if (!el) return;
      const color = account.color || '#00f5ff';
      // Mock dinâmico simulando histórico de 5 meses (assim como Fingu: Nov, Dez, Jan, Fev, Mar)
      const baseVal = account.initialBalance || 1000;
      const dataPoints = [baseVal*0.8, baseVal*0.9, baseVal*1.1, baseVal*0.95, baseVal];
      
      new window.Chart(el, {
        type: 'line',
        data: {
          labels: ['Nov', 'Dez', 'Jan', 'Fev', 'Mar'],
          datasets: [{
            data: dataPoints,
            borderColor: color,
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          interaction: { mode: 'none' }
        }
      });
    });
  }, 100);
}

export function openEditBank(id) {
  const account = state.accounts.find(a => a.id === id);
  if (!account) return;
  _editingBankId = id;
  
  document.getElementById('bank-modal-title').textContent = 'Editar Conta';
  document.getElementById('bank-modal-name').value = account.name;
  document.getElementById('bank-modal-type').value = account.accountType || 'corrente';
  document.getElementById('bank-modal-color').value = account.color || '#00f5ff';
  document.getElementById('bank-modal-balance').value = (account.initialBalance || 0).toFixed(2).replace('.', ',');
  document.getElementById('bank-modal-error').classList.add('hidden');
  
  document.getElementById('bank-modal-overlay').classList.remove('hidden');
}

export function deleteBank(id) {
  if (isSupabaseConfigured) {
    import('../services/supabase.js').then(({ supabase, isSupabaseConfigured: ok }) => {
      if (!ok || !supabase) return;
      supabase.from('accounts').delete().eq('id', id).catch(e => console.error('[Banks] Falha ao deletar conta remota:', e));
    });
  }
  
  state.accounts = state.accounts.filter(a => a.id !== id);
  saveState();
  if (window.appRenderAll) window.appRenderAll(); else renderBanks();
  showToast('Conta excluída com sucesso.', 'info');
}

export function saveBankModal() {
  const name = document.getElementById('bank-modal-name').value.trim();
  const type = document.getElementById('bank-modal-type').value;
  const color = document.getElementById('bank-modal-color').value;
  const balance = parseCurrencyInput(document.getElementById('bank-modal-balance').value);
  const errEl = document.getElementById('bank-modal-error');

  if (!name) { errEl.textContent = 'O nome da conta é obrigatório.'; errEl.classList.remove('hidden'); return; }
  
  if (_editingBankId) {
    const idx = state.accounts.findIndex(a => a.id === _editingBankId);
    if (idx >= 0) {
      state.accounts[idx] = { ...state.accounts[idx], name, accountType: type, color, initialBalance: balance || 0 };
    }
    showToast('Conta atualizada.', 'success');
  } else {
    if (!state.accounts) state.accounts = [];
    state.accounts.push({ id: uid('acc'), name, accountType: type, color, initialBalance: balance || 0 });
    showToast('Nova conta adicionada.', 'success');
  }
  
  _editingBankId = null;
  saveState();
  
  document.getElementById('bank-modal-overlay').classList.add('hidden');
  if (window.appRenderAll) window.appRenderAll(); else renderBanks(); 
}

export function bindBankEvents() {
  document.getElementById('bank-account-add-btn')?.addEventListener('click', () => {
    _editingBankId = null;
    document.getElementById('bank-modal-title').textContent = 'Nova Conta';
    document.getElementById('bank-modal-name').value = '';
    document.getElementById('bank-modal-type').value = 'corrente';
    document.getElementById('bank-modal-color').value = '#00f5ff';
    document.getElementById('bank-modal-balance').value = '';
    document.getElementById('bank-modal-error')?.classList.add('hidden');
    
    document.getElementById('bank-modal-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('bank-modal-name')?.focus(), 60);
  });

  document.getElementById('bank-modal-close')?.addEventListener('click', () => document.getElementById('bank-modal-overlay').classList.add('hidden'));
  document.getElementById('bank-modal-cancel')?.addEventListener('click', () => document.getElementById('bank-modal-overlay').classList.add('hidden'));
  document.getElementById('bank-modal-save')?.addEventListener('click', saveBankModal);
  
  document.getElementById('bank-modal-overlay')?.addEventListener('click', e => { 
    if (e.target === document.getElementById('bank-modal-overlay')) document.getElementById('bank-modal-overlay').classList.add('hidden'); 
  });

  // Global exposes for inline onclick handlers inside renderBanks
  window.banksUI = {
    openEditBank,
    deleteBank
  };
}
