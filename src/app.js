/**
 * Main Application Controller
 * Handles view switching, global events, and orchestration
 * (Grok OAuth login removed)
 */

import { state, subscribe } from './state.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderAddExpense } from './ui/add-expense.js';
import { renderSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { loadExpenses } from './services/storage.js';

let currentView = 'dashboard';

export async function initApp() {
  const expenses = await loadExpenses();
  state.expenses = expenses;

  renderApp();

  subscribe(() => {
    renderApp();
  });

  setupInstallPrompt();
}

function renderApp() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <!-- Header -->
    <header class="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary-800 rounded-2xl flex items-center justify-center text-xl shadow-sm">💰</div>
          <div>
            <h1 class="font-semibold text-[17px] tracking-tight leading-tight">開支索償</h1>
            <p class="text-[10px] text-slate-500 -mt-0.5">Secure & Smart</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button id="install-btn" class="hidden items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full hover:bg-slate-50 active:scale-95 transition">
            📲 安裝
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main id="main-content" class="max-w-lg mx-auto px-4 pt-4 pb-28 min-h-[calc(100vh-100px)]">
      <!-- Views injected here -->
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div class="max-w-lg mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div class="grid grid-cols-4 h-16">
          <button data-view="dashboard" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-primary-800">
            <span class="text-xl">🏠</span>
            <span class="text-[10px] font-medium">主頁</span>
          </button>
          
          <button data-view="add" class="nav-btn relative flex flex-col items-center justify-center -mt-5">
            <div class="w-14 h-14 bg-primary-800 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-primary-800/30 active:scale-95 transition-transform">
              ＋
            </div>
          </button>
          
          <button data-view="pdf" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500">
            <span class="text-xl">📄</span>
            <span class="text-[10px] font-medium">PDF</span>
          </button>
          
          <button data-view="settings" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500">
            <span class="text-xl">⚙️</span>
            <span class="text-[10px] font-medium">設定</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Toast container -->
    <div id="toast-root" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none"></div>

    <!-- Report Modal (for AI 月結報告) -->
    <div id="report-modal" class="fixed inset-0 z-[200] hidden items-end sm:items-center justify-center bg-black/40 p-4">
      <div class="bg-white w-full max-w-lg max-h-[80vh] rounded-3xl shadow-xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-base">✨ AI 月結報告</h3>
          <button id="report-close" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">✕</button>
        </div>
        <div id="report-body" class="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words"></div>
        <div class="px-5 py-3 border-t border-slate-100">
          <button id="report-copy" class="w-full py-2.5 rounded-xl bg-primary-800 text-white text-sm font-medium active:scale-[0.98] transition">複製報告</button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'pdf') {
        import('./services/pdf.js').then(m => m.generatePDF());
        return;
      }
      switchView(view);
    });
  });

  // Modal close
  document.getElementById('report-close')?.addEventListener('click', closeReportModal);
  document.getElementById('report-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'report-modal') closeReportModal();
  });

  switchView(currentView);
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

/** Show AI report in a proper modal (avoids alert() Chinese garbled text) */
export function showReportModal(text) {
  const modal = document.getElementById('report-modal');
  const body = document.getElementById('report-body');
  if (!modal || !body) {
    // fallback
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
        showToast('已複製報告', 'success');
      } catch {
        showToast('複製失敗，請手動選取文字', 'warning');
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
        if (outcome === 'accepted') {
          btn.classList.add('hidden');
          showToast('已加入主畫面', 'success');
        }
        deferredPrompt = null;
      };
    }
  });

  // Already installed
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('install-btn');
    if (btn) btn.classList.add('hidden');
  });
}
