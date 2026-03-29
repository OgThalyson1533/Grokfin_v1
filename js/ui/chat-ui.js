/**
 * js/ui/chat-ui.js
 * Lógica do assistente chat, integração com AI e fallback.
 */

import { state, saveState } from '../state.js';
import { uid } from '../utils/math.js';
import { richText, formatMoney, parseCurrencyInput, formatPercent } from '../utils/format.js';
import { formatShortTime } from '../utils/date.js';
import { calculateAnalytics } from '../analytics/engine.js';
import { showToast, normalizeText } from '../utils/dom.js';

let chatTyping = false;

// Helpers global exportados se necessários
export function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

export function ensureChatSeed() {
  if (!state.chatHistory) state.chatHistory = [];
  // Removemos o seed inicial hardcoded, o empty-state agora reside nativamente no HTML do Sidebar.
  saveState();
}

export function toggleAiSidePanel(forceState) {
  const panel = document.getElementById('ai-side-panel');
  const backdrop = document.getElementById('ai-panel-backdrop');
  if (!panel || !backdrop) return;
  
  const isOpen = forceState !== undefined ? forceState : panel.classList.contains('translate-x-full');
  
  if (isOpen) {
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
    backdrop.classList.remove('hidden');
    // Força o reflow para a transição funcionar
    void backdrop.offsetWidth;
    backdrop.classList.remove('opacity-0');
    
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
      scrollChatToBottom();
    }, 300);
  } else {
    panel.classList.add('translate-x-full');
    panel.classList.remove('translate-x-0');
    backdrop.classList.add('opacity-0');
    
    setTimeout(() => {
      backdrop.classList.add('hidden');
    }, 500);
  }
}

// Expõe globalmente caso necessário por outros botões na interface
window.toggleAiSidePanel = toggleAiSidePanel;

export function renderChat() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const aiSidePanel = document.getElementById('ai-side-panel');
  if (aiSidePanel) {
    if (state.chatHistory && state.chatHistory.length > 0) {
      aiSidePanel.classList.add('has-messages');
    } else {
      aiSidePanel.classList.remove('has-messages');
    }
  }

  container.innerHTML = state.chatHistory.map(message => {
    const isUser = message.role === 'user';
    return `
      <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'}">
        <div class="flex gap-2 max-w-[88%] ${isUser ? 'flex-row-reverse' : 'flex-row'}">
          ${isUser ? '' : `
            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#0f1115] shadow-sm">
              <i class="fa-solid fa-robot text-sm"></i>
            </div>
          `}
          <div class="flex-1 min-w-0">
            <div class="${isUser ? 'bg-[#10b981] text-[#0b0d14] rounded-[18px] rounded-tr-sm shadow-[0_2px_10px_rgba(16,185,129,0.1)]' : 'bg-white/5 border border-white/5 text-white/90 rounded-[18px] rounded-tl-sm'} px-4 py-3">
              <div class="text-[13px] leading-relaxed break-words whitespace-pre-wrap ${isUser ? 'font-medium' : ''}">${richText(message.text)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (chatTyping) {
    const typingNode = document.createElement('div');
    typingNode.className = 'flex flex-col items-start';
    typingNode.innerHTML = `
      <div class="flex gap-2 max-w-[88%] flex-row">
        <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#0f1115] shadow-sm">
          <i class="fa-solid fa-robot text-sm"></i>
        </div>
        <div class="bg-white/5 border border-white/5 rounded-[18px] rounded-tl-sm px-4 py-3">
          <div class="flex items-center h-[19px]">
            <span class="typing-dot bg-emerald-400"></span><span class="typing-dot bg-emerald-400"></span><span class="typing-dot bg-emerald-400"></span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(typingNode);
  }

  scrollChatToBottom();
}

// Debounce de 300ms para salvar o histórico do chat — evita múltiplas
// escritas em localStorage por sequências rápidas de mensagens (ex: erro+fallback)
let _chatSaveTimer = null;
function debouncedChatSave() {
  clearTimeout(_chatSaveTimer);
  _chatSaveTimer = setTimeout(() => saveState(), 300);
}

export function pushChatMessage(role, text) {
  state.chatHistory.push({
    id: uid('msg'),
    role,
    text,
    createdAt: new Date().toISOString()
  });
  state.chatHistory = state.chatHistory.slice(-50);
  debouncedChatSave();
  renderChat();
}

export function setChatTyping(value) {
  chatTyping = value;
  renderChat();
}

async function callAIProxy({ provider, ...payload }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, ...payload }),
      signal: controller.signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || err?.message || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      throw new Error('Timeout — verifique sua conexão.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendGeminiMessage(userText, apiKey) {
  const analytics = calculateAnalytics(state);
  const recentTxs = state.transactions.slice(0, 8).map(t =>
    `${t.date} | ${t.desc} | ${t.cat} | ${t.value >= 0 ? '+' : ''}R$${Math.abs(t.value).toFixed(2)}`
  ).join('\n');

  const budgetLines = Object.entries(state.budgets || {})
    .filter(([, v]) => v > 0)
    .map(([cat, lim]) => {
      const spent = analytics.categories.find(([c]) => c === cat)?.[1] || 0;
      return `${cat}: gasto R$${spent.toFixed(2)} / limite R$${lim.toFixed(2)} (${Math.round((spent/lim)*100)}%)`;
    }).join('\n') || 'Sem orçamentos cadastrados';

  const goalLines = (state.goals || []).map(g =>
    `${g.nome}: R$${g.atual.toFixed(2)} de R$${g.total.toFixed(2)} (${Math.round((g.atual/g.total)*100)}%) — prazo ${g.deadline ? new Date(g.deadline).toLocaleDateString('pt-BR') : 'sem prazo'}`
  ).join('\n') || 'Sem metas';

  const cardLines = (state.cards || []).map(c =>
    `${c.name} (${c.cardType}): R$${(c.used||0).toFixed(2)} usados de R$${c.limit.toFixed(2)}`
  ).join('\n') || 'Sem cartões';

  const context = [
    'Você é o GrokFin Elite, assessor financeiro pessoal de altíssimo nível.',
    'Seja direto, prático e use os DADOS REAIS do usuário em cada resposta.',
    'Nunca invente dados. Se não souber algo, diga que não tem essa informação.',
    'Use **negrito** para valores e conceitos-chave. Máximo 3 parágrafos curtos.',
    'Responda em português do Brasil.',
    '',
    '=== SITUAÇÃO FINANCEIRA ATUAL ===',
    `Saldo em conta: R$${state.balance.toFixed(2)}`,
    `Receita do mês: R$${analytics.incomes.toFixed(2)}`,
    `Despesas do mês: R$${analytics.expenses.toFixed(2)}`,
    `Fluxo líquido: R$${analytics.net.toFixed(2)}`,
    `Taxa de poupança: ${analytics.savingRate.toFixed(1)}%`,
    `Score financeiro: ${analytics.healthScore}/100`,
    `Burn diário: R$${analytics.burnDaily.toFixed(2)}`,
    `Runway: ${analytics.runwayMonths.toFixed(1)} meses`,
    `Maior gasto do mês: ${analytics.topCategory.name} (R$${analytics.topCategory.value.toFixed(2)})`,
    `Tendência 3 meses: ${analytics.trend3m > 0 ? '+' : ''}${analytics.trend3m.toFixed(1)}%`,
    `USD: R$${state.exchange.usd} | EUR: R$${state.exchange.eur}`,
    '',
    '=== ORÇAMENTOS ===',
    budgetLines,
    '',
    '=== METAS ===',
    goalLines,
    '',
    '=== CARTÕES ===',
    cardLines,
    '',
    '=== ÚLTIMAS TRANSAÇÕES ===',
    recentTxs
  ].join('\n');

  const payload = {
    contents: [{ parts: [{ text: context + '\n\nPergunta do usuário: ' + userText }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
  };
  const data = await callAIProxy({
    provider: 'gemini',
    apiKey,
    mode: 'text',
    payload
  });
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text;
  if (!text) throw new Error('Resposta vazia do Gemini.');
  return text;
}

export function buildAssistantReply(rawText) {
  const q = normalizeText(rawText);
  const analytics = calculateAnalytics(state);

  // Intent: Saldo / Patrimônio
  if (/saldo|quanto (tenho|dinheiro)|caixa|patrimonio/.test(q)) {
    const invTotal = (state.investments || []).reduce((a, i) => a + i.value, 0);
    const goalsTotal = (state.goals || []).reduce((a, g) => a + g.atual, 0);
    const patrimonio = state.balance + invTotal + goalsTotal;
    let msg = `Seu saldo em conta é **${formatMoney(state.balance)}**, com fluxo líquido de **${formatMoney(analytics.net)}** no mês.`;
    if (invTotal > 0) msg += ` Somando investimentos (**${formatMoney(invTotal)}**) e metas (**${formatMoney(goalsTotal)}**), seu patrimônio total é **${formatMoney(patrimonio)}**.`;
    return msg;
  }

  // Intent: Gastos específicos por categoria (ex: "gasto com alimentação")
  const gastocats = ['alimentacao', 'comida', 'mercado', 'restaurante', 'transporte', 'uber', 'gasolina', 'lazer', 'saude', 'moradia'];
  const matchedCat = gastocats.find(c => q.includes(c));
  if (matchedCat && /gasto|despesa|custo/.test(q)) {
    // Map fuzzy matches to exact categories
    const catMap = { alimentacao: 'Alimentação', comida: 'Alimentação', mercado: 'Alimentação', restaurante: 'Alimentação', transporte: 'Transporte', uber: 'Transporte', gasolina: 'Transporte', lazer: 'Lazer', saude: 'Saúde', moradia: 'Moradia' };
    const exactCat = catMap[matchedCat];
    const catSpentMs = analytics.monthTransactions.filter(t => t.cat === exactCat && t.value < 0).reduce((a, t) => a + Math.abs(t.value), 0);
    const budget = state.budgets[exactCat];
    return `Você gastou **${formatMoney(catSpentMs)}** com **${exactCat}** este mês.${budget ? ` Isso representa **${formatPercent((catSpentMs/budget)*100,0)}** do seu teto estipulado para esta área.` : ''}`;
  }

  // Intent: Maior gasto
  if (/gasto|despesa|onde|estou gastando mais/.test(q)) {
    if (!analytics.categories.length) return 'Ainda não há despesas suficientes registradas neste mês para podermos calcular seu maior ralo de dinheiro.';
    const [category, value] = analytics.categories[0];
    return `Sua maior pressão financeira no momento é **${category}**, acumulando **${formatMoney(value)}** em despesas no mês. Talvez seja um bom ponto para avaliarmos otimizações.`;
  }

  // Intent: Metas e objetivos
  if (/meta|objetivo|acelerar|caminho|sonho/.test(q)) {
    const goal = analytics.urgentGoal;
    if (!goal) return 'Parece que você não possui metas ativas. Podemos cadastrar um novo objetivo na aba Metas e eu ajudarei a traçar um plano de aportes.';
    return `Sua prioridade atual é a meta **"${goal.nome}"**. Ela se encontra com **${goal.progress}%** concluídos. Para atingi-la no prazo, o ideal é investir cerca de **${formatMoney(goal.monthlyNeed)}** todos os meses.`;
  }

  // Intent: Planejamento / Economia / Cortes
  if (/econom|cortar|poupar|ajudar|dica/.test(q)) {
    if (analytics.overspend) {
      const exceed = Math.max(0, analytics.overspend.value - analytics.overspend.limit);
      return `Seu orçamento em **${analytics.overspend.cat}** estourou. Uma manobra rápida seria reduzir os custos aí, o que liberaria **${formatMoney(exceed)}** para compor seu fluxo ou investir.`;
    }
    return `Sua taxa de poupança encontra-se em **${formatPercent(analytics.savingRate, 1)}**. Para dar um boost nisso, o melhor caminho é focar em enxugar **${analytics.topCategory?.name || 'suas despesas secundárias'}**, que tem pesado bastante ultimamente.`;
  }

  // Intent: Cartões e faturas
  if (/cartao|fatura|credito|limite/.test(q)) {
    if (!state.cards || state.cards.length === 0) return 'Você não tem cartões de crédito monitorados no sistema. Caso possua, você pode adicioná-los na aba Cartões para visualizar as faturas aqui.';
    const nextFatura = [...state.cards].sort((a,b) => b.used - a.used)[0];
    return `O seu cartão com maior saldo em uso no momento é o **${nextFatura.name}**, totalizando **${formatMoney(nextFatura.used)}** utilizados no limite. Fique atento às datas de corte!`;
  }

  // Intent: Câmbio / Cotação
  if (/dolar|euro|btc|bitcoin|cambio|moeda/.test(q)) {
    return `Acompanhando o mercado em tempo real: O **USD** está cotado em **R$ ${state.exchange.usd}**; o **EUR** em **R$ ${state.exchange.eur}**; e o **Bitcoin** batendo **R$ ${state.exchange.btc}**. Ideal para quem planeja exposições internacionais.`;
  }

  // Intent: Diagnóstico completo
  if (/relatorio|diagnostico|resumo|geral|analytics/.test(q)) {
    return `**Diagnóstico Elite Automático**\n• Fluxo Líquido: **${formatMoney(analytics.net)}**\n• Poupando: **${formatPercent(analytics.savingRate, 1)}** de tudo que entra\n• Runway (fôlego do caixa base): **${(analytics.runwayMonths||0).toFixed(1)} meses**\n• Seu maior custo atual: **${analytics.topCategory?.name || 'N/A'}**.`;
  }

  // Intent: Runway / Burn rate
  if (/burn|queimando|dia|folego/.test(q)) {
    return `Calculando o custo de vida... Você tem queimado, em média, **${formatMoney(analytics.burnDaily)} por dia**. Se todas as receitas parassem agora, seu caixa atual seguraria a operação por cerca de **${(analytics.runwayMonths||0).toFixed(1)} meses**.`;
  }

  // Intent: Saudações
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|tudo bem)/.test(q)) {
    return `Olá${state.profile?.nickname ? ' ' + state.profile.nickname : ''}! Sou o cérebro financeiro do GrokFin. Tente me perguntar qual foi o seu maior gasto do mês, ou quanto você deve economizar para sua próxima meta.`;
  }

  // Default fallback com snapshot dos dados do usuário
  const hasData = analytics.expenses > 0 || analytics.incomes > 0;
  if (!hasData) {
    return `Olá! Ainda não vejo transações registradas. Comece adicionando uma receita ou despesa na aba **Conta**, ou me diga algo como **"recebi 5000 de salário"** ou **"gastei 80 no mercado"** que eu registro pra você.`;
  }
  const topTip = analytics.overspend
    ? `Seu maior alerta hoje é em **${analytics.overspend.cat}** — orçamento ultrapassado.`
    : `Seu maior gasto é **${analytics.topCategory.name}** (${formatMoney(analytics.topCategory.value)}).`;
  return `${topTip} Score financeiro: **${analytics.healthScore}/100**, poupança: **${formatPercent(analytics.savingRate, 1)}**. Pergunte sobre metas, cartões, projeções ou diga um gasto para registrar (ex: "gastei 50 com uber").`;
}

export function handleBotTransaction(text) {
  const l = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos para matching

  // ── Detectar intent ───────────────────────────────────────────────────────
  const isIncome  = /recebi|ganhei|entrou|salario|deposito|renda/.test(l);
  const isExpense = /gastei|paguei|comprei|adicion(ei|e)|saiu|cobr|gastando/.test(l);
  if (!isIncome && !isExpense) return null;

  // ── Extrair valor — aceita "R$ 10", "10,50", "10.50", "10 reais", "10 conto"
  const valueMatch = text.match(/(?:R\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:reais?|conto[s]?)?/i);
  if (!valueMatch) return null;
  let val = parseCurrencyInput(valueMatch[1]);
  if (val <= 0) return null;
  if (isExpense) val = -val;

  // ── Detectar forma de pagamento — usa o schema do transactions-ui ──────────
  // transactions-ui espera: 'cartao_credito' | 'cartao_debito' | 'pix' | 'dinheiro' | 'conta'
  let payment = 'conta';
  if (/cart(a|ã)o|credito|cr[eé]dito/.test(l))   payment = 'cartao_credito';
  else if (/d[eé]bito/.test(l))                   payment = 'cartao_debito';
  else if (/pix/.test(l))                          payment = 'pix';
  else if (/dinheiro|esp[eé]cie|especie/.test(l)) payment = 'dinheiro';

  // Label humanizado para a resposta do chat
  const PAYMENT_LABEL = {
    cartao_credito: 'cartão de crédito',
    cartao_debito:  'débito',
    pix:            'Pix',
    dinheiro:       'dinheiro',
    conta:          '',
  };

  // ── Detectar data relativa ────────────────────────────────────────────────
  let txDate = new Intl.DateTimeFormat('pt-BR').format(new Date());
  if (/ontem/.test(l)) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    txDate = new Intl.DateTimeFormat('pt-BR').format(d);
  } else if (/anteontem/.test(l)) {
    const d = new Date(); d.setDate(d.getDate() - 2);
    txDate = new Intl.DateTimeFormat('pt-BR').format(d);
  }

  // ── Detectar categoria ────────────────────────────────────────────────────
  let cat = isIncome ? 'Receita' : 'Rotina';
  const catRules = [
    [/mercado|ifood|comida|padaria|supermercado|pao|fruta|lanche|almoco|jantar|cafe|pizza|hamburguer|acougue|hortifruti/, 'Alimentação'],
    [/uber|99|taxi|gas(olina)?|combustivel|posto|onibus|metro|brt|trem|transporte|passagem|pedágio|pedagio/, 'Transporte'],
    [/netflix|spotify|cinema|show|ingresso|shopee|roupa|calcado|sapato|lazer|jogo|steam|xbox|playstation|bar|balada|festa|amazon|magazine|americanas/, 'Lazer'],
    [/farmacia|remedio|medico|hospital|saude|plano de saude|dentista|psicol|terapia/, 'Saúde'],
    [/aluguel|condominio|agua|luz|energia|internet|gas|moradia|iptu|manutencao|reforma/, 'Moradia'],
    [/salario|freelance|renda|receita|bonus|dividendo|aluguel recebido|comissao/, 'Receita'],
    [/faculdade|escola|curso|livro|mensalidade|material/, 'Assinaturas'],
    [/investimento|aporte|tesouro|cdb|acoes|fundo/, 'Investimentos'],
  ];
  for (const [regex, category] of catRules) {
    if (regex.test(l)) { cat = category; break; }
  }

  // ── Extrair descrição limpando artefatos ──────────────────────────────────
  let desc = text
    .replace(/(recebi|ganhei|entrou|gastei|paguei|comprei|adicionei|adicione|saiu)/gi, '')
    .replace(/R?\$?\s*\d+(?:[.,]\d{1,2})?\s*(?:reais?|contos?)?/gi, '')
    .replace(/\b(no|na|com|de|em|pra|pelo|pela|num|numa|uns?|umas?|cartao|cartão|credito|débito|debito|pix|dinheiro|ontem|hoje|anteontem|reais|conto)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!desc || desc.length < 2) desc = isIncome ? 'Receita via chat' : 'Despesa via chat';
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  // ── Montar transação e salvar ─────────────────────────────────────────────
  const tx = {
    id: uid('tx'),
    desc,
    value: val,
    cat,
    payment,        // campo canônico esperado por transactions-ui
    date: txDate,
  };

  if (!state.transactions) state.transactions = [];
  state.transactions.unshift(tx); // mais recente primeiro
  state.balance += val;
  saveState();
  if (typeof window.appRenderAll === 'function') window.appRenderAll();

  // ── Montar resposta humanizada ────────────────────────────────────────────
  const emoji       = isIncome ? '💰' : '📝';
  const verb        = isIncome ? 'receita' : 'despesa';
  const methodLabel = PAYMENT_LABEL[payment] ? ` via **${PAYMENT_LABEL[payment]}**` : '';
  const dateLabel   = txDate !== new Intl.DateTimeFormat('pt-BR').format(new Date())
    ? ` (data: **${txDate}**)` : '';

  return `${emoji} Registrei ${verb}: **${desc}** — **${formatMoney(Math.abs(val))}**${methodLabel} em **${cat}**${dateLabel}. Saldo atualizado: **${formatMoney(state.balance)}**.`;
}

// Rate limiter: máx 10 mensagens por minuto para prevenir custos excessivos na API
const _chatRateLog = [];
function checkChatRateLimit() {
  const now = Date.now();
  // Remove entradas com mais de 60 segundos
  while (_chatRateLog.length && now - _chatRateLog[0] > 60000) _chatRateLog.shift();
  if (_chatRateLog.length >= 10) return false;
  _chatRateLog.push(now);
  return true;
}

export async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;

  if (!checkChatRateLimit()) {
    showToast('Limite de mensagens atingido. Aguarde 1 minuto.', 'danger');
    return;
  }

  pushChatMessage('user', text);
  input.value = '';
  setChatTyping(true);

  const txReply = handleBotTransaction(text);
  if (txReply) {
    setChatTyping(false);
    pushChatMessage('assistant', txReply);
    return;
  }

  const apiKey   = localStorage.getItem('grokfin_anthropic_key');
  const provider = getAIProvider(apiKey);
  if (provider !== 'none') {
    try {
      const reply = await sendClaudeAPIMessage(text, apiKey);
      setChatTyping(false);
      pushChatMessage('assistant', reply);
      return;
    } catch (err) {
      setChatTyping(false);
      const providerName = provider === 'gemini' ? 'Gemini' : 'Claude';
      pushChatMessage('assistant', `⚠️ **Erro na IA (${providerName}):** ${err.message}\n\nRespondendo com modo básico:`);
      const fallback = buildAssistantReply(text);
      pushChatMessage('assistant', fallback);
      return;
    }
  }

  setTimeout(() => {
    const reply = buildAssistantReply(text);
    setChatTyping(false);
    pushChatMessage('assistant', reply + '\n\n💡 _Conecte o Gemini (gratuito) pelas configurações para respostas mais inteligentes._');
  }, 720);
}

export async function sendClaudeAPIMessage(userText, apiKey) {
  if (getAIProvider(apiKey) === 'gemini') {
    return await sendGeminiMessage(userText, apiKey);
  }
  
  const analytics = calculateAnalytics(state);
  const recentTxs = state.transactions.slice(0, 10).map(t =>
    `${t.date} | ${t.desc} | ${t.cat} | ${t.value >= 0 ? '+' : ''}R$${Math.abs(t.value).toFixed(2)}`
  ).join('\n');

  const budgetCtx = Object.entries(state.budgets || {})
    .filter(([, v]) => v > 0)
    .map(([cat, lim]) => {
      const spent = analytics.categories.find(([c]) => c === cat)?.[1] || 0;
      return `  • ${cat}: R$${spent.toFixed(2)} gasto / R$${lim.toFixed(2)} limite (${Math.round((spent/lim)*100)}%)`;
    }).join('\n') || '  Sem orçamentos definidos';

  const goalsCtx = (state.goals || []).map(g =>
    `  • ${g.nome}: ${Math.round((g.atual/g.total)*100)}% (R$${g.atual.toFixed(2)} / R$${g.total.toFixed(2)})`
  ).join('\n') || '  Sem metas ativas';

  const cardsCtx = (state.cards || []).map(c =>
    `  • ${c.name} [${c.cardType}]: R$${(c.used||0).toFixed(2)} / limite R$${c.limit.toFixed(2)}`
  ).join('\n') || '  Sem cartões';

  const systemPrompt = [
    'Você é o GrokFin Elite, assessor financeiro integrado ao app do usuário.',
    'REGRA CRÍTICA: Use SEMPRE os dados abaixo. Nunca invente números.',
    'Seja direto e específico. Máximo 3 parágrafos. Use **negrito** para valores.',
    'Responda em português do Brasil.',
    '',
    '## DADOS FINANCEIROS',
    `Saldo: R$${state.balance.toFixed(2)}`,
    `Receita/mês: R$${analytics.incomes.toFixed(2)} | Despesas: R$${analytics.expenses.toFixed(2)}`,
    `Fluxo: R$${analytics.net.toFixed(2)} | Poupança: ${analytics.savingRate.toFixed(1)}%`,
    `Score: ${analytics.healthScore}/100 | Burn/dia: R$${analytics.burnDaily.toFixed(2)} | Runway: ${analytics.runwayMonths.toFixed(1)}m`,
    `Maior gasto: ${analytics.topCategory.name} (R$${analytics.topCategory.value.toFixed(2)})`,
    `USD: R$${state.exchange.usd} | EUR: R$${state.exchange.eur}`,
    '',
    '## ORÇAMENTOS', budgetCtx,
    '', '## METAS', goalsCtx,
    '', '## CARTÕES', cardsCtx,
    '', '## ÚLTIMAS TRANSAÇÕES', recentTxs
  ].join('\n');

  const messages = [
    ...state.chatHistory.slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: userText }
  ];
  const data = await callAIProxy({
    provider: 'claude',
    apiKey,
    mode: 'text',
    payload: { model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: systemPrompt, messages }
  });
  return data?.content?.[0]?.text || data?.text || 'Sem resposta da IA.';
}

// ── Detecção de provedor centralizada ────────────────────────────────────────
// Evita o antipadrão de apiKey.startsWith('AIza') espalhado por todo o arquivo.
export function getAIProvider(key) {
  if (!key) return 'none';
  if (key.startsWith('AIza'))   return 'gemini';
  if (key.startsWith('sk-ant-')) return 'claude';
  return 'unknown';
}

export async function sendGeminiImageMessage(base64, mimeType, apiKey) {
  const data = await callAIProxy({
    provider: 'gemini',
    apiKey,
    mode: 'image',
    base64,
    mimeType
  });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não consegui ler a imagem.';
}

// ── Análise de imagem via Claude Vision API ───────────────────────────────────
export async function sendClaudeImageMessage(base64, mimeType, apiKey) {
  const data = await callAIProxy({
    provider: 'claude',
    apiKey,
    mode: 'image',
    base64,
    mimeType
  });
  return data?.content?.[0]?.text || data?.text || 'Não consegui ler a imagem.';
}

export function handleChatImageInput(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validar tipo de arquivo
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED.includes(file.type)) {
    showToast('Formato não suportado. Use JPG, PNG ou WEBP.', 'danger');
    return;
  }
  // Validar tamanho (max 4MB)
  if (file.size > 4 * 1024 * 1024) {
    showToast('Imagem muito grande. Máximo 4 MB.', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64Part = evt.target.result.split(',')[1];
    const displayName = file.name.length > 28
      ? file.name.slice(0, 25) + '…'
      : file.name;
    pushChatMessage('user', `📎 **Comprovante anexado:** ${displayName}`);
    setChatTyping(true);

    const apiKey   = localStorage.getItem('grokfin_anthropic_key');
    const provider = getAIProvider(apiKey);

    try {
      let reply;
      if (provider === 'gemini') {
        reply = await sendGeminiImageMessage(base64Part, file.type, apiKey);
      } else if (provider === 'claude') {
        reply = await sendClaudeImageMessage(base64Part, file.type, apiKey);
      } else {
        reply = '⚠️ Configure uma chave de API para analisar imagens.\n\n'
          + '**Gemini** (gratuito): chave começa com `AIza` — obtenha em aistudio.google.com\n'
          + '**Claude** (pago): chave começa com `sk-ant-` — obtenha em console.anthropic.com';
      }
      setChatTyping(false);
      pushChatMessage('assistant', reply);

      // Se a resposta da IA sugerir um comando de registro, oferecer atalho
      const suggestedCommand = reply.match(/[Gg]astei[^.!?]*/);
      if (suggestedCommand) {
        setTimeout(() => {
          const input = document.getElementById('chat-input');
          if (input && !input.value) {
            input.value = suggestedCommand[0].trim();
            input.focus();
            showToast('💡 Sugestão preenchida — confirme ou edite antes de enviar', 'success');
          }
        }, 400);
      }
    } catch (err) {
      setChatTyping(false);
      pushChatMessage('assistant', `⚠️ Erro ao analisar imagem: ${err.message}`);
    }
  };
  reader.readAsDataURL(file);
  // Limpar input para permitir reenvio da mesma imagem
  e.target.value = '';
}

export function bindChatEvents() {
  const btn = document.getElementById('chat-send-btn');
  const input = document.getElementById('chat-input');
  const fileInput = document.getElementById('file-upload');
  
  if (btn) btn.addEventListener('click', sendChatMessage);
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', handleChatImageInput);
  }

  // Eventos de toggle do AI Side Panel
  const triggerBtn = document.getElementById('ai-panel-trigger');
  const closeBtn = document.getElementById('ai-panel-close');
  const backdrop = document.getElementById('ai-panel-backdrop');

  triggerBtn?.addEventListener('click', () => window.toggleAiSidePanel(true));
  closeBtn?.addEventListener('click', () => window.toggleAiSidePanel(false));
  backdrop?.addEventListener('click', () => window.toggleAiSidePanel(false));


  // [FIX #5] Transcrição de áudio via SpeechRecognition (Web Speech API)
  const micBtn = document.getElementById('chat-mic-btn');
  const micIcon = document.getElementById('chat-mic-icon');
  if (micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.title = 'Transcrição de áudio não suportada neste navegador (use Chrome)';
      micBtn.style.opacity = '0.4';
      micBtn.style.cursor = 'not-allowed';
    } else {
      let recognition = null;
      let isListening = false;

      micBtn.addEventListener('click', () => {
        if (isListening) {
          recognition?.stop();
          return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          isListening = true;
          micBtn.classList.add('recording');
          if (micIcon) { micIcon.className = 'fa-solid fa-stop'; }
          micBtn.title = 'Gravando… clique para parar';
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (input) {
            input.value = transcript;
            input.focus();
          }
          showToast(`🎙️ "${transcript.slice(0, 40)}${transcript.length > 40 ? '…' : ''}"`, 'success');
        };

        recognition.onerror = (event) => {
          const msgs = { 'not-allowed': 'Permissão de microfone negada.', 'no-speech': 'Nenhuma fala detectada.', 'network': 'Erro de rede.' };
          showToast(msgs[event.error] || `Erro: ${event.error}`, 'danger');
        };

        recognition.onend = () => {
          isListening = false;
          micBtn.classList.remove('recording');
          if (micIcon) { micIcon.className = 'fa-solid fa-microphone'; }
          micBtn.title = 'Gravar áudio';
        };

        recognition.start();
      });
    }
  }

  // ── Botões de prompt rápido (data-chat-prompt) ────────────────────────────
  // Os pills "Saldo", "Gastos", "Metas" e "Detalhar recomendação" existem no
  // HTML mas nunca foram ligados a evento algum — cliques não faziam nada.
  document.querySelectorAll('[data-chat-prompt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.chatPrompt;
      if (prompt) sendChatPrompt(prompt);
    });
  });

  // ── Atalhos rápidos do painel lateral (data-quick-action) ─────────────────
  document.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.quickAction;
      if (action === 'open-transactions') window.switchTab?.(2);
      if (action === 'open-report')       window.switchTab?.(1);
      if (action === 'apply-insight') {
        const insight = document.getElementById('chat-side-insight')?.textContent?.trim();
        if (insight && insight !== '--') sendChatPrompt(`Explique e aplique: ${insight}`);
      }
    });
  });
}

// [FIX #6] sendChatPrompt: função para acionar o chat programaticamente.
// Era referenciada em goals-ui.js como window.sendChatPrompt mas nunca havia
// sido definida em nenhum arquivo, causando erro silencioso ao clicar em
// "Briefing IA" em uma meta. A função injeta o texto no input do chat e dispara
// o envio, tornando o atalho de metas funcional.
export function sendChatPrompt(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = String(text || '').trim();
  window.toggleAiSidePanel(true);
  sendChatMessage();
}

// Expõe globalmente para uso via window.sendChatPrompt (ex: goals-ui.js)
window.sendChatPrompt = sendChatPrompt;
