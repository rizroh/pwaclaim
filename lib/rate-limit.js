/**
 * Simple in-memory rate limit (per serverless instance).
 * Not global — still reduces burst abuse on one instance.
 */

const buckets = new Map();

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} opts
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function rateLimit(key, opts = {}) {
  const limit = opts.limit ?? 30;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - b.start)) / 1000);
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}

export function clientKey(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}
