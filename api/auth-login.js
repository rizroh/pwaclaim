  const CLIENT_ID = process.env.GROK_CLIENT_ID; 
  
  if (!CLIENT_ID) {
    return res.status(500).json({ 
      error: "System Error: GROK_CLIENT_ID environment variable is missing." 
    });
  }

  // Vercel 會自動從環境變數或 Request Header 取得當前域名
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const REDIRECT_URI = `${protocol}://${host}/api/auth/callback`; 
  
  const STATE = Math.random().toString(36).substring(2, 15);

  const authUrl = `https://auth.x.ai/oauth2/auth?` + new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: STATE
  }).toString();

  // Vercel 內建的導向語法，比 Netlify 簡單安全
  return res.redirect(302, authUrl);
