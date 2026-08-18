import { applyCors, rejectCors, requireClient } from '../lib/cors.js';
import { rateLimit, clientKey } from '../lib/rate-limit.js';

// Vercel Serverless Function: /api/gemini
// Hardened version – always returns JSON, better error messages

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb'   // allow larger base64 images
    }
  }
};

export default async function handler(req, res) {
  if (!applyCors(req, res)) return rejectCors(res);
  if (req.method !== 'OPTIONS' && !requireClient(req, res)) return;

  const rl = rateLimit('api:' + clientKey(req), { limit: 40, windowMs: 60_000 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec || 60));
    return res.status(429).json({ error: '請求過於頻密，請稍後再試', retryAfterSec: rl.retryAfterSec });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Safety: body might be string in some edge cases
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const { action, imageBase64, expenses, userApiKey, model: requestedModel } = body;

    const apiKey = (userApiKey && String(userApiKey).trim()) || process.env.GEMINI_API_KEY;

    // Models that appeared in your rate-limit dashboard (2026-07)
    const requested = (requestedModel && String(requestedModel).trim()) || '';
    let model = (requested.startsWith('gemini-') || requested.startsWith('models/gemini-'))
      ? requested.replace(/^models\//, '')
      : 'gemini-3.5-flash-lite';

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API Key 未設定。請到 Vercel → Settings → Environment Variables 加入 GEMINI_API_KEY，或在 App 設定頁填入自己的 Key'
      });
    }

    // ========== 1. 分析收據 (Vision) ==========
    if (action === 'analyze-receipt') {
      if (!imageBase64) {
        return res.status(400).json({ error: '缺少 imageBase64' });
      }

      // Strip data URL prefix – Gemini only accepts pure base64
      let pureBase64 = imageBase64;
      let mimeType = 'image/jpeg';

      if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
        const matches = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          pureBase64 = matches[2];
        } else {
          pureBase64 = imageBase64.split(',')[1] || imageBase64;
        }
      }

      // Rough size check (base64 is ~1.33x original)
      if (pureBase64.length > 6_000_000) {
        return res.status(400).json({ error: '圖片太大，請壓縮後再試（建議單張 < 4MB）' });
      }

      const prompt = `你是一位香港會計專家。請仔細分析這張收據圖片，並只回傳以下 JSON 格式（不要有其他文字）：

{
  "date": "YYYY-MM-DD",
  "amount": 數字,
  "vendor": "商戶名稱",
  "category": "Meals 或 Transport 或 Office 或 Professional Services 或 Marketing 或 Travel 或 Utilities 或 Other",
  "notes": "簡短備註（可選）",
  "confidence": 0到100的數字
}

注意：
- 日期優先用收據上的日期
- 金額以 HKD 為準，取最終應付金額
- 商戶名稱盡量完整
- 如果資訊不清楚，請作出合理推測`;

      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: pureBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 600,
          responseMimeType: 'application/json'
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Gemini API Error:', JSON.stringify(data).slice(0, 500));
        return res.status(response.status).json({
          error: data.error?.message || data.message || 'Gemini API 回傳錯誤',
          modelUsed: model,
          status: response.status
        });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let parsed;
      try {
        const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        // If JSON parse fails, still return the raw text so frontend can see something
        parsed = { raw: text, error: 'JSON parse failed', amount: 0, vendor: '', date: '' };
      }

      return res.status(200).json({
        success: true,
        data: parsed,
        modelUsed: model
      });
    }

    // ========== 2. 生成月結報告 ==========
    if (action === 'generate-summary') {
      if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
        return res.status(400).json({ error: '沒有開支資料' });
      }

      const slim = expenses.slice(0, 80).map((e) => ({
        date: e?.date || '',
        vendor: String(e?.vendor || '').slice(0, 80),
        category: e?.category || '',
        amount: Number(e?.amount) || 0,
        notes: String(e?.notes || '').slice(0, 80)
      }));

      const summaryPrompt = `你是香港公司的財務助理。請根據以下開支資料，用「繁體中文 + 英文」生成一份簡潔專業的月結報告（150-250字）。

要求：
- 總金額
- 主要類別分佈
- 任何異常或值得注意的地方
- 用專業但易讀的語氣

開支資料：
${JSON.stringify(slim, null, 2)}`;

      const payload = {
        contents: [{ parts: [{ text: summaryPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || 'Gemini API 錯誤',
          modelUsed: model
        });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '無法生成報告';

      return res.status(200).json({
        success: true,
        data: text,
        modelUsed: model
      });
    }

    return res.status(400).json({ error: '未知的 action，請傳 analyze-receipt 或 generate-summary' });

  } catch (error) {
    console.error('Gemini Function Unhandled Error:', error);
    // Always return JSON so frontend can read the message
    return res.status(500).json({
      error: '伺服器內部錯誤: ' + (error.message || String(error))
    });
  }
}
