import React, { useEffect, useState } from 'react';
import axios from 'axios'



function App() {
    const [playlistId, setPlaylistId] = useState<string>('');
    const [numTracks, setNumTracks] = useState<number>(10);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [messageVisible, setMessageVisible] = useState(false); 
    
   

    useEffect(() => {
        const checkToken = async () => {
            try {
                const response = await axios.get('/api/check-token', {withCredentials: true });
                
            } catch (error: any) {

                

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
            window.location.href = '/api/login';
        } catch (error: any) {
            showMessage('error', 'An error occured - please try again');
            return;
        }
    };
    
    const handleRandomize = async () => {
        if (!playlistId) {
            showMessage('error', 'An error occured - please enter a playlist URL');
            return;
        }

        try {
            const extractedPlaylistId: string | null = extractPlaylistId(playlistId);
            if (!extractedPlaylistId) {
                showMessage('error', 'An error occured - invalid playlist URL');
                return;
            }

            await axios.post('/api/randomize', {
                playlistId: extractedPlaylistId,
                numTracks: numTracks,
                withCredentials: true,
            });

            showMessage('success', 'Songs successfully added to queue!');            

        } catch (error: any) {
            if (error.response && error.response.status === 499) {
                showMessage('error', 'An error occured - ' + error.response.data.error); 
            } else {
                showMessage('error', 'An error occurred - please try again.');
            }

            
        }
    };

    const hideMessageAfterDelay = () => {
        setTimeout(() => {
            setMessageVisible(false);
        }, 5000); // After 5 seconds, hide the message
    };

    const showMessage = (type: 'success' | 'error', message: string) => {
        if (type === 'success') {
            setErrorMessage(''); // Clear any error message
            setSuccessMessage(message); // Set the success message
        } else if (type === 'error') {
            setSuccessMessage(''); // Clear any success message
            setErrorMessage(message); // Set the error message
        }
    
        setMessageVisible(true); // Show the message
        hideMessageAfterDelay(); // Trigger fade-out after 5 seconds
    };

    function extractPlaylistId(url: string): string | null {
        const regex = /playlist\/([a-zA-Z0-9]+)(?:\?|$|\/|\&)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }


    return (
        <>
            <div className='app'>
                <div className='logout'>
                    <button onClick={handleLogout} className="logout-button">Logout</button>  
                </div>

                

                <div className='app-body'>

                    <div className='description'>
                        <p>
                        This is an app that *actually* shuffles a spotify playlist you give it. 
                        Notes: 
                        You must be playing something before you hit randomize.
                        There is also a limit of 100 songs, so if you try to shuffle a playlist that has a more than 100 songs, it will just choose the top 100 - im sorry but I can't do much about that.
                        </p>
                    </div>
                    
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

                    <div className={`message ${messageVisible ? 'visible' : 'hidden'}`}>
                        {errorMessage && <div className="error-message">{errorMessage}</div>}
                        {successMessage && <div className="success-message">{successMessage}</div>}
                    </div>
                </div>

                
            </div>
            
        </>
    );
}



export default App;
