// Vercel: /api/openai-compatible
// OpenRouter / Together / Fireworks / any OpenAI-compatible chat+vision

import { applyCors, rejectCors } from '../lib/cors.js';
import { rateLimit, clientKey } from '../lib/rate-limit.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' }
  }
};

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return rejectCors(res);

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
    body = body || {};

    const {
      action = 'analyze-receipt',
      imageBase64,
      expenses,
      userApiKey,
      model: requestedModel,
      baseUrl: requestedBase
    } = body;

    const apiKey =
      (userApiKey && String(userApiKey).trim()) ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENCODE_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: '未設定 Aggregator API Key。請到設定頁填入 OpenRouter／兼容服務的 Key。'
      });
    }

    let base = (requestedBase && String(requestedBase).trim()) || process.env.LLM_BASE_URL || DEFAULT_BASE;
    base = base.replace(/\/+$/, '');
    if (!/^https:\/\//i.test(base)) {
      return res.status(400).json({ error: 'Base URL 必須係 https://' });
    }

    const model = (requestedModel && String(requestedModel).trim()) || 'google/gemini-2.0-flash-001';

    if (action === 'list-models') {
      const headers = {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      };
      if (base.includes('openrouter.ai')) {
        const origin = req.headers.origin || ('https://' + (req.headers.host || 'localhost'));
        headers['HTTP-Referer'] = origin;
        headers['X-Title'] = 'Expense Claim PWA';
      }

      const resp = await fetch(base + '/models', { method: 'GET', headers });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data.error?.message || data.error || ('HTTP ' + resp.status);
        return res.status(resp.status).json({ error: String(msg) });
      }

      const raw = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      const models = raw.map((m) => {
        const id = m.id || m.name || '';
        const name = m.name || m.id || '';
        const arch = m.architecture || {};
        const modality = String(arch.modality || m.modality || '').toLowerCase();
        const inputs = arch.input_modalities || m.input_modalities || [];
        const desc = String(m.description || '').toLowerCase();
        const idl = id.toLowerCase();
        const isVision =
          modality.includes('image') ||
          modality.includes('vision') ||
          modality === 'text+image->text' ||
          (Array.isArray(inputs) && inputs.some((x) => /image|vision/i.test(String(x)))) ||
          /vision|gpt-4o|gemini|claude-3|llava|pixtral|qwen.*(vl|vision)|llama.*vision|ocr/i.test(idl) ||
          /vision|image/i.test(desc);
        return {
          id,
          name: name !== id ? name : id,
          isVision: !!isVision
        };
      }).filter((m) => m.id);

      // Prefer vision models first; still return others so user can pick
      models.sort((a, b) => Number(b.isVision) - Number(a.isVision) || a.id.localeCompare(b.id));

      return res.status(200).json({
        success: true,
        models,
        visionModels: models.filter((m) => m.isVision),
        provider: base
      });
    }

    if (action === 'analyze-receipt') {
      if (!imageBase64) return res.status(400).json({ error: '缺少 imageBase64' });
      const raw = String(imageBase64);
      if (raw.length > 5_500_000) {
        return res.status(400).json({ error: '圖片太大，請壓縮後再試' });
      }
      const imageUrl = raw.startsWith('data:') ? raw : 'data:image/jpeg;base64,' + raw;

      const prompt = `你是一位香港會計專家。請仔細分析這張收據圖片，並只回傳以下 JSON 格式（不要有其他文字、不要 markdown）：

{
  "date": "YYYY-MM-DD",
  "amount": 數字,
  "vendor": "商戶名稱",
  "category": "Meals 或 Transport 或 Office 或 Professional Services 或 Marketing 或 Travel 或 Utilities 或 Other",
  "notes": "簡短備註（可選）",
  "confidence": 0到100的數字
}

注意：日期優先用收據上的日期；金額以 HKD 最終應付為準；商戶名稱盡量完整。`;

      const payload = {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1
      };

      const data = await callChat(base, apiKey, payload, req);
      const content = extractContent(data);
      const parsed = parseJsonLoose(content);
      if (!parsed) {
        return res.status(502).json({ error: '模型回傳非 JSON', raw: String(content).slice(0, 300), modelUsed: model });
      }
      return res.status(200).json({ success: true, data: parsed, modelUsed: model, provider: base });
    }

    if (action === 'generate-summary') {
      const list = Array.isArray(expenses) ? expenses : [];
      const lines = list.slice(0, 80).map((e, i) =>
        `${i + 1}. ${e.date || ''} | ${e.vendor || ''} | ${e.category || ''} | HK$${Number(e.amount || 0).toFixed(2)} | ${(e.notes || '').slice(0, 40)}`
      ).join('\n');

      const prompt = `你是香港財務助理。根據以下開支記錄，用繁體中文寫一份簡潔月結報告（條列重點、總額、類別分佈、異常／注意事項）。不要輸出 JSON。\n\n${lines || '（無記錄）'}`;

      const payload = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      };
      const data = await callChat(base, apiKey, payload, req);
      const content = extractContent(data);
      return res.status(200).json({ success: true, data: content, modelUsed: model, provider: base });
    }

    return res.status(400).json({ error: '未知 action' });
  } catch (err) {
    console.error('openai-compatible error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

async function callChat(base, apiKey, payload, req) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey
  };
  // OpenRouter optional rankings headers
  if (base.includes('openrouter.ai')) {
    const origin = req.headers.origin || ('https://' + (req.headers.host || 'localhost'));
    headers['HTTP-Referer'] = origin;
    headers['X-Title'] = 'Expense Claim PWA';
  }

  const response = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.error?.message || data.error || JSON.stringify(data).slice(0, 200);
    const e = new Error(msg);
    e.status = response.status;
    throw e;
  }
  return data;
}

function extractContent(data) {
  const c = data.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map(p => (typeof p === 'string' ? p : p.text || '')).join('');
  }
  return '';
}

function parseJsonLoose(content) {
  let s = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch (_) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) {}
  }
  return null;
}
