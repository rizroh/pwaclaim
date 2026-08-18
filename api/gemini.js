import { applyCors, rejectCors, requireClient } from '../lib/cors.js';
import { rateLimit, clientKey } from '../lib/rate-limit.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

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
    body = body || {};

    const { action, imageBase64, expenses, userApiKey, model: requestedModel } = body;
    const apiKey = (userApiKey && String(userApiKey).trim()) || process.env.GEMINI_API_KEY;
    const requested = (requestedModel && String(requestedModel).trim()) || '';
    const model = (requested.startsWith('gemini-') || requested.startsWith('models/gemini-'))
      ? requested.replace(/^models\//, '').replace(/[^a-zA-Z0-9._-]/g, '')
      : 'gemini-3.5-flash-lite';

    if (!apiKey) {
      return res.status(401).json({
        error: 'Gemini API Key 未設定。請到設定頁填入，或在 Vercel 設定 GEMINI_API_KEY'
      });
    }

    if (action === 'analyze-receipt') {
      if (!imageBase64) return res.status(400).json({ error: '缺少 imageBase64' });
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

注意：日期優先用收據上的日期；金額以 HKD 為準，取最終應付金額；商戶名稱盡量完整。`;

      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: pureBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600, responseMimeType: 'application/json' }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || data.message || 'Gemini API 回傳錯誤',
          modelUsed: model
        });
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed;
      try {
        parsed = JSON.parse(text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim());
      } catch {
        parsed = { raw: text, error: 'JSON parse failed', amount: 0, vendor: '', date: '' };
      }
      return res.status(200).json({ success: true, data: parsed, modelUsed: model });
    }

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

要求：總金額、主要類別分佈、異常或值得注意的地方、專業但易讀。

開支資料：
${JSON.stringify(slim, null, 2)}`;

      const payload = {
        contents: [{ parts: [{ text: summaryPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      return res.status(200).json({ success: true, data: text, modelUsed: model });
    }

    return res.status(400).json({ error: '未知的 action，請傳 analyze-receipt 或 generate-summary' });
  } catch (error) {
    console.error('Gemini Function Unhandled Error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤: ' + (error.message || String(error)) });
  }
}
