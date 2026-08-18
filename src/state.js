const listeners = new Set();

export const state = {
  expenses: [],
  currentImages: [],
  editingId: null,
  isLoading: false,
  loadingMsg: '',
  filterMonth: '',
  filterCategory: '',
  filterQ: '',
  online: typeof navigator !== 'undefined' ? navigator.onLine : true
};

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
