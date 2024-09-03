import React, { useEffect, useState } from 'react';
import axios from 'axios'



function App() {
    const [playlistId, setPlaylistId] = useState('');
    const [numTracks, setNumTracks] = useState(10);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState(null);
   

    useEffect(() => {
        const checkToken = async () => {
            try {
                const response = await axios.get('/api/check-token', {withCredentials: true });
                setAccessToken(response.data.accessToken);
            } catch (error) {

                console.error('Error checking token:', error.response ? error.response.data : error.message);

                if (window.location.pathname !== '/login') {
                    window.location.href = '/api/login';
                } 
            } finally {
                setLoading(false);
            }
        };

        checkToken();
    }, []);

    useEffect(() => {
        if (loading || !accessToken) {
            return; // or show a loading spinner
        }
    }, []);

    useEffect(() => {
        const handlePageUnload = async () => {
          try {
            await fetch('/api/logout', { method: 'POST', });
          } catch (error) {
            console.error('Failed to notify backend on page unload', error);
          }
        };
    
        window.addEventListener('beforeunload', handlePageUnload);
    
        return () => {
          window.removeEventListener('beforeunload', handlePageUnload);
        };
      }, []);
    

    async function fetchFromBackend(endpoint, method = 'GET', body = null) {
        const response = await fetch(`/api/spotify${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: body ? JSON.stringify(body) : null,
        });

        if (!response.ok) {
            console.error('Failed to fetch from backend API', response.status);
            return null;
        }

        return await response.json();
    }

    function extractPlaylistId(url) {
        const regex = /playlist\/([a-zA-Z0-9]+)(?:\?|$|\/|\&)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    async function handleRandomize() {
        if (!playlistId) return;

        const extractedPlaylistId = extractPlaylistId(playlistId);
        if (!extractedPlaylistId) {
            alert('Invalid playlist URL');
            return;
        }

        const data = await fetchFromBackend(`/v1/playlists/${extractedPlaylistId}/tracks`);
        if (!data || !data.items) {
            alert('Failed to fetch playlist items or playlist is empty.');
            return;
        }

        const shuffledItems = shuffleArray(data.items.map(item => item.track.uri));
        const limitedShuffledItems = shuffledItems.slice(0, numTracks);

        for (const trackUri of limitedShuffledItems) {
            await fetchFromBackend(`/v1/me/player/queue?uri=${trackUri}`, 'POST');
        }
    }

    return (
        <div className='app-body'>
            <form className='app-form'
                onSubmit={(e) => {
                    e.preventDefault();
                    handleRandomize();
                }}
            >
                <input
                    type="text"
                    placeholder="Enter playlist URL"
                    value={playlistId}
                    onChange={(e) => setPlaylistId(e.target.value)}
                />
                <div className="form-buttons">
                    <label>
                        <input
                            type="radio"
                            value={5}
                            checked={numTracks === 5}
                            onChange={() => setNumTracks(5)}
                        />
                        5
                    </label>
                    <label>
                        <input
                            type="radio"
                            value={10}
                            checked={numTracks === 10}
                            onChange={() => setNumTracks(10)}
                        />
                        10
                    </label>
                    <label>
                        <input
                            type="radio"
                            value={15}
                            checked={numTracks === 15}
                            onChange={() => setNumTracks(15)}
                        />
                        15
                    </label>
                </div>
                <button type="submit" className='form-button'>Randomize</button>
            </form>
        </div>
    );
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export default App;
