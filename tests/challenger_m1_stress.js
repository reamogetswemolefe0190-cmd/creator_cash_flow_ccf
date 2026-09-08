/**
 * tests/challenger_m1_stress.js
 * Comprehensive Empirical Stress Test Suite for Milestone M1 Gate
 *
 * Test Sections:
 * 1. Memory & Concurrency Stress (Capacity bounds, TTL eviction, burst concurrency, heap stability, per-IP isolation)
 * 2. PII & Credential Injection (Endpoint scans, error traces, malicious payloads, telemetry masking)
 * 3. Sustained Brute-Force Lockout & Window Reset (Lockout enforcement, sustained attack, clean reset)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { app, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET, maskPII, inferCategoryTag } = require('../server');

let testServer = null;
let baseUrl = '';

// Helper: HTTP Request
function makeRequest(method, reqPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(reqPath, baseUrl);
        const isRaw = typeof body === 'string';
        const postData = body ? (isRaw ? body : JSON.stringify(body)) : null;

        const reqHeaders = { ...headers };
        if (body && !reqHeaders['Content-Type'] && !isRaw) {
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
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    raw: data
                });
            });
        });

        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// Find rate limiters attached to Express routes
function extractRouteLimiters() {
    const limiters = {};
    for (const layer of app._router.stack) {
        if (layer.route) {
            for (const routeLayer of layer.route.stack) {
                if (routeLayer.handle && routeLayer.handle.tracker) {
                    const key = `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`;
                    limiters[key] = routeLayer.handle;
                }
            }
        }
    }
    return limiters;
}

// Assertions & Reporting tracker
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

function record(name, pass, details = '', isWarning = false) {
    if (pass) {
        results.passed++;
        console.log(`  ✅ PASS: ${name}${details ? ' — ' + details : ''}`);
        results.tests.push({ name, status: 'PASS', details });
    } else if (isWarning) {
        results.warnings++;
        console.warn(`  ⚠️ WARN: ${name} — ${details}`);
        results.tests.push({ name, status: 'WARN', details });
    } else {
        results.failed++;
        console.error(`  ❌ FAIL: ${name} — ${details}`);
        results.tests.push({ name, status: 'FAIL', details });
    }
}

async function runChallengerStressSuite() {
    console.log('================================================================');
    console.log('⚔️  CHALLENGER 2: MILESTONE M1 EMPIRICAL STRESS & AUDIT SUITE');
    console.log('================================================================\n');

    // Start ephemeral server
    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Ephemeral Test Server started on ${baseUrl}\n`);
            resolve();
        });
    });

    const routeLimiters = extractRouteLimiters();
    console.log(`Discovered ${Object.keys(routeLimiters).length} sliding-window route limiters.`);

    try {
        // ================================================================
        // SECTION 1: MEMORY & CONCURRENCY STRESS
        // ================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('1. MEMORY & CONCURRENCY STRESS ON RATE LIMITERS');
        console.log('----------------------------------------------------------------');

        // 1.1 adminLoginAttempts Capacity Bound under IP flood
        console.log('\n1.1 Testing adminLoginAttempts memory bound (capacity 200 IPs):');
        const initialAdminMapSize = adminLoginAttempts.size;
        const initialHeap = process.memoryUsage().heapUsed;

        // Flood 1000 simulated IPs into rateLimitAdminLogin
        for (let i = 0; i < 1000; i++) {
            const fakeReq = { ip: `10.200.${Math.floor(i / 250)}.${i % 250}`, headers: {}, socket: {} };
            const fakeRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
            rateLimitAdminLogin(fakeReq, fakeRes, () => {});
        }

        const adminMapSizeAfterFlood = adminLoginAttempts.size;
        record(
            'adminLoginAttempts Map bounded to MAX_TRACKED_IPS (200)',
            adminMapSizeAfterFlood <= 200,
            `Observed size: ${adminMapSizeAfterFlood} (max expected: 200) after 1000 unique simulated IPs`
        );

        // 1.2 SlidingWindowLimiter Capacity Bound under key flood
        console.log('\n1.2 Testing createSlidingWindowLimiter capacity bounds:');
        const authLimiter = routeLimiters['POST /api/auth/login'] || routeLimiters['POST /api/auth/signup, /api/auth/register'];
        if (authLimiter) {
            // Inject 2500 unique keys
            for (let i = 0; i < 2500; i++) {
                const fakeReq = { ip: `172.16.${Math.floor(i / 250)}.${i % 250}`, headers: {}, socket: {} };
                const fakeRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
                authLimiter(fakeReq, fakeRes, () => {});
            }
            const authSizeAfter = authLimiter.tracker.size;
            record(
                'authRateLimiter tracker bounded to maxTrackedKeys (1000)',
                authSizeAfter <= 1000,
                `Observed size: ${authSizeAfter} after 2500 simulated IPs (capacity cap: 1000)`
            );
        } else {
            record('authRateLimiter discovered', false, 'Could not find auth limiter handle');
        }

        // Test transactionRateLimiter
        const txLimiter = routeLimiters['GET /api/transactions'] || routeLimiters['POST /api/transactions'];
        if (txLimiter) {
            for (let i = 0; i < 3000; i++) {
                const fakeReq = { user: { id: `usr_flood_${i}` }, headers: {}, socket: {} };
                const fakeRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
                txLimiter(fakeReq, fakeRes, () => {});
            }
            record(
                'transactionRateLimiter tracker bounded to maxTrackedKeys (2000)',
                txLimiter.tracker.size <= 2000,
                `Observed size: ${txLimiter.tracker.size} after 3000 simulated users (capacity cap: 2000)`
            );
        }

        // Test geminiRateLimiter
        const gemLimiter = routeLimiters['POST /api/gemini'];
        if (gemLimiter) {
            for (let i = 0; i < 1200; i++) {
                const fakeReq = { ip: `198.51.100.${i % 250}_${i}`, headers: {}, socket: {} };
                const fakeRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
                gemLimiter(fakeReq, fakeRes, () => {});
            }
            record(
                'geminiRateLimiter tracker bounded to maxTrackedKeys (500)',
                gemLimiter.tracker.size <= 500,
                `Observed size: ${gemLimiter.tracker.size} after 1200 simulated IPs (capacity cap: 500)`
            );
        }

        // Check Heap stability
        const heapAfterFloods = process.memoryUsage().heapUsed;
        const heapGrowthMb = (heapAfterFloods - initialHeap) / 1024 / 1024;
        record(
            'Memory Heap Stability during 7,700 IP flood operations',
            heapGrowthMb < 50,
            `Heap delta: ${heapGrowthMb.toFixed(2)} MB`
        );

        // 1.3 TTL Eviction & Cleanup Verification
        console.log('\n1.3 Testing TTL eviction & stale entry cleanup:');
        const testTtlIp = '10.99.99.99';
        const pastTime = Date.now() - (16 * 60 * 1000); // 16 minutes ago (expired)
        adminLoginAttempts.set(testTtlIp, [pastTime, pastTime + 1000]);

        const testRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
        rateLimitAdminLogin({ ip: testTtlIp, headers: {}, socket: {} }, testRes, () => {});

        const currentAttempts = adminLoginAttempts.get(testTtlIp);
        record(
            'Expired timestamps evicted during request filtering in adminLoginAttempts',
            currentAttempts && currentAttempts.length === 1 && currentAttempts[0] > Date.now() - 5000,
            `Attempts remaining for IP: ${currentAttempts ? currentAttempts.length : 0}`
        );

        if (authLimiter) {
            const staleKey = '192.168.254.254';
            const staleTime = Date.now() - (20 * 60 * 1000);
            authLimiter.tracker.set(staleKey, [staleTime]);

            let allowed = false;
            authLimiter({ ip: staleKey, headers: {}, socket: {} }, { setHeader: () => {}, status: () => ({ json: () => {} }) }, () => {
                allowed = true;
            });
            const timestamps = authLimiter.tracker.get(staleKey);
            record(
                'SlidingWindowLimiter evicts expired timestamps and permits request',
                allowed && timestamps && timestamps.length === 1 && timestamps[0] > Date.now() - 5000,
                `Stored timestamps count: ${timestamps ? timestamps.length : 0}, allowed: ${allowed}`
            );
        }

        // 1.4 Concurrency Stress Test
        console.log('\n1.4 Testing Concurrency Stress (100 parallel token validation requests):');
        const stressToken = jwt.sign(
            { id: 'admin_stress_test', email: 'admin@creatorcashflow.co.za', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const startTime = Date.now();
        const concurrentPromises = [];
        for (let i = 0; i < 100; i++) {
            concurrentPromises.push(makeRequest('GET', '/api/admin/verify-auth', null, {
                'Authorization': `Bearer ${stressToken}`
            }));
        }

        const stressResults = await Promise.all(concurrentPromises);
        const duration = Date.now() - startTime;
        const successCount = stressResults.filter(r => r.status === 200).length;
        const throughput = (100 / (duration / 1000)).toFixed(2);

        record(
            '100 concurrent admin token validations executed cleanly',
            successCount === 100,
            `100/100 HTTP 200 OK in ${duration}ms (${throughput} req/sec)`
        );

        // 1.5 Real HTTP IP Isolation & Reverse Proxy Header Evaluation
        console.log('\n1.5 Empirical Verification of Real HTTP Request IP Isolation:');
        // Clear auth rate limiter tracker for clean state
        if (authLimiter) authLimiter.reset();

        // Simulate 10 failed login attempts from IP A (203.0.113.1)
        for (let i = 0; i < 10; i++) {
            await makeRequest('POST', '/api/auth/login', {
                email: `victim_${i}@example.com`,
                password: 'WrongPassword!'
            }, {
                'X-Forwarded-For': '203.0.113.1'
            });
        }

        // Request 11 from IP A must be 429
        const resA11 = await makeRequest('POST', '/api/auth/login', {
            email: 'victim_11@example.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': '203.0.113.1'
        });
        const ipABlocked = resA11.status === 429;

        // Now send 1st request from IP B (198.51.100.2 - completely different IP!)
        const resB1 = await makeRequest('POST', '/api/auth/login', {
            email: 'innocent_user@example.com',
            password: 'WrongPassword!'
        }, {
            'X-Forwarded-For': '198.51.100.2'
        });

        // IP B should NOT be rate limited (should be 401 Unauthorized, not 429!)
        const ipIsolated = resB1.status === 401;
        record(
            'Per-IP Rate Limiting Isolation behind Proxies/Load Balancers',
            ipIsolated,
            ipIsolated
                ? 'Distinct X-Forwarded-For IPs are isolated into separate rate buckets'
                : `FAILED: IP B (198.51.100.2) was blocked with HTTP ${resB1.status} due to IP A (203.0.113.1) exhaustion! All proxy users collapse to single IP (${resA11.body?.error || 'Rate limit'}).`
        );

        // ================================================================
        // SECTION 2: PII & CREDENTIAL INJECTION CHECKS
        // ================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('2. PII & CREDENTIAL INJECTION CHECKS ACROSS RUNNING SERVER');
        console.log('----------------------------------------------------------------');

        const forbiddenPatterns = [
            { name: 'Developer personal email', pattern: /reamogetswemolefe0190@gmail\.com/i },
            { name: 'Hardcoded admin password', pattern: /R3@m0g3tsw3M0l3f3/ },
            { name: 'Mock password backdoor (AdminPass2026!)', pattern: /AdminPass2026!/ },
            { name: 'Mock password backdoor (CreatorPass2026!)', pattern: /CreatorPass2026!/ },
            { name: 'Fallback JWT secret', pattern: /fallback-creator-cashflow-secret-key-2026/ },
            { name: 'Hardcoded Supabase URL fallback', pattern: /iekofqagtcztyavhunai/ }
        ];

        console.log('\n2.1 Scanning responses across active API routes:');
        const testCreatorToken = jwt.sign(
            { id: 'usr_seed_1', email: 'naledi@creator.co.za', plan_tier: 'Pro' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const endpointsToScan = [
            { method: 'GET', path: '/api/health', headers: {} },
            { method: 'GET', path: '/api/admin/metrics', headers: { 'Authorization': `Bearer ${stressToken}` } },
            { method: 'GET', path: '/api/admin/creators', headers: { 'Authorization': `Bearer ${stressToken}` } },
            { method: 'GET', path: '/api/admin/audit-logs', headers: { 'Authorization': `Bearer ${stressToken}` } },
            { method: 'GET', path: '/api/admin/telemetry', headers: { 'Authorization': `Bearer ${stressToken}` } },
            { method: 'GET', path: '/api/transactions', headers: { 'Authorization': `Bearer ${testCreatorToken}` } }
        ];

        let leakedInResponses = false;
        for (const ep of endpointsToScan) {
            const res = await makeRequest(ep.method, ep.path, null, ep.headers);
            const responseText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);

            for (const item of forbiddenPatterns) {
                if (item.pattern.test(responseText)) {
                    leakedInResponses = true;
                    record(`Leak check in ${ep.path}`, false, `Detected ${item.name} in response!`);
                }
            }
        }
        if (!leakedInResponses) {
            record('Zero PII or hardcoded credentials leaked across 6 key API endpoints', true, 'All responses clean');
        }

        console.log('\n2.2 Error Trace & Malicious Injection Scans:');
        const injectionPayloads = [
            {
                name: 'Malformed JSON syntax in POST body',
                method: 'POST',
                path: '/api/auth/login',
                body: '{ "email": "test@example.com", "password": "unclosed_json',
                headers: { 'Content-Type': 'application/json' },
                expectedStatus: 400
            },
            {
                name: 'SQL Injection payload in admin login email',
                method: 'POST',
                path: '/api/admin/auth/login',
                body: { email: "' OR '1'='1' --", password: "' OR '1'='1'" },
                headers: {},
                expectedStatus: 401
            },
            {
                name: 'Invalid mutation payload rejected with HTTP 400',
                method: 'POST',
                path: '/api/admin/creators/usr_seed_1/status',
                body: { status: "malicious_status_injection" },
                headers: { 'Authorization': `Bearer ${stressToken}` },
                expectedStatus: 400
            },
            {
                name: 'Malformed JWT Bearer token',
                method: 'GET',
                path: '/api/admin/verify-auth',
                body: null,
                headers: { 'Authorization': 'Bearer invalid.fake.token' },
                expectedStatus: 401
            },
            {
                name: 'Blocked CORS Origin',
                method: 'GET',
                path: '/api/health',
                body: null,
                headers: { 'Origin': 'https://evil-attacker-site.com' },
                expectedStatus: [403, 500]
            },
            {
                name: 'Non-existent route 404 test',
                method: 'GET',
                path: '/api/some/secret/internal/route',
                body: null,
                headers: {},
                expectedStatus: 404
            }
        ];

        let errorLeakFound = false;
        let fsPathLeakFound = false;
        for (const inj of injectionPayloads) {
            try {
                const res = await makeRequest(inj.method, inj.path, inj.body, inj.headers);
                const rawResponse = res.raw || '';

                for (const item of forbiddenPatterns) {
                    if (item.pattern.test(rawResponse)) {
                        errorLeakFound = true;
                        record(`Error trace injection: ${inj.name}`, false, `Leaked ${item.name} in error response!`);
                    }
                }

                // Check for filesystem leaks (Windows or Unix paths)
                if (/C:\\Users\\/i.test(rawResponse) || /\/home\/[a-z0-9_-]+/i.test(rawResponse)) {
                    fsPathLeakFound = true;
                }

                const expectedMatches = Array.isArray(inj.expectedStatus)
                    ? inj.expectedStatus.includes(res.status)
                    : res.status === inj.expectedStatus;

                record(
                    `Status validation for ${inj.name}`,
                    expectedMatches,
                    `HTTP Status ${res.status}`
                );
            } catch (err) {
                record(`Error handling for ${inj.name}`, false, `Threw unhandled exception: ${err.message}`);
            }
        }

        // Test Prototype Pollution Resistance
        const protoTestRes = await makeRequest('POST', '/api/admin/creators/usr_seed_1/status', {
            "__proto__": { "polluted": true },
            "status": "active"
        }, {
            'Authorization': `Bearer ${stressToken}`
        });
        const isPolluted = ({}).polluted === true;
        record(
            'Prototype pollution resistance on mutation payloads',
            !isPolluted,
            `Object.prototype.polluted is ${({}).polluted}`
        );

        record(
            'Error traces do not leak PII or hardcoded credentials',
            !errorLeakFound,
            'No credentials leaked in error payloads'
        );

        record(
            'Error responses do not leak local filesystem paths',
            !fsPathLeakFound,
            fsPathLeakFound
                ? 'Stack trace in error response leaks absolute filesystem paths (e.g. C:\\Users\\...)'
                : 'No internal file paths exposed in responses',
            fsPathLeakFound // flag as warning/finding
        );

        console.log('\n2.3 Verifying PII Masking Logic (maskPII):');
        const testPiiString = 'Please analyze finances for test@creatorcashflow.co.za, phone +27 82 123 4567, earned R45,000 from YouTube and 12000 ZAR on TikTok.';
        const maskedResult = maskPII(testPiiString);

        const emailMasked = maskedResult.includes('[REDACTED_EMAIL]') && !maskedResult.includes('test@creatorcashflow.co.za');
        const phoneMasked = maskedResult.includes('[REDACTED_PHONE]') && !maskedResult.includes('82 123 4567');
        const zarMasked = maskedResult.includes('[REDACTED_ZAR]') && !maskedResult.includes('R45,000') && !maskedResult.includes('12000 ZAR');

        record('Email masked in PII sanitizer', emailMasked, maskedResult);
        record('Phone number masked in PII sanitizer', phoneMasked, maskedResult);
        record('ZAR Currency amounts masked in PII sanitizer', zarMasked, maskedResult);

        // Test telemetry insertion via /api/gemini
        const geminiRes = await makeRequest('POST', '/api/gemini', {
            prompt: 'My private email is secretcreator@gmail.com and I made R99,000 this month.'
        });
        const latestTelemetry = memoryDb.ai_telemetry[memoryDb.ai_telemetry.length - 1];
        const telemetryStoredClean = latestTelemetry &&
            !latestTelemetry.prompt_masked.includes('secretcreator@gmail.com') &&
            latestTelemetry.prompt_masked.includes('[REDACTED_EMAIL]');

        record(
            'Telemetry stored in memoryDb masks user PII prompts',
            telemetryStoredClean,
            `Stored masked prompt: "${latestTelemetry?.prompt_masked}"`
        );

        // ================================================================
        // SECTION 3: SUSTAINED BRUTE-FORCE LOCKOUT & WINDOW RESET
        // ================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('3. SUSTAINED BRUTE-FORCE LOCKOUT & WINDOW RESET VERIFICATION');
        console.log('----------------------------------------------------------------');

        console.log('\n3.1 Testing Admin Login Lockout (max 5 attempts, 15 min window):');
        const targetAdminIp = '198.51.100.77';
        adminLoginAttempts.delete(targetAdminIp);

        let first5Allowed = true;
        for (let i = 1; i <= 5; i++) {
            const fakeReq = { ip: targetAdminIp, headers: {}, socket: {} };
            let passedNext = false;
            const fakeRes = {
                setHeader: () => {},
                status: (code) => ({
                    json: (data) => {
                        if (code === 429) passedNext = false;
                    }
                })
            };
            rateLimitAdminLogin(fakeReq, fakeRes, () => { passedNext = true; });
            if (!passedNext) first5Allowed = false;
        }
        record('First 5 login attempts permitted through rate limiter', first5Allowed);

        let attempt6Status = null;
        let attempt6RetryAfter = null;
        const fakeRes6 = {
            setHeader: (name, val) => {
                if (name.toLowerCase() === 'retry-after') attempt6RetryAfter = val;
            },
            status: (code) => {
                attempt6Status = code;
                return { json: (data) => {} };
            }
        };
        rateLimitAdminLogin({ ip: targetAdminIp, headers: {}, socket: {} }, fakeRes6, () => {});

        record(
            'Attempt #6 rejected with HTTP 429 and Retry-After header',
            attempt6Status === 429 && attempt6RetryAfter > 0,
            `Status: ${attempt6Status}, Retry-After: ${attempt6RetryAfter}s`
        );

        console.log('\n3.2 Sustained Brute-Force Attack under active lockout:');
        let sustainedBlockedCount = 0;
        for (let i = 0; i < 10; i++) {
            let sustainedStatus = null;
            const fakeResSustained = {
                setHeader: () => {},
                status: (code) => {
                    sustainedStatus = code;
                    return { json: () => {} };
                }
            };
            rateLimitAdminLogin({ ip: targetAdminIp, headers: {}, socket: {} }, fakeResSustained, () => {});
            if (sustainedStatus === 429) sustainedBlockedCount++;
        }
        record(
            'Sustained brute force attempts (10/10) continuously blocked with HTTP 429',
            sustainedBlockedCount === 10,
            `${sustainedBlockedCount}/10 sustained requests blocked`
        );

        console.log('\n3.3 Window Reset & Counter Recovery:');
        const fifteenMinsAgo = Date.now() - (15 * 60 * 1000 + 1000);
        adminLoginAttempts.set(targetAdminIp, [
            fifteenMinsAgo,
            fifteenMinsAgo + 100,
            fifteenMinsAgo + 200,
            fifteenMinsAgo + 300,
            fifteenMinsAgo + 400
        ]);

        let postExpiryAllowed = false;
        let postExpiryStatus = null;
        const fakeResReset = {
            setHeader: () => {},
            status: (code) => {
                postExpiryStatus = code;
                return { json: () => {} };
            }
        };
        rateLimitAdminLogin({ ip: targetAdminIp, headers: {}, socket: {} }, fakeResReset, () => {
            postExpiryAllowed = true;
        });

        const resetAttempts = adminLoginAttempts.get(targetAdminIp);
        record(
            'Lockout window resets cleanly after TTL expiry and permits new request',
            postExpiryAllowed && resetAttempts && resetAttempts.length === 1,
            `Permitted: ${postExpiryAllowed}, New attempts recorded: ${resetAttempts ? resetAttempts.length : 0}`
        );

        if (authLimiter) {
            const authResetIp = '198.51.100.88';
            authLimiter.tracker.set(authResetIp, [
                fifteenMinsAgo,
                fifteenMinsAgo + 100,
                fifteenMinsAgo + 200
            ]);

            let authResetAllowed = false;
            authLimiter({ ip: authResetIp, headers: {}, socket: {} }, { setHeader: () => {}, status: () => ({ json: () => {} }) }, () => {
                authResetAllowed = true;
            });

            const authTimestamps = authLimiter.tracker.get(authResetIp);
            record(
                'authRateLimiter sliding window resets cleanly and prunes expired entries',
                authResetAllowed && authTimestamps && authTimestamps.length === 1,
                `Permitted: ${authResetAllowed}, Current count: ${authTimestamps ? authTimestamps.length : 0}`
            );
        }

    } finally {
        testServer.close();
    }

    // ================================================================
    // SUMMARY REPORT
    // ================================================================
    console.log('\n================================================================');
    console.log('📊 EMPIRICAL STRESS TEST RESULTS SUMMARY');
    console.log('================================================================');
    console.log(`Total Assertions : ${results.tests.length}`);
    console.log(`Passed           : ${results.passed}`);
    console.log(`Warnings         : ${results.warnings}`);
    console.log(`Failed           : ${results.failed}`);
    console.log('----------------------------------------------------------------');

    if (results.failed === 0) {
        console.log('🏆 VERDICT: APPROVE — ALL MILESTONE M1 EMPIRICAL STRESS CHECKS PASSED');
    } else {
        console.log('🚫 VERDICT: FAIL — DEFICIENCIES FOUND IN MILESTONE M1');
    }
    console.log('================================================================\n');

    return results;
}

if (require.main === module) {
    runChallengerStressSuite().then(res => {
        if (res.failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }).catch(err => {
        console.error('Fatal test error:', err);
        process.exit(1);
    });
}

module.exports = { runChallengerStressSuite };
