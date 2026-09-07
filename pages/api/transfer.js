import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { playlistIds } = req.body;
  if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
    return res.status(400).json({ error: 'No playlists selected for transfer.' });
  }

  const userId = req.cookies?.sync_user_id || 'default_user';

  try {
    const { data: tokens, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length < 2) {
      return res.status(400).json({ error: 'Both accounts must be connected.' });
    }

    const googleToken = tokens.find((t) => t.provider === 'google')?.access_token;
    const spotifyToken = tokens.find((t) => t.provider === 'spotify')?.access_token;

    const transferResults = [];

    for (const playlistId of playlistIds) {
      // 1. YouTube Playlist Details
      const plDetailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      const plDetailData = await plDetailRes.json();
      const playlistName = plDetailData.items?.[0]?.snippet?.title || 'Synced Playlist';

      // 2. Fetch tracks
      let songTitles = [];
      let pageToken = '';
      do {
        const itemsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`,
          { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        const itemsData = await itemsRes.json();
        if (itemsData.items) {
          itemsData.items.forEach((item) => {
            const title = item.snippet?.title;
            if (title && title !== 'Private video' && title !== 'Deleted video') {
              songTitles.push(title);
            }
          });
        }
        pageToken = itemsData.nextPageToken || '';
      } while (pageToken);

      // 3. Match Tracks on Spotify
      const spotifyTrackUris = [];
      for (const rawTitle of songTitles) {
        const cleaned = rawTitle
          .replace(/\[.*?\]|\(.*?\)/g, '')
          .replace(/official\s+video|official\s+audio|lyrics|hd|4k/gi, '')
          .trim();

        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleaned)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${spotifyToken}` } }
        );
        const searchData = await searchRes.json();
        const foundTrack = searchData.tracks?.items?.[0];
        if (foundTrack?.uri) {
          spotifyTrackUris.push(foundTrack.uri);
        }
      }

      // 4. Create Playlist using direct /v1/me/playlists endpoint
      const createPlRes = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          description: 'Synced from YouTube',
          public: false,
        }),
      });
      const newPlaylist = await createPlRes.json();

      if (!createPlRes.ok) {
        throw new Error(`Spotify error: ${newPlaylist.error?.message || 'Forbidden'}`);
      }

      // 5. Add Tracks
      if (newPlaylist.id && spotifyTrackUris.length > 0) {
        for (let i = 0; i < spotifyTrackUris.length; i += 100) {
          const batch = spotifyTrackUris.slice(i, i + 100);
          await fetch(`https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: batch }),
          });
        }
      }

      transferResults.push({
        playlistName,
        totalSongs: songTitles.length,
        syncedToSpotify: spotifyTrackUris.length,
        spotifyPlaylistUrl: newPlaylist.external_urls?.spotify,
      });
    }

    return res.status(200).json({
      success: true,
      results: transferResults,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
