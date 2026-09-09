'use strict';

process.env.NODE_ENV = 'test';
process.env.PORT = '5057';
delete process.env.PHYLLO_AUTH_HEADER;
delete process.env.PHYLLO_CLIENT_ID;
delete process.env.PHYLLO_CLIENT_SECRET;

const assert = require('assert');
const { app } = require('../server');

const server = app.listen(5057, '127.0.0.1');

(async () => {
    const base = 'http://127.0.0.1:5057';
    const noAuth = await fetch(`${base}/api/integrations/phyllo/status`);
    assert.equal(noAuth.status, 401, 'Phyllo status must require authentication');

    const signup = await fetch(`${base}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Phyllo Test Creator', email: `phyllo-${Date.now()}@example.com`, password: 'Valid-test-password-42' })
    });
    assert.equal(signup.status, 201);
    const account = await signup.json();
    const authorization = { Authorization: `Bearer ${account.token}` };

    const status = await fetch(`${base}/api/integrations/phyllo/status`, { headers: authorization });
    assert.equal(status.status, 200);
    const statusBody = await status.json();
    assert.equal(statusBody.configured, false);
    assert.equal(statusBody.connected, false);
    assert.deepEqual(statusBody.connections, []);

    const token = await fetch(`${base}/api/integrations/phyllo/token`, { method: 'POST', headers: authorization });
    assert.equal(token.status, 503);
    const tokenBody = await token.json();
    assert.equal(tokenBody.code, 'PHYLLO_NOT_CONFIGURED');

    console.log('PHYLLO_INTEGRATION_RESULTS', JSON.stringify({ passed: 8, failed: 0 }));
    server.close();
})().catch(error => {
    console.error(error);
    server.close(() => process.exit(1));
});
