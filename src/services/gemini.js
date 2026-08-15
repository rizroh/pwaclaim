/**
 * Gemini AI Service – with 429 retry + detailed progress
 */

import { showToast } from '../ui/toast.js';

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
export async function analyzeMultipleReceipts(images, onProgress) {
  const userKey = localStorage.getItem('user_gemini_api_key') || '';
  const model = localStorage.getItem('gemini_model') || 'gemini-3.5-flash-lite';
  const total = images.length;

  let totalAmount = 0;
  const vendors = [];
  const categories = [];
  const notesList = [];
  let latestDate = '';
  const successIndices = [];
  const failIndices = [];
  const errorMessages = [];
  const statuses = images.map((_, i) => ({ index: i, state: 'pending' }));

  const emit = (i, state, message) => {
    statuses[i] = { index: i, state, message };
    if (onProgress) onProgress(i + 1, total, { statuses: [...statuses], current: i });
  };

  for (let i = 0; i < total; i++) {
    emit(i, 'running');
    showToast(`分析中 ${i + 1}/${total}…`, 'info');

    try {
      const parsed = await analyzeReceipt(images[i], userKey, model);
      const data = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      const amt = parseFloat(data.amount);

      if (!isNaN(amt) && amt > 0) totalAmount += amt;
      if (data.vendor) vendors.push(data.vendor);
      if (data.category) categories.push(data.category);
      if (data.notes) notesList.push(data.notes);
      if (data.date && (!latestDate || data.date > latestDate)) latestDate = data.date;

      if ((data.vendor && data.vendor !== '未知商戶') || (!isNaN(amt) && amt > 0) || data.date) {
        successIndices.push(i);
        emit(i, 'ok', data.vendor || 'OK');
      } else {
        failIndices.push(i);
        errorMessages.push(`第${i + 1}張: 資料不完整`);
        emit(i, 'fail', '資料不完整');
      }
    } catch (err) {
      console.warn(`Image ${i + 1} failed:`, err.message);
      failIndices.push(i);
      errorMessages.push(`第${i + 1}張: ${err.message}`);
      emit(i, 'fail', err.message);
    }

    if (i < total - 1) await new Promise(r => setTimeout(r, 1000));
  }

  if (successIndices.length === 0) {
    const detail = errorMessages.length > 0 ? errorMessages.slice(0, 3).join(' | ') : '未知錯誤';
    throw new Error(detail);
  }

  let topCategory = 'Other';
  if (categories.length > 0) {
    const freq = {};
    categories.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    topCategory = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  const uniqueVendors = [...new Set(vendors)];
  let vendor = '';
  if (uniqueVendors.length === 1) vendor = uniqueVendors[0];
  else if (uniqueVendors.length > 1) vendor = uniqueVendors.join(' + ');

  let notes = notesList.join(' | ');
  if (!notes && successIndices.length > 1) {
    notes = `共 ${successIndices.length} 張收據自動加總`;
  }

  return {
    amount: totalAmount,
    date: latestDate || new Date().toISOString().slice(0, 10),
    vendor,
    category: topCategory,
    notes,
    successIndices,
    failIndices,
    successCount: successIndices.length,
    failCount: failIndices.length,
    statuses
  };
}
