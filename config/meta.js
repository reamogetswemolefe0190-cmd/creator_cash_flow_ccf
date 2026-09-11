'use strict';
require('./env');

function metaConfig() {
    const origin = process.env.META_APP_ORIGIN || '';
    let validOrigin = false;
    try {
        const url = new URL(origin);
        validOrigin = url.origin === origin && (url.protocol === 'https:' ||
            (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost'));
    } catch (_) { /* Disabled until configured. */ }
    const config = {
        appId: process.env.META_APP_ID || '',
        secret: process.env.META_APP_SECRET || '',
        configId: process.env.META_LOGIN_CONFIG_ID || '',
        version: 'v26.0',
        origin,
        redirectUri: origin + '/api/integrations/instagram/callback'
    };
    config.enabled = validOrigin && /^\d+$/.test(config.appId) && /^\d+$/.test(config.configId) && Boolean(config.secret);
    return config;
}
module.exports = { metaConfig };
