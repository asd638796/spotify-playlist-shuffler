import React, { useEffect, useState } from 'react';
import axios from 'axios'



function App() {
    const [playlistId, setPlaylistId] = useState('');
    const [numTracks, setNumTracks] = useState(10);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
   

    useEffect(() => {
        const checkToken = async () => {
            try {
                const response = await axios.get('/api/check-token', {withCredentials: true });
                setAccessToken(response.data.accessToken);
            } catch (error) {

                

                if (window.location.pathname !== '/api/login') {
                    window.location.href = '/api/login';
                } 
            } finally {
                setLoading(false);
            }
        };

        checkToken();
    }, []);

   


    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            setAccessToken(null);
            window.location.href = '/api/login';
        } catch (error) {
            setErrorMessage('An error occured - please try again');
        }
    };
    
    const handleRandomize = async () => {
        if (!playlistId) {
            setErrorMessage('An error occured - please enter a playlist URL');
            return;
        }

        try {
            const extractedPlaylistId = extractPlaylistId(playlistId);
            if (!extractedPlaylistId) {
                setErrorMessage('An error occured - invalid playlist URL');
                return;
            }

            await axios.post('/api/randomize', {
                playlistId: extractedPlaylistId,
                numTracks: numTracks,
            });

            alert('Songs added to the queue!');
        } catch (error) {
            if (error.response && error.response.status === 500) {
                setErrorMessage('An error occurred - make sure you are playing something when you hit randomize!');
            } else {
                setErrorMessage('An error occurred - please try again.');
            }
        }
    };

    function extractPlaylistId(url) {
        const regex = /playlist\/([a-zA-Z0-9]+)(?:\?|$|\/|\&)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }


    return (
        <>
            <div>
                <button onClick={handleLogout} className="logout-button">Logout</button>  
            </div>
            <div>
                {errorMessage && <div style={{ color: 'red', marginBottom: '10px' }}>{errorMessage}</div>}
            </div>
            <div className='app-body'>
                
                <form className='app-form'
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleRandomize();
                    }}>
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

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export default App;
