import React, { useEffect, useState } from 'react';
import { redirectToAuthCodeFlow, getAccessToken } from './script';


function App() {
  
  const [token, setToken] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [numTracks, setNumTracks] = useState(10); // State for number of tracks
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;

  useEffect(() => {
    async function authenticate() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (!code) {
        redirectToAuthCodeFlow(clientId);
      } else {
        const accessToken = await getAccessToken(clientId, code);
        setToken(accessToken);
        localStorage.setItem('accessToken', accessToken);
      }
    }

    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      setToken(storedToken);
    } else {
      authenticate();
    }
  }, [clientId]);

  async function fetchWebApi(endpoint, method = 'GET', body) {
    console.log(`Fetching: https://api.spotify.com/${endpoint}`); // Log the request URL
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      method,
      body: body ? JSON.stringify(body) : null
    });
  
    if (!res.ok) {
      console.error('Error fetching data:', res.status, res.statusText);
      return null;
    }
  
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : {}; // Handle empty responses
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return null;
    }
  }
  

  async function getItemsFromPlaylist(playlistId) {
    console.log(`Getting items from playlist: ${playlistId}`); // Log the playlist ID

    let allItems = [];
    let offset = 0;
    let limit = 100;
    let hasMoreTracks = true;

    while (hasMoreTracks) {
      const data = await fetchWebApi(`v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`);
      if (!data) break;
      allItems = allItems.concat(data.items);
      offset += limit;
      hasMoreTracks = data.items.length === limit;
    }

    
    return allItems;
  }



  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

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

    const items = await getItemsFromPlaylist(extractedPlaylistId);
    if (!items || items.length === 0) {
      alert('Failed to fetch playlist items or playlist is empty.');
      return;
    }

    const shuffledItems = shuffleArray(items.map(item => item.track.uri));
    const limitShuffledItems = shuffledItems.slice(0, numTracks); // Limit to selected number of tracks
  

    for (const trackUri of limitShuffledItems) {
      await addToQueue(trackUri);
    }
  }

  async function addToQueue(trackUri) {
    const endpoint = `v1/me/player/queue?uri=${trackUri}`;
    const result = await fetchWebApi(endpoint, 'POST');
    if (result) {
      console.log(`Track added to queue: ${trackUri}`);
    } else {
      console.error('Failed to add track to queue');
    }
  }

  function clearLocalStorage() {
    localStorage.clear();
    setToken('');
    console.log('Local storage cleared and token reset');
  }

  return (
    <>
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
    </>
  );
}

export default App;