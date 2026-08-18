/**
 * Add / Edit Expense View
 * Full: Camera + OCR + Gemini + Compress
 */

import { state, setState } from '../state.js';
import { switchView } from '../app.js';
import { showToast } from './toast.js';
import { saveExpenses } from '../services/storage.js';
import { compressImage } from '../utils.js';
import { performLocalOCR } from '../services/ocr.js';
import { analyzeMultipleReceipts } from '../services/gemini.js';
import { analyzeMultipleWithGrok } from '../services/grok.js';

const MAX_IMAGES = 10;
let cameraStream = null;

export function renderAddExpense(container) {
  const isEdit = !!state.editingId;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <button id="btn-back" class="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 active:scale-95 transition">
        ← 返回
      </button>
      <h2 class="font-semibold text-lg">${isEdit ? '編輯開支' : '新增開支'}</h2>
      <div class="w-12"></div>
    </div>

    <!-- Image Capture -->
    <div class="bg-white rounded-3xl border border-slate-200 p-4 mb-4 shadow-sm">
      <p class="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">收據相片（最多 ${MAX_IMAGES} 張）</p>
      
      <div id="previews" class="flex flex-wrap gap-2.5 mb-3 min-h-[76px]"></div>
      
      <div class="grid grid-cols-2 gap-2.5">
        <button id="btn-camera" class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-primary-300 hover:border-primary-500 hover:bg-primary-50 active:scale-[0.98] transition rounded-2xl py-4 text-primary-700">
          <span class="text-2xl">📷</span>
          <span class="text-xs font-semibold">影相</span>
          <span class="text-[10px] text-primary-500">後置鏡頭</span>
        </button>
        <label class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] transition rounded-2xl py-4 cursor-pointer text-slate-600">
          <span class="text-2xl">🖼️</span>
          <span class="text-xs font-semibold">上傳</span>
          <span class="text-[10px] text-slate-400">支援多張</span>
          <input type="file" id="file-input" accept="image/*" multiple class="hidden">
        </label>
      </div>

      <div class="mt-3 space-y-2">
        <button id="btn-ocr" class="w-full hidden items-center justify-center gap-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition text-white py-3 rounded-2xl disabled:opacity-60">
          🤖 本地 OCR 掃描
        </button>
        <button id="btn-gemini" class="w-full hidden items-center justify-center gap-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition text-white py-3 rounded-2xl disabled:opacity-60">
          ✨ Gemini AI 分析
        </button>
        <button id="btn-grok" class="w-full hidden items-center justify-center gap-2 text-sm font-medium bg-black hover:bg-slate-800 active:scale-[0.98] transition text-white py-3 rounded-2xl disabled:opacity-60">
          🚀 Grok Vision 分析
        </button>
        <p id="ocr-note" class="hidden text-center text-[10px] text-emerald-600 mt-1">首次使用會下載語言模型，需時約 15-40 秒</p>
        <div id="analyze-progress" class="hidden mt-2 space-y-1 text-xs"></div>
      </div>
    </div>

    <!-- Form -->
    <div class="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3.5">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">日期</label>
          <input id="f-date" type="date" class="w-full border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 rounded-xl px-3 py-2.5 text-sm outline-none transition">
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 mb-1">金額 (HKD)</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">HK$</span>
            <input id="f-amount" type="number" step="0.01" placeholder="0.00" class="w-full border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 rounded-xl pl-11 pr-3 py-2.5 text-sm font-medium outline-none transition">
          </div>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">商戶名稱</label>
        <input id="f-vendor" type="text" placeholder="例如：Cafe de Coral / 百佳" class="w-full border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 rounded-xl px-3 py-2.5 text-sm outline-none transition">
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">類別</label>
        <select id="f-category" class="w-full border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 rounded-xl px-3 py-2.5 text-sm bg-white outline-none transition">
          <option value="Meals">🍽️ 餐飲</option>
          <option value="Transport">🚕 交通</option>
          <option value="Office">📎 辦公</option>
          <option value="Professional Services">💼 專業服務</option>
          <option value="Marketing">📣 市場推廣</option>
          <option value="Travel">✈️ 差旅</option>
          <option value="Utilities">💡 水電煤</option>
          <option value="Other">📦 其他</option>
        </select>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">備註（可選）</label>
        <textarea id="f-notes" rows="2" placeholder="例如：客戶會議 / 項目開支" class="w-full border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition"></textarea>
      </div>
    </div>

    <button id="btn-save" class="mt-5 w-full bg-primary-800 hover:bg-primary-900 active:scale-[0.98] transition text-white font-semibold py-4 rounded-2xl text-sm shadow-lg shadow-primary-800/25">
      儲存開支
    </button>

    <!-- Camera Modal：所見即所得（object-contain，唔再用 object-cover 裁切） -->
    <div id="camera-modal" class="hidden fixed inset-0 bg-black z-[100] flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 safe-top">
        <p class="text-white text-sm font-medium">影收據</p>
        <button id="btn-close-camera" class="text-white/90 text-sm px-3 py-1.5 rounded-full bg-white/10">取消</button>
      </div>
      <div class="flex-1 relative flex items-center justify-center bg-black overflow-hidden min-h-0">
        <video id="camera-video" autoplay playsinline muted
          class="max-w-full max-h-full w-auto h-auto object-contain"></video>
        <!-- 對齊輔助框：只係指南，唔裁切；影出嚟 = 你見到嘅成個畫面 -->
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div class="w-full max-w-sm aspect-[3/4] border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative">
            <span class="absolute -top-6 left-0 right-0 text-center text-[11px] text-white/80">將收據放入框內（參考）</span>
            <div class="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl"></div>
            <div class="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr"></div>
            <div class="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl"></div>
            <div class="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white rounded-br"></div>
          </div>
        </div>
        <canvas id="camera-canvas" class="hidden"></canvas>
        <div id="camera-flash" class="hidden absolute inset-0 bg-white pointer-events-none"></div>
      </div>
      <div class="px-6 py-5 pb-8 bg-black/80 flex items-center justify-center gap-8 safe-bottom">
        <button id="btn-switch-cam" type="button" class="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center text-lg" title="切換鏡頭">🔄</button>
        <button id="btn-capture" type="button" class="w-18 h-18 w-16 h-16 rounded-full bg-white border-4 border-slate-300 active:scale-90 transition shadow-lg" title="拍照"></button>
        <div class="w-12 h-12"></div>
      </div>
    </div>
  `;

  // Bind events
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
  document.getElementById('btn-ocr')?.addEventListener('click', runOCR);
  document.getElementById('btn-gemini')?.addEventListener('click', runGemini);
  document.getElementById('btn-grok')?.addEventListener('click', runGrok);
  document.getElementById('btn-save')?.addEventListener('click', save);

  // Default date
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);

  renderPreviews();
}

async function handleFiles(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const remaining = MAX_IMAGES - state.currentImages.length;
  if (remaining <= 0) {
    showToast(`最多 ${MAX_IMAGES} 張相片`, 'error');
    return;
  }

  for (const file of files.slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    await new Promise(resolve => {
      reader.onload = async (ev) => {
        const compressed = await compressImage(ev.target.result);
        state.currentImages.push(compressed);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  renderPreviews();
  e.target.value = '';
}

let facingMode = 'environment'; // rear by default

async function startCamera() {
  const modal = document.getElementById('camera-modal');
  try {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await openCameraStream(facingMode);
  } catch (err) {
    console.warn('camera error', err);
    // fallback without facingMode constraint
    try {
      await openCameraStream(null);
    } catch (err2) {
      stopCamera();
      showToast('未能啟用鏡頭，請使用上傳功能', 'error');
    }
  }
}

async function openCameraStream(facing) {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const constraints = {
    audio: false,
    video: facing
      ? {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      : {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
  };
  cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = document.getElementById('camera-video');
  if (video) {
    video.srcObject = cameraStream;
    await video.play().catch(() => {});
  }
}

async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  try {
    await openCameraStream(facingMode);
  } catch (err) {
    showToast('無法切換鏡頭', 'warning');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
  const modal = document.getElementById('camera-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  // 等一幀有真實解像度（避免 0x0）
  if (!video.videoWidth || !video.videoHeight) {
    showToast('鏡頭未就緒，請再試', 'warning');
    return;
  }

  // 閃光效果
  const flash = document.getElementById('camera-flash');
  if (flash) {
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 120);
  }

  // 所見即所得：用完整 video frame（同 object-contain 預覽一致，唔裁切）
  const maxW = 1600;
  let cw = video.videoWidth;
  let ch = video.videoHeight;
  if (cw > maxW) {
    ch = Math.round(ch * maxW / cw);
    cw = maxW;
  }
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

  if (state.currentImages.length < MAX_IMAGES) {
    state.currentImages.push(dataUrl);
    renderPreviews();
    showToast('已拍照', 'success');
  } else {
    showToast(`最多 ${MAX_IMAGES} 張相片`, 'error');
  }
  stopCamera();
}

function renderPreviews() {
  const el = document.getElementById('previews');
  if (!el) return;

  el.innerHTML = state.currentImages.map((src, i) => `
    <div class="relative">
      <img src="${src}" class="w-[72px] h-[72px] object-cover rounded-xl border-2 border-slate-200">
      <button data-remove="${i}" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow">×</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.remove);
      state.currentImages.splice(idx, 1);
      renderPreviews();
    });
  });

  // Toggle AI buttons
  const hasImages = state.currentImages.length > 0;
  ['btn-ocr', 'btn-gemini', 'btn-grok'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      if (hasImages) {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
      } else {
        btn.classList.add('hidden');
        btn.classList.remove('flex');
      }
    }
  });
  const note = document.getElementById('ocr-note');
  if (note) note.classList.toggle('hidden', !hasImages);
}

async function runOCR() {
  if (state.currentImages.length === 0) return;
  const btn = document.getElementById('btn-ocr');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '🤖 讀取語言模型中...';

  try {
    const result = await performLocalOCR(state.currentImages[0]);
    if (result.date) document.getElementById('f-date').value = result.date;
    if (result.amount > 0) document.getElementById('f-amount').value = result.amount.toFixed(2);
    if (result.vendor) document.getElementById('f-vendor').value = result.vendor;
    showToast('本地 OCR 分析完成！請確認自動填寫的資訊。', 'success');
  } catch (err) {
    console.error(err);
    showToast('本地 OCR 失敗，請手動填寫或使用 Gemini AI', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function runGemini() {
  if (state.currentImages.length === 0) return;
  const btn = document.getElementById('btn-gemini');
  const progressEl = document.getElementById('analyze-progress');
  const original = btn.innerHTML;
  btn.disabled = true;
  if (progressEl) {
    progressEl.classList.remove('hidden');
    progressEl.innerHTML = state.currentImages.map((_, i) =>
      `<div class="flex items-center gap-2 text-slate-500"><span>⏳</span><span>第 ${i + 1} 張：等候中</span></div>`
    ).join('');
  }

  try {
    const result = await analyzeMultipleReceipts(state.currentImages, (current, total, meta) => {
      btn.innerHTML = `分析中 ${current}/${total}...`;
      if (progressEl && meta?.statuses) {
        progressEl.innerHTML = meta.statuses.map(s => {
          const icon = s.state === 'ok' ? '✅' : s.state === 'fail' ? '❌' : s.state === 'running' ? '🔄' : '⏳';
          const label = s.state === 'ok' ? '成功' : s.state === 'fail' ? ('失敗 ' + (s.message || '')).slice(0, 40) : s.state === 'running' ? '分析中…' : '等候中';
          return `<div class="flex items-center gap-2 ${s.state==='fail'?'text-red-600':s.state==='ok'?'text-emerald-600':'text-slate-500'}"><span>${icon}</span><span>第 ${s.index + 1} 張：${label}</span></div>`;
        }).join('');
      }
    });

    if (result.failCount > 0) {
      state.currentImages = result.successIndices.map(i => state.currentImages[i]);
      renderPreviews();
    }

    document.getElementById('f-amount').value = result.amount.toFixed(2);
    if (result.date) document.getElementById('f-date').value = result.date;
    if (result.vendor) document.getElementById('f-vendor').value = result.vendor;
    if (result.category) document.getElementById('f-category').value = result.category;
    if (result.notes) document.getElementById('f-notes').value = result.notes;

    let msg = `完成！成功 ${result.successCount} 張，總金額 HK$${result.amount.toFixed(2)}`;
    if (result.failCount > 0) msg += `｜已抽走 ${result.failCount} 張失敗相`;
    showToast(msg, 'info');
  } catch (err) {
    showToast('分析失敗: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function runGrok() {
  if (state.currentImages.length === 0) return;
  const btn = document.getElementById('btn-grok');
  const original = btn.innerHTML;
  btn.disabled = true;

  try {
    const result = await analyzeMultipleWithGrok(state.currentImages, (current, total) => {
      btn.innerHTML = `Grok 分析中 ${current}/${total}...`;
    });

    if (result.failCount > 0) {
      state.currentImages = result.successIndices.map(i => state.currentImages[i]);
      renderPreviews();
    }

    document.getElementById('f-amount').value = result.amount.toFixed(2);
    if (result.date) document.getElementById('f-date').value = result.date;
    if (result.vendor) document.getElementById('f-vendor').value = result.vendor;
    if (result.category) document.getElementById('f-category').value = result.category;
    if (result.notes) document.getElementById('f-notes').value = result.notes;

    let msg = `Grok 完成！成功 ${result.successCount} 張，總金額 HK$${result.amount.toFixed(2)}`;
    if (result.failCount > 0) {
      msg += `｜已抽走 ${result.failCount} 張失敗相`;
    }
    showToast(msg, 'info');
  } catch (err) {
    showToast('Grok 分析失敗: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
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
  const existing = state.editingId
    ? state.expenses.find(e => e.id === state.editingId)
    : null;

  const expense = {
    id,
    date,
    amount,
    vendor,
    category,
    notes,
    images: [...state.currentImages],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (state.editingId) {
    const idx = state.expenses.findIndex(e => e.id === state.editingId);
    if (idx >= 0) state.expenses[idx] = expense;
    else state.expenses.unshift(expense);
  } else {
    state.expenses.unshift(expense);
  }

  try {
    await saveExpenses(state.expenses);
    setState({ currentImages: [], editingId: null });
    showToast(`開支已儲存（含 ${expense.images.length} 張相）`, 'success');
    switchView('dashboard');
  } catch (err) {
    showToast('儲存失敗：' + err.message, 'error');
  }
}
