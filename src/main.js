/**
 * Expense Claim PWA - Entry Point
 * Priority 1+2 Redesign Skeleton
 */

import { initApp } from './app.js';
import { initStorage } from './services/storage.js';

// Boot sequence
async function boot() {
  try {
    await initStorage();
    await initApp();
  } catch (err) {
    console.error('Boot failed:', err);
    document.getElementById('app').innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-6">
        <div class="text-center">
          <div class="text-4xl mb-4">⚠️</div>
          <h1 class="text-lg font-semibold mb-2">載入失敗</h1>
          <p class="text-sm text-slate-500 mb-4">${err.message}</p>
          <button onclick="location.reload()" class="px-5 py-2.5 bg-primary-800 text-white rounded-2xl text-sm font-medium">
            重新載入
          </button>
        </div>
      </div>
    `;
  }
}

boot();
