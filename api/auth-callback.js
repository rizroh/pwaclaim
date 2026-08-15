// Vercel Serverless Function: /api/auth/callback
// Handles Grok / xAI OAuth callback and returns token to the PWA

export default async function handler(req, res) {
  const { code, error, error_description } = req.query || {};

  if (error) {
    return res.status(400).send(`OAuth Error: ${error} – ${error_description || ''}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code from Grok OAuth');
  }

  const CLIENT_ID = process.env.GROK_CLIENT_ID;
  const CLIENT_SECRET = process.env.GROK_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('Missing GROK_CLIENT_ID or GROK_CLIENT_SECRET in environment variables');
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const REDIRECT_URI = `${protocol}://${host}/api/auth/callback`;

  try {
    const response = await fetch('https://auth.x.ai/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }).toString()
    });

    const tokenData = await response.json();

    if (tokenData.error) {
      console.error('Token exchange failed:', tokenData);
      return res.status(400).json(tokenData);
    }

    // Redirect back to the PWA with the token
    // Use / instead of /index.html for Vite SPA
    const name = tokenData.user?.name || tokenData.name || tokenData.email || '';
    const redirectUrl = `/?access_token=${encodeURIComponent(tokenData.access_token || '')}&user_name=${encodeURIComponent(name)}`;

    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).json({ error: err.message });
  }
}
