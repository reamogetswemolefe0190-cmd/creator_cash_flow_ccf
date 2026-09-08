/**
 * test_m1_verification.js
 * Independent verification script for Milestone M1 (Security Hardening, PII Sanitization, CORS, Rate Limiting)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { app, JWT_SECRET } = require('./server');

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
                try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log('🔒 VERIFYING MILESTONE M1 SECURITY HARDENING');
    console.log('====================================================\n');

    // 1. PII Scan
    console.log('1. Verifying Zero Occurrences of Developer Email');
    const productionFiles = ['server.js', 'app.js', 'index.html', 'admin.html', 'stress_harness.js', 'package.json'];
    const piiEmail = 'reamogetswemolefe0190@gmail.com';
    for (const f of productionFiles) {
        const fullPath = path.join(__dirname, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(!content.includes(piiEmail), `Found PII in ${f}`);
        console.log(`  ✅ PASS: 0 occurrences of developer PII in ${f}`);
    }
    console.log('');

    // 2. Start server
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });

    try {
        // 3. CORS Whitelist Verification
        console.log('2. Verifying CORS Whitelist Enforcement');
        const allowedOriginRes = await request('GET', '/api/health', null, {
            'Origin': 'https://creatorcashflow.co.za'
        });
        assert.strictEqual(allowedOriginRes.status, 200);
        assert.strictEqual(allowedOriginRes.headers['access-control-allow-origin'], 'https://creatorcashflow.co.za');
        console.log('  ✅ PASS: Allowed origin https://creatorcashflow.co.za receives 200 and CORS headers');

        // Test unlisted origin (Express CORS error handler returns 500 by default or blocks)
        const unlistedOriginRes = await request('GET', '/api/health', null, {
            'Origin': 'https://malicious-site.example.com'
        });
        assert(unlistedOriginRes.status === 500 || !unlistedOriginRes.headers['access-control-allow-origin'] || unlistedOriginRes.status === 403, 'Unlisted origin must be blocked');
        console.log('  ✅ PASS: Unlisted origin is blocked by CORS policy');
        console.log('');

        // 4. Rate Limiter: Auth Route (/api/auth/signup & /api/auth/login)
        console.log('3. Verifying Sliding-Window Rate Limiting across Auth Endpoints');
        const testAuthIp = '192.168.10.10';
        let hit429 = false;
        for (let i = 0; i < 12; i++) {
            const res = await request('POST', '/api/auth/login', {
                email: `test_user_${i}@example.com`,
                password: 'WrongPassword!'
            }, {
                'X-Forwarded-For': testAuthIp
            });
            if (res.status === 429) {
                hit429 = true;
                assert.strictEqual(res.body.error, 'Too many requests');
                assert(res.headers['retry-after'], 'Missing Retry-After header');
                console.log(`  ✅ PASS: Request #${i + 1} triggered HTTP 429 rate-limit response with Retry-After`);
                break;
            }
        }
        assert(hit429, 'Expected HTTP 429 rate limit on rapid auth requests');
        console.log('');

        // 5. Rate Limiter: Gemini Endpoint (/api/gemini)
        console.log('4. Verifying Sliding-Window Rate Limiting on /api/gemini');
        const testGeminiIp = '192.168.20.20';
        hit429 = false;
        for (let i = 0; i < 17; i++) {
            const res = await request('POST', '/api/gemini', {
                prompt: `Test prompt query ${i}`
            }, {
                'X-Forwarded-For': testGeminiIp
            });
            if (res.status === 429) {
                hit429 = true;
                assert.strictEqual(res.body.error, 'Too many requests');
                assert(res.headers['retry-after'], 'Missing Retry-After header');
                console.log(`  ✅ PASS: Gemini query #${i + 1} triggered HTTP 429 rate-limit response`);
                break;
            }
        }
        assert(hit429, 'Expected HTTP 429 rate limit on rapid Gemini requests');
        console.log('');

        // 6. Rate Limiter: Admin Mutation Endpoint (/api/admin/creators/:id/status)
        console.log('5. Verifying Sliding-Window Rate Limiting on Admin Mutation');
        const jwt = require('jsonwebtoken');
        const testAdminToken = jwt.sign(
            { id: 'admin_test_m1', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        hit429 = false;
        for (let i = 0; i < 32; i++) {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', {
                status: 'active'
            }, {
                'Authorization': `Bearer ${testAdminToken}`,
                'X-Forwarded-For': '192.168.30.30'
            });
            if (res.status === 429) {
                hit429 = true;
                assert.strictEqual(res.body.error, 'Too many requests');
                console.log(`  ✅ PASS: Admin mutation #${i + 1} triggered HTTP 429 rate-limit response`);
                break;
            }
        }
        assert(hit429, 'Expected HTTP 429 rate limit on rapid admin mutations');
        console.log('');

        // 7. Rate Limiter: Transactions Endpoint (/api/transactions)
        console.log('6. Verifying Sliding-Window Rate Limiting on /api/transactions');
        const testCreatorToken = jwt.sign(
            { id: 'usr_rate_tx', email: 'creator@test.com' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        hit429 = false;
        for (let i = 0; i < 63; i++) {
            const res = await request('GET', '/api/transactions', null, {
                'Authorization': `Bearer ${testCreatorToken}`,
                'X-Forwarded-For': '192.168.40.40'
            });
            if (res.status === 429) {
                hit429 = true;
                assert.strictEqual(res.body.error, 'Too many requests');
                console.log(`  ✅ PASS: Transaction request #${i + 1} triggered HTTP 429 rate-limit response`);
                break;
            }
        }
        assert(hit429, 'Expected HTTP 429 rate limit on rapid transaction requests');
        console.log('');

        console.log('====================================================');
        console.log('🎉 ALL MILESTONE M1 SECURITY VERIFICATIONS PASSED!');
        console.log('====================================================');
    } finally {
        server.close();
    }
}

runTests().catch(err => {
    console.error('❌ M1 Verification failed:', err);
    process.exit(1);
});
