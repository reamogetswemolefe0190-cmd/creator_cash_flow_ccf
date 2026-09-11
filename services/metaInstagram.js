'use strict';
const crypto = require('crypto');
const { ENCRYPTION_KEY } = require('../config/env');
const scopes = ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights'];
const validId = value => typeof value === 'string' && /^\d{5,30}$/.test(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

class InstagramError extends Error {
    constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
function seal(token, owner) {
    const key = crypto.createHash('sha256').update('ccf-meta-v1:' + ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(owner));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function unseal(value, owner) {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1') throw new InstagramError('RECONNECT_REQUIRED', 409);
    const key = crypto.createHash('sha256').update('ccf-meta-v1:' + ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(owner));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}
function verifySignedRequest(value, secret) {
    try {
        if (typeof value !== 'string' || value.length > 16384) throw Error();
        const parts = value.split('.');
        if (parts.length !== 2) throw Error();
        const [signature, encoded] = parts;
        const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
        const actual = Buffer.from(signature, 'base64url');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw Error();
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (payload.algorithm !== 'HMAC-SHA256' || !validId(payload.user_id)) throw Error();
        return payload.user_id;
    } catch (_) { throw new InstagramError('INVALID_SIGNATURE', 400); }
}
function createMetaClient(config, transport = (...args) => fetch(...args)) {
    async function request(path, params = {}, token) {
        const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
        Object.entries(params).forEach(([key, value]) => { if (value !== undefined) url.searchParams.set(key, String(value)); });
        if (token) url.searchParams.set('appsecret_proof', crypto.createHmac('sha256', config.secret).update(token).digest('hex'));
        let response, payload;
        try {
            response = await transport(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000), redirect: 'error' });
            payload = await response.json();
        } catch (_) { throw new InstagramError('META_UNAVAILABLE'); }
        if (!response.ok || payload.error) {
            const code = payload.error?.code;
            if (code === 190) throw new InstagramError('RECONNECT_REQUIRED', 409);
            if ([4, 17, 32, 613].includes(code) || response.status === 429) throw new InstagramError('META_RATE_LIMIT', 429);
            if (code === 100) throw new InstagramError('METRIC_UNAVAILABLE');
            throw new InstagramError('META_PERMISSION_OR_REQUEST_FAILED');
        }
        return payload;
    }
    async function authorise(code) {
        const short = await request('oauth/access_token', { client_id: config.appId, client_secret: config.secret, redirect_uri: config.redirectUri, code });
        if (!short.access_token) throw new InstagramError('META_TOKEN_FAILED');
        const long = await request('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: config.appId, client_secret: config.secret, fb_exchange_token: short.access_token });
        if (!long.access_token) throw new InstagramError('META_TOKEN_FAILED');
        const token = long.access_token;
        const { data: debug } = await request('debug_token', { input_token: token }, config.appId + '|' + config.secret);
        if (!debug?.is_valid || String(debug.app_id) !== config.appId || !validId(debug.user_id) || !scopes.every(scope => debug.scopes?.includes(scope))) {
            throw new InstagramError('META_PERMISSIONS_REQUIRED', 403);
        }
        const expiry = [debug.expires_at, debug.data_access_expires_at, long.expires_in ? Math.floor(Date.now() / 1000) + long.expires_in : 0].filter(value => Number(value) > 0);
        if (!expiry.length || Math.min(...expiry) * 1000 <= Date.now()) throw new InstagramError('RECONNECT_REQUIRED', 409);
        const pages = new Map();
        let after;
        for (let i = 0; i < 20; i++) {
            const result = await request('me/accounts', { fields: 'id,name,instagram_business_account', limit: 100, after }, token);
            (result.data || []).forEach(page => { if (validId(page.id)) pages.set(page.id, page); });
            after = result.paging?.next && result.paging?.cursors?.after;
            if (!after) break;
            if (i === 19) throw new InstagramError('TOO_MANY_PAGES');
        }
        // Some business-login grants omit Pages from /me/accounts. Only inspect
        // Page IDs that Meta's token debugger says the creator authorised.
        const pageIds = new Set((debug.granular_scopes || []).filter(scope => ['pages_show_list', 'pages_read_engagement'].includes(scope.scope)).flatMap(scope => scope.target_ids || []));
        if (pageIds.size > 100) throw new InstagramError('TOO_MANY_PAGES');
        for (const id of pageIds) {
            if (validId(id) && !pages.has(id)) pages.set(id, await request(id, { fields: 'id,name,instagram_business_account' }, token));
        }
        const accounts = [];
        for (const page of pages.values()) {
            const id = page.instagram_business_account?.id;
            if (!validId(id)) continue;
            const profile = await request(id, { fields: 'id,username,followers_count,media_count' }, token);
            accounts.push({ instagram_id: id, page_id: page.id, username: profile.username || '', meta_user_id: debug.user_id });
        }
        if (!accounts.length) throw new InstagramError('NO_INSTAGRAM_ACCOUNTS', 409);
        return { token, accounts, expiresAt: new Date(Math.min(...expiry) * 1000).toISOString() };
    }
    async function posts(account, token, after) {
        const result = await request(account.instagram_id + '/media', { fields: 'id,caption,media_type,permalink,timestamp', limit: 25, after }, token);
        return { posts: (result.data || []).map(post => ({ id: post.id, caption: post.caption || '', mediaType: post.media_type, permalink: post.permalink, timestamp: post.timestamp })), after: result.paging?.next ? result.paging?.cursors?.after || null : null };
    }
    async function insights(account, token, mediaId) {
        const media = await request(mediaId, { fields: 'id,owner' }, token);
        if (String(media.owner?.id || media.owner) !== account.instagram_id) throw new InstagramError('POST_NOT_OWNED', 403);
        const metrics = [];
        for (const name of ['reach', 'saved', 'likes', 'comments', 'shares']) {
            try {
                const result = await request(mediaId + '/insights', { metric: name }, token);
                const metric = result.data?.find(item => item.name === name);
                const value = metric?.values?.[0]?.value ?? metric?.total_value?.value;
                metrics.push({ name, value: typeof value === 'number' ? value : null, available: typeof value === 'number' });
            } catch (error) {
                if (error.code !== 'METRIC_UNAVAILABLE') throw error;
                metrics.push({ name, value: null, available: false });
            }
        }
        return { mediaId, metrics, fetchedAt: new Date().toISOString(), period: 'lifetime' };
    }
    return { authorise, posts, insights };
}
module.exports = { createMetaClient, InstagramError, hash, seal, unseal, validId, verifySignedRequest };
