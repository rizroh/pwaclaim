/**
 * Gemini AI Service – with 429 retry + detailed progress
 */

import { showToast } from '../ui/toast.js';
import { runAnalyzeMultiple } from './analyze-multiple.js';

async function fetchWithRetry(url, options, { retries = 3, baseDelay = 2000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (res.ok) return { res, data };

    const msg = data.error || data.details?.error?.message || `HTTP ${res.status}`;
    const is429 = res.status === 429 || /quota|rate|resource.exhausted/i.test(String(msg));

    if (is429 && attempt < retries) {
      const wait = baseDelay * Math.pow(2, attempt);
      showToast(`額度繁忙，${Math.round(wait / 1000)} 秒後重試…`, 'warning');
      await new Promise(r => setTimeout(r, wait));
      lastErr = new Error(msg + (data.modelUsed ? ` [${data.modelUsed}]` : ''));
      continue;
    }

    throw new Error(msg + (data.modelUsed ? ` [${data.modelUsed}]` : ''));
  }
  throw lastErr || new Error('請求失敗');
}

export async function analyzeReceipt(imageBase64, userApiKey = '', model = 'gemini-3.5-flash-lite') {
  const { data } = await fetchWithRetry('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'analyze-receipt',
      imageBase64,
      userApiKey,
      model
    })
  });
  return data.data;
}

export async function generateSummary(expenses, userApiKey = '', model = 'gemini-3.5-flash-lite') {
  const { data } = await fetchWithRetry('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate-summary',
      expenses,
      userApiKey,
      model
    })
  }, { retries: 2 });
  return data.data;
}

/**
 * onProgress(current, total, status) 
 * status: { index, state: 'pending'|'running'|'ok'|'fail', message? }
 */

/** @deprecated prefer providers.gemini.analyzeMultiple */
export async function analyzeMultipleReceipts(images, onProgress) {
  const userKey = localStorage.getItem('user_gemini_api_key') || '';
  const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
  return runAnalyzeMultiple(
    images,
    (img) => analyzeReceipt(img, userKey, model),
    { onProgress, label: 'Gemini', gapMs: 1000 }
  );
}
