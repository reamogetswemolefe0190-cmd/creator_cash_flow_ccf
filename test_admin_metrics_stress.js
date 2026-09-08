/**
 * test_admin_metrics_stress.js
 * Empirical Financial Stress Harness for GET /api/admin/metrics
 * Tests edge cases: zero transactions, negative income, missing fields, floating point rounding, dynamic mutations.
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET } = require('./server');

let testServer;
let baseUrl;
let adminToken;

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            method: method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(responseData);
                } catch (e) {
                    parsed = responseData;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', err => reject(err));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

let passedTests = 0;
let totalTests = 0;
let findings = [];

function assert(condition, message, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        console.error(`  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
        findings.push({ message, details });
    }
}

// Backup original memoryDb state
let origUsers = [];
let origTxs = [];

function backupDb() {
    origUsers = JSON.parse(JSON.stringify(memoryDb.users));
    origTxs = JSON.parse(JSON.stringify(memoryDb.transactions));
}

function restoreDb() {
    memoryDb.users.length = 0;
    memoryDb.users.push(...JSON.parse(JSON.stringify(origUsers)));
    memoryDb.transactions.length = 0;
    memoryDb.transactions.push(...JSON.parse(JSON.stringify(origTxs)));
}

async function runStressTests() {
    console.log('====================================================');
    console.log('⚡ Running M2 Financial Stress Test Harness');
    console.log('====================================================\n');

    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Stress test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    backupDb();

    try {
        adminToken = jwt.sign(
            { id: 'admin_stress_1', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // ----------------------------------------------------
        // STRESS SUITE 1: Zero Creators & Empty DB Behavior
        // ----------------------------------------------------
        console.log('--- SUITE 1: Empty Database & Zero-Transaction Creators ---');
        memoryDb.users.length = 0;
        memoryDb.transactions.length = 0;

        let res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.status === 200, 'HTTP status is 200 on empty DB');
        assert(res.body.totalCreators === 0, 'totalCreators is 0 when DB is empty', `got ${res.body.totalCreators}`);
        assert(res.body.gpvZar === 0, 'gpvZar is 0 when DB is empty', `got ${res.body.gpvZar}`);
        assert(res.body.mrrZar === 0, 'mrrZar is 0 when DB is empty', `got ${res.body.mrrZar}`);
        assert(res.body.taxReservesZar === 0, 'taxReservesZar is 0 when DB is empty', `got ${res.body.taxReservesZar}`);
        assert(res.body.channelBreakdown.youtube === 0 && res.body.channelBreakdown.tiktok === 0 && res.body.channelBreakdown.patreon === 0 && res.body.channelBreakdown.brand_deals === 0, 'channelBreakdown is all 0 on empty DB');

        // Check timeline behavior on empty DB
        const emptyTimeline = res.body.timeline;
        assert(Array.isArray(emptyTimeline) && emptyTimeline.length === 6, 'Timeline is an array of 6 items on empty DB');
        
        // Inspect timeline creator count for months 0..4 vs month 5 on empty DB
        let anomalyTimelineCreators = false;
        emptyTimeline.forEach((m, idx) => {
            if (m.creators !== 0) {
                anomalyTimelineCreators = true;
                console.log(`    ⚠️ Timeline month ${idx} (${m.month}) creator count is ${m.creators} when totalCreators is 0!`);
            }
        });
        assert(!anomalyTimelineCreators, 'Timeline creator count should be 0 for all months when DB has 0 creators', `month 0-4 returned 1 creator due to Math.max(1, Math.round(0)) fallback`);

        // Test creators with only expense transactions (no income)
        restoreDb();
        memoryDb.transactions.forEach(t => t.type = 'expense'); // turn all to expenses
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.body.gpvZar === 0, 'gpvZar is 0 when all transactions are expenses', `got ${res.body.gpvZar}`);
        assert(res.body.taxReservesZar === 0, 'taxReservesZar is 0 when GPV is 0');
        console.log('');

        // ----------------------------------------------------
        // STRESS SUITE 2: Negative Income, Refunds & Malformed Amounts
        // ----------------------------------------------------
        console.log('--- SUITE 2: Negative Income Amounts, Refunds & Malformed Amounts ---');
        restoreDb();
        // Add a refund/chargeback transaction (negative amount)
        memoryDb.transactions.push({
            id: 'tx_refund_1',
            user_id: 'usr_seed_1',
            source: 'YouTube',
            merchant: 'Google AdSense Refund',
            type: 'income',
            category: 'YouTube AdSense',
            amount: -10000.00,
            created_at: new Date().toISOString()
        });

        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        const expectedRefundGpv = parseFloat((660000 - 10000).toFixed(2));
        assert(res.body.gpvZar === expectedRefundGpv, `Negative income amount subtracts from GPV`, `got ${res.body.gpvZar}, expected ${expectedRefundGpv}`);
        assert(res.body.channelBreakdown.youtube === 285000, `Negative income amount subtracts from channel total`, `got ${res.body.channelBreakdown.youtube}, expected 285000`);

        // Malformed amounts (NaN, null, undefined, strings)
        memoryDb.transactions.push(
            { id: 'tx_bad_1', user_id: 'usr_seed_1', source: 'YouTube', type: 'income', amount: 'invalid_str' },
            { id: 'tx_bad_2', user_id: 'usr_seed_1', source: 'TikTok', type: 'income', amount: null },
            { id: 'tx_bad_3', user_id: 'usr_seed_1', source: 'Patreon', type: 'income', amount: undefined },
            { id: 'tx_bad_4', user_id: 'usr_seed_1', source: 'Brand Deals', type: 'income', amount: NaN }
        );

        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(!isNaN(res.body.gpvZar), 'gpvZar remains a valid number (not NaN) with malformed transaction amounts', `got ${res.body.gpvZar}`);
        assert(!isNaN(res.body.taxReservesZar), 'taxReservesZar remains valid number with malformed transaction amounts');
        assert(!isNaN(res.body.channelBreakdown.youtube), 'channelBreakdown.youtube remains valid number with malformed transaction amounts');
        console.log('');

        // ----------------------------------------------------
        // STRESS SUITE 3: Missing Fields & Category Classification Edge Cases
        // ----------------------------------------------------
        console.log('--- SUITE 3: Missing Sources/Categories & Classification ---');
        restoreDb();
        // Transaction with undefined source, category, merchant
        memoryDb.transactions.push({
            id: 'tx_missing_1',
            user_id: 'usr_seed_1',
            source: null,
            category: undefined,
            merchant: null,
            type: 'income',
            amount: 5000.00,
            created_at: new Date().toISOString()
        });

        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.status === 200, 'GET /api/admin/metrics handles null/undefined source/category/merchant without throwing exception');
        assert(res.body.gpvZar === 665000, 'GPV includes income transaction with missing source', `got ${res.body.gpvZar}`);
        assert(res.body.channelBreakdown.brand_deals === 185000, 'Income transaction with missing source defaults to brand_deals channel', `got ${res.body.channelBreakdown.brand_deals}`);

        // Case insensitivity & Whitespace in type and sources
        memoryDb.transactions.push(
            { id: 'tx_case_1', user_id: 'usr_seed_1', source: '  YoUtUbE  ', type: 'InCoMe', amount: 1000.00 },
            { id: 'tx_case_2', user_id: 'usr_seed_1', source: 'TIKTOK', type: 'INCOME', amount: 2000.00 },
            { id: 'tx_case_3', user_id: 'usr_seed_1', source: 'Patreon', type: 'income', amount: 3000.00 }
        );

        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.body.channelBreakdown.youtube === 296000, 'Case and whitespace variations in YouTube source matched correctly', `got ${res.body.channelBreakdown.youtube}`);
        assert(res.body.channelBreakdown.tiktok === 102000, 'Case variations in TikTok source matched correctly', `got ${res.body.channelBreakdown.tiktok}`);
        assert(res.body.channelBreakdown.patreon === 88000, 'Case variations in Patreon source matched correctly', `got ${res.body.channelBreakdown.patreon}`);

        // User missing plan_tier property
        memoryDb.users.push({
            id: 'usr_no_tier',
            name: 'No Tier User',
            email: 'notier@test.com'
            // plan_tier omitted
        });
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.body.totalCreators === 11, 'totalCreators includes user with missing plan_tier', `got ${res.body.totalCreators}`);
        assert(res.body.mrrZar === 2093, 'User with missing plan_tier defaults to Free (does not increment MRR)', `got ${res.body.mrrZar}`);
        console.log('');

        // ----------------------------------------------------
        // STRESS SUITE 4: Floating Point Precision & Currency Rounding
        // ----------------------------------------------------
        console.log('--- SUITE 4: Currency Rounding & Floating-Point Precision ---');
        restoreDb();
        memoryDb.transactions.length = 0; // reset txs

        // Add fractional ZAR amounts across channels that could produce rounding divergence
        memoryDb.transactions.push(
            { id: 'tx_float_1', user_id: 'usr_seed_1', source: 'YouTube', type: 'income', amount: 100.004 },
            { id: 'tx_float_2', user_id: 'usr_seed_1', source: 'TikTok', type: 'income', amount: 100.004 },
            { id: 'tx_float_3', user_id: 'usr_seed_1', source: 'Patreon', type: 'income', amount: 100.004 },
            { id: 'tx_float_4', user_id: 'usr_seed_1', source: 'Brand Deals', type: 'income', amount: 100.004 }
        );

        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        const cb = res.body.channelBreakdown;
        const cbSum = parseFloat((cb.youtube + cb.tiktok + cb.patreon + cb.brand_deals).toFixed(2));
        assert(cbSum === res.body.gpvZar, `Sum of channel breakdowns (R${cbSum}) strictly equals GPV (R${res.body.gpvZar}) for fractional ZAR amounts`, `channel sum: ${cbSum}, GPV: ${res.body.gpvZar}`);

        // Verify 15% Tax Reserves calculation on odd fractional amount
        // GPV = 400.02 ZAR. Tax reserves = 400.02 * 0.15 = 60.003 -> 60.00 ZAR.
        const expectedTax = parseFloat((res.body.gpvZar * 0.15).toFixed(2));
        assert(res.body.taxReservesZar === expectedTax, `taxReservesZar (R${res.body.taxReservesZar}) equals 15% of GPV rounded to 2 decimal places (R${expectedTax})`);
        console.log('');

        // ----------------------------------------------------
        // STRESS SUITE 5: Dynamic Mutation Reactivity & State Transitions
        // ----------------------------------------------------
        console.log('--- SUITE 5: Dynamic Mutation Reactivity & Operations ---');
        restoreDb();

        // 5.1 Plan Tier Toggle (Pro -> Free and Free -> Pro)
        const proUser = memoryDb.users.find(u => (u.plan_tier || '').toLowerCase() === 'pro');
        const initialMrr = (memoryDb.users.filter(u => (u.plan_tier || '').toLowerCase() === 'pro').length) * 299;
        
        proUser.plan_tier = 'Free';
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.body.mrrZar === initialMrr - 299, `Demoting Pro creator to Free dynamically decreases MRR by R299`, `got R${res.body.mrrZar}, expected R${initialMrr - 299}`);

        proUser.plan_tier = 'Pro';
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        assert(res.body.mrrZar === initialMrr, `Promoting creator to Pro dynamically restores MRR to R${initialMrr}`);

        // 5.2 Deleting a transaction
        const targetTx = memoryDb.transactions[0];
        const targetAmount = targetTx.amount;
        const initialGpv = res.body.gpvZar;
        
        memoryDb.transactions.shift(); // remove 1st transaction
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        const expectedDecreasedGpv = parseFloat((initialGpv - targetAmount).toFixed(2));
        assert(res.body.gpvZar === expectedDecreasedGpv, `Deleting a transaction dynamically reduces GPV`, `got R${res.body.gpvZar}, expected R${expectedDecreasedGpv}`);

        // 5.3 Modifying existing transaction amount
        const modTx = memoryDb.transactions[0];
        const oldAmt = modTx.amount;
        modTx.amount = oldAmt + 5000;
        res = await request('GET', '/api/admin/metrics', null, { 'Authorization': `Bearer ${adminToken}` });
        const expectedIncreasedGpv = parseFloat((expectedDecreasedGpv + 5000).toFixed(2));
        assert(res.body.gpvZar === expectedIncreasedGpv, `Modifying transaction amount dynamically updates GPV`, `got R${res.body.gpvZar}, expected R${expectedIncreasedGpv}`);

        console.log('\n====================================================');
        console.log(`📊 STRESS TEST SUMMARY: ${passedTests}/${totalTests} passed`);
        if (findings.length > 0) {
            console.log(`⚠️ FINDINGS / DISCREPANCIES DISCOVERED: ${findings.length}`);
            findings.forEach((f, i) => console.log(`  ${i + 1}. ${f.message} (${f.details})`));
        } else {
            console.log('✨ NO BUGS DISCOVERED IN STRESS HARNESS!');
        }
        console.log('====================================================');

    } catch (err) {
        console.error('\n❌ STRESS TEST HARNESS ERRORED:', err);
    } finally {
        restoreDb();
        if (testServer) {
            testServer.close();
        }
    }
}

runStressTests();
