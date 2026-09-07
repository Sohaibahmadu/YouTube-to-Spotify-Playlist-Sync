import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = req.cookies?.sync_user_id || 'app_user';

  try {
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

    let allPlaylists = [];
    let nextPageToken = '';

    do {
      const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
      const ytRes = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      const ytData = await ytRes.json();

      if (ytData.items) {
        const visiblePlaylists = ytData.items.filter(
          (pl) => pl.status?.privacyStatus !== 'private'
        );
        allPlaylists = allPlaylists.concat(visiblePlaylists);
      }
      nextPageToken = ytData.nextPageToken || '';
    } while (nextPageToken);

    return res.status(200).json({
      message: 'Playlists loaded successfully!',
      totalCount: allPlaylists.length,
      playlists: allPlaylists,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
