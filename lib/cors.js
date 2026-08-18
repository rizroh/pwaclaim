/**
 * Restrict CORS to same host only (no wildcard).
 * Returns false if Origin is present but not allowed.
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host || '';

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!origin) {
    // Same-origin browser requests often omit Origin
    return true;
  }

  try {
    const o = new URL(origin);
    const allowed =
      o.host === host ||
      (host.endsWith('.vercel.app') && o.host === host) ||
      (host === 'localhost:5173' && (o.hostname === 'localhost' || o.hostname === '127.0.0.1'));

    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      return true;
    }
  } catch (_) {}

  return false;
}

export function rejectCors(res) {
  return res.status(403).json({ error: 'Forbidden origin' });
}
