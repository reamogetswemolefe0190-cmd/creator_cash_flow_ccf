/* ==========================================================================
   Creator Cash Flow - Milestone M3 Automated Verification Test Suite
   ========================================================================== */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag } = require('./server');

let server = null;
let baseUrl = '';

// Helper to make HTTP requests
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

// Generate valid test JWT tokens
const adminToken = jwt.sign(
    { id: 'admin_test_1', email: 'admin@creatorcashflow.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const creatorToken = jwt.sign(
    { id: 'usr_seed_1', email: 'naledi@creator.co.za', name: 'Naledi Molefe' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload';

async function runM3TestSuite() {
    console.log('====================================================');
    console.log('🧪 Running M3 Audit Logging & PII Telemetry API Tests');
    console.log('====================================================\n');

    // Start server on dynamic port
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    let passedCount = 0;
    let totalCount = 0;

    function testAssert(condition, message) {
        totalCount++;
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passedCount++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    try {
        // ----------------------------------------------------
        // TEST 1: MemoryDb Accessors Verification
        // ----------------------------------------------------
        console.log('1. MemoryDb Accessors & Alias Verification');
        testAssert(Array.isArray(memoryDb.audit_logs), 'memoryDb.audit_logs is an array');
        testAssert(Array.isArray(memoryDb.auditLogs), 'memoryDb.auditLogs alias is an array');
        testAssert(memoryDb.auditLogs === memoryDb.audit_logs, 'memoryDb.auditLogs references memoryDb.audit_logs');
        testAssert(Array.isArray(memoryDb.ai_telemetry), 'memoryDb.ai_telemetry is an array');
        testAssert(Array.isArray(memoryDb.aiTelemetry), 'memoryDb.aiTelemetry alias is an array');
        testAssert(memoryDb.aiTelemetry === memoryDb.ai_telemetry, 'memoryDb.aiTelemetry references memoryDb.ai_telemetry');
        console.log('');

        // ----------------------------------------------------
        // TEST 2: GET /api/admin/creators Endpoint & Auth Guards
        // ----------------------------------------------------
        console.log('2. GET /api/admin/creators Auth Guards & Directory Fetch');
        let res = await request('GET', '/api/admin/creators');
        testAssert(res.status === 401, 'Missing token returns HTTP 401');

        res = await request('GET', '/api/admin/creators', { 'Authorization': `Bearer ${creatorToken}` });
        testAssert(res.status === 403, 'Non-admin token returns HTTP 403');

        res = await request('GET', '/api/admin/creators', { 'Authorization': `Bearer ${adminToken}` });
        testAssert(res.status === 200, 'Valid admin token returns HTTP 200');
        testAssert(Array.isArray(res.body), 'Response is an array of creators');
        testAssert(res.body.length >= 10, `Returned ${res.body.length} creators (>= 10 expected)`);
        const sampleCreator = res.body.find(c => c.id === 'usr_seed_1');
        testAssert(sampleCreator && sampleCreator.email === 'naledi@creator.co.za', 'Creator details match seeded data');
        console.log('');

        // ----------------------------------------------------
        // TEST 3: POST /api/admin/creators/:id/status Auth & Validation Guards
        // ----------------------------------------------------
        console.log('3. POST /api/admin/creators/:id/status Auth & Validation Guards');
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', {}, { status: 'suspended' });
        testAssert(res.status === 401, 'Missing token returns HTTP 401');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${creatorToken}` }, { status: 'suspended' });
        testAssert(res.status === 403, 'Non-admin token returns HTTP 403');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, { status: 'invalid_status' });
        testAssert(res.status === 400, 'Invalid status returns HTTP 400');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, { plan_tier: 'Gold' });
        testAssert(res.status === 400, 'Invalid plan_tier returns HTTP 400');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {});
        testAssert(res.status === 400, 'Empty mutation body returns HTTP 400');

        res = await request('POST', '/api/admin/creators/nonexistent_usr_999/status', { 'Authorization': `Bearer ${adminToken}` }, { status: 'suspended' });
        testAssert(res.status === 404, 'Nonexistent creator ID returns HTTP 404');
        console.log('');

        // ----------------------------------------------------
        // TEST 4: Creator Status Mutation & Immutable Audit Logging
        // ----------------------------------------------------
        console.log('4. Creator Status & Tier Mutation with Audit Entry Generation');
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            status: 'suspended',
            plan_tier: 'Pro',
            note: 'Under policy review'
        });
        testAssert(res.status === 200, 'Status mutation returns HTTP 200');
        testAssert(res.body.success === true, 'Response contains success: true');
        testAssert(res.body.creator && res.body.creator.status === 'suspended', 'Creator status updated to suspended');
        testAssert(res.body.creator.plan_tier === 'Pro', 'Creator plan_tier remains Pro');

        const auditEntry = res.body.audit_entry;
        testAssert(auditEntry && auditEntry.id.startsWith('audit_'), 'Audit entry has valid ID prefix');
        testAssert(auditEntry.admin_id === 'admin_test_1', 'Audit entry records admin_id');
        testAssert(auditEntry.target_creator_id === 'usr_seed_1', 'Audit entry records target_creator_id');
        testAssert(auditEntry.action_type === 'STATUS_CHANGE', 'Audit entry action_type is STATUS_CHANGE');
        testAssert(auditEntry.old_value.includes('active'), 'Audit old_value contains previous status active');
        testAssert(auditEntry.new_value.includes('suspended'), 'Audit new_value contains new status suspended');
        testAssert(auditEntry.new_value.includes('Under policy review'), 'Audit new_value contains admin note');
        testAssert(typeof auditEntry.ip_hash === 'string' && auditEntry.ip_hash.length === 16, 'ip_hash is a 16-character SHA256 prefix');
        console.log('');

        // ----------------------------------------------------
        // TEST 5: Creator Plan Tier Mutation
        // ----------------------------------------------------
        console.log('5. Creator Plan Tier Mutation (Free -> Pro)');
        res = await request('POST', '/api/admin/creators/usr_seed_4/status', { 'Authorization': `Bearer ${adminToken}` }, {
            plan_tier: 'Pro',
            note: 'Promoted to Pro tier'
        });
        testAssert(res.status === 200, 'Plan tier mutation returns HTTP 200');
        testAssert(res.body.creator.plan_tier === 'Pro', 'Creator plan_tier updated to Pro');
        testAssert(res.body.audit_entry.action_type === 'TIER_CHANGE', 'Audit action_type is TIER_CHANGE');
        console.log('');

        // ----------------------------------------------------
        // TEST 6: GET /api/admin/audit-logs Endpoint
        // ----------------------------------------------------
        console.log('6. GET /api/admin/audit-logs Endpoint & Auth Verification');
        res = await request('GET', '/api/admin/audit-logs');
        testAssert(res.status === 401, 'Missing token returns HTTP 401');

        res = await request('GET', '/api/admin/audit-logs', { 'Authorization': `Bearer ${creatorToken}` });
        testAssert(res.status === 403, 'Non-admin token returns HTTP 403');

        res = await request('GET', '/api/admin/audit-logs', { 'Authorization': `Bearer ${adminToken}` });
        testAssert(res.status === 200, 'Valid admin token returns HTTP 200');
        testAssert(Array.isArray(res.body), 'Response is an array of audit logs');
        testAssert(res.body.length >= 2, `Returned ${res.body.length} audit records (>= 2 expected)`);
        const foundAudit = res.body.find(a => a.target_creator_id === 'usr_seed_1');
        testAssert(foundAudit && foundAudit.ip_hash.length === 16, 'Retrieved audit entry contains valid ip_hash');
        console.log('');

        // ----------------------------------------------------
        // TEST 7: PII Masking Unit Function Tests
        // ----------------------------------------------------
        console.log('7. PII & Financial Masking Function (maskPII) Verification');
        const emailTest = maskPII('Contact naledi@creator.co.za for details');
        testAssert(emailTest === 'Contact [REDACTED_EMAIL] for details', 'Redacts email addresses');

        const phoneTest = maskPII('Call me at 082 123 4567 or +27821234567');
        testAssert(phoneTest === 'Call me at [REDACTED_PHONE] or [REDACTED_PHONE]', 'Redacts SA & Intl phone numbers');

        const zarTest1 = maskPII('I purchased a camera for R1,500 and lens for R500');
        testAssert(zarTest1 === 'I purchased a camera for [REDACTED_ZAR] and lens for [REDACTED_ZAR]', 'Redacts R1,500 and R500');

        const zarTest2 = maskPII('Revenue from TikTok was ZAR 5000 and Patreon R1 500');
        testAssert(zarTest2 === 'Revenue from TikTok was [REDACTED_ZAR] and Patreon [REDACTED_ZAR]', 'Redacts ZAR 5000 and R1 500');

        const zarTest3 = maskPII('Total income was 5000 ZAR');
        testAssert(zarTest3 === 'Total income was [REDACTED_ZAR]', 'Redacts 5000 ZAR suffix format');
        console.log('');

        // ----------------------------------------------------
        // TEST 8: Category Tag Classifier Verification
        // ----------------------------------------------------
        console.log('8. Category Tag Classification (inferCategoryTag) Verification');
        testAssert(inferCategoryTag('How do I calculate SARS tax deduction for my home studio?') === 'Tax Deduction Strategy', 'Classifies SARS/Tax query');
        testAssert(inferCategoryTag('Should I buy a new Sony camera lens for R15,000?') === 'Gear Purchase Planning', 'Classifies Gear/Lens query');
        testAssert(inferCategoryTag('How can I grow my YouTube AdSense and TikTok sponsorship revenue?') === 'Revenue Optimization', 'Classifies Revenue/AdSense query');
        testAssert(inferCategoryTag('What is Creator Cash Flow?') === 'General Inquiry', 'Classifies general query');
        console.log('');

        // ----------------------------------------------------
        // TEST 9: POST /api/gemini Telemetry Logging
        // ----------------------------------------------------
        console.log('9. POST /api/gemini Telemetry Record Generation');
        res = await request('POST', '/api/gemini', {}, {
            prompt: 'How do I claim a tax write-off for my R2,500 microphone? Email naledi@creator.co.za or call 0825551234.'
        });
        testAssert(res.status === 200 || res.status === 503, 'POST /api/gemini returns HTTP 200 or 503');

        const latestTelemetry = memoryDb.ai_telemetry[memoryDb.ai_telemetry.length - 1];
        testAssert(latestTelemetry && latestTelemetry.id.startsWith('tel_'), 'Telemetry entry logged with valid ID');
        testAssert(latestTelemetry.category_tag === 'Tax Deduction Strategy', 'Telemetry categorized as Tax Deduction Strategy');
        testAssert(!latestTelemetry.prompt_masked.includes('naledi@creator.co.za'), 'Email redacted in logged telemetry');
        testAssert(latestTelemetry.prompt_masked.includes('[REDACTED_EMAIL]'), 'Contains [REDACTED_EMAIL]');
        testAssert(!latestTelemetry.prompt_masked.includes('R2,500'), 'Currency redacted in logged telemetry');
        testAssert(latestTelemetry.prompt_masked.includes('[REDACTED_ZAR]'), 'Contains [REDACTED_ZAR]');
        testAssert(!latestTelemetry.prompt_masked.includes('0825551234'), 'Phone redacted in logged telemetry');
        testAssert(latestTelemetry.prompt_masked.includes('[REDACTED_PHONE]'), 'Contains [REDACTED_PHONE]');
        testAssert(typeof latestTelemetry.tokens_used === 'number' && latestTelemetry.tokens_used > 0, 'tokens_used is calculated');
        testAssert(typeof latestTelemetry.latency_ms === 'number', 'latency_ms is measured');
        testAssert(latestTelemetry.model === 'gemini-1.5-flash', 'model is gemini-1.5-flash');
        console.log('');

        // ----------------------------------------------------
        // TEST 10: GET /api/admin/telemetry & 30-Day TTL Policy Filter
        // ----------------------------------------------------
        console.log('10. GET /api/admin/telemetry & 30-Day TTL Policy Filter Verification');
        res = await request('GET', '/api/admin/telemetry');
        testAssert(res.status === 401, 'Missing token returns HTTP 401');

        res = await request('GET', '/api/admin/telemetry', { 'Authorization': `Bearer ${creatorToken}` });
        testAssert(res.status === 403, 'Non-admin token returns HTTP 403');

        // Inject an expired telemetry entry (35 days old) directly into memoryDb
        const EXPIRED_DATE_ISO = new Date(Date.now() - (35 * 24 * 60 * 60 * 1000)).toISOString();
        memoryDb.ai_telemetry.push({
            id: 'tel_expired_old_entry',
            category_tag: 'General Inquiry',
            prompt_masked: 'Expired query from 35 days ago',
            tokens_used: 15,
            model: 'gemini-1.5-flash',
            latency_ms: 100,
            created_at: EXPIRED_DATE_ISO
        });

        res = await request('GET', '/api/admin/telemetry', { 'Authorization': `Bearer ${adminToken}` });
        testAssert(res.status === 200, 'Valid admin token returns HTTP 200');
        testAssert(Array.isArray(res.body), 'Response is an array of telemetry logs');
        
        const hasExpiredEntry = res.body.some(t => t.id === 'tel_expired_old_entry');
        testAssert(!hasExpiredEntry, 'Expired entry (>30 days old) is filtered out by 30-day TTL policy');

        const hasRecentEntry = res.body.some(t => t.id === latestTelemetry.id);
        testAssert(hasRecentEntry, 'Recent telemetry entry (<30 days old) is included');
        console.log('');

        console.log('====================================================');
        console.log(`🎉 ALL TESTS PASSED: ${passedCount}/${totalCount} assertions passed successfully!`);
        console.log('====================================================\n');

    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runM3TestSuite();
}
