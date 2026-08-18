import { state, setState } from '../state.js';
import { switchView, showReportModal } from '../app.js';
import { showToast } from './toast.js';
import { saveExpenses } from '../services/storage.js';
import { generateSummary } from '../services/gemini.js';
import { escapeHtml } from '../utils.js';

export function renderDashboard(container) {
  const expenses = state.expenses || [];
  const now = new Date();
  const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const months = [...new Set(expenses.map((e) => (e.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const categories = [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort();
  const filterMonth = state.filterMonth || '';
  const filterCat = state.filterCategory || '';
  const filterQ = state.filterQ || '';

  let filtered = expenses;
  if (filterMonth) filtered = filtered.filter((e) => (e.date || '').startsWith(filterMonth));
  if (filterCat) filtered = filtered.filter((e) => e.category === filterCat);
  if (filterQ) {
    const q = filterQ.toLowerCase();
    filtered = filtered.filter((e) =>
      (e.vendor || '').toLowerCase().includes(q) ||
      (e.notes || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const thisMonth = expenses
    .filter((e) => (e.date || '').startsWith(monthKey))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const filteredTotal = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <p class="text-[11px] font-medium text-slate-500">總開支</p>
        <p class="text-xl font-semibold tabular-nums mt-1">HK$${total.toLocaleString('en-HK', { minimumFractionDigits: 2 })}</p>
      </div>
      <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <p class="text-[11px] font-medium text-slate-500">本月</p>
        <p class="text-xl font-semibold tabular-nums text-emerald-600 mt-1">HK$${thisMonth.toLocaleString('en-HK', { minimumFractionDigits: 2 })}</p>
      </div>
    </div>
    <div class="flex gap-2.5 mb-4">
      <button id="btn-add" class="flex-1 flex items-center justify-center gap-2 bg-primary-800 text-white font-semibold py-3.5 rounded-2xl text-sm">＋ 新增開支</button>
      <button id="btn-summary" class="flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-medium px-4 py-3.5 rounded-2xl text-sm">✨ AI 報告</button>
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <select id="filter-month" class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
        <option value="">所有月份</option>
        ${months.map((m) => '<option value="' + m + '"' + (m === filterMonth ? ' selected' : '') + '>' + m + '</option>').join('')}
      </select>
      <select id="filter-cat" class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
        <option value="">所有類別</option>
        ${categories.map((c) => '<option value="' + escapeHtml(c) + '"' + (c === filterCat ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('')}
      </select>
    </div>
    <div class="relative mb-3">
      <input id="search" type="search" placeholder="搜尋商戶／備註..." value="${escapeHtml(filterQ)}"
        class="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none">
      <span class="absolute left-3.5 top-3 text-slate-400">🔍</span>
    </div>
    ${(filterMonth || filterCat || filterQ) ? '<p class="text-[11px] text-slate-500 mb-2">篩選結果 ' + filtered.length + ' 筆 · HK$' + filteredTotal.toFixed(2) + '</p>' : ''}
    <div id="expense-list" class="space-y-2.5">
      ${filtered.length === 0 ? renderEmpty(expenses.length === 0) : filtered.map((e) => renderCard(e)).join('')}
    </div>
  `;

  document.getElementById('btn-add')?.addEventListener('click', () => {
    setState({ editingId: null, currentImages: [] });
    switchView('add');
  });

  document.getElementById('btn-summary')?.addEventListener('click', async () => {
    if (!state.expenses.length) { showToast('未有開支可以生成報告', 'warning'); return; }
    showToast('正在準備 AI 月結報告...', 'info');
    try {
      const userKey = localStorage.getItem('user_gemini_api_key') || '';
      const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
      const report = await generateSummary(state.expenses, userKey, model);
      showReportModal(typeof report === 'string' ? report : JSON.stringify(report, null, 2));
    } catch (err) {
      showToast('生成報告失敗：' + err.message, 'error');
    }
  });

  const applyFilters = () => {
    setState({
      filterMonth: document.getElementById('filter-month')?.value || '',
      filterCategory: document.getElementById('filter-cat')?.value || '',
      filterQ: document.getElementById('search')?.value || ''
    });
    renderDashboard(container);
  };
  document.getElementById('filter-month')?.addEventListener('change', applyFilters);
  document.getElementById('filter-cat')?.addEventListener('change', applyFilters);
  let searchTimer;
  document.getElementById('search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 250);
  });

  container.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete]')) return;
      const id = el.dataset.edit;
      const exp = state.expenses.find((x) => x.id === id);
      if (!exp) return;
      setState({ editingId: id, currentImages: Array.isArray(exp.images) ? [...exp.images] : [] });
      switchView('add');
    });
  });

  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('確定刪除呢筆開支？')) return;
      state.expenses = state.expenses.filter((x) => x.id !== btn.dataset.delete);
      await saveExpenses(state.expenses);
      showToast('已刪除', 'success');
      renderDashboard(container);
    });
  });
}

function renderEmpty(noData) {
  if (!noData) return '<p class="text-center text-sm text-slate-400 py-10">呢個篩選條件下冇記錄</p>';
  return '<div class="text-center py-16"><div class="text-4xl mb-4">🧾</div><p class="font-medium text-slate-600">仲未有開支記錄</p></div>';
}

function renderCard(e) {
  const amount = Number(e.amount) || 0;
  const imgN = (e.images && e.images.length) ? ' · 📷 ' + e.images.length : '';
  const safeId = escapeHtml(e.id);
  return '<div data-edit="' + safeId + '" class="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-start gap-3 active:bg-slate-50 cursor-pointer">' +
    '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2">' +
    '<p class="font-medium text-sm truncate">' + escapeHtml(e.vendor || '未知商戶') + '</p>' +
    '<p class="font-semibold text-sm tabular-nums">HK$' + amount.toFixed(2) + '</p></div>' +
    '<div class="text-[11px] text-slate-500 mt-1">' + escapeHtml(e.date || '') + ' · ' + escapeHtml(e.category || '') + imgN + '</div>' +
    (e.notes ? '<p class="text-[11px] text-slate-400 mt-1 truncate">' + escapeHtml(e.notes) + '</p>' : '') +
    '<p class="text-[10px] text-primary-600 mt-1">點擊編輯</p></div>' +
    '<button data-delete="' + safeId + '" class="shrink-0 w-8 h-8 rounded-full bg-red-50 text-red-500">🗑</button></div>';
}
