/**
 * Shared multi-image receipt analysis runner
 */

import { showToast } from '../ui/toast.js';

/**
 * @param {string[]} images
 * @param {(imageBase64: string, index: number) => Promise<object>} analyzeOne
 * @param {{ onProgress?: Function, label?: string, gapMs?: number }} opts
 */
export async function runAnalyzeMultiple(images, analyzeOne, opts = {}) {
  const { onProgress, label = '分析', gapMs = 800 } = opts;
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
    showToast(`${label} ${i + 1}/${total}…`, 'info');
    try {
      const parsed = await analyzeOne(images[i], i);
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
      failIndices.push(i);
      errorMessages.push(`第${i + 1}張: ${err.message}`);
      emit(i, 'fail', err.message);
    }
    if (i < total - 1) await new Promise(r => setTimeout(r, gapMs));
  }

  if (!successIndices.length) {
    throw new Error(errorMessages.slice(0, 3).join(' | ') || '分析失敗');
  }

  let topCategory = 'Other';
  if (categories.length) {
    const freq = {};
    categories.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    topCategory = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }
  const uniqueVendors = [...new Set(vendors)];
  const vendor = uniqueVendors.length === 1
    ? uniqueVendors[0]
    : uniqueVendors.join(' + ');
  let notes = notesList.join(' | ');
  if (!notes && successIndices.length > 1) {
    notes = `共 ${successIndices.length} 張收據（${label}）`;
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
