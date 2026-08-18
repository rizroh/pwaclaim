export const ALLOWED_AGGREGATOR_HOSTS = [
  'openrouter.ai',
  'api.together.xyz',
  'api.fireworks.ai',
  'opencode.ai'
];

export function normalizeAggregatorBase(raw) {
  return String(raw || '').trim().replace(/\/+$/, '');
}

export function isAllowedAggregatorBase(raw) {
  try {
    const u = new URL(normalizeAggregatorBase(raw));
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== '443') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch (_) {
    return false;
  }
}
