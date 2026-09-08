// Adversarial Stress Test Script for Milestone M2
// Created by Reviewer 1 (reviewer_m2_rem_1)

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET, maskPII, inferCategoryTag } = require('../../server');
const { sanitizeString } = require('../../middleware/validation');

let server = null;
let baseUrl = '';
let passed = 0;
let failed = 0;

function assertTest(name, condition, details = '') {
    if (condition) {
        console.log(`  [PASS] ${name}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${name} ${details}`);
        failed++;
    }
}

function request(method, path, headers = {}, body = null, rawBody = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const reqHeaders = { ...headers };
        let dataToSend = null;

        if (rawBody !== null) {
            dataToSend = rawBody;
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(dataToSend);
        } else if (body !== null) {
            dataToSend = JSON.stringify(body);
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(dataToSend);
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
        if (dataToSend) req.write(dataToSend);
        req.end();
    });
}

const adminToken = jwt.sign(
    { id: 'admin_test', email: 'admin@creatorcashflow.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const creatorToken = jwt.sign(
    { id: 'usr_seed_1', email: 'naledi@creator.co.za', name: 'Naledi Molefe' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runAdversarialTests() {
    console.log('===========================================================');
    console.log('⚡ ADVERSARIAL STRESS TEST: MILESTONE M2 SECURITY & INTEGRITY');
    console.log('===========================================================\n');

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    try {
        // --- 1. MALFORMED JSON BODY INGESTION ---
        console.log('1. Malformed JSON Body Handling');
        let res = await request('POST', '/api/auth/login', {}, null, '{"email": invalid_json');
        assertTest('Malformed JSON yields HTTP 400 with INVALID_JSON code', res.status === 400 && res.body.code === 'INVALID_JSON', JSON.stringify(res.body));

        // --- 2. SIGNUP BOUNDARY STRESS ---
        console.log('\n2. Signup Boundary Stress');
        // Name exactly 1 char
        res = await request('POST', '/api/auth/signup', {}, { name: 'X', email: 'valid@example.com', password: 'Password123' });
        assertTest('Signup rejects 1-char name (boundary < 2)', res.status === 400 && res.body.code === 'INVALID_NAME_LENGTH');

        // Name with HTML injection
        res = await request('POST', '/api/auth/signup', {}, { name: '<b></b>', email: 'valid2@example.com', password: 'Password123' });
        assertTest('Signup rejects name that becomes empty after stripping tags', res.status === 400 && res.body.code === 'INVALID_NAME_LENGTH');

        // Name exactly 71 chars
        res = await request('POST', '/api/auth/signup', {}, { name: 'A'.repeat(71), email: 'valid3@example.com', password: 'Password123' });
        assertTest('Signup rejects 71-char name (boundary > 70)', res.status === 400 && res.body.code === 'INVALID_NAME_LENGTH');

        // Password exactly 7 chars
        res = await request('POST', '/api/auth/signup', {}, { name: 'Valid Name', email: 'valid4@example.com', password: 'Passw1!' });
        assertTest('Signup rejects 7-char password (boundary < 8)', res.status === 400 && res.body.code === 'INVALID_PASSWORD_LENGTH');

        // Password exactly 129 chars
        res = await request('POST', '/api/auth/signup', {}, { name: 'Valid Name', email: 'valid5@example.com', password: 'P'.repeat(129) });
        assertTest('Signup rejects 129-char password (boundary > 128)', res.status === 400 && res.body.code === 'INVALID_PASSWORD_LENGTH');

        // Type coercion attack on email
        res = await request('POST', '/api/auth/signup', {}, { name: 'Valid Name', email: true, password: 'Password123' });
        assertTest('Signup rejects boolean email', res.status === 400 && res.body.code === 'INVALID_EMAIL');

        // --- 3. LOGIN CRASH & INJECTION ATTACKS ---
        console.log('\n3. Login Crash & Type Coercion Attacks');
        // Array email
        res = await request('POST', '/api/auth/login', {}, { email: ['admin@creatorcashflow.com'], password: 'Password123' });
        assertTest('Login rejects array email with HTTP 400 without crashing', res.status === 400);

        // Object email
        res = await request('POST', '/api/auth/login', {}, { email: { user: 'admin' }, password: 'Password123' });
        assertTest('Login rejects object email with HTTP 400 without crashing', res.status === 400);

        // --- 4. TRANSACTION INPUT ATTACK SURFACE ---
        console.log('\n4. Transaction Input Attack Surface');
        // Case insensitive type 'INCOME'
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'INCOME',
            amount: 500,
            merchant: 'Valid Merchant'
        });
        assertTest('Transaction accepts uppercase INCOME and normalizes', res.status === 201 && res.body.transaction.type === 'income');

        // Amount 0
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 0,
            merchant: 'Zero Merchant'
        });
        assertTest('Transaction rejects zero amount', res.status === 400 && res.body.code === 'INVALID_AMOUNT');

        // Amount Infinity
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 'Infinity',
            merchant: 'Infinity Merchant'
        });
        assertTest('Transaction rejects Infinity amount', res.status === 400 && res.body.code === 'INVALID_AMOUNT');

        // Amount negative
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'expense',
            amount: -0.01,
            merchant: 'Negative Merchant'
        });
        assertTest('Transaction rejects negative decimal amount', res.status === 400 && res.body.code === 'INVALID_AMOUNT');

        // Amount above 100,000,000 cap
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'income',
            amount: 100000001,
            merchant: 'Oversized'
        });
        assertTest('Transaction rejects amount > 100M', res.status === 400 && res.body.code === 'AMOUNT_EXCEEDS_LIMIT');

        // Floating point precision rounding
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'expense',
            amount: 125.4567,
            merchant: 'Hardware Store'
        });
        assertTest('Transaction rounds amount to 2 decimal places (125.46)', res.status === 201 && res.body.transaction.amount === 125.46);

        // Malicious merchant XSS payload
        res = await request('POST', '/api/transactions', { 'Authorization': `Bearer ${creatorToken}` }, {
            type: 'expense',
            amount: 250,
            merchant: '"><img src=x onerror=alert(document.cookie)>'
        });
        assertTest('Transaction strips HTML tags from merchant', res.status === 201 && !res.body.transaction.merchant.includes('<') && !res.body.transaction.merchant.includes('>'));

        // --- 5. ADMIN STATUS MUTATION ATTACK SURFACE ---
        console.log('\n5. Admin Status Mutation Attack Surface');
        // Whitespace & case normalization on status
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            status: '  SUSPENDED  '
        });
        assertTest('Admin mutation normalizes "  SUSPENDED  " to "suspended"', res.status === 200 && res.body.creator.status === 'suspended');

        // Whitespace & case normalization on plan_tier
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            plan_tier: 'pro'
        });
        assertTest('Admin mutation normalizes "pro" to "Pro"', res.status === 200 && res.body.creator.plan_tier === 'Pro');

        // Oversized note (501 characters)
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            note: 'X'.repeat(501)
        });
        assertTest('Admin mutation rejects 501-character note with NOTE_TOO_LONG', res.status === 400 && res.body.code === 'NOTE_TOO_LONG');

        // HTML note sanitization
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {
            note: '<script>alert("admin note XSS")</script>Legit note'
        });
        assertTest('Admin mutation sanitizes HTML from note', res.status === 200 && !res.body.audit_entry.new_value.includes('<script>'));

        // Empty body
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', { 'Authorization': `Bearer ${adminToken}` }, {});
        assertTest('Admin mutation rejects empty body with EMPTY_MUTATION_PAYLOAD', res.status === 400 && res.body.code === 'EMPTY_MUTATION_PAYLOAD');

        // --- 6. GEMINI ERROR NORMALIZATION ---
        console.log('\n6. Gemini Endpoint Error Normalization');
        // Empty prompt string
        res = await request('POST', '/api/gemini', {}, { prompt: '   ' });
        assertTest('Gemini rejects whitespace-only prompt with HTTP 400', res.status === 400 && res.body.code === 'INVALID_PROMPT');

        // Non-string prompt
        res = await request('POST', '/api/gemini', {}, { prompt: { text: 'hello' } });
        assertTest('Gemini rejects non-string prompt with HTTP 400', res.status === 400 && res.body.code === 'INVALID_PROMPT');

        // Missing key triggers HTTP 503 (never HTTP 200)
        res = await request('POST', '/api/gemini', {}, { prompt: 'Calculate my tax write-off' });
        assertTest('Gemini without key returns HTTP 503 Service Unavailable', res.status === 503);
        assertTest('Gemini 503 response envelope has success: false', res.body.success === false);
        assertTest('Gemini 503 response envelope has code: AI_NOT_CONFIGURED', res.body.code === 'AI_NOT_CONFIGURED');
        assertTest('Gemini 503 response includes fallback: true flag', res.body.fallback === true);

        // --- 7. ROUTE 404 NORMALIZATION ---
        console.log('\n7. Route 404 Error Normalization');
        res = await request('GET', '/api/definitely-not-a-real-endpoint-' + Date.now());
        assertTest('Unmatched GET returns HTTP 404', res.status === 404);
        assertTest('Unmatched GET returns JSON envelope with ROUTE_NOT_FOUND', res.body.code === 'ROUTE_NOT_FOUND' && res.body.success === false);

        res = await request('POST', '/random/unregistered/path');
        assertTest('Unmatched POST returns HTTP 404', res.status === 404);
        assertTest('Unmatched POST returns JSON envelope with ROUTE_NOT_FOUND', res.body.code === 'ROUTE_NOT_FOUND' && res.body.success === false);

        // --- 8. ADVANCED PII MASKING TESTS ---
        console.log('\n8. Advanced PII Masking Tests');
        const piiInput = 'User email is john.doe+tag@sub.domain.co.za, phone is +27 82 123 4567 or (011) 555-1234. Earnings: R1,234,567.89, R500, ZAR 12000, 45000 ZAR.';
        const piiMasked = maskPII(piiInput);
        assertTest('PII masks complex email address', !piiMasked.includes('john.doe') && piiMasked.includes('[REDACTED_EMAIL]'));
        assertTest('PII masks international phone format (+27 82...)', !piiMasked.includes('123 4567') && piiMasked.includes('[REDACTED_PHONE]'));
        assertTest('PII masks millions currency (R1,234,567.89)', !piiMasked.includes('1,234,567') && piiMasked.includes('[REDACTED_ZAR]'));
        assertTest('PII masks ZAR suffix format (45000 ZAR)', !piiMasked.includes('45000') && piiMasked.includes('[REDACTED_ZAR]'));

        console.log('\n===========================================================');
        console.log(`📊 ADVERSARIAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('===========================================================\n');

        if (failed > 0) {
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('Fatal error during adversarial tests:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

runAdversarialTests();
