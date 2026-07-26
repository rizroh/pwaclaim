
export default async function handler(req, res) {
  // Vercel 會自動幫你把 URL 參數解析到 req.query 中，不用自己處理 queryStringParameters
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send("Missing authorization code from Grok OAuth");
  }

  const CLIENT_ID = process.env.GROK_CLIENT_ID;
  const CLIENT_SECRET = process.env.GROK_CLIENT_SECRET;
  
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const REDIRECT_URI = `${protocol}://${host}/api/auth/callback`;

  try {
    const response = await fetch("https://auth.x.ai/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }).toString()
    });

    const tokenData = await response.json();

    if (tokenData.error) {
      return res.status(400).json(tokenData);
    }

    // 登入成功，將 Token 通過 URL 參數傳回 PWA 前端 index.html
    const redirectUrl = `/index.html?access_token=${tokenData.access_token}&user_name=${encodeURIComponent(tokenData.user?.name || '')}`;

    return res.redirect(302, redirectUrl);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
