import { supabase } from '@/lib/supabaseClient';

function cleanTrackTitle(title) {
  if (!title) return '';
  return title
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/official\s+video|official\s+audio|music\s+video|lyric\s+video|lyrics|hd|4k|audio|remix|full\s+song|video|song/gi, '')
    .replace(/feat\..*|ft\..*/gi, '')
    .replace(/[|&/:_~#@!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function refreshSpotifyToken(refreshToken, userId) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (data.access_token) {
    await supabase.from('user_tokens').update({
      access_token: data.access_token,
      updated_at: new Date().toISOString()
    }).match({ user_id: userId, provider: 'spotify' });
    return data.access_token;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const { data: tokens, error } = await supabase.from('user_tokens').select('*');

    if (error || !tokens || tokens.length < 2) {
      return res.status(400).json({ error: 'Tokens missing from Supabase' });
    }

    const googleRecord = tokens.find((t) => t.provider === 'google');
    const spotifyRecord = tokens.find((t) => t.provider === 'spotify');

    let googleToken = googleRecord?.access_token;
    let spotifyToken = spotifyRecord?.access_token;

    if (spotifyRecord?.refresh_token) {
      const refreshed = await refreshSpotifyToken(spotifyRecord.refresh_token, spotifyRecord.user_id);
      if (refreshed) spotifyToken = refreshed;
    }

    // YouTube Liked Videos (ID: LL)
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=LL&maxResults=10',
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    const ytData = await ytRes.json();

    if (!ytData.items) {
      return res.status(500).json({ error: 'YouTube API error', details: ytData });
    }

    const debugList = [];
    const trackIdsToSave = [];

    for (const item of ytData.items) {
      const rawTitle = item.snippet?.title;
      if (!rawTitle || rawTitle === 'Private video' || rawTitle === 'Deleted video') continue;

      const cleaned = cleanTrackTitle(rawTitle);
      
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleaned)}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${spotifyToken}` } }
      );
      const searchData = await searchRes.json();
      const track = searchData.tracks?.items?.[0];

      if (track?.id) {
        trackIdsToSave.push(track.id);
        debugList.push({ youtube: rawTitle, spotifyFound: track.name, id: track.id });
      }
    }

    // Spotify Liked Songs Save (Query parameter URL ke zariye)
    if (trackIdsToSave.length > 0) {
      const addRes = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackIdsToSave.join(',')}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!addRes.ok) {
        const errText = await addRes.text();
        return res.status(500).json({ error: 'Failed to add tracks to Spotify', spotifyResponse: errText });
      }
    }

    return res.status(200).json({
      success: true,
      syncedCount: trackIdsToSave.length,
      tracks: debugList,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
