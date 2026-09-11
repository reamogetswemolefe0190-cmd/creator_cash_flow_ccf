'use strict';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { createInstagramRouter } = require('../routes/instagramRoutes');
const { seal, unseal, hash, createMetaClient, verifySignedRequest } = require('../services/metaInstagram');

const config = { enabled: true, appId: '4612466858973489', configId: '4395581310658782', secret: 'test-only-meta-secret', version: 'v26.0', origin: 'http://localhost', redirectUri: 'http://localhost/api/integrations/instagram/callback' };
const igId = '17841475024653722', pageId = '1418119698041823', metaUserId = '12345678901';
const attempts = new Map(), rows = new Map(), receipts = new Set();
const key = (user, id) => user + ':' + id;
const repo = {
    available: true,
    async start(row) { attempts.set(row.state_hash, row); },
    async consume(id, cookie) { const row = attempts.get(id); if (row?.status !== 'pending' || row.cookie_hash !== cookie || Date.parse(row.expires_at) <= Date.now()) return null; row.status = 'processing'; return { user_id: row.user_id }; },
    async finish(id, status, code) { Object.assign(attempts.get(id), { status, result_code: code }); },
    async attempt(id, user) { const row = attempts.get(id); return row?.user_id === user ? row : null; },
    async save(accounts) { accounts.forEach(account => rows.set(key(account.user_id, account.instagram_id), account)); },
    async list(user) { return [...rows.values()].filter(row => row.user_id === user).map(({ instagram_id, username, expires_at }) => ({ instagram_id, username, expires_at })); },
    async get(user, id) { return rows.get(key(user, id)); },
    async remove(user, id) { rows.delete(key(user, id)); },
    async revokeMeta(id) { for (const [key, row] of rows) if (row.meta_user_id === id) rows.delete(key); },
    async receipt(code) { receipts.add(code); },
    async getReceipt(code) { return receipts.has(code); }
};
const providerToken = 'test-provider-token-never-public';
let authCalls = 0;
const meta = {
    async authorise() { authCalls++; return { token: providerToken, expiresAt: new Date(Date.now() + 86400000).toISOString(), accounts: [{ instagram_id: igId, page_id: pageId, meta_user_id: metaUserId, username: 'testcreator' }] }; },
    async posts(account, token, after) { assert.equal(token, providerToken); assert.equal(account.instagram_id, igId); return { posts: [{ id: '17870423907650106' }], after: after ? null : 'safe-cursor' }; },
    async insights() { return { metrics: [] }; }
};
function signed(id) {
    const data = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: id })).toString('base64url');
    return crypto.createHmac('sha256', config.secret).update(data).digest('base64url') + '.' + data;
}

async function testClient() {
    const encrypted = seal(providerToken, 'alice:' + igId);
    assert.notEqual(encrypted, providerToken);
    assert.equal(unseal(encrypted, 'alice:' + igId), providerToken);
    assert.throws(() => unseal(encrypted, 'bob:' + igId));
    assert.throws(() => unseal(encrypted.slice(0, -5) + 'AAAAA', 'alice:' + igId));
    assert.equal(verifySignedRequest(signed(metaUserId), config.secret), metaUserId);
    assert.throws(() => verifySignedRequest('bad.' + signed(metaUserId), config.secret));
    const calls = [];
    let owner = igId, expires = Math.floor(Date.now() / 1000) + 86400;
    const transport = async (url, options) => {
        assert.equal(url.origin, 'https://graph.facebook.com');
        calls.push(url);
        let payload;
        if (url.pathname.endsWith('/oauth/access_token')) payload = { access_token: providerToken, expires_in: 86400 };
        else if (url.pathname.endsWith('/debug_token')) payload = { data: { is_valid: true, app_id: config.appId, user_id: metaUserId, expires_at: expires, scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights'], granular_scopes: [{ scope: 'pages_show_list', target_ids: [pageId] }] } };
        else if (url.pathname.endsWith('/me/accounts')) payload = { data: [] };
        else if (url.pathname.endsWith('/' + pageId)) payload = { id: pageId, instagram_business_account: { id: igId } };
        else if (url.pathname.endsWith('/' + igId)) payload = { id: igId, username: 'testcreator' };
        else if (url.pathname.endsWith('/media')) payload = { data: [{ id: '17870423907650106', caption: 'test', media_type: 'IMAGE' }], paging: { next: 'https://graph.facebook.com/?access_token=SECRET', cursors: { after: 'opaque-cursor' } } };
        else if (url.pathname.endsWith('/insights')) {
            const metric = url.searchParams.get('metric');
            if (metric === 'saved') return { ok: false, status: 400, json: async () => ({ error: { code: 100, message: 'secret provider details' } }) };
            payload = { data: [{ name: metric, values: [{ value: 0 }] }] };
        } else payload = { id: '17870423907650106', owner: { id: owner } };
        assert.ok(options.signal);
        return { ok: true, json: async () => payload };
    };
    const client = createMetaClient(config, transport);
    const linked = await client.authorise('code');
    assert.equal(linked.accounts[0].instagram_id, igId, 'Fallback uses authorised Page IDs');
    assert.ok(calls.some(url => url.pathname.endsWith('/' + pageId)));
    const posts = await client.posts(linked.accounts[0], providerToken, 'cursor');
    assert.equal(posts.after, 'opaque-cursor');
    assert.ok(!JSON.stringify(posts).includes('SECRET'));
    const metrics = await client.insights(linked.accounts[0], providerToken, '17870423907650106');
    assert.deepEqual(metrics.metrics[0], { name: 'reach', value: 0, available: true });
    assert.deepEqual(metrics.metrics[1], { name: 'saved', value: null, available: false });
    owner = '999999999999';
    await assert.rejects(() => client.insights(linked.accounts[0], providerToken, '17870423907650106'), { code: 'POST_NOT_OWNED' });
    expires = 1;
    await assert.rejects(() => client.authorise('code'), { code: 'RECONNECT_REQUIRED' });
    const unavailable = createMetaClient(config, async () => { throw Error('secret transport details'); });
    await assert.rejects(() => unavailable.authorise('code'), { code: 'META_UNAVAILABLE' });
}

async function main() {
    await testClient();
    const app = express(); app.use(express.json());
    app.use('/api/integrations/instagram', createInstagramRouter({ config, repo, meta }));
    app.use('/disabled', createInstagramRouter({ config: { ...config, enabled: false }, repo, meta }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const auth = user => ({ Authorization: 'Bearer ' + jwt.sign({ id: user }, JWT_SECRET, { expiresIn: '1h' }) });
    async function call(path, user = 'alice', options = {}) {
        return fetch(base + '/api/integrations/instagram' + path, { ...options, headers: { ...(user ? auth(user) : {}), ...options.headers } });
    }
    async function start() {
        const response = await call('/start', 'alice', { method: 'POST' });
        assert.equal(response.status, 200);
        return { ...await response.json(), cookie: response.headers.get('set-cookie').split(';')[0] };
    }
    try {
        assert.equal((await call('/status', null)).status, 401);
        assert.equal((await call('/status', null, { headers: { Authorization: 'Bearer demo_token' } })).status, 403);
        assert.equal((await call('/status', null, { headers: { Authorization: 'Bearer offline_token' } })).status, 403);
        assert.equal((await fetch(base + '/disabled/start', { method: 'POST', headers: auth('alice') })).status, 503);
        const first = await start();
        assert.equal(new URL(first.url).searchParams.get('config_id'), config.configId);
        assert.ok(!JSON.stringify(first).includes(config.secret));
        assert.equal((await call('/callback?state=' + first.attempt + '&code=test', null)).status, 400, 'Cookie is mandatory');
        const callback = await call('/callback?state=' + first.attempt + '&code=test', null, { headers: { Cookie: first.cookie } });
        assert.equal(callback.status, 200);
        assert.equal(authCalls, 1);
        assert.equal((await call('/callback?state=' + first.attempt + '&code=test', null, { headers: { Cookie: first.cookie } })).status, 400, 'Replay denied');
        assert.equal(authCalls, 1);
        assert.equal((await (await call('/attempt/' + first.attempt)).json()).status, 'complete');
        assert.equal((await call('/attempt/' + first.attempt, 'bob')).status, 404);
        const statusResponse = await call('/status');
        assert.equal(statusResponse.headers.get('cache-control'), 'no-store');
        assert.ok(!(await statusResponse.text()).includes(providerToken));
        assert.ok(!rows.get(key('alice', igId)).token_ciphertext.includes(providerToken));
        assert.equal((await call('/' + igId + '/posts', 'bob')).status, 404);
        assert.equal((await call('/' + igId + '/posts')).status, 200);
        assert.equal((await call('/' + igId + '/posts?after=' + 'x'.repeat(2050))).status, 400);
        assert.equal((await call('/' + igId + '/posts/not-an-id/insights')).status, 400);
        const cancelled = await start();
        await call('/callback?state=' + cancelled.attempt + '&error=access_denied', null, { headers: { Cookie: cancelled.cookie } });
        assert.equal(attempts.get(hash(cancelled.attempt)).result_code, 'CONSENT_CANCELLED');
        const expired = await start(); attempts.get(hash(expired.attempt)).expires_at = '2000-01-01';
        assert.equal((await call('/callback?state=' + expired.attempt + '&code=test', null, { headers: { Cookie: expired.cookie } })).status, 400);
        assert.equal((await call('/data-deletion', null, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'signed_request=bad' })).status, 400);
        const deletion = await call('/data-deletion', null, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ signed_request: signed(metaUserId) }).toString() });
        assert.equal(deletion.status, 200);
        const receipt = await deletion.json();
        assert.ok(receipt.confirmation_code);
        assert.equal(rows.size, 0);
        assert.equal((await call('/deletion-status/' + receipt.confirmation_code, null)).status, 200);
        assert.equal((await call('/deletion-status/' + 'a'.repeat(48), null)).status, 404);
        const reconnect = await start();
        await call('/callback?state=' + reconnect.attempt + '&code=test', null, { headers: { Cookie: reconnect.cookie } });
        await call('/' + igId, 'bob', { method: 'DELETE' });
        assert.equal(rows.size, 1, 'Other users cannot disconnect Alice');
        await call('/' + igId, 'alice', { method: 'DELETE' });
        assert.equal(rows.size, 0);
        console.log('Instagram integration tests passed: OAuth binding/replay/expiry, consent, owner isolation, encrypted storage, pagination, metrics, deletion callbacks, disabled config and demo rejection.');
    } finally { server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
