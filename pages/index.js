import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const { spotify_connected, google_connected } = router.query;

  return (
    <main style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1>YouTube to Spotify Sync</h1>
      <p style={{ color: '#666' }}>Connect both accounts to begin syncing your playlists.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
        <a 
          href="/api/auth/spotify" 
          style={{
            padding: '12px 20px',
            backgroundColor: '#1DB954',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}
        >
          {spotify_connected ? '✓ Spotify Connected' : 'Connect Spotify'}
        </a>

        <a 
          href="/api/auth/google" 
          style={{
            padding: '12px 20px',
            backgroundColor: '#EA4335',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}
        >
          {google_connected ? '✓ YouTube (Google) Connected' : 'Connect YouTube'}
        </a>
      </div>

      {(spotify_connected || google_connected) && (
        <p style={{ marginTop: '25px', color: '#16a34a', fontWeight: 'bold' }}>
          Authentication successful!
        </p>
      )}
    </main>
  );
}
