/**
 * OCR + provider analyze actions
 */

import { state } from '../state.js';
import { showToast } from './toast.js';
import { performLocalOCR } from '../services/ocr.js';
import { getProvider, listProviders } from '../services/providers.js';
import { renderPreviews } from './add-expense-media.js';

function fillForm(result) {
  const a = document.getElementById('f-amount');
  const d = document.getElementById('f-date');
  const v = document.getElementById('f-vendor');
  const c = document.getElementById('f-category');
  const n = document.getElementById('f-notes');
  if (a && result.amount != null) a.value = Number(result.amount).toFixed(2);
  if (d && result.date) d.value = result.date;
  if (v && result.vendor) v.value = result.vendor;
  if (c && result.category) c.value = result.category;
  if (n && result.notes) n.value = result.notes;
}

function renderProgress(meta) {
  const progressEl = document.getElementById('analyze-progress');
  if (!progressEl || !meta?.statuses) return;
  progressEl.classList.remove('hidden');
  progressEl.innerHTML = '';
  meta.statuses.forEach(s => {
    const row = document.createElement('div');
    const icon = s.state === 'ok' ? '✅' : s.state === 'fail' ? '❌' : s.state === 'running' ? '🔄' : '⏳';
    const label = s.state === 'ok' ? '成功' : s.state === 'fail'
      ? ('失敗 ' + (s.message || '')).slice(0, 48)
      : s.state === 'running' ? '分析中…' : '等候中';
    row.className = 'flex items-center gap-2 ' + (
      s.state === 'fail' ? 'text-red-600' : s.state === 'ok' ? 'text-emerald-600' : 'text-slate-500'
    );
    row.textContent = `${icon} 第 ${s.index + 1} 張：${label}`;
    progressEl.appendChild(row);
  });
}

export async function runOCR() {
  if (!state.currentImages.length) return;
  const btn = document.querySelector('[data-provider="ocr"]');
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '🤖 OCR 中…'; }
  try {
    const text = await performLocalOCR(state.currentImages[0]);
    const notes = document.getElementById('f-notes');
    if (notes && text) notes.value = (notes.value ? notes.value + '\n' : '') + text.slice(0, 500);
    showToast('OCR 完成（已填入備註）', 'success');
  } catch (err) {
    showToast('OCR 失敗：' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original || '🤖 本地 OCR 掃描'; }
  }
}

export async function runProvider(providerId) {
  if (!state.currentImages.length) return;
  const provider = getProvider(providerId);
  if (!provider) return;

  if (provider.requiresUserKey) {
    const key = localStorage.getItem(provider.keyStorageKey) ||
      localStorage.getItem('user_openrouter_api_key');
    if (!key) {
      showToast('請先到設定填寫 Aggregator API Key', 'warning', 4000);
      return;
    }
  }

  const btn = document.querySelector(`[data-provider="${providerId}"]`);
  const original = btn?.innerHTML;
  if (btn) btn.disabled = true;

  try {
    const result = await provider.analyzeMultiple(state.currentImages, (cur, total, meta) => {
      if (btn) btn.textContent = `${provider.emoji} ${cur}/${total}…`;
      renderProgress(meta);
    });

    if (result.failCount > 0) {
      state.currentImages = result.successIndices.map(i => state.currentImages[i]);
      renderPreviews();
    }
    fillForm(result);
    let msg = `完成！成功 ${result.successCount} 張，HK$${Number(result.amount).toFixed(2)}`;
    if (result.failCount > 0) msg += `｜抽走 ${result.failCount} 張失敗相`;
    showToast(msg, 'info');
  } catch (err) {
    showToast(`${provider.label}失敗: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original || `${provider.emoji} ${provider.label}`;
    }
  }
}

export function providerButtonsHtml() {
  const ocr = `<button type="button" data-analyze-btn data-provider="ocr" class="w-full hidden items-center justify-center gap-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition text-white py-3 rounded-2xl disabled:opacity-60">
          🤖 本地 OCR 掃描
        </button>`;
  const providers = listProviders().map(p =>
    `<button type="button" data-analyze-btn data-provider="${p.id}" class="w-full hidden items-center justify-center gap-2 text-sm font-medium ${p.btnClass} active:scale-[0.98] transition text-white py-3 rounded-2xl disabled:opacity-60">
          ${p.emoji} ${p.label}
        </button>`
  ).join('\n');
  return ocr + '\n' + providers;
}

export function bindAnalyzeButtons() {
  document.querySelector('[data-provider="ocr"]')?.addEventListener('click', runOCR);
  listProviders().forEach(p => {
    document.querySelector(`[data-provider="${p.id}"]`)?.addEventListener('click', () => runProvider(p.id));
  });
}
