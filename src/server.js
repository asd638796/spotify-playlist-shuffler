import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';


const logoutTimers = new Map(); // To store logout timers by refresh token

// Load environment variables from a .env file
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(bodyParser.json());
app.use(cookieParser());


app.use(express.static(path.join(__dirname, '../dist')));

// Fallback for React Router
app.get(/'*'/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const generateCodeVerifier = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateCodeChallenge = (verifier) => {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url'); // Use 'base64url' instead of 'base64' to avoid padding and special characters
};

const verifiers = {}; // In-memory object to store verifiers keyed by state

const sequelize = new Sequelize('spotify_shuffler', 'postgres', process.env.PSQL_PASSWORD, {
    host: 'db',
    dialect: 'postgres',
});

const Token = sequelize.define('token', {
    refresh_token: {
        type: DataTypes.TEXT,
        unique: true,
        allowNull: false,
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    
}, {
    timestamps: true,
});

sequelize.sync();




app.get('/api/login', (req, res) => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    const state = crypto.randomBytes(16).toString('hex'); // Generate a random state
    verifiers[state] = verifier; // Store the verifier keyed by state

    const params = new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state: state, // Send the state to the client
        scope: 'user-read-private user-read-email playlist-modify-private playlist-modify-public user-modify-playback-state',
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});


app.get('/api/callback', async (req, res) => {
    const { code, state } = req.query;
    const verifier = verifiers[state]; // Retrieve the verifier using the state

    if (!verifier) {
        return res.status(400).send('Invalid state or verifier not found');
    }

    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({   
                client_id: process.env.SPOTIFY_CLIENT_ID,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
                code_verifier: verifier,
                secure: process.env.NODE_ENV === 'production',
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, refresh_token, expires_in } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        // Store the tokens in PostgreSQL
        await Token.upsert({
            refresh_token ,
            access_token,
            expiresAt,
        }); 

        res.cookie('refreshToken', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days,
        });

        res.redirect('http://localhost:3001'); // Redirect to the React app
    } catch (error) {
        console.error('Error during token exchange:', error.response ? error.response.data : error.message);
        res.status(500).send('Failed to authenticate');
    }
});
    


app.get('/api/check-token', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).send('No refresh token available');
    }

    try {
        // Fetch the token details from the database
        const tokenRecord = await Token.findOne({ where: { refresh_token: refreshToken } });

        if (!tokenRecord) {
            return res.status(401).send('No token found');
        }

        // Return the access token if valid
        const { access_token } = tokenRecord;
        return res.json({ accessToken: access_token });
    } catch (error) {
        console.error('Error checking token:', error);
        res.status(500).send('Failed to check or refresh token');
    }
});


async function randomize(access_token, playlistId, numTracks) {
    try {
        // Fetch the playlist tracks
        const playlistResponse = await axios({
            method: 'GET',
            url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`,
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const tracks = playlistResponse.data.items;

        if (!tracks || tracks.length === 0) {
            throw new Error('Playlist is empty');
        }

        

        // Shuffle the tracks
        const shuffledItems = shuffleArray(tracks.map(item => item.track.uri));
        let limitedShuffledItems = [];
        if(numTracks <= shuffledItems.length){
            limitedShuffledItems = shuffledItems.slice(0, numTracks);
        }else{
            while (limitedShuffledItems.length < numTracks) {
                limitedShuffledItems.push(...shuffledItems.slice(0, numTracks - limitedShuffledItems.length));
                shuffleArray(limitedShuffledItems);
                
            }
        }
        

        // Add the shuffled tracks to the user's queue
        for (const trackUri of limitedShuffledItems) {
            await axios({
                method: 'POST',
                url: `https://api.spotify.com/v1/me/player/queue?uri=${trackUri}`,
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });
        }
    } catch (error) {
        console.error('Error in randomize:', error);
        throw error;
    }
}



app.post('/api/randomize', async (req, res) => {
    const { playlistId, numTracks } = req.body;
    const refreshToken = req.cookies.refreshToken;

    if (!playlistId || !numTracks) {
        return res.status(400).send('Playlist ID and number of tracks are required');
    }

    if (!refreshToken) {
        return res.status(400).send('No refresh token available');
    }

    let tokenData = await Token.findOne({ where: { refresh_token: refreshToken } });

    if (!tokenData) {
        return res.status(400).send('Invalid refresh token');
    }

    let { access_token } = tokenData;

    try {
        
        await randomize(access_token, playlistId, numTracks);

        res.status(200).send('Songs added to queue');
    } catch (error) {

        if (error.message === 'Playlist is empty') {
            return res.status(499).json({ error: 'playlist is empty' });
        }

        if (error.response && error.response.status === 401) { 
            try {
                // Handle expired access token by refreshing it
                const refreshResponse = await axios.post(
                    'https://accounts.spotify.com/api/token',
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                        },
                    }
                );

                access_token = refreshResponse.data.access_token;

                // Update the access token in the database
                tokenData.access_token = access_token;
                await tokenData.save();

                if (refreshResponse.data.refresh_token) {
                    
                    const newRefreshToken = refreshResponse.data.refresh_token;

                    // Update the refresh token in the database
                    tokenData.refresh_token = newRefreshToken;
                    await tokenData.save();

                    // Update the refresh token cookie
                    res.cookie('refreshToken', newRefreshToken, {
                        httpOnly: true,                     // Prevents access via JavaScript
                        secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
                        sameSite: 'Strict',                 // Prevents CSRF by restricting cross-site cookies
                        path: '/',                          // Cookie is available site-wide
                        maxAge: 30 * 24 * 60 * 60 * 1000,   // 30 days expiry
                    });
                  }

                // Retry adding shuffled tracks to the user's queue
                await randomize(access_token, playlistId, numTracks);

               
                return res.status(200).send('Songs added to queue');
            } catch (refreshError) {
                console.error('Failed to refresh access token', refreshError);
                return res.status(500).send('Failed to refresh access token');
            }
        } else {
            console.error('Spotify API request failed', error);
            return res.status(500).send('Spotify API request failed');
        }
    }
});

// Helper function to shuffle the tracks
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


app.post('/api/logout', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).send('No refresh token available');
    }
    
    try {
        await Token.destroy({ where: { refresh_token: refreshToken } });
        console.log(`Token with refresh token ${refreshToken} deleted.`);
        
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/'  // Ensure the path matches where the cookie was set
        });
    } catch (error) {
        console.error('Failed to delete token', error);
    } finally {
        logoutTimers.delete(refreshToken); // Clean up the timer map
    }
   
    res.status(200).send('Logout initiated.');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});