/**
 * Dashboard View
 * Cleaner cards, empty state, AI report modal
 */

import { state } from '../state.js';
import { switchView, showReportModal } from '../app.js';
import { showToast } from './toast.js';
import { saveExpenses } from '../services/storage.js';
import { generateSummary } from '../services/gemini.js';

export function renderDashboard(container) {
  const expenses = state.expenses || [];

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const thisMonth = expenses
    .filter(e => {
      const d = new Date(e.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-3 mb-5">
      <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <p class="text-[11px] font-medium text-slate-500 tracking-wide">總開支</p>
        <p class="text-xl font-semibold tabular-nums mt-1">HK$${total.toLocaleString('en-HK', { minimumFractionDigits: 2 })}</p>
      </div>
      <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <p class="text-[11px] font-medium text-slate-500 tracking-wide">本月</p>
        <p class="text-xl font-semibold tabular-nums text-emerald-600 mt-1">HK$${thisMonth.toLocaleString('en-HK', { minimumFractionDigits: 2 })}</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="flex gap-2.5 mb-5">
      <button id="btn-add" class="flex-1 flex items-center justify-center gap-2 bg-primary-800 hover:bg-primary-900 active:scale-[0.98] transition text-white font-semibold py-3.5 rounded-2xl text-sm shadow-sm shadow-primary-800/20">
        <span class="text-lg">＋</span>
        <span>新增開支</span>
      </button>
      <button id="btn-summary" class="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition text-slate-700 font-medium px-4 py-3.5 rounded-2xl text-sm">
        <span>✨</span>
        <span class="hidden sm:inline">AI 報告</span>
      </button>
    </div>

    <!-- Search -->
    <div class="relative mb-4">
      <input id="search" type="search" placeholder="搜尋商戶..." 
        class="w-full bg-white border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition rounded-2xl pl-10 pr-4 py-3 text-sm outline-none">
      <span class="absolute left-3.5 top-3 text-slate-400">🔍</span>
    </div>

    <!-- List -->
    <div id="expense-list" class="space-y-2.5">
      ${expenses.length === 0 ? renderEmpty() : expenses.map(e => renderCard(e)).join('')}
    </div>
  `;

  document.getElementById('btn-add')?.addEventListener('click', () => switchView('add'));

  document.getElementById('btn-summary')?.addEventListener('click', async () => {
    if (!state.expenses.length) {
      showToast('未有開支可以生成報告', 'warning');
      return;
    }
    showToast('正在準備 AI 月結報告...', 'info');
    try {
      const userKey = localStorage.getItem('user_gemini_api_key') || '';
      const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
      const report = await generateSummary(state.expenses, userKey, model);
      // Use modal instead of alert — fixes Chinese garbled text
      showReportModal(typeof report === 'string' ? report : JSON.stringify(report, null, 2));
    } catch (err) {
      showToast('生成報告失敗：' + err.message, 'error');
    }
  });

  // Search filter
  const searchInput = document.getElementById('search');
  searchInput?.addEventListener('input', () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    const list = document.getElementById('expense-list');
    if (!list) return;
    const filtered = !q
      ? expenses
      : expenses.filter(e =>
          (e.vendor || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q)
        );
    list.innerHTML = filtered.length === 0
      ? `<p class="text-center text-sm text-slate-400 py-8">搵唔到相關開支</p>`
      : filtered.map(e => renderCard(e)).join('');
    bindDelete(container);
  });

  bindDelete(container);
}

function bindDelete(container) {
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      if (!confirm('確定刪除呢筆開支？')) return;

      state.expenses = state.expenses.filter(x => x.id !== id);
      await saveExpenses(state.expenses);
      showToast('已刪除', 'success');
      renderDashboard(container);
    });
  });
}

function renderEmpty() {
  return `
    <div class="text-center py-16">
      <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">🧾</div>
      <p class="font-medium text-slate-600">仲未有開支記錄</p>
      <p class="text-xs text-slate-400 mt-1 mb-5">拍張收據相片開始記錄</p>
      <button onclick="document.querySelector('[data-view=add]')?.click()" class="inline-flex items-center gap-1.5 bg-primary-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
        ＋ 新增第一筆
      </button>
    </div>
  `;
}

function renderCard(e) {
  const amount = Number(e.amount) || 0;
  const dateStr = e.date || '';
  const cat = e.category || 'Other';
  return `
    <div class="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <p class="font-medium text-sm truncate">${escapeHtml(e.vendor || '未知商戶')}</p>
          <p class="font-semibold text-sm tabular-nums whitespace-nowrap">HK$${amount.toFixed(2)}</p>
        </div>
        <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
          <span>${dateStr}</span>
          <span class="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>${escapeHtml(cat)}</span>
        </div>
        ${e.notes ? `<p class="text-[11px] text-slate-400 mt-1 truncate">${escapeHtml(e.notes)}</p>` : ''}
      </div>
      <button data-delete="${e.id}" class="shrink-0 w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-sm hover:bg-red-100 active:scale-95 transition" title="刪除">
        🗑
      </button>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
