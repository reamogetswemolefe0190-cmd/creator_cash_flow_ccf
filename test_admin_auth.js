/**
 * test_admin_auth.js
 * Comprehensive automated unit test suite for Milestone M1 (Backend Auth Core & Security)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET } = require('./server');

let testServer;
let baseUrl;

// Utility for making HTTP requests to the test server
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

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTests() {
    console.log('====================================================');
    console.log('🧪 Running M1 Backend Auth Core & Security Tests');
    console.log('====================================================\n');

    // Start HTTP server on dynamic port
    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ----------------------------------------------------
        // TEST 1: Default Admin Seeding Verification
        // ----------------------------------------------------
        console.log('1. Default Admin Seeding Verification');
        const seededAdmin = memoryDb.adminUsers.find(a => a.email === 'admin@creatorcashflow.com');
        assert(!!seededAdmin, 'Default admin user (admin@creatorcashflow.com) exists in memoryDb.adminUsers');
        assert(seededAdmin?.role === 'admin', 'Default admin has role "admin"');
        console.log('');

        // ----------------------------------------------------
        // TEST 2: Successful Admin Login (POST /api/admin/auth/login)
        // ----------------------------------------------------
        console.log('2. Successful Admin Login');
        const loginRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'AdminPass2026!'
        });
        assert(loginRes.status === 200, `Expected HTTP 200, got HTTP ${loginRes.status}`);
        assert(loginRes.body.success === true, 'Response contains success: true');
        assert(typeof loginRes.body.token === 'string' && loginRes.body.token.length > 0, 'Response contains signed JWT token');
        assert(loginRes.body.admin?.email === 'admin@creatorcashflow.com', 'Admin email matches admin@creatorcashflow.com');
        assert(loginRes.body.admin?.role === 'admin', 'Admin role in payload is "admin"');

        // Verify JWT token payload
        const adminToken = loginRes.body.token;
        const decodedToken = jwt.verify(adminToken, JWT_SECRET);
        assert(decodedToken.role === 'admin', 'Signed JWT token contains explicit role: "admin"');
        assert(decodedToken.email === 'admin@creatorcashflow.com', 'Signed JWT token contains correct email');
        console.log('');

        // ----------------------------------------------------
        // TEST 3: Invalid Admin Login Credentials
        // ----------------------------------------------------
        console.log('3. Invalid Admin Login Handling');
        const invalidPassRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'WrongPassword123'
        });
        assert(invalidPassRes.status === 401, `Invalid password returns HTTP 401 (got ${invalidPassRes.status})`);
        assert(invalidPassRes.body.error === 'Invalid credentials', 'Invalid password returns "Invalid credentials" error');

        const unknownUserRes = await request('POST', '/api/admin/auth/login', {
            email: 'nonexistent@creatorcashflow.com',
            password: 'AdminPass2026!'
        });
        assert(unknownUserRes.status === 401, `Nonexistent user returns HTTP 401 (got ${unknownUserRes.status})`);
        assert(unknownUserRes.body.error === 'Invalid credentials', 'Nonexistent user returns "Invalid credentials" error');

        const missingFieldsRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com'
        });
        assert(missingFieldsRes.status === 400, `Missing password returns HTTP 400 (got ${missingFieldsRes.status})`);
        console.log('');

        // ----------------------------------------------------
        // TEST 4: requireAdmin Middleware (HTTP 401 Missing/Invalid Token)
        // ----------------------------------------------------
        console.log('4. requireAdmin Middleware Rejection (HTTP 401)');
        const noAuthRes = await request('GET', '/api/admin/verify-auth');
        assert(noAuthRes.status === 401, `Missing Authorization header returns HTTP 401 (got ${noAuthRes.status})`);
        assert(noAuthRes.body.error === 'Access token required', 'Missing header returns "Access token required"');

        const invalidTokenRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': 'Bearer invalid.jwt.token.string'
        });
        assert(invalidTokenRes.status === 401, `Invalid JWT token returns HTTP 401 (got ${invalidTokenRes.status})`);
        assert(invalidTokenRes.body.error === 'Invalid or expired token', 'Invalid token returns "Invalid or expired token"');
        console.log('');

        // ----------------------------------------------------
        // TEST 5: requireAdmin Middleware Rejection (HTTP 403 Non-Admin Token)
        // ----------------------------------------------------
        console.log('5. requireAdmin Middleware Rejection for Non-Admin Role (HTTP 403)');
        const creatorToken = jwt.sign(
            { id: 'usr_creator_123', email: 'creator@creatorcashflow.com', role: 'creator' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const forbiddenRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${creatorToken}`
        });
        assert(forbiddenRes.status === 403, `Non-admin role (creator) returns HTTP 403 (got ${forbiddenRes.status})`);
        assert(forbiddenRes.body.error === 'Forbidden: Administrative privileges required', 'Returns administrative privileges required error');

        const noRoleToken = jwt.sign(
            { id: 'usr_creator_456', email: 'user@creatorcashflow.com' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const noRoleRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${noRoleToken}`
        });
        assert(noRoleRes.status === 403, `Token without role property returns HTTP 403 (got ${noRoleRes.status})`);
        console.log('');

        // ----------------------------------------------------
        // TEST 6: Valid Admin Access via requireAdmin
        // ----------------------------------------------------
        console.log('6. Valid Admin Access via requireAdmin');
        const validAdminRes = await request('GET', '/api/admin/verify-auth', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        assert(validAdminRes.status === 200, `Valid admin token returns HTTP 200 (got ${validAdminRes.status})`);
        assert(validAdminRes.body.success === true, 'Response contains success: true');
        assert(validAdminRes.body.admin?.role === 'admin', 'Decoded admin object attached to request with role: "admin"');
        console.log('');

        // ----------------------------------------------------
        // TEST 7: Rate Limiting / Brute-Force Protection (HTTP 429)
        // ----------------------------------------------------
        console.log('7. Rate Limiting Brute-Force Protection (HTTP 429)');
        // Clear previous rate limit tracking for clean isolation
        adminLoginAttempts.clear();

        // Send 5 login requests (hitting max limit threshold)
        for (let i = 1; i <= 5; i++) {
            const res = await request('POST', '/api/admin/auth/login', {
                email: 'admin@creatorcashflow.com',
                password: 'WrongPassword'
            });
            assert(res.status === 401, `Attempt ${i}/5 allowed (HTTP 401)`);
        }

        // 6th login request from the same IP must be rate limited (HTTP 429)
        const rateLimitedRes = await request('POST', '/api/admin/auth/login', {
            email: 'admin@creatorcashflow.com',
            password: 'AdminPass2026!'
        });
        assert(rateLimitedRes.status === 429, `6th login attempt returned HTTP 429 (got ${rateLimitedRes.status})`);
        assert(rateLimitedRes.body.error === 'Too many login attempts', 'Rate limited response contains "Too many login attempts" error');
        console.log('');

        console.log('====================================================');
        console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} assertions passed successfully!`);
        console.log('====================================================');

    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        if (testServer) {
            testServer.close();
        }
    }
}

runTests();
