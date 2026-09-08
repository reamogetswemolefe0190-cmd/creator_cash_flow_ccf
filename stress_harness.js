/**
 * Creator Cash Flow - Concurrency Load Generator & Telemetry Harness
 * File: stress_harness.js
 * 
 * Features:
 * - Configurable Virtual Users (VUs) & duration via CLI flags (--concurrency, --duration, --url) or ENV vars.
 * - Tuned native HTTP/HTTPS socket pooling (keepAlive: true, maxSockets: 1000, maxFreeSockets: 200).
 * - Full user lifecycle loop (Signup -> Login -> Get Txs -> Create Tx -> Admin Metrics).
 * - High-precision nanosecond resolution timing via process.hrtime.bigint().
 * - Percentiles (min, avg, max, p50, p90, p95, p99), throughput (req/sec), status code breakdown.
 * - Formatted console dashboard & JSON telemetry export to stress_test_report.json.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

process.env.STRESS_TEST = 'true';
process.env.NODE_ENV = 'test';

// ============================================================================
// 1. CONFIGURATION & CLI ARGUMENT PARSING
// ============================================================================
function parseArguments() {
    const args = process.argv.slice(2);
    let concurrency = parseInt(process.env.CONCURRENCY, 10) || 150;
    let duration = parseInt(process.env.DURATION, 10) || 15;
    let url = process.env.URL || process.env.TARGET_URL || 'http://localhost:5000';
    let pacing = process.env.PACING_MS !== undefined
        ? parseInt(process.env.PACING_MS, 10)
        : (process.env.PACING !== undefined ? parseInt(process.env.PACING, 10) : 10);

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--concurrency' || arg === '-c') {
            if (i + 1 < args.length) concurrency = parseInt(args[++i], 10);
        } else if (arg.startsWith('--concurrency=')) {
            concurrency = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--duration' || arg === '-d') {
            if (i + 1 < args.length) duration = parseInt(args[++i], 10);
        } else if (arg.startsWith('--duration=')) {
            duration = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--url' || arg === '-u') {
            if (i + 1 < args.length) url = args[++i];
        } else if (arg.startsWith('--url=')) {
            url = arg.split('=')[1];
        } else if (arg === '--pacing' || arg === '-p' || arg === '--pacing-ms') {
            if (i + 1 < args.length) pacing = parseInt(args[++i], 10);
        } else if (arg.startsWith('--pacing=')) {
            pacing = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--pacing-ms=')) {
            pacing = parseInt(arg.split('=')[1], 10);
        }
    }

    return {
        concurrency: isNaN(concurrency) || concurrency < 1 ? 150 : concurrency,
        durationSeconds: isNaN(duration) || duration < 1 ? 15 : duration,
        targetUrl: url.replace(/\/$/, ''),
        pacingMs: isNaN(pacing) || pacing < 0 ? 10 : pacing
    };
}

const config = parseArguments();

// ============================================================================
// 2. SOCKET POOL TUNING
// ============================================================================
const agentOptions = {
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 2000,
    maxFreeSockets: 500
};

const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

// ============================================================================
// 3. HTTP REQUEST HELPER (NANOSECOND TIMING)
// ============================================================================
function makeRequest(method, endpointPath, headers = {}, bodyData = null) {
    return new Promise((resolve) => {
        const fullUrlStr = `${config.targetUrl}${endpointPath}`;
        const parsedUrl = new URL(fullUrlStr);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        let payload = null;
        const reqHeaders = { 'Connection': 'keep-alive', ...headers };

        if (bodyData !== null) {
            payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
            reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const options = {
            method: method.toUpperCase(),
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            agent: isHttps ? httpsAgent : httpAgent,
            headers: reqHeaders
        };

        const startTime = process.hrtime.bigint();

        const req = client.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
                const endTime = process.hrtime.bigint();
                const latencyMs = Number(endTime - startTime) / 1e6;

                let parsedBody = null;
                try {
                    parsedBody = JSON.parse(resData);
                } catch (_) {
                    parsedBody = resData;
                }

                resolve({
                    statusCode: res.statusCode,
                    body: parsedBody,
                    latencyMs: latencyMs,
                    error: null
                });
            });
        });

        req.on('error', (err) => {
            const endTime = process.hrtime.bigint();
            const latencyMs = Number(endTime - startTime) / 1e6;
            resolve({
                statusCode: 0,
                body: null,
                latencyMs: latencyMs,
                error: err.message
            });
        });

        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

// ============================================================================
// 4. TELEMETRY METRICS AGGREGATOR
// ============================================================================
class TelemetryCollector {
    constructor() {
        this.totalRequests = 0;
        this.status2xx = 0;
        this.status4xx = 0;
        this.status5xx = 0;
        this.networkErrors = 0;
        this.otherStatus = 0;
        this.latencies = [];

        this.endpoints = {
            'POST /api/auth/signup': { total: 0, success: 0, latencies: [] },
            'POST /api/auth/login': { total: 0, success: 0, latencies: [] },
            'GET /api/transactions': { total: 0, success: 0, latencies: [] },
            'POST /api/transactions': { total: 0, success: 0, latencies: [] },
            'GET /api/admin/metrics': { total: 0, success: 0, latencies: [] }
        };
    }

    record(endpointKey, res) {
        this.totalRequests++;
        const lat = res.latencyMs;
        this.latencies.push(lat);

        if (!this.endpoints[endpointKey]) {
            this.endpoints[endpointKey] = { total: 0, success: 0, latencies: [] };
        }
        const ep = this.endpoints[endpointKey];
        ep.total++;

        if (res.statusCode >= 200 && res.statusCode < 300) {
            this.status2xx++;
            ep.success++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
            this.status4xx++;
        } else if (res.statusCode >= 500 && res.statusCode < 600) {
            this.status5xx++;
        } else if (res.statusCode === 0) {
            this.networkErrors++;
        } else {
            this.otherStatus++;
        }

        ep.latencies.push(lat);
    }
}

function calculatePercentiles(latencies) {
    if (!latencies || latencies.length === 0) {
        return { min: 0, avg: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    const getP = (p) => {
        const idx = Math.max(0, Math.min(count - 1, Math.ceil((p / 100) * count) - 1));
        return sorted[idx];
    };

    return {
        min: Number(sorted[0].toFixed(2)),
        avg: Number(avg.toFixed(2)),
        max: Number(sorted[count - 1].toFixed(2)),
        p50: Number(getP(50).toFixed(2)),
        p90: Number(getP(90).toFixed(2)),
        p95: Number(getP(95).toFixed(2)),
        p99: Number(getP(99).toFixed(2))
    };
}

// ============================================================================
// 5. SERVER MANAGEMENT (EPHEMERAL SPAWN IF UNREACHABLE)
// ============================================================================
async function checkHealth() {
    const res = await makeRequest('GET', '/api/health');
    return res.statusCode === 200;
}

async function ensureServerRunning() {
    const healthy = await checkHealth();
    if (healthy) {
        console.log(`[HARNESS] Target server at ${config.targetUrl} is live.`);
        return null;
    }

    console.log(`[HARNESS] Server at ${config.targetUrl} unreachable. Spawning server.js process...`);
    const serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: '5000', STRESS_TEST: 'true', NODE_ENV: 'test' },
        stdio: 'ignore'
    });

    let attempts = 0;
    while (attempts < 30) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
        if (await checkHealth()) {
            console.log(`[HARNESS] Ephemeral server.js successfully started and healthy.`);
            return serverProcess;
        }
    }

    throw new Error('Failed to start server.js within 9 seconds.');
}

// ============================================================================
// 6. ADMIN AUTHENTICATION
// ============================================================================
async function obtainAdminToken() {
    // Attempt login first
    const res = await makeRequest('POST', '/api/admin/auth/login', {}, {
        email: 'admin@creatorcashflow.com',
        password: 'AdminPass2026!'
    });

    if (res.statusCode === 200 && res.body && res.body.token) {
        return res.body.token;
    }

    // Fallback: Generate signed JWT token locally using project secret
    const jwtSecret = process.env.JWT_SECRET || 'creator_cash_flow_secret_key_2026';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.co.za';
    return jwt.sign(
        { id: 'admin_master_1', email: adminEmail, role: 'admin' },
        jwtSecret,
        { expiresIn: '24h' }
    );
}

// ============================================================================
// 7. VIRTUAL USER WORKFLOW LOOP
// ============================================================================
let stopSignal = false;

const delay = (ms) => ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve();

async function runVU(vuId, endTime, adminToken, telemetry) {
    let iteration = 0;
    const vuIp = `10.0.${Math.floor(vuId / 256)}.${vuId % 256}`;
    const baseHeaders = { 'X-Forwarded-For': vuIp };

    while (Date.now() < endTime && !stopSignal) {
        iteration++;
        const uniqueId = `${vuId}_${iteration}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const email = `vu_${uniqueId}@stress.test`;
        const password = 'Password123!';
        const name = `Stress VU ${vuId}`;

        // 1. User Signup
        if (Date.now() >= endTime || stopSignal) break;
        const signupRes = await makeRequest('POST', '/api/auth/signup', baseHeaders, { email, password, name });
        telemetry.record('POST /api/auth/signup', signupRes);
        if (config.pacingMs > 0) await delay(config.pacingMs);

        // 2. User Login
        if (Date.now() >= endTime || stopSignal) break;
        const loginRes = await makeRequest('POST', '/api/auth/login', baseHeaders, { email, password });
        telemetry.record('POST /api/auth/login', loginRes);
        const userToken = loginRes.body && loginRes.body.token ? loginRes.body.token : null;
        if (config.pacingMs > 0) await delay(config.pacingMs);

        // 3. Fetch Transactions
        if (Date.now() >= endTime || stopSignal) break;
        const authHeader = userToken ? { ...baseHeaders, 'Authorization': `Bearer ${userToken}` } : { ...baseHeaders };
        const fetchTxRes = await makeRequest('GET', '/api/transactions', authHeader);
        telemetry.record('GET /api/transactions', fetchTxRes);
        if (config.pacingMs > 0) await delay(config.pacingMs);

        // 4. Create Transaction
        if (Date.now() >= endTime || stopSignal) break;
        const newTx = {
            source: 'YouTube',
            merchant: 'Google AdSense',
            type: 'income',
            category: 'Creator Revenue',
            amount: 1250.00 + (vuId % 100)
        };
        const createTxRes = await makeRequest('POST', '/api/transactions', authHeader, newTx);
        telemetry.record('POST /api/transactions', createTxRes);
        if (config.pacingMs > 0) await delay(config.pacingMs);

        // 5. Admin Metrics Query
        if (Date.now() >= endTime || stopSignal) break;
        const adminHeader = { ...baseHeaders, 'Authorization': `Bearer ${adminToken}` };
        const adminMetricsRes = await makeRequest('GET', '/api/admin/metrics', adminHeader);
        telemetry.record('GET /api/admin/metrics', adminMetricsRes);
        if (config.pacingMs > 0) await delay(config.pacingMs);
    }
}

// ============================================================================
// 8. MAIN BENCHMARK EXECUTION
// ============================================================================
async function run() {
    process.on('SIGINT', () => {
        console.log('\n[HARNESS] SIGINT received, stopping VUs and compiling report...');
        stopSignal = true;
    });

    let spawnedServer = null;
    try {
        spawnedServer = await ensureServerRunning();
        const adminToken = await obtainAdminToken();
        const telemetry = new TelemetryCollector();

        console.log(`\n================================================================================`);
        console.log(`           CREATOR CASH FLOW - CONCURRENCY STRESS TEST HARNESS                  `);
        console.log(`================================================================================`);
        console.log(` Target Server URL : ${config.targetUrl}`);
        console.log(` Concurrency (VUs) : ${config.concurrency} Virtual Users`);
        console.log(` Test Duration     : ${config.durationSeconds} seconds`);
        console.log(` Step Pacing       : ${config.pacingMs} ms`);
        console.log(` High-Res Timer    : process.hrtime.bigint() (Nanosecond Precision)`);
        console.log(` Socket Pool       : maxSockets=2000, maxFreeSockets=500, keepAlive=true`);
        console.log(`================================================================================\n`);
        console.log(`🚀 Benchmarking under load... Please wait...`);

        const wallStartNs = process.hrtime.bigint();
        const startTimeMs = Date.now();
        const endTimeMs = startTimeMs + (config.durationSeconds * 1000);

        const vuPromises = [];
        for (let i = 1; i <= config.concurrency; i++) {
            vuPromises.push(runVU(i, endTimeMs, adminToken, telemetry));
        }

        await Promise.all(vuPromises);
        const wallEndNs = process.hrtime.bigint();

        const actualDurationSec = Number(wallEndNs - wallStartNs) / 1e9;
        const requestsPerSec = actualDurationSec > 0 ? (telemetry.totalRequests / actualDurationSec) : 0;
        const overallLatencies = calculatePercentiles(telemetry.latencies);
        const successRatePercent = telemetry.totalRequests > 0
            ? Number(((telemetry.status2xx / telemetry.totalRequests) * 100).toFixed(2))
            : 0;

        // Build per-endpoint stats object
        const endpointBreakdown = {};
        for (const [epKey, epData] of Object.entries(telemetry.endpoints)) {
            const epStats = calculatePercentiles(epData.latencies);
            const epSuccessRate = epData.total > 0
                ? Number(((epData.success / epData.total) * 100).toFixed(2))
                : 0;

            endpointBreakdown[epKey] = {
                count: epData.total,
                successCount: epData.success,
                successRatePercent: epSuccessRate,
                latenciesMs: epStats
            };
        }

        const reportData = {
            timestamp: new Date().toISOString(),
            config: {
                concurrency: config.concurrency,
                durationSeconds: config.durationSeconds,
                targetUrl: config.targetUrl,
                pacingMs: config.pacingMs
            },
            summary: {
                totalRequests: telemetry.totalRequests,
                successfulRequests: telemetry.status2xx,
                clientErrors: telemetry.status4xx,
                serverErrors: telemetry.status5xx,
                networkErrors: telemetry.networkErrors,
                successRatePercent: successRatePercent,
                actualDurationSeconds: Number(actualDurationSec.toFixed(2)),
                requestsPerSecond: Number(requestsPerSec.toFixed(2))
            },
            latenciesMs: overallLatencies,
            endpointBreakdown: endpointBreakdown
        };

        // Write JSON telemetry export
        const reportPath = path.join(__dirname, 'stress_test_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');

        // Print Visual Summary Dashboard
        console.log(`\n================================================================================`);
        console.log(`                 STRESS TEST TELEMETRY SUMMARY DASHBOARD                        `);
        console.log(`================================================================================`);
        console.log(` [CONFIG]`);
        console.log(`   • Target Server URL : ${config.targetUrl}`);
        console.log(`   • Concurrency (VUs) : ${config.concurrency}`);
        console.log(`   • Target Duration   : ${config.durationSeconds}s`);
        console.log(`   • Step Pacing       : ${config.pacingMs}ms`);
        console.log(`   • Actual Duration   : ${actualDurationSec.toFixed(2)}s`);
        console.log(``);
        console.log(` [SUMMARY TELEMETRY]`);
        console.log(`   • Total Requests    : ${telemetry.totalRequests.toLocaleString()}`);
        console.log(`   • Throughput        : ${requestsPerSec.toFixed(2)} req/sec`);
        console.log(`   • Success Rate      : ${successRatePercent.toFixed(2)}%`);
        console.log(`   • 2xx Successes     : ${telemetry.status2xx.toLocaleString()}`);
        console.log(`   • 4xx Client Errors : ${telemetry.status4xx.toLocaleString()}`);
        console.log(`   • 5xx Server Errors : ${telemetry.status5xx.toLocaleString()}`);
        console.log(`   • Network/Socket Err: ${telemetry.networkErrors.toLocaleString()}`);
        console.log(``);
        console.log(` [LATENCY PERCENTILES (ms)]`);
        console.log(`   • Min Latency       : ${overallLatencies.min} ms`);
        console.log(`   • Avg Latency       : ${overallLatencies.avg} ms`);
        console.log(`   • Max Latency       : ${overallLatencies.max} ms`);
        console.log(`   • p50 (Median)      : ${overallLatencies.p50} ms`);
        console.log(`   • p90 Latency       : ${overallLatencies.p90} ms`);
        console.log(`   • p95 Latency       : ${overallLatencies.p95} ms`);
        console.log(`   • p99 Latency       : ${overallLatencies.p99} ms`);
        console.log(``);
        console.log(` [ENDPOINT BREAKDOWN]`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(` Endpoint                 | Count  | Success % | Avg(ms) | p95(ms) | p99(ms)`);
        console.log(`--------------------------------------------------------------------------------`);
        for (const [epName, epInfo] of Object.entries(endpointBreakdown)) {
            const padName = epName.padEnd(25, ' ');
            const padCount = String(epInfo.count).padStart(6, ' ');
            const padSucc = `${epInfo.successRatePercent.toFixed(1)}%`.padStart(9, ' ');
            const padAvg = String(epInfo.latenciesMs.avg).padStart(7, ' ');
            const padP95 = String(epInfo.latenciesMs.p95).padStart(7, ' ');
            const padP99 = String(epInfo.latenciesMs.p99).padStart(7, ' ');
            console.log(` ${padName} | ${padCount} | ${padSucc} | ${padAvg} | ${padP95} | ${padP99}`);
        }
        console.log(`--------------------------------------------------------------------------------`);
        console.log(` Detailed JSON telemetry written to: ${reportPath}`);
        console.log(`================================================================================\n`);

    } catch (err) {
        console.error('\n[HARNESS FATAL ERROR]', err);
        process.exitCode = 1;
    } finally {
        if (spawnedServer) {
            console.log('[HARNESS] Terminating ephemeral server.js process...');
            spawnedServer.kill();
        }
    }
}

run();
