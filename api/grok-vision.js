// Vercel Serverless: /api/grok-vision
// API Key only (user key or XAI_API_KEY) — OAuth removed

import { applyCors, rejectCors } from '../lib/cors.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb'
    }
  }
};

export default async function handler(req, res) {
  if (!applyCors(req, res)) return rejectCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const { imageBase64, userApiKey, model: requestedModel } = body;

    const apiKey =
      (userApiKey && String(userApiKey).trim()) ||
      process.env.XAI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: '未設定 xAI API Key。請到設定頁填入，或在 Vercel 設定 XAI_API_KEY。'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: '缺少 imageBase64' });
    }

    // size guard
    const raw = String(imageBase64);
    if (raw.length > 5_500_000) {
      return res.status(400).json({ error: '圖片太大，請壓縮後再試' });
    }

    let imageUrl = raw;
    if (!raw.startsWith('data:')) {
      imageUrl = 'data:image/jpeg;base64,' + raw;
    }

    const allowedModels = [
      'grok-2-vision-latest',
      'grok-2-vision',
      'grok-4.5',
      'grok-4-fast-non-reasoning',
      'grok-4-fast-reasoning',
      'grok-2-latest'
    ];
    const model = allowedModels.includes(requestedModel) ? requestedModel : 'grok-2-vision-latest';

    const prompt = '你是一位香港會計專家。請仔細分析這張收據圖片，並只回傳以下 JSON 格式（不要有其他文字、不要 markdown）：\n\n{\n  "date": "YYYY-MM-DD",\n  "amount": 數字,\n  "vendor": "商戶名稱",\n  "category": "Meals 或 Transport 或 Office 或 Professional Services 或 Marketing 或 Travel 或 Utilities 或 Other",\n  "notes": "簡短備註（可選）",\n  "confidence": 0到100的數字\n}\n\n注意：\n- 日期優先用收據上的日期\n- 金額以 HKD 為準，取最終應付金額\n- 商戶名稱盡量完整\n- 如果資訊不清楚，請作出合理推測';

    const payload = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            { type: 'text', text: prompt }
          ]
        }
      ],
      temperature: 0.1
    };

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.error?.message || data.error || JSON.stringify(data).slice(0, 200);
      return res.status(response.status).json({
        error: msg,
        modelUsed: model
      });
    }

    let content = data.choices?.[0]?.message?.content || '';
    // strip markdown fences if any
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (__) {
          return res.status(502).json({ error: 'Grok 回傳非 JSON', raw: content.slice(0, 300) });
        }
      } else {
        return res.status(502).json({ error: 'Grok 回傳非 JSON', raw: content.slice(0, 300) });
      }
    }

    return res.status(200).json({
      success: true,
      data: parsed,
      modelUsed: model,
      authMethod: userApiKey ? 'user-key' : 'system-key'
    });
  } catch (err) {
    console.error('grok-vision error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
