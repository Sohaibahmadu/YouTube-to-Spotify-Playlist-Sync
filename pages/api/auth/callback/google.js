import { supabase } from '../../../lib/supabaseClient';


export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json(tokenData);
    }

    // YouTube Channel ID nikalna uniquely identify karne ke liye
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const channelData = await channelResponse.json();
    const userId = channelData.items?.[0]?.id || 'google_user';

    const { error: dbError } = await supabase
      .from('user_tokens')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (dbError) {
      console.error('Supabase save error:', dbError);
    }

    res.redirect('/?google_connected=true');
  } catch (err) {
    res.status(500).send(err.message);
  }
}

