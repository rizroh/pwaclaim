const CLIENT_HEADER = 'x-expense-client';
const CLIENT_VALUE = 'pwaclaim';

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host || '';

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Expense-Client');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!origin) return false;

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

export function requireClient(req, res) {
  const v = String(req.headers[CLIENT_HEADER] || '');
  if (v !== CLIENT_VALUE) {
    res.status(403).json({ error: 'Forbidden client' });
    return false;
  }
  return true;
}

export function rejectCors(res) {
  return res.status(403).json({ error: 'Forbidden origin' });
}
