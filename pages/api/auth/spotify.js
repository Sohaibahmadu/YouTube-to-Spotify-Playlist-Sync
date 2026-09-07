export default function handler(req, res) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

  if (!client_id || !redirect_uri) {
    return res.status(500).send("Spotify Environment Variables missing. Check SPOTIFY_CLIENT_ID and SPOTIFY_REDIRECT_URI in Vercel.");
  }

  const scopes = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(
    scopes
  )}&redirect_uri=${encodeURIComponent(redirect_uri)}`;

  res.redirect(authUrl);
}
