// Vercel Serverless Function: /api/grok-vision
// Uses xAI Grok for receipt vision analysis

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body || {};

    const { imageBase64, userApiKey, model: requestedModel } = body;

    const apiKey = (userApiKey && String(userApiKey).trim()) || process.env.XAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'xAI API Key 未設定。請到 Vercel Environment Variables 加入 XAI_API_KEY，或在設定頁填入自己的 Key'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: '缺少 imageBase64' });
    }

    // Keep data URL format for xAI (they accept data:image/...;base64,...)
    let imageUrl = imageBase64;
    if (!imageBase64.startsWith('data:')) {
      imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    // Preferred vision-capable models (2026)
    const allowedModels = [
      'grok-2-vision-latest',
      'grok-2-vision',
      'grok-4.5',
      'grok-4-fast-non-reasoning',
      'grok-4-fast-reasoning',
      'grok-2-latest'
    ];
    const model = allowedModels.includes(requestedModel) ? requestedModel : 'grok-2-vision-latest';

    const prompt = `你是一位香港會計專家。請仔細分析這張收據圖片，並只回傳以下 JSON 格式（不要有其他文字、不要 markdown）：

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

    // xAI Chat Completions style (OpenAI-compatible)
    const payload = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 600
    };

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Grok Vision API Error:', JSON.stringify(data).slice(0, 600));
      return res.status(response.status).json({
        error: data.error?.message || data.message || 'Grok Vision API 回傳錯誤',
        modelUsed: model,
        status: response.status
      });
    }

    const text = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = { raw: text, error: 'JSON parse failed', amount: 0, vendor: '', date: '' };
    }

    return res.status(200).json({
      success: true,
      data: parsed,
      modelUsed: model
    });

  } catch (error) {
    console.error('Grok Vision Function Error:', error);
    return res.status(500).json({
      error: '伺服器內部錯誤: ' + (error.message || String(error))
    });
  }
}
