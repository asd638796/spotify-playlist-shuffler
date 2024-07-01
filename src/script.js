const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

export async function redirectToAuthCodeFlow() {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("scope", "user-read-private user-read-email playlist-modify-private playlist-modify-public user-modify-playback-state");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function getAccessToken(code) {
    const verifier = localStorage.getItem("verifier");
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("code_verifier", verifier);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token, refresh_token } = await result.json();

    console.log(access_token);
    
    return {access_token, refresh_token};
}

export async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();
    localStorage.setItem('accessToken', access_token); // Save the new access token
    return access_token;
}

export async function fetchWebApi(endpoint, method = 'GET', body, token) {
    console.log(`Fetching: https://api.spotify.com/${endpoint}`);
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        method,
        body: body ? JSON.stringify(body) : null
    });

    if (!res.ok) {
        if (res.status === 401) {
            // Token expired, refresh it
            const newToken = await refreshAccessToken();
            console.log("access token refreshed!");
            return fetchWebApi(endpoint, method, body, newToken); // Retry with new token
        }
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


export async function getItemsFromPlaylist(playlistId, token) {
    console.log(`Getting items from playlist: ${playlistId}`);

    let allItems = [];
    let offset = 0;
    let limit = 100;
    let hasMoreTracks = true;

    while (hasMoreTracks) {
        const data = await fetchWebApi(`v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`, 'GET', null, token);
        if (!data) break;
        allItems = allItems.concat(data.items);
        offset += limit;
        hasMoreTracks = data.items.length === limit;
    }

    return allItems;
}

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export async function addToQueue(trackUri, token) {
    const endpoint = `v1/me/player/queue?uri=${trackUri}`;
    const result = await fetchWebApi(endpoint, 'POST', null, token);
    if (result) {
        console.log(`Track added to queue: ${trackUri}`);
    } else {
        console.error('Failed to add track to queue');
    }
}
