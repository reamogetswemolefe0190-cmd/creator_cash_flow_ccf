const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI, JWT_SECRET } = require('../config/env');
const { supabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');
const jwt = require('jsonwebtoken');

// Mock Data for Fallback/Dev Mode when Google API keys are missing
const MOCK_YOUTUBE_DATA = {
    yt_channel_id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    channel_name: 'Creator Mock Channel',
    access_token: 'mock_yt_token_123',
    refresh_token: 'mock_yt_refresh_123',
    metrics: {
        subscriberCount: '154000',
        viewCount: '23450000',
        videoCount: '142'
    }
};

async function login(req, res) {
    const userId = req.user.id;
    
    // Encode userId in state token to persist it through the OAuth redirect
    const state = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });

    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
        // Fallback mock flow
        return res.json({ url: '/api/youtube/auth/callback?code=mock_auth_code&state=' + state });
    }
    
    const scope = 'https://www.googleapis.com/auth/youtube.readonly';
    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + YOUTUBE_CLIENT_ID + "&redirect_uri=" + encodeURIComponent(YOUTUBE_REDIRECT_URI) + "&response_type=code&scope=" + encodeURIComponent(scope) + "&access_type=offline&prompt=consent&state=" + state;
    
    res.json({ url: authUrl });
}

async function callback(req, res) {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).send('Invalid request: missing code or state.');
        }

        let userId;
        try {
            const decoded = jwt.verify(state, JWT_SECRET);
            userId = decoded.userId;
        } catch (e) {
            return res.status(400).send('Invalid or expired state token.');
        }

        if (code === 'mock_auth_code') {
            // Save mock connection
            const connection = {
                id: 'yt_mock_' + userId,
                user_id: userId,
                yt_channel_id: MOCK_YOUTUBE_DATA.yt_channel_id,
                channel_name: MOCK_YOUTUBE_DATA.channel_name,
                access_token: MOCK_YOUTUBE_DATA.access_token,
                refresh_token: MOCK_YOUTUBE_DATA.refresh_token,
                connected_at: new Date().toISOString()
            };

            if (supabase) {
                await supabase.from('youtube_connections').upsert([connection], { onConflict: 'user_id' });
            } else {
                if (!memoryDb.youtubeConnections) memoryDb.youtubeConnections = [];
                // Remove existing
                memoryDb.youtubeConnections = memoryDb.youtubeConnections.filter(c => c.user_id !== userId);
                memoryDb.youtubeConnections.push(connection);
            }
            
            return res.send("<script>if (window.opener) { window.close(); } else { window.location.href = '/#connections'; }</script>");
        }

        // Real Google API Token Exchange
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: YOUTUBE_CLIENT_ID,
                client_secret: YOUTUBE_CLIENT_SECRET,
                redirect_uri: YOUTUBE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error('YouTube Token Error:', tokenData);
            return res.status(400).send('Failed to authenticate with Google.');
        }

        // Fetch channel info
        const channelResponse = await fetch('https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: "Bearer " + tokenData.access_token }
        });
        const channelData = await channelResponse.json();

        if (!channelResponse.ok || !channelData.items || channelData.items.length === 0) {
            return res.status(400).send('No YouTube channel found on this account.');
        }

        const channel = channelData.items[0];
        const connection = {
            user_id: userId,
            yt_channel_id: channel.id,
            channel_name: channel.snippet.title,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null, // Refresh token is only sent on first auth
            connected_at: new Date().toISOString()
        };

        if (supabase) {
            await supabase.from('youtube_connections').upsert([connection], { onConflict: 'user_id' });
        } else {
            if (!memoryDb.youtubeConnections) memoryDb.youtubeConnections = [];
            memoryDb.youtubeConnections = memoryDb.youtubeConnections.filter(c => c.user_id !== userId);
            memoryDb.youtubeConnections.push(connection);
        }

        return res.send("<script>if (window.opener) { window.close(); } else { window.location.href = '/#connections'; }</script>");

    } catch(err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
    }
}

async function getMetrics(req, res) {
    const userId = req.user.id;
    let connection = null;

    if (supabase) {
        const { data } = await supabase.from('youtube_connections').select('*').eq('user_id', userId).maybeSingle();
        connection = data;
    } else {
        connection = (memoryDb.youtubeConnections || []).find(c => c.user_id === userId);
    }

    if (!connection) {
        return res.json({ connected: false });
    }

    if (connection.access_token === 'mock_yt_token_123') {
        return res.json({
            connected: true,
            channel: connection.channel_name,
            metrics: MOCK_YOUTUBE_DATA.metrics,
            connectedAt: connection.connected_at
        });
    }

    // Real API fetch
    try {
        const channelResponse = await fetch('https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: "Bearer " + connection.access_token }
        });
        const channelData = await channelResponse.json();

        if (channelResponse.ok && channelData.items && channelData.items.length > 0) {
            const stats = channelData.items[0].statistics;
            return res.json({
                connected: true,
                channel: connection.channel_name,
                metrics: {
                    subscriberCount: stats.subscriberCount,
                    viewCount: stats.viewCount,
                    videoCount: stats.videoCount
                },
                connectedAt: connection.connected_at
            });
        }
        
        // If unauthorized, token might be expired. A robust app would use refresh_token here.
        // For simplicity in this implementation, we return what we have in DB.
        return res.json({
            connected: true,
            channel: connection.channel_name,
            metrics: { subscriberCount: '...', viewCount: '...', videoCount: '...' },
            connectedAt: connection.connected_at
        });

    } catch (e) {
        console.error('YouTube metrics error:', e);
        return res.status(500).json({ error: 'Failed to fetch YouTube metrics' });
    }
}

async function disconnect(req, res) {
    const userId = req.user.id;
    if (supabase) {
        await supabase.from('youtube_connections').delete().eq('user_id', userId);
    } else {
        if (memoryDb.youtubeConnections) {
            memoryDb.youtubeConnections = memoryDb.youtubeConnections.filter(c => c.user_id !== userId);
        }
    }
    res.json({ success: true });
}

module.exports = { login, callback, getMetrics, disconnect };

