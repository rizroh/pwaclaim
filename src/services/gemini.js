/**
 * Gemini AI Service
 * Calls the existing /api/gemini serverless function
 */

import { showToast } from '../ui/toast.js';

export async function analyzeReceipt(imageBase64, userApiKey = '', model = 'gemini-3.5-flash-lite') {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'analyze-receipt',
      imageBase64,
      userApiKey,
      model
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.details?.error?.message || `HTTP ${res.status}`;
    const modelInfo = data.modelUsed ? ` [${data.modelUsed}]` : '';
    throw new Error(msg + modelInfo);
  }
  return data.data;
}

export async function generateSummary(expenses, userApiKey = '', model = 'gemini-3.5-flash-lite') {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate-summary',
      expenses,
      userApiKey,
      model
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.details?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data.data;
}

/**
 * Analyze multiple images, sum amounts, merge vendors/categories
 * Now surfaces the real error messages instead of a generic failure.
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

  for (let i = 0; i < total; i++) {
    if (onProgress) onProgress(i + 1, total);
    showToast(`正在分析第 ${i + 1}/${total} 張收據...`, 'info');

    try {
      const parsed = await analyzeReceipt(images[i], userKey, model);
      const data = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;

      // Accept even if amount is missing / zero – still count as success if we got any data
      const amt = parseFloat(data.amount);
      if (!isNaN(amt) && amt > 0) {
        totalAmount += amt;
      }

      if (data.vendor) vendors.push(data.vendor);
      if (data.category) categories.push(data.category);
      if (data.notes) notesList.push(data.notes);
      if (data.date && (!latestDate || data.date > latestDate)) latestDate = data.date;

      // Consider success if we got at least vendor or amount or date
      if ((data.vendor && data.vendor !== '未知商戶') || (!isNaN(amt) && amt > 0) || data.date) {
        successIndices.push(i);
      } else {
        failIndices.push(i);
        errorMessages.push(`第${i + 1}張: AI 回傳資料不完整`);
      }
    } catch (err) {
      console.warn(`Image ${i + 1} failed:`, err.message);
      failIndices.push(i);
      errorMessages.push(`第${i + 1}張: ${err.message}`);
    }

    if (i < total - 1) await new Promise(r => setTimeout(r, 800));
  }

  if (successIndices.length === 0) {
    // Show the real underlying errors instead of a generic message
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
    failCount: failIndices.length
  };
}
