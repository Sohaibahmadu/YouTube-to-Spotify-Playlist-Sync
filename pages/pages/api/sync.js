import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = req.cookies?.sync_user_id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Supabase se dono tokens nikalna
    const { data: tokens, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length < 2) {
      return res.status(400).json({ error: 'Both YouTube and Spotify must be connected.' });
    }

    const googleToken = tokens.find((t) => t.provider === 'google')?.access_token;
    const spotifyToken = tokens.find((t) => t.provider === 'spotify')?.access_token;

    if (!googleToken || !spotifyToken) {
      return res.status(400).json({ error: 'Missing access tokens.' });
    }

    // YouTube ki playlists fetch karein
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=25',
      {
        headers: { Authorization: `Bearer ${googleToken}` },
      }
    );
    const ytData = await ytRes.json();

    return res.status(200).json({
      message: 'Tokens verified successfully!',
      youtubePlaylistsCount: ytData.items ? ytData.items.length : 0,
      playlists: ytData.items || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
