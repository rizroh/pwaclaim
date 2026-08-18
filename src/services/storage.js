/**
 * Storage Service – IndexedDB primary, migrate from localStorage
 */

import { get, set, del } from 'idb-keyval';

const EXPENSES_KEY = 'expenses_v2';
const LS_KEY = 'expenses_v2';

export const IMPORT_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxExpenses: 2000,
  maxImages: 10,
  maxImageChars: 1_800_000,
  maxText: 400
};

export async function initStorage() {
  try {
    const existing = await get(EXPENSES_KEY);
    if (existing == null) {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          await set(EXPENSES_KEY, parsed);
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

export function sanitizeExpenseId(id, fallbackIndex) {
  const s = String(id || '').slice(0, 64);
  if (/^[a-zA-Z0-9_-]+$/.test(s)) return s;
  return 'exp_' + Date.now() + '_' + fallbackIndex;
}

function clipText(v, max) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
}

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  const out = [];
  for (const img of images.slice(0, IMPORT_LIMITS.maxImages)) {
    if (typeof img !== 'string') continue;
    if (!img.startsWith('data:image/')) continue;
    if (img.length > IMPORT_LIMITS.maxImageChars) continue;
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(img.slice(0, 40))) continue;
    out.push(img);
  }
  return out;
}

const ALLOWED_CATS = new Set([
  'Meals', 'Transport', 'Office', 'Professional Services',
  'Marketing', 'Travel', 'Utilities', 'Other'
]);

export function sanitizeExpense(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const date = String(raw.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return null;
  const vendor = clipText(raw.vendor, IMPORT_LIMITS.maxText);
  if (!vendor) return null;
  const category = ALLOWED_CATS.has(raw.category) ? raw.category : 'Other';
  return {
    id: sanitizeExpenseId(raw.id, index),
    date,
    amount: Math.round(amount * 100) / 100,
    vendor,
    category,
    notes: clipText(raw.notes, IMPORT_LIMITS.maxText),
    images: sanitizeImages(raw.images),
    createdAt: clipText(raw.createdAt, 40) || new Date().toISOString(),
    updatedAt: clipText(raw.updatedAt, 40) || new Date().toISOString()
  };
}

export async function importAllData(payload, opts = {}) {
  const byteLength = opts.byteLength ?? (typeof payload === 'string' ? new Blob([payload]).size : 0);
  if (byteLength > IMPORT_LIMITS.maxBytes) {
    throw new Error('檔案太大（上限 15MB）');
  }

  let data = payload;
  if (typeof payload === 'string') {
    if (payload.length > IMPORT_LIMITS.maxBytes) throw new Error('檔案太大（上限 15MB）');
    data = JSON.parse(payload);
  }
  const list = Array.isArray(data) ? data : (data && data.expenses);
  if (!Array.isArray(list)) throw new Error('匯入格式不正確');
  if (list.length > IMPORT_LIMITS.maxExpenses) {
    throw new Error('記錄太多（上限 ' + IMPORT_LIMITS.maxExpenses + ' 筆）');
  }

  const seen = new Set();
  const cleaned = [];
  list.forEach((row, i) => {
    const e = sanitizeExpense(row, i);
    if (!e) return;
    if (seen.has(e.id)) e.id = sanitizeExpenseId('', i);
    seen.add(e.id);
    cleaned.push(e);
  });
  if (cleaned.length === 0) throw new Error('檔案內冇有效開支記錄');
  await saveExpenses(cleaned);
  return cleaned.length;
}

export async function clearAllData() {
  await del(EXPENSES_KEY);
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
}
