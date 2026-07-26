/**
 * Storage Service
 * Currently uses localStorage for expenses (images are compressed base64).
 * Future: move large images to IndexedDB when quota becomes an issue.
 */

const EXPENSES_KEY = 'expenses_v2';

export async function initStorage() {
  console.log('[Storage] Ready');
}

export async function loadExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load expenses', e);
    return [];
  }
}

export async function saveExpenses(expenses) {
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      throw new Error('儲存空間不足，請減少相片數量後再試');
    }
    throw e;
  }
}
