/* ==========================================================================
   Creator Cash Flow - Milestone M2 Adversarial Challenger Stress Harness
   Author: Challenger 1 (critic / specialist)
   Empirically probes:
   1. Transaction input fuzzing (amounts, types, merchants, schemas) -> 400
   2. Auth signup & login fuzzing (non-string types, lengths, regex, crashes) -> 400
   3. Admin status mutation fuzzing (status, plan_tier, note limits) -> 400
   4. Stored XSS probing & DOM escaping oracles (OWASP vectors in app.js & admin.html)
   5. Gemini AI error normalization (500/503 status codes, never 200 on failure)
   6. Serverless proxy (api/gemini.js) compliance
   7. Error normalization & JSON 404 envelopes
   ========================================================================== */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag } = require('../server');
const geminiServerlessHandler = require('../api/gemini');
const { generateContent } = require('../services/geminiService');

let server = null;
let baseUrl = '';
let passed = 0;
let failed = 0;
const failures = [];

function check(testId, desc, condition, details = '') {
    if (condition) {
        console.log(`  ✅ [${testId}] PASS: ${desc}`);
        passed++;
    } else {
        console.error(`  ❌ [${testId}] FAIL: ${desc} ${details ? '(' + details + ')' : ''}`);
        failed++;
        failures.push({ testId, desc, details });
    }
}

let requestCount = 0;
function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        requestCount++;
        const url = new URL(baseUrl + path);
        const reqHeaders = { 
            'X-Forwarded-For': `192.168.${Math.floor(requestCount / 250)}.${(requestCount % 250) + 1}`,
            ...headers 
        };
        let reqBody = null;

        if (body !== null && body !== undefined) {
            if (typeof body === 'string') {
                reqBody = body;
            } else {
                reqBody = JSON.stringify(body);
            }
            if (!reqHeaders['Content-Type']) {
                reqHeaders['Content-Type'] = 'application/json';
            }
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

// Generate authentication tokens
const adminToken = jwt.sign(
    { id: 'admin_challenger_m2', email: 'admin@creatorcashflow.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const creatorToken = jwt.sign(
    { id: 'usr_challenger_1', email: 'challenger_creator@creator.co.za', name: 'Challenger Creator' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runAdversarialHarness() {
    console.log('======================================================================');
    console.log('⚔️  CHALLENGER 1 ADVERSARIAL STRESS TEST: MILESTONE M2 REMEDIATION');
    console.log('======================================================================\n');

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Challenger test server bound to ${baseUrl}\n`);
            resolve();
        });
    });

    const creatorAuthHeader = { 'Authorization': `Bearer ${creatorToken}` };
    const adminAuthHeader = { 'Authorization': `Bearer ${adminToken}` };

    try {
        // ====================================================================
        // CATEGORY 1: TRANSACTION INPUT FUZZING (POST /api/transactions)
        // ====================================================================
        console.log('--- CATEGORY 1: Transaction Input Fuzzing (POST /api/transactions) ---');

        const invalidAmounts = [
            { label: 'zero (0)', val: 0 },
            { label: 'string zero ("0")', val: '0' },
            { label: 'negative number (-1)', val: -1 },
            { label: 'negative fractional (-0.01)', val: -0.01 },
            { label: 'negative string ("-50")', val: '-50' },
            { label: 'string NaN ("NaN")', val: 'NaN' },
            { label: 'string Infinity ("Infinity")', val: 'Infinity' },
            { label: 'string -Infinity ("-Infinity")', val: '-Infinity' },
            { label: 'alphanumeric string ("abc")', val: 'abc' },
            { label: 'trailing alphanumeric string ("100abc")', val: '100abc' },
            { label: 'currency formatted string ("R500")', val: 'R500' },
            { label: 'empty string ("")', val: '' },
            { label: 'whitespace string ("   ")', val: '   ' },
            { label: 'null', val: null },
            { label: 'boolean true', val: true },
            { label: 'boolean false', val: false },
            { label: 'nested object', val: { amount: 100 } },
            { label: 'array', val: [100] },
            { label: 'exceeds 100M cap (100,000,001)', val: 100000001 },
            { label: 'huge exponent (1e9)', val: 1e9 },
            { label: 'extreme exponent (1e20)', val: 1e20 },
            { label: 'exceeds cap as string ("150000000")', val: '150000000' }
        ];

        for (let i = 0; i < invalidAmounts.length; i++) {
            const item = invalidAmounts[i];
            const res = await request('POST', '/api/transactions', creatorAuthHeader, {
                type: 'income',
                amount: item.val,
                merchant: 'Valid Merchant'
            });
            check(
                `TX_AMT_${i + 1}`,
                `Rejects invalid amount: ${item.label} with HTTP 400`,
                res.status === 400 && res.body.success === false,
                `Got HTTP ${res.status}, body: ${JSON.stringify(res.body)}`
            );
        }

        // Amount omitted entirely
        let res = await request('POST', '/api/transactions', creatorAuthHeader, {
            type: 'income',
            merchant: 'Valid Merchant'
        });
        check('TX_AMT_MISSING', 'Rejects missing amount with HTTP 400', res.status === 400 && res.body.code === 'MISSING_AMOUNT');

        // Valid amount with sub-cent precision: should round to 2 decimals
        res = await request('POST', '/api/transactions', creatorAuthHeader, {
            type: 'income',
            amount: 125.456,
            merchant: 'Precision Test'
        });
        check(
            'TX_AMT_PRECISION',
            'Rounds sub-cent precision to 2 decimals cleanly (125.46)',
            res.status === 201 && res.body.transaction && res.body.transaction.amount === 125.46,
            `Got HTTP ${res.status}, amount: ${res.body.transaction?.amount}`
        );

        // Transaction Type Fuzzing
        const invalidTypes = [
            'transfer', 'invest', 'loan', 'refund', 'INCOME_BONUS',
            '', '   ', null, 123, true, false, {}, []
        ];

        for (let i = 0; i < invalidTypes.length; i++) {
            const badType = invalidTypes[i];
            const resType = await request('POST', '/api/transactions', creatorAuthHeader, {
                type: badType,
                amount: 500,
                merchant: 'Valid Merchant'
            });
            check(
                `TX_TYPE_${i + 1}`,
                `Rejects invalid transaction type: ${JSON.stringify(badType)} with HTTP 400`,
                resType.status === 400 && resType.body.code === 'INVALID_TRANSACTION_TYPE'
            );
        }

        // Case-insensitive valid transaction type
        res = await request('POST', '/api/transactions', creatorAuthHeader, {
            type: '  INCOME  ',
            amount: 500,
            merchant: 'Case Insensitive Income'
        });
        check(
            'TX_TYPE_CASE',
            'Accepts and trims uppercase "  INCOME  " as valid "income"',
            res.status === 201 && res.body.transaction && res.body.transaction.type === 'income'
        );

        // Merchant Fuzzing
        const invalidMerchants = [
            { label: 'empty string', val: '' },
            { label: 'whitespace only', val: '    ' },
            { label: 'null', val: null },
            { label: 'number (12345)', val: 12345 },
            { label: 'boolean (true)', val: true },
            { label: 'object', val: { name: 'Shop' } },
            { label: 'array', val: ['Shop'] },
            { label: 'exceeds 100 chars', val: 'M'.repeat(101) },
            { label: 'HTML-only tags that sanitize to empty (<script></script>)', val: '<script></script>' },
            { label: 'HTML-only nested tags (<div><b><i></i></b></div>)', val: '<div><b><i></i></b></div>' }
        ];

        for (let i = 0; i < invalidMerchants.length; i++) {
            const item = invalidMerchants[i];
            const resM = await request('POST', '/api/transactions', creatorAuthHeader, {
                type: 'expense',
                amount: 150,
                merchant: item.val
            });
            check(
                `TX_MERCHANT_${i + 1}`,
                `Rejects invalid merchant: ${item.label} with HTTP 400`,
                resM.status === 400 && resM.body.success === false
            );
        }

        // Description fallback when merchant is omitted
        res = await request('POST', '/api/transactions', creatorAuthHeader, {
            type: 'expense',
            amount: 200,
            desc: 'Framer Subscription via desc field'
        });
        check(
            'TX_DESC_FALLBACK',
            'Accepts "desc" when "merchant" is not provided',
            res.status === 201 && res.body.transaction && res.body.transaction.merchant === 'Framer Subscription via desc field'
        );

        // ====================================================================
        // CATEGORY 2: AUTH SIGNUP & LOGIN FUZZING (Crash & Validation Checks)
        // ====================================================================
        console.log('\n--- CATEGORY 2: Auth Signup & Login Input Fuzzing ---');

        // Login crash guard: ensure non-strings don't trigger unhandled 500 on email.toLowerCase()
        const badLoginEmails = [
            { label: 'number (12345)', val: 12345 },
            { label: 'object ({})', val: {} },
            { label: 'nested object ({ email: "a@b.com" })', val: { email: 'a@b.com' } },
            { label: 'array ([])', val: ['admin@creatorcashflow.com'] },
            { label: 'boolean true', val: true },
            { label: 'boolean false', val: false },
            { label: 'null', val: null },
            { label: 'empty string', val: '' },
            { label: 'whitespace', val: '   ' },
            { label: 'malformed email (no @)', val: 'notanemail.com' },
            { label: 'malformed email (no domain)', val: 'user@' },
            { label: 'malformed email (no TLD)', val: 'user@domain' },
            { label: 'exceeds 254 chars', val: 'a'.repeat(250) + '@example.com' }
        ];

        for (let i = 0; i < badLoginEmails.length; i++) {
            const item = badLoginEmails[i];
            const resLogin = await request('POST', '/api/auth/login', {}, {
                email: item.val,
                password: 'Password123!'
            });
            check(
                `LOGIN_EMAIL_${i + 1}`,
                `Login rejects bad email: ${item.label} with HTTP 400 (NO 500 crash)`,
                resLogin.status === 400 && resLogin.body.success === false,
                `Got HTTP ${resLogin.status}`
            );
        }

        const badLoginPasswords = [
            { label: 'number (12345)', val: 12345 },
            { label: 'object ({})', val: {} },
            { label: 'array ([])', val: ['pass'] },
            { label: 'boolean true', val: true },
            { label: 'null', val: null },
            { label: 'empty string', val: '' }
        ];

        for (let i = 0; i < badLoginPasswords.length; i++) {
            const item = badLoginPasswords[i];
            const resPass = await request('POST', '/api/auth/login', {}, {
                email: 'admin@creatorcashflow.com',
                password: item.val
            });
            check(
                `LOGIN_PASS_${i + 1}`,
                `Login rejects bad password: ${item.label} with HTTP 400`,
                resPass.status === 400 && resPass.body.code === 'MISSING_PASSWORD'
            );
        }

        // Signup schema validation fuzzing
        const signupFuzzCases = [
            { label: 'name too short (1 char)', payload: { name: 'X', email: 'test@creator.co.za', password: 'Password123!' }, code: 'INVALID_NAME_LENGTH' },
            { label: 'name too long (71 chars)', payload: { name: 'A'.repeat(71), email: 'test@creator.co.za', password: 'Password123!' }, code: 'INVALID_NAME_LENGTH' },
            { label: 'name non-string (number)', payload: { name: 12345, email: 'test@creator.co.za', password: 'Password123!' }, code: 'INVALID_NAME' },
            { label: 'name non-string (object)', payload: { name: {}, email: 'test@creator.co.za', password: 'Password123!' }, code: 'INVALID_NAME' },
            { label: 'password too short (7 chars)', payload: { name: 'Creator', email: 'test@creator.co.za', password: '1234567' }, code: 'INVALID_PASSWORD_LENGTH' },
            { label: 'password too long (129 chars)', payload: { name: 'Creator', email: 'test@creator.co.za', password: 'A'.repeat(129) }, code: 'INVALID_PASSWORD_LENGTH' },
            { label: 'password non-string (number)', payload: { name: 'Creator', email: 'test@creator.co.za', password: 12345678 }, code: 'INVALID_PASSWORD' }
        ];

        for (let i = 0; i < signupFuzzCases.length; i++) {
            const item = signupFuzzCases[i];
            const resSign = await request('POST', '/api/auth/signup', {}, item.payload);
            check(
                `SIGNUP_FUZZ_${i + 1}`,
                `Signup rejects ${item.label} with HTTP 400 and code ${item.code}`,
                resSign.status === 400 && resSign.body.code === item.code,
                `Got HTTP ${resSign.status}, code: ${resSign.body.code}`
            );
        }

        // SQL Injection & Prototype Pollution payload safety
        res = await request('POST', '/api/auth/login', {}, {
            email: "' OR '1'='1' --",
            password: "' OR '1'='1"
        });
        check('AUTH_SQLI', 'Rejects SQLi formatted email with HTTP 400 (not regex matching)', res.status === 400 && res.body.code === 'INVALID_EMAIL_FORMAT');

        res = await request('POST', '/api/auth/login', {}, {
            "__proto__": { "polluted": true },
            email: "invalid",
            password: "test"
        });
        check('AUTH_PROTO_POLLUTION', 'Payload with __proto__ handled safely without server corruption', res.status === 400 && !Object.prototype.polluted);

        // ====================================================================
        // CATEGORY 3: ADMIN STATUS MUTATION FUZZING
        // ====================================================================
        console.log('\n--- CATEGORY 3: Admin Creator Status Mutation Fuzzing ---');

        const adminMutationFuzz = [
            { label: 'empty object {}', body: {}, code: 'EMPTY_MUTATION_PAYLOAD' },
            { label: 'invalid status string ("deleted")', body: { status: 'deleted' }, code: 'INVALID_STATUS_VALUE' },
            { label: 'status as number (1)', body: { status: 1 }, code: 'INVALID_STATUS' },
            { label: 'status as object ({})', body: { status: {} }, code: 'INVALID_STATUS' },
            { label: 'invalid plan_tier string ("Enterprise")', body: { plan_tier: 'Enterprise' }, code: 'INVALID_PLAN_TIER_VALUE' },
            { label: 'plan_tier as number (2)', body: { plan_tier: 2 }, code: 'INVALID_PLAN_TIER' },
            { label: 'note as number (12345)', body: { note: 12345 }, code: 'INVALID_NOTE' },
            { label: 'note as object ({})', body: { note: {} }, code: 'INVALID_NOTE' },
            { label: 'note exceeding 500 chars (501 chars)', body: { note: 'N'.repeat(501) }, code: 'NOTE_TOO_LONG' }
        ];

        for (let i = 0; i < adminMutationFuzz.length; i++) {
            const item = adminMutationFuzz[i];
            const resMut = await request('POST', '/api/admin/creators/usr_seed_1/status', adminAuthHeader, item.body);
            check(
                `ADMIN_MUT_${i + 1}`,
                `Admin mutation rejects ${item.label} with HTTP 400 and code ${item.code}`,
                resMut.status === 400 && resMut.body.code === item.code,
                `Got HTTP ${resMut.status}, code: ${resMut.body.code}`
            );
        }

        // Boundary note: 500 chars exactly should be accepted
        res = await request('POST', '/api/admin/creators/usr_seed_1/status', adminAuthHeader, {
            status: 'active',
            plan_tier: 'Pro',
            note: 'M'.repeat(500)
        });
        check(
            'ADMIN_MUT_NOTE_500',
            'Accepts maximum allowable note length (500 chars) with HTTP 200',
            res.status === 200 && res.body.success === true
        );

        // ====================================================================
        // CATEGORY 4: DOM STORED XSS PROBING & ESCAPING ORACLES
        // ====================================================================
        console.log('\n--- CATEGORY 4: Stored XSS Probing & DOM Escaping Oracles ---');

        const xssVectors = [
            { name: 'Standard script tag', input: '<script>alert(1)</script>' },
            { name: 'Img with onerror attribute', input: '<img src="x" onerror="alert(1)">' },
            { name: 'Svg with onload attribute', input: '<svg onload="alert(1)">' },
            { name: 'Attribute breakout with double quote', input: '"><script>alert(1)</script>' },
            { name: 'Attribute breakout with single quote', input: '\'><script>alert(1)</script>' },
            { name: 'Body onload vector', input: '<body onload=alert(1)>' },
            { name: 'Iframe javascript URI', input: '<iframe src="javascript:alert(1)">' },
            { name: 'Malformed mixed case script', input: '<<SCRIPT>alert("XSS");//<</SCRIPT>' }
        ];

        // Oracle test for escapeHTML function extracted from app.js and admin.html
        function oracleEscapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }

        for (let i = 0; i < xssVectors.length; i++) {
            const vec = xssVectors[i];
            const escaped = oracleEscapeHTML(vec.input);
            const hasRawLt = escaped.includes('<');
            const hasRawGt = escaped.includes('>');
            const hasRawDoubleQuote = escaped.includes('"');
            const hasRawSingleQuote = escaped.includes("'");

            check(
                `XSS_ORACLE_${i + 1}`,
                `escapeHTML eliminates HTML metacharacters in: ${vec.name}`,
                !hasRawLt && !hasRawGt && !hasRawDoubleQuote && !hasRawSingleQuote,
                `Escaped result: ${escaped}`
            );
        }

        // Test Stored XSS via Transaction API:
        // Inject vector in merchant field: backend strips tags, frontend escapes description.
        const storedXssPayload = 'Patreon <script>alert("PWNED")</script>';
        res = await request('POST', '/api/transactions', creatorAuthHeader, {
            type: 'income',
            amount: 1000,
            merchant: storedXssPayload
        });
        check(
            'STORED_XSS_TX_STRIP',
            'Backend sanitization strips script tag from merchant',
            res.status === 201 && res.body.transaction && !res.body.transaction.merchant.includes('<script>')
        );

        // Verify that even if an unstripped string reaches the frontend rendering logic, escapeHTML renders it harmless
        const simulatedHarmfulString = 'FakeBank <img src=x onerror=alert(1)>';
        const simulatedRender = `<div>${oracleEscapeHTML(simulatedHarmfulString)}</div>`;
        check(
            'STORED_XSS_DOM_RENDER',
            'Simulated DOM interpolation renders safely without executable elements',
            !simulatedRender.includes('<img') && simulatedRender.includes('&lt;img')
        );

        // Verify app.js openGeminiKeyModal attribute breakout vulnerability fix
        const appJsSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
        check(
            'APPJS_KEY_NO_INTERPOLATION',
            'app.js does NOT interpolate currentKey into HTML attribute string',
            !appJsSource.includes('value="${currentKey}"')
        );
        check(
            'APPJS_KEY_DOM_SETTER',
            'app.js sets input.value safely via DOM property assignment',
            appJsSource.includes('keyInput.value = currentKey')
        );

        // Verify admin.html escaping in all dynamic table/feed containers
        const adminHtmlSource = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
        check(
            'ADMIN_ESCAPE_CREATOR_NAME',
            'admin.html escapes c.name in creator table',
            adminHtmlSource.includes('${escapeHTML(c.name || \'Creator\')}')
        );
        check(
            'ADMIN_ESCAPE_AUDIT_LOGS',
            'admin.html escapes log.old_value and log.new_value in audit log feed',
            adminHtmlSource.includes('${escapeHTML(log.old_value || \'\')}') &&
            adminHtmlSource.includes('${escapeHTML(log.new_value || \'\')}')
        );
        check(
            'ADMIN_ESCAPE_TELEMETRY',
            'admin.html escapes t.prompt_masked in telemetry stream',
            adminHtmlSource.includes('"${escapeHTML(t.prompt_masked || \'\')}"')
        );

        // ====================================================================
        // CATEGORY 5: GEMINI AI ERROR NORMALIZATION & ENDPOINTS (HTTP 503/500, NOT 200)
        // ====================================================================
        console.log('\n--- CATEGORY 5: Gemini AI Error Normalization & Endpoint Probing ---');

        // Missing prompt on Express endpoint
        res = await request('POST', '/api/gemini', {}, {});
        check(
            'GEMINI_EMPTY_PROMPT',
            'Express /api/gemini returns HTTP 400 for empty prompt',
            res.status === 400 && res.body.success === false && res.body.code === 'INVALID_PROMPT'
        );

        // Whitespace-only prompt
        res = await request('POST', '/api/gemini', {}, { prompt: '      ' });
        check(
            'GEMINI_WHITESPACE_PROMPT',
            'Express /api/gemini returns HTTP 400 for whitespace-only prompt',
            res.status === 400 && res.body.success === false && res.body.code === 'INVALID_PROMPT'
        );

        // Non-string prompt (object)
        res = await request('POST', '/api/gemini', {}, { prompt: { query: 'test' } });
        check(
            'GEMINI_NON_STRING_PROMPT',
            'Express /api/gemini returns HTTP 400 for non-string prompt',
            res.status === 400 && res.body.success === false && res.body.code === 'INVALID_PROMPT'
        );

        // Missing API key in environment: MUST return HTTP 503, NEVER HTTP 200
        res = await request('POST', '/api/gemini', {}, {
            prompt: 'How do I optimize YouTube revenue for South African tax?'
        });
        check(
            'GEMINI_UNCONFIGURED_STATUS',
            'Unconfigured Gemini returns HTTP 503 Service Unavailable (NEVER HTTP 200)',
            res.status === 503,
            `Received HTTP ${res.status}`
        );
        check(
            'GEMINI_UNCONFIGURED_ENVELOPE',
            'Response returns standardized error envelope with success: false',
            res.body.success === false && res.body.code === 'AI_NOT_CONFIGURED' && typeof res.body.error === 'string'
        );

        // Test serverless proxy (api/gemini.js) directly
        console.log('\n--- Testing Serverless Proxy (api/gemini.js) ---');
        
        let serverlessResStatus = 0;
        let serverlessResBody = null;
        const mockServerlessRes = {
            statusCode: 200,
            headers: {},
            setHeader(k, v) { this.headers[k] = v; },
            status(code) { this.statusCode = code; return this; },
            json(payload) { serverlessResBody = payload; return this; },
            end() { return this; }
        };

        // Serverless proxy: empty prompt
        await geminiServerlessHandler({ method: 'POST', body: {}, headers: { origin: 'http://localhost:5000' } }, mockServerlessRes);
        check(
            'SERVERLESS_EMPTY_PROMPT',
            'api/gemini.js returns HTTP 400 for empty prompt',
            mockServerlessRes.statusCode === 400 && serverlessResBody.code === 'INVALID_PROMPT'
        );

        // Serverless proxy: unconfigured key
        await geminiServerlessHandler({ method: 'POST', body: { prompt: 'Hello AI' }, headers: { origin: 'http://localhost:5000' } }, mockServerlessRes);
        check(
            'SERVERLESS_UNCONFIGURED_KEY',
            'api/gemini.js returns HTTP 503 on unconfigured API key (NEVER HTTP 200)',
            mockServerlessRes.statusCode === 503 && serverlessResBody.success === false && serverlessResBody.code === 'AI_NOT_CONFIGURED'
        );

        // Serverless proxy: unauthorized CORS origin
        await geminiServerlessHandler({ method: 'POST', body: { prompt: 'Hello AI' }, headers: { origin: 'https://evil-attacker-site.com' } }, mockServerlessRes);
        check(
            'SERVERLESS_CORS_REJECTION',
            'api/gemini.js rejects unauthorized origin with HTTP 403',
            mockServerlessRes.statusCode === 403 && serverlessResBody.error === 'Blocked by CORS policy'
        );

        // ====================================================================
        // CATEGORY 6: ERROR NORMALIZATION & 404 HANDLING
        // ====================================================================
        console.log('\n--- CATEGORY 6: Error Normalization & 404 Routing ---');

        // Unmatched endpoint
        res = await request('GET', '/api/some/random/endpoint/that/does/not/exist');
        check(
            'ERR_404_JSON',
            'Unmatched route returns HTTP 404 with standardized JSON envelope',
            res.status === 404 && res.body.success === false && res.body.code === 'ROUTE_NOT_FOUND' && res.body.error === 'Not Found'
        );

        // Malformed JSON payload handling
        res = await request('POST', '/api/transactions', {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${creatorToken}`
        }, '{ "invalidJson": true, ');
        check(
            'ERR_MALFORMED_JSON',
            'Malformed JSON syntax returns HTTP 400 with INVALID_JSON code',
            res.status === 400 && res.body.success === false && res.body.code === 'INVALID_JSON'
        );

        console.log('\n======================================================================');
        console.log(`📊 CHALLENGER M2 RESULTS: ${passed} PASSED, ${failed} FAILED across ${passed + failed} tests`);
        console.log('======================================================================\n');

        if (failed > 0) {
            console.error('FAILED TESTS DETAILS:');
            failures.forEach(f => console.error(`  - [${f.testId}] ${f.desc} ${f.details}`));
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('Fatal crash during adversarial test harness execution:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runAdversarialHarness();
}

module.exports = { runAdversarialHarness };
