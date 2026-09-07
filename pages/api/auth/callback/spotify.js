import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  const { code } = req.query;
  const userId = req.cookies?.sync_user_id || 'app_user';

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || 'Failed to exchange Spotify token');
    }

    // Google wale same ID ('app_user') ke sath Spotify token link karein
    await supabase.from('user_tokens').upsert(
      {
        user_id: userId,
        provider: 'spotify',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    );

    res.setHeader('Set-Cookie', [
      `spotify_connected=true; Path=/; Max-Age=86400`,
      `sync_user_id=${userId}; Path=/; Max-Age=2592000`,
    ]);

    res.redirect('/?spotify_connected=true');
  } catch (err) {
    res.status(500).send(err.message);
  }
}
