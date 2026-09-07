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

export default async function handler(req, res) {
  try {
    const { data: tokens, error } = await supabase
      .from('user_tokens')
      .select('*');

    if (error || !tokens || tokens.length < 2) {
      return res.status(400).json({ error: 'Tokens missing from Supabase' });
    }

    const googleToken = tokens.find((t) => t.provider === 'google')?.access_token;
    const spotifyToken = tokens.find((t) => t.provider === 'spotify')?.access_token;

    if (!googleToken || !spotifyToken) {
      return res.status(400).json({ error: 'Both tokens must be present' });
    }

    // YouTube se aakhri 10 Liked Videos lena
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=LL&maxResults=10',
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    const ytData = await ytRes.json();

    if (!ytData.items || ytData.items.length === 0) {
      return res.status(200).json({ message: 'No liked songs found on YouTube.' });
    }

    const trackIdsToSave = [];

    // Spotify par dhoondna
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
      }
    }

    // Spotify Liked Songs mein save karna
    if (trackIdsToSave.length > 0) {
      await fetch('https://api.spotify.com/v1/me/tracks', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: trackIdsToSave }),
      });
    }

    return res.status(200).json({
      success: true,
      message: `${trackIdsToSave.length} liked songs synced.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
