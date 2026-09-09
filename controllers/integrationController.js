// ==========================================================================
// Creator Cash Flow - Third-Party Integrations Controller (Phyllo SDK)
// ==========================================================================

const {
    PHYLLO_AUTH_HEADER,
    PHYLLO_API_URL
} = require('../config/env');
const { supabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');

async function getPhylloToken(req, res) {
    try {
        if (!PHYLLO_AUTH_HEADER) {
            return res.status(503).json({ error: 'Social account connections are not enabled yet.', code: 'PHYLLO_NOT_CONFIGURED' });
        }
        const userId = req.user.id;
        const userName = req.user.name || 'Creator';

        let phylloUserId = null;

        // 1. Fetch user to see if they already have a phyllo_user_id
        if (supabase) {
                const { data } = await supabase
                    .from('users')
                    .select('phyllo_user_id')
                    .eq('id', userId)
                    .maybeSingle();

                if (data && data.phyllo_user_id) {
                    phylloUserId = data.phyllo_user_id;
                }
        } else {
            const user = (memoryDb.users || []).find(u => u.id === userId);
            if (user && user.phyllo_user_id) {
                phylloUserId = user.phyllo_user_id;
            }
        }

        // 2. If no phyllo_user_id exists, create a user in Phyllo
        if (!phylloUserId) {
            console.log(`[PHYLLO] Creating user for: ${userName}`);
            const userResponse = await fetch(`${PHYLLO_API_URL}/v1/users`, {
                method: 'POST',
                headers: {
                    'Authorization': PHYLLO_AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: userName,
                    external_id: userId
                })
            });
            const userData = await userResponse.json();

            if (!userResponse.ok) {
                console.error('[PHYLLO USER CREATION ERROR]', userData);
                return res.status(502).json({ error: 'The secure connection service could not create this creator profile.', code: 'PHYLLO_USER_ERROR' });
            }

            phylloUserId = userData.id;

            if (supabase) {
                const { error } = await supabase
                        .from('users')
                        .update({ phyllo_user_id: phylloUserId })
                        .eq('id', userId);
                if (error) throw error;
            } else {
                const user = (memoryDb.users || []).find(u => u.id === userId);
                if (user) user.phyllo_user_id = phylloUserId;
            }
        }

        // 3. Generate SDK token
        console.log(`[PHYLLO] Generating SDK token for: ${phylloUserId}`);
        const tokenResponse = await fetch(`${PHYLLO_API_URL}/v1/sdk-tokens`, {
            method: 'POST',
            headers: {
                'Authorization': PHYLLO_AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: phylloUserId,
                // Income is intentionally excluded. It requires a separate,
                // explicit creator consent experience.
                products: ["IDENTITY", "IDENTITY.AUDIENCE", "ENGAGEMENT", "ENGAGEMENT.AUDIENCE"]
            })
        });
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[PHYLLO TOKEN GENERATION ERROR]', tokenData);
            return res.status(502).json({ error: 'The secure connection service could not start.', code: 'PHYLLO_TOKEN_ERROR' });
        }

        // 4. Fetch active work platforms to map names to IDs dynamically
        let platformMap = {};
        try {
            console.log('[PHYLLO] Fetching active work platforms...');
            const platformResponse = await fetch(`${PHYLLO_API_URL}/v1/work-platforms`, {
                method: 'GET',
                headers: {
                    'Authorization': PHYLLO_AUTH_HEADER
                }
            });
            const platformData = await platformResponse.json();
            if (platformResponse.ok && platformData.data) {
                platformData.data.forEach(p => {
                    platformMap[p.name] = p.id;
                });
            } else if (platformResponse.ok && Array.isArray(platformData)) {
                platformData.forEach(p => {
                    platformMap[p.name] = p.id;
                });
            }
            console.log(`[PHYLLO] Loaded ${Object.keys(platformMap).length} active work platforms.`);
        } catch (e) {
            console.error('[PHYLLO PLATFORMS FETCH ERROR]', e);
        }

        res.json({
            sdkToken: tokenData.sdk_token,
            phylloUserId: phylloUserId,
            platforms: platformMap,
            environment: PHYLLO_API_URL.includes('staging') ? 'sandbox' : 'production',
            products: ["IDENTITY", "IDENTITY.AUDIENCE", "ENGAGEMENT", "ENGAGEMENT.AUDIENCE"]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error while generating connection token.' });
    }
}

async function getPhylloStatus(req, res) {
    let phylloUserId = null;
    if (supabase) {
        const { data, error } = await supabase.from('users').select('phyllo_user_id').eq('id', req.user.id).maybeSingle();
        if (error) return res.status(503).json({ error: 'Connection status is temporarily unavailable.' });
        phylloUserId = data?.phyllo_user_id || null;
    } else {
        phylloUserId = memoryDb.usersById.get(req.user.id)?.phyllo_user_id || null;
    }
    const connections = [];
    let syncAvailable = true;
    if (phylloUserId && PHYLLO_AUTH_HEADER) {
        try {
            const response = await fetch(`${PHYLLO_API_URL}/v1/accounts?user_id=${encodeURIComponent(phylloUserId)}`, {
                headers: { Authorization: PHYLLO_AUTH_HEADER }
            });
            const payload = await response.json();
            if (!response.ok) syncAvailable = false;
            const accounts = Array.isArray(payload) ? payload : (payload.data || []);
            for (const account of accounts) {
                connections.push({
                    id: account.id,
                    platform: account.work_platform?.name || account.work_platform_name || 'Connected platform',
                    username: account.username || account.profile?.username || '',
                    status: String(account.status || 'UNKNOWN').toUpperCase(),
                    connectedAt: account.created_at || null
                });
            }
        } catch (error) {
            syncAvailable = false;
        }
    }
    return res.json({
        configured: Boolean(PHYLLO_AUTH_HEADER),
        provisioned: Boolean(phylloUserId),
        connected: connections.some(connection => connection.status === 'CONNECTED'),
        connections,
        syncAvailable,
        environment: PHYLLO_API_URL.includes('staging') ? 'sandbox' : 'production'
    });
}

module.exports = {
    getPhylloToken,
    getPhylloStatus
};
