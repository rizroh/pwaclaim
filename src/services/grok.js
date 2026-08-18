/**
 * Grok (xAI) Vision Service — API key only, with 429 retry
 */

import { showToast } from '../ui/toast.js';

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

export async function analyzeMultipleWithGrok(images, onProgress) {
  const model = localStorage.getItem('grok_vision_model') || 'grok-2-vision-latest';
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
    showToast('Grok 分析中 ' + (i + 1) + '/' + total + '...', 'info');

    try {
      const parsed = await analyzeReceiptWithGrok(images[i], model);
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
        errorMessages.push('第' + (i + 1) + '張: 資料不完整');
        emit(i, 'fail', '資料不完整');
      }
    } catch (err) {
      console.warn('Grok image ' + (i + 1) + ' failed:', err.message);
      failIndices.push(i);
      errorMessages.push('第' + (i + 1) + '張: ' + err.message);
      emit(i, 'fail', err.message);
    }

    if (i < total - 1) await new Promise(r => setTimeout(r, 800));
  }

  if (successIndices.length === 0) {
    throw new Error(errorMessages.slice(0, 3).join(' | ') || '未知錯誤');
  }

  let topCategory = 'Other';
  if (categories.length) {
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
    notes = '共 ' + successIndices.length + ' 張收據（Grok 分析）';
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
