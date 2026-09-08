/**
 * tests/adversarial_reverify_m1.js
 * Comprehensive Adversarial Verification Harness for Challenger Re-verifier M1 Iteration 2
 *
 * Focus Areas:
 * 1. Deep Reverse-Proxy IP Resolution & Isolation under X-Forwarded-For
 * 2. Strict CORS 403 Error Handling & 500/Stack-Trace Prevention
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET, getClientIp } = require('../server');

let server;
let baseUrl;

function httpRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
        const reqHeaders = { ...headers };
        if (body && !reqHeaders['Content-Type']) {
            reqHeaders['Content-Type'] = 'application/json';
        }
        if (postData && !reqHeaders['Content-Length']) {
            reqHeaders['Content-Length'] = Buffer.byteLength(postData);
        }

        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: reqHeaders
        };

        const req = http.request(options, (res) => {
            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(rawData);
                } catch (e) {
                    parsed = rawData;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    raw: rawData
                });
            });
        });

        req.on('error', reject);
        if (postData) {
            req.write(postData);
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

function check(name, condition, details = '') {
    stats.total++;
    if (condition) {
        stats.passed++;
        console.log(`  [PASS] ${name}`);
    } else {
        stats.failed++;
        stats.failures.push({ name, details });
        console.error(`  [FAIL] ${name} => ${details}`);
    }
}

async function runAdversarialReverify() {
    console.log('================================================================');
    console.log('CHALLENGER RE-VERIFIER: ADVERSARIAL VERIFICATION HARNESS (M1)');
    console.log('================================================================\n');

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            console.log(`Server bound at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ---------------------------------------------------------------------
        // PART 1: REVERSE PROXY IP RESOLUTION & RATE-LIMIT ISOLATION
        // ---------------------------------------------------------------------
        console.log('----------------------------------------------------------------');
        console.log('PART 1: REVERSE PROXY IP RESOLUTION & RATE LIMITER ISOLATION');
        console.log('----------------------------------------------------------------');

        // Test 1.1: getClientIp helper unit tests
        console.log('\n[1.1] Unit testing getClientIp resolution logic:');
        const mockReq1 = { headers: { 'x-forwarded-for': '203.0.113.195' }, ip: '127.0.0.1' };
        check('Simple single IP in X-Forwarded-For extracted', getClientIp(mockReq1) === '203.0.113.195', `Got ${getClientIp(mockReq1)}`);

        const mockReq2 = { headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' }, ip: '127.0.0.1' };
        check('Multi-proxy chain in X-Forwarded-For extracts first client IP', getClientIp(mockReq2) === '203.0.113.195', `Got ${getClientIp(mockReq2)}`);

        const mockReq3 = { headers: { 'x-forwarded-for': '  198.51.100.42  , 10.0.0.1' }, ip: '127.0.0.1' };
        check('Whitespace padded X-Forwarded-For is properly trimmed', getClientIp(mockReq3) === '198.51.100.42', `Got ${getClientIp(mockReq3)}`);

        const mockReq4 = { headers: { 'x-forwarded-for': ['198.51.100.77', '10.0.0.1'] }, ip: '127.0.0.1' };
        check('Array format X-Forwarded-For handled gracefully', getClientIp(mockReq4) === '198.51.100.77', `Got ${getClientIp(mockReq4)}`);

        const mockReq5 = { headers: { 'x-forwarded-for': '' }, ip: '10.0.0.5' };
        check('Empty X-Forwarded-For falls back to req.ip', getClientIp(mockReq5) === '10.0.0.5', `Got ${getClientIp(mockReq5)}`);

        const mockReq6 = { headers: {}, ip: '10.0.0.6' };
        check('Missing X-Forwarded-For falls back to req.ip', getClientIp(mockReq6) === '10.0.0.6', `Got ${getClientIp(mockReq6)}`);

        // Test 1.2: End-to-End Live HTTP Burst Lockout & Isolation on /api/auth/login
        console.log('\n[1.2] Live HTTP Rate Limiting & Isolation on /api/auth/login:');
        const ipVictim = '198.51.100.101';
        const ipInnocent1 = '198.51.100.102';
        const ipInnocent2 = '198.51.100.103, 10.0.0.1';

        // Send 10 failed logins from ipVictim
        for (let i = 1; i <= 10; i++) {
            const res = await httpRequest('POST', '/api/auth/login', {
                email: 'victim@creatorcashflow.com',
                password: 'WrongPassword!'
            }, {
                'X-Forwarded-For': ipVictim
            });
            check(`Request #${i} from Victim IP allowed (HTTP 401)`, res.status === 401, `Status: ${res.status}`);
        }

        // 11th request from ipVictim MUST be rate limited (429)
        const victim11 = await httpRequest('POST', '/api/auth/login', {
            email: 'victim@creatorcashflow.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': ipVictim
        });
        check('Victim IP receives HTTP 429 on 11th request', victim11.status === 429 && victim11.body.error === 'Too many requests', `Status: ${victim11.status}, body: ${JSON.stringify(victim11.body)}`);

        // Request from Innocent IP 1 MUST NOT be rate limited
        const innocentRes1 = await httpRequest('POST', '/api/auth/login', {
            email: 'innocent1@creatorcashflow.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': ipInnocent1
        });
        check('Innocent IP 1 is NOT blocked by victim rate limit (HTTP 401)', innocentRes1.status === 401, `Status: ${innocentRes1.status}`);

        // Request from Innocent IP 2 with proxy chain MUST NOT be rate limited
        const innocentRes2 = await httpRequest('POST', '/api/auth/login', {
            email: 'innocent2@creatorcashflow.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': ipInnocent2
        });
        check('Innocent IP 2 (multi-proxy chain) is NOT blocked (HTTP 401)', innocentRes2.status === 401, `Status: ${innocentRes2.status}`);

        // Test 1.3: End-to-End Live HTTP Admin Login Rate Limiting & Isolation
        console.log('\n[1.3] Live HTTP Admin Login Rate Limiting & Isolation on /api/admin/auth/login:');
        const adminVictimIp = '192.0.2.10';
        const adminInnocentIp = '192.0.2.20';

        // 5 failed admin logins from adminVictimIp
        for (let i = 1; i <= 5; i++) {
            const res = await httpRequest('POST', '/api/admin/auth/login', {
                email: 'admin@creatorcashflow.com',
                password: 'WrongPassword!'
            }, {
                'X-Forwarded-For': adminVictimIp
            });
            check(`Admin login #${i} from Victim IP allowed (HTTP 401)`, res.status === 401, `Status: ${res.status}`);
        }

        // 6th admin login from adminVictimIp MUST be rate limited (429)
        const adminVictim6 = await httpRequest('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': adminVictimIp
        });
        check('Admin Victim IP receives HTTP 429 on 6th attempt', adminVictim6.status === 429 && adminVictim6.body.error === 'Too many login attempts', `Status: ${adminVictim6.status}, body: ${JSON.stringify(adminVictim6.body)}`);

        // Innocent IP attempting admin login MUST NOT be locked out
        const adminInnocentRes = await httpRequest('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': adminInnocentIp
        });
        check('Admin Innocent IP is NOT blocked by admin lockout (HTTP 401)', adminInnocentRes.status === 401, `Status: ${adminInnocentRes.status}`);


        // ---------------------------------------------------------------------
        // PART 2: CORS 403 ERROR HANDLING & 500/STACK TRACE PREVENTIONS
        // ---------------------------------------------------------------------
        console.log('\n----------------------------------------------------------------');
        console.log('PART 2: CORS 403 ERROR HANDLING & CLEAN ENVELOPE VERIFICATION');
        console.log('----------------------------------------------------------------');

        const TEST_UNAUTHORIZED_ORIGINS = [
            'https://evil-attacker.com',
            'http://malicious.org',
            'https://creatorcashflow.co.za.evil.com',
            'https://attacker-creatorcashflow.co.za',
            'http://localhost:8080',
            'http://192.168.1.50:5000',
            'null'
        ];

        const TARGET_ROUTES = [
            { method: 'GET', path: '/api/health' },
            { method: 'POST', path: '/api/auth/login', body: { email: 'cors_probe@test.com', password: 'test' } },
            { method: 'GET', path: '/api/transactions' },
            { method: 'POST', path: '/api/gemini', body: { prompt: 'test' } },
            { method: 'GET', path: '/api/admin/metrics' }
        ];

        for (const origin of TEST_UNAUTHORIZED_ORIGINS) {
            console.log(`\nProbing unauthorized origin: ${origin}`);
            for (const route of TARGET_ROUTES) {
                const res = await httpRequest(route.method, route.path, route.body || null, {
                    'Origin': origin
                });

                // Must return HTTP 403 Forbidden
                check(
                    `${route.method} ${route.path} returns HTTP 403 for origin ${origin}`,
                    res.status === 403,
                    `Expected 403, got ${res.status}`
                );

                // Body must be valid JSON matching { error: "Blocked by CORS policy" }
                const isExpectedJson = res.body && typeof res.body === 'object' && res.body.error === 'Blocked by CORS policy';
                check(
                    `${route.method} ${route.path} returns exact JSON envelope { error: 'Blocked by CORS policy' }`,
                    isExpectedJson,
                    `Body was: ${JSON.stringify(res.body)}`
                );

                // Response must NEVER contain stack trace, HTML error, or 500
                const containsStackTrace = typeof res.raw === 'string' && (
                    res.raw.includes('Error: Blocked by CORS policy') && res.raw.includes('at ') ||
                    res.raw.includes('<!DOCTYPE html>') ||
                    res.raw.includes('<pre>')
                );
                check(
                    `${route.method} ${route.path} contains NO stack trace or HTML error dump`,
                    !containsStackTrace,
                    `Raw response contained potential stack trace: ${res.raw.substring(0, 150)}`
                );

                // Access-Control-Allow-Origin must NOT reflect the attacker origin
                const acao = res.headers['access-control-allow-origin'];
                check(
                    `${route.method} ${route.path} does NOT reflect attacker origin in ACAO`,
                    acao !== origin,
                    `ACAO header was reflected: ${acao}`
                );
            }
        }

        // Test 2.2: Preflight (OPTIONS) with unauthorized origin
        console.log('\n[2.2] Preflight (OPTIONS) with unauthorized origin:');
        const badPreflight = await httpRequest('OPTIONS', '/api/transactions', null, {
            'Origin': 'https://evil-attacker.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, Authorization'
        });

        check(
            'Preflight OPTIONS from unauthorized origin returns HTTP 403 or blocks without reflecting origin',
            badPreflight.status === 403 && badPreflight.body?.error === 'Blocked by CORS policy',
            `Status: ${badPreflight.status}, body: ${JSON.stringify(badPreflight.body)}`
        );
        check(
            'Preflight OPTIONS does not reflect unauthorized origin in ACAO header',
            badPreflight.headers['access-control-allow-origin'] !== 'https://evil-attacker.com',
            `ACAO was: ${badPreflight.headers['access-control-allow-origin']}`
        );

        // Test 2.3: Whitelisted origin still succeeds cleanly
        console.log('\n[2.3] Whitelisted origin verification:');
        const goodOriginRes = await httpRequest('GET', '/api/health', null, {
            'Origin': 'https://creatorcashflow.co.za'
        });
        check('Whitelisted origin receives HTTP 200', goodOriginRes.status === 200, `Status: ${goodOriginRes.status}`);
        check('Whitelisted origin has matching Access-Control-Allow-Origin', goodOriginRes.headers['access-control-allow-origin'] === 'https://creatorcashflow.co.za', `ACAO: ${goodOriginRes.headers['access-control-allow-origin']}`);
        check('Whitelisted origin has Access-Control-Allow-Credentials: true', goodOriginRes.headers['access-control-allow-credentials'] === 'true', `ACAC: ${goodOriginRes.headers['access-control-allow-credentials']}`);

        // ---------------------------------------------------------------------
        // FINAL SUMMARY
        // ---------------------------------------------------------------------
        console.log('\n================================================================');
        console.log('ADVERSARIAL RE-VERIFICATION SUMMARY');
        console.log('================================================================');
        console.log(`Total Checks : ${stats.total}`);
        console.log(`Passed       : ${stats.passed}`);
        console.log(`Failed       : ${stats.failed}`);

        if (stats.failed > 0) {
            console.error('\n❌ DETECTED DEFECTS:');
            stats.failures.forEach((f, idx) => {
                console.error(`  ${idx + 1}. ${f.name}: ${f.details}`);
            });
            console.log('\nVERDICT: FAIL');
            process.exit(1);
        } else {
            console.log('\n🏆 VERDICT: APPROVE');
        }
    } finally {
        server.close();
    }
}

runAdversarialReverify().catch(err => {
    console.error('Fatal error running adversarial test:', err);
    process.exit(1);
});
