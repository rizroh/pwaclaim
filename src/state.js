/**
 * Simple reactive state (no framework needed)
 */

const listeners = new Set();

export const state = {
  expenses: [],
  currentImages: [],
  editingId: null,
  isLoading: false,
  loadingMsg: '',
};

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
