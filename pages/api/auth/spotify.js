export default function handler(req, res) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const redirect_uri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/spotify`;
  
  const scopes = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirect_uri)}`;

  res.redirect(authUrl);
}

