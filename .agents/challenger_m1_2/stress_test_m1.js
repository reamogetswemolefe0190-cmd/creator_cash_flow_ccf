/**
 * stress_test_m1.js
 * Empirical Concurrency & Performance Stress Test Suite for M1 Gate Verification
 * Executed by Challenger M1_2
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { app, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET } = require('../../server');

let testServer;
let baseUrl;
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            method: method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            agent: keepAliveAgent,
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

let results = [];

function recordResult(testName, passed, details) {
    results.push({ testName, passed, details });
    const status = passed ? '✅ PASS' : '❌ ISSUE FOUND';
    console.log(`[${status}] ${testName}: ${details}`);
}

async function runStressTests() {
    console.log('====================================================');
    console.log('⚡ Starting Empirical Concurrency & Stress Harness (M1)');
    console.log('====================================================\n');

    await new Promise((resolve) => {
        testServer = app.listen(0, '127.0.0.1', () => {
            const port = testServer.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Stress test server listening on ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ----------------------------------------------------
        // STRESS TEST 1: Parallel Admin Logins & Rate Limit Race Condition
        // ----------------------------------------------------
        console.log('--- STRESS TEST 1: Parallel Admin Logins & Rate Limiting ---');
        adminLoginAttempts.clear();

        const PARALLEL_LOGIN_COUNT = 20;
        const loginPromises = [];
        const startTime1 = Date.now();

        for (let i = 0; i < PARALLEL_LOGIN_COUNT; i++) {
            loginPromises.push(request('POST', '/api/admin/auth/login', {
                email: 'admin@creatorcashflow.com',
                password: 'WrongPassword'
            }));
        }

        const loginResponses = await Promise.all(loginPromises);
        const duration1 = Date.now() - startTime1;

        const status401Count = loginResponses.filter(r => r.status === 401).length;
        const status429Count = loginResponses.filter(r => r.status === 429).length;

        console.log(`Parallel Admin Logins (20 requests): ${status401Count} HTTP 401, ${status429Count} HTTP 429 in ${duration1}ms`);

        if (status401Count === 5 && status429Count === 15) {
            recordResult('Parallel Admin Login Rate Limiter', true, `Exactly 5 allowed (401) and 15 rate-limited (429) under concurrent load in ${duration1}ms`);
        } else {
            recordResult('Parallel Admin Login Rate Limiter', false, `Expected 5 x 401 and 15 x 429, got ${status401Count} x 401 and ${status429Count} x 429`);
        }

        // ----------------------------------------------------
        // STRESS TEST 2: Memory Leak / Unbounded Map Growth in Rate Limiter
        // ----------------------------------------------------
        console.log('\n--- STRESS TEST 2: Rate Limiter Map Memory Growth ---');
        adminLoginAttempts.clear();

        // Simulate requests from 500 distinct IPs
        for (let i = 0; i < 500; i++) {
            const reqMock = { ip: `192.168.${Math.floor(i / 256)}.${i % 256}`, headers: {} };
            const resMock = { status: () => ({ json: () => {} }) };
            rateLimitAdminLogin(reqMock, resMock, () => {});
        }

        const mapSizeAfter500 = adminLoginAttempts.size;
        console.log(`Rate Limiter Map size after 500 distinct IPs: ${mapSizeAfter500}`);

        if (mapSizeAfter500 >= 500) {
            recordResult('Rate Limiter Memory Growth', false, `adminLoginAttempts Map retains ${mapSizeAfter500} IP keys indefinitely without background TTL cleanup / eviction mechanism (Potential memory leak under high IP turnover)`);
        } else {
            recordResult('Rate Limiter Memory Growth', true, `adminLoginAttempts Map bounds IP keys to ${mapSizeAfter500}`);
        }

        // ----------------------------------------------------
        // STRESS TEST 3: High Concurrency Token Validation Throughput (500 Requests)
        // ----------------------------------------------------
        console.log('\n--- STRESS TEST 3: High Concurrency Token Validation (500 Requests in 10 Batches) ---');
        const adminToken = jwt.sign(
            { id: 'admin_seed_1', email: 'admin@creatorcashflow.com', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const TOTAL_AUTH_REQUESTS = 500;
        const BATCH_SIZE = 50;
        const latencies = [];
        let success200Count = 0;
        let connectionErrorCount = 0;

        const startTime3 = Date.now();

        for (let b = 0; b < TOTAL_AUTH_REQUESTS / BATCH_SIZE; b++) {
            const batchPromises = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                const reqStart = Date.now();
                batchPromises.push(
                    request('GET', '/api/admin/verify-auth', null, {
                        'Authorization': `Bearer ${adminToken}`
                    }).then(res => {
                        latencies.push(Date.now() - reqStart);
                        if (res.status === 200) success200Count++;
                        return res;
                    }).catch(err => {
                        connectionErrorCount++;
                        return { status: 0, error: err.message };
                    })
                );
            }
            await Promise.all(batchPromises);
        }

        const duration3 = Date.now() - startTime3;
        latencies.sort((a, b) => a - b);

        const minLatency = latencies[0] || 0;
        const maxLatency = latencies[latencies.length - 1] || 0;
        const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
        const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
        const avgLatency = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2);
        const rps = ((TOTAL_AUTH_REQUESTS / duration3) * 1000).toFixed(2);

        console.log(`500 Token Validations: ${success200Count}/500 HTTP 200 OK (${connectionErrorCount} connection errors)`);
        console.log(`Duration: ${duration3}ms | Throughput: ${rps} req/sec`);
        console.log(`Latencies: Min=${minLatency}ms | Avg=${avgLatency}ms | p50=${p50}ms | p95=${p95}ms | p99=${p99}ms | Max=${maxLatency}ms`);

        if (success200Count === TOTAL_AUTH_REQUESTS) {
            recordResult('500 Token Validation Throughput', true, `100% success rate (${TOTAL_AUTH_REQUESTS}/${TOTAL_AUTH_REQUESTS}). Throughput: ${rps} req/sec, p95: ${p95}ms, p99: ${p99}ms`);
        } else {
            recordResult('500 Token Validation Throughput', false, `Only ${success200Count}/${TOTAL_AUTH_REQUESTS} requests succeeded (${connectionErrorCount} connection errors)`);
        }

        // ----------------------------------------------------
        // STRESS TEST 4: Concurrent User Signup ID Collision & Email Race Condition
        // ----------------------------------------------------
        console.log('\n--- STRESS TEST 4: Parallel User Signup ID Collision & Timestamp Generator ---');
        memoryDb.users = []; // Reset users for test isolation
        const SIGNUP_CONCURRENCY = 50;
        const signupPromises = [];

        for (let i = 0; i < SIGNUP_CONCURRENCY; i++) {
            signupPromises.push(request('POST', '/api/auth/signup', {
                name: `Test User ${i}`,
                email: `user_${i}_${Math.random()}@example.com`,
                password: 'Password123!'
            }));
        }

        const signupResponses = await Promise.all(signupPromises);
        const signup201Count = signupResponses.filter(r => r.status === 201).length;

        // Inspect memoryDb.users for ID collisions
        const userIds = memoryDb.users.map(u => u.id);
        const uniqueUserIds = new Set(userIds);
        const idCollisions = userIds.length - uniqueUserIds.size;

        console.log(`50 Concurrent Signups: ${signup201Count}/50 HTTP 201 Created`);
        console.log(`Total users in memoryDb: ${memoryDb.users.length} | Unique IDs: ${uniqueUserIds.size} | Collisions: ${idCollisions}`);

        if (idCollisions > 0) {
            recordResult('Signup ID Collision Risk', false, `CRITICAL RACE CONDITION: Detected ${idCollisions} duplicate user ID collisions in memoryDb.users because ID generation uses 'usr_' + Date.now() timestamp!`);
        } else {
            recordResult('Signup ID Collision Risk', true, `All ${uniqueUserIds.size} generated user IDs are unique under ${SIGNUP_CONCURRENCY} parallel signups.`);
        }

        // ----------------------------------------------------
        // STRESS TEST 5: Concurrent Duplicate Email Signup Race Condition
        // ----------------------------------------------------
        console.log('\n--- STRESS TEST 5: Concurrent Duplicate Email Signup Race Condition ---');
        memoryDb.users = [];
        const DUP_EMAIL = 'duplicate_test@example.com';
        const dupPromises = [];

        for (let i = 0; i < 10; i++) {
            dupPromises.push(request('POST', '/api/auth/signup', {
                name: `Dup User ${i}`,
                email: DUP_EMAIL,
                password: 'Password123!'
            }));
        }

        const dupResponses = await Promise.all(dupPromises);
        const dup201Count = dupResponses.filter(r => r.status === 201).length;
        const dup400Count = dupResponses.filter(r => r.status === 400).length;

        const usersWithDupEmail = memoryDb.users.filter(u => u.email === DUP_EMAIL);
        console.log(`10 Concurrent Signups for same email: ${dup201Count} x HTTP 201, ${dup400Count} x HTTP 400`);
        console.log(`Entries in memoryDb with email '${DUP_EMAIL}': ${usersWithDupEmail.length}`);

        if (usersWithDupEmail.length > 1) {
            recordResult('Duplicate Email Signup Guard', false, `RACE CONDITION: ${usersWithDupEmail.length} duplicate user records inserted into memoryDb for email '${DUP_EMAIL}' because bcrypt.hash delay occurs before email uniqueness check!`);
        } else if (usersWithDupEmail.length === 1 && dup201Count === 1 && dup400Count === 9) {
            recordResult('Duplicate Email Signup Guard', true, `Exactly 1 user created and 9 rejected with HTTP 400 under parallel duplicate email signups.`);
        } else {
            recordResult('Duplicate Email Signup Guard', false, `Unexpected state: ${usersWithDupEmail.length} users, 201 count: ${dup201Count}, 400 count: ${dup400Count}`);
        }

        // ----------------------------------------------------
        // STRESS TEST 6: Mixed Concurrent Operations & Memory Array Stability
        // ----------------------------------------------------
        console.log('\n--- STRESS TEST 6: Mixed High-Load Concurrent Operations ---');
        const mixedPromises = [];
        const MIXED_COUNT = 100;

        for (let i = 0; i < MIXED_COUNT; i++) {
            const opType = i % 4;
            if (opType === 0) {
                mixedPromises.push(request('GET', '/api/admin/verify-auth', null, { 'Authorization': `Bearer ${adminToken}` }));
            } else if (opType === 1) {
                mixedPromises.push(request('POST', '/api/admin/auth/login', { email: 'admin@creatorcashflow.com', password: 'AdminPass2026!' }));
            } else if (opType === 2) {
                mixedPromises.push(request('POST', '/api/auth/login', { email: 'user_0@example.com', password: 'Password123!' }));
            } else {
                mixedPromises.push(request('GET', '/'));
            }
        }

        const startMixed = Date.now();
        const mixedResponses = await Promise.all(mixedPromises);
        const durationMixed = Date.now() - startMixed;

        const mixedFailures = mixedResponses.filter(r => r.status >= 500).length;
        console.log(`100 Mixed Operations completed in ${durationMixed}ms with ${mixedFailures} server errors (HTTP 500+).`);

        if (mixedFailures === 0) {
            recordResult('Mixed Concurrent Operations Stability', true, `Zero server errors across 100 mixed concurrent requests (auth, verify, root, login) in ${durationMixed}ms`);
        } else {
            recordResult('Mixed Concurrent Operations Stability', false, `Encountered ${mixedFailures} server errors (HTTP 500+) under mixed concurrent load`);
        }

        // Summary
        console.log('\n====================================================');
        console.log('📊 EMPIRICAL STRESS TEST SUMMARY');
        console.log('====================================================');
        results.forEach(r => {
            console.log(`${r.passed ? '✅ PASS' : '❌ ISSUE FOUND'}: ${r.testName}`);
            console.log(`   -> ${r.details}`);
        });

    } catch (err) {
        console.error('Fatal error during stress test harness execution:', err);
    } finally {
        keepAliveAgent.destroy();
        if (testServer) {
            testServer.close();
        }
    }
}

runStressTests();
