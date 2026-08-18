import { state, setState } from '../state.js';
import { switchView } from '../app.js';
import { showToast } from './toast.js';
import { saveExpenses } from '../services/storage.js';
import { migrateAggregatorKeys } from '../services/providers.js';
import {
  MAX_IMAGES, stopCamera, startCamera, switchCamera, capturePhoto, handleFiles, renderPreviews
} from './add-expense-media.js';
import { providerButtonsHtml, bindAnalyzeButtons, fillForm } from './add-expense-analyze.js';

export function renderAddExpense(container) {
  migrateAggregatorKeys();
  const isEdit = !!state.editingId;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <button type="button" id="btn-back" class="flex items-center gap-1 text-sm font-medium text-slate-600">← 返回</button>
      <h2 class="font-semibold text-lg">${isEdit ? '編輯開支' : '新增開支'}</h2>
      <div class="w-12"></div>
    </div>
    <div class="bg-white rounded-3xl border border-slate-200 p-4 mb-4 shadow-sm">
      <p class="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">收據相片（最多 ${MAX_IMAGES} 張）</p>
      <div id="previews" class="flex flex-wrap gap-2.5 mb-3 min-h-[76px]"></div>
      <div class="grid grid-cols-2 gap-2.5">
        <button type="button" id="btn-camera" class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-primary-300 rounded-2xl py-4 text-primary-700">
          <span class="text-2xl">📷</span><span class="text-xs font-semibold">影相</span>
        </button>
        <label class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300 rounded-2xl py-4 cursor-pointer text-slate-600">
          <span class="text-2xl">🖼️</span><span class="text-xs font-semibold">上傳</span>
          <input type="file" id="file-input" accept="image/*" multiple class="hidden">
        </label>
      </div>
      <div class="mt-3 space-y-2">
        ${providerButtonsHtml()}
        <p id="ocr-note" class="hidden text-center text-[10px] text-emerald-600 mt-1">首次 OCR 會下載語言模型</p>
        <div id="analyze-progress" class="hidden mt-2 space-y-1 text-xs"></div>
      </div>
    </div>
    <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3.5">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">日期</label>
          <input id="f-date" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">金額 (HKD)</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">HK$</span>
            <input id="f-amount" type="number" step="0.01" placeholder="0.00" class="w-full border border-slate-200 rounded-xl pl-11 pr-3 py-2.5 text-sm outline-none">
          </div>
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">商戶名稱</label>
        <input id="f-vendor" type="text" placeholder="例如：Cafe de Coral" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">類別</label>
        <select id="f-category" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none">
          <option value="Meals">餐飲</option>
          <option value="Transport">交通</option>
          <option value="Office">辦公</option>
          <option value="Professional Services">專業服務</option>
          <option value="Marketing">市場推廣</option>
          <option value="Travel">差旅</option>
          <option value="Utilities">水電煤</option>
          <option value="Other">其他</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">備註（可選）</label>
        <textarea id="f-notes" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none"></textarea>
      </div>
    </div>
    <button type="button" id="btn-save" class="mt-5 w-full bg-primary-800 text-white font-semibold py-4 rounded-2xl text-sm shadow-lg shadow-primary-800/25">儲存開支</button>
    <div id="camera-modal" class="hidden fixed inset-0 bg-black z-[100] flex flex-col">
      <div class="flex items-center justify-between px-4 py-3">
        <p class="text-white text-sm font-medium">影收據</p>
        <button type="button" id="btn-close-camera" class="text-white/90 text-sm px-3 py-1.5 rounded-full bg-white/10">取消</button>
      </div>
      <div class="flex-1 relative flex items-center justify-center bg-black overflow-hidden min-h-0">
        <video id="camera-video" autoplay playsinline muted class="max-w-full max-h-full w-auto h-auto object-contain"></video>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div class="w-full max-w-sm aspect-[3/4] border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"></div>
        </div>
        <canvas id="camera-canvas" class="hidden"></canvas>
        <div id="camera-flash" class="hidden absolute inset-0 bg-white pointer-events-none"></div>
      </div>
      <div class="px-6 py-5 pb-8 bg-black/80 flex items-center justify-center gap-8">
        <button type="button" id="btn-switch-cam" class="w-12 h-12 rounded-full bg-white/15 text-white">🔄</button>
        <button type="button" id="btn-capture" class="w-16 h-16 rounded-full bg-white border-4 border-slate-300"></button>
        <div class="w-12 h-12"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    stopCamera();
    setState({ currentImages: [], editingId: null });
    switchView('dashboard');
  });
  document.getElementById('file-input')?.addEventListener('change', handleFiles);
  document.getElementById('btn-camera')?.addEventListener('click', startCamera);
  document.getElementById('btn-capture')?.addEventListener('click', capturePhoto);
  document.getElementById('btn-close-camera')?.addEventListener('click', stopCamera);
  document.getElementById('btn-switch-cam')?.addEventListener('click', switchCamera);
  document.getElementById('btn-save')?.addEventListener('click', save);
  bindAnalyzeButtons();

  const existing = isEdit ? state.expenses.find((e) => e.id === state.editingId) : null;
  if (existing) fillForm(existing);
  else document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  renderPreviews();
}

async function save() {
  const date = document.getElementById('f-date').value;
  const amount = parseFloat(document.getElementById('f-amount').value);
  const vendor = document.getElementById('f-vendor').value.trim();
  const category = document.getElementById('f-category').value;
  const notes = document.getElementById('f-notes').value.trim();
  if (!date || !amount || amount <= 0 || !vendor) {
    showToast('請填妥日期、金額同商戶名稱', 'error');
    return;
  }
  const id = state.editingId || ('exp_' + Date.now());
  const existing = state.editingId ? state.expenses.find((e) => e.id === state.editingId) : null;
  const expense = {
    id, date, amount, vendor, category, notes,
    images: [...state.currentImages],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (state.editingId) {
    const idx = state.expenses.findIndex((e) => e.id === state.editingId);
    if (idx >= 0) state.expenses[idx] = expense;
    else state.expenses.unshift(expense);
  } else {
    state.expenses.unshift(expense);
  }
  try {
    await saveExpenses(state.expenses);
    stopCamera();
    setState({ currentImages: [], editingId: null });
    showToast(`開支已儲存（含 ${expense.images.length} 張相）`, 'success');
    switchView('dashboard');
  } catch (err) {
    showToast('儲存失敗：' + err.message, 'error');
  }
}
