import { applyCors, rejectCors } from '../lib/cors.js';

// Vercel Serverless Function: /api/models
// Dynamically list Gemini models available to the API key

export default async function handler(req, res) {
  if (!applyCors(req, res)) return rejectCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let userApiKey = '';
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      userApiKey = (body && body.userApiKey) ? String(body.userApiKey).trim() : '';
    } else if (req.query && req.query.key) {
      userApiKey = String(req.query.key).trim();
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API Key 未設定',
        models: fallbackModels()
      });
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey) + '&pageSize=100';
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('models.list error:', JSON.stringify(data).slice(0, 400));
      return res.status(response.status).json({
        error: data.error?.message || '無法取得模型列表',
        models: fallbackModels()
      });
    }

    const raw = Array.isArray(data.models) ? data.models : [];

    // Prefer models that support generateContent and look like text/vision flash/pro
    const preferredOrder = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    const excludePatterns = [
      /embed/i,
      /tts/i,
      /image/i,      // pure image-gen endpoints
      /veo/i,
      /robotics/i,
      /deep-research/i,
      /live/i,
      /computer-use/i,
      /aqa/i
    ];

    let models = raw
      .map(m => {
        const fullName = m.name || '';
        const id = fullName.replace(/^models\//, '');
        const methods = m.supportedGenerationMethods || m.supported_actions || [];
        const supportsGenerate = methods.includes('generateContent') || methods.length === 0;
        return {
          id,
          displayName: m.displayName || id,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit || m.input_token_limit || null,
          outputTokenLimit: m.outputTokenLimit || m.output_token_limit || null,
          supportsGenerate
        };
      })
      .filter(m => {
        if (!m.id || !m.id.startsWith('gemini-')) return false;
        if (!m.supportsGenerate) return false;
        if (excludePatterns.some(re => re.test(m.id))) return false;
        // skip versioned aliases like gemini-1.5-flash-001 when base exists
        if (/-\d{3}$/.test(m.id)) return false;
        return true;
      });

    // Sort: preferred first, then alphabetical
    models.sort((a, b) => {
      const ia = preferredOrder.indexOf(a.id);
      const ib = preferredOrder.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    // Dedupe by id
    const seen = new Set();
    models = models.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (models.length === 0) {
      models = fallbackModels();
    }

    const defaultModel =
      models.find(m => m.id === 'gemini-3.5-flash-lite')?.id ||
      models.find(m => m.id.includes('flash-lite'))?.id ||
      models.find(m => m.id.includes('flash'))?.id ||
      models[0]?.id ||
      'gemini-3.5-flash-lite';

    return res.status(200).json({
      success: true,
      defaultModel,
      models,
      count: models.length
    });
  } catch (err) {
    console.error('models handler error:', err);
    return res.status(500).json({
      error: err.message || String(err),
      models: fallbackModels()
    });
  }
}

function fallbackModels() {
  return [
    { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash Lite', supportsGenerate: true },
    { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite', supportsGenerate: true },
    { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportsGenerate: true },
    { id: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', supportsGenerate: true },
    { id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash', supportsGenerate: true },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportsGenerate: true },
    { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', supportsGenerate: true }
  ];
}
