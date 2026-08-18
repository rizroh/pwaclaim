import './styles.css';
import { initApp } from './app.js';
import { initStorage } from './services/storage.js';

async function boot() {
  try {
    await initStorage();
    await initApp();
  } catch (err) {
    console.error('Boot failed:', err);
    const app = document.getElementById('app');
    if (!app) return;
    app.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'min-h-screen flex items-center justify-center p-6';
    const box = document.createElement('div');
    box.className = 'text-center';
    const icon = document.createElement('div');
    icon.className = 'text-4xl mb-4';
    icon.textContent = '⚠️';
    const h1 = document.createElement('h1');
    h1.className = 'text-lg font-semibold mb-2';
    h1.textContent = '載入失敗';
    const p = document.createElement('p');
    p.className = 'text-sm text-slate-500 mb-4';
    p.textContent = err?.message || String(err);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'px-5 py-2.5 bg-primary-800 text-white rounded-2xl text-sm font-medium';
    btn.textContent = '重新載入';
    btn.addEventListener('click', () => location.reload());
    box.append(icon, h1, p, btn);
    wrap.appendChild(box);
    app.appendChild(wrap);
  }
}

boot();
