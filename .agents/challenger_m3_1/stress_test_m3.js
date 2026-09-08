/* ==========================================================================
   Creator Cash Flow - Standalone Stress Test Suite for Milestone M3
   Target: server.js
   Focus: Adversarial stress testing of Audit Logging & PII Telemetry API
   ========================================================================== */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag } = require('../../server');

let server = null;
let baseUrl = '';

function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const reqHeaders = { ...headers };
        let reqBody = null;

        if (body) {
            reqBody = JSON.stringify(body);
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
        }

        const req = http.request(url, { method, headers: reqHeaders }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: json });
            });
        });

        req.on('error', reject);
        if (reqBody) req.write(reqBody);
        req.end();
    });
}

const adminToken = jwt.sign(
    { id: 'admin_stress_1', email: 'admin@creatorcashflow.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const userToken = jwt.sign(
    { id: 'usr_seed_1', email: 'naledi@creator.co.za', name: 'Naledi Molefe' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const authHeader = { 'Authorization': `Bearer ${adminToken}` };

const results = [];

function recordTest(suite, name, passed, details = '') {
    results.push({ suite, name, passed, details });
    const symbol = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${symbol}] [${suite}] ${name}${details ? ` -> ${details}` : ''}`);
}

async function runStressTest() {
    console.log('================================================================');
    console.log('🔥 STARTING ADVERSARIAL STRESS TEST FOR MILESTONE M3');
    console.log('================================================================\n');

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Stress test server listening on ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // =====================================================================
        // SECTION 1: Mutation Payload Validation Edge Cases (POST /api/admin/creators/:id/status)
        // =====================================================================
        console.log('--- SECTION 1: Status / Plan Tier Mutation Edge Cases ---');

        // 1.1 Invalid status string (e.g., 'banned', 'INVALID', 'active_pending')
        for (const badStatus of ['banned', 'INVALID', 'active_pending', 'suspended_temp', 'deleted', '123', 'true']) {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { status: badStatus });
            const passed = res.status === 400 && res.body.error && res.body.error.includes('Invalid status value');
            recordTest('Status Validation', `Rejects status="${badStatus}" with HTTP 400`, passed, `Status: ${res.status}, Error: ${res.body?.error}`);
        }

        // 1.2 Invalid plan tier string (e.g., 'Enterprise', 'Premium', 'VIP', 'free_trial')
        for (const badTier of ['Enterprise', 'Premium', 'VIP', 'free_trial', 'Pro_Plus', 'gold']) {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { plan_tier: badTier });
            const passed = res.status === 400 && res.body.error && res.body.error.includes('Invalid plan_tier value');
            recordTest('Plan Tier Validation', `Rejects plan_tier="${badTier}" with HTTP 400`, passed, `Status: ${res.status}, Error: ${res.body?.error}`);
        }

        // 1.3 Empty payload / missing mutation parameters
        {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, {});
            const passed = res.status === 400 && res.body.error && res.body.error.includes('Invalid mutation payload');
            recordTest('Payload Validation', `Rejects empty payload with HTTP 400`, passed, `Status: ${res.status}`);
        }

        // 1.4 Payload with note only (no status or plan_tier)
        {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { note: 'Just a note' });
            const passed = res.status === 400; // Expected 400 based on validation (!status && !effectivePlanTier)
            recordTest('Payload Validation', `Rejects payload with note only with HTTP 400`, passed, `Status: ${res.status}`);
        }

        // 1.5 Non-existent creator ID
        {
            const res = await request('POST', '/api/admin/creators/usr_nonexistent_999/status', authHeader, { status: 'suspended' });
            const passed = res.status === 404 && res.body.error === 'Creator not found';
            recordTest('Creator Lookup', `Returns 404 for non-existent creator ID`, passed, `Status: ${res.status}`);
        }

        // 1.6 Case sensitivity tolerance check (e.g., status: 'SUSPENDED', plan_tier: 'PRO', plan_tier: 'free')
        {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { status: 'SUSPENDED', plan_tier: 'PRO' });
            const passed = res.status === 200 && res.body.creator.status === 'suspended' && res.body.creator.plan_tier === 'Pro';
            recordTest('Case Sensitivity', `Normalizes status='SUSPENDED' to 'suspended' and plan_tier='PRO' to 'Pro'`, passed, `Status: ${res.status}, Creator: ${JSON.stringify(res.body?.creator)}`);
        }

        // 1.7 Alternative casing field name (planTier vs plan_tier)
        {
            const res = await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { planTier: 'Free' });
            const passed = res.status === 200 && res.body.creator.plan_tier === 'Free';
            recordTest('Field Casing Support', `Accepts camelCase 'planTier'`, passed, `Status: ${res.status}, Creator: ${JSON.stringify(res.body?.creator)}`);
        }

        // Reset user status back to active / Pro for clean state
        await request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, { status: 'active', plan_tier: 'Pro' });

        // =====================================================================
        // SECTION 2: Complex PII Prompt Masking Stress Testing (POST /api/gemini)
        // =====================================================================
        console.log('\n--- SECTION 2: PII Telemetry Masking Complex Formats ---');

        const piiCases = [
            {
                name: 'Multiple ZAR formats (R1,500.00, ZAR 25000, R500, R1 500, 5000 ZAR)',
                prompt: 'I earned R1,500.00 from YouTube and ZAR 25000 from sponsors. Can I deduct R500 for lighting and R1 500 for mic? Total budget is 5000 ZAR.',
                unmaskedRegex: /(R1,500\.00|ZAR 25000|R500|R1 500|5000 ZAR)/i
            },
            {
                name: 'ZAR format variations (R 2,500.50, ZAR10000, R0.50)',
                prompt: 'My income was R 2,500.50 and expense ZAR10000, balance R0.50',
                unmaskedRegex: /(R 2,500\.50|ZAR10000|R0\.50)/i
            },
            {
                name: 'Email with special characters (+ tag, dots, subdomains)',
                prompt: 'Contact user john.doe+tax2026@sub.creator-studio.co.za or admin_dev-1@domain.org for SARS docs',
                unmaskedRegex: /(john\.doe\+tax2026@sub\.creator-studio\.co\.za|admin_dev-1@domain\.org)/i
            },
            {
                name: 'South African Mobile Numbers (+27, 082, formatted with spaces/dashes)',
                prompt: 'Call +27 82 123 4567 or 082-987-6543 or +27831112222 regarding invoice',
                unmaskedRegex: /(\+27 82 123 4567|082-987-6543|\+27831112222)/i
            },
            {
                name: 'Combined PII Prompt (ZAR, Email, Mobile)',
                prompt: 'User sipho@cashflow.co.za (phone +27 (0)11 456 7890) spent ZAR 15,000 on gear.',
                unmaskedRegex: /(sipho@cashflow\.co\.za|\+27 \(0\)11 456 7890|ZAR 15,000)/i
            }
        ];

        for (const testCase of piiCases) {
            // Direct maskPII test
            const maskedResult = maskPII(testCase.prompt);
            const leakedDirectly = testCase.unmaskedRegex.test(maskedResult);
            
            // Endpoint integration test via POST /api/gemini
            const res = await request('POST', '/api/gemini', {}, { prompt: testCase.prompt });
            
            // Query telemetry log endpoint to verify stored masked prompt
            const telemRes = await request('GET', '/api/admin/telemetry', authHeader);
            const latestLog = telemRes.body.find(t => t.prompt_masked === maskedResult);
            
            const passed = !leakedDirectly && latestLog !== undefined;
            recordTest(
                'PII Masking',
                testCase.name,
                passed,
                `Direct Mask: "${maskedResult}" | Leaked: ${leakedDirectly} | Stored Telemetry: ${!!latestLog}`
            );
        }

        // =====================================================================
        // SECTION 3: 30-Day Telemetry TTL Boundary Logic Verification
        // =====================================================================
        console.log('\n--- SECTION 3: 30-Day Telemetry TTL Boundary Logic ---');

        const NOW = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;

        // Inject specific age records into memoryDb.ai_telemetry
        const rec29Days = {
            id: 'tel_test_29d',
            category_tag: 'Tax Deduction Strategy',
            prompt_masked: '29 day old prompt [REDACTED_ZAR]',
            tokens_used: 100,
            model: 'gemini-1.5-flash',
            latency_ms: 150,
            created_at: new Date(NOW - (29 * DAY_MS)).toISOString()
        };

        const rec30DaysExactMinus1m = {
            id: 'tel_test_30d_inside',
            category_tag: 'Gear Purchase Planning',
            prompt_masked: '29.9 day old prompt [REDACTED_ZAR]',
            tokens_used: 120,
            model: 'gemini-1.5-flash',
            latency_ms: 180,
            created_at: new Date(NOW - (30 * DAY_MS) + (60 * 1000)).toISOString()
        };

        const rec31Days = {
            id: 'tel_test_31d',
            category_tag: 'Revenue Optimization',
            prompt_masked: '31 day old prompt [REDACTED_ZAR]',
            tokens_used: 200,
            model: 'gemini-1.5-flash',
            latency_ms: 220,
            created_at: new Date(NOW - (31 * DAY_MS)).toISOString()
        };

        const rec60Days = {
            id: 'tel_test_60d',
            category_tag: 'General Inquiry',
            prompt_masked: '60 day old prompt [REDACTED_ZAR]',
            tokens_used: 50,
            model: 'gemini-1.5-flash',
            latency_ms: 100,
            created_at: new Date(NOW - (60 * DAY_MS)).toISOString()
        };

        memoryDb.ai_telemetry.push(rec29Days, rec30DaysExactMinus1m, rec31Days, rec60Days);

        const telemRes = await request('GET', '/api/admin/telemetry', authHeader);
        testAssertArray(telemRes.body, 'GET /api/admin/telemetry returns an array');

        const returnedIds = telemRes.body.map(t => t.id);

        const includes29d = returnedIds.includes('tel_test_29d');
        const includes30dInside = returnedIds.includes('tel_test_30d_inside');
        const includes31d = returnedIds.includes('tel_test_31d');
        const includes60d = returnedIds.includes('tel_test_60d');

        const ttlPassed = includes29d && includes30dInside && !includes31d && !includes60d;

        recordTest(
            'Telemetry 30-Day TTL Boundary',
            'Includes <=30d old records (29d, 29.9d) and filters out >30d records (31d, 60d)',
            ttlPassed,
            `29d included: ${includes29d}, 29.9d included: ${includes30dInside}, 31d excluded: ${!includes31d}, 60d excluded: ${!includes60d}`
        );

        // =====================================================================
        // SECTION 4: High Load & Concurrency Stress Test
        // =====================================================================
        console.log('\n--- SECTION 4: Concurrent Mutations & Audit Log Throughput ---');

        const CONCURRENT_REQUESTS = 50;
        console.log(`Executing ${CONCURRENT_REQUESTS} concurrent creator status mutations...`);

        const startAuditCount = memoryDb.audit_logs.length;
        const mutationPromises = [];

        for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
            const statusVal = i % 2 === 0 ? 'active' : 'suspended';
            const tierVal = i % 3 === 0 ? 'Pro' : 'Free';
            const noteVal = `Stress load test iteration #${i}`;
            
            mutationPromises.push(
                request('POST', '/api/admin/creators/usr_seed_1/status', authHeader, {
                    status: statusVal,
                    plan_tier: tierVal,
                    note: noteVal
                })
            );
        }

        const responses = await Promise.all(mutationPromises);

        const allSuccessful = responses.every(r => r.status === 200 && r.body.success === true);
        const endAuditCount = memoryDb.audit_logs.length;
        const auditLogsAdded = endAuditCount - startAuditCount;

        const concurrencyPassed = allSuccessful && auditLogsAdded === CONCURRENT_REQUESTS;

        recordTest(
            'Concurrency & Throughput',
            `Successfully processed ${CONCURRENT_REQUESTS} concurrent status mutations with exact audit log creation`,
            concurrencyPassed,
            `All HTTP 200: ${allSuccessful} | Audit Logs Added: ${auditLogsAdded}/${CONCURRENT_REQUESTS}`
        );

        // Verify audit log order & integrity after high load
        const auditRes = await request('GET', '/api/admin/audit-logs', authHeader);
        const isChronological = auditRes.body.every((entry, idx) => {
            if (idx === 0) return true;
            return new Date(entry.timestamp) <= new Date(auditRes.body[idx - 1].timestamp);
        });

        recordTest(
            'Audit Log Integrity',
            'GET /api/admin/audit-logs returns entries in descending chronological order post-stress',
            isChronological && auditRes.body.length >= CONCURRENT_REQUESTS,
            `Chronological Order: ${isChronological} | Total Audit Records: ${auditRes.body.length}`
        );

    } catch (err) {
        console.error('❌ STRESS TEST EXECUTION CRASHED:', err);
    } finally {
        if (server) {
            await new Promise(resolve => server.close(resolve));
            console.log('\nTest server shut down gracefully.');
        }
    }

    // Print Final Summary
    console.log('\n================================================================');
    console.log('📊 STRESS TEST SUMMARY REPORT');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`Total Scenarios Tested : ${total}`);
    console.log(`Passed                 : ${passed}`);
    console.log(`Failed                 : ${failed}`);
    console.log('================================================================\n');

    return { total, passed, failed, results };
}

function testAssertArray(arr, msg) {
    if (!Array.isArray(arr)) {
        throw new Error(`Expected array for: ${msg}`);
    }
}

if (require.main === module) {
    runStressTest().then(res => {
        if (res.failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    });
}

module.exports = { runStressTest };
