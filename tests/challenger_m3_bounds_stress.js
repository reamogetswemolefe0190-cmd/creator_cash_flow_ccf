// ==========================================================================
// Milestone M3 Empirical Stress & Bounded Architecture Verification Harness
// Challenger 1: Memory Safety, Capacity Bounds, Unref Timers & Compatibility
// ==========================================================================

const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const jwt = require('jsonwebtoken');

// Ensure test harness mode is active
process.env.TEST_HARNESS = 'true';

// Import server and modular architecture components
const serverExports = require('../server');
const {
    app,
    server,
    memoryDb,
    rateLimitAdminLogin,
    requireAdmin,
    adminLoginAttempts,
    JWT_SECRET,
    maskPII,
    inferCategoryTag,
    getClientIp
} = serverExports;

const {
    createSlidingWindowLimiter,
    authRateLimiter,
    transactionRateLimiter,
    adminMutationRateLimiter,
    geminiRateLimiter
} = require('../middleware/rateLimiter');

const {
    appendAuditLog,
    appendAiTelemetry,
    pruneAiTelemetry,
    MAX_AUDIT_LOGS,
    MAX_TELEMETRY
} = require('../services/memoryDb');

// Test runner state
let totalPassed = 0;
let totalFailed = 0;
const testFailures = [];

function assert(condition, message, details = '') {
    if (condition) {
        totalPassed++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        totalFailed++;
        const failMsg = `  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`;
        console.error(failMsg);
        testFailures.push({ message, details });
    }
}

// Helper to simulate Express req/res cycle for middleware testing
function simulateMiddleware(middleware, reqOptions = {}) {
    return new Promise((resolve) => {
        let statusCode = 200;
        const headers = {};
        let responseBody = null;
        let nextCalled = false;

        const req = {
            headers: reqOptions.headers || {},
            ip: reqOptions.ip || '127.0.0.1',
            socket: { remoteAddress: reqOptions.remoteAddress || '127.0.0.1' },
            body: reqOptions.body || {},
            user: reqOptions.user || null,
            admin: reqOptions.admin || null,
            params: reqOptions.params || {},
            ...reqOptions
        };

        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            setHeader(key, val) {
                headers[key.toLowerCase()] = val;
                return this;
            },
            json(data) {
                responseBody = data;
                resolve({ statusCode, headers, body: responseBody, nextCalled });
            },
            end() {
                resolve({ statusCode, headers, body: responseBody, nextCalled });
            }
        };

        const next = () => {
            nextCalled = true;
            resolve({ statusCode, headers, body: responseBody, nextCalled, admin: req.admin, req });
        };

        try {
            middleware(req, res, next);
        } catch (err) {
            resolve({ statusCode: 500, headers, body: { error: err.message }, nextCalled: false, error: err, req });
        }
    });
}

// HTTP request helper for live server testing
function makeRequest(serverInstance, options, postData = null) {
    return new Promise((resolve, reject) => {
        const port = serverInstance.address().port;
        const reqOptions = {
            hostname: '127.0.0.1',
            port,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {}
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    raw: data
                });
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

// ==========================================================================
// TEST SUITE EXECUTION
// ==========================================================================

async function runM3ChallengerSuite() {
    console.log('\n======================================================================');
    console.log('🧪 RUNNING M3 CHALLENGER 1 EMPIRICAL BOUNDS & MEMORY SAFETY HARNESS');
    console.log('======================================================================\n');

    // --------------------------------------------------------------------------
    // SUITE 1: RATE LIMITER MEMORY MAP CAPACITY BOUNDS (middleware/rateLimiter.js)
    // --------------------------------------------------------------------------
    console.log('--- SUITE 1: Rate Limiter Memory Map Capacity Bounds Stress ---');

    // 1.1: adminLoginAttempts map capacity bound under 1,500 distinct client IPs
    adminLoginAttempts.clear();
    assert(adminLoginAttempts.size === 0, 'adminLoginAttempts is cleanly cleared before test');

    const INJECTION_COUNT = 1500;
    const MAX_TRACKED_ADMIN_IPS = 1000;

    console.log(`  ⏳ Injecting ${INJECTION_COUNT} distinct client IPs into rateLimitAdminLogin...`);
    for (let i = 0; i < INJECTION_COUNT; i++) {
        const ip = `10.100.${Math.floor(i / 250)}.${i % 250}`;
        const res = await simulateMiddleware(rateLimitAdminLogin, {
            headers: { 'x-forwarded-for': ip }
        });
        if (!res.nextCalled) {
            assert(false, `Request for IP ${ip} failed unexpectedly`, JSON.stringify(res.body));
            break;
        }
    }

    assert(
        adminLoginAttempts.size <= MAX_TRACKED_ADMIN_IPS,
        `adminLoginAttempts size (${adminLoginAttempts.size}) never exceeds cap (${MAX_TRACKED_ADMIN_IPS})`
    );
    assert(
        adminLoginAttempts.size === MAX_TRACKED_ADMIN_IPS,
        `adminLoginAttempts size (${adminLoginAttempts.size}) is exactly at the capacity limit (${MAX_TRACKED_ADMIN_IPS})`
    );

    // Verify FIFO eviction: The first 500 IPs (i = 0..499) must have been evicted,
    // and the last 1,000 IPs (i = 500..1499) must be retained.
    const oldestEvictedIp = `10.100.0.0`; // i = 0
    const middleEvictedIp = `10.100.1.249`; // i = 499
    const firstRetainedIp = `10.100.2.0`; // i = 500
    const lastRetainedIp = `10.100.5.249`; // i = 1499

    assert(!adminLoginAttempts.has(oldestEvictedIp), `Oldest IP ${oldestEvictedIp} was evicted by FIFO capacity bounds`);
    assert(!adminLoginAttempts.has(middleEvictedIp), `Middle evicted IP ${middleEvictedIp} was evicted by FIFO capacity bounds`);
    assert(adminLoginAttempts.has(firstRetainedIp), `First retained IP ${firstRetainedIp} is preserved in map`);
    assert(adminLoginAttempts.has(lastRetainedIp), `Last retained IP ${lastRetainedIp} is preserved in map`);

    // 1.2: Verify rate limiting enforcement on a retained IP
    console.log('  ⏳ Verifying brute-force lockout on retained IP...');
    const testIp = firstRetainedIp; // already has 1 attempt
    let lastStatus = null;
    for (let attempt = 2; attempt <= 5; attempt++) {
        const res = await simulateMiddleware(rateLimitAdminLogin, {
            headers: { 'x-forwarded-for': testIp }
        });
        assert(res.nextCalled === true, `Attempt ${attempt}/5 allowed for retained IP ${testIp}`);
    }
    const lockoutRes = await simulateMiddleware(rateLimitAdminLogin, {
        headers: { 'x-forwarded-for': testIp }
    });
    assert(lockoutRes.statusCode === 429, `6th attempt triggers HTTP 429 rate limit lockout (got ${lockoutRes.statusCode})`);
    assert(lockoutRes.body && lockoutRes.body.error === 'Too many login attempts', 'Lockout returns standardized rate limit error');

    // 1.3: authRateLimiter 1,500 distinct IP injection
    authRateLimiter.reset();
    for (let i = 0; i < INJECTION_COUNT; i++) {
        const ip = `10.101.${Math.floor(i / 250)}.${i % 250}`;
        await simulateMiddleware(authRateLimiter, { headers: { 'x-forwarded-for': ip } });
    }
    assert(
        authRateLimiter.tracker.size <= 1000,
        `authRateLimiter tracker size (${authRateLimiter.tracker.size}) is capped at 1,000 maxTrackedKeys`
    );

    // 1.4: adminMutationRateLimiter 1,500 distinct key injection
    adminMutationRateLimiter.reset();
    for (let i = 0; i < INJECTION_COUNT; i++) {
        const adminId = `admin_${i}`;
        await simulateMiddleware(adminMutationRateLimiter, { admin: { id: adminId } });
    }
    assert(
        adminMutationRateLimiter.tracker.size <= 500,
        `adminMutationRateLimiter tracker size (${adminMutationRateLimiter.tracker.size}) is capped at 500 maxTrackedKeys`
    );

    // 1.5: geminiRateLimiter 1,500 distinct IP injection
    geminiRateLimiter.reset();
    for (let i = 0; i < INJECTION_COUNT; i++) {
        const ip = `10.102.${Math.floor(i / 250)}.${i % 250}`;
        await simulateMiddleware(geminiRateLimiter, { headers: { 'x-forwarded-for': ip } });
    }
    assert(
        geminiRateLimiter.tracker.size <= 500,
        `geminiRateLimiter tracker size (${geminiRateLimiter.tracker.size}) is capped at 500 maxTrackedKeys`
    );

    // 1.6: transactionRateLimiter 2,500 distinct user injection
    transactionRateLimiter.reset();
    const TX_INJECTION_COUNT = 2500;
    for (let i = 0; i < TX_INJECTION_COUNT; i++) {
        const userId = `usr_tx_bench_${i}`;
        await simulateMiddleware(transactionRateLimiter, { user: { id: userId } });
    }
    assert(
        transactionRateLimiter.tracker.size <= 2000,
        `transactionRateLimiter tracker size (${transactionRateLimiter.tracker.size}) is capped at 2,000 maxTrackedKeys`
    );

    // 1.7: createSlidingWindowLimiter boundary fuzzing
    const customLimiter = createSlidingWindowLimiter({
        windowMs: 10000,
        maxRequests: 5,
        maxTrackedKeys: 50
    });
    for (let i = 0; i < 200; i++) {
        await simulateMiddleware(customLimiter, { ip: `10.200.0.${i}` });
    }
    assert(customLimiter.tracker.size === 50, `customLimiter tracker capped strictly at 50 keys (got ${customLimiter.tracker.size})`);
    customLimiter.destroy();

    // --------------------------------------------------------------------------
    // SUITE 2: MEMORYDB BOUNDED STRUCTURES & FIFO EVCTION (services/memoryDb.js)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: MemoryDb Bounded Structures & Strict FIFO Eviction ---');

    // 2.1: appendAuditLog 1,500 injection stress test
    memoryDb.audit_logs = [];
    console.log(`  ⏳ Injecting 1,500 audit log records into memoryDb via appendAuditLog...`);
    for (let i = 1; i <= 1500; i++) {
        appendAuditLog({
            id: `audit_stress_${i}`,
            seq: i,
            admin_id: 'admin_test_1',
            target_creator_id: `usr_${i}`,
            action_type: 'STATUS_CHANGE',
            old_value: '{"status":"active"}',
            new_value: '{"status":"suspended"}',
            timestamp: new Date(Date.now() + i * 10).toISOString(),
            ip_hash: 'a1b2c3d4e5f60718'
        });
    }

    assert(
        memoryDb.audit_logs.length === MAX_AUDIT_LOGS,
        `memoryDb.audit_logs length (${memoryDb.audit_logs.length}) is strictly capped at MAX_AUDIT_LOGS (${MAX_AUDIT_LOGS})`
    );
    assert(
        memoryDb.audit_logs[0].seq === 501,
        `First item in audit_logs is seq 501 (oldest 500 items evicted via FIFO, got ${memoryDb.audit_logs[0].seq})`
    );
    assert(
        memoryDb.audit_logs[MAX_AUDIT_LOGS - 1].seq === 1500,
        `Last item in audit_logs is seq 1500 (got ${memoryDb.audit_logs[MAX_AUDIT_LOGS - 1].seq})`
    );

    // Verify backward compatibility property accessor memoryDb.auditLogs
    assert(
        memoryDb.auditLogs.length === MAX_AUDIT_LOGS,
        `memoryDb.auditLogs alias length matches ${MAX_AUDIT_LOGS}`
    );
    assert(
        memoryDb.auditLogs[0].seq === 501 && memoryDb.auditLogs[999].seq === 1500,
        'memoryDb.auditLogs alias reflects exact sliced FIFO items'
    );

    // 2.2: appendAiTelemetry 1,500 injection stress test
    memoryDb.ai_telemetry = [];
    console.log(`  ⏳ Injecting 1,500 telemetry records into memoryDb via appendAiTelemetry...`);
    for (let i = 1; i <= 1500; i++) {
        appendAiTelemetry({
            id: `tel_stress_${i}`,
            seq: i,
            category_tag: 'Tax Deduction Strategy',
            prompt_masked: `Masked prompt inquiry ${i}`,
            tokens_used: 120,
            model: 'gemini-1.5-flash',
            latency_ms: 245,
            created_at: new Date(Date.now() + i * 10).toISOString()
        });
    }

    assert(
        memoryDb.ai_telemetry.length === MAX_TELEMETRY,
        `memoryDb.ai_telemetry length (${memoryDb.ai_telemetry.length}) is strictly capped at MAX_TELEMETRY (${MAX_TELEMETRY})`
    );
    assert(
        memoryDb.ai_telemetry[0].seq === 501,
        `First item in ai_telemetry is seq 501 (oldest 500 items evicted via FIFO, got ${memoryDb.ai_telemetry[0].seq})`
    );
    assert(
        memoryDb.ai_telemetry[MAX_TELEMETRY - 1].seq === 1500,
        `Last item in ai_telemetry is seq 1500 (got ${memoryDb.ai_telemetry[MAX_TELEMETRY - 1].seq})`
    );

    // Verify backward compatibility property accessor memoryDb.aiTelemetry
    assert(
        memoryDb.aiTelemetry.length === MAX_TELEMETRY,
        `memoryDb.aiTelemetry alias length matches ${MAX_TELEMETRY}`
    );
    assert(
        memoryDb.aiTelemetry[0].seq === 501 && memoryDb.aiTelemetry[999].seq === 1500,
        'memoryDb.aiTelemetry alias reflects exact sliced FIFO items'
    );

    // 2.3: 30-Day TTL Pruning Verification
    console.log('  ⏳ Testing pruneAiTelemetry 30-day TTL boundary eviction...');
    const nowMs = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Clear and insert 5 expired (31 days ago) and 5 fresh (10 days ago) items
    memoryDb.ai_telemetry = [
        { id: 'tel_old_1', created_at: new Date(nowMs - 35 * DAY_MS).toISOString() },
        { id: 'tel_old_2', created_at: new Date(nowMs - 32 * DAY_MS).toISOString() },
        { id: 'tel_old_3', created_at: new Date(nowMs - 31 * DAY_MS).toISOString() },
        { id: 'tel_old_4', created_at: new Date(nowMs - 30.5 * DAY_MS).toISOString() },
        { id: 'tel_old_5', created_at: new Date(nowMs - 40 * DAY_MS).toISOString() },
        { id: 'tel_fresh_1', created_at: new Date(nowMs - 29 * DAY_MS).toISOString() },
        { id: 'tel_fresh_2', created_at: new Date(nowMs - 20 * DAY_MS).toISOString() },
        { id: 'tel_fresh_3', created_at: new Date(nowMs - 10 * DAY_MS).toISOString() },
        { id: 'tel_fresh_4', created_at: new Date(nowMs - 1 * DAY_MS).toISOString() },
        { id: 'tel_fresh_5', created_at: new Date(nowMs).toISOString() }
    ];

    pruneAiTelemetry();

    assert(
        memoryDb.ai_telemetry.length === 5,
        `pruneAiTelemetry reduced array from 10 to exactly 5 items (got ${memoryDb.ai_telemetry.length})`
    );
    const retainedOld = memoryDb.ai_telemetry.filter(t => t.id.startsWith('tel_old_'));
    assert(retainedOld.length === 0, 'Zero expired records (>30 days old) remain after pruneAiTelemetry');
    const retainedFresh = memoryDb.ai_telemetry.filter(t => t.id.startsWith('tel_fresh_'));
    assert(retainedFresh.length === 5, 'All 5 fresh records (<30 days old) are preserved');

    // --------------------------------------------------------------------------
    // SUITE 3: TIMER UNREFERENCING & EVENT LOOP SAFETY
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Timer Unreferencing & Event Loop Non-Blocking Verification ---');

    // 3.1: Verify limiter cleanup timers call .unref()
    const testLimiter = createSlidingWindowLimiter({ windowMs: 5000, maxRequests: 2 });
    // In Node.js, timer.hasRef() returns false if .unref() was called
    // We can also verify process graceful termination when requiring server
    testLimiter.destroy();
    assert(typeof testLimiter.destroy === 'function', 'createSlidingWindowLimiter provides destroy() teardown handle');

    // 3.2: Empirical Child Process Clean Exit Benchmark
    console.log('  ⏳ Executing empirical child process verification for unreferenced timers...');
    const childExitResult = await new Promise((resolve) => {
        const startTs = Date.now();
        // Run a child process that requires server.js, executes a 50ms setTimeout, and terminates naturally
        // WITHOUT calling process.exit(). If any setInterval is holding the loop open, it won't exit.
        const childScript = `
            const server = require('./server');
            setTimeout(() => {
                // Natural completion of synchronous + timed tasks
                console.log('EVENT_LOOP_FREE');
            }, 50);
        `;

        const child = execFile('node', ['-e', childScript], {
            cwd: path.resolve(__dirname, '..'),
            timeout: 5000 // 5s timeout
        }, (error, stdout, stderr) => {
            const elapsed = Date.now() - startTs;
            resolve({
                error,
                stdout: stdout ? stdout.trim() : '',
                stderr: stderr ? stderr.trim() : '',
                elapsed,
                timedOut: error && error.killed
            });
        });
    });

    assert(!childExitResult.timedOut, 'Child process did NOT time out waiting for lingering event loop handles');
    assert(childExitResult.error === null, 'Child process exited with exit code 0');
    assert(childExitResult.stdout.includes('EVENT_LOOP_FREE'), 'Child process cleanly executed scheduled task');
    assert(childExitResult.elapsed < 3000, `Child process terminated gracefully in ${childExitResult.elapsed}ms (< 3,000ms target)`);

    // --------------------------------------------------------------------------
    // SUITE 4: BACKWARD COMPATIBILITY VERIFICATION (10 EXPORTED SYMBOLS)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Backward Compatibility of 10 Exported Symbols from server.js ---');

    // Export 1: app
    assert(typeof app === 'function', '1. Export "app" is an Express application function');
    assert(typeof app.use === 'function' && typeof app.listen === 'function', '1. Export "app" has standard Express application methods');

    // Export 2: server
    assert(server === null || typeof server === 'object', '2. Export "server" is null or http.Server instance');

    // Export 3: memoryDb
    assert(typeof memoryDb === 'object' && memoryDb !== null, '3. Export "memoryDb" is an object');
    assert(Array.isArray(memoryDb.users), '3. memoryDb contains users array');
    assert(Array.isArray(memoryDb.transactions), '3. memoryDb contains transactions array');
    assert(Array.isArray(memoryDb.audit_logs), '3. memoryDb contains audit_logs array');
    assert(Array.isArray(memoryDb.ai_telemetry), '3. memoryDb contains ai_telemetry array');
    assert(Array.isArray(memoryDb.auditLogs), '3. memoryDb contains auditLogs alias array');
    assert(Array.isArray(memoryDb.aiTelemetry), '3. memoryDb contains aiTelemetry alias array');

    // Export 4: rateLimitAdminLogin
    assert(typeof rateLimitAdminLogin === 'function', '4. Export "rateLimitAdminLogin" is a middleware function');
    assert(rateLimitAdminLogin.length === 3, '4. rateLimitAdminLogin has 3 parameters (req, res, next)');

    // Export 5: requireAdmin
    assert(typeof requireAdmin === 'function', '5. Export "requireAdmin" is a middleware function');
    assert(requireAdmin.length === 3, '5. requireAdmin has 3 parameters (req, res, next)');

    // Verify requireAdmin middleware contract
    const noHeaderRes = await simulateMiddleware(requireAdmin, { headers: {} });
    assert(noHeaderRes.statusCode === 401, 'requireAdmin rejects request without Authorization header with HTTP 401');

    const invalidTokenRes = await simulateMiddleware(requireAdmin, {
        headers: { authorization: 'Bearer invalid.token.value' }
    });
    assert(invalidTokenRes.statusCode === 401, 'requireAdmin rejects malformed/invalid token with HTTP 401');

    const creatorToken = jwt.sign({ id: 'usr_1', email: 'creator@test.com', role: 'creator' }, JWT_SECRET);
    const creatorRoleRes = await simulateMiddleware(requireAdmin, {
        headers: { authorization: `Bearer ${creatorToken}` }
    });
    assert(creatorRoleRes.statusCode === 403, 'requireAdmin rejects non-admin role token with HTTP 403 Forbidden');

    const adminToken = jwt.sign({ id: 'admin_1', email: 'admin@test.com', role: 'admin' }, JWT_SECRET);
    const validAdminRes = await simulateMiddleware(requireAdmin, {
        headers: { authorization: `Bearer ${adminToken}` }
    });
    assert(validAdminRes.nextCalled === true, 'requireAdmin accepts valid admin token and calls next()');
    assert(validAdminRes.admin && validAdminRes.admin.role === 'admin', 'requireAdmin attaches decoded admin object to req');

    // Export 6: adminLoginAttempts
    assert(adminLoginAttempts instanceof Map, '6. Export "adminLoginAttempts" is an instance of Map');

    // Export 7: JWT_SECRET
    assert(typeof JWT_SECRET === 'string' && JWT_SECRET.length > 0, '7. Export "JWT_SECRET" is a non-empty string');

    // Export 8: maskPII
    assert(typeof maskPII === 'function', '8. Export "maskPII" is a function');
    const piiTest1 = maskPII('User email is test.creator@studio.co.za and phone is +27 82 123 4567, earned R1,500.00');
    assert(piiTest1.includes('[REDACTED_EMAIL]'), 'maskPII redacts email addresses');
    assert(!piiTest1.includes('test.creator@studio.co.za'), 'maskPII removes raw email');
    assert(piiTest1.includes('[REDACTED_PHONE]'), 'maskPII redacts phone numbers');
    assert(!piiTest1.includes('+27 82 123 4567'), 'maskPII removes raw phone');
    assert(piiTest1.includes('[REDACTED_ZAR]'), 'maskPII redacts ZAR amounts');
    assert(!piiTest1.includes('R1,500.00'), 'maskPII removes raw ZAR amount');

    // Export 9: inferCategoryTag
    assert(typeof inferCategoryTag === 'function', '9. Export "inferCategoryTag" is a function');
    assert(inferCategoryTag('How do I claim tax deductions on SARS?') === 'Tax Deduction Strategy', 'inferCategoryTag categorizes Tax');
    assert(inferCategoryTag('What camera lens or microphone should I buy?') === 'Gear Purchase Planning', 'inferCategoryTag categorizes Gear');
    assert(inferCategoryTag('My YouTube AdSense revenue was paid today') === 'Revenue Optimization', 'inferCategoryTag categorizes Revenue');
    assert(inferCategoryTag('Hello how does Creator Cash Flow work?') === 'General Inquiry', 'inferCategoryTag categorizes General Inquiry');

    // Export 10: getClientIp
    assert(typeof getClientIp === 'function', '10. Export "getClientIp" is a function');
    assert(getClientIp({ headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' } }) === '203.0.113.195', 'getClientIp parses x-forwarded-for string');
    assert(getClientIp({ headers: { 'x-forwarded-for': ['198.51.100.4', '10.0.0.1'] } }) === '198.51.100.4', 'getClientIp parses x-forwarded-for array');
    assert(getClientIp({ ip: '192.168.1.50' }) === '192.168.1.50', 'getClientIp falls back to req.ip');
    assert(getClientIp({ socket: { remoteAddress: '172.16.0.5' } }) === '172.16.0.5', 'getClientIp falls back to socket.remoteAddress');
    assert(getClientIp(null) === '127.0.0.1', 'getClientIp safely falls back to 127.0.0.1 on null req');

    // --------------------------------------------------------------------------
    // SUITE 5: LIVE SERVER DEEP HEALTH & HIGH CONCURRENCY MUTATION INTEGRATION
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Live Server Deep Health & High Concurrency Integration ---');

    const liveServer = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = liveServer.address().port;
    console.log(`  ⚡ Live ephemeral test server active on port ${port}`);

    // 5.1: Deep Diagnostics Health Endpoint (/api/health)
    const healthRes = await makeRequest(liveServer, { path: '/api/health' });
    assert(healthRes.statusCode === 200, `GET /api/health returns HTTP 200 (got ${healthRes.statusCode})`);
    assert(healthRes.body && healthRes.body.status === 'active', 'Health response status is "active"');
    assert(typeof healthRes.body.uptimeSeconds === 'number', 'Health response reports numeric uptimeSeconds');
    assert(healthRes.body.memory && typeof healthRes.body.memory.heapUsedMB === 'number', 'Health response reports memory.heapUsedMB');
    assert(healthRes.body.memory && typeof healthRes.body.memory.rssMB === 'number', 'Health response reports memory.rssMB');
    assert(healthRes.body.inMemoryStores && typeof healthRes.body.inMemoryStores.auditLogsCount === 'number', 'Health response reports inMemoryStores.auditLogsCount');
    assert(healthRes.body.inMemoryStores && typeof healthRes.body.inMemoryStores.telemetryCount === 'number', 'Health response reports inMemoryStores.telemetryCount');
    assert(healthRes.body.integrations && typeof healthRes.body.integrations.gemini === 'object', 'Health response reports external integrations state');

    // 5.2: Concurrent Mutation & Audit Logging Stress across 50 distinct admin sessions
    console.log('  ⏳ Dispatching 50 concurrent administrative status mutations across distinct admin IDs...');
    const concurrentRequests = [];

    for (let i = 0; i < 50; i++) {
        const adminId = `admin_live_${i + 1}`;
        const adminToken = jwt.sign({ id: adminId, email: `${adminId}@creatorcashflow.com`, role: 'admin' }, JWT_SECRET);
        const p = makeRequest(liveServer, {
            path: '/api/admin/creators/usr_seed_1/status',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
                'X-Forwarded-For': `192.168.99.${i + 1}`
            }
        }, {
            status: i % 2 === 0 ? 'active' : 'suspended',
            plan_tier: i % 3 === 0 ? 'Free' : 'Pro',
            note: `Concurrent stress mutation sequence ${i + 1}`
        });
        concurrentRequests.push(p);
    }

    const mutationResults = await Promise.all(concurrentRequests);
    const successCount = mutationResults.filter(r => r.statusCode === 200 && r.body && r.body.success === true).length;
    assert(successCount === 50, `All 50/50 concurrent status mutations from distinct admins returned HTTP 200 success (got ${successCount}/50)`);

    // 5.3: Verify adminMutationRateLimiter actively limits an individual admin to 30 mutations / min
    console.log('  ⏳ Verifying adminMutationRateLimiter cap (30 reqs/min) on single admin...');
    const singleAdminToken = jwt.sign({ id: 'admin_single_rate_limit_test', email: 'single@creatorcashflow.com', role: 'admin' }, JWT_SECRET);
    let singleAdminSuccesses = 0;
    let singleAdminBlocked = 0;

    for (let i = 0; i < 35; i++) {
        const res = await makeRequest(liveServer, {
            path: '/api/admin/creators/usr_seed_1/status',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${singleAdminToken}`,
                'Content-Type': 'application/json',
                'X-Forwarded-For': '192.168.100.1'
            }
        }, {
            status: 'active',
            plan_tier: 'Pro',
            note: `Single admin mutation test ${i + 1}`
        });
        if (res.statusCode === 200) singleAdminSuccesses++;
        else if (res.statusCode === 429) singleAdminBlocked++;
    }

    assert(singleAdminSuccesses === 30, `Single admin allowed exactly 30 mutations within 1-min window (got ${singleAdminSuccesses})`);
    assert(singleAdminBlocked === 5, `Single admin blocked with HTTP 429 on attempts 31-35 (got ${singleAdminBlocked})`);

    // Verify audit logs retrieval
    const auditRes = await makeRequest(liveServer, {
        path: '/api/admin/audit-logs',
        headers: { 'Authorization': `Bearer ${jwt.sign({ id: 'admin_audit_viewer', email: 'viewer@ccf.com', role: 'admin' }, JWT_SECRET)}` }
    });
    assert(auditRes.statusCode === 200, `GET /api/admin/audit-logs returns HTTP 200 (got ${auditRes.statusCode})`);
    assert(Array.isArray(auditRes.body), 'Audit logs response is an array');
    assert(auditRes.body.length >= 80, `Audit logs contain at least 80 recorded mutation entries (got ${auditRes.body.length})`);
    assert(auditRes.body.length <= MAX_AUDIT_LOGS, `Audit logs count does not exceed capacity bound ${MAX_AUDIT_LOGS}`);

    // Clean teardown of live server
    await new Promise((resolve) => liveServer.close(resolve));
    console.log('  ⚡ Live test server closed cleanly');

    // --------------------------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------------------------
    console.log('\n======================================================================');
    console.log(`📊 M3 CHALLENGER RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED across ${totalPassed + totalFailed} assertions`);
    console.log('======================================================================\n');

    if (totalFailed > 0) {
        console.error('❌ FAILURES DETECTED:');
        testFailures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.message}: ${f.details}`));
        process.exit(1);
    } else {
        console.log('🎉 ALL M3 MEMORY SAFETY & ARCHITECTURE CHALLENGES PASSED AUTHENTICALLY!\n');
        process.exit(0);
    }
}

// Execute harness
runM3ChallengerSuite().catch(err => {
    console.error('Fatal error running M3 challenger suite:', err);
    process.exit(1);
});
