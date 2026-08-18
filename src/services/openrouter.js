/**
 * OpenAI-compatible aggregator client (OpenRouter, Together, etc.)
 */

import { showToast } from '../ui/toast.js';
import { runAnalyzeMultiple } from './analyze-multiple.js';
import { API_HEADERS } from './api-headers.js';
import { isAllowedAggregatorBase } from '../../lib/aggregator-allowlist.js';

function getConfig() {
  const userApiKey =
    localStorage.getItem('user_aggregator_api_key') ||
    localStorage.getItem('user_openrouter_api_key') ||
    '';
  const model =
    localStorage.getItem('aggregator_model') ||
    localStorage.getItem('openrouter_model') ||
    'google/gemini-2.0-flash-001';
  let baseUrl =
    localStorage.getItem('aggregator_base_url') ||
    localStorage.getItem('openrouter_base_url') ||
    'https://openrouter.ai/api/v1';
  if (!isAllowedAggregatorBase(baseUrl)) {
    baseUrl = 'https://openrouter.ai/api/v1';
  }
  return { userApiKey, model, baseUrl };
}

async function fetchCompat(body, { retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch('/api/openai-compatible', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const msg = data.error || `HTTP ${res.status}`;
    if ((res.status === 429 || /rate|quota/i.test(msg)) && i < retries) {
      const wait = 1500 * Math.pow(2, i);
      showToast(`Aggregator 繁忙，${Math.round(wait / 1000)}s 後重試…`, 'warning');
      await new Promise(r => setTimeout(r, wait));
      lastErr = new Error(msg);
      continue;
    }
    throw new Error(msg + (data.modelUsed ? ` [${data.modelUsed}]` : ''));
  }
  throw lastErr || new Error('請求失敗');
}

export async function analyzeReceiptOpenRouter(imageBase64) {
  const cfg = getConfig();
  const data = await fetchCompat({ action: 'analyze-receipt', imageBase64, ...cfg });
  return data.data;
}

export async function generateSummaryOpenRouter(expenses) {
  const cfg = getConfig();
  const data = await fetchCompat({ action: 'generate-summary', expenses, ...cfg });
  return data.data;
}

/** @deprecated prefer providers.aggregator.analyzeMultiple */
export async function analyzeMultipleOpenRouter(images, onProgress) {
  return runAnalyzeMultiple(
    images,
    (img) => analyzeReceiptOpenRouter(img),
    { onProgress, label: 'Aggregator', gapMs: 800 }
  );
}
