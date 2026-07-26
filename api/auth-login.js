// Vercel Serverless Function: /api/auth/login
// Starts Grok / xAI OAuth login flow

export default async function handler(req, res) {
  const CLIENT_ID = process.env.GROK_CLIENT_ID;

  if (!CLIENT_ID) {
    return res.status(500).json({
      error: 'System Error: GROK_CLIENT_ID environment variable is missing. Please add it in Vercel → Settings → Environment Variables.'
    });
  }

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

  return res.redirect(302, authUrl);
}
