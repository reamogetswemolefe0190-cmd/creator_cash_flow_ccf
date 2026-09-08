/**
 * ============================================================================
 * Challenger 2 Adversarial Stress Test Suite: Milestone M2
 * Focus: Error Normalization, Boundaries, Malformed Payloads & PII Concurrency
 * ============================================================================
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag, getClientIp } = require('../server');
const { generateContent } = require('../services/geminiService');

let server = null;
let baseUrl = '';
let passed = 0;
let failed = 0;
const failures = [];

function check(desc, condition, extraInfo = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${desc} ${extraInfo ? `(${extraInfo})` : ''}`);
        failed++;
        failures.push({ desc, extraInfo });
    }
}

// Low-level raw HTTP request sender capable of sending malformed/raw payloads
function rawRequest(method, path, headers = {}, rawBody = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const reqHeaders = { ...headers };

        if (rawBody !== null && !reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
            reqHeaders['Content-Length'] = Buffer.byteLength(rawBody);
        }

        const req = http.request(url, { method, headers: reqHeaders }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (_) {
                    json = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: json, rawData: data });
            });
        });

        req.on('error', reject);
        if (rawBody !== null) {
            req.write(rawBody);
        }
        req.end();
    });
}

function jsonRequest(method, path, headers = {}, body = null) {
    const bodyStr = body !== null ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (bodyStr !== null) {
        reqHeaders['Content-Type'] = 'application/json';
    }
    return rawRequest(method, path, reqHeaders, bodyStr);
}

// Admin & Creator JWT Tokens
function getAdminToken(id = 'admin_challenger_2') {
    return jwt.sign(
        { id, email: `${id}@creatorcashflow.com`, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

const adminToken = getAdminToken('admin_challenger_2');

const creatorToken = jwt.sign(
    { id: 'usr_seed_1', email: 'naledi@creator.co.za', name: 'Naledi Molefe' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runSuite() {
    console.log('==============================================================================');
    console.log('🔥 CHALLENGER 2: ADVERSARIAL STRESS TEST & BOUNDARY HARNESS (MILESTONE M2)');
    console.log('==============================================================================\n');

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Ephemeral challenger test server running on ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ====================================================================
        // SECTION 1: MALFORMED PAYLOADS & CONTENT-TYPE ROBUSTNESS
        // ====================================================================
        console.log('--- SECTION 1: Malformed Payloads & Express Error Middleware Normalization ---');

        // 1.1 Incomplete/Broken JSON syntax
        const brokenJsonList = [
            '{"name": "Incomplete',
            '{"email": "broken", }',
            '{"email": "unquoted": value}',
            '{ bad_json: true }',
            '{"amount": 100,, "type": "income"}'
        ];

        for (let i = 0; i < brokenJsonList.length; i++) {
            const res = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, brokenJsonList[i]);
            check(
                `Broken JSON #${i + 1} returns HTTP 400 with INVALID_JSON code`,
                res.status === 400 && res.body && res.body.code === 'INVALID_JSON' && res.body.success === false,
                `status=${res.status}, body=${JSON.stringify(res.body)}`
            );
            check(
                `Broken JSON #${i + 1} does not leak HTML or stack traces`,
                typeof res.body === 'object' && !String(res.rawData).includes('<!DOCTYPE') && !String(res.rawData).includes('SyntaxError')
            );
        }

        // 1.2 Binary garbage with application/json header
        const binaryGarbage = Buffer.from([0x00, 0x1f, 0x8b, 0xff, 0xfe, 0x00, 0x41, 0x42]);
        const resBin = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, binaryGarbage);
        check(
            'Binary garbage payload returns HTTP 400 INVALID_JSON',
            resBin.status === 400 && resBin.body && resBin.body.code === 'INVALID_JSON',
            `status=${resBin.status}`
        );

        // 1.3 Unexpected content types (e.g. text/plain, application/xml)
        const resText = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'text/plain' }, 'email=test%40test.com');
        check(
            'text/plain content type handled gracefully with HTTP 400',
            resText.status === 400 && resText.body && resText.body.success === false,
            `status=${resText.status}`
        );

        const resXml = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'application/xml' }, '<xml><email>test</email></xml>');
        check(
            'application/xml content type handled gracefully with HTTP 400',
            resXml.status === 400 && resXml.body && resXml.body.success === false,
            `status=${resXml.status}`
        );

        // 1.4 Empty body with application/json
        const resEmpty = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, '');
        check(
            'Empty JSON body on login handled cleanly with HTTP 400',
            resEmpty.status === 400 && resEmpty.body && resEmpty.body.success === false
        );

        // 1.5 Truncated JSON body (structure truncated mid-payload)
        const truncatedPayloads = [
            '{"email": "test@test.com", "password": "pass',
            '{"amount": 500, "merchant": "Incomp',
            '{"status": "active", "note": "'
        ];

        for (let i = 0; i < truncatedPayloads.length; i++) {
            const resTrunc = await rawRequest('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, truncatedPayloads[i]);
            check(
                `Truncated JSON payload #${i + 1} returns HTTP 400 with INVALID_JSON`,
                resTrunc.status === 400 && resTrunc.body && resTrunc.body.code === 'INVALID_JSON' && resTrunc.body.success === false,
                `status=${resTrunc.status}, body=${JSON.stringify(resTrunc.body)}`
            );
        }

        // 1.6 Abrupt socket disconnection mid-stream (TCP truncated transmission)
        await new Promise((resolve) => {
            const url = new URL(baseUrl + '/api/auth/login');
            const req = http.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            req.on('error', () => {
                // Expected client-side error on destroy
                resolve();
            });
            req.write('{"aborted":');
            // Abruptly destroy socket mid-transmission
            setTimeout(() => {
                req.destroy();
                resolve();
            }, 50);
        });

        // Verify server is alive and functioning normally after socket abort
        const resLiveness = await jsonRequest('GET', '/api/health');
        check(
            'Server remains healthy and responsive after client socket abort',
            resLiveness.status === 200 && resLiveness.body && (resLiveness.body.status === 'active' || resLiveness.body.status === 'healthy'),
            `status=${resLiveness.status}, bodyStatus=${resLiveness.body?.status}`
        );

        // ====================================================================
        // SECTION 2: 404 UNMATCHED ROUTE ENVELOPES & CONTENT NEGOTIATION
        // ====================================================================
        console.log('\n--- SECTION 2: 404 Route Handler JSON Envelope Verification ---');

        const nonExistentRoutes = [
            { method: 'GET', path: '/api/nonexistent' },
            { method: 'POST', path: '/api/unknown/endpoint' },
            { method: 'PUT', path: '/api/creators/bogus/settings' },
            { method: 'DELETE', path: '/api/admin/audit-logs/delete-all' },
            { method: 'PATCH', path: '/api/v1/beta/features' },
            { method: 'GET', path: '/api/' }
        ];

        for (const route of nonExistentRoutes) {
            const res = await jsonRequest(route.method, route.path);
            check(
                `${route.method} ${route.path} returns HTTP 404`,
                res.status === 404,
                `status=${res.status}`
            );
            check(
                `${route.method} ${route.path} returns Content-Type application/json`,
                String(res.headers['content-type']).includes('application/json')
            );
            check(
                `${route.method} ${route.path} has exact standard envelope { success: false, error: 'Not Found', code: 'ROUTE_NOT_FOUND' }`,
                res.body && res.body.success === false && res.body.error === 'Not Found' && res.body.code === 'ROUTE_NOT_FOUND',
                `body=${JSON.stringify(res.body)}`
            );
        }

        // ====================================================================
        // SECTION 3: ADMIN STATUS MUTATION BOUNDARY HARNESS
        // ====================================================================
        console.log('\n--- SECTION 3: Admin Status Mutation Boundary & Validation Stress ---');

        const adminTokenNotes = getAdminToken('admin_challenger_notes');
        const adminTokenStatus = getAdminToken('admin_challenger_status');
        const adminTokenPlans = getAdminToken('admin_challenger_plans');
        const adminTokenBogus = getAdminToken('admin_challenger_bogus');
        const adminTokenXSS = getAdminToken('admin_challenger_xss');

        // 3.1 Oversized Notes
        // Boundary 1: 501 chars -> rejected
        const note501 = 'A'.repeat(501);
        let resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
            'Authorization': `Bearer ${adminTokenNotes}`
        }, { status: 'suspended', note: note501 });
        check(
            'Admin note of 501 characters is rejected with HTTP 400 (NOTE_TOO_LONG)',
            resAdmin.status === 400 && resAdmin.body.code === 'NOTE_TOO_LONG',
            `status=${resAdmin.status}, code=${resAdmin.body?.code}`
        );

        // Boundary 2: 10,000 chars -> rejected
        const note10k = 'B'.repeat(10000);
        resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
            'Authorization': `Bearer ${adminTokenNotes}`
        }, { status: 'active', note: note10k });
        check(
            'Admin note of 10,000 characters is rejected with HTTP 400 (NOTE_TOO_LONG)',
            resAdmin.status === 400 && resAdmin.body.code === 'NOTE_TOO_LONG'
        );

        // Boundary 3: Exactly 500 chars -> accepted
        const note500 = 'C'.repeat(500);
        resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
            'Authorization': `Bearer ${adminTokenNotes}`
        }, { status: 'active', note: note500 });
        check(
            'Admin note of exactly 500 characters is accepted with HTTP 200',
            resAdmin.status === 200 && resAdmin.body.success === true,
            `status=${resAdmin.status}`
        );

        // Verify audit log has the 500-char note
        const latestAudit = memoryDb.audit_logs[memoryDb.audit_logs.length - 1];
        check(
            'Audit log records 500-character note in new_value JSON',
            latestAudit && latestAudit.new_value.includes(note500)
        );

        // Boundary 4: Invalid Note Types (number, boolean, object, array)
        for (const badNote of [12345, true, { text: 'note' }, ['array', 'note']]) {
            resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
                'Authorization': `Bearer ${adminTokenNotes}`
            }, { status: 'active', note: badNote });
            check(
                `Admin non-string note (${typeof badNote}) rejected with HTTP 400 (INVALID_NOTE)`,
                resAdmin.status === 400 && resAdmin.body.code === 'INVALID_NOTE'
            );
        }

        // 3.2 Invalid Status Values
        const invalidStatuses = ['banned', 'deleted', 'archived', 'pending', 'ACTIVE_NOW', 'null', '123'];
        for (const badStatus of invalidStatuses) {
            resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
                'Authorization': `Bearer ${adminTokenStatus}`
            }, { status: badStatus });
            check(
                `Invalid status '${badStatus}' rejected with HTTP 400 (INVALID_STATUS_VALUE)`,
                resAdmin.status === 400 && resAdmin.body.code === 'INVALID_STATUS_VALUE',
                `status=${resAdmin.status}, code=${resAdmin.body?.code}`
            );
        }

        // Invalid Status Non-String Types
        for (const badStatusType of [999, true, { status: 'active' }, ['active']]) {
            resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
                'Authorization': `Bearer ${adminTokenStatus}`
            }, { status: badStatusType });
            check(
                `Invalid status type (${typeof badStatusType}) rejected with HTTP 400 (INVALID_STATUS)`,
                resAdmin.status === 400 && resAdmin.body.code === 'INVALID_STATUS'
            );
        }

        // 3.3 Invalid Plan Tiers
        const invalidPlans = ['Enterprise', 'enterprise', 'Gold', 'Silver', 'Premium', 'VIP', 'PRO_PLUS'];
        for (const badPlan of invalidPlans) {
            resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
                'Authorization': `Bearer ${adminTokenPlans}`
            }, { plan_tier: badPlan });
            check(
                `Invalid plan_tier '${badPlan}' rejected with HTTP 400 (INVALID_PLAN_TIER_VALUE)`,
                resAdmin.status === 400 && resAdmin.body.code === 'INVALID_PLAN_TIER_VALUE'
            );
        }

        // Invalid Plan Non-String Types
        for (const badPlanType of [100, false, { tier: 'pro' }, ['Pro']]) {
            resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
                'Authorization': `Bearer ${adminTokenPlans}`
            }, { plan_tier: badPlanType });
            check(
                `Invalid plan_tier type (${typeof badPlanType}) rejected with HTTP 400 (INVALID_PLAN_TIER)`,
                resAdmin.status === 400 && resAdmin.body.code === 'INVALID_PLAN_TIER'
            );
        }

        // 3.4 Non-existent Creator IDs
        const bogusCreatorIds = [
            'usr_does_not_exist_999999',
            'nonexistent_id_abc',
            '../../etc/passwd',
            '<script>alert("xss")</script>'
        ];
        for (const bogusId of bogusCreatorIds) {
            resAdmin = await jsonRequest('POST', `/api/admin/creators/${encodeURIComponent(bogusId)}/status`, {
                'Authorization': `Bearer ${adminTokenBogus}`
            }, { status: 'suspended', note: 'Testing 404 creator not found' });
            check(
                `Non-existent creator ID '${bogusId}' returns HTTP 404 (CREATOR_NOT_FOUND)`,
                resAdmin.status === 404 && resAdmin.body.code === 'CREATOR_NOT_FOUND',
                `status=${resAdmin.status}, body=${JSON.stringify(resAdmin.body)}`
            );
        }

        // 3.5 HTML / XSS Injection in Note Sanitization
        resAdmin = await jsonRequest('POST', '/api/admin/creators/usr_seed_1/status', {
            'Authorization': `Bearer ${adminTokenXSS}`
        }, { status: 'active', note: '<b>Investigate</b> <script>alert(1)</script> suspicious activity' });
        check(
            'HTML tags in admin note are stripped by sanitizeString',
            resAdmin.status === 200 && resAdmin.body.success === true
        );
        const lastAuditSanitized = memoryDb.audit_logs[memoryDb.audit_logs.length - 1];
        check(
            'Audit log stores sanitized note without HTML tags',
            lastAuditSanitized && !lastAuditSanitized.new_value.includes('<script>') && lastAuditSanitized.new_value.includes('Investigate alert(1) suspicious activity')
        );

        // ====================================================================
        // SECTION 4: PII MASKING INTEGRITY & CONCURRENCY STRESS (geminiService)
        // ====================================================================
        console.log('\n--- SECTION 4: PII Masking Empirical Stress & Concurrency ---');

        // 4.1 South African Phone Number Formats
        const saPhoneNumbers = [
            '0821234567',
            '082 123 4567',
            '082-123-4567',
            '+27821234567',
            '+27 82 123 4567',
            '+27-82-123-4567',
            '011 234 5678',
            '011-234-5678',
            '(011) 234-5678',
            '021 555 1234',
            '031 987 6543',
            '071 234 5678',
            '0841234567'
        ];

        for (const phone of saPhoneNumbers) {
            const input = `Please call my mobile at ${phone} to discuss tax strategies.`;
            const masked = maskPII(input);
            check(
                `Masks SA phone format '${phone}'`,
                masked.includes('[REDACTED_PHONE]') && !masked.includes(phone),
                `result='${masked}'`
            );
        }

        // 4.2 International Phone Formats
        const intlPhones = [
            '+1 555 123 4567',
            '+44 20 7946 0958',
            '(555) 123-4567'
        ];
        for (const phone of intlPhones) {
            const input = `Reach our US agent on ${phone} immediately.`;
            const masked = maskPII(input);
            check(
                `Masks int'l phone format '${phone}'`,
                masked.includes('[REDACTED_PHONE]') && !masked.includes(phone),
                `result='${masked}'`
            );
        }

        // 4.3 Email Formats
        const emails = [
            'creator@domain.com',
            'firstname.lastname@company.co.za',
            'creator+tax2026@sub.domain.org',
            'support@creatorcashflow.africa',
            'user12345@gmail.com'
        ];
        for (const email of emails) {
            const input = `Send invoices to ${email} for processing.`;
            const masked = maskPII(input);
            check(
                `Masks email '${email}'`,
                masked.includes('[REDACTED_EMAIL]') && !masked.includes(email),
                `result='${masked}'`
            );
        }

        // 4.4 Currency Formats (ZAR / R)
        const currencySamples = [
            { text: 'My YouTube earnings are R1500 this month.', expect: '[REDACTED_ZAR]' },
            { text: 'I received R1,500 from Patreon.', expect: '[REDACTED_ZAR]' },
            { text: 'Total gear cost was R 1,500.00 today.', expect: '[REDACTED_ZAR]' },
            { text: 'Bought camera lens for R500.', expect: '[REDACTED_ZAR]' },
            { text: 'AdSense paid ZAR 5000 yesterday.', expect: '[REDACTED_ZAR]' },
            { text: 'Deposit of ZAR 5,000.50 confirmed.', expect: '[REDACTED_ZAR]' },
            { text: 'I invoiced 5000 ZAR to brand.', expect: '[REDACTED_ZAR]' },
            { text: 'Sponsorship deal was 25,000 ZAR net.', expect: '[REDACTED_ZAR]' },
            { text: 'Tax reserve is R15 000.', expect: '[REDACTED_ZAR]' }
        ];
        for (const item of currencySamples) {
            const masked = maskPII(item.text);
            check(
                `Masks currency in: "${item.text}"`,
                masked.includes(item.expect),
                `result='${masked}'`
            );
        }

        // 4.5 Complex Multi-PII Dense String
        const multiPii = 'Hi, I am Alex. Call +27 82 111 2222 or email alex@topcreator.co.za. I earned R85,000 from YouTube and 45000 ZAR from TikTok. Also paid R3,250 for gear. Call office at (011) 555-1234.';
        const maskedMulti = maskPII(multiPii);
        check(
            'Multi-PII input masks all email occurrences',
            !maskedMulti.includes('alex@topcreator.co.za') && (maskedMulti.match(/\[REDACTED_EMAIL\]/g) || []).length === 1
        );
        check(
            'Multi-PII input masks all phone occurrences (mobile & landline)',
            !maskedMulti.includes('+27 82 111 2222') && !maskedMulti.includes('(011) 555-1234') && (maskedMulti.match(/\[REDACTED_PHONE\]/g) || []).length >= 2
        );
        check(
            'Multi-PII input masks all ZAR currencies',
            !maskedMulti.includes('R85,000') && !maskedMulti.includes('45000 ZAR') && !maskedMulti.includes('R3,250') && (maskedMulti.match(/\[REDACTED_ZAR\]/g) || []).length >= 3
        );

        // 4.6 Concurrency Stress: 1,000 parallel calls to maskPII
        console.log('\n--- Stress Testing maskPII across 1,000 concurrent asynchronous invocations ---');
        const concurrencyCount = 1000;
        const promises = [];
        let concurrencyFailures = 0;

        for (let i = 0; i < concurrencyCount; i++) {
            promises.push(new Promise((res) => {
                const sampleEmail = `user${i}@sub${i}.example.co.za`;
                const samplePhone = `082${String(i).padStart(7, '0')}`;
                const sampleZar = `R${1000 + i}`;
                const text = `Index ${i}: contact ${sampleEmail}, call ${samplePhone}, earned ${sampleZar}.`;
                
                // execute async tick
                setImmediate(() => {
                    const resMasked = maskPII(text);
                    const valid = resMasked.includes('[REDACTED_EMAIL]') &&
                                  resMasked.includes('[REDACTED_PHONE]') &&
                                  resMasked.includes('[REDACTED_ZAR]') &&
                                  !resMasked.includes(sampleEmail) &&
                                  !resMasked.includes(samplePhone);
                    if (!valid) concurrencyFailures++;
                    res(valid);
                });
            }));
        }

        const concurrencyResults = await Promise.all(promises);
        check(
            `1,000 concurrent maskPII executions passed with zero thread/state leaks (passed: ${concurrencyResults.filter(Boolean).length})`,
            concurrencyFailures === 0,
            `failures=${concurrencyFailures}`
        );

        // 4.7 Real Endpoint Telemetry Masking Verification
        console.log('\n--- Testing Real Telemetry Logging in POST /api/gemini ---');
        const telemetryPrompt = 'I earned R95,000 from Patreon. Contact me at billing@naledi.co.za or 0721112233.';
        const geminiRes = await jsonRequest('POST', '/api/gemini', {}, { prompt: telemetryPrompt });
        check(
            'POST /api/gemini without API key returns HTTP 503 (AI_NOT_CONFIGURED)',
            geminiRes.status === 503 && geminiRes.body.code === 'AI_NOT_CONFIGURED',
            `status=${geminiRes.status}, body=${JSON.stringify(geminiRes.body)}`
        );

        // Inspect memoryDb.ai_telemetry
        const latestTelemetry = memoryDb.ai_telemetry[memoryDb.ai_telemetry.length - 1];
        check(
            'Telemetry entry was logged in memoryDb.ai_telemetry',
            latestTelemetry !== undefined && latestTelemetry !== null
        );
        check(
            'Telemetry entry prompt_masked has email redacted',
            latestTelemetry && latestTelemetry.prompt_masked.includes('[REDACTED_EMAIL]') && !latestTelemetry.prompt_masked.includes('billing@naledi.co.za')
        );
        check(
            'Telemetry entry prompt_masked has phone redacted',
            latestTelemetry && latestTelemetry.prompt_masked.includes('[REDACTED_PHONE]') && !latestTelemetry.prompt_masked.includes('0721112233')
        );
        check(
            'Telemetry entry prompt_masked has ZAR currency redacted',
            latestTelemetry && latestTelemetry.prompt_masked.includes('[REDACTED_ZAR]') && !latestTelemetry.prompt_masked.includes('R95,000')
        );
        check(
            'Telemetry entry inferred categoryTag correctly',
            latestTelemetry && latestTelemetry.category_tag === 'Revenue Optimization'
        );

        // ====================================================================
        // SECTION 5: TRANSACTION VALIDATION BOUNDARY STRESS
        // ====================================================================
        console.log('\n--- SECTION 5: POST /api/transactions Boundary Stress ---');

        // 5.1 Boundaries for Amount
        const invalidAmounts = [
            { val: 0, reason: 'zero amount' },
            { val: -0.01, reason: 'negative amount' },
            { val: -5000, reason: 'large negative' },
            { val: 100000000.01, reason: 'exceeds 100M cap' },
            { val: 999999999, reason: 'way exceeds 100M cap' },
            { val: 'NaN', reason: 'string NaN' },
            { val: 'Infinity', reason: 'string Infinity' },
            { val: null, reason: 'null amount' },
            { val: undefined, reason: 'undefined amount' },
            { val: 'invalid_number', reason: 'alphabetic string' }
        ];

        for (const item of invalidAmounts) {
            const resTx = await jsonRequest('POST', '/api/transactions', {
                'Authorization': `Bearer ${creatorToken}`
            }, {
                type: 'income',
                amount: item.val,
                merchant: 'Test Boundary Merchant'
            });
            check(
                `Transaction amount ${item.reason} (${item.val}) is rejected with HTTP 400`,
                resTx.status === 400 && resTx.body.success === false,
                `status=${resTx.status}, code=${resTx.body?.code}`
            );
        }

        // Boundary: Upper limit 100,000,000 exactly -> Allowed
        const resMaxTx = await jsonRequest('POST', '/api/transactions', {
            'Authorization': `Bearer ${creatorToken}`
        }, {
            type: 'income',
            amount: 100000000,
            merchant: 'Max Cap Transaction'
        });
        check(
            'Transaction amount at exact 100M cap (100,000,000) is accepted with HTTP 201',
            resMaxTx.status === 201 && resMaxTx.body.success === true,
            `status=${resMaxTx.status}`
        );

        // 5.2 Boundaries for Merchant
        // Empty merchant
        let resMerchant = await jsonRequest('POST', '/api/transactions', {
            'Authorization': `Bearer ${creatorToken}`
        }, {
            type: 'expense',
            amount: 50,
            merchant: ''
        });
        check('Empty merchant is rejected with HTTP 400 (INVALID_MERCHANT)', resMerchant.status === 400);

        // 101 chars merchant -> rejected
        resMerchant = await jsonRequest('POST', '/api/transactions', {
            'Authorization': `Bearer ${creatorToken}`
        }, {
            type: 'expense',
            amount: 50,
            merchant: 'M'.repeat(101)
        });
        check(
            'Merchant length 101 chars is rejected with HTTP 400 (INVALID_MERCHANT_LENGTH)',
            resMerchant.status === 400 && resMerchant.body.code === 'INVALID_MERCHANT_LENGTH'
        );

        // 100 chars merchant -> accepted
        resMerchant = await jsonRequest('POST', '/api/transactions', {
            'Authorization': `Bearer ${creatorToken}`
        }, {
            type: 'expense',
            amount: 50,
            merchant: 'M'.repeat(100)
        });
        check(
            'Merchant length 100 chars is accepted with HTTP 201',
            resMerchant.status === 201 && resMerchant.body.success === true
        );

        // All-HTML merchant -> stripped to empty -> rejected with INVALID_MERCHANT_LENGTH
        resMerchant = await jsonRequest('POST', '/api/transactions', {
            'Authorization': `Bearer ${creatorToken}`
        }, {
            type: 'expense',
            amount: 50,
            merchant: '<script></script><div></div>'
        });
        check(
            'Pure HTML tag merchant is stripped to empty and rejected with HTTP 400 (INVALID_MERCHANT_LENGTH)',
            resMerchant.status === 400 && resMerchant.body.code === 'INVALID_MERCHANT_LENGTH'
        );

        // ====================================================================
        // SUMMARY & RESULTS
        // ====================================================================
        console.log('\n==============================================================================');
        console.log(`📊 ADVERSARIAL STRESS RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('==============================================================================\n');

        if (failed > 0) {
            console.error('FAILURES SUMMARY:');
            failures.forEach(f => console.error(` - ${f.desc} (${f.extraInfo})`));
            process.exitCode = 1;
        }

    } catch (err) {
        console.error('💥 FATAL ERROR during adversarial stress suite execution:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runSuite();
}

module.exports = { runSuite };
