import { useRouter } from 'next/router';

export default function Home({ isSpotifyConnected, isGoogleConnected }) {
  const router = useRouter();
  const { spotify_connected, google_connected } = router.query;

  // Agar URL mein ho ya cookie mein ho, dono sooraton mein connected dikhaye
  const spotifyActive = Boolean(spotify_connected || isSpotifyConnected);
  const googleActive = Boolean(google_connected || isGoogleConnected);

  return (
    <main style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1>YouTube to Spotify Sync</h1>
      <p style={{ color: '#666' }}>Connect both accounts to begin syncing your playlists.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
        <a 
          href="/api/auth/spotify" 
          style={{
            padding: '12px 20px',
            backgroundColor: spotifyActive ? '#16a34a' : '#1DB954',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}
        >
          {spotifyActive ? '✓ Spotify Connected' : 'Connect Spotify'}
        </a>

        <a 
          href="/api/auth/google" 
          style={{
            padding: '12px 20px',
            backgroundColor: googleActive ? '#16a34a' : '#EA4335',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}
        >
          {googleActive ? '✓ YouTube (Google) Connected' : 'Connect YouTube'}
        </a>
      </div>

      {(spotifyActive || googleActive) && (
        <p style={{ marginTop: '25px', color: '#16a34a', fontWeight: 'bold' }}>
          {spotifyActive && googleActive 
            ? 'Both accounts connected successfully!' 
            : 'Authentication successful!'}
        </p>
      )}
    </main>
  );
}

export async function getServerSideProps({ req }) {
  const cookies = req.headers.cookie || '';
  const isSpotifyConnected = cookies.includes('spotify_connected=true');
  const isGoogleConnected = cookies.includes('google_connected=true');

  return {
    props: {
      isSpotifyConnected,
      isGoogleConnected,
    },
  };
}
