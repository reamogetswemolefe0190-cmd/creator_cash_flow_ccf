/**
 * test_admin_metrics.js
 * Comprehensive automated unit test suite for Milestone M2 (Platform KPI Scorecards & Financial Telemetry API)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { app, memoryDb, JWT_SECRET } = require('./server');

let testServer;
let baseUrl;

// Utility for making HTTP requests to the test server
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

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTests() {
    console.log('====================================================');
    console.log('🧪 Running M2 Platform KPI Scorecards API Tests');
    console.log('====================================================\n');

    // Start HTTP server on dynamic port
    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // Generate tokens for testing
        const adminToken = jwt.sign(
            { id: 'admin_test_1', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const creatorToken = jwt.sign(
            { id: 'usr_creator_1', email: 'creator@creatorcashflow.com', role: 'creator' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const noRoleToken = jwt.sign(
            { id: 'usr_norole_1', email: 'user@creatorcashflow.com' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // ----------------------------------------------------
        // TEST 1: Rejection without token (HTTP 401)
        // ----------------------------------------------------
        console.log('1. Rejection without authorization header (HTTP 401)');
        const noAuthRes = await request('GET', '/api/admin/metrics');
        assert(noAuthRes.status === 401, `Missing Authorization header returns HTTP 401 (got ${noAuthRes.status})`);
        assert(noAuthRes.body.error === 'Access token required', 'Error message is "Access token required"');
        console.log('');

        // ----------------------------------------------------
        // TEST 2: Rejection with invalid token (HTTP 401)
        // ----------------------------------------------------
        console.log('2. Rejection with invalid JWT token (HTTP 401)');
        const invalidTokenRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': 'Bearer invalid.jwt.token.string'
        });
        assert(invalidTokenRes.status === 401, `Invalid JWT token returns HTTP 401 (got ${invalidTokenRes.status})`);
        assert(invalidTokenRes.body.error === 'Invalid or expired token', 'Error message is "Invalid or expired token"');
        console.log('');

        // ----------------------------------------------------
        // TEST 3: Rejection with non-admin token (HTTP 403)
        // ----------------------------------------------------
        console.log('3. Rejection with non-admin role token (HTTP 403)');
        const creatorRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${creatorToken}`
        });
        assert(creatorRes.status === 403, `Non-admin creator token returns HTTP 403 (got ${creatorRes.status})`);
        assert(creatorRes.body.error === 'Forbidden: Administrative privileges required', 'Error message requires administrative privileges');

        const noRoleRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${noRoleToken}`
        });
        assert(noRoleRes.status === 403, `Token without role property returns HTTP 403 (got ${noRoleRes.status})`);
        console.log('');

        // ----------------------------------------------------
        // TEST 4: Successful GET /api/admin/metrics with valid admin JWT
        // ----------------------------------------------------
        console.log('4. Successful GET /api/admin/metrics with valid admin token');
        const metricsRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        assert(metricsRes.status === 200, `Valid admin token returns HTTP 200 (got ${metricsRes.status})`);
        assert(typeof metricsRes.body === 'object', 'Response body is an object');
        console.log('');

        // ----------------------------------------------------
        // TEST 5: Metric Calculation Accuracy & Schema Verification
        // ----------------------------------------------------
        console.log('5. Metric Calculation Accuracy & Schema Verification');
        const metrics = metricsRes.body;

        assert(typeof metrics.totalCreators === 'number', 'totalCreators is a number');
        assert(typeof metrics.gpvZar === 'number', 'gpvZar is a number');
        assert(typeof metrics.mrrZar === 'number', 'mrrZar is a number');
        assert(typeof metrics.taxReservesZar === 'number', 'taxReservesZar is a number');
        assert(typeof metrics.channelBreakdown === 'object', 'channelBreakdown is an object');
        assert(Array.isArray(metrics.timeline), 'timeline is an array');

        // Check memoryDb baseline calculations
        const expectedTotalCreators = memoryDb.users.length;
        assert(metrics.totalCreators === expectedTotalCreators, `totalCreators (${metrics.totalCreators}) matches memoryDb count (${expectedTotalCreators})`);

        const expectedIncomeTxs = memoryDb.transactions.filter(t => (t.type || '').toLowerCase() === 'income');
        const expectedGpv = parseFloat(expectedIncomeTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0).toFixed(2));
        assert(metrics.gpvZar === expectedGpv, `gpvZar (R${metrics.gpvZar}) matches expected income sum (R${expectedGpv})`);

        const expectedProCount = memoryDb.users.filter(u => (u.plan_tier || u.planTier || '').toLowerCase() === 'pro').length;
        const expectedMrr = expectedProCount * 299;
        assert(metrics.mrrZar === expectedMrr, `mrrZar (R${metrics.mrrZar}) matches expected Pro subscriptions (R${expectedMrr})`);

        const expectedTaxReserves = parseFloat((expectedGpv * 0.15).toFixed(2));
        assert(metrics.taxReservesZar === expectedTaxReserves, `taxReservesZar (R${metrics.taxReservesZar}) matches 15% estimated holdings (R${expectedTaxReserves})`);

        // Channel breakdown verification
        const cb = metrics.channelBreakdown;
        assert(typeof cb.youtube === 'number', 'channelBreakdown.youtube is a number');
        assert(typeof cb.tiktok === 'number', 'channelBreakdown.tiktok is a number');
        assert(typeof cb.patreon === 'number', 'channelBreakdown.patreon is a number');
        assert(typeof cb.brand_deals === 'number', 'channelBreakdown.brand_deals is a number');

        const cbSum = parseFloat((cb.youtube + cb.tiktok + cb.patreon + cb.brand_deals).toFixed(2));
        assert(cbSum === expectedGpv, `Sum of channel revenue (R${cbSum}) equals total GPV (R${expectedGpv})`);

        // Timeline verification
        assert(metrics.timeline.length === 6, 'Timeline contains exactly 6 monthly data points');
        const currentMonthItem = metrics.timeline[5];
        assert(currentMonthItem.gpv === metrics.gpvZar, 'Timeline month 6 gpv matches current gpvZar');
        assert(currentMonthItem.mrr === metrics.mrrZar, 'Timeline month 6 mrr matches current mrrZar');
        assert(currentMonthItem.creators === metrics.totalCreators, 'Timeline month 6 creators matches totalCreators');
        console.log('');

        // ----------------------------------------------------
        // TEST 6: Dynamic Reaction to Data Mutations
        // ----------------------------------------------------
        console.log('6. Dynamic Reaction to Data Mutations');
        const initialCreators = metrics.totalCreators;
        const initialGpv = metrics.gpvZar;
        const initialMrr = metrics.mrrZar;
        const initialYoutube = cb.youtube;

        // Add a new Pro creator
        const newUserId = 'usr_test_dynamic_' + Date.now();
        memoryDb.users.push({
            id: newUserId,
            name: 'Dynamic Test Creator',
            email: 'dynamic@test.com',
            plan_tier: 'Pro',
            status: 'active',
            created_at: new Date().toISOString()
        });

        // Add a new YouTube income transaction of R10,000
        const newTxId = 'tx_test_dynamic_' + Date.now();
        memoryDb.transactions.push({
            id: newTxId,
            user_id: newUserId,
            date: 'Jul 30',
            source: 'YouTube',
            merchant: 'Google AdSense Test',
            type: 'income',
            category: 'YouTube AdSense',
            tax_status: 'Taxable Income',
            amount: 10000.00,
            created_at: new Date().toISOString()
        });

        // Fetch metrics again
        const updatedRes = await request('GET', '/api/admin/metrics', null, {
            'Authorization': `Bearer ${adminToken}`
        });

        const updatedMetrics = updatedRes.body;
        assert(updatedMetrics.totalCreators === initialCreators + 1, `totalCreators dynamically increased from ${initialCreators} to ${updatedMetrics.totalCreators}`);
        assert(updatedMetrics.gpvZar === parseFloat((initialGpv + 10000.00).toFixed(2)), `gpvZar dynamically increased from R${initialGpv} to R${updatedMetrics.gpvZar}`);
        assert(updatedMetrics.mrrZar === initialMrr + 299, `mrrZar dynamically increased from R${initialMrr} to R${updatedMetrics.mrrZar}`);
        assert(updatedMetrics.taxReservesZar === parseFloat(((initialGpv + 10000.00) * 0.15).toFixed(2)), `taxReservesZar dynamically updated to R${updatedMetrics.taxReservesZar}`);
        assert(updatedMetrics.channelBreakdown.youtube === parseFloat((initialYoutube + 10000.00).toFixed(2)), `channelBreakdown.youtube dynamically increased from R${initialYoutube} to R${updatedMetrics.channelBreakdown.youtube}`);
        assert(updatedMetrics.timeline[5].gpv === updatedMetrics.gpvZar, 'Timeline month 6 dynamically updated with new gpvZar');
        console.log('');

        console.log('====================================================');
        console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} assertions passed successfully!`);
        console.log('====================================================');

    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        if (testServer) {
            testServer.close();
        }
    }
}

runTests();
