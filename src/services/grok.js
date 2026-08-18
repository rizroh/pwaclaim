/**
 * Grok (xAI) Vision — single image + thin multi wrapper
 */

import { showToast } from '../ui/toast.js';
import { runAnalyzeMultiple } from './analyze-multiple.js';

async function fetchGrokWithRetry(imageBase64, model, userApiKey, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch('/api/grok-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, userApiKey, model })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data.data;
    const msg = data.error || data.details || ('HTTP ' + res.status);
    const is429 = res.status === 429 || /quota|rate|resource/i.test(String(msg));
    if (is429 && attempt < retries) {
      const wait = 2000 * Math.pow(2, attempt);
      showToast('Grok 額度繁忙，' + Math.round(wait / 1000) + ' 秒後重試…', 'warning');
      await new Promise(r => setTimeout(r, wait));
      lastErr = new Error(msg);
      continue;
    }
    throw new Error(msg + (data.modelUsed ? ' [' + data.modelUsed + ']' : ''));
  }
  throw lastErr || new Error('Grok 請求失敗');
}

export async function analyzeReceiptWithGrok(imageBase64, model = 'grok-2-vision-latest') {
  const userApiKey = localStorage.getItem('user_xai_api_key') || '';
  return fetchGrokWithRetry(imageBase64, model, userApiKey);
}

/** @deprecated prefer providers.grok.analyzeMultiple */
export async function analyzeMultipleWithGrok(images, onProgress) {
  const model = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';
  return runAnalyzeMultiple(
    images,
    (img) => analyzeReceiptWithGrok(img, model),
    { onProgress, label: 'Grok', gapMs: 800 }
  );
}
