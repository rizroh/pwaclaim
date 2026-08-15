/**
 * Storage Service – IndexedDB primary, migrate from localStorage
 */

import { get, set, del } from 'idb-keyval';

const EXPENSES_KEY = 'expenses_v2';
const LS_KEY = 'expenses_v2';

export async function initStorage() {
  // one-time migrate localStorage → IndexedDB
  try {
    const existing = await get(EXPENSES_KEY);
    if (existing == null) {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          await set(EXPENSES_KEY, parsed);
          console.log('[Storage] Migrated', parsed.length, 'expenses to IndexedDB');
        }
      }
    }
  } catch (e) {
    console.warn('[Storage] migrate skip', e);
  }
}

export async function loadExpenses() {
  try {
    const data = await get(EXPENSES_KEY);
    if (Array.isArray(data)) return data;
    // fallback localStorage
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
    return [];
  } catch (e) {
    console.error('Failed to load expenses', e);
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function saveExpenses(expenses) {
  try {
    await set(EXPENSES_KEY, expenses);
    // keep a small mirror without huge images for emergency? skip — IDB is enough
  } catch (e) {
    console.error('IDB save failed', e);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(expenses));
    } catch (e2) {
      if (e2.name === 'QuotaExceededError') {
        throw new Error('儲存空間不足，請減少相片數量或匯出後清除舊資料');
      }
      throw e2;
    }
  }
}

export async function exportAllData() {
  const expenses = await loadExpenses();
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    expenses
  };
}

export async function importAllData(payload) {
  let data = payload;
  if (typeof payload === 'string') data = JSON.parse(payload);
  const list = Array.isArray(data) ? data : (data.expenses || []);
  if (!Array.isArray(list)) throw new Error('匯入格式不正確');
  await saveExpenses(list);
  return list.length;
}

export async function clearAllData() {
  await del(EXPENSES_KEY);
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
}
