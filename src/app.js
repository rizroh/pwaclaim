import { state, subscribe } from './state.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderAddExpense } from './ui/add-expense.js';
import { renderSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { loadExpenses } from './services/storage.js';
import { generatePDF } from './services/pdf.js';

let currentView = 'dashboard';
let pdfObjectUrl = null;

export async function initApp() {
  state.expenses = await loadExpenses();
  state.online = navigator.onLine;
  renderShell();
  switchView('dashboard');
  subscribe(() => updateOfflineBanner());
  setupInstallPrompt();
  setupOnlineListeners();
  window.showPdfPreview = showPdfPreview;
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex flex-col max-w-lg mx-auto">
      <div id="offline-banner" class="hidden bg-amber-500 text-white text-center text-xs py-1.5">離線模式 — 資料仍存在本機</div>
      <header class="safe-top px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold tracking-wider text-primary-700 uppercase">PWACLAIM</p>
          <h1 class="text-xl font-semibold">開支索償</h1>
        </div>
        <button type="button" id="btn-pdf" class="text-sm font-medium px-3 py-2 rounded-xl bg-white border border-slate-200">PDF</button>
      </header>
      <main id="view" class="flex-1 px-4 pb-28"></main>
      <nav class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/95 border-t border-slate-200 safe-bottom">
        <div class="grid grid-cols-3 text-center text-xs">
          <button type="button" data-nav="dashboard" class="py-3 font-medium">主頁</button>
          <button type="button" data-nav="add" class="py-3 font-medium">新增</button>
          <button type="button" data-nav="settings" class="py-3 font-medium">設定</button>
        </div>
      </nav>
      <div id="toast-root" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 w-[min(92vw,24rem)] pointer-events-none"></div>
      <div id="modal-root"></div>
    </div>
  `;
  document.getElementById('btn-pdf')?.addEventListener('click', () => generatePDF());
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.nav;
      if (v === 'add') {
        state.editingId = null;
        state.currentImages = [];
      }
      switchView(v);
    });
  });
}

export function switchView(name) {
  currentView = name;
  const view = document.getElementById('view');
  if (!view) return;
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('text-primary-800', btn.dataset.nav === name);
    btn.classList.toggle('text-slate-400', btn.dataset.nav !== name);
  });
  if (name === 'dashboard') renderDashboard(view);
  else if (name === 'add') renderAddExpense(view);
  else renderSettings(view);
  view.scrollTop = 0;
}

export function showReportModal(text) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center p-4';
  const box = document.createElement('div');
  box.className = 'bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-auto p-5';
  const h = document.createElement('h3');
  h.className = 'font-semibold mb-3';
  h.textContent = 'AI 月結報告';
  const pre = document.createElement('pre');
  pre.className = 'text-sm whitespace-pre-wrap text-slate-700';
  pre.textContent = text;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mt-4 w-full py-3 rounded-2xl bg-primary-800 text-white text-sm font-medium';
  close.textContent = '關閉';
  close.addEventListener('click', () => { root.innerHTML = ''; });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) root.innerHTML = ''; });
  box.append(h, pre, close);
  overlay.appendChild(box);
  root.appendChild(overlay);
}

export function showPdfPreview(url, blob, filename) {
  if (pdfObjectUrl && pdfObjectUrl !== url) URL.revokeObjectURL(pdfObjectUrl);
  pdfObjectUrl = url;
  const name = filename || `pwaclaim-${new Date().toISOString().slice(0, 10)}.pdf`;
  const root = document.getElementById('modal-root');
  if (!root) {
    window.open(url, '_blank');
    return;
  }
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[90] bg-black/50 flex flex-col';
  const bar = document.createElement('div');
  bar.className = 'flex items-center justify-between px-4 py-3 bg-white gap-2';
  const title = document.createElement('p');
  title.className = 'font-medium text-sm';
  title.textContent = 'PDF 預覽';
  const actions = document.createElement('div');
  actions.className = 'flex gap-2';

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'px-3 py-1.5 rounded-xl bg-primary-800 text-white text-sm';
  share.textContent = '分享 / 下載';
  share.addEventListener('click', async () => {
    try {
      const fileBlob = blob || await fetch(url).then((r) => r.blob());
      const file = new File([fileBlob], name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'px-3 py-1.5 rounded-xl border text-sm';
  close.textContent = '關閉';
  close.addEventListener('click', () => { root.innerHTML = ''; });
  actions.append(share, close);
  bar.append(title, actions);

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.className = 'flex-1 w-full bg-slate-200';
  frame.title = 'PDF preview';
  overlay.append(bar, frame);
  root.appendChild(overlay);
}

function updateOfflineBanner() {
  const bar = document.getElementById('offline-banner');
  if (!bar) return;
  bar.classList.toggle('hidden', state.online !== false);
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

function setupInstallPrompt() {
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    showToast('可以安裝到主畫面', 'info', 4000);
  });
  window.__installPwa = () => deferred?.prompt();
}
