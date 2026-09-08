/**
 * Standalone Adversarial Stress Test Suite for Milestone M3
 * Target: server.js (Creator Cash Flow Admin & Telemetry APIs)
 * Author: Challenger 2 (challenger_m3_2)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET } = require('../../server.js');

let serverInstance = null;
let PORT = 5099;

// Utility to start test server
function startServer() {
    return new Promise((resolve, reject) => {
        serverInstance = app.listen(PORT, () => {
            console.log(`[TEST HARNESS] Server running on port ${PORT}`);
            resolve(`http://localhost:${PORT}`);
        });
    });
}

// Utility to stop test server
function stopServer() {
    return new Promise((resolve) => {
        if (serverInstance) {
            serverInstance.close(() => {
                console.log('[TEST HARNESS] Server closed.');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// HTTP Helper Function
function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`http://localhost:${PORT}${path}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', (err) => reject(err));

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    const results = [];
    console.log('====================================================');
    console.log('   STARTING ADVERSARIAL STRESS TEST SUITE M3_2      ');
    console.log('====================================================\n');

    await startServer();

    // Generate tokens for testing
    const validAdminToken = jwt.sign({ id: 'admin_1', email: 'admin@test.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const nonAdminToken = jwt.sign({ id: 'user_1', email: 'user@test.com', role: 'creator' }, JWT_SECRET, { expiresIn: '1h' });
    const expiredAdminToken = jwt.sign({ id: 'admin_1', email: 'admin@test.com', role: 'admin' }, JWT_SECRET, { expiresIn: '-1s' });
    const invalidSecretToken = jwt.sign({ id: 'admin_1', email: 'admin@test.com', role: 'admin' }, 'wrong_secret_123', { expiresIn: '1h' });

    // ----------------------------------------------------
    // TEST GROUP 1: JWT Authentication & Role Enforcement
    // ----------------------------------------------------
    console.log('--- TEST GROUP 1: JWT & Auth Edge Cases ---');

    const protectedEndpoints = [
        { method: 'POST', path: '/api/admin/creators/usr_seed_1/status', body: { status: 'suspended', note: 'Test' } },
        { method: 'GET', path: '/api/admin/audit-logs', body: null },
        { method: 'GET', path: '/api/admin/telemetry', body: null }
    ];

    for (const ep of protectedEndpoints) {
        // 1.1 No Auth Header
        let res = await makeRequest(ep.method, ep.path, {}, ep.body);
        let pass = res.status === 401;
        results.push({ name: `${ep.method} ${ep.path} - No Auth Header`, pass, expected: 401, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] No Auth Header on ${ep.method} ${ep.path} -> Expected 401, Got ${res.status}`);

        // 1.2 Invalid / Malformed Token
        res = await makeRequest(ep.method, ep.path, { Authorization: 'Bearer bogus_token_123' }, ep.body);
        pass = res.status === 401;
        results.push({ name: `${ep.method} ${ep.path} - Malformed Token`, pass, expected: 401, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] Malformed Token on ${ep.method} ${ep.path} -> Expected 401, Got ${res.status}`);

        // 1.3 Wrong Secret Token
        res = await makeRequest(ep.method, ep.path, { Authorization: `Bearer ${invalidSecretToken}` }, ep.body);
        pass = res.status === 401;
        results.push({ name: `${ep.method} ${ep.path} - Wrong Secret Token`, pass, expected: 401, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] Wrong Secret Token on ${ep.method} ${ep.path} -> Expected 401, Got ${res.status}`);

        // 1.4 Expired Token
        res = await makeRequest(ep.method, ep.path, { Authorization: `Bearer ${expiredAdminToken}` }, ep.body);
        pass = res.status === 401;
        results.push({ name: `${ep.method} ${ep.path} - Expired Token`, pass, expected: 401, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] Expired Token on ${ep.method} ${ep.path} -> Expected 401, Got ${res.status}`);

        // 1.5 Non-Admin Token (role: 'creator')
        res = await makeRequest(ep.method, ep.path, { Authorization: `Bearer ${nonAdminToken}` }, ep.body);
        pass = res.status === 403;
        results.push({ name: `${ep.method} ${ep.path} - Non-Admin Token`, pass, expected: 403, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] Non-Admin Token on ${ep.method} ${ep.path} -> Expected 403, Got ${res.status}`);

        // 1.6 Valid Admin Token
        res = await makeRequest(ep.method, ep.path, { Authorization: `Bearer ${validAdminToken}` }, ep.body);
        pass = res.status === 200;
        results.push({ name: `${ep.method} ${ep.path} - Valid Admin Token`, pass, expected: 200, actual: res.status });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] Valid Admin Token on ${ep.method} ${ep.path} -> Expected 200, Got ${res.status}`);
    }

    // ----------------------------------------------------
    // TEST GROUP 2: Injection Payloads (SQLi & XSS)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 2: Injection Payloads (SQLi & XSS) ---');

    const sqliXssPayloads = [
        `' OR '1'='1'; --`,
        `"><script>alert('XSS_MUTATION')</script>`,
        `<img src=x onerror=alert(document.cookie)>`,
        `'; DROP TABLE audit_logs; --`,
        `{"$gt": ""}`
    ];

    for (const payload of sqliXssPayloads) {
        // 2.1 Status note payload injection
        const resNote = await makeRequest(
            'POST',
            '/api/admin/creators/usr_seed_1/status',
            { Authorization: `Bearer ${validAdminToken}` },
            { status: 'active', note: payload }
        );

        const passNote = resNote.status === 200 && resNote.body.success === true;
        console.log(`[${passNote ? 'PASS' : 'FAIL'}] Status Note Payload ["${payload.substring(0, 20)}..."] -> Status: ${resNote.status}`);
        results.push({ name: `Status Note Payload [${payload.substring(0, 15)}]`, pass: passNote, status: resNote.status });

        // Verify audit log recorded note safely
        const auditRes = await makeRequest('GET', '/api/admin/audit-logs', { Authorization: `Bearer ${validAdminToken}` });
        const lastAudit = auditRes.body[0];
        const auditPass = lastAudit && lastAudit.new_value.includes(payload.replace(/"/g, '\\"'));
        console.log(`  -> Audit log record verification: ${auditPass ? 'SAFE' : 'CHECK'}`);

        // 2.2 Gemini prompt injection & PII masking
        const resGemini = await makeRequest(
            'POST',
            '/api/gemini',
            {},
            { prompt: `My email is admin@company.com, phone +27821234567, I spent R50,000 ZAR. ${payload}` }
        );
        const passGemini = resGemini.status === 200;
        console.log(`[${passGemini ? 'PASS' : 'FAIL'}] Gemini Prompt Injection ["${payload.substring(0, 20)}..."] -> Status: ${resGemini.status}`);
        results.push({ name: `Gemini Prompt Payload [${payload.substring(0, 15)}]`, pass: passGemini, status: resGemini.status });

        // Check PII masking in telemetry
        const telRes = await makeRequest('GET', '/api/admin/telemetry', { Authorization: `Bearer ${validAdminToken}` });
        const lastTel = telRes.body[0];
        const piiMaskedPass = lastTel &&
            !lastTel.prompt_masked.includes('admin@company.com') &&
            !lastTel.prompt_masked.includes('+27821234567') &&
            !lastTel.prompt_masked.includes('R50,000') &&
            lastTel.prompt_masked.includes('[REDACTED_EMAIL]') &&
            lastTel.prompt_masked.includes('[REDACTED_PHONE]') &&
            lastTel.prompt_masked.includes('[REDACTED_ZAR]');
        console.log(`  -> Telemetry PII Masking: ${piiMaskedPass ? 'PASS (REDACTED)' : 'FAIL (PII LEAKED)'}`);
        results.push({ name: `PII Masking Verification [${payload.substring(0, 15)}]`, pass: piiMaskedPass });
    }

    // ----------------------------------------------------
    // TEST GROUP 3: Type Mutation & Crash Vulnerabilities
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 3: Type Mutation & Crash Vulnerabilities ---');

    // 3.1 Non-string status payload (e.g. status: 12345)
    let crashRes = await makeRequest(
        'POST',
        '/api/admin/creators/usr_seed_1/status',
        { Authorization: `Bearer ${validAdminToken}` },
        { status: 12345, note: 'Numeric status' }
    );
    let passCrash1 = crashRes.status === 400;
    console.log(`[${passCrash1 ? 'PASS' : 'FAIL'}] Non-string status payload (status: 12345) -> Expected 400, Got ${crashRes.status}`);
    if (crashRes.status === 500) {
        console.log(`  ❌ CRASH VULNERABILITY DETECTED: Server returned 500 Unhandled Exception on numeric status input! Error:`, crashRes.body);
    }
    results.push({ name: 'Non-string status payload type handling', pass: passCrash1, expected: 400, actual: crashRes.status });

    // 3.2 Non-string plan_tier payload (e.g. plan_tier: true)
    crashRes = await makeRequest(
        'POST',
        '/api/admin/creators/usr_seed_1/status',
        { Authorization: `Bearer ${validAdminToken}` },
        { plan_tier: true, note: 'Boolean tier' }
    );
    let passCrash2 = crashRes.status === 400;
    console.log(`[${passCrash2 ? 'PASS' : 'FAIL'}] Non-string plan_tier payload (plan_tier: true) -> Expected 400, Got ${crashRes.status}`);
    if (crashRes.status === 500) {
        console.log(`  ❌ CRASH VULNERABILITY DETECTED: Server returned 500 Unhandled Exception on boolean plan_tier input! Error:`, crashRes.body);
    }
    results.push({ name: 'Non-string plan_tier payload type handling', pass: passCrash2, expected: 400, actual: crashRes.status });

    // 3.3 Non-string prompt payload in Gemini (e.g. prompt: 99999)
    crashRes = await makeRequest(
        'POST',
        '/api/gemini',
        {},
        { prompt: 99999 }
    );
    let passCrash3 = crashRes.status === 400 || crashRes.status === 200;
    console.log(`[${passCrash3 ? 'PASS' : 'FAIL'}] Non-string Gemini prompt (prompt: 99999) -> Got Status ${crashRes.status}`);
    results.push({ name: 'Non-string Gemini prompt handling', pass: passCrash3, actual: crashRes.status });

    // ----------------------------------------------------
    // TEST GROUP 4: Performance & Memory Leak Inspection
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 4: Performance & Memory Retention Inspection ---');

    const initialMem = process.memoryUsage();
    console.log(`Initial RSS Memory: ${(initialMem.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Initial Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Initial telemetry record count in memory: ${memoryDb.ai_telemetry.length}`);

    const BULK_COUNT = 2000;
    console.log(`\nSimulating ${BULK_COUNT} Gemini telemetry insertions...`);
    const startTime = Date.now();

    for (let i = 0; i < BULK_COUNT; i++) {
        // Direct telemetry push simulating Gemini backend execution
        memoryDb.ai_telemetry.push({
            id: `tel_bulk_${i}`,
            category_tag: 'Tax Deduction Strategy',
            prompt_masked: `Bulk query #${i} with ZAR [REDACTED_ZAR]`,
            tokens_used: 150,
            model: 'gemini-1.5-flash',
            latency_ms: 120,
            created_at: new Date(Date.now() - (i % 60) * 86400000).toISOString() // mix of recent and expired dates (>30 days)
        });
    }

    const duration = Date.now() - startTime;
    console.log(`Inserted ${BULK_COUNT} records in ${duration} ms (${(BULK_COUNT / (duration / 1000)).toFixed(0)} ops/sec)`);

    const midMem = process.memoryUsage();
    console.log(`Post-Bulk Heap Used: ${(midMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total records stored in memoryDb.ai_telemetry: ${memoryDb.ai_telemetry.length}`);

    // Query telemetry API
    const telQueryStart = Date.now();
    const telFetchRes = await makeRequest('GET', '/api/admin/telemetry', { Authorization: `Bearer ${validAdminToken}` });
    const telQueryDuration = Date.now() - telQueryStart;

    console.log(`GET /api/admin/telemetry response status: ${telFetchRes.status}, returned items: ${telFetchRes.body.length}, latency: ${telQueryDuration} ms`);

    // Verify 30-Day TTL filtering logic
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldRecordsInResponse = telFetchRes.body.filter(t => new Date(t.created_at).getTime() < thirtyDaysAgo);
    const ttlFilteredPass = oldRecordsInResponse.length === 0;
    console.log(`[${ttlFilteredPass ? 'PASS' : 'FAIL'}] 30-Day TTL Filter on GET /api/admin/telemetry: ${oldRecordsInResponse.length} expired records returned`);
    results.push({ name: '30-Day TTL Filter Execution', pass: ttlFilteredPass, expiredCount: oldRecordsInResponse.length });

    // Check memory retention flaw: expired items remain in memoryDb.ai_telemetry array permanently
    const expiredCountInDb = memoryDb.ai_telemetry.filter(t => new Date(t.created_at).getTime() < thirtyDaysAgo).length;
    console.log(`[NOTICE] Expired records remaining in memoryDb.ai_telemetry array: ${expiredCountInDb}`);
    const memoryLeakPass = expiredCountInDb === 0; // If expired records are retained in memoryDb, this highlights the unbounded growth design
    results.push({ name: 'In-Memory Unbounded Retention Check (Pruning on write/TTL)', pass: memoryLeakPass, retainedExpiredRecords: expiredCountInDb });

    await stopServer();

    console.log('\n====================================================');
    console.log('             STRESS TEST SUMMARY REPORT             ');
    console.log('====================================================');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.pass).length;
    const failedTests = results.filter(r => !r.pass).length;
    console.log(`Total Test Vectors: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}\n`);

    return { totalTests, passedTests, failedTests, results };
}

if (require.main === module) {
    runTests().catch(err => {
        console.error('Fatal error in stress test execution:', err);
        process.exit(1);
    });
}

module.exports = { runTests };
