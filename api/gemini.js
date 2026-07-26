// Vercel Serverless Function: /api/gemini
// 根據你 API Key 實際可用的 model 更新（2026-07）

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, imageBase64, expenses, userApiKey, model: requestedModel } = req.body || {};

    // 優先用用戶自己提供的 Key，其次用 Vercel Environment Variable
    const apiKey = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY;

    // 根據你 rate-limit 實際有額度的 model（2026-07-27）
    const allowedModels = [
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest'
    ];
    
    let model = allowedModels.includes(requestedModel) ? requestedModel : 'gemini-3.6-flash';

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API Key 未設定。請在設定頁填入 Key，或到 Vercel Dashboard → Environment Variables 加入 GEMINI_API_KEY'
      });
    }

    // ========== 1. 分析收據 (Vision) ==========
    if (action === 'analyze-receipt') {
      if (!imageBase64) {
        return res.status(400).json({ error: '缺少 imageBase64' });
      }

      // 關鍵：Gemini 只接受純 base64，必須去掉 data:image/...;base64, 前綴
      let pureBase64 = imageBase64;
      let mimeType = 'image/jpeg';

      if (imageBase64.startsWith('data:')) {
        const matches = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          pureBase64 = matches[2];
        } else {
          pureBase64 = imageBase64.split(',')[1] || imageBase64;
        }
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
          responseMimeType: "application/json"
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Gemini API Error:', data);
        return res.status(response.status).json({
          error: data.error?.message || 'Gemini API 回傳錯誤',
          details: data,
          modelUsed: model
        });
      }

      // 提取回傳內容
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      let parsed;
      try {
        const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = { raw: text, error: 'JSON parse failed' };
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

      const summaryPrompt = `你是香港公司的財務助理。請根據以下開支資料，用「繁體中文 + 英文」生成一份簡潔專業的月結報告（150-250字）。

要求：
- 總金額
- 主要類別分佈
- 任何異常或值得注意的地方
- 用專業但易讀的語氣

開支資料：
${JSON.stringify(expenses, null, 2)}`;

      const payload = {
        contents: [
          {
            parts: [{ text: summaryPrompt }]
          }
        ],
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

      const data = await response.json();

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

    return res.status(400).json({ error: '未知的 action' });

  } catch (error) {
    console.error('Gemini Function Error:', error);
    return res.status(500).json({
      error: '伺服器內部錯誤: ' + error.message
    });
  }
