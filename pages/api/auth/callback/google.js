import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  const { code, error } = req.query;
  const userId = 'app_user';

  if (error) {
    return res.status(400).send(`Google Auth Error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://youtube-to-spotify-sync.vercel.app'}/api/auth/callback/google`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'Google token exchange failed', details: tokenData });
    }

    const { error: dbError } = await supabase.from('user_tokens').upsert(
      {
        user_id: userId,
        provider: 'google',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    );

    if (dbError) {
      return res.status(500).send(`Database Insert Error: ${dbError.message}`);
    }

    res.setHeader('Set-Cookie', [
      `google_connected=true; Path=/; Max-Age=86400`,
      `sync_user_id=${userId}; Path=/; Max-Age=2592000`,
    ]);

    res.redirect('/?google_connected=true');
  } catch (err) {
    res.status(500).send(err.message);
  }
}
