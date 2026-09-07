import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/spotify`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json(tokenData);
    }

    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();

    // Agar pehle se koi sync_user_id cookie mojood ho to wahi use karein, warna profile.id
    const existingUserId = req.cookies?.sync_user_id;
    const finalUserId = existingUserId || profile.id || 'default_user';

    const { error: dbError } = await supabase
      .from('user_tokens')
      .upsert({
        user_id: finalUserId,
        provider: 'spotify',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (dbError) {
      console.error('Supabase save error:', dbError);
    }

    // Cookie set karein taake refresh ya dusra auth hone par connection yaad rahe
    res.setHeader('Set-Cookie', [
      `sync_user_id=${finalUserId}; Path=/; Max-Age=2592000; SameSite=Lax`,
      `spotify_connected=true; Path=/; Max-Age=2592000; SameSite=Lax`
    ]);

    res.redirect('/');
  } catch (err) {
    res.status(500).send(err.message);
  }
}
