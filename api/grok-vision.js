// Vercel Serverless Function: /api/grok-vision
// Supports:
// 1. User's SuperGrok OAuth access_token (preferred)
// 2. Fallback to system XAI_API_KEY

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

    const { imageBase64, userAccessToken, userApiKey, model: requestedModel } = body;

    // Priority: 1) user's OAuth token  2) user's API key  3) system env key
    const bearerToken =
      (userAccessToken && String(userAccessToken).trim()) ||
      (userApiKey && String(userApiKey).trim()) ||
      process.env.XAI_API_KEY;

    if (!bearerToken) {
      return res.status(401).json({
        error: '未登入 Grok，亦未設定 API Key。請先按「登入」用 SuperGrok 帳戶登入，或在設定頁填入 xAI API Key。'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: '缺少 imageBase64' });
    }

    let imageUrl = imageBase64;
    if (!imageBase64.startsWith('data:')) {
      imageUrl = 'data:image/jpeg;base64,' + imageBase64;
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
        'Authorization': 'Bearer ' + bearerToken
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Grok Vision API Error:', JSON.stringify(data).slice(0, 600));
      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: 'Grok token 無效或已過期，請重新登入 SuperGrok',
          modelUsed: model,
          status: response.status,
          details: data.error?.message || data.message
        });
      }
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
      modelUsed: model,
      authMethod: userAccessToken ? 'oauth' : (userApiKey ? 'user-key' : 'system-key')
    });

  } catch (error) {
    console.error('Grok Vision Function Error:', error);
    return res.status(500).json({
      error: '伺服器內部錯誤: ' + (error.message || String(error))
    });
  }
}
