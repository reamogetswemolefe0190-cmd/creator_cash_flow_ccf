/**
 * Challenger M2 Iteration 2 Direct Defect Probing Harness
 * Rigorously probes POST /api/transactions and validateTransaction middleware
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET } = require('../server');
const { validateTransaction, sanitizeString } = require('../middleware/validation');

const token = jwt.sign(
    { id: 'usr_challenger_probe', email: 'probe@creatorcashflow.com', name: 'Probe Tester' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runDirectProbing() {
    console.log('======================================================================');
    console.log('CHALLENGER M2 ITERATION 2: DIRECT DEFECT PROBING');
    console.log('======================================================================\n');

    let passed = 0;
    let failed = 0;

    function record(desc, cond, details = '') {
        if (cond) {
            console.log('  PASS: ' + desc);
            passed++;
        } else {
            console.error('  FAIL: ' + desc + (details ? ' | ' + details : ''));
            failed++;
        }
    }

    // Phase 1: validateTransaction Middleware Direct Unit Probing
    console.log('--- Phase 1: validateTransaction Middleware Direct Unit Probing ---');
    const unitCases = [
        { label: 'array [100]', amount: [100], expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'array [100, 200]', amount: [100, 200], expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'trailing alphanumeric string "100abc"', amount: '100abc', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'string with script tag "100<script>"', amount: '100<script>', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'string with orphan angle bracket "100<"', amount: '100<', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'string with orphan angle bracket ">100"', amount: '>100', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'nested object { amount: 100 }', amount: { amount: 100 }, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'boolean true', amount: true, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'boolean false', amount: false, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'multiple decimals "100.5.5"', amount: '100.5.5', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'scientific notation "1e5"', amount: '1e5', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'exceeds limit 100000001', amount: 100000001, expectedStatus: 400, expectedCode: 'AMOUNT_EXCEEDS_LIMIT' },
        { label: 'empty array []', amount: [], expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'string array ["100"]', amount: ['100'], expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount "+100" as string', amount: '+100', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount "0.00" as string', amount: '0.00', expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount -0 as number', amount: -0, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount NaN as number', amount: NaN, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount Infinity as number', amount: Infinity, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'amount -Infinity as number', amount: -Infinity, expectedStatus: 400, expectedCode: 'INVALID_AMOUNT' },
        { label: 'valid number 500', amount: 500, expectedStatus: 'NEXT', expectedParsed: 500 },
        { label: 'valid padded string " 250.50 "', amount: ' 250.50 ', expectedStatus: 'NEXT', expectedParsed: 250.50 },
        { label: 'valid numeric string "100"', amount: '100', expectedStatus: 'NEXT', expectedParsed: 100 }
    ];

    for (const tc of unitCases) {
        let code = null;
        let body = null;
        let nextCalled = false;
        const req = {
            body: {
                type: 'income',
                amount: tc.amount,
                merchant: 'Probing Merchant'
            }
        };
        const res = {
            status(c) { code = c; return this; },
            json(b) { body = b; return this; }
        };
        validateTransaction(req, res, () => { nextCalled = true; });

        if (tc.expectedStatus === 'NEXT') {
            record(
                'Middleware accepts ' + tc.label,
                nextCalled === true && code === null && req.body.amount === tc.expectedParsed,
                'nextCalled=' + nextCalled + ', code=' + code + ', amount=' + req.body.amount
            );
        } else {
            record(
                'Middleware rejects ' + tc.label + ' with HTTP ' + tc.expectedStatus + ' (' + tc.expectedCode + ')',
                nextCalled === false && code === tc.expectedStatus && body && body.code === tc.expectedCode,
                'nextCalled=' + nextCalled + ', code=' + code + ', body=' + JSON.stringify(body)
            );
        }
    }

    // Phase 2: sanitizeString orphan angle bracket checks
    console.log('\n--- Phase 2: sanitizeString Orphan Bracket Stripping ---');
    const sanitizeCases = [
        { input: '<script>alert(1)</script>', expected: 'alert(1)' },
        { input: 'Hello <world>!', expected: 'Hello !' },
        { input: 'Test < unclosed tag', expected: 'Test' },
        { input: 'Test > orphan closing tag', expected: 'Test  orphan closing tag' },
        { input: '><script>alert(1)</script><>', expected: 'alert(1)' },
        { input: 'Normal Merchant 123', expected: 'Normal Merchant 123' }
    ];
    for (const sc of sanitizeCases) {
        const res = sanitizeString(sc.input);
        record(
            'sanitizeString handles "' + sc.input + '" -> "' + sc.expected + '"',
            res === sc.expected,
            'got "' + res + '"'
        );
    }

    // Phase 3: Live HTTP Server Probing (POST /api/transactions)
    console.log('\n--- Phase 3: Live HTTP Server Probing (POST /api/transactions) ---');
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = 'http://127.0.0.1:' + port;

    async function sendTx(payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const req = http.request(baseUrl + '/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'Authorization': 'Bearer ' + token
                }
            }, res => {
                let chunks = '';
                res.on('data', c => chunks += c);
                res.on('end', () => {
                    let json = null;
                    try { json = JSON.parse(chunks); } catch (e) { json = chunks; }
                    resolve({ status: res.statusCode, body: json });
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    const httpCases = [
        {
            label: 'Defect probe: amount: [100]',
            payload: { type: 'income', amount: [100], merchant: 'Defect Probe 1' },
            expectedStatus: 400,
            expectedCode: 'INVALID_AMOUNT'
        },
        {
            label: 'Defect probe: amount: "100abc"',
            payload: { type: 'income', amount: '100abc', merchant: 'Defect Probe 2' },
            expectedStatus: 400,
            expectedCode: 'INVALID_AMOUNT'
        },
        {
            label: 'Defect probe: amount: "100<script>"',
            payload: { type: 'income', amount: '100<script>', merchant: 'Defect Probe 3' },
            expectedStatus: 400,
            expectedCode: 'INVALID_AMOUNT'
        },
        {
            label: 'Defect probe: amount: " 250.50 "',
            payload: { type: 'income', amount: ' 250.50 ', merchant: 'Valid Trimmed String' },
            expectedStatus: 201,
            expectedAmount: 250.50
        },
        {
            label: 'Defect probe: amount: 500',
            payload: { type: 'expense', amount: 500, merchant: 'Valid Number 500' },
            expectedStatus: 201,
            expectedAmount: 500
        }
    ];

    for (const hc of httpCases) {
        const resp = await sendTx(hc.payload);
        if (hc.expectedStatus === 201) {
            record(
                'Live HTTP: ' + hc.label + ' returns HTTP 201 with correct amount',
                resp.status === 201 && resp.body && resp.body.success === true && resp.body.transaction && resp.body.transaction.amount === hc.expectedAmount,
                'status=' + resp.status + ', body=' + JSON.stringify(resp.body)
            );
        } else {
            record(
                'Live HTTP: ' + hc.label + ' returns HTTP ' + hc.expectedStatus + ' (' + hc.expectedCode + ')',
                resp.status === hc.expectedStatus && resp.body && resp.body.success === false && resp.body.code === hc.expectedCode,
                'status=' + resp.status + ', body=' + JSON.stringify(resp.body)
            );
        }
    }

    server.close();

    console.log('\n======================================================================');
    console.log('RESULTS: ' + passed + ' PASSED, ' + failed + ' FAILED across ' + (passed + failed) + ' tests');
    console.log('======================================================================\n');

    if (failed > 0) process.exit(1);
}

runDirectProbing().catch(err => {
    console.error('Fatal probe error:', err);
    process.exit(1);
});

