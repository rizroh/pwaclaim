/**
 * Grok (xAI) Vision Service
 * Prefers SuperGrok OAuth access_token, then user API key, then system key
 */

import { showToast } from '../ui/toast.js';

export async function analyzeReceiptWithGrok(imageBase64, model = 'grok-2-vision-latest') {
  const userAccessToken = localStorage.getItem('grok_token') || '';
  const userApiKey = localStorage.getItem('user_xai_api_key') || '';

  const res = await fetch('/api/grok-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      userAccessToken,
      userApiKey,
      model
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.details || ('HTTP ' + res.status);
    const modelInfo = data.modelUsed ? (' [' + data.modelUsed + ']') : '';
    throw new Error(msg + modelInfo);
  }
  return data.data;
}

export async function analyzeMultipleWithGrok(images, onProgress) {
  const hasToken = !!localStorage.getItem('grok_token');
  const hasKey = !!localStorage.getItem('user_xai_api_key');
  if (!hasToken && !hasKey) {
    throw new Error('請先按「登入」用 SuperGrok 帳戶登入，或在設定頁填入 xAI API Key');
  }

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

  for (let i = 0; i < total; i++) {
    if (onProgress) onProgress(i + 1, total);
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
      } else {
        failIndices.push(i);
        errorMessages.push('第' + (i + 1) + '張: 資料不完整');
      }
    } catch (err) {
      console.warn('Grok image ' + (i + 1) + ' failed:', err.message);
      failIndices.push(i);
      errorMessages.push('第' + (i + 1) + '張: ' + err.message);
    }

    if (i < total - 1) await new Promise(r => setTimeout(r, 600));
  }

  if (successIndices.length === 0) {
    const detail = errorMessages.length > 0
      ? errorMessages.slice(0, 3).join(' | ')
      : '未知錯誤';
    throw new Error(detail);
  }

  let topCategory = 'Other';
  if (categories.length > 0) {
    const freq = {};
    categories.forEach(c => freq[c] = (freq[c] || 0) + 1);
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
    failCount: failIndices.length
  };
}
