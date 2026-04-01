/**
 * js/ui/transactions-ui.js
 * Tratamento de lista de transações, filtros, paginação e modal de CRUD.
 */

import { state, saveState } from '../state.js';
import { formatMoney, escapeHtml, parseCurrencyInput } from '../utils/format.js';
import { toneForCategory, iconForCategory, CATEGORIES_LIST, PAYMENT_METHODS } from '../config.js';
import { uid } from '../utils/math.js';
import { parseDateBR } from '../utils/date.js';
import { showToast, normalizeText } from '../utils/dom.js';
import { deleteRemoteTransaction } from '../services/transactions.js';
import { SUPABASE_URL } from '../services/supabase.js';

/**
 * Classe para gerenciar os dropdowns customizados com busca e estados visuais
 */
class ModernFloxSelect {
  constructor(element) {
    if (!element) return;
    this.element = element;
    this.trigger = element.querySelector('.select-trigger');
    this.triggerContent = element.querySelector('.select-trigger-content');
    this.dropdown = element.querySelector('.select-dropdown');
    this.hiddenInput = element.querySelector('input[type="hidden"]');
    this.comboInput = element.querySelector('.combo-input');
    this.searchInput = element.querySelector('.search-input-field');
    this.isOpen = false;
    this.onSelect = null;
    this.bindEvents();
  }

  getOptions() { return Array.from(this.element.querySelectorAll('.select-option')); }

  bindEvents() {
    if (!this.trigger) return;
    this.trigger.addEventListener('click', (e) => {
      // Se clicar no input de texto e já estiver aberto, não fecha
      if (e.target === this.comboInput && this.isOpen) return;
      this.toggle();
    });

    if (this.dropdown) {
      this.dropdown.addEventListener('click', (e) => {
        // Lógica de deleção (cat-only)
        const deleteBtn = e.target.closest('.delete-cat-btn');
        if (deleteBtn) {
          e.stopPropagation();
          const option = deleteBtn.closest('.select-option');
          if (window.confirmDeleteCategory) window.confirmDeleteCategory(option, this);
          return;
        }

        const option = e.target.closest('.select-option');
        if (option) {
          e.stopPropagation();
          this.selectOption(option);
        }
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.filterOptions(e.target.value));
    }

    if (this.comboInput) {
      this.comboInput.addEventListener('input', (e) => {
        this.open();
        this.filterOptions(e.target.value);
        // Ao apagar tudo, resetar o ícone
        if (e.target.value === '') {
          const icon = this.element.querySelector('#cat-trigger-icon');
          if (icon) {
            icon.className = 'cat-icon';
            icon.style.backgroundColor = 'var(--bg-hover)';
            icon.innerHTML = '<i data-lucide="tag"></i>';
            if (window.lucide) window.lucide.createIcons();
          }
          this.hiddenInput.value = '';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target) && this.isOpen) {
        const confirmModal = document.getElementById('delete-cat-confirm-modal');
        if (confirmModal && confirmModal.contains(e.target)) return;
        this.close();
      }
    });
  }

  filterOptions(term) {
    term = term.toLowerCase();
    this.getOptions().forEach(opt => {
      const title = opt.querySelector('.option-title')?.textContent.toLowerCase() || '';
      const subtitle = opt.querySelector('.option-subtitle')?.textContent.toLowerCase() || '';
      opt.style.display = (title.includes(term) || subtitle.includes(term)) ? 'flex' : 'none';
    });
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  
  open() {
    this.isOpen = true; this.element.classList.add('open');
    this.trigger?.setAttribute('aria-expanded', 'true');
    if (this.searchInput) setTimeout(() => this.searchInput.focus(), 50);
  }

  close() {
    this.isOpen = false; this.element.classList.remove('open');
    this.trigger?.setAttribute('aria-expanded', 'false');
    
    // Reset do form de criação se fechado
    const builder = document.getElementById('builder-form');
    const list = document.getElementById('tx-cat-options-list');
    const btnOpen = document.getElementById('btn-open-builder');
    if (builder && list) {
       builder.style.display = 'none';
       list.style.display = 'block';
       if (btnOpen) btnOpen.style.display = 'flex';
    }
  }

  selectOption(option) {
    this.getOptions().forEach(opt => opt.classList.remove('is-selected'));
    option.classList.add('is-selected');

    const val = option.dataset.value;
    const title = option.querySelector('.option-title')?.textContent || '';

    if (this.comboInput) {
      this.comboInput.value = title;
      const triggerIcon = this.element.querySelector('#cat-trigger-icon');
      const optionIcon = option.querySelector('.cat-icon');
      if (triggerIcon && optionIcon) {
        triggerIcon.className = optionIcon.className;
        triggerIcon.style.backgroundColor = optionIcon.style.backgroundColor;
        triggerIcon.innerHTML = optionIcon.innerHTML;
      }
    } else {
      // Seletor de Conta (estilo rico original)
      const content = option.innerHTML;
      const temp = document.createElement('div');
      temp.innerHTML = content;
      // Remove subtitulo/saldo ao exibir no trigger (mantém no dropdown)
      temp.querySelectorAll('.option-subtitle').forEach(s => s.remove());
      temp.querySelectorAll('.delete-cat-btn').forEach(b => b.remove());
      this.triggerContent.innerHTML = temp.innerHTML;
    }

    this.hiddenInput.value = val;
    if (this.onSelect) this.onSelect(val, option);
    this.close();
    if (window.lucide) window.lucide.createIcons();
  }

  setValue(val) {
    const options = this.getOptions();
    const option = options.find(opt => opt.dataset.value === val);
    if (option) {
      this.selectOption(option);
    } else {
      this.hiddenInput.value = val || '';
      if (this.comboInput) {
        this.comboInput.value = val || '';
        const icon = this.element.querySelector('#cat-trigger-icon');
        if (icon) { icon.className = 'cat-icon'; icon.style.backgroundColor = 'var(--bg-hover)'; icon.innerHTML = '<i data-lucide="tag"></i>'; if (window.lucide) window.lucide.createIcons(); }
      } else if (this.triggerContent) {
        this.triggerContent.innerHTML = '<span class="placeholder-text" style="color: var(--text-placeholder); font-size: 14px;">Selecione...</span>';
      }
    }
  }
}

let _editingTxId = null;

/** Sincroniza as abas visuais Entrada/Saída e atualiza o label do toggle "Realizado" */
function _syncTypeTabs(type) {
  const btnEntrada = document.getElementById('btn-entrada');
  const btnSaida = document.getElementById('btn-saida');
  const tabEntrada = document.getElementById('tx-tab-entrada');
  const tabSaida = document.getElementById('tx-tab-saida');

  if (btnEntrada) btnEntrada.classList.toggle('active', type === 'entrada');
  if (btnSaida) btnSaida.classList.toggle('active', type === 'saida');
  if (tabEntrada) tabEntrada.classList.toggle('active', type === 'entrada');
  if (tabSaida) tabSaida.classList.toggle('active', type === 'saida');

  const labelEl = document.getElementById('tx-realized-label');
  if (labelEl) {
    labelEl.textContent = type === 'entrada' ? 'Recebimento Realizado' : 'Pagamento Realizado';
  }
}

/** Retorna categorias base + customizadas pelo usuário (sem duplicatas, ordenadas) */
function getAllCategories() {
  const custom = Array.isArray(state.customCategories) ? state.customCategories : [];
  return [...new Set([...CATEGORIES_LIST, 'Receita', ...custom])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Adiciona uma nova categoria personalizada ao estado do usuário */
function addCustomCategory(name) {
  const clean = name.trim();
  if (!clean) return false;
  const all = getAllCategories();
  if (all.some(c => c.toLowerCase() === clean.toLowerCase())) return false;
  if (!Array.isArray(state.customCategories)) state.customCategories = [];
  state.customCategories.push(clean);
  saveState();
  return true;
}

/** Popula o dropdown rico de categoria */
function populateCategorySelect(container, selected) {
  const optionsList = document.getElementById('tx-cat-options-list');
  if (!optionsList) return;

  const all = getAllCategories();
  optionsList.innerHTML = all.map(c => {
    const isSelected = selected === c;
    const color = toneForCategory(c);
    const icon = iconForCategory(c);
    
    // Mapeamento FA -> Lucide para os principais ícones do sistema
    const faToLucide = {
      'fa-utensils': 'utensils',
      'fa-bolt': 'zap',
      'fa-car': 'car',
      'fa-house': 'home',
      'fa-cart-shopping': 'shopping-cart',
      'fa-heart-pulse': 'heart',
      'fa-graduation-cap': 'graduation-cap',
      'fa-briefcase': 'briefcase',
      'fa-piggy-bank': 'landmark',
      'fa-clapperboard': 'clapperboard',
      'fa-plane': 'plane',
      'fa-pills': 'pill',
      'fa-gift': 'gift',
      'fa-mobile-screen': 'smartphone',
      'fa-leaf': 'leaf',
      'fa-cannabis': 'leaf' // Fallback se não tiver cannabis no lucide free
    };

    let lucideIcon = 'tag';
    if (icon && icon.includes('fa-')) {
      lucideIcon = faToLucide[icon] || 'tag';
    } else if (icon) {
      lucideIcon = icon;
    }

    return `
      <div class="select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="${escapeHtml(c)}">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <div class="cat-icon" style="background-color: ${color};"><i data-lucide="${lucideIcon}"></i></div>
          <span class="option-title">${escapeHtml(c)}</span>
        </div>
        ${!CATEGORIES_LIST.includes(c) ? `<button type="button" class="delete-cat-btn" title="Excluir Categoria"><i data-lucide="trash-2"></i></button>` : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Atualizar o trigger se houver seleção
  if (selected) {
    const option = optionsList.querySelector(`[data-value="${CSS.escape(selected)}"]`);
    if (option && window.txCategoryInstance) {
      window.txCategoryInstance.selectOption(option);
    }
  }
}

/** Popula o seletor rico de conta/cartão */
export function populateAccountSelect(container, selectedValue) {
  const optionsList = document.getElementById('tx-account-options-list');
  if (!optionsList) return;

  const accounts = state.accounts || [];
  const cards = state.cards || [];
  
  let html = '';
  
  if (accounts.length > 0) {
    html += `<div class="select-group-label">Contas Bancárias</div>`;
    accounts.forEach(acc => {
      const initial = acc.name.substring(0, 2).toLowerCase();
      const isSelected = selectedValue === acc.id;
      html += `
        <div class="select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="${acc.id}">
          <div class="bank-icon" style="background: rgba(255,255,255,0.1); color: white;">${initial}</div>
          <div class="option-text">
            <span class="option-title">${escapeHtml(acc.name)}</span>
            <span class="option-subtitle">Saldo disponível: ${formatMoney(acc.balance || 0)}</span>
          </div>
        </div>
      `;
    });
  } else {
    // Fallback Conta Principal
    const isSelected = selectedValue === 'principal';
    html += `
      <div class="select-group-label">Contas Bancárias</div>
      <div class="select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="principal">
        <div class="bank-icon" style="background: rgba(255,255,255,0.1); color: white;">cp</div>
        <div class="option-text">
          <span class="option-title">Conta Principal</span>
          <span class="option-subtitle">Saldo disponível: ${formatMoney(state.balance || 0)}</span>
        </div>
      </div>
    `;
  }
  
  if (cards.length > 0) {
    html += `<div class="select-group-label">Cartões de Crédito</div>`;
    cards.forEach(card => {
      const initial = card.name.substring(0, 2).toLowerCase();
      const isSelected = selectedValue === card.id;
      html += `
        <div class="select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="${card.id}">
          <div class="bank-icon" style="background: rgba(255,255,255,0.1); color: white;">${initial}</div>
          <div class="option-text">
            <span class="option-title">${escapeHtml(card.name)}</span>
            <span class="option-subtitle">Limite disp: ${formatMoney((card.limit || 0) - (card.used || 0))}</span>
          </div>
        </div>
      `;
    });
  }
  
  optionsList.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  if (selectedValue) {
    const option = optionsList.querySelector(`[data-value="${CSS.escape(selectedValue)}"]`);
    if (option && window.txAccountInstance) {
      window.txAccountInstance.selectOption(option);
    }
  }
}

let _txToDelete = null;

export const selectedTxIds = new Set();

export function updateBulkActionsBar() {
  const inlineBtn = document.getElementById('tx-inline-excluir');
  const countSpan = document.getElementById('tx-inline-excluir-count');
  if (!inlineBtn || !countSpan) return;
  if (selectedTxIds.size > 0) {
    countSpan.textContent = selectedTxIds.size;
    inlineBtn.classList.remove('hidden');
    inlineBtn.classList.add('flex');
  } else {
    inlineBtn.classList.add('hidden');
    inlineBtn.classList.remove('flex');
  }
}

// Global window functions for app.html bindings
window.toggleTxRow = function(checkbox, txId) {
  if (checkbox.checked) selectedTxIds.add(txId);
  else selectedTxIds.delete(txId);
  updateBulkActionsBar();
  
  const list = getFilteredTransactions();
  const page = state.ui.txPage || 0;
  const pageSize = state.ui.txPageSize || 20;
  const currentList = list.slice(page * pageSize, (page + 1) * pageSize);
  const selectAllCb = document.getElementById('tx-select-all');
  if(selectAllCb) selectAllCb.checked = (currentList.length > 0 && currentList.every(t => selectedTxIds.has(t.id)));
};
window.toggleSelectAllTx = function(checkbox) {
  const list = getFilteredTransactions();
  const page = state.ui.txPage || 0;
  const pageSize = state.ui.txPageSize || 20;
  const currentList = list.slice(page * pageSize, (page + 1) * pageSize);
  if (checkbox.checked) {
    currentList.forEach(t => selectedTxIds.add(t.id));
  } else {
    currentList.forEach(t => selectedTxIds.delete(t.id));
  }
  const checkboxes = document.querySelectorAll('.tx-row-checkbox');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
  updateBulkActionsBar();
};
window.clearTxSelection = function() {
  selectedTxIds.clear();
  const selectAllCb = document.getElementById('tx-select-all');
  if(selectAllCb) selectAllCb.checked = false;
  renderTransactions();
  updateBulkActionsBar();
};
window.changeTxPageSize = function(size) {
  state.ui.txPageSize = parseInt(size, 10);
  state.ui.txPage = 0;
  selectedTxIds.clear();
  updateBulkActionsBar();
  renderTransactions();
};
window.txPageNext = function() {
  state.ui.txPage = (state.ui.txPage || 0) + 1;
  selectedTxIds.clear();
  updateBulkActionsBar();
  renderTransactions();
};
window.txPagePrev = function() {
  state.ui.txPage = Math.max(0, (state.ui.txPage || 0) - 1);
  selectedTxIds.clear();
  updateBulkActionsBar();
  renderTransactions();
};
window.bulkDeleteTx = function() {
  if (selectedTxIds.size === 0) return;
  // Abre o modal customizado em vez do confirm() nativo
  const count = selectedTxIds.size;
  const descEl = document.getElementById('bulk-delete-desc');
  const labelEl = document.getElementById('tx-bulk-delete-label');
  if (descEl) descEl.textContent = `Tem certeza que deseja excluir permanentemente ${count} movimentação${count !== 1 ? 'ões' : ''}?`;
  if (labelEl) labelEl.textContent = `Excluir ${count} Movimentação${count !== 1 ? 'ões' : ''}`;
  document.getElementById('tx-bulk-delete-overlay')?.classList.remove('hidden');
};

function _executeBulkDelete() {
  document.getElementById('tx-bulk-delete-overlay')?.classList.add('hidden');
  let deletedValue = 0;
  const toDelete = Array.from(selectedTxIds);
  toDelete.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
      deletedValue += tx.value;
      deleteRemoteTransaction(id).catch(console.error);
    }
  });
  state.transactions = state.transactions.filter(t => !selectedTxIds.has(t.id));
  state.balance -= deletedValue;
  selectedTxIds.clear();
  saveState();
  if (window.appRenderAll) window.appRenderAll();
  else renderTransactions();
  updateBulkActionsBar();
  showToast(`${toDelete.length} transação${toDelete.length !== 1 ? 'ões' : ''} excluída${toDelete.length !== 1 ? 's' : ''}.`, 'info');
}
window.bulkChangeCategory = function() {
  showToast('Em breve: Edição em massa de categorias.', 'info');
};
window.bulkMarkPaid = function() {
  showToast('Em breve: Marcar múltiplos como pagos.', 'info');
};
let _txFilterTimeout;
window.debounceTxFilter = function() {
  clearTimeout(_txFilterTimeout);
  _txFilterTimeout = setTimeout(() => {
    state.ui.txSearch = document.getElementById('tx-search')?.value || '';
    state.ui.txPage = 0;
    renderTransactions();
  }, 300);
};

window.triggerTxFilter = function() {
  state.ui.txType = document.getElementById('tx-type-filter')?.value || 'all';
  state.ui.txStatus = document.getElementById('tx-status-filter')?.value || 'all';
  state.ui.txPage = 0;
  renderTransactions();
};

window.toggleTxFilterOrigin = function(origin) {
  if (state.ui.txOrigin === origin) {
     state.ui.txOrigin = 'all'; // toggle off
  } else {
     state.ui.txOrigin = origin;
  }
  state.ui.txPage = 0;
  renderTransactions();
};

window.sortTxTable = function(col) {
  const currentSort = state.ui.txSort || 'date-desc';
  const [currCol, currDir] = currentSort.split('-');
  
  // Toggle dir if same col, else default to 'asc' for non-date, 'desc' for date
  let newDir = 'asc';
  if (currCol === col) {
    newDir = currDir === 'asc' ? 'desc' : 'asc';
  } else {
    newDir = (col === 'date' || col === 'value') ? 'desc' : 'asc';
  }
  
  state.ui.txSort = `${col}-${newDir}`;
  renderTransactions();
};

window.txPagePeriodNext = function() {
  changeTransactionMonth(1);
};

window.txPagePeriodPrev = function() {
  changeTransactionMonth(-1);
};

function changeTransactionMonth(diff) {
  let d = state.ui.txDateStart ? new Date(state.ui.txDateStart + 'T12:00:00') : new Date();
  d.setMonth(d.getMonth() + diff);
  
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  
  // Format to YYYY-MM-DD local
  const fmt = (dt) => {
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  };
  
  state.ui.txDateStart = fmt(start);
  state.ui.txDateEnd = fmt(end);
  
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const label = document.getElementById('tx-period-label');
  if (label) label.textContent = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
  
  renderTransactions();
}

export function getFilteredTransactions() {
  let list = [...state.transactions];
  const search = normalizeText(state.ui.txSearch || '');

  if (search) {
    list = list.filter(item => normalizeText(`${item.desc} ${item.cat} ${item.date}`).includes(search));
  }

  if (state.ui.txCategory && state.ui.txCategory !== 'all') {
    list = list.filter(item => item.cat === state.ui.txCategory);
  }

  if (state.ui.txType && state.ui.txType !== 'all') {
    if (state.ui.txType === 'entrada') list = list.filter(item => item.value > 0);
    else if (state.ui.txType === 'saida') list = list.filter(item => item.value < 0);
  }

  if (state.ui.txOrigin && state.ui.txOrigin !== 'all') {
    list = list.filter(item => {
      const isCardInSystem = state.cards?.some(c => c.id === item.accountId) || item.cardId || item.payment?.includes('cartao');
      if (state.ui.txOrigin === 'bank') {
         return !isCardInSystem;
      } else if (state.ui.txOrigin === 'card') {
         return isCardInSystem;
      }
      return true;
    });
  }

  if (state.ui.txStatus && state.ui.txStatus !== 'all') {
    list = list.filter(item => {
      // [FIX] Usa o campo status armazenado, não heurística por descrição
      const stat = item.status === 'pendente' ? 'pendente' : 'concluido';
      return stat === state.ui.txStatus;
    });
  }

  if (state.ui.txDateStart) {
    const start = new Date(state.ui.txDateStart);
    start.setHours(0, 0, 0, 0);
    list = list.filter(item => parseDateBR(item.date) >= start);
  }
  if (state.ui.txDateEnd) {
    const end = new Date(state.ui.txDateEnd);
    end.setHours(23, 59, 59, 999);
    list = list.filter(item => parseDateBR(item.date) <= end);
  }

  const [col, dir] = (state.ui.txSort || 'date-desc').split('-');
  const asc = dir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    if (col === 'value') {
      return (Math.abs(a.value) - Math.abs(b.value)) * asc;
    } else if (col === 'desc') {
      return a.desc.localeCompare(b.desc) * asc;
    } else if (col === 'type') {
      const typeA = a.value > 0 ? 1 : -1;
      const typeB = b.value > 0 ? 1 : -1;
      return (typeA - typeB) * asc;
    } else if (col === 'status') {
      // Fake status compare
      const sA = (a.desc === 'Pendência') ? 0 : 1;
      const sB = (b.desc === 'Pendência') ? 0 : 1;
      return (sA - sB) * asc;
    } else {
      // Default col = 'date'
      return (parseDateBR(a.date) - parseDateBR(b.date)) * asc;
    }
  });

  return list;
}

export function renderTransactionFilters() {
  const txSearch = document.getElementById('tx-search');
  const txCategory = document.getElementById('tx-category');
  const txType = document.getElementById('tx-type-filter');
  const txStatus = document.getElementById('tx-status-filter');
  const txSort = document.getElementById('tx-sort');
  
  if (txSearch) txSearch.value = state.ui.txSearch || '';
  if (txType) txType.value = state.ui.txType || 'all';
  if (txStatus) txStatus.value = state.ui.txStatus || 'all';
  if (txSort) txSort.value = state.ui.txSort || 'date-desc';

  // Update table headers sorting arrows
  const sortState = state.ui.txSort || 'date-desc';
  const [sortCol, sortDir] = sortState.split('-');
  document.querySelectorAll('.tx-sort-ico').forEach(ico => {
    const col = ico.getAttribute('data-col');
    ico.className = 'fa-solid ml-2 text-[10px] tx-sort-ico';
    if (col === sortCol) {
      ico.classList.add(sortDir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down');
      ico.classList.add('text-white', 'opacity-100');
    } else {
      ico.classList.add('fa-arrow-up-arrow-down', 'opacity-40', 'group-hover:opacity-100');
    }
  });

  let activeFilters = 0;
  if (state.ui.txSearch) activeFilters++;
  if (state.ui.txCategory && state.ui.txCategory !== 'all') activeFilters++;
  if (state.ui.txType && state.ui.txType !== 'all') activeFilters++;
  if (state.ui.txStatus && state.ui.txStatus !== 'all') activeFilters++;
  if (state.ui.txDateStart || state.ui.txDateEnd) activeFilters++;
  
  const badge = document.getElementById('tx-filter-badge');
  if (badge) {
    if (activeFilters > 0) {
      badge.textContent = activeFilters;
      badge.classList.remove('hidden');
      badge.classList.add('inline-flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('inline-flex');
    }
  }

  const btnBank = document.getElementById('tx-filter-bank');
  const btnCard = document.getElementById('tx-filter-card');
  const activeClasses = ['bg-[#2E5C41]', 'border-transparent', 'text-white'];
  const inactiveClasses = ['border-white/10', 'bg-transparent', 'text-white/50'];
  if (btnBank) {
      if (state.ui.txOrigin === 'bank') {
          btnBank.classList.add(...activeClasses); btnBank.classList.remove(...inactiveClasses);
      } else {
          btnBank.classList.remove(...activeClasses); btnBank.classList.add(...inactiveClasses);
      }
  }
  if (btnCard) {
      if (state.ui.txOrigin === 'card') {
          btnCard.classList.add(...activeClasses); btnCard.classList.remove(...inactiveClasses);
      } else {
          btnCard.classList.remove(...activeClasses); btnCard.classList.add(...inactiveClasses);
      }
  }

  const categories = [...new Set([...getAllCategories(), ...state.transactions.map(item => item.cat)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!categories.includes(state.ui.txCategory)) {
    state.ui.txCategory = 'all';
  }

  if (txCategory) {
    txCategory.innerHTML = `
      <option value="all">Todas as categorias</option>
      ${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}
    `;
    txCategory.value = state.ui.txCategory;
  }
}

export function loadMoreTransactions() {
  state.ui.txPage = (state.ui.txPage || 0) + 1;
  renderTransactions();
}

export function renderTransactions() {
  renderTransactionFilters();
  const body = document.getElementById('transactions-body');
  if (!body) return;

  const fullList = getFilteredTransactions();
  const page = state.ui.txPage || 0;
  const pageSize = state.ui.txPageSize || 20;
  const list = fullList.slice(page * pageSize, (page + 1) * pageSize);
  const incomeTotal = fullList.filter(item => item.value > 0).reduce((acc, item) => acc + item.value, 0);
  const expenseTotal = fullList.filter(item => item.value < 0).reduce((acc, item) => acc + Math.abs(item.value), 0);
  const avgVisible = fullList.length ? fullList.reduce((acc, item) => acc + Math.abs(item.value), 0) / fullList.length : 0;

  if (document.getElementById('tx-count')) document.getElementById('tx-count').textContent = fullList.length;
  if (document.getElementById('tx-expense-total')) document.getElementById('tx-expense-total').textContent = formatMoney(expenseTotal);
  if (document.getElementById('tx-income-total')) document.getElementById('tx-income-total').textContent = formatMoney(incomeTotal);
  if (document.getElementById('tx-average-total')) document.getElementById('tx-average-total').textContent = formatMoney(avgVisible);

  // Update Footer Pagination UI
  const totalEl = document.getElementById('tx-page-total');
  const rangeEl = document.getElementById('tx-page-range');
  const prevBtn = document.getElementById('tx-page-prev');
  const nextBtn = document.getElementById('tx-page-next');
  if (totalEl) totalEl.textContent = fullList.length;
  if (rangeEl) {
    const startIdx = fullList.length === 0 ? 0 : (page * pageSize) + 1;
    const endIdx = Math.min((page + 1) * pageSize, fullList.length);
    rangeEl.textContent = `${startIdx}-${endIdx}`;
  }
  if (prevBtn) prevBtn.disabled = page === 0;
  if (nextBtn) nextBtn.disabled = (page + 1) * pageSize >= fullList.length;
  
  const selectAllCb = document.getElementById('tx-select-all');
  if(selectAllCb) selectAllCb.checked = (list.length > 0 && list.every(t => selectedTxIds.has(t.id)));

  if (state.isNewUser && selectedTxIds.size === 0 && list.some(t => t.desc === 'Pendência') && !window._demoChecked) {
    const pendencia = list.find(t => t.desc === 'Pendência');
    selectedTxIds.add(pendencia.id);
    window._demoChecked = true;
    // Agendar atualização da barra fora do fluxo de renderização
    setTimeout(() => updateBulkActionsBar(), 50);
  }

  if (!fullList.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-16 text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)">
              <i class="fa-solid fa-magnifying-glass text-white/30 text-xl"></i>
            </div>
            <p class="text-white/45 font-medium">Nenhuma transação encontrada</p>
            <p class="text-white/28 text-sm">Ajuste os filtros ou adicione uma nova transação</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = list.map(item => {
    const positive = item.value > 0;
    
    // [FIX] Usa campo status armazenado na transação — elimina heurística por descrição
    const stat = item.status === 'pendente' ? 'pendente' : 'concluido';

    let statClass = '';
    let statLabel = '';
    if (stat === 'pendente') {
      statClass = 'border-[#dba740]/40 bg-[#dba740]/10 text-[#dba740]';
      statLabel = 'Pendente';
    } else if (stat === 'vencido') {
      statClass = 'border-[#e84e58]/40 bg-[#e84e58]/10 text-[#e84e58]';
      statLabel = 'Vencido';
    } else {
      statClass = 'border-[#37bf8b]/40 bg-[#37bf8b]/10 text-[#37bf8b]';
      statLabel = 'Concluído';
    }

    let originIcon = '<i class="fa-solid fa-building-columns text-white/30 text-[10px]" title="Conta Bancária"></i>';
    if (item.accountId && state.cards?.some(c => c.id === item.accountId)) {
        originIcon = '<i class="fa-regular fa-credit-card text-white/30 text-[10px]" title="Cartão de Crédito"></i>';
    } else if (item.cardId || item.payment?.includes('cartao')) {
        originIcon = '<i class="fa-regular fa-credit-card text-white/30 text-[10px]" title="Cartão de Crédito"></i>';
    }

    const typeHtml = positive
      ? `<div class="flex items-center justify-start md:justify-center gap-2"><i class="fa-regular fa-circle-up text-[#37bf8b]"></i> Entrada ${originIcon}</div>`
      : `<div class="flex items-center justify-start md:justify-center gap-2"><i class="fa-regular fa-circle-down text-[#e84e58]"></i> Saída ${originIcon}</div>`;

    return `
      <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] group">
        <td class="px-5 py-4 w-12 text-center align-middle">
          <label class="relative flex items-center justify-center cursor-pointer m-0">
            <input type="checkbox" onchange="window.toggleTxRow(this, '${item.id}')" class="peer sr-only tx-row-checkbox" ${selectedTxIds.has(item.id) ? 'checked' : ''}>
            <div class="w-4 h-4 rounded-[4px] border border-white/20 peer-checked:bg-[#37bf8b] peer-checked:border-[#37bf8b] transition-all flex items-center justify-center">
              <i class="fa-solid fa-check text-[10px] text-[#0d121c] opacity-0 peer-checked:opacity-100 transition-opacity"></i>
            </div>
          </label>
        </td>
        
        <td class="px-4 py-4 text-white hover:text-white/80 transition-colors">
          ${escapeHtml(item.date)}
        </td>
        
        <td class="px-4 py-4 text-white font-semibold">
           ${escapeHtml(item.desc)}
        </td>
        
        <td class="px-4 py-4 text-white">
           <div class="flex items-center">
             ${typeHtml}
           </div>
        </td>

        <td class="px-4 py-4 text-right font-bold text-sm ${positive ? 'text-[#37bf8b]' : 'text-[#e84e58]'}">
           ${positive ? '+' : '-'}R$ ${formatMoney(Math.abs(item.value)).replace('R$ ', '')}
        </td>

        <td class="px-4 py-4 text-center">
          <div class="flex items-center justify-center">
            <span class="inline-flex items-center justify-center rounded px-3 py-1 border text-[11px] font-bold ${statClass}">
                ${statLabel}
            </span>
          </div>
        </td>

        <td class="px-5 py-4">
          <div class="flex items-center justify-center gap-3">
             <button onclick="openEditTx('${item.id}')" title="Editar" class="text-white/40 hover:text-white transition-colors">
               <i class="fa-regular fa-clock text-xs"></i>
             </button>
             <button onclick="openEditTx('${item.id}')" title="Opções" class="text-white/40 hover:text-white transition-colors">
               <i class="fa-solid fa-ellipsis text-sm"></i>
             </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function openTxModal() {
  _editingTxId = null;
  document.getElementById('tx-modal-title').textContent = 'Nova Transação';
  
  // Limpa campos básicos
  ['desc', 'value', 'split', 'notes'].forEach(f => {
    const el = document.getElementById(`tx-modal-${f}`);
    if (el) el.value = '';
  });
  
  const bdDate = document.getElementById('tx-modal-date');
  if (bdDate) bdDate.value = new Date().toLocaleDateString('pt-BR');
  
  const typeValue = 'saida';
  const typeInput = document.getElementById('tx-modal-type');
  if (typeInput) typeInput.value = typeValue;

  // Sincroniza abas visuais do novo design
  const btnEntrada = document.getElementById('btn-entrada');
  const btnSaida = document.getElementById('btn-saida');
  if (btnEntrada && btnSaida) {
    btnEntrada.classList.remove('active');
    btnSaida.classList.add('active');
  }
  _syncTypeTabs(typeValue);
  
  // Reseta toggles customizados
  const realizedWrap = document.getElementById('toggle-pagamento-realizado');
  if (realizedWrap) realizedWrap.classList.remove('active');
  const realizedChk = document.getElementById('tx-modal-realized');
  if (realizedChk) realizedChk.checked = false;

  const recurringWrap = document.getElementById('toggle-recorrente-wrap');
  if (recurringWrap) recurringWrap.classList.remove('active');
  const recurringChk = document.getElementById('tx-modal-recurring');
  if (recurringChk) recurringChk.checked = false;

  // Inicializa seletores ricos
  populateCategorySelect(null, 'Alimentação'); // O populateCategorySelect já limpa e insere
  if (window.txCategoryInstance) window.txCategoryInstance.setValue('Alimentação');

  populateAccountSelect(null, '');
  if (window.txAccountInstance) window.txAccountInstance.setValue('');

  // Limpa anexos
  const attachNameEl = document.getElementById('tx-attachment-name');
  if (attachNameEl) attachNameEl.textContent = 'Clique para anexar imagem ou PDF';
  const attachInput = document.getElementById('tx-modal-attachment');
  if (attachInput) attachInput.value = '';

  const errEl = document.getElementById('tx-modal-error');
  if (errEl) errEl.classList.add('hidden');

  // Reseta accordion
  const areaMore = document.getElementById('tx-more-details-area');
  const btnMore = document.getElementById('tx-more-details-btn');
  if (areaMore) areaMore.classList.remove('open');
  if (btnMore) {
    btnMore.innerHTML = 'Mais detalhes <i data-lucide="chevron-down"></i>';
    if (window.lucide) window.lucide.createIcons();
  }

  document.getElementById('tx-modal-overlay')?.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => document.getElementById('tx-modal-desc')?.focus(), 150);
}

export function openEditTx(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  _editingTxId = id;

  document.getElementById('tx-modal-title').textContent = 'Editar Transação';
  document.getElementById('tx-modal-desc').value = tx.desc;
  
  // Popular e selecionar Categoria
  populateCategorySelect(null, tx.cat);
  if (window.txCategoryInstance) window.txCategoryInstance.setValue(tx.cat);

  const dateInput = document.getElementById('tx-modal-date');
  if (dateInput) dateInput.value = tx.date;
  
  document.getElementById('tx-modal-value').value = "R$ " + formatMoney(Math.abs(tx.value)).replace('R$ ', '');
  document.getElementById('tx-modal-split').value = tx.installments > 1 ? tx.installments : '';
  
  // Popular e selecionar Conta/Cartão
  const selectValue = tx.cardId || tx.accountId || 'principal';
  populateAccountSelect(null, selectValue);
  if (window.txAccountInstance) window.txAccountInstance.setValue(selectValue);

  const isIncome = tx.value > 0;
  const typeValue = isIncome ? 'entrada' : 'saida';
  const typeInput = document.getElementById('tx-modal-type');
  if (typeInput) typeInput.value = typeValue;

  // Sincroniza abas visuais
  const btnEntrada = document.getElementById('btn-entrada');
  const btnSaida = document.getElementById('btn-saida');
  if (btnEntrada && btnSaida) {
    if (isIncome) {
      btnEntrada.classList.add('active');
      btnSaida.classList.remove('active');
    } else {
      btnSaida.classList.add('active');
      btnEntrada.classList.remove('active');
    }
  }
  _syncTypeTabs(typeValue);

  // Toggles customizados
  const realized = (tx.status !== 'pendente');
  const realizedWrap = document.getElementById('toggle-pagamento-realizado');
  const realizedChk = document.getElementById('tx-modal-realized');
  if (realizedWrap) realizedWrap.classList.toggle('active', realized);
  if (realizedChk) realizedChk.checked = realized;

  const recurring = !!tx.recurringTemplate;
  const recurringWrap = document.getElementById('toggle-recorrente-wrap');
  const recurringChk = document.getElementById('tx-modal-recurring');
  if (recurringWrap) recurringWrap.classList.toggle('active', recurring);
  if (recurringChk) recurringChk.checked = recurring;

  // Observações e Anexo
  const notesEl = document.getElementById('tx-modal-notes');
  if (notesEl) notesEl.value = tx.notes || '';
  const attachNameEl = document.getElementById('tx-attachment-name');
  if (attachNameEl) {
    attachNameEl.textContent = tx.attachmentUrl 
      ? tx.attachmentUrl.split('/').pop() 
      : 'Clique para anexar imagem ou PDF';
  }

  document.getElementById('tx-modal-error')?.classList.add('hidden');
  document.getElementById('tx-modal-overlay')?.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

export async function handleOcrImageInput(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const btn = document.getElementById('tx-ocr-btn');
  const ogHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span class="hidden sm:inline">Lendo...</span>';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  
  try {
    if (!window.Tesseract) throw new Error('OCR Indisponível (Sem internet para carregar o Tesseract)');
    const worker = await Tesseract.createWorker('por');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    
    // Procura por formato de Moeda: R$ 10,00 ou 10.00
    const valueMatch = text.match(/(?:R\$|r\$)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/);
    if (valueMatch) {
      document.getElementById('tx-modal-value').value = valueMatch[1];
    } else {
      // Tenta numero simples com ponto ou virgula no final do texto
      const simpleMatch = text.match(/(\d+[.,]\d{2})\b/);
      if (simpleMatch) document.getElementById('tx-modal-value').value = simpleMatch[1].replace('.', ',');
    }
    
    // Tenta pinçar um nome descritivo (linha mais longa que não pareça apenas números/datas)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 4);
    const descLine = lines.find(l => !l.includes('R$') && !/\d{2,}/.test(l) && !l.toLowerCase().includes('total'));
    if (descLine) {
      document.getElementById('tx-modal-desc').value = descLine.substring(0, 30);
    } else {
      document.getElementById('tx-modal-desc').value = 'Comprovante Escaneado';
    }
    
    // [FIX] Atualiza o <select> de tipo (substituiu os radios antigos)
    const typeSelect = document.getElementById('tx-modal-type');
    if (typeSelect) typeSelect.value = 'saida';

    showToast('Comprovante processado! Revise os valores.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Falha ao extrair texto da imagem.', 'danger');
  } finally {
    btn.innerHTML = ogHtml;
    btn.disabled = false;
    btn.style.opacity = '1';
    e.target.value = '';
  }
}

export function confirmDeleteTx(id) {
  _txToDelete = id;
  document.getElementById('tx-delete-overlay')?.classList.remove('hidden');
}

export function exportTransactionsCSV() {
  if (!state.transactions || !state.transactions.length) return showToast('Nenhuma transação para exportar', 'warning');
  
  const csvRows = ['Data,Descricao,Categoria,Valor'];
  [...state.transactions].sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(t => {
    const valStr = t.value.toFixed(2).replace('.', ',');
    csvRows.push(`"${t.date}","${t.desc}","${t.cat}","${valStr}"`);
  });
  
  const bom = "\uFEFF"; 
  const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grokfin_extrato_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Download do CSV concluído.', 'success');
}

export function exportTransactionsPDF() {
  if (!window.jspdf) return showToast('Módulo PDF carregando. Tente novamente.', 'warning');
  if (!state.transactions || !state.transactions.length) return showToast('Nenhuma transação para exportar', 'warning');

  const doc = new window.jspdf.jsPDF();
  doc.text('GrokFin Elite - Extrato de Transações', 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);

  const tableData = [...state.transactions].sort((a,b)=> new Date(b.date)-new Date(a.date)).map(t => {
    const dObj = new Date(t.date + 'T12:00:00');
    return [
      dObj.toLocaleDateString('pt-BR'),
      t.desc,
      t.cat,
      (t.value > 0 ? '+' : '') + formatMoney(Math.abs(t.value))
    ];
  });

  doc.autoTable({
    startY: 28,
    head: [['Data', 'Descrição', 'Categoria', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [0, 245, 255], textColor: [0,0,0] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { font: 'helvetica', fontSize: 9 }
  });

  doc.save(`grokfin_extrato_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('Download do PDF concluído.', 'success');
}

export function deleteTx() {
  if (!_txToDelete) return;
  const oldVal = state.transactions.find(t => t.id === _txToDelete)?.value || 0;
  
  // Apaga do BD remoto silenciosamente
  deleteRemoteTransaction(_txToDelete).catch(e => console.error('[UI] Deleção remota falhou', e));
  
  state.transactions = state.transactions.filter(t => t.id !== _txToDelete);
  state.balance -= oldVal;
  _txToDelete = null;
  saveState();
  
  document.getElementById('tx-delete-overlay')?.classList.add('hidden');
  renderTransactions();
  showToast('Transação excluída.', 'info');
  // Re-render app areas normally synced via switchTab
  if (window.appRenderAll) window.appRenderAll();
}

export function saveTxModal() {
  const desc = document.getElementById('tx-modal-desc').value.trim();
  const cat = document.getElementById('tx-modal-cat').value;
  const dateStr = document.getElementById('tx-modal-date').value.trim();
  const rawValue = parseCurrencyInput(document.getElementById('tx-modal-value').value);
  
  const selectedId = document.getElementById('tx-modal-account').value;
  const typeValue = document.getElementById('tx-modal-type').value;
  const isIncome = typeValue === 'entrada';
  
  const isCardSelected = !!(selectedId && state.cards?.some(c => c.id === selectedId));
  const accountId = isCardSelected ? null : (selectedId || 'principal');
  const cardId = isCardSelected ? selectedId : null;
  const payment = isCardSelected ? 'cartao_credito' : 'conta';
  
  const isRecurring = document.getElementById('tx-modal-recurring')?.checked;
  const installments = parseInt(document.getElementById('tx-modal-split').value) || 1;
  const notes = document.getElementById('tx-modal-notes')?.value.trim() || null;
  const attachFile = document.getElementById('tx-modal-attachment')?.files?.[0] || null;
  const txStatus = document.getElementById('tx-modal-realized')?.checked ? 'efetivado' : 'pendente';

  const errEl = document.getElementById('tx-modal-error');

  if (!desc) { errEl.textContent = 'A descrição é obrigatória.'; errEl.classList.remove('hidden'); return; }
  if (!selectedId) { errEl.textContent = 'Selecione uma conta ou cartão.'; errEl.classList.remove('hidden'); return; }
  if (!dateStr || dateStr.length < 8) { errEl.textContent = 'Use o formato DD/MM/AAAA.'; errEl.classList.remove('hidden'); return; }
  if (!rawValue) { errEl.textContent = 'O valor informado é inválido.'; errEl.classList.remove('hidden'); return; }

  const finalValue = isIncome ? rawValue : -rawValue;
  const installValue = Number((finalValue / installments).toFixed(2));

  // [FIX TX] Helper para upload de arquivo no Supabase Storage.
  // Retorna a URL pública do anexo ou null se não houver arquivo / Storage não configurado.
  async function uploadAttachment(file, txId) {
    if (!file) return null;
    try {
      const { supabase } = await import('../services/supabase.js');
      if (!supabase) return null;
      const ext = file.name.split('.').pop();
      const path = `attachments/${txId}.${ext}`;
      const { error } = await supabase.storage.from('transaction-attachments').upload(path, file, { upsert: true });
      if (error) { console.warn('[GrokFin] Falha no upload do anexo:', error.message); return null; }
      const { data } = supabase.storage.from('transaction-attachments').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (e) {
      console.warn('[GrokFin] Supabase Storage indisponível:', e.message);
      return null;
    }
  }

  if (_editingTxId) {
    const idx = state.transactions.findIndex(t => t.id === _editingTxId);
    if (idx >= 0) {
      const diff = finalValue - state.transactions[idx].value;
      state.balance += diff;
      // Mantém attachmentUrl existente se não houver novo arquivo
      const existingUrl = state.transactions[idx].attachmentUrl || null;
      state.transactions[idx] = { 
        ...state.transactions[idx], 
        desc, cat, date: dateStr, value: finalValue, accountId,
        payment, cardId: (isCardSelected ? cardId : null),
        status: txStatus, // [FIX] persiste status real
        recurringTemplate: isRecurring,
        notes,
        attachmentUrl: existingUrl
      };
      const txId = state.transactions[idx].id;
      saveState();
      showToast('Transação atualizada com sucesso.', 'success');

      // [FIX TX] Upload assíncrono do novo anexo (se houver) — não bloqueia o save
      if (attachFile) {
        uploadAttachment(attachFile, txId).then(url => {
          if (url) {
            const i = state.transactions.findIndex(t => t.id === txId);
            if (i >= 0) { state.transactions[i].attachmentUrl = url; saveState(); }
          }
        });
      }
    }
  } else {
    const newIds = [];
    for (let i = 0; i < installments; i++) {
      let d = parseDateBR(dateStr);
      if (!d) d = new Date();
      d.setMonth(d.getMonth() + i);
      const mDate = new Intl.DateTimeFormat('pt-BR').format(d);
      const txId = uid('tx');
      newIds.push(txId);
      const iDesc = installments > 1 ? `${desc} (${i + 1}/${installments})` : desc;

      state.transactions.unshift({
        id: txId,
        date: mDate,
        desc: iDesc,
        cat,
        value: installValue,
        accountId,
        payment,
        cardId: (isCardSelected ? cardId : null),
        status: txStatus, // [FIX] persiste status real do lançamento
        recurringTemplate: (i === 0 && isRecurring) ? true : undefined,
        installments: installments > 1 ? installments : undefined,
        installmentCurrent: installments > 1 ? i + 1 : undefined,
        notes: (i === 0) ? notes : null,
        attachmentUrl: null
      });

      // [FIX] Cartão de crédito: adiciona à fatura do cartão para aparecer no painel de faturas
      // O saldo total NÃO é afetado aqui — CC é passivo; balance é recalculado em saveState()
      if (isCardSelected && !isIncome) {
        const linkedCard = state.cards?.find(c => c.id === cardId);
        if (linkedCard) {
          if (!linkedCard.invoices) linkedCard.invoices = [];
          linkedCard.invoices.unshift({
            id: uid('ctx'),
            txRefId: txId,
            desc: iDesc,
            cat,
            value: Math.abs(installValue),
            installments: installments > 1 ? installments : undefined,
            installmentCurrent: installments > 1 ? i + 1 : undefined
          });
          linkedCard.used = Number((linkedCard.used + Math.abs(installValue)).toFixed(2));
        }
      }
    }
    saveState();
    showToast(installments > 1 ? `Criada em ${installments} parcelas.` : (isRecurring ? 'Transação e recorrência criadas.' : 'Transação criada com sucesso.'), 'success');

    // [FIX TX] Upload do anexo vinculado à primeira parcela
    if (attachFile && newIds.length > 0) {
      uploadAttachment(attachFile, newIds[0]).then(url => {
        if (url) {
          const i = state.transactions.findIndex(t => t.id === newIds[0]);
          if (i >= 0) { state.transactions[i].attachmentUrl = url; saveState(); }
        }
      });
    }
  }

  document.getElementById('tx-modal-overlay')?.classList.add('hidden');
  renderTransactions();
  if (window.appRenderAll) window.appRenderAll();
}

export function bindTxEvents() {
  const el = id => document.getElementById(id);

  // --- Filtros do Topo (Dashboard) ---
  el('tx-filter-btn')?.addEventListener('click', () => { el('tx-filter-menu')?.classList.toggle('hidden'); });
  el('tx-filter-close')?.addEventListener('click', () => { el('tx-filter-menu')?.classList.add('hidden'); });
  
  const filterIdToStateKey = {
    'tx-search': 'txSearch',
    'tx-category': 'txCategory',
    'tx-sort': 'txSort'
  };
  ['tx-search', 'tx-category', 'tx-sort'].forEach(id => {
    el(id)?.addEventListener('input', (e) => {
      const key = filterIdToStateKey[id];
      if (key) state.ui[key] = e.target.value;
      state.ui.txPage = 0;
      renderTransactions();
    });
  });

  el('tx-reset')?.addEventListener('click', () => {
    state.ui.txSearch = '';
    state.ui.txCategory = 'all';
    state.ui.txSort = 'date-desc';
    state.ui.txDateStart = null;
    state.ui.txDateEnd = null;
    state.ui.txOrigin = 'all';
    state.ui.txPage = 0;
    renderTransactions();
    const periodLabel = document.getElementById('tx-period-label');
    if (periodLabel) periodLabel.textContent = 'Filtrar por período';
  });

  // --- Filtro de Calendário ---
  const periodBtn = el('tx-period-btn');
  if (periodBtn) {
    const CAL_MONTH_NAMES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    let calState = { current: new Date(), start: null, end: null, savedStart: null, savedEnd: null };

    function calIsSame(a, b) { if (!a || !b) return false; return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function calInRange(d) { if (!calState.start || !calState.end) return false; return d > calState.start && d < calState.end; }
    
    function renderCalendar() {
      const grid = document.getElementById('cal-grid');
      const display = document.getElementById('cal-month-display');
      if (!grid || !display) return;
      display.textContent = `${CAL_MONTH_NAMES[calState.current.getMonth()]} ${calState.current.getFullYear()}`;
      grid.innerHTML = '';
      ['DOM','SEG','TER','QUA','QUI','SEX','SAB'].forEach(d => { grid.innerHTML += `<div class="text-center text-[10px] font-bold tracking-widest pb-2" style="color:rgba(255,255,255,.35)">${d}</div>`; });
      const year = calState.current.getFullYear(), month = calState.current.getMonth();
      const firstDay = new Date(year, month, 1).getDay(), totalDays = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;
      for (let i = 1; i <= totalDays; i++) {
        const thisDate = new Date(year, month, i, 12);
        const isStart = calIsSame(thisDate, calState.start), isEnd = calIsSame(thisDate, calState.end), inRange = calInRange(thisDate);
        let cls = 'aspect-square flex items-center justify-center text-sm font-medium rounded-xl cursor-pointer transition-all ';
        let style = '';
        if (isStart || isEnd) { cls += 'font-bold text-black '; style = 'background:linear-gradient(135deg,#00f5ff,#00ff85);box-shadow:0 0 12px rgba(0,245,255,.3)'; }
        else if (inRange) { cls += 'text-cyan-300 '; style = 'background:rgba(0,245,255,.1)'; }
        else { cls += 'text-white/80 hover:bg-white/10 '; }
        grid.innerHTML += `<div class="${cls}" style="${style}" data-cal-day="${i}">${i}</div>`;
      }
      grid.dataset.calYear = year; grid.dataset.calMonth = month;
    }

    if (!document.getElementById('tx-calendar-dropdown')) {
      const drop = document.createElement('div');
      drop.id = 'tx-calendar-dropdown';
      drop.className = 'hidden absolute top-[115%] right-0 z-[60] w-[340px] overflow-hidden rounded-[20px] border border-cyan-400/20 bg-[#0f1829] shadow-[0_32px_72px_rgba(0,0,0,.95),inset_0_0_0_1px_rgba(255,255,255,.05)]';
      drop.innerHTML = `<div class="flex items-center justify-between border-b border-white/10 px-5 py-4"><div id="cal-month-display" class="text-xs font-bold uppercase tracking-widest text-white/80">—</div><div class="flex gap-2"><button id="cal-prev" class="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"><i class="fa-solid fa-chevron-left"></i></button><button id="cal-next" class="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"><i class="fa-solid fa-chevron-right"></i></button></div></div><div class="p-3"><div id="cal-grid" class="grid grid-cols-7 gap-y-0.5 gap-x-0"></div></div><div id="cal-footer-label" class="border-t border-white/10 px-5 py-2.5 text-center text-xs font-semibold tracking-wide text-cyan-400/80">Selecione o período</div><div class="flex gap-2 p-4 pt-0"><button id="cal-clear-btn" class="flex-1 rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs font-semibold text-white/60 hover:bg-white/10">Limpar</button><button id="cal-apply-btn" class="flex-1 rounded-xl border-none p-2.5 text-xs font-bold text-black" style="background:linear-gradient(135deg,#00f5ff,#00ff85)">Aplicar</button></div>`;
      document.body.appendChild(drop);

      const pos = () => {
        const btn = el('tx-period-btn'); if (!btn || drop.classList.contains('hidden')) return;
        const rect = btn.getBoundingClientRect();
        drop.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        drop.style.left = (rect.left + 340 > window.innerWidth) ? 'auto' : rect.left + 'px';
        drop.style.right = (rect.left + 340 > window.innerWidth) ? (document.body.clientWidth - rect.right) + 'px' : 'auto';
      };
      window.addEventListener('resize', pos); window.addEventListener('scroll', pos, true);

      drop.addEventListener('click', e => {
        const dayEl = e.target.closest('[data-cal-day]');
        if (dayEl) {
          const grid = el('cal-grid');
          const clicked = new Date(parseInt(grid.dataset.calYear), parseInt(grid.dataset.calMonth), parseInt(dayEl.dataset.calDay), 12);
          if (!calState.start || (calState.start && calState.end)) { calState.start = clicked; calState.end = null; }
          else if (clicked < calState.start) { calState.start = clicked; }
          else { calState.end = clicked; }
          renderCalendar(); return;
        }
        if (e.target.closest('#cal-prev')) { calState.current.setMonth(calState.current.getMonth() - 1); renderCalendar(); return; }
        if (e.target.closest('#cal-next')) { calState.current.setMonth(calState.current.getMonth() + 1); renderCalendar(); return; }
        if (e.target.closest('#cal-apply-btn')) {
          if (calState.start) {
            calState.savedStart = calState.start; calState.savedEnd = calState.end || calState.start;
            state.ui.txDateStart = calState.savedStart.toISOString().split('T')[0];
            state.ui.txDateEnd = calState.savedEnd.toISOString().split('T')[0];
            updatePeriodLabel(); drop.classList.add('hidden'); renderTransactions();
          }
          return;
        }
        if (e.target.closest('#cal-clear-btn')) { calState.start = calState.end = calState.savedStart = calState.savedEnd = null; state.ui.txDateStart = state.ui.txDateEnd = null; updatePeriodLabel(); renderTransactions(); drop.classList.add('hidden'); return; }
      });
      document.addEventListener('click', e => { if (!drop.contains(e.target) && !periodBtn.contains(e.target)) drop.classList.add('hidden'); });
    }

    const updatePeriodLabel = () => {
      const lbl = el('tx-period-label'); if (!lbl) return;
      lbl.textContent = (calState.savedStart) ? `${calState.savedStart.toLocaleDateString('pt-BR')} → ${calState.savedEnd.toLocaleDateString('pt-BR')}` : 'Filtrar por período';
      lbl.style.color = (calState.savedStart) ? '#00f5ff' : '';
    };

    periodBtn.addEventListener('click', () => { if (drop.classList.contains('hidden')) { pos(); renderCalendar(); drop.classList.remove('hidden'); } else drop.classList.add('hidden'); });
  }

  // --- Funcionalidades do Modal "Nova Transação" ---
  if (el('tx-conta-select')) window.txAccountInstance = new ModernFloxSelect(el('tx-conta-select'));
  if (el('tx-categoria-select')) window.txCategoryInstance = new ModernFloxSelect(el('tx-categoria-select'));

  el('tx-add-btn')?.addEventListener('click', openTxModal);
  el('tx-modal-close')?.addEventListener('click', () => el('tx-modal-overlay')?.classList.add('hidden'));
  el('tx-modal-cancel')?.addEventListener('click', () => el('tx-modal-overlay')?.classList.add('hidden'));
  el('tx-modal-save')?.addEventListener('click', saveTxModal);

  // Tabs de Entrada/Saída
  const btnEntrada = el('btn-entrada'), btnSaida = el('btn-saida'), txModalType = el('tx-modal-type');
  if (btnEntrada && btnSaida) {
    btnEntrada.addEventListener('click', () => { btnEntrada.classList.add('active'); btnSaida.classList.remove('active'); if (txModalType) txModalType.value = 'entrada'; _syncTypeTabs('entrada'); });
    btnSaida.addEventListener('click', () => { btnSaida.classList.add('active'); btnEntrada.classList.remove('active'); if (txModalType) txModalType.value = 'saida'; _syncTypeTabs('saida'); });
  }

  // Accordion Mais detalhes (PRECISO)
  const btnMore = el('tx-more-details-btn');
  const areaMore = el('tx-more-details-area');
  const modalBody = el('modal-body-scroll');
  if (btnMore && areaMore) {
    btnMore.addEventListener('click', () => {
      const isOpen = areaMore.classList.contains('open');
      if (isOpen) {
        areaMore.classList.remove('open');
        btnMore.classList.remove('active');
        btnMore.innerHTML = 'Mais detalhes <i data-lucide="chevron-down"></i>';
      } else {
        areaMore.classList.add('open');
        btnMore.classList.add('active');
        btnMore.innerHTML = 'Menos detalhes <i data-lucide="chevron-up"></i>';
        // Scroll suave para revelar o conteúdo
        setTimeout(() => {
          if (modalBody) modalBody.scrollTo({ top: modalBody.scrollHeight, behavior: 'smooth' });
        }, 50);
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Toggles de status/recorrência
  el('toggle-pagamento-realizado')?.addEventListener('click', function() { this.classList.toggle('active'); const chk = el('tx-modal-realized'); if (chk) chk.checked = this.classList.contains('active'); });
  el('toggle-recorrente-wrap')?.addEventListener('click', function() { this.classList.toggle('active'); const chk = el('tx-modal-recurring'); if (chk) chk.checked = this.classList.contains('active'); });

  // OCR
  el('tx-ocr-btn')?.addEventListener('click', () => el('tx-ocr-input')?.click());
  el('tx-ocr-input')?.addEventListener('change', handleOcrImageInput);

  // Criador de Categoria Inline (Sincronizado)
  el('btn-open-builder')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const btnOpen = el('btn-open-builder');
    const optionsList = el('tx-cat-options-list');
    const builderForm = el('builder-form');
    if (btnOpen) btnOpen.style.display = 'none';
    if (optionsList) optionsList.style.display = 'none';
    if (builderForm) builderForm.style.display = 'flex';
    el('new-cat-name')?.focus();
  });

  el('btn-cancel-cat')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const builderForm = el('builder-form');
    const optionsList = el('tx-cat-options-list');
    const btnOpen = el('btn-open-builder');
    if (builderForm) builderForm.style.display = 'none';
    if (optionsList) optionsList.style.display = 'block';
    if (btnOpen) btnOpen.style.display = 'flex';
  });

  el('btn-save-cat')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const nameInput = el('new-cat-name');
    const name = nameInput?.value.trim();
    if (name && addCustomCategory(name)) {
      populateCategorySelect(null, name);
      // O populateCategorySelect já deve disparar a seleção no ModernFloxSelect
      const builderForm = el('builder-form');
      const optionsList = el('tx-cat-options-list');
      const btnOpen = el('btn-open-builder');
      if (builderForm) builderForm.style.display = 'none';
      if (optionsList) optionsList.style.display = 'block';
      if (btnOpen) btnOpen.style.display = 'flex';
      if (nameInput) nameInput.value = '';
      showToast(`Categoria "${name}" criada!`, "success");
    } else {
      showToast("Nome inválido ou categoria já existe.", "warning");
    }
  });

  // Exportação e outros
  el('tx-export-csv')?.addEventListener('click', exportTransactionsCSV);
  el('tx-export-pdf')?.addEventListener('click', exportTransactionsPDF);
  el('tx-delete-cancel')?.addEventListener('click', () => el('tx-delete-overlay')?.classList.add('hidden'));
  el('tx-delete-confirm')?.addEventListener('click', deleteTx);
  el('tx-bulk-delete-cancel')?.addEventListener('click', () => el('tx-bulk-delete-overlay')?.classList.add('hidden'));
  el('tx-bulk-delete-confirm')?.addEventListener('click', _executeBulkDelete);

  // Mascara e Dates
  el('tx-modal-value')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v) { v = (v / 100).toFixed(2).replace(".", ","); e.target.value = "R$ " + v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); }
  });
  if (window.flatpickr) {
    const commonDateCfg = { 
      dateFormat: "d/m/Y", locale: "pt", allowInput: true, disableMobile: true, static: false, position: "auto",
      onOpen: function(selectedDates, dateStr, instance) {
        instance.calendarContainer.classList.add('glass');
      },
      nextArrow: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      prevArrow: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
      onReady: function(selectedDates, dateStr, instance) {
        const yearWrapper = instance.currentYearElement.parentNode;
        const yearSelect = document.createElement('select');
        yearSelect.className = 'custom-year-select';
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 10; i <= currentYear + 10; i++) {
          const option = document.createElement('option');
          option.value = i; option.text = i;
          yearSelect.appendChild(option);
        }
        yearSelect.value = instance.currentYear;
        yearSelect.addEventListener('change', function(e) { instance.changeYear(Number(e.target.value)); });
        yearWrapper.style.display = 'none';
        yearWrapper.parentNode.insertBefore(yearSelect, yearWrapper.nextSibling);
      },
      onYearChange: function(selectedDates, dateStr, instance) {
        const customSelect = instance.monthNav.querySelector('.custom-year-select');
        if (customSelect) customSelect.value = instance.currentYear;
      }
    };
    flatpickr("#tx-modal-date", commonDateCfg);
    flatpickr("#tx-modal-due-date", commonDateCfg);
  }

  window.confirmDeleteCategory = (option, selectInstance) => {
    const name = option.dataset.value;
    const confirmModal = document.getElementById('delete-cat-confirm-modal');
    const nameSpan = document.getElementById('cat-to-delete-name');
    if (!confirmModal || !nameSpan) return;

    nameSpan.textContent = name;
    confirmModal.classList.add('open');

    const btnConfirm = document.getElementById('btn-confirm-cat-delete');
    const btnCancel = document.getElementById('btn-cancel-cat-delete');

    const onConfirm = () => {
      state.customCategories = (state.customCategories || []).filter(c => c !== name);
      saveState();
      populateCategorySelect(null, '');
      confirmModal.classList.remove('open');
      showToast(`Categoria "${name}" removida.`, "info");
      cleanup();
    };

    const onCancel = () => { confirmModal.classList.remove('open'); cleanup(); };
    const cleanup = () => { 
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
  };

  window.openEditTx = openEditTx; window.confirmDeleteTx = confirmDeleteTx; window.loadMoreTransactions = loadMoreTransactions;
}
