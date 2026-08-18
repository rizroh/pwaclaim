/** Shared headers so API routes can reject missing Origin + unknown clients. */
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'X-Expense-Client': 'pwaclaim'
};
