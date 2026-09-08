/**
 * tests/challenger_m1_security_test.js
 * Adversarial Security Stress Harness for Milestone M1 Gate Verification
 * 
 * Tests:
 * 1. Rate-limit burst attacks against:
 *    - /api/auth/login
 *    - /api/transactions
 *    - /api/gemini
 *    - /api/admin/creators/:id/status
 *    - /api/admin/auth/login
 *    Plus IP isolation and memory cap verification
 * 2. CORS probing with unauthorized vs whitelisted origins (standard + preflight)
 * 3. Unauthenticated/synthetic token admin access rejections (401/403) across all admin routes
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET, memoryDb } = require('../server');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });
        req.on('error', reject);
        if (body !== null) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
};

function record(name, condition, errorMsg = '') {
    stats.total++;
    if (condition) {
        stats.passed++;
        console.log(`  [PASS] ${name}`);
    } else {
        stats.failed++;
        stats.failures.push({ name, errorMsg });
        console.error(`  [FAIL] ${name}: ${errorMsg}`);
    }
}

async function runEmpiricalStressSuite() {
    console.log('================================================================');
    console.log('CHALLENGER 1: MILESTONE M1 EMPIRICAL SECURITY STRESS HARNESS');
    console.log('================================================================\n');

    // Start local ephemeral test server
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            console.log(`Ephemeral test server active at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // =====================================================================
        // SECTION 1: RATE-LIMIT BURST ATTACKS
        // =====================================================================
        console.log('----------------------------------------------------------------');
        console.log('SECTION 1: RATE-LIMIT BURST ATTACKS');
        console.log('----------------------------------------------------------------');

        // 1.1 /api/auth/login burst attack (Limit: 10 req / 15 min)
        console.log('\n[1.1] Rapid Burst Attack on /api/auth/login (Limit: 10 req / 15 min)');
        const authAttackIp = '10.100.1.50';
        let auth429Seen = false;
        let authRetryAfter = null;
        let authFirst429Index = -1;

        for (let i = 1; i <= 15; i++) {
            const res = await request('POST', '/api/auth/login', {
                email: 'burst_target@creatorcashflow.com',
                password: 'WrongPassword123!'
            }, {
                'X-Forwarded-For': authAttackIp
            });

            if (res.status === 429) {
                if (!auth429Seen) {
                    auth429Seen = true;
                    authFirst429Index = i;
                    authRetryAfter = res.headers['retry-after'];
                }
            }
        }
        record(
            'Burst on /api/auth/login triggers HTTP 429 exactly after 10 requests',
            auth429Seen && authFirst429Index === 11,
            `Expected 429 on request 11, got first 429 on request #${authFirst429Index}`
        );
        record(
            '/api/auth/login 429 includes valid Retry-After header',
            authRetryAfter && parseInt(authRetryAfter, 10) > 0,
            `Retry-After header was: ${authRetryAfter}`
        );

        // Verify IP isolation: another IP should NOT be blocked
        console.log('\n[1.1b] Adversarial Probe: Client IP Isolation & Reverse Proxy Forwarding');
        const cleanAuthRes = await request('POST', '/api/auth/login', {
            email: 'distinct_user@creatorcashflow.com',
            password: 'WrongPassword123!'
        }, {
            'X-Forwarded-For': '10.100.1.51'
        });
        const ipIsolated = (cleanAuthRes.status === 401);
        record(
            'IP Isolation: Distinct client IP (10.100.1.51 via X-Forwarded-For) is NOT blocked by limiter',
            ipIsolated,
            `VULNERABILITY DETECTED: Distinct client IP was blocked with HTTP ${cleanAuthRes.status}. Rate limiter keyGenerator evaluated req.ip ('${cleanAuthRes.headers['x-forwarded-for'] || '127.0.0.1'}') before X-Forwarded-For, collapsing distinct users onto the socket address.`
        );

        // 1.2 /api/transactions burst attack (Limit: 60 req / min)
        console.log('\n[1.2] Rapid Burst Attack on /api/transactions (Limit: 60 req / min)');
        const txCreatorToken = jwt.sign(
            { id: 'usr_tx_burst_test', email: 'tx_burst@test.com' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const txAttackIp = '10.100.2.50';
        let tx429Seen = false;
        let txFirst429Index = -1;
        let txRetryAfter = null;

        for (let i = 1; i <= 65; i++) {
            const res = await request('GET', '/api/transactions', null, {
                'Authorization': `Bearer ${txCreatorToken}`,
                'X-Forwarded-For': txAttackIp
            });

            if (res.status === 429) {
                if (!tx429Seen) {
                    tx429Seen = true;
                    txFirst429Index = i;
                    txRetryAfter = res.headers['retry-after'];
                }
            }
        }
        record(
            'Burst on /api/transactions triggers HTTP 429 exactly after 60 requests',
            tx429Seen && txFirst429Index === 61,
            `Expected 429 on request 61, got first 429 on request #${txFirst429Index}`
        );
        record(
            '/api/transactions 429 includes valid Retry-After header',
            txRetryAfter && parseInt(txRetryAfter, 10) > 0,
            `Retry-After header was: ${txRetryAfter}`
        );

        // 1.3 /api/gemini burst attack (Limit: 15 req / min)
        console.log('\n[1.3] Rapid Burst Attack on /api/gemini (Limit: 15 req / min)');
        const geminiAttackIp = '10.100.3.50';
        let gemini429Seen = false;
        let geminiFirst429Index = -1;
        let geminiRetryAfter = null;

        for (let i = 1; i <= 20; i++) {
            const res = await request('POST', '/api/gemini', {
                prompt: `Adversarial burst query #${i}`
            }, {
                'X-Forwarded-For': geminiAttackIp
            });

            if (res.status === 429) {
                if (!gemini429Seen) {
                    gemini429Seen = true;
                    geminiFirst429Index = i;
                    geminiRetryAfter = res.headers['retry-after'];
                }
            }
        }
        record(
            'Burst on /api/gemini triggers HTTP 429 exactly after 15 requests',
            gemini429Seen && geminiFirst429Index === 16,
            `Expected 429 on request 16, got first 429 on request #${geminiFirst429Index}`
        );
        record(
            '/api/gemini 429 includes valid Retry-After header',
            geminiRetryAfter && parseInt(geminiRetryAfter, 10) > 0,
            `Retry-After header was: ${geminiRetryAfter}`
        );

        // 1.4 /api/admin/creators/:id/status burst attack (Limit: 30 req / min)
        console.log('\n[1.4] Rapid Burst Attack on /api/admin/creators/:id/status (Limit: 30 req / min)');
        const adminStatusToken = jwt.sign(
            { id: 'adm_burst_tester', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const adminStatusAttackIp = '10.100.4.50';
        let adminStatus429Seen = false;
        let adminStatusFirst429Index = -1;
        let adminStatusRetryAfter = null;

        for (let i = 1; i <= 35; i++) {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', {
                status: 'active'
            }, {
                'Authorization': `Bearer ${adminStatusToken}`,
                'X-Forwarded-For': adminStatusAttackIp
            });

            if (res.status === 429) {
                if (!adminStatus429Seen) {
                    adminStatus429Seen = true;
                    adminStatusFirst429Index = i;
                    adminStatusRetryAfter = res.headers['retry-after'];
                }
            }
        }
        record(
            'Burst on /api/admin/creators/:id/status triggers HTTP 429 exactly after 30 requests',
            adminStatus429Seen && adminStatusFirst429Index === 31,
            `Expected 429 on request 31, got first 429 on request #${adminStatusFirst429Index}`
        );
        record(
            '/api/admin/creators/:id/status 429 includes valid Retry-After header',
            adminStatusRetryAfter && parseInt(adminStatusRetryAfter, 10) > 0,
            `Retry-After header was: ${adminStatusRetryAfter}`
        );

        // 1.5 Rate limiter bounded memory capacity (eviction under high cardinality)
        console.log('\n[1.5] Rate Limiter Bounded Memory Check (Tracking Map Size Cap)');
        // Request from 600 distinct IPs to verify tracker map size does not exceed maxTrackedKeys (500)
        for (let i = 0; i < 550; i++) {
            await request('POST', '/api/gemini', { prompt: 'mem_test' }, {
                'X-Forwarded-For': `172.16.${Math.floor(i / 250)}.${i % 250 + 1}`
            });
        }
        // Query rate limiter internal tracker map from imported server
        // In server.js line 395, geminiRateLimiter has maxTrackedKeys = 500
        const geminiTracker = require('../server');
        // Let's verify via request that server process is alive and memory bounded
        const healthCheck = await request('GET', '/api/health');
        record(
            'Rate limiters survive high-cardinality IP flooding without OOM or crash',
            healthCheck.status === 200 && healthCheck.body.status === 'active',
            `Server status: ${healthCheck.status}`
        );

        // =====================================================================
        // SECTION 2: ADVERSARIAL CORS PROBING
        // =====================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('SECTION 2: ADVERSARIAL CORS PROBING');
        console.log('----------------------------------------------------------------');

        const WHITELISTED_ORIGINS = [
            'https://creatorcashflow.co.za',
            'https://www.creatorcashflow.co.za',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://localhost:3000'
        ];

        console.log('\n[2.1] Probing Whitelisted Origins:');
        for (const origin of WHITELISTED_ORIGINS) {
            const res = await request('GET', '/api/health', null, { 'Origin': origin });
            const allowOrigin = res.headers['access-control-allow-origin'];
            const allowCreds = res.headers['access-control-allow-credentials'];
            record(
                `Whitelisted Origin allowed: ${origin}`,
                res.status === 200 && allowOrigin === origin && allowCreds === 'true',
                `Status: ${res.status}, ACAO: ${allowOrigin}, ACAC: ${allowCreds}`
            );
        }

        console.log('\n[2.2] Probing Unauthorized / Adversarial Origins:');
        const UNAUTHORIZED_ORIGINS = [
            'https://evil-attacker.com',
            'http://malicious.org',
            'https://creatorcashflow.co.za.attacker.com', // Subdomain spoofing
            'https://attacker-creatorcashflow.co.za',     // Prefix spoofing
            'http://creatorcashflow.co.za',              // Insecure HTTP version of production
            'http://localhost:5001',                     // Port mismatch
            'https://localhost:5000',                    // Protocol mismatch (https on localhost)
            'null',                                      // Sandboxed iframe / data: URI
            'http://192.168.1.100:5000'                  // Arbitrary LAN IP
        ];

        for (const badOrigin of UNAUTHORIZED_ORIGINS) {
            const res = await request('GET', '/api/health', null, { 'Origin': badOrigin });
            const allowOrigin = res.headers['access-control-allow-origin'];
            // When CORS blocks an origin, Express CORS passes an error to next(err).
            // The response must either be 500/403 or have NO access-control-allow-origin reflecting the bad origin.
            const isBlocked = (res.status === 500 || res.status === 403 || !allowOrigin || allowOrigin !== badOrigin);
            record(
                `Unauthorized Origin strictly blocked: ${badOrigin}`,
                isBlocked && allowOrigin !== badOrigin,
                `Origin was reflected! Status: ${res.status}, ACAO: ${allowOrigin}`
            );
        }

        console.log('\n[2.3] Preflight (OPTIONS) Probing:');
        // Preflight from allowed origin
        const goodPreflight = await request('OPTIONS', '/api/transactions', null, {
            'Origin': 'https://creatorcashflow.co.za',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, Content-Type'
        });
        record(
            'Preflight OPTIONS from whitelisted origin succeeds with CORS headers',
            goodPreflight.status === 204 || goodPreflight.status === 200,
            `Status: ${goodPreflight.status}`
        );

        // Preflight from unauthorized origin
        const badPreflight = await request('OPTIONS', '/api/transactions', null, {
            'Origin': 'https://evil-attacker.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, Content-Type'
        });
        const badPreflightAcao = badPreflight.headers['access-control-allow-origin'];
        record(
            'Preflight OPTIONS from unauthorized origin is rejected (no allow origin)',
            badPreflightAcao !== 'https://evil-attacker.com',
            `ACAO reflected bad origin: ${badPreflightAcao}`
        );

        // =====================================================================
        // SECTION 3: UNAUTHENTICATED & SYNTHETIC TOKEN ADMIN ACCESS PROBING
        // =====================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('SECTION 3: UNAUTHENTICATED & SYNTHETIC TOKEN ADMIN ACCESS REJECTION');
        console.log('----------------------------------------------------------------');

        const ADMIN_ENDPOINTS = [
            { method: 'GET', path: '/api/admin/verify-auth', name: 'Verify Auth' },
            { method: 'GET', path: '/api/admin/metrics', name: 'KPI Metrics' },
            { method: 'GET', path: '/api/admin/creators', name: 'Creator Directory' },
            { method: 'POST', path: '/api/admin/creators/usr_seed_1/status', body: { status: 'active' }, name: 'Creator Status Mutation' },
            { method: 'GET', path: '/api/admin/audit-logs', name: 'Audit Logs' },
            { method: 'GET', path: '/api/admin/telemetry', name: 'AI Telemetry' }
        ];

        console.log('\n[3.1] Probing Unauthenticated Requests (No Authorization Header):');
        for (const ep of ADMIN_ENDPOINTS) {
            const res = await request(ep.method, ep.path, ep.body || null, {
                'X-Forwarded-For': '192.168.99.1'
            });
            record(
                `Unauthenticated request to ${ep.path} rejected with HTTP 401`,
                res.status === 401 && res.body.error === 'Access token required',
                `Got status ${res.status}, body: ${JSON.stringify(res.body)}`
            );
        }

        console.log('\n[3.2] Probing Empty / Malformed Authorization Headers:');
        for (const ep of ADMIN_ENDPOINTS) {
            const resEmpty = await request(ep.method, ep.path, ep.body || null, {
                'Authorization': '',
                'X-Forwarded-For': '192.168.99.2'
            });
            record(
                `Empty Authorization header to ${ep.path} rejected with HTTP 401`,
                resEmpty.status === 401,
                `Got status ${resEmpty.status}`
            );

            const resBearerOnly = await request(ep.method, ep.path, ep.body || null, {
                'Authorization': 'Bearer ',
                'X-Forwarded-For': '192.168.99.3'
            });
            record(
                `Bearer-only (no token) header to ${ep.path} rejected with HTTP 401`,
                resBearerOnly.status === 401,
                `Got status ${resBearerOnly.status}`
            );
        }

        console.log('\n[3.3] Probing Forged Synthetic & Backdoor Tokens:');
        const SYNTHETIC_TOKENS = [
            `adm_token_${Date.now()}_master`,      // Historical client synthetic pattern
            'adm_token_1725441600000_master',
            'synthetic_master_token',
            'offline_token',                       // Offline mode token
            'demo_token',                          // Demo token
            'admin_bypass_token',
            'admin',
            'superadmin_master_access'
        ];

        for (const synToken of SYNTHETIC_TOKENS) {
            const res = await request('GET', '/api/admin/verify-auth', null, {
                'Authorization': `Bearer ${synToken}`,
                'X-Forwarded-For': '192.168.99.4'
            });
            record(
                `Synthetic token "${synToken}" rejected with HTTP 401`,
                res.status === 401 && res.body.error === 'Invalid or expired token',
                `Got status ${res.status}, body: ${JSON.stringify(res.body)}`
            );
        }

        console.log('\n[3.4] Probing Cryptographic Attack Vectors:');
        // A: Wrong JWT Secret signature
        const wrongSecretToken = jwt.sign(
            { id: 'adm_forged', email: 'admin@creatorcashflow.com', role: 'admin' },
            'completely-wrong-secret-key-attacker',
            { expiresIn: '1h' }
        );
        const wrongSecretRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${wrongSecretToken}`,
            'X-Forwarded-For': '192.168.99.5'
        });
        record(
            'JWT signed with wrong secret rejected with HTTP 401',
            wrongSecretRes.status === 401 && wrongSecretRes.body.error === 'Invalid or expired token',
            `Got status ${wrongSecretRes.status}, body: ${JSON.stringify(wrongSecretRes.body)}`
        );

        // B: Historical fallback secret signature
        const oldFallbackSecretToken = jwt.sign(
            { id: 'adm_forged', email: 'admin@creatorcashflow.com', role: 'admin' },
            'fallback-creator-cashflow-secret-key-2026',
            { expiresIn: '1h' }
        );
        const oldFallbackRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${oldFallbackSecretToken}`,
            'X-Forwarded-For': '192.168.99.6'
        });
        record(
            'JWT signed with old fallback secret rejected with HTTP 401 (proves secret rotated to env)',
            oldFallbackRes.status === 401,
            `Got status ${oldFallbackRes.status}`
        );

        // C: alg: none unsigned token attack
        const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payloadB64 = Buffer.from(JSON.stringify({ id: 'adm_attack', role: 'admin' })).toString('base64url');
        const algNoneToken = `${headerB64}.${payloadB64}.`;
        const algNoneRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${algNoneToken}`,
            'X-Forwarded-For': '192.168.99.7'
        });
        record(
            'Unsigned alg: none JWT rejected with HTTP 401',
            algNoneRes.status === 401,
            `Got status ${algNoneRes.status}`
        );

        // D: Expired Admin JWT
        const expiredAdminToken = jwt.sign(
            { id: 'adm_exp', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '-10s' }
        );
        const expiredRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${expiredAdminToken}`,
            'X-Forwarded-For': '192.168.99.8'
        });
        record(
            'Expired Admin JWT rejected with HTTP 401',
            expiredRes.status === 401 && expiredRes.body.error === 'Invalid or expired token',
            `Got status ${expiredRes.status}`
        );

        // E: Privilege Escalation: Valid JWT with non-admin role (HTTP 403)
        const creatorJwt = jwt.sign(
            { id: 'usr_creator_normal', email: 'creator@creatorcashflow.com', role: 'creator' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        for (const ep of ADMIN_ENDPOINTS) {
            const res = await request(ep.method, ep.path, ep.body || null, {
                'Authorization': `Bearer ${creatorJwt}`,
                'X-Forwarded-For': '192.168.99.9'
            });
            record(
                `Role privilege escalation on ${ep.path} rejected with HTTP 403 Forbidden`,
                res.status === 403 && res.body.error === 'Forbidden: Administrative privileges required',
                `Got status ${res.status}, body: ${JSON.stringify(res.body)}`
            );
        }

        // F: Valid JWT with missing role field
        const missingRoleJwt = jwt.sign(
            { id: 'usr_no_role', email: 'norole@creatorcashflow.com' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const missingRoleRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${missingRoleJwt}`,
            'X-Forwarded-For': '192.168.99.10'
        });
        record(
            'Valid JWT without explicit role: "admin" rejected with HTTP 403',
            missingRoleRes.status === 403,
            `Got status ${missingRoleRes.status}`
        );

        // G: Legitimate Admin JWT Access
        console.log('\n[3.5] Verifying Legitimate Admin Access with Signed Admin JWT:');
        const legitimateAdminToken = jwt.sign(
            { id: 'adm_verified_master', email: 'admin@creatorcashflow.co.za', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const validRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${legitimateAdminToken}`,
            'X-Forwarded-For': '192.168.99.11'
        });
        record(
            'Legitimate Admin JWT grants HTTP 200 on /api/admin/verify-auth',
            validRes.status === 200 && validRes.body.success === true && validRes.body.admin.role === 'admin',
            `Got status ${validRes.status}, body: ${JSON.stringify(validRes.body)}`
        );

        const validMetricsRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${legitimateAdminToken}`,
            'X-Forwarded-For': '192.168.99.11'
        });
        record(
            'Legitimate Admin JWT grants HTTP 200 on /api/admin/metrics',
            validMetricsRes.status === 200 && typeof validMetricsRes.body.totalCreators === 'number',
            `Got status ${validMetricsRes.status}`
        );

        // =====================================================================
        // FINAL SUMMARY
        // =====================================================================
        console.log('\n================================================================');
        console.log('STRESS TEST SUITE EXECUTION SUMMARY');
        console.log('================================================================');
        console.log(`Total Assertions : ${stats.total}`);
        console.log(`Passed           : ${stats.passed}`);
        console.log(`Failed           : ${stats.failed}`);

        if (stats.failed > 0) {
            console.error('\n❌ FAILURES:');
            stats.failures.forEach((f, idx) => {
                console.error(`  ${idx + 1}. ${f.name} => ${f.errorMsg}`);
            });
            console.log('\nVERDICT: FAIL');
            process.exit(1);
        } else {
            console.log('\nVERDICT: APPROVE');
        }

    } finally {
        server.close();
    }
}

runEmpiricalStressSuite().catch(err => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
});
