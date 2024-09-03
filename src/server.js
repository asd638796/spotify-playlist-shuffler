import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
const logoutTimers = new Map(); // To store logout timers by refresh token

// Load environment variables from a .env file
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());


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
    host: 'localhost',
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
        await Token.create({
            refresh_token ,
            access_token,
            expiresAt,
        }); 

        res.cookie('refreshToken', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
        });

        res.redirect('http://localhost:5173'); // Redirect to the React app
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

        // Cancel the logout if it was scheduled
        if (logoutTimers.has(refreshToken)) {
            clearTimeout(logoutTimers.get(refreshToken));
            logoutTimers.delete(refreshToken);
            console.log(`Logout canceled for refresh token ${refreshToken}.`);
        }

        // Return the access token if valid
        const { access_token } = tokenRecord;
        return res.json({ accessToken: access_token });
    } catch (error) {
        console.error('Error checking token:', error);
        res.status(500).send('Failed to check or refresh token');
    }
});


app.get('/api/spotify/*', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).send('No refresh token available');
    }

    let tokenData = await Token.findOne({ where: { refresh_token: refreshToken } });

    if (!tokenData) {
        return res.status(400).send('Invalid refresh token');
    }

    let { access_token } = tokenData;

    try {
        const spotifyResponse = await axios({
            method: req.method,
            url: `https://api.spotify.com${req.url.replace('/api/spotify', '')}`,
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            data: req.body,
        });

        res.status(spotifyResponse.status).json(spotifyResponse.data);
    } catch (error) {
        // Handle expired access token
        if (error.response && error.response.status === 401) {
            try {
                // Refresh the access token
                const refreshResponse = await axios.post(
                    'https://accounts.spotify.com/api/token',
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                access_token = refreshResponse.data.access_token;

                // Update the access token in the database
                tokenData.access_token = access_token;
                await tokenData.save();

                // Retry the Spotify API request
                const retryResponse = await axios({
                    method: req.method,
                    url: `https://api.spotify.com${req.url.replace('/api/spotify', '')}`,
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                    },
                    data: req.body,
                });

                return res.status(retryResponse.status).json(retryResponse.data);
            } catch (refreshError) {
                console.error('Failed to refresh access token', refreshError);
                return res.status(500).send('Failed to refresh access token');
            }
        } else {
            console.error('Spotify API request failed', error);
            res.status(500).send('Spotify API request failed');
        }
    }
});

app.post('/api/logout', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).send('No refresh token available');
    }

    // Check if there's already a pending deletion
    if (logoutTimers.has(refreshToken)) {
        // Cancel the previous timer
        clearTimeout(logoutTimers.get(refreshToken));
    }

    // Set a timer to delete the token after 10 seconds
    const timer = setTimeout(async () => {
        try {
            await Token.destroy({ where: { refresh_token: refreshToken } });
            console.log(`Token with refresh token ${refreshToken} deleted.`);
        } catch (error) {
            console.error('Failed to delete token', error);
        } finally {
            logoutTimers.delete(refreshToken); // Clean up the timer map
        }
    }, 10000); // 10 seconds delay

    logoutTimers.set(refreshToken, timer);

    // Respond immediately to the logout request
    res.status(200).send('Logout initiated. Token will be deleted if no return within 10 seconds.');
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
