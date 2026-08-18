/**
 * Main Application Controller
 * Shell renders once; views update independently.
 */

import { state, subscribe, setState } from './state.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderAddExpense } from './ui/add-expense.js';
import { renderSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { loadExpenses } from './services/storage.js';

let currentView = 'dashboard';
let pdfObjectUrl = null;
let shellReady = false;

export async function initApp() {
  const expenses = await loadExpenses();
  state.expenses = expenses;
  state.online = navigator.onLine;

  renderShell();
  switchView('dashboard');

  // Only update offline banner — NEVER full shell re-render (kills modals/forms)
  subscribe(() => {
    updateOfflineBanner();
  });

  setupInstallPrompt();
  setupOnlineListeners();
  window.showPdfPreview = showPdfPreview;
}

function setupOnlineListeners() {
  window.addEventListener('online', () => {
    state.online = true;
    updateOfflineBanner();
    showToast('已恢復網絡', 'success');
  });
  window.addEventListener('offline', () => {
    state.online = false;
    updateOfflineBanner();
  });
}

function updateOfflineBanner() {
  const bar = document.getElementById('offline-banner');
  if (!bar) return;
  if (state.online === false) {
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary-800 rounded-2xl flex items-center justify-center text-xl shadow-sm">💰</div>
          <div>
            <h1 class="font-semibold text-[17px] tracking-tight leading-tight">開支索償</h1>
            <p class="text-[10px] text-slate-500 -mt-0.5">Secure & Smart</p>
          </div>
        </div>
        <button id="install-btn" type="button" class="hidden items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full">📲 安裝</button>
      </div>
      <div id="offline-banner" class="${state.online === false ? '' : 'hidden'} bg-amber-500 text-white text-center text-xs font-medium py-1.5">
        📡 離線模式：可睇已存記錄，AI／上傳需連網
      </div>
    </header>

    <main id="main-content" class="max-w-lg mx-auto px-4 pt-4 pb-28 min-h-[calc(100vh-100px)]"></main>

    <nav class="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div class="max-w-lg mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div class="grid grid-cols-4 h-16">
          <button type="button" data-view="dashboard" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-primary-800">
            <span class="text-xl">🏠</span><span class="text-[10px] font-medium">主頁</span>
          </button>
          <button type="button" data-view="add" class="nav-btn relative flex flex-col items-center justify-center -mt-5">
            <div class="w-14 h-14 bg-primary-800 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-primary-800/30">＋</div>
          </button>
          <button type="button" data-view="pdf" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500">
            <span class="text-xl">📄</span><span class="text-[10px] font-medium">PDF</span>
          </button>
          <button type="button" data-view="settings" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500">
            <span class="text-xl">⚙️</span><span class="text-[10px] font-medium">設定</span>
          </button>
        </div>
      </div>
    </nav>

    <div id="toast-root" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none"></div>

    <div id="report-modal" class="fixed inset-0 z-[200] hidden items-end sm:items-center justify-center bg-black/40 p-4">
      <div class="bg-white w-full max-w-lg max-h-[80vh] rounded-3xl shadow-xl flex flex-col overflow-hidden" role="dialog">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-base">✨ AI 月結報告</h3>
          <button type="button" id="report-close" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
        </div>
        <div id="report-body" class="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap break-words"></div>
        <div class="px-5 py-3 border-t border-slate-100">
          <button type="button" id="report-copy" class="w-full py-2.5 rounded-xl bg-primary-800 text-white text-sm font-medium">複製報告</button>
        </div>
      </div>
    </div>

    <div id="pdf-modal" class="fixed inset-0 z-[200] hidden items-end sm:items-center justify-center bg-black/50 p-3">
      <div class="bg-white w-full max-w-lg max-h-[90vh] rounded-3xl shadow-xl flex flex-col overflow-hidden" role="dialog">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 class="font-semibold text-sm">📄 PDF 已就緒</h3>
          <button type="button" id="pdf-close" class="w-8 h-8 rounded-full bg-slate-100">✕</button>
        </div>
        <div id="pdf-body" class="flex-1 min-h-[40vh] bg-slate-50 flex flex-col">
          <iframe id="pdf-frame" class="hidden flex-1 w-full min-h-[50vh] bg-white" title="PDF preview"></iframe>
          <div id="pdf-mobile-hint" class="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div class="text-4xl">📄</div>
            <p class="text-sm text-slate-600 font-medium">PDF 已生成</p>
            <p id="pdf-filename" class="text-xs text-slate-400 break-all"></p>
            <p class="text-[11px] text-slate-400">手機可撳「開啟」用系統閱讀器預覽，或直接下載</p>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
          <button type="button" id="pdf-open" class="w-full py-3 rounded-xl bg-primary-800 text-white text-sm font-medium">開啟 / 預覽</button>
          <button type="button" id="pdf-download" class="w-full py-3 rounded-xl border border-slate-200 text-sm font-medium">下載到手機</button>
          <button type="button" id="pdf-close2" class="w-full py-2 text-sm text-slate-500">關閉</button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'pdf') {
        showToast('準備產生 PDF…', 'info', 1500);
        import('./services/pdf.js')
          .then(m => m.generatePDF())
          .catch(err => {
            console.error(err);
            showToast('PDF 失敗：' + (err && err.message ? err.message : String(err)), 'error', 4000);
          });
        return;
      }
      if (view === 'add' && currentView !== 'add') {
        // FAB = new expense (clear edit mode)
        state.editingId = null;
        state.currentImages = [];
      }
      switchView(view);
    });
  });

  document.getElementById('report-close')?.addEventListener('click', closeReportModal);
  document.getElementById('report-modal')?.addEventListener('click', e => {
    if (e.target.id === 'report-modal') closeReportModal();
  });
  document.getElementById('pdf-close')?.addEventListener('click', closePdfModal);
  document.getElementById('pdf-close2')?.addEventListener('click', closePdfModal);
  document.getElementById('pdf-modal')?.addEventListener('click', e => {
    if (e.target.id === 'pdf-modal') closePdfModal();
  });

  shellReady = true;
}

export function switchView(view) {
  currentView = view;
  const main = document.getElementById('main-content');
  if (!main) return;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('text-primary-800', isActive);
    btn.classList.toggle('text-slate-500', !isActive);
  });

  switch (view) {
    case 'dashboard':
      renderDashboard(main);
      break;
    case 'add':
      renderAddExpense(main);
      break;
    case 'settings':
      renderSettings(main);
      break;
    default:
      renderDashboard(main);
  }
}

export function showReportModal(text) {
  const modal = document.getElementById('report-modal');
  const body = document.getElementById('report-body');
  if (!modal || !body) {
    alert(text);
    return;
  }
  body.textContent = text || '（無內容）';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const copyBtn = document.getElementById('report-copy');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text || '');
        showToast('已複製', 'success');
      } catch {
        showToast('複製失敗', 'warning');
      }
    };
  }
}

function closeReportModal() {
  const modal = document.getElementById('report-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

function showPdfPreview(url, fileName, blob) {
  if (pdfObjectUrl && pdfObjectUrl !== url) {
    try { URL.revokeObjectURL(pdfObjectUrl); } catch (_) {}
  }
  pdfObjectUrl = url;

  const modal = document.getElementById('pdf-modal');
  if (!modal) {
    try {
      const w = window.open(url, '_blank');
      if (!w) triggerDownload(url, fileName, blob);
    } catch (_) {
      triggerDownload(url, fileName, blob);
    }
    return;
  }

  const frame = document.getElementById('pdf-frame');
  const hint = document.getElementById('pdf-mobile-hint');
  const nameEl = document.getElementById('pdf-filename');
  if (nameEl) nameEl.textContent = fileName || 'expense.pdf';

  const mobile = isMobileDevice();
  if (frame && !mobile) {
    frame.classList.remove('hidden');
    if (hint) hint.classList.add('hidden');
    frame.src = url;
  } else {
    if (frame) {
      frame.classList.add('hidden');
      frame.src = '';
    }
    if (hint) hint.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const openBtn = document.getElementById('pdf-open');
  const dlBtn = document.getElementById('pdf-download');

  if (openBtn) {
    openBtn.onclick = () => {
      const w = window.open(url, '_blank');
      if (!w) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    };
  }
  if (dlBtn) {
    dlBtn.onclick = () => {
      triggerDownload(url, fileName, blob);
      showToast('開始下載', 'success');
    };
  }

  showToast('PDF 已生成', 'success');
}

function triggerDownload(url, fileName, blob) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'expense.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (blob && navigator.canShare) {
    try {
      const file = new File([blob], fileName || 'expense.pdf', { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: fileName }).catch(() => {});
      }
    } catch (_) {}
  }
}

function closePdfModal() {
  const modal = document.getElementById('pdf-modal');
  const frame = document.getElementById('pdf-frame');
  if (frame) frame.src = '';
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function setupInstallPrompt() {
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-btn');
    if (btn) {
      btn.classList.remove('hidden');
      btn.classList.add('flex');
      btn.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') btn.classList.add('hidden');
        deferredPrompt = null;
      };
    }
  });
}
