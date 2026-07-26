/**
 * Main Application Controller
 * Handles view switching, global events, and orchestration
 */

import { state, subscribe } from './state.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderAddExpense } from './ui/add-expense.js';
import { renderSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { loadExpenses } from './services/storage.js';

let currentView = 'dashboard';

export async function initApp() {
  // Load data
  const expenses = await loadExpenses();
  state.expenses = expenses;
  
  // Initial render
  renderApp();
  
  // Subscribe to state changes
  subscribe(() => {
    renderApp();
  });
  
  // Handle deep links / OAuth callback
  handleAuthCallback();
  
  // PWA install prompt
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
          <div id="auth-badge" class="hidden sm:flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">
            <span id="auth-name">Guest</span>
          </div>
          <button id="install-btn" class="hidden items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full hover:bg-slate-50 active:scale-95 transition">
            📲 安裝
          </button>
        </div>
      </div>
    </header>

    <!-- Auth Status (compact) -->
    <div id="auth-bar" class="max-w-lg mx-auto px-4">
      <div class="flex items-center justify-between py-2 px-3 bg-slate-100/80 rounded-b-2xl text-xs border-x border-b border-slate-200/60">
        <span id="auth-status" class="text-slate-600">🔒 未連接 Grok</span>
        <button id="auth-btn" class="bg-black text-white px-3 py-1 rounded-full font-medium hover:bg-slate-800 active:scale-95 transition">
          登入
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <main id="main-content" class="max-w-lg mx-auto px-4 pt-4 pb-28 min-h-[calc(100vh-140px)]">
      <!-- Views injected here -->
    </main>

    <!-- Bottom Navigation (improved) -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div class="max-w-lg mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div class="grid grid-cols-4 h-16">
          <button data-view="dashboard" class="nav-btn flex flex-col items-center justify-center gap-0.5 text-primary-800">
            <span class="text-xl">🏠</span>
            <span class="text-[10px] font-medium">主頁</span>
          </button>
          
          <!-- FAB style Add button -->
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
  `;

  // Bind navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'pdf') {
        // Trigger PDF generation
        import('./services/pdf.js').then(m => m.generatePDF());
        return;
      }
      switchView(view);
    });
  });

  // Bind auth button
  document.getElementById('auth-btn')?.addEventListener('click', () => {
    window.location.href = '/api/auth/login';
  });

  // Render current view
  switchView(currentView);
}

export function switchView(view) {
  currentView = view;
  const main = document.getElementById('main-content');
  if (!main) return;

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('text-primary-800', isActive);
    btn.classList.toggle('text-slate-500', !isActive);
  });

  // Render view
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

function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('access_token');
  const name = params.get('user_name');
  
  if (token) {
    localStorage.setItem('grok_token', token);
    if (name) localStorage.setItem('grok_name', name);
    
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    showToast(`已登入：${name || 'Grok 用戶'}`, 'success');
  }

  // Always restore UI from localStorage (works on normal page load too)
  const savedToken = localStorage.getItem('grok_token');
  const savedName = localStorage.getItem('grok_name') || 'Grok';
  
  if (savedToken) {
    const badge = document.getElementById('auth-badge');
    const status = document.getElementById('auth-status');
    const btn = document.getElementById('auth-btn');
    
    if (badge) {
      badge.classList.remove('hidden');
      const nameEl = document.getElementById('auth-name');
      if (nameEl) nameEl.textContent = savedName;
    }
    if (status) status.textContent = `✅ ${savedName}`;
    if (btn) {
      btn.textContent = '登出';
      btn.onclick = () => {
        localStorage.removeItem('grok_token');
        localStorage.removeItem('grok_name');
        location.reload();
      };
    }
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
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          btn.classList.add('hidden');
        }
        deferredPrompt = null;
      };
    }
  });
}
