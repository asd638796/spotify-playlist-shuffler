import React, { useEffect, useState } from 'react';
import { redirectToAuthCodeFlow, getAccessToken, getItemsFromPlaylist, shuffleArray, addToQueue, refreshAccessToken } from './script';

function App() {
  const [token, setToken] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [numTracks, setNumTracks] = useState(10);

  useEffect(() => {
      
      

      async function authenticate() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
          redirectToAuthCodeFlow();
          
        } else {
          const accessToken = await getAccessToken(code);
          setToken(accessToken);
          
          
        }
    }

  

    const storedToken = localStorage.getItem('accessToken');
    
    if (storedToken && storedToken !== 'undefined') {
      refreshAccessToken();
      setToken(storedToken);
    } else {
      authenticate();
    }


  }, []);

  function extractPlaylistId(url) {
    const regex = /playlist\/([a-zA-Z0-9]+)(?:\?|$|\/|\&)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async function handleRandomize() {
    if (!token || !playlistId) return;

    const extractedPlaylistId = extractPlaylistId(playlistId);
    if (!extractedPlaylistId) {
      alert('Invalid playlist URL');
      return;
    }

    const items = await getItemsFromPlaylist(extractedPlaylistId, token);
    if (!items || items.length === 0) {
      alert('Failed to fetch playlist items or playlist is empty.');
      return;
    }

    const shuffledItems = shuffleArray(items.map(item => item.track.uri));
    const limitShuffledItems = shuffledItems.slice(0, numTracks);

    for (const trackUri of limitShuffledItems) {
      await addToQueue(trackUri, token);
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

export default App;
