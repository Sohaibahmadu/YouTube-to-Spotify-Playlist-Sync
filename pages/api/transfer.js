import { supabase } from '@/lib/supabaseClient';

function cleanYouTubeTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\[.*?\]|\(.*?\)/g, '') // Brackets aur unka content hatayein
    .replace(/official\s+(music\s+)?(video|audio)|lyric(s)?(\s+video)?|hd|4k|remix|full\s+song/gi, '')
    .replace(/ft\..*|feat\..*/gi, '') // Features hatayein
    .replace(/\|.*$/g, '') // Pipe symbol ke baad ka hissa hatayein
    .replace(/[-_]/g, ' ')
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

  const userId = req.cookies?.sync_user_id || 'app_user';

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
      // 1. YouTube Playlist details
      const plDetailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      const plDetailData = await plDetailRes.json();
      const playlistName = plDetailData.items?.[0]?.snippet?.title || 'Synced Playlist';

      // 2. Fetch YouTube Playlist items
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

      // Agar playlist khali ho
      if (songTitles.length === 0) {
        transferResults.push({
          playlistName,
          totalSongs: 0,
          syncedToSpotify: 0,
          message: 'No playable songs found in YouTube playlist.',
        });
        continue;
      }

      // 3. Search Tracks on Spotify with 2-tier fallback
      const spotifyTrackUris = [];
      for (const rawTitle of songTitles) {
        const cleaned = cleanYouTubeTitle(rawTitle);
        const searchQuery = cleaned || rawTitle;

        // Tier 1: Cleaned title search
        let searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${spotifyToken}` } }
        );
        let searchData = await searchRes.json();
        let foundTrack = searchData.tracks?.items?.[0];

        // Tier 2: Agar na mile to pehle 3 words se broad search
        if (!foundTrack && searchQuery.includes(' ')) {
          const fallbackQuery = searchQuery.split(' ').slice(0, 3).join(' ');
          searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(fallbackQuery)}&type=track&limit=1`,
            { headers: { Authorization: `Bearer ${spotifyToken}` } }
          );
          searchData = await searchRes.json();
          foundTrack = searchData.tracks?.items?.[0];
        }

        if (foundTrack?.uri) {
          spotifyTrackUris.push(foundTrack.uri);
        }
      }

      // 4. Spotify Playlist create karein
      const createPlRes = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          description: 'Synced from YouTube via Web App',
          public: false,
        }),
      });
      const newPlaylist = await createPlRes.json();

      if (!createPlRes.ok) {
        throw new Error(`Spotify error: ${newPlaylist.error?.message || 'Failed to create playlist'}`);
      }

      // 5. Tracks add karein (100 ke batches mein)
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
