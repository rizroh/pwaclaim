/**
 * Dashboard View
 * Priority 2: cleaner cards, better empty state, improved list
 */

import { state } from '../state.js';
import { switchView } from '../app.js';
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
        <p class="text-xl font-semibold tabular-nums mt-1">HK$${total.toLocaleString('en-HK', {minimumFractionDigits: 2})}</p>
      </div>
      <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <p class="text-[11px] font-medium text-slate-500 tracking-wide">本月</p>
        <p class="text-xl font-semibold tabular-nums text-emerald-600 mt-1">HK$${thisMonth.toLocaleString('en-HK', {minimumFractionDigits: 2})}</p>
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

  // Events
  document.getElementById('btn-add')?.addEventListener('click', () => switchView('add'));
  document.getElementById('btn-summary')?.addEventListener('click', async () => {
    if (!state.expenses.length) {
      showToast('未有開支可以生成報告', 'warning');
      return;
    }
    showToast('正在為您準備 Gemini 智能月結報告...', 'info');
    try {
      const userKey = localStorage.getItem('user_gemini_api_key') || '';
      const model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
      const report = await generateSummary(state.expenses, userKey, model);
      alert(report); // simple display for now; can upgrade to modal later
    } catch (err) {
      showToast('生成報告失敗：' + err.message, 'error');
    }
  });

  // Delete handlers
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
      <button onclick="document.querySelector('[data-view=add]')?.click()" 
        class="inline-flex items-center gap-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-2xl font-medium active:scale-95 transition">
        立即新增第一張
      </button>
    </div>
  `;
}

function renderCard(exp) {
  const catColors = {
    'Meals': 'bg-orange-100 text-orange-700',
    'Transport': 'bg-blue-100 text-blue-700',
    'Office': 'bg-slate-100 text-slate-700',
    'Professional Services': 'bg-purple-100 text-purple-700',
    'Marketing': 'bg-pink-100 text-pink-700',
    'Travel': 'bg-cyan-100 text-cyan-700',
    'Utilities': 'bg-amber-100 text-amber-700',
    'Other': 'bg-gray-100 text-gray-700'
  };
  const color = catColors[exp.category] || catColors.Other;

  return `
    <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.99] transition flex gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-[15px] truncate">${exp.vendor || '未命名商戶'}</p>
            <p class="text-xs text-slate-500 mt-0.5">${exp.date}</p>
          </div>
          <p class="font-semibold tabular-nums text-[15px] whitespace-nowrap">HK$${Number(exp.amount).toFixed(2)}</p>
        </div>
        <div class="flex items-center gap-2 mt-2.5">
          <span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${color}">${exp.category || 'Other'}</span>
          ${exp.images?.length ? `<span class="text-[10px] text-slate-400">${exp.images.length} 張相</span>` : ''}
        </div>
      </div>
      <button data-delete="${exp.id}" class="self-center p-2 text-slate-300 hover:text-red-500 transition">
        🗑️
      </button>
    </div>
  `;
}
