'use strict';
const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { metaConfig } = require('../config/meta');
const { createInstagramRepository } = require('../services/instagramRepository');
const { createMetaClient, InstagramError, hash, seal, unseal, validId, verifySignedRequest } = require('../services/metaInstagram');

function createInstagramRouter({ config = metaConfig(), repo = createInstagramRepository(), meta = createMetaClient(config) } = {}) {
    const router = express.Router();
    const enabled = config.enabled && repo.available;
    const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    const cookieOptions = { httpOnly: true, secure: config.origin.startsWith('https:'), sameSite: 'lax', path: '/api/integrations/instagram', maxAge: 10 * 60 * 1000 };
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
    router.post(['/deauthorize', '/data-deletion'], express.urlencoded({ extended: false, limit: '20kb' }), wrap(async (req, res) => {
        if (!enabled) throw new InstagramError('INSTAGRAM_NOT_CONFIGURED', 503);
        const userId = verifySignedRequest(req.body?.signed_request, config.secret);
        await repo.revokeMeta(userId);
        if (req.path === '/deauthorize') return res.json({ success: true });
        const code = crypto.randomBytes(24).toString('hex');
        await repo.receipt(code);
        res.json({ url: config.origin + '/api/integrations/instagram/deletion-status/' + code, confirmation_code: code });
    }));
    router.get('/deletion-status/:code', wrap(async (req, res) => {
        if (!enabled) throw new InstagramError('INSTAGRAM_NOT_CONFIGURED', 503);
        if (!/^[a-f0-9]{48}$/.test(req.params.code) || !await repo.getReceipt(req.params.code)) return res.status(404).type('text').send('Deletion receipt not found.');
        res.type('text').send('Completed: CCF removed the Instagram connection records and access tokens covered by this request.');
    }));
    // OAuth callbacks cannot carry CCF's bearer token. A one-time database state
    // AND a browser-bound HttpOnly cookie identify the initiating creator.
    router.get('/callback', wrap(async (req, res) => {
        if (!enabled) return res.status(503).send('Instagram setup is not complete. Close this window and return to CCF.');
        const state = req.query.state;
        const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ccf_instagram_nonce='))?.split('=')[1];
        if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || !cookie || !/^[a-f0-9]{64}$/.test(cookie)) return res.status(400).send('Invalid or expired connection request. Please restart from CCF.');
        const attempt = await repo.consume(hash(state), hash(cookie));
        if (!attempt) return res.status(400).send('Connection request expired or already used. Please restart from CCF.');
        res.clearCookie('ccf_instagram_nonce', { ...cookieOptions, maxAge: undefined });
        try {
            if (req.query.error) throw new InstagramError('CONSENT_CANCELLED', 400);
            if (typeof req.query.code !== 'string' || req.query.code.length > 4096) throw new InstagramError('META_TOKEN_FAILED');
            const result = await meta.authorise(req.query.code);
            const now = new Date().toISOString();
            await repo.save(result.accounts.map(account => ({ ...account, user_id: attempt.user_id, token_ciphertext: seal(result.token, attempt.user_id + ':' + account.instagram_id), expires_at: result.expiresAt, connected_at: now })));
            await repo.finish(hash(state), 'complete', null);
            return res.type('text').send('Instagram connected. You can close this window and return to Creator Cash Flow.');
        } catch (error) {
            await repo.finish(hash(state), 'failed', error instanceof InstagramError ? error.code : 'CONNECTION_FAILED');
            return res.status(400).type('text').send('Instagram was not connected. Close this window and return to CCF for details.');
        }
    }));
    router.use(authenticateToken);
    router.use((req, res, next) => {
        if (!req.user?.id || req.user.id === 'demo_creator_user' || req.user.role === 'admin') return res.status(403).json({ error: 'Sign in with a real creator account.', code: 'REAL_CREATOR_REQUIRED' });
        next();
    });
    router.get('/status', wrap(async (req, res) => res.json({ configured: Boolean(enabled), connections: enabled ? await repo.list(req.user.id) : [] })));
    router.use((req, res, next) => enabled ? next() : res.status(503).json({ error: 'Instagram setup is not complete.', code: 'INSTAGRAM_NOT_CONFIGURED' }));
    // Per-process burst limit complements Meta's own limits; never stores tokens.
    const limits = new Map();
    router.use((req, res, next) => {
        const now = Date.now();
        for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
        const item = limits.get(req.user.id) || { count: 0, until: now + 60000 };
        item.count++;
        limits.set(req.user.id, item);
        if (item.count > 40) return res.status(429).json({ error: 'Please wait a minute before trying again.', code: 'RATE_LIMIT' });
        next();
    });
    router.post('/start', wrap(async (req, res) => {
        const state = crypto.randomBytes(32).toString('hex'), nonce = crypto.randomBytes(32).toString('hex');
        await repo.start({ state_hash: hash(state), cookie_hash: hash(nonce), user_id: req.user.id, status: 'pending', expires_at: new Date(Date.now() + 600000).toISOString() });
        res.cookie('ccf_instagram_nonce', nonce, cookieOptions);
        const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
        url.search = new URLSearchParams({ client_id: config.appId, config_id: config.configId, redirect_uri: config.redirectUri, response_type: 'code', override_default_response_type: 'true', state }).toString();
        res.json({ url: url.toString(), attempt: state });
    }));
    router.get('/attempt/:state', wrap(async (req, res) => {
        if (!/^[a-f0-9]{64}$/.test(req.params.state)) throw new InstagramError('INVALID_REQUEST', 400);
        const attempt = await repo.attempt(hash(req.params.state), req.user.id);
        if (!attempt) throw new InstagramError('NOT_FOUND', 404);
        res.json({ status: Date.parse(attempt.expires_at) <= Date.now() ? 'expired' : attempt.status, code: attempt.result_code });
    }));
    router.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ error: 'Invalid Instagram account ID.' }));
    async function connection(req) {
        const account = await repo.get(req.user.id, req.params.id);
        if (!account) throw new InstagramError('NOT_FOUND', 404);
        if (Date.parse(account.expires_at) <= Date.now()) throw new InstagramError('RECONNECT_REQUIRED', 409);
        let token;
        try { token = unseal(account.token_ciphertext, req.user.id + ':' + account.instagram_id); }
        catch (_) { throw new InstagramError('RECONNECT_REQUIRED', 409); }
        return { account, token };
    }
    router.get('/:id/posts', wrap(async (req, res) => {
        if (req.query.after !== undefined && (typeof req.query.after !== 'string' || req.query.after.length > 2048)) throw new InstagramError('INVALID_CURSOR', 400);
        const { account, token } = await connection(req);
        res.json(await meta.posts(account, token, req.query.after));
    }));
    router.get('/:id/posts/:mediaId/insights', wrap(async (req, res) => {
        if (!validId(req.params.mediaId)) throw new InstagramError('INVALID_REQUEST', 400);
        const { account, token } = await connection(req);
        res.json(await meta.insights(account, token, req.params.mediaId));
    }));
    router.delete('/:id', wrap(async (req, res) => {
        await repo.remove(req.user.id, req.params.id);
        res.json({ disconnected: true });
    }));
    router.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        // Never return provider payloads, request URLs, access tokens or DB errors.
        res.status(error instanceof InstagramError ? error.status : 500).json({ error: 'Instagram request could not be completed.', code: error instanceof InstagramError ? error.code : 'INSTAGRAM_UNAVAILABLE' });
    });
    return router;
}
module.exports = { createInstagramRouter };
