/**
 * test_metrics_concurrency.js
 * Empirical Concurrency & Response Throughput Benchmark Harness for GET /api/admin/metrics
 * Developed by Challenger M2_2
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { performance } = require('perf_hooks');
const { app, memoryDb, JWT_SECRET } = require('./server');

let testServer;
let baseUrl;

// Create custom http Agent with keepAlive and high maxSockets
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 1000,
    maxFreeSockets: 200
});

function request(method, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        const url = new URL(path, baseUrl);
        const options = {
            method: method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            agent: httpAgent,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                const duration = performance.now() - start;
                let parsed = null;
                try {
                    parsed = JSON.parse(responseData);
                } catch (e) {
                    parsed = responseData;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    duration
                });
            });
        });

        req.on('error', err => {
            const duration = performance.now() - start;
            resolve({
                status: 0,
                error: err.code || err.message,
                duration
            });
        });

        req.end();
    });
}

function calculatePercentiles(durations) {
    if (!durations || durations.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;
    return {
        min: sorted[0].toFixed(2),
        p50: sorted[Math.floor(count * 0.50)].toFixed(2),
        p90: sorted[Math.floor(count * 0.90)].toFixed(2),
        p95: sorted[Math.floor(count * 0.95)].toFixed(2),
        p99: sorted[Math.floor(count * 0.99)].toFixed(2),
        max: sorted[count - 1].toFixed(2),
        avg: (sorted.reduce((a, b) => a + b, 0) / count).toFixed(2)
    };
}

async function runConcurrencyBenchmarks() {
    console.log('================================================================');
    console.log('🚀 Challenger M2_2: Concurrency & Response Throughput Benchmark');
    console.log(' Target Endpoint: GET /api/admin/metrics');
    console.log('================================================================\n');

    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`📡 Dynamic Benchmark Server active at ${baseUrl}\n`);
            resolve();
        });
    });

    testServer.on('error', (err) => {
        console.error('💥 Server error event:', err);
    });

    const adminToken = jwt.sign(
        { id: 'admin_perf_test', email: 'admin@creatorcashflow.com', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const creatorToken = jwt.sign(
        { id: 'creator_perf_test', email: 'creator@creatorcashflow.com', role: 'creator' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const results = {};

    // ----------------------------------------------------------------
    // SCENARIO 1: 200 Parallel Valid Admin Requests
    // ----------------------------------------------------------------
    try {
        console.log('📊 SCENARIO 1: 200 Parallel Requests with Valid Admin Token');
        const count1 = 200;
        const start1 = performance.now();
        const promises1 = [];
        for (let i = 0; i < count1; i++) {
            promises1.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${adminToken}` }));
        }
        const res1 = await Promise.all(promises1);
        const totalTime1 = performance.now() - start1;

        const statusCounts1 = res1.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats1 = calculatePercentiles(res1.map(r => r.duration));
        const rps1 = ((count1 / totalTime1) * 1000).toFixed(2);

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts1)}`);
        console.log(`   - Wall Time: ${totalTime1.toFixed(2)} ms`);
        console.log(`   - Throughput: ${rps1} req/sec`);
        console.log(`   - Latency (ms): Min ${stats1.min} | Avg ${stats1.avg} | P50 ${stats1.p50} | P90 ${stats1.p90} | P95 ${stats1.p95} | P99 ${stats1.p99} | Max ${stats1.max}`);
        
        const validPayload = res1.every(r => r.status === 200 && r.body && r.body.totalCreators !== undefined && r.body.gpvZar !== undefined && Array.isArray(r.body.timeline));
        console.log(`   - Payload Integrity: ${validPayload ? '✅ 100% Valid Schema across all 200 responses' : '❌ Schema Mismatch Detected'}`);
        console.log('');

        results.scenario1 = { count: count1, wallTimeMs: totalTime1, rps: rps1, stats: stats1, statusCounts: statusCounts1, validPayload };
    } catch (e1) {
        console.error('❌ Scenario 1 Error:', e1);
    }

    // ----------------------------------------------------------------
    // SCENARIO 2: 200 Parallel Unauthorized Requests (No Token)
    // ----------------------------------------------------------------
    try {
        console.log('🔒 SCENARIO 2: 200 Parallel Requests WITHOUT Token (HTTP 401 Enforcement)');
        const count2 = 200;
        const start2 = performance.now();
        const promises2 = [];
        for (let i = 0; i < count2; i++) {
            promises2.push(request('GET', '/api/admin/metrics'));
        }
        const res2 = await Promise.all(promises2);
        const totalTime2 = performance.now() - start2;

        const statusCounts2 = res2.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats2 = calculatePercentiles(res2.map(r => r.duration));
        const rps2 = ((count2 / totalTime2) * 1000).toFixed(2);

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts2)}`);
        console.log(`   - Wall Time: ${totalTime2.toFixed(2)} ms`);
        console.log(`   - Throughput: ${rps2} req/sec`);
        console.log(`   - Latency (ms): Min ${stats2.min} | Avg ${stats2.avg} | P50 ${stats2.p50} | P95 ${stats2.p95} | Max ${stats2.max}`);
        console.log('');

        results.scenario2 = { count: count2, wallTimeMs: totalTime2, rps: rps2, stats: stats2, statusCounts: statusCounts2 };
    } catch (e2) {
        console.error('❌ Scenario 2 Error:', e2);
    }

    // ----------------------------------------------------------------
    // SCENARIO 3: 200 Parallel Non-Admin Requests (HTTP 403 Enforcement)
    // ----------------------------------------------------------------
    try {
        console.log('🔒 SCENARIO 3: 200 Parallel Requests with Creator Token (HTTP 403 Enforcement)');
        const count3 = 200;
        const start3 = performance.now();
        const promises3 = [];
        for (let i = 0; i < count3; i++) {
            promises3.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${creatorToken}` }));
        }
        const res3 = await Promise.all(promises3);
        const totalTime3 = performance.now() - start3;

        const statusCounts3 = res3.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats3 = calculatePercentiles(res3.map(r => r.duration));
        const rps3 = ((count3 / totalTime3) * 1000).toFixed(2);

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts3)}`);
        console.log(`   - Wall Time: ${totalTime3.toFixed(2)} ms`);
        console.log(`   - Throughput: ${rps3} req/sec`);
        console.log(`   - Latency (ms): Min ${stats3.min} | Avg ${stats3.avg} | P50 ${stats3.p50} | P95 ${stats3.p95} | Max ${stats3.max}`);
        console.log('');

        results.scenario3 = { count: count3, wallTimeMs: totalTime3, rps: rps3, stats: stats3, statusCounts: statusCounts3 };
    } catch (e3) {
        console.error('❌ Scenario 3 Error:', e3);
    }

    // ----------------------------------------------------------------
    // SCENARIO 4: 300 Mixed Concurrent Requests (100 Admin + 100 No Token + 100 Creator)
    // ----------------------------------------------------------------
    try {
        console.log('🔀 SCENARIO 4: 300 Mixed Parallel Requests (Isolation & Security)');
        const start4 = performance.now();
        const promises4 = [];
        for (let i = 0; i < 100; i++) {
            promises4.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${adminToken}` }));
            promises4.push(request('GET', '/api/admin/metrics'));
            promises4.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${creatorToken}` }));
        }
        const res4 = await Promise.all(promises4);
        const totalTime4 = performance.now() - start4;

        const statusCounts4 = res4.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats4 = calculatePercentiles(res4.map(r => r.duration));
        const rps4 = ((300 / totalTime4) * 1000).toFixed(2);

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts4)}`);
        console.log(`   - Wall Time: ${totalTime4.toFixed(2)} ms`);
        console.log(`   - Throughput: ${rps4} req/sec`);
        console.log(`   - Latency (ms): Min ${stats4.min} | Avg ${stats4.avg} | P50 ${stats4.p50} | P95 ${stats4.p95} | Max ${stats4.max}`);
        
        const isolatedCorrectly = (statusCounts4[200] === 100 && statusCounts4[401] === 100 && statusCounts4[403] === 100);
        console.log(`   - Strict Role & Auth Isolation: ${isolatedCorrectly ? '✅ PASS (100x 200, 100x 401, 100x 403)' : '❌ FAIL'}`);
        console.log('');

        results.scenario4 = { count: 300, wallTimeMs: totalTime4, rps: rps4, stats: stats4, statusCounts: statusCounts4, isolatedCorrectly };
    } catch (e4) {
        console.error('❌ Scenario 4 Error:', e4);
    }

    // ----------------------------------------------------------------
    // SCENARIO 5: 500 High-Load Parallel Valid Admin Requests
    // ----------------------------------------------------------------
    try {
        console.log('📊 SCENARIO 5: 500 Parallel Requests with Valid Admin Token (High Load Stress)');
        const count5 = 500;
        const start5 = performance.now();
        const promises5 = [];
        for (let i = 0; i < count5; i++) {
            promises5.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${adminToken}` }));
        }
        const res5 = await Promise.all(promises5);
        const totalTime5 = performance.now() - start5;

        const statusCounts5 = res5.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats5 = calculatePercentiles(res5.map(r => r.duration));
        const rps5 = ((count5 / totalTime5) * 1000).toFixed(2);

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts5)}`);
        console.log(`   - Wall Time: ${totalTime5.toFixed(2)} ms`);
        console.log(`   - Throughput: ${rps5} req/sec`);
        console.log(`   - Latency (ms): Min ${stats5.min} | Avg ${stats5.avg} | P50 ${stats5.p50} | P90 ${stats5.p90} | P95 ${stats5.p95} | P99 ${stats5.p99} | Max ${stats5.max}`);
        console.log('');

        results.scenario5 = { count: count5, wallTimeMs: totalTime5, rps: rps5, stats: stats5, statusCounts: statusCounts5 };
    } catch (e5) {
        console.error('❌ Scenario 5 Error:', e5);
    }

    // ----------------------------------------------------------------
    // SCENARIO 6: Concurrency Under Dynamic Mutations (Race Condition Test)
    // ----------------------------------------------------------------
    try {
        console.log('⚡ SCENARIO 6: 100 Concurrent Requests during 50 Concurrent Memory DB Mutations');
        const start6 = performance.now();
        const promises6 = [];

        // Launch 100 read requests
        for (let i = 0; i < 100; i++) {
            promises6.push(request('GET', '/api/admin/metrics', { 'Authorization': `Bearer ${adminToken}` }));
        }

        // Simultaneously mutate memoryDb
        for (let j = 0; j < 50; j++) {
            memoryDb.users.push({
                id: `usr_race_${j}_${Date.now()}`,
                name: `Race Creator ${j}`,
                email: `race_${j}@test.com`,
                plan_tier: j % 2 === 0 ? 'Pro' : 'Free',
                status: 'active',
                created_at: new Date().toISOString()
            });
            memoryDb.transactions.push({
                id: `tx_race_${j}_${Date.now()}`,
                user_id: `usr_race_${j}`,
                date: 'Jul 30',
                source: j % 2 === 0 ? 'YouTube' : 'TikTok',
                merchant: 'AdSense Race Test',
                type: 'income',
                category: 'AdSense',
                tax_status: 'Taxable Income',
                amount: 1000.00,
                created_at: new Date().toISOString()
            });
        }

        const res6 = await Promise.all(promises6);
        const totalTime6 = performance.now() - start6;

        const statusCounts6 = res6.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        const stats6 = calculatePercentiles(res6.map(r => r.duration));

        const noCorruptedValues = res6.every(r => {
            const b = r.body;
            return b && !isNaN(b.totalCreators) && !isNaN(b.gpvZar) && !isNaN(b.mrrZar) && !isNaN(b.taxReservesZar);
        });

        console.log(`   - Status Codes: ${JSON.stringify(statusCounts6)}`);
        console.log(`   - Wall Time: ${totalTime6.toFixed(2)} ms`);
        console.log(`   - Latency (ms): Min ${stats6.min} | Avg ${stats6.avg} | P90 ${stats6.p90} | Max ${stats6.max}`);
        console.log(`   - Calculation Stability under Mutation: ${noCorruptedValues ? '✅ PASS (No NaN or undefined)' : '❌ FAIL'}`);
        console.log('');

        results.scenario6 = { count: 100, wallTimeMs: totalTime6, stats: stats6, statusCounts: statusCounts6, noCorruptedValues };
    } catch (e6) {
        console.error('❌ Scenario 6 Error:', e6);
    }

    console.log('================================================================');
    console.log('🎉 ALL BENCHMARKS COMPLETED');
    console.log('================================================================');

    httpAgent.destroy();
    if (testServer) {
        testServer.close();
    }
}

runConcurrencyBenchmarks();
