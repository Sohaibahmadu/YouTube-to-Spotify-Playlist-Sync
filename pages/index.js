import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home({ isSpotifyConnected, isGoogleConnected }) {
  const router = useRouter();
  const { spotify_connected, google_connected } = router.query;

  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const spotifyActive = Boolean(spotify_connected || isSpotifyConnected);
  const googleActive = Boolean(google_connected || isGoogleConnected);
  const bothConnected = spotifyActive && googleActive;

  const handleSync = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      setSyncResult(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      {bothConnected && (
        <div style={{ marginTop: '30px' }}>
          <button
            onClick={handleSync}
            disabled={loading}
            style={{
              padding: '14px 28px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Fetching Playlists...' : 'Sync Playlists'}
          </button>
        </div>
      )}

      {errorMsg && (
        <p style={{ marginTop: '20px', color: '#dc2626', fontWeight: 'bold' }}>
          {errorMsg}
        </p>
      )}

      {syncResult && (
        <div style={{ marginTop: '30px', textAlign: 'left', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
          <h3 style={{ color: '#16a34a' }}>{syncResult.message}</h3>
          <p>Playlists Found: {syncResult.youtubePlaylistsCount}</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
            {syncResult.playlists.map((pl) => (
              <li key={pl.id} style={{ margin: '8px 0' }}>
                <strong>{pl.snippet?.title}</strong>
              </li>
            ))}
          </ul>
        </div>
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
