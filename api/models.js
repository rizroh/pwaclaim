import { applyCors, rejectCors, requireClient } from '../lib/cors.js';
import { rateLimit, clientKey } from '../lib/rate-limit.js';

function fallbackModels() {
  return [
    { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash Lite', supportsGenerate: true },
    { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite', supportsGenerate: true },
    { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportsGenerate: true },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportsGenerate: true },
    { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', supportsGenerate: true }
  ];
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return rejectCors(res);
  if (req.method !== 'OPTIONS' && !requireClient(req, res)) return;

  const rl = rateLimit('api:' + clientKey(req), { limit: 40, windowMs: 60_000 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec || 60));
    return res.status(429).json({ error: '請求過於頻密，請稍後再試', retryAfterSec: rl.retryAfterSec });
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const userApiKey = (body && body.userApiKey) ? String(body.userApiKey).trim() : '';
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: 'Gemini API Key 未設定', models: fallbackModels() });
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey) + '&pageSize=100';
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || '無法取得模型列表',
        models: fallbackModels()
      });
    }

    const preferredOrder = [
      'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash',
      'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'
    ];
    const excludePatterns = [/embed/i, /tts/i, /image/i, /veo/i, /robotics/i, /deep-research/i, /live/i, /computer-use/i, /aqa/i];

    let models = (data.models || []).map((m) => {
      const id = (m.name || '').replace(/^models\//, '');
      const methods = m.supportedGenerationMethods || m.supported_actions || [];
      const supportsGenerate = methods.includes('generateContent') || methods.length === 0;
      return { id, displayName: m.displayName || id, supportsGenerate };
    }).filter((m) => {
      if (!m.id || !m.id.startsWith('gemini-')) return false;
      if (!m.supportsGenerate) return false;
      if (excludePatterns.some((re) => re.test(m.id))) return false;
      if (/-\d{3}$/.test(m.id)) return false;
      return true;
    });

    models.sort((a, b) => {
      const ia = preferredOrder.indexOf(a.id);
      const ib = preferredOrder.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.id.localeCompare(b.id);
    });
    const seen = new Set();
    models = models.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    if (!models.length) models = fallbackModels();

    const defaultModel =
      models.find((m) => m.id === 'gemini-3.5-flash-lite')?.id ||
      models.find((m) => m.id.includes('flash-lite'))?.id ||
      models[0]?.id ||
      'gemini-3.5-flash-lite';

    return res.status(200).json({ success: true, defaultModel, models, count: models.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err), models: fallbackModels() });
  }
}
