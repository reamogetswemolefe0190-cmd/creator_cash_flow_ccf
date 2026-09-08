/* ==========================================================================
   Creator Cash Flow - Milestone M2 Verification Test Suite
   Verifies:
   1. Schema input validation & sanitization (signup, login, transactions, admin)
   2. Error normalization (consistent JSON envelopes, 404 handler)
   3. AI Gemini endpoint proper HTTP status codes (503 on missing key, 400 on empty prompt)
   4. Frontend XSS elimination & DOM sanitization
   5. Unified Gemini service module integration
   ========================================================================== */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag } = require('../server');
const { generateContent } = require('../services/geminiService');

let server = null;
let baseUrl = '';
let passed = 0;
let failed = 0;

function check(desc, condition) {
    if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${desc}`);
        failed++;
    }
}

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
                } catch (_) {
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

// Generate valid tokens for testing
const adminToken = jwt.sign(
    { id: 'admin_test_m2', email: 'admin@creatorcashflow.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const creatorToken = jwt.sign(
    { id: 'usr_seed_1', email: 'naledi@creator.co.za', name: 'Naledi Molefe' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runM2Verification() {
    console.log('====================================================');
    console.log('🧪 RUNNING MILESTONE M2 COMPREHENSIVE VERIFICATION');
    console.log('====================================================\n');

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ----------------------------------------------------
        // SECTION 1: SCHEMA VALIDATION FOR AUTH SIGNUP
        // ----------------------------------------------------
        console.log('--- 1. Testing Schema Validation for POST /api/auth/signup ---');
        
        let res = await request('POST', '/api/auth/signup', {}, {
            name: 'A', // too short (<2 chars)
            email: 'valid@example.com',
            password: 'Password123!'
        });
        check('Rejects short name (< 2 chars) with HTTP 400', res.status === 400 && res.body.code === 'INVALID_NAME_LENGTH');

        res = await request('POST', '/api/auth/signup', {}, {
            name: 'Valid Name',
            email: 'not-an-email', // invalid regex
            password: 'Password123!'
        });
        check('Rejects invalid email format with HTTP 400', res.status === 400 && res.body.code === 'INVALID_EMAIL_FORMAT');

        res = await request('POST', '/api/auth/signup', {}, {
            name: 'Valid Name',
            email: 'valid@example.com',
            password: 'short' // too short (<8 chars)
        });
        check('Rejects short password (< 8 chars) with HTTP 400', res.status === 400 && res.body.code === 'INVALID_PASSWORD_LENGTH');

        // ----------------------------------------------------
        // SECTION 2: SCHEMA VALIDATION & CRASH PREVENTION FOR LOGIN
        // ----------------------------------------------------
        console.log('\n--- 2. Testing Crash Prevention & Validation for POST /api/auth/login ---');
        
        res = await request('POST', '/api/auth/login', {}, {
            email: 12345, // non-string (would crash email.toLowerCase() without guard)
            password: 'Password123!'
        });
        check('Non-string email returns HTTP 400 (not 500 crash)', res.status === 400 && res.body.success === false);

        res = await request('POST', '/api/auth/login', {}, {
            email: null,
            password: 'Password123!'
        });
        check('Null email returns HTTP 400 (not 500 crash)', res.status === 400 && res.body.code === 'MISSING_EMAIL');

        res = await request('POST', '/api/auth/login', {}, {
            email: 'valid@example.com',
            password: '' // empty password
        });
        check('Empty password returns HTTP 400', res.status === 400 && res.body.code === 'MISSING_PASSWORD');

        // ----------------------------------------------------
        // SECTION 3: SCHEMA VALIDATION FOR TRANSACTIONS
        // ----------------------------------------------------
        console.log('\n--- 3. Testing Schema Validation for POST /api/transactions ---');
        
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'invalid_type', // not income or expense
            amount: 1000,
            merchant: 'Test Merchant'
        });
        check('Rejects invalid type with HTTP 400', res.status === 400 && res.body.code === 'INVALID_TRANSACTION_TYPE');

        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: -500, // negative amount
            merchant: 'Test Merchant'
        });
        check('Rejects negative amount with HTTP 400', res.status === 400 && res.body.code === 'INVALID_AMOUNT');

        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 'not_a_number', // NaN amount
            merchant: 'Test Merchant'
        });
        check('Rejects NaN amount with HTTP 400', res.status === 400 && res.body.code === 'INVALID_AMOUNT');

        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 150000000, // exceeds 100M cap
            merchant: 'Test Merchant'
        });
        check('Rejects amount exceeding 100M cap with HTTP 400', res.status === 400 && res.body.code === 'AMOUNT_EXCEEDS_LIMIT');

        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 500,
            merchant: '' // empty merchant
        });
        check('Rejects empty merchant with HTTP 400', res.status === 400 && res.body.code === 'INVALID_MERCHANT');

        // Test sanitization of merchant input with HTML tags
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 2500,
            merchant: '<b>Patreon</b> <script>alert(1)</script>'
        });
        check('Sanitizes HTML tags from merchant description', res.status === 201 && res.body.transaction.merchant === 'Patreon alert(1)');

        // ----------------------------------------------------
        // SECTION 4: ADMIN STATUS MUTATION VALIDATION
        // ----------------------------------------------------
        console.log('\n--- 4. Testing Schema Validation for POST /api/admin/creators/:id/status ---');
        
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            status: 'invalid_status'
        });
        check('Rejects invalid status with HTTP 400', res.status === 400 && res.body.code === 'INVALID_STATUS_VALUE');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            plan_tier: 'Enterprise' // not Pro or Free
        });
        check('Rejects invalid plan_tier with HTTP 400', res.status === 400 && res.body.code === 'INVALID_PLAN_TIER_VALUE');

        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            note: 'A'.repeat(501) // note exceeds 500 chars
        });
        check('Rejects note exceeding 500 chars with HTTP 400', res.status === 400 && res.body.code === 'NOTE_TOO_LONG');

        // ----------------------------------------------------
        // SECTION 5: AI GEMINI ENDPOINT STATUS CODES & NORMALIZATION
        // ----------------------------------------------------
        console.log('\n--- 5. Testing Gemini Endpoint Error Normalization (HTTP 503/400, Not 200) ---');
        
        res = await request('POST', '/api/gemini', {}, {
            prompt: '' // empty prompt
        });
        check('Rejects empty prompt with HTTP 400', res.status === 400 && res.body.success === false && res.body.code === 'INVALID_PROMPT');

        res = await request('POST', '/api/gemini', {}, {
            prompt: 'How much should I hold for provisional tax in South Africa?'
        });
        // Without GEMINI_API_KEY, must return HTTP 503 Service Unavailable, NOT HTTP 200
        check('Missing API key returns HTTP 503 (not 200)', res.status === 503);
        check('Error envelope contains success: false and code', res.body.success === false && res.body.code === 'AI_NOT_CONFIGURED');
        check('Error envelope maintains top-level error message', typeof res.body.error === 'string' && res.body.error.length > 0);

        // ----------------------------------------------------
        // SECTION 6: UNMATCHED ROUTE 404 JSON HANDLER
        // ----------------------------------------------------
        console.log('\n--- 6. Testing 404 Route Handler JSON Envelope ---');
        
        res = await request('GET', '/api/unmatched-test-endpoint-' + Date.now());
        check('Unmatched route returns HTTP 404', res.status === 404);
        check('404 response is valid JSON with ROUTE_NOT_FOUND code', res.body.code === 'ROUTE_NOT_FOUND' && res.body.success === false);

        // ----------------------------------------------------
        // SECTION 7: SHARED GEMINI SERVICE INTEGRATION & RE-EXPORTS
        // ----------------------------------------------------
        console.log('\n--- 7. Testing Unified Gemini Service & Server Re-Exports ---');
        
        check('server re-exports maskPII function', typeof maskPII === 'function');
        check('server re-exports inferCategoryTag function', typeof inferCategoryTag === 'function');
        
        const testMasked = maskPII('Contact test@creator.com or call 0821234567 regarding R15,000 revenue.');
        check('maskPII properly redacts email', testMasked.includes('[REDACTED_EMAIL]'));
        check('maskPII properly redacts phone', testMasked.includes('[REDACTED_PHONE]'));
        check('maskPII properly redacts ZAR amount', testMasked.includes('[REDACTED_ZAR]'));

        check('inferCategoryTag categorizes tax correctly', inferCategoryTag('SARS tax deductions') === 'Tax Deduction Strategy');
        check('inferCategoryTag categorizes gear correctly', inferCategoryTag('buy a new camera') === 'Gear Purchase Planning');
        check('inferCategoryTag categorizes revenue correctly', inferCategoryTag('YouTube AdSense payout') === 'Revenue Optimization');

        // ----------------------------------------------------
        // SECTION 8: FRONTEND XSS ESCAPING VERIFICATION
        // ----------------------------------------------------
        console.log('\n--- 8. Testing Frontend XSS Sanitization Logic ---');
        
        const fs = require('fs');
        const appJsContent = fs.readFileSync('app.js', 'utf8');
        const adminHtmlContent = fs.readFileSync('admin.html', 'utf8');

        // Check app.js XSS protections
        check('app.js sanitizes activityStream with escapeHTML', appJsContent.includes('${escapeHTML(a.desc || \'\')}${sampleLabel}'));
        check('app.js openGeminiKeyModal does not interpolate currentKey into HTML attribute', !appJsContent.includes('value="${currentKey}"'));
        check('app.js openGeminiKeyModal sets input.value via DOM property', appJsContent.includes('keyInput.value = currentKey'));

        // Check admin.html XSS protections
        check('admin.html defines escapeHTML helper', adminHtmlContent.includes('function escapeHTML('));
        check('admin.html sanitizes creator name with escapeHTML', adminHtmlContent.includes('${escapeHTML(c.name || \'Creator\')}'));
        check('admin.html sanitizes creator email with escapeHTML', adminHtmlContent.includes('${escapeHTML(c.email || \'\')}'));
        check('admin.html sanitizes audit log old_value with escapeHTML', adminHtmlContent.includes('${escapeHTML(log.old_value || \'\')}'));
        check('admin.html sanitizes audit log new_value with escapeHTML', adminHtmlContent.includes('${escapeHTML(log.new_value || \'\')}'));
        check('admin.html sanitizes telemetry prompt_masked with escapeHTML', adminHtmlContent.includes('"${escapeHTML(t.prompt_masked || \'\')}"'));

        console.log('\n====================================================');
        console.log(`📊 M2 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('====================================================\n');

        if (failed > 0) {
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('Fatal error during M2 verification:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runM2Verification();
}

module.exports = { runM2Verification };
