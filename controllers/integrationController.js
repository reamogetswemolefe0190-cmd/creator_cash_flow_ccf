// ==========================================================================
// Creator Cash Flow - Third-Party Integrations Controller (Phyllo SDK)
// ==========================================================================

const jwt = require('jsonwebtoken');
const {
    PHYLLO_AUTH_HEADER,
    PHYLLO_API_URL,
    JWT_SECRET
} = require('../config/env');
const { supabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');

async function getPhylloToken(req, res) {
    try {
        if (!PHYLLO_AUTH_HEADER) {
            console.error('[PHYLLO CONFIG ERROR] PHYLLO_AUTH_HEADER environment variable is missing.');
            return res.status(500).json({ error: 'Server configuration error: Phyllo credentials missing. Please set PHYLLO_AUTH_HEADER in Render dashboard.' });
        }
        let userId = null;
        let userName = null;

        // Try to authenticate if authorization header is provided
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
                userName = decoded.name;
            } catch (e) {
                // Ignore and fallback to guest mode
            }
        }

        const isGuest = !userId;
        if (isGuest) {
            userId = 'guest_' + Date.now();
            userName = 'Guest Creator';
        }

        let phylloUserId = null;

        // 1. Fetch user to see if they already have a phyllo_user_id
        if (!isGuest) {
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
                return res.status(userResponse.status).json({ error: 'Failed to create user in Phyllo staging.', details: userData });
            }

            phylloUserId = userData.id;

            // Save the newly created phyllo_user_id (if not guest)
            if (!isGuest) {
                if (supabase) {
                    await supabase
                        .from('users')
                        .update({ phyllo_user_id: phylloUserId })
                        .eq('id', userId);
                } else {
                    const user = (memoryDb.users || []).find(u => u.id === userId);
                    if (user) user.phyllo_user_id = phylloUserId;
                }
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
                products: [
                    "IDENTITY",
                    "IDENTITY.AUDIENCE",
                    "ENGAGEMENT",
                    "ENGAGEMENT.AUDIENCE",
                    "INCOME",
                    "ACTIVITY"
                ]
            })
        });
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[PHYLLO TOKEN GENERATION ERROR]', tokenData);
            return res.status(tokenResponse.status).json({ error: 'Failed to generate SDK token in Phyllo staging.', details: tokenData });
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
            platforms: platformMap
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error while generating connection token.' });
    }
}

module.exports = {
    getPhylloToken
};
