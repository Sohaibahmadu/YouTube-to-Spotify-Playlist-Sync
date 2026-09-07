import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home({ isSpotifyConnected, isGoogleConnected }) {
  const router = useRouter();
  const { spotify_connected, google_connected } = router.query;

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [transferReport, setTransferReport] = useState([]);

  const spotifyActive = Boolean(spotify_connected || isSpotifyConnected);
  const googleActive = Boolean(google_connected || isGoogleConnected);
  const bothConnected = spotifyActive && googleActive;

  const fetchPlaylists = async () => {
    setLoading(true);
    setErrorMsg('');
    setTransferReport([]);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch playlists');
      
      setPlaylists(data.playlists || []);
      setSelectedPlaylists([]);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (playlistId) => {
    setSelectedPlaylists((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPlaylists.length === playlists.length) {
      setSelectedPlaylists([]);
    } else {
      setSelectedPlaylists(playlists.map((pl) => pl.id));
    }
  };

  const handleTransfer = async () => {
    if (selectedPlaylists.length === 0) return;

    setSyncing(true);
    setErrorMsg('');
    setTransferReport([]);

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistIds: selectedPlaylists }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      setTransferReport(data.results || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main style={{ maxWidth: '680px', margin: '40px auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>YouTube to Spotify Sync</h1>
      <p style={{ textAlign: 'center', color: '#666' }}>Connect both accounts to begin syncing your playlists.</p>

      {/* Auth Buttons */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
        <a
          href="/api/auth/spotify"
          style={{
            padding: '10px 18px',
            backgroundColor: spotifyActive ? '#16a34a' : '#1DB954',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {spotifyActive ? '✓ Spotify Connected' : 'Connect Spotify'}
        </a>

        <a
          href="/api/auth/google"
          style={{
            padding: '10px 18px',
            backgroundColor: googleActive ? '#16a34a' : '#EA4335',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {googleActive ? '✓ YouTube Connected' : 'Connect YouTube'}
        </a>
      </div>

      {/* Load Playlists Button */}
      {bothConnected && (
        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          <button
            onClick={fetchPlaylists}
            disabled={loading || syncing}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: loading || syncing ? 'not-allowed' : 'pointer',
              opacity: loading || syncing ? 0.7 : 1
            }}
          >
            {loading ? 'Loading Playlists...' : 'Load YouTube Playlists'}
          </button>
        </div>
      )}

      {errorMsg && (
        <p style={{ textAlign: 'center', color: '#dc2626', marginTop: '20px', fontWeight: 'bold' }}>
          {errorMsg}
        </p>
      )}

      {/* Transfer Success Report */}
      {transferReport.length > 0 && (
        <div style={{ marginTop: '25px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#16a34a' }}>Sync Complete!</h3>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {transferReport.map((item, idx) => (
              <li key={idx} style={{ margin: '6px 0' }}>
                <strong>{item.playlistName}</strong>: {item.syncedToSpotify}/{item.totalSongs} tracks synced.{' '}
                {item.spotifyPlaylistUrl && (
                  <a href={item.spotifyPlaylistUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                    Open in Spotify
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Playlists Selection List */}
      {playlists.length > 0 && (
        <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Playlists Found ({playlists.length})</h3>
            <button
              onClick={handleSelectAll}
              disabled={syncing}
              style={{
                padding: '6px 12px',
                border: '1px solid #9ca3af',
                backgroundColor: '#fff',
                borderRadius: '4px',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              {selectedPlaylists.length === playlists.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {playlists.map((pl, index) => (
              <label
                key={pl.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: selectedPlaylists.includes(pl.id) ? '#f0fdf4' : '#f9fafb',
                  border: selectedPlaylists.includes(pl.id) ? '1px solid #86efac' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: syncing ? 'not-allowed' : 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPlaylists.includes(pl.id)}
                  onChange={() => handleCheckboxChange(pl.id)}
                  disabled={syncing}
                  style={{ width: '18px', height: '18px', marginRight: '12px', cursor: syncing ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ minWidth: '35px', fontWeight: 'bold', color: '#6b7280' }}>
                  #{index + 1}
                </span>
                <span style={{ flex: 1, fontWeight: '500' }}>
                  {pl.snippet?.title}
                </span>
                <span style={{ color: '#6b7280', fontSize: '13px', backgroundColor: '#e5e7eb', padding: '2px 8px', borderRadius: '12px' }}>
                  {pl.contentDetails?.itemCount || 0} songs
                </span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={handleTransfer}
              disabled={selectedPlaylists.length === 0 || syncing}
              style={{
                padding: '12px 28px',
                backgroundColor: selectedPlaylists.length > 0 && !syncing ? '#16a34a' : '#9ca3af',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: selectedPlaylists.length > 0 && !syncing ? 'pointer' : 'not-allowed',
                fontSize: '15px'
              }}
            >
              {syncing
                ? 'Syncing in Progress (please wait)...'
                : `Sync Selected (${selectedPlaylists.length}) Playlists to Spotify`}
            </button>
          </div>
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
