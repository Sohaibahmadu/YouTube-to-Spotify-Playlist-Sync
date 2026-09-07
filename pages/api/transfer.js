import { supabase } from '@/lib/supabaseClient';

function cleanTrackTitle(title) {
  if (!title) return '';
  return title
    // Brackets aur parentheses ka text hatayein
    .replace(/\(.*?\)|\[.*?\]/g, '')
    // Tags hatayein
    .replace(/official\s+video|official\s+audio|music\s+video|lyric\s+video|lyrics|hd|4k|audio|remix|full\s+song|video|song/gi, '')
    // Feat / ft. hatayein
    .replace(/feat\..*|ft\..*/gi, '')
    // Extra punctuation hatayein
    .replace(/[|&/:_~#@!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { playlistIds } = req.body;
  if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
    return res.status(400).json({ error: 'No playlists selected.' });
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
      // 1. YouTube playlist title
      const plDetailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      const plDetailData = await plDetailRes.json();
      const playlistName = plDetailData.items?.[0]?.snippet?.title || 'Synced Playlist';

      // 2. Fetch YouTube Videos
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

      // 3. Robust Spotify Search (Smart Match)
      const spotifyTrackUris = [];
      for (const rawTitle of songTitles) {
        const cleaned = cleanTrackTitle(rawTitle);
        const queriesToTry = [];

        if (cleaned) queriesToTry.push(cleaned);
        // Pehle 3 ya 4 alfaaz try karein
        if (cleaned && cleaned.split(' ').length > 3) {
          queriesToTry.push(cleaned.split(' ').slice(0, 3).join(' '));
        }
        // Agar raw title mein dash (-) ho (e.g. Artist - Song)
        if (rawTitle.includes('-')) {
          const parts = rawTitle.split('-');
          if (parts[1]) queriesToTry.push(cleanTrackTitle(parts[1]));
        }

        let foundUri = null;
        for (const query of queriesToTry) {
          if (!query || query.length < 2) continue;
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            { headers: { Authorization: `Bearer ${spotifyToken}` } }
          );
          const searchData = await searchRes.json();
          const item = searchData.tracks?.items?.[0];
          if (item?.uri) {
            foundUri = item.uri;
            break;
          }
        }

        if (foundUri) {
          spotifyTrackUris.push(foundUri);
        }
      }

      // 4. Create Playlist on Spotify
      const createPlRes = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          description: 'Synced from YouTube via Sync App',
          public: false,
        }),
      });
      const newPlaylist = await createPlRes.json();

      if (!createPlRes.ok) {
        throw new Error(`Spotify Playlist Error: ${newPlaylist.error?.message || 'Failed to create'}`);
      }

      // 5. Add Tracks using /items (100 batch limit)
      if (newPlaylist.id && spotifyTrackUris.length > 0) {
        for (let i = 0; i < spotifyTrackUris.length; i += 100) {
          const batch = spotifyTrackUris.slice(i, i + 100);
          await fetch(`https://api.spotify.com/v1/playlists/${newPlaylist.id}/items`, {
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
        spotifyPlaylistUrl: newPlaylist.external_urls?.spotify || null,
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
