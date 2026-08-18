/**
 * Toast — textContent only, styles from styles.css / Tailwind
 */

export function showToast(message, type = 'success', duration = 2800) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-primary-800',
    warning: 'bg-amber-500'
  };

  const toast = document.createElement('div');
  toast.className = `
    pointer-events-auto px-4 py-2.5 rounded-2xl text-white text-sm font-medium
    shadow-lg shadow-black/10 flex items-center gap-2
    animate-slideUp ${colors[type] || colors.info}
  `;
  const span = document.createElement('span');
  span.textContent = String(message ?? '');
  toast.appendChild(span);
  root.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
