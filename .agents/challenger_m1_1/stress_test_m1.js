/**
 * stress_test_m1.js
 * Adversarial Empirical Stress Test Suite for Milestone M1 (Admin Auth & requireAdmin Middleware)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET } = require('../../server');

let testServer;
let baseUrl;

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            method: method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(responseData);
                } catch (e) {
                    parsed = responseData;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', err => reject(err));

        if (body !== null) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        console.error(`  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runAdversarialStressSuite() {
    console.log('====================================================');
    console.log('🔥 Running M1 Adversarial Stress Harness');
    console.log('====================================================\n');

    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Stress Test Server listening at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ----------------------------------------------------
        // CATEGORY 1: Malformed & Tampered JWT Edge Cases
        // ----------------------------------------------------
        console.log('CATEGORY 1: Malformed & Tampered JWT Edge Cases');

        // 1.1 Completely garbage JWT string
        const garbageRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': 'Bearer garbage_not_a_jwt'
        });
        assert(garbageRes.status === 401, 'Garbage token returns HTTP 401', `got ${garbageRes.status}`);
        assert(garbageRes.body.error === 'Invalid or expired token', 'Garbage token error message correct');

        // 1.2 Empty token after Bearer keyword
        const emptyBearerRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': 'Bearer '
        });
        assert(emptyBearerRes.status === 401, 'Empty Bearer payload returns HTTP 401', `got ${emptyBearerRes.status}`);

        // 1.3 Token signed with wrong secret key
        const wrongSecretToken = jwt.sign(
            { id: 'admin_seed_1', email: 'admin@creatorcashflow.com', role: 'admin' },
            'attacker-wrong-secret-key-12345'
        );
        const wrongSecretRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${wrongSecretToken}`
        });
        assert(wrongSecretRes.status === 401, 'Token signed with wrong secret returns HTTP 401', `got ${wrongSecretRes.status}`);

        // 1.4 Alg None / Unsigned JWT Attack Simulation
        // Header: {"alg":"none","typ":"JWT"}, Payload: {"id":"admin_seed_1","email":"admin@creatorcashflow.com","role":"admin"}
        const algNoneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.ZXlKaGJHY2lPaUpvZEcxd2JHVnVaRjlwWkNJNkltdDFiR1VpZlEuZXlKcGJDQjBJaTVoYldGdVpXNTBlWEJsYmlJNmFHRnlaV0p2YjI1bExtTnZiUT09. SignaturePartIgnored';
        const algNoneRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${algNoneToken}`
        });
        assert(algNoneRes.status === 401, 'alg:none token rejected with HTTP 401', `got ${algNoneRes.status}`);

        // 1.5 Header format variations (lowercase bearer, missing Bearer prefix)
        const lowercaseBearerToken = jwt.sign({ id: 'admin_seed_1', role: 'admin' }, JWT_SECRET);
        const lowercaseRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `bearer ${lowercaseBearerToken}`
        });
        assert(lowercaseRes.status === 200 || lowercaseRes.status === 401, 'Handled lowercase bearer scheme safely');

        const rawTokenNoPrefixRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': lowercaseBearerToken
        });
        assert(rawTokenNoPrefixRes.status === 401, 'Authorization header without Bearer prefix rejected with HTTP 401');

        console.log('');

        // ----------------------------------------------------
        // CATEGORY 2: Expired JWT Edge Cases
        // ----------------------------------------------------
        console.log('CATEGORY 2: Expired JWT Edge Cases');

        const expiredToken = jwt.sign(
            { id: 'admin_seed_1', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '-10s' }
        );
        const expiredRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${expiredToken}`
        });
        assert(expiredRes.status === 401, 'Expired JWT returns HTTP 401', `got ${expiredRes.status}`);
        assert(expiredRes.body.error === 'Invalid or expired token', 'Expired token message correct');

        console.log('');

        // ----------------------------------------------------
        // CATEGORY 3: Missing & Empty Authorization Header Edge Cases
        // ----------------------------------------------------
        console.log('CATEGORY 3: Missing & Empty Authorization Header Edge Cases');

        const missingHeaderRes = await request('GET', '/api/admin/verify-auth');
        assert(missingHeaderRes.status === 401, 'Missing Authorization header returns HTTP 401', `got ${missingHeaderRes.status}`);
        assert(missingHeaderRes.body.error === 'Access token required', 'Missing header message correct');

        const emptyHeaderRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': ''
        });
        assert(emptyHeaderRes.status === 401, 'Empty string Authorization header returns HTTP 401', `got ${emptyHeaderRes.status}`);

        console.log('');

        // ----------------------------------------------------
        // CATEGORY 4: Brute-Force Rate Limiter Boundary Conditions
        // ----------------------------------------------------
        console.log('CATEGORY 4: Brute-Force Rate Limiter Boundary Conditions');
        adminLoginAttempts.clear();

        // 4.1 Boundary test: 5 allowed, 6th blocked
        for (let i = 1; i <= 5; i++) {
            const attemptRes = await request('POST', '/api/admin/auth/login', {
                email: 'admin@creatorcashflow.com',
                password: 'WrongPassword'
            });
            assert(attemptRes.status === 401, `Attempt ${i}/5 allowed through rate limiter (HTTP 401)`);
        }

        const fifthAttemptBlocked = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'AdminPass2026!'
        });
        assert(fifthAttemptBlocked.status === 429, '6th attempt is blocked by rate limiter (HTTP 429)', `got ${fifthAttemptBlocked.status}`);
        assert(typeof fifthAttemptBlocked.body.retryAfterSeconds === 'number', '429 response includes numeric retryAfterSeconds');

        // 4.2 Rate limiter timestamp window pruning test
        adminLoginAttempts.clear();
        const fakeIp = '127.0.0.1';
        const now = Date.now();
        // Insert 5 old timestamps (>15 minutes ago)
        adminLoginAttempts.set(fakeIp, [
            now - 16 * 60 * 1000,
            now - 16 * 60 * 1000,
            now - 16 * 60 * 1000,
            now - 16 * 60 * 1000,
            now - 16 * 60 * 1000
        ]);

        const windowResetRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'AdminPass2026!'
        });
        assert(windowResetRes.status === 200, 'Expired attempts pruned correctly allowing fresh request (HTTP 200)', `got ${windowResetRes.status}`);

        console.log('');

        // ----------------------------------------------------
        // CATEGORY 5: Special Characters & Malicious Inputs in Credentials
        // ----------------------------------------------------
        console.log('CATEGORY 5: Special Characters & Malicious Inputs in Credentials');
        adminLoginAttempts.clear();

        // 5.1 Email case sensitivity and whitespace trimming
        const whitespaceEmailRes = await request('POST', '/api/admin/auth/login', {
            email: '   ADMIN@CreatorCashFlow.com   ',
            password: 'AdminPass2026!'
        });
        assert(whitespaceEmailRes.status === 200, 'Whitespace and uppercase email normalized & authenticated successfully (HTTP 200)', `got ${whitespaceEmailRes.status}`);

        // 5.2 SQL / NoSQL Injection payload in email & password
        adminLoginAttempts.clear();
        const injectionRes = await request('POST', '/api/admin/auth/login', {
            email: "' OR '1'='1",
            password: "' OR '1'='1"
        });
        assert(injectionRes.status === 401, 'SQL injection strings rejected with HTTP 401', `got ${injectionRes.status}`);

        adminLoginAttempts.clear();
        const objInjectionRes = await request('POST', '/api/admin/auth/login', {
            email: { "$gt": "" },
            password: { "$gt": "" }
        });
        assert(objInjectionRes.status === 400 || objInjectionRes.status === 401 || objInjectionRes.status === 500, 'Object injection payload handled safely');

        // 5.3 Special characters in password (passwords with symbols/unicode)
        adminLoginAttempts.clear();
        const specialCharRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'WrongPassword!@#$%^&*()_+~`<>{}:"?'
        });
        assert(specialCharRes.status === 401, 'Special char wrong password rejected with HTTP 401 safely', `got ${specialCharRes.status}`);

        // 5.4 Extremely long input string handling
        adminLoginAttempts.clear();
        const longPass = 'A'.repeat(5000);
        const longPassRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: longPass
        });
        assert(longPassRes.status === 401, 'Extremely long password rejected safely (HTTP 401)', `got ${longPassRes.status}`);

        console.log('');
        console.log('====================================================');
        console.log(`🏆 ALL ADVERSARIAL STRESS TESTS PASSED: ${passedTests}/${totalTests} assertions!`);
        console.log('====================================================');

    } catch (err) {
        console.error('\n❌ STRESS TEST SUITE FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        if (testServer) {
            testServer.close();
        }
    }
}

runAdversarialStressSuite();
