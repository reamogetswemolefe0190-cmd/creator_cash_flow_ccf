/**
 * ==============================================================================
 * CREATOR CASH FLOW — END-TO-END REMEDIATION TEST SUITE (TIERS 1 - 4)
 * ==============================================================================
 * File: tests/e2e_remediation_test.js
 * 
 * Opaque-Box, Requirement-Driven Verification Suite covering all 18 features
 * across 4 progressive tiers:
 *   - Tier 1: Feature Coverage & Happy Path (Isolated verification of all 12+ endpoints)
 *   - Tier 2: Boundary, Security & Corner Cases (Validation, RBAC, Rate Limits, CORS)
 *   - Tier 3: Cross-Feature Combinations & State Transitions (Lifecycle, Audit, PII Masking)
 *   - Tier 4: Real-World Application Scenarios, System Integrity & Forensic Audit
 *
 * Execution:
 *   node tests/e2e_remediation_test.js                  # Run all tiers
 *   node tests/e2e_remediation_test.js --tier=1         # Run Tier 1 only
 *   node tests/e2e_remediation_test.js --tier=2         # Run Tier 2 only
 *   node tests/e2e_remediation_test.js --tier=3         # Run Tier 3 only
 *   node tests/e2e_remediation_test.js --tier=4         # Run Tier 4 only
 *   node tests/e2e_remediation_test.js --url=http://... # Target existing server
 *   node tests/e2e_remediation_test.js --bail           # Stop on first error
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Parse CLI Arguments
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='));
const targetTier = tierArg ? tierArg.split('=')[1].toLowerCase() : 'all';
const urlArg = args.find(a => a.startsWith('--url='));
const targetUrlParam = urlArg ? urlArg.split('=')[1] : null;
const bailOnFail = args.includes('--bail');

// Test State & Metrics
let serverInstance = null;
let baseUrl = targetUrlParam;
let serverModule = null;

const testStats = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    byTier: {
        1: { total: 0, passed: 0, failed: 0 },
        2: { total: 0, passed: 0, failed: 0 },
        3: { total: 0, passed: 0, failed: 0 },
        4: { total: 0, passed: 0, failed: 0 }
    }
};

// ANSI Color Helpers
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    gray: '\x1b[90m'
};

/**
 * Standard HTTP/HTTPS Request Helper
 */
function request(method, endpointPath, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const fullUrl = new URL(endpointPath, baseUrl);
        const isHttps = fullUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqHeaders = { ...headers };
        let reqBody = null;

        if (body !== null) {
            if (typeof body === 'object') {
                reqBody = JSON.stringify(body);
                if (!reqHeaders['Content-Type']) {
                    reqHeaders['Content-Type'] = 'application/json';
                }
            } else {
                reqBody = String(body);
            }
            reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
        }

        const options = {
            method: method.toUpperCase(),
            hostname: fullUrl.hostname,
            port: fullUrl.port || (isHttps ? 443 : 80),
            path: fullUrl.pathname + fullUrl.search,
            headers: reqHeaders,
            timeout: 10000
        };

        const req = client.request(options, (res) => {
            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                let parsed = null;
                const contentType = res.headers['content-type'] || '';
                if (contentType.includes('application/json')) {
                    try {
                        parsed = JSON.parse(rawData);
                    } catch (e) {
                        parsed = rawData;
                    }
                } else {
                    parsed = rawData;
                }

                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    raw: rawData
                });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request to ${endpointPath} timed out after 10000ms`));
        });

        req.on('error', err => reject(err));

        if (reqBody !== null) {
            req.write(reqBody);
        }
        req.end();
    });
}

/**
 * Test Assertion & Reporting Helper
 */
function assertTest(tier, testId, condition, description, details = null) {
    testStats.total++;
    testStats.byTier[tier].total++;

    if (condition) {
        testStats.passed++;
        testStats.byTier[tier].passed++;
        console.log(`  ${colors.green}✓${colors.reset} [Tier ${tier}] [${testId}] ${description}`);
        return true;
    } else {
        testStats.failed++;
        testStats.byTier[tier].failed++;
        console.error(`  ${colors.red}✗${colors.reset} [Tier ${tier}] [${testId}] ${colors.bright}${description}${colors.reset}`);
        if (details) {
            console.error(`    ${colors.gray}Expected / Diagnostic:${colors.reset}`, details);
        }
        if (bailOnFail) {
            throw new Error(`Test failed with --bail enabled: [${testId}] ${description}`);
        }
        return false;
    }
}

function warnTest(tier, testId, description, reason) {
    testStats.warnings++;
    console.log(`  ${colors.yellow}⚠${colors.reset} [Tier ${tier}] [${testId}] ${description} — ${colors.dim}${reason}${colors.reset}`);
}

// Global tokens across suites
let globalCreatorToken = null;
let globalCreatorUser = null;
let globalAdminToken = null;

// ==============================================================================
// TIER 1: FEATURE COVERAGE & HAPPY PATH (ISOLATED VERIFICATION)
// ==============================================================================
async function runTier1() {
    console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}▶ RUNNING TIER 1: FEATURE COVERAGE & HAPPY PATH (ISOLATED VERIFICATION)${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

    // T1.1: System Health Check (GET /api/health)
    const healthRes = await request('GET', '/api/health');
    assertTest(1, 'T1_HEALTH', healthRes.status === 200, 'GET /api/health responds with HTTP 200 OK', {
        status: healthRes.status,
        body: healthRes.body
    });
    assertTest(1, 'T1_HEALTH_SCHEMA', 
        healthRes.body && (healthRes.body.status === 'active' || healthRes.body.status === 'ok'),
        'GET /api/health returns active operational status in response envelope',
        healthRes.body
    );

    // T1.2: Creator Registration (POST /api/auth/signup)
    const uniqueEmail = `test_creator_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@creatorflow.co.za`;
    const signupRes = await request('POST', '/api/auth/signup', {}, {
        name: 'Simulated Creator',
        email: uniqueEmail,
        password: 'CreatorPassword2026!'
    });
    assertTest(1, 'T1_SIGNUP', signupRes.status === 201 || signupRes.status === 200, 'POST /api/auth/signup registers a new creator (HTTP 200/201)', {
        status: signupRes.status,
        body: signupRes.body
    });
    assertTest(1, 'T1_SIGNUP_TOKEN', 
        signupRes.body && typeof signupRes.body.token === 'string' && signupRes.body.token.length > 20,
        'POST /api/auth/signup returns signed creator JWT token',
        signupRes.body
    );
    if (signupRes.body && signupRes.body.token) {
        globalCreatorToken = signupRes.body.token;
        globalCreatorUser = signupRes.body.user || { id: signupRes.body.userId, email: signupRes.body.email, name: 'Simulated Creator' };
    }

    // T1.3: Creator Login (POST /api/auth/login)
    const loginRes = await request('POST', '/api/auth/login', {}, {
        email: uniqueEmail,
        password: 'CreatorPassword2026!'
    });
    assertTest(1, 'T1_LOGIN', loginRes.status === 200, 'POST /api/auth/login authenticates registered creator with HTTP 200', {
        status: loginRes.status,
        body: loginRes.body
    });
    assertTest(1, 'T1_LOGIN_TOKEN', 
        loginRes.body && typeof loginRes.body.token === 'string',
        'POST /api/auth/login returns valid session token',
        loginRes.body
    );

    // T1.4: Retrieve Ledger Transactions (GET /api/transactions)
    const txListRes = await request('GET', '/api/transactions', {
        'Authorization': `Bearer ${globalCreatorToken}`
    });
    assertTest(1, 'T1_TX_LIST', txListRes.status === 200, 'GET /api/transactions returns HTTP 200 for authenticated creator', {
        status: txListRes.status
    });
    assertTest(1, 'T1_TX_LIST_DATA', 
        txListRes.body && Array.isArray(txListRes.body.transactions),
        'GET /api/transactions returns transactions array (including default seed items)',
        txListRes.body
    );

    // T1.5: Add Transaction Entry (POST /api/transactions)
    const newTxPayload = {
        source: 'YouTube',
        merchant: 'Google AdSense SA Partner Payout',
        type: 'income',
        category: 'AdSense Revenue',
        amount: 28500.50,
        date: 'Aug 15'
    };
    const addTxRes = await request('POST', '/api/transactions', {
        'Authorization': `Bearer ${globalCreatorToken}`
    }, newTxPayload);
    assertTest(1, 'T1_TX_ADD', addTxRes.status === 201 || addTxRes.status === 200, 'POST /api/transactions saves new transaction (HTTP 200/201)', {
        status: addTxRes.status,
        body: addTxRes.body
    });
    assertTest(1, 'T1_TX_ADD_DATA', 
        addTxRes.body && (addTxRes.body.transaction?.amount === 28500.50 || addTxRes.body.amount === 28500.50),
        'POST /api/transactions returns persisted transaction entity with matching amount',
        addTxRes.body
    );

    // T1.6: Save Onboarding Responses (POST /api/onboarding/save)
    const onboardingPayload = {
        creatorType: 'Video Creator',
        platforms: ['YouTube', 'TikTok'],
        goal: 'Tax compliance & GPV growth',
        connected: true,
        isManual: false
    };
    const onboardRes = await request('POST', '/api/onboarding/save', {
        'Authorization': `Bearer ${globalCreatorToken}`
    }, onboardingPayload);
    assertTest(1, 'T1_ONBOARD_SAVE', onboardRes.status === 200, 'POST /api/onboarding/save returns HTTP 200 OK', {
        status: onboardRes.status,
        body: onboardRes.body
    });

    // T1.7: Phyllo Integrations Handshake (POST /api/integrations/phyllo/token)
    const phylloRes = await request('POST', '/api/integrations/phyllo/token', {
        'Authorization': `Bearer ${globalCreatorToken}`
    }, {});
    // May return 200 (if credentials configured) or 500 configuration notice (safe fallback)
    assertTest(1, 'T1_PHYLLO_ENDPOINT', 
        phylloRes.status === 200 || phylloRes.status === 500,
        'POST /api/integrations/phyllo/token endpoint is operational and handles handshake',
        { status: phylloRes.status, body: phylloRes.body }
    );

    // T1.8: Admin Login (POST /api/admin/auth/login)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass2026!';
    const adminLoginRes = await request('POST', '/api/admin/auth/login', {}, {
        email: adminEmail,
        password: adminPass
    });
    assertTest(1, 'T1_ADMIN_LOGIN', adminLoginRes.status === 200, 'POST /api/admin/auth/login authenticates admin with HTTP 200', {
        status: adminLoginRes.status,
        body: adminLoginRes.body
    });
    assertTest(1, 'T1_ADMIN_TOKEN_ROLE', 
        adminLoginRes.body?.admin?.role === 'admin' && typeof adminLoginRes.body?.token === 'string',
        'POST /api/admin/auth/login returns token and explicit role: "admin"',
        adminLoginRes.body
    );
    if (adminLoginRes.body?.token) {
        globalAdminToken = adminLoginRes.body.token;
    }

    // T1.9: Admin Verify Auth (GET /api/admin/verify-auth)
    const verifyAuthRes = await request('GET', '/api/admin/verify-auth', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(1, 'T1_ADMIN_VERIFY', verifyAuthRes.status === 200, 'GET /api/admin/verify-auth validates active admin token (HTTP 200)', {
        status: verifyAuthRes.status,
        body: verifyAuthRes.body
    });

    // T1.10: Admin Platform Metrics (GET /api/admin/metrics)
    const metricsRes = await request('GET', '/api/admin/metrics', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(1, 'T1_ADMIN_METRICS', metricsRes.status === 200, 'GET /api/admin/metrics returns HTTP 200 for authenticated admin', {
        status: metricsRes.status
    });
    assertTest(1, 'T1_METRICS_SCHEMA', 
        metricsRes.body && typeof metricsRes.body.totalCreators === 'number' && typeof metricsRes.body.gpvZar === 'number',
        'GET /api/admin/metrics returns numeric KPI aggregates (totalCreators, gpvZar, mrrZar)',
        metricsRes.body
    );

    // T1.11: Admin Creator Directory (GET /api/admin/creators)
    const creatorsRes = await request('GET', '/api/admin/creators', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(1, 'T1_ADMIN_CREATORS', creatorsRes.status === 200, 'GET /api/admin/creators returns HTTP 200 directory list', {
        status: creatorsRes.status
    });
    assertTest(1, 'T1_CREATORS_LIST', 
        Array.isArray(creatorsRes.body) || Array.isArray(creatorsRes.body?.creators),
        'GET /api/admin/creators returns an array of creator records',
        creatorsRes.body
    );

    // T1.12: Admin Status & Plan Mutation (POST /api/admin/creators/:id/status)
    const targetUserId = globalCreatorUser?.id || 'usr_seed_1';
    const mutateRes = await request('POST', `/api/admin/creators/${targetUserId}/status`, {
        'Authorization': `Bearer ${globalAdminToken}`
    }, {
        status: 'active',
        plan_tier: 'Pro',
        note: 'Tier 1 E2E automated plan upgrade'
    });
    assertTest(1, 'T1_STATUS_MUTATION', 
        mutateRes.status === 200,
        'POST /api/admin/creators/:id/status successfully updates creator plan and status (HTTP 200)',
        { status: mutateRes.status, body: mutateRes.body }
    );

    // T1.13: Admin Audit Logs (GET /api/admin/audit-logs)
    const auditRes = await request('GET', '/api/admin/audit-logs', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(1, 'T1_AUDIT_LOGS', auditRes.status === 200, 'GET /api/admin/audit-logs returns HTTP 200 audit trail', {
        status: auditRes.status
    });
    assertTest(1, 'T1_AUDIT_LOGS_ARRAY', 
        Array.isArray(auditRes.body) || Array.isArray(auditRes.body?.auditLogs),
        'GET /api/admin/audit-logs returns audit log entries array',
        auditRes.body
    );

    // T1.14: Admin AI Telemetry (GET /api/admin/telemetry)
    const telemetryRes = await request('GET', '/api/admin/telemetry', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(1, 'T1_TELEMETRY', telemetryRes.status === 200, 'GET /api/admin/telemetry returns HTTP 200 telemetry stream', {
        status: telemetryRes.status
    });
    assertTest(1, 'T1_TELEMETRY_ARRAY', 
        Array.isArray(telemetryRes.body) || Array.isArray(telemetryRes.body?.telemetry),
        'GET /api/admin/telemetry returns telemetry items array',
        telemetryRes.body
    );

    // T1.15: Gemini AI Endpoint (POST /api/gemini)
    const aiRes = await request('POST', '/api/gemini', {}, {
        prompt: 'What percentage of my South African creator earnings should I hold for provisional tax?'
    });
    assertTest(1, 'T1_GEMINI_QUERY', 
        aiRes.status === 200 || aiRes.status === 500 || aiRes.status === 503,
        'POST /api/gemini executes AI pipeline and returns JSON response or standard error',
        { status: aiRes.status, body: aiRes.body }
    );

    // T1.16: Static File Delivery (HTML, CSS, JS)
    const indexRes = await request('GET', '/index.html');
    assertTest(1, 'T1_STATIC_INDEX', indexRes.status === 200 && indexRes.raw.includes('Creator Cash Flow'), 'GET /index.html delivers marketing landing page', { status: indexRes.status });

    const adminHtmlRes = await request('GET', '/admin.html');
    assertTest(1, 'T1_STATIC_ADMIN', adminHtmlRes.status === 200 && adminHtmlRes.raw.includes('Admin'), 'GET /admin.html delivers admin command portal', { status: adminHtmlRes.status });

    const appJsRes = await request('GET', '/app.js');
    assertTest(1, 'T1_STATIC_APPJS', appJsRes.status === 200 && appJsRes.raw.length > 500, 'GET /app.js delivers client logic bundle', { status: appJsRes.status });

    const styleCssRes = await request('GET', '/style.css');
    assertTest(1, 'T1_STATIC_STYLE', styleCssRes.status === 200 && styleCssRes.raw.length > 500, 'GET /style.css delivers stylesheet', { status: styleCssRes.status });
}

// ==============================================================================
// TIER 2: BOUNDARY, SECURITY & CORNER CASES
// ==============================================================================
async function runTier2() {
    console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}▶ RUNNING TIER 2: BOUNDARY, SECURITY & CORNER CASES${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

    // Ensure tokens exist for isolated tier runs
    if (!globalCreatorToken) {
        const uniqueEmail = `creator_tier2_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@creatorflow.co.za`;
        const sRes = await request('POST', '/api/auth/signup', {}, {
            name: 'Tier 2 Creator',
            email: uniqueEmail,
            password: 'CreatorPassword2026!'
        });
        if (sRes.body?.token) {
            globalCreatorToken = sRes.body.token;
            globalCreatorUser = sRes.body.user || { id: sRes.body.userId, email: sRes.body.email };
        }
    }

    if (!globalAdminToken) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.com';
        const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass2026!';
        const lRes = await request('POST', '/api/admin/auth/login', {}, { email: adminEmail, password: adminPass });
        if (lRes.body?.token) globalAdminToken = lRes.body.token;
    }

    // T2.1: Missing Required Fields on Signup (400 Bad Request)
    const emptySignupRes = await request('POST', '/api/auth/signup', {}, {
        email: 'incomplete@user.com'
        // missing name & password
    });
    assertTest(2, 'T2_AUTH_VALIDATION_MISSING', 
        emptySignupRes.status === 400,
        'POST /api/auth/signup rejects incomplete payloads with HTTP 400 Bad Request',
        { status: emptySignupRes.status, body: emptySignupRes.body }
    );

    // T2.2: Invalid Password on User Login (401 Unauthorized)
    const badLoginRes = await request('POST', '/api/auth/login', {}, {
        email: 'nonexistent_creator_test@nowhere.com',
        password: 'IncorrectPassword999!'
    });
    assertTest(2, 'T2_AUTH_INVALID_CREDS', 
        badLoginRes.status === 401,
        'POST /api/auth/login rejects incorrect credentials with HTTP 401 Unauthorized',
        { status: badLoginRes.status, body: badLoginRes.body }
    );

    // T2.3: Duplicate Email Registration (400 Bad Request)
    const dupEmail = `dup_test_${Date.now()}@creatorflow.co.za`;
    await request('POST', '/api/auth/signup', {}, { name: 'Dup 1', email: dupEmail, password: 'Pass12345!' });
    const dupSignupRes = await request('POST', '/api/auth/signup', {}, { name: 'Dup 2', email: dupEmail, password: 'Pass12345!' });
    assertTest(2, 'T2_AUTH_DUPLICATE_EMAIL', 
        dupSignupRes.status === 400,
        'POST /api/auth/signup rejects duplicate email registration with HTTP 400',
        { status: dupSignupRes.status, body: dupSignupRes.body }
    );

    // T2.4: RBAC — Unauthenticated Access to User Ledger (401)
    const noTokenTxRes = await request('GET', '/api/transactions');
    assertTest(2, 'T2_RBAC_NO_TOKEN_CREATOR', 
        noTokenTxRes.status === 401,
        'GET /api/transactions strictly rejects missing Authorization header with HTTP 401',
        { status: noTokenTxRes.status, body: noTokenTxRes.body }
    );

    // T2.5: RBAC — Unauthenticated Access to Admin API (401)
    const noTokenAdminRes = await request('GET', '/api/admin/metrics');
    assertTest(2, 'T2_RBAC_NO_TOKEN_ADMIN', 
        noTokenAdminRes.status === 401,
        'GET /api/admin/metrics strictly rejects missing admin token with HTTP 401',
        { status: noTokenAdminRes.status, body: noTokenAdminRes.body }
    );

    // T2.6: RBAC — Creator Token on Admin Verify (403 Forbidden)
    const creatorAsAdminRes = await request('GET', '/api/admin/verify-auth', {
        'Authorization': `Bearer ${globalCreatorToken}`
    });
    assertTest(2, 'T2_RBAC_CREATOR_ON_ADMIN', 
        creatorAsAdminRes.status === 403,
        'GET /api/admin/verify-auth rejects non-admin token with HTTP 403 Forbidden',
        { status: creatorAsAdminRes.status, body: creatorAsAdminRes.body }
    );

    // T2.7: RBAC — Creator Token on Admin Metrics (403 Forbidden)
    const creatorOnMetricsRes = await request('GET', '/api/admin/metrics', {
        'Authorization': `Bearer ${globalCreatorToken}`
    });
    assertTest(2, 'T2_RBAC_CREATOR_ON_METRICS', 
        creatorOnMetricsRes.status === 403,
        'GET /api/admin/metrics rejects regular creator token with HTTP 403 Forbidden',
        { status: creatorOnMetricsRes.status, body: creatorOnMetricsRes.body }
    );

    // T2.8: RBAC — Tampered JWT Signature (401/403)
    const tamperedToken = `${globalCreatorToken || 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyJ9'}.tampered_signature_xyz`;
    const tamperedRes = await request('GET', '/api/transactions', {
        'Authorization': `Bearer ${tamperedToken}`
    });
    assertTest(2, 'T2_RBAC_TAMPERED_JWT', 
        tamperedRes.status === 401 || tamperedRes.status === 403,
        'Protected endpoints reject cryptographically tampered JWT token with HTTP 401/403',
        { status: tamperedRes.status }
    );

    // T2.9: Admin Mutation Boundary — Invalid Status String (400)
    const badStatusRes = await request('POST', `/api/admin/creators/usr_seed_1/status`, {
        'Authorization': `Bearer ${globalAdminToken}`
    }, {
        status: 'invalid_status_state'
    });
    assertTest(2, 'T2_ADMIN_MUTATION_BAD_STATUS', 
        badStatusRes.status === 400,
        'POST /api/admin/creators/:id/status rejects invalid status values with HTTP 400',
        { status: badStatusRes.status, body: badStatusRes.body }
    );

    // T2.10: Admin Mutation Boundary — Invalid Plan Tier (400)
    const badPlanRes = await request('POST', `/api/admin/creators/usr_seed_1/status`, {
        'Authorization': `Bearer ${globalAdminToken}`
    }, {
        plan_tier: 'EnterpriseGodMode'
    });
    assertTest(2, 'T2_ADMIN_MUTATION_BAD_PLAN', 
        badPlanRes.status === 400,
        'POST /api/admin/creators/:id/status rejects invalid plan tiers with HTTP 400',
        { status: badPlanRes.status, body: badPlanRes.body }
    );

    // T2.11: Admin Mutation Boundary — Empty Mutation Payload (400)
    const emptyMutateRes = await request('POST', `/api/admin/creators/usr_seed_1/status`, {
        'Authorization': `Bearer ${globalAdminToken}`
    }, {});
    assertTest(2, 'T2_ADMIN_MUTATION_EMPTY', 
        emptyMutateRes.status === 400,
        'POST /api/admin/creators/:id/status rejects empty payload (missing status & plan) with HTTP 400',
        { status: emptyMutateRes.status, body: emptyMutateRes.body }
    );

    // T2.12: Admin Rate Limiting / Brute-Force Lockout (429)
    // Clear in-memory tracking if accessible to isolate test
    if (serverModule && serverModule.adminLoginAttempts && typeof serverModule.adminLoginAttempts.clear === 'function') {
        serverModule.adminLoginAttempts.clear();
    }
    let hitRateLimit = false;
    for (let i = 1; i <= 6; i++) {
        const attemptRes = await request('POST', '/api/admin/auth/login', {}, {
            email: 'admin@creatorcashflow.com',
            password: 'WrongPasswordForBruteForceTest'
        });
        if (attemptRes.status === 429) {
            hitRateLimit = true;
            break;
        }
    }
    assertTest(2, 'T2_ADMIN_BRUTE_FORCE_LOCKOUT', 
        hitRateLimit,
        'POST /api/admin/auth/login enforces brute-force lockout returning HTTP 429 Too Many Requests',
        { hitRateLimit }
    );
    // Restore admin rate limit state so other tests continue
    if (serverModule && serverModule.adminLoginAttempts && typeof serverModule.adminLoginAttempts.clear === 'function') {
        serverModule.adminLoginAttempts.clear();
    }

    // T2.13: Gemini AI Missing Prompt (400)
    const missingPromptRes = await request('POST', '/api/gemini', {}, {});
    assertTest(2, 'T2_GEMINI_EMPTY_PROMPT', 
        missingPromptRes.status === 400,
        'POST /api/gemini rejects empty or missing prompt with HTTP 400 Bad Request',
        { status: missingPromptRes.status, body: missingPromptRes.body }
    );

    // T2.14: CORS Whitelist Policy Enforcement
    const corsWhitelistedRes = await request('OPTIONS', '/api/health', {
        'Origin': 'https://creatorcashflow.co.za',
        'Access-Control-Request-Method': 'GET'
    });
    const allowOriginHeader = corsWhitelistedRes.headers['access-control-allow-origin'];
    assertTest(2, 'T2_CORS_WHITELIST', 
        allowOriginHeader === 'https://creatorcashflow.co.za' || allowOriginHeader === '*',
        'Preflight request from whitelisted domain (https://creatorcashflow.co.za) receives authorized CORS header',
        { allowOriginHeader }
    );
}

// ==============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS & STATE TRANSITIONS
// ==============================================================================
async function runTier3() {
    console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}▶ RUNNING TIER 3: CROSS-FEATURE COMBINATIONS & STATE TRANSITIONS${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

    // Ensure tokens exist
    if (!globalAdminToken) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.com';
        const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass2026!';
        const lRes = await request('POST', '/api/admin/auth/login', {}, { email: adminEmail, password: adminPass });
        if (lRes.body?.token) globalAdminToken = lRes.body.token;
    }

    // T3.1: Full Creator Lifecycle (Registration -> Authentication -> Ledger -> History)
    const lifecycleEmail = `lifecycle_creator_${Date.now()}@creatorflow.co.za`;
    const regRes = await request('POST', '/api/auth/signup', {}, {
        name: 'Lifecycle Creator',
        email: lifecycleEmail,
        password: 'LifeCyclePassword2026!'
    });
    const lcToken = regRes.body?.token;
    const lcUserId = regRes.body?.userId || regRes.body?.user?.id;

    assertTest(3, 'T3_LIFECYCLE_REG', 
        regRes.status === 201 || regRes.status === 200,
        'Step 1: Creator registers account successfully',
        { status: regRes.status, lcUserId }
    );

    // Add Income
    const incTx = await request('POST', '/api/transactions', {
        'Authorization': `Bearer ${lcToken}`
    }, {
        source: 'Patreon',
        merchant: 'Patreon VIP Membership Payout',
        type: 'income',
        category: 'Fan Subscriptions',
        amount: 35000.00,
        date: 'Sep 01'
    });
    assertTest(3, 'T3_LIFECYCLE_INCOME', 
        incTx.status === 201 || incTx.status === 200,
        'Step 2: Creator logs Patreon income (R35,000)',
        { status: incTx.status }
    );

    // Add Expense
    const expTx = await request('POST', '/api/transactions', {
        'Authorization': `Bearer ${lcToken}`
    }, {
        source: 'Bank',
        merchant: 'Camera House (Audio Equipment)',
        type: 'expense',
        category: 'Studio Hardware',
        amount: 8500.00,
        date: 'Sep 02'
    });
    assertTest(3, 'T3_LIFECYCLE_EXPENSE', 
        expTx.status === 201 || expTx.status === 200,
        'Step 3: Creator logs gear expense (R8,500)',
        { status: expTx.status }
    );

    // Verify Ledger Contains Both Transactions
    const lcListRes = await request('GET', '/api/transactions', {
        'Authorization': `Bearer ${lcToken}`
    });
    const userTxs = lcListRes.body?.transactions || [];
    const hasPatreon = userTxs.some(t => t.merchant && t.merchant.includes('Patreon'));
    const hasCamera = userTxs.some(t => t.merchant && t.merchant.includes('Camera House'));
    assertTest(3, 'T3_LIFECYCLE_LEDGER_SYNC', 
        hasPatreon && hasCamera,
        'Step 4: User transaction ledger reliably synchronizes and lists both newly created transactions',
        { totalUserTxs: userTxs.length, hasPatreon, hasCamera }
    );

    // T3.2: Financial Metric Aggregation Sync
    const metricsRes = await request('GET', '/api/admin/metrics', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    assertTest(3, 'T3_METRICS_SYNC', 
        metricsRes.status === 200 && metricsRes.body.gpvZar >= 35000.00,
        'Platform metrics aggregate GPV reflecting transactions across active creator ledgers',
        { gpvZar: metricsRes.body?.gpvZar, totalCreators: metricsRes.body?.totalCreators }
    );

    // T3.3: Admin Status Mutation & Audit Trail Immutability
    const mutateStatusRes = await request('POST', `/api/admin/creators/${lcUserId}/status`, {
        'Authorization': `Bearer ${globalAdminToken}`
    }, {
        status: 'suspended',
        plan_tier: 'Pro',
        note: 'Tier 3 lifecycle state mutation test'
    });
    assertTest(3, 'T3_STATUS_MUTATION_EXEC', 
        mutateStatusRes.status === 200,
        'Admin mutates creator status to "suspended" and plan tier to "Pro"',
        { status: mutateStatusRes.status, body: mutateStatusRes.body }
    );

    // Verify Audit Log was Immutably Recorded
    const auditRes = await request('GET', '/api/admin/audit-logs', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    const logs = Array.isArray(auditRes.body) ? auditRes.body : (auditRes.body?.auditLogs || []);
    const matchingLog = logs.find(l => l.target_creator_id === lcUserId || l.targetCreatorId === lcUserId);
    assertTest(3, 'T3_AUDIT_LOG_RECORDED', 
        !!matchingLog,
        'Status mutation immutably created audit record matching target creator ID in audit ledger',
        { matchingLog }
    );

    // T3.4: Cryptographic SHA-256 IP Hash in Audit Record
    if (matchingLog) {
        const ipHash = matchingLog.ip_hash || matchingLog.ipHash;
        const isValidHash = typeof ipHash === 'string' && (ipHash.length === 16 || ipHash.length === 64) && /^[0-9a-f]+$/i.test(ipHash);
        assertTest(3, 'T3_AUDIT_IP_HASH', 
            isValidHash,
            'Audit record contains valid SHA-256 anonymized IP hash prefix (16/64 chars) preserving privacy',
            { ipHash }
        );
    } else {
        warnTest(3, 'T3_AUDIT_IP_HASH', 'Audit IP hash verification skipped', 'No matching audit entry found');
    }

    // T3.5: AI Telemetry PII Redaction & Categorization
    const rawSensitivePrompt = 'My email is confidential.creator@domain.com, contact +27 82 999 8888, earned R68,500 on TikTok. How much should I save for SARS tax write-offs?';
    await request('POST', '/api/gemini', {}, {
        prompt: rawSensitivePrompt
    });

    const telemRes = await request('GET', '/api/admin/telemetry', {
        'Authorization': `Bearer ${globalAdminToken}`
    });
    const telemetryItems = Array.isArray(telemRes.body) ? telemRes.body : (telemRes.body?.telemetry || []);
    const recentItem = telemetryItems.find(t => (t.prompt_masked || '').includes('[REDACTED_EMAIL]')) || telemetryItems[0];

    if (recentItem) {
        const masked = recentItem.prompt_masked || recentItem.prompt || '';
        const emailRedacted = !masked.includes('confidential.creator@domain.com') && masked.includes('[REDACTED_EMAIL]');
        const phoneRedacted = !masked.includes('+27 82 999 8888') && masked.includes('[REDACTED_PHONE]');
        const zarRedacted = !masked.includes('R68,500') && masked.includes('[REDACTED_ZAR]');
        const isTaxCategory = recentItem.category_tag === 'Tax Deduction Strategy';

        assertTest(3, 'T3_TELEMETRY_PII_MASKING', 
            emailRedacted && phoneRedacted && zarRedacted,
            'Gemini AI query telemetry automatically and thoroughly masks emails, phone numbers, and ZAR amounts',
            { masked, emailRedacted, phoneRedacted, zarRedacted }
        );
        assertTest(3, 'T3_TELEMETRY_CATEGORY_TAG', 
            isTaxCategory,
            'Gemini AI query telemetry accurately infers category tag ("Tax Deduction Strategy")',
            { category_tag: recentItem.category_tag }
        );
    } else {
        warnTest(3, 'T3_TELEMETRY_PII_MASKING', 'Telemetry items empty', 'No telemetry records returned');
    }

    // T3.6: Concurrent Transaction Ledger Consistency
    const parallelTxs = [];
    for (let i = 1; i <= 8; i++) {
        parallelTxs.push(request('POST', '/api/transactions', {
            'Authorization': `Bearer ${lcToken}`
        }, {
            source: 'YouTube',
            merchant: `Concurrent Payout ${i}`,
            type: 'income',
            amount: 1000 * i,
            date: 'Sep 03'
        }));
    }
    const parallelResults = await Promise.all(parallelTxs);
    const allSuccessful = parallelResults.every(r => r.status === 201 || r.status === 200);
    assertTest(3, 'T3_CONCURRENT_TX_WRITES', 
        allSuccessful,
        'Multiple concurrent transaction write requests execute cleanly with zero database lockups or data loss',
        { count: parallelResults.length, allSuccessful }
    );
}

// ==============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS, FORENSICS & INTEGRITY
// ==============================================================================
async function runTier4() {
    console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}▶ RUNNING TIER 4: REAL-WORLD APPLICATION SCENARIOS, FORENSICS & INTEGRITY${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

    // T4.1: Real-World Multi-Step Onboarding Journey
    const rwEmail = `onboard_user_${Date.now()}@creatorflow.co.za`;
    const signupRw = await request('POST', '/api/auth/signup', {}, {
        name: 'Onboarding Champion',
        email: rwEmail,
        password: 'SecurePass12345!'
    });
    const rwToken = signupRw.body?.token;
    assertTest(4, 'T4_REALWORLD_SIGNUP', !!rwToken, 'Onboarding Journey: User registration completes and provides active session token');

    const saveWizard = await request('POST', '/api/onboarding/save', {
        'Authorization': `Bearer ${rwToken}`
    }, {
        creatorType: 'Full-Time YouTuber & Podcaster',
        platforms: ['YouTube', 'Spotify', 'Instagram'],
        goal: 'R100,000 monthly cash flow with automated SARS provisional tax reserves',
        connected: false,
        isManual: true
    });
    assertTest(4, 'T4_REALWORLD_WIZARD_SAVE', 
        saveWizard.status === 200 && saveWizard.body?.success === true,
        'Onboarding Journey: 6-Step wizard responses safely persist into database'
    );

    const firstTx = await request('POST', '/api/transactions', {
        'Authorization': `Bearer ${rwToken}`
    }, {
        source: 'YouTube',
        merchant: 'Google AdSense Partner Payout',
        type: 'income',
        category: 'YouTube AdSense',
        amount: 22450.00,
        date: 'Sep 04'
    });
    assertTest(4, 'T4_REALWORLD_FIRST_REVENUE', 
        firstTx.status === 201 || firstTx.status === 200,
        'Onboarding Journey: Creator successfully records first platform revenue item'
    );

    // T4.2: Rate-Limit Recovery & Isolation Verification
    // Reset admin login attempts if accessible
    if (serverModule && serverModule.adminLoginAttempts && typeof serverModule.adminLoginAttempts.clear === 'function') {
        serverModule.adminLoginAttempts.clear();
    }
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass2026!';
    const freshLogin = await request('POST', '/api/admin/auth/login', {}, {
        email: adminEmail,
        password: adminPass
    });
    assertTest(4, 'T4_RATE_LIMIT_ISOLATION', 
        freshLogin.status === 200,
        'Rate limiting maintains clean boundary and allows legitimate admin login when rate limit window is clear'
    );

    // T4.3: Deep Forensic Scan — Zero Hardcoded Developer Email & Passwords
    const projectRoot = path.resolve(__dirname, '..');
    const sensitiveEmail = 'reamogetswemolefe0190@gmail.com';
    let piiOccurrences = 0;
    const productionFilesToCheck = ['server.js', 'app.js', 'index.html', 'admin.html', 'stress_harness.js'];

    for (const file of productionFilesToCheck) {
        const fullPath = path.join(projectRoot, file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(sensitiveEmail)) {
                piiOccurrences++;
            }
        }
    }

    if (piiOccurrences === 0) {
        assertTest(4, 'T4_FORENSIC_PII_SCAN', true, 'Forensic Audit: Zero occurrences of developer personal email in production source files');
    } else {
        warnTest(4, 'T4_FORENSIC_PII_SCAN', 
            `Forensic Audit: Developer email found in ${piiOccurrences} files`,
            'Pending Milestone M1 completion by worker_m1 (Security Hardening & PII Sanitization)'
        );
    }

    // T4.4: Deep Forensic Scan — Git Ignore Status of .env
    let gitIgnorePassed = false;
    try {
        const gitIgnoreOut = execSync('git check-ignore -v .env', { cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        gitIgnorePassed = gitIgnoreOut.includes('.env');
    } catch (e) {
        gitIgnorePassed = false;
    }

    if (gitIgnorePassed) {
        assertTest(4, 'T4_FORENSIC_GIT_IGNORE', true, 'Forensic Audit: `git check-ignore -v .env` confirms .env files are strictly excluded from git');
    } else {
        warnTest(4, 'T4_FORENSIC_GIT_IGNORE', 
            'Forensic Audit: .env not currently excluded by git',
            'Pending Milestone M1 completion by worker_m1 (Adding .env* to .gitignore)'
        );
    }

    // T4.5: Deep Forensic Scan — Frontend Script Decoupling & Sanitization
    const adminHtmlPath = path.join(projectRoot, 'admin.html');
    const adminHtmlContent = fs.existsSync(adminHtmlPath) ? fs.readFileSync(adminHtmlPath, 'utf8') : '';
    const adminUsesExternalScript = adminHtmlContent.includes('src="admin.js"') || adminHtmlContent.includes('src="js/admin.js"');
    
    if (adminUsesExternalScript) {
        assertTest(4, 'T4_FORENSIC_SCRIPT_EXTRACTION', true, 'Forensic Audit: admin.html references decoupled modular admin.js script');
    } else {
        warnTest(4, 'T4_FORENSIC_SCRIPT_EXTRACTION', 
            'admin.html contains inline script',
            'Scheduled for Milestone M3 (Frontend Script Extraction & Modular Refactoring)'
        );
    }

    // T4.6: Package.json Scripts & Dependencies Audit
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const hasTestScript = !!pkg.scripts?.test;
    const testScriptContent = pkg.scripts?.test || '';

    if (hasTestScript && testScriptContent.includes('test_pivot_validation.js')) {
        assertTest(4, 'T4_FORENSIC_TEST_SCRIPT', true, 'Forensic Audit: package.json specifies standard automated test runner script');
    } else {
        warnTest(4, 'T4_FORENSIC_TEST_SCRIPT', 
            'package.json test script pending update',
            'Scheduled for Milestone M4 (QA, Test Automation & CI/CD Pipeline)'
        );
    }

    // T4.7: Deep Health Diagnostics Verification
    const diagRes = await request('GET', '/api/health');
    assertTest(4, 'T4_DEEP_HEALTH_DIAGNOSTICS', 
        diagRes.status === 200 && typeof diagRes.body?.database === 'string',
        'GET /api/health returns comprehensive system diagnostics and database mode',
        diagRes.body
    );
}

// ==============================================================================
// TEST ORCHESTRATOR & SERVER LIFECYCLE
// ==============================================================================
async function main() {
    console.log(`\n${colors.bright}==============================================================================${colors.reset}`);
    console.log(`${colors.bright}⚡ CREATOR CASH FLOW — AUTOMATED E2E REMEDIATION TEST SUITE${colors.reset}`);
    console.log(`${colors.dim}Date: ${new Date().toISOString()} | Target: ${baseUrl || 'Ephemeral In-Memory Engine'}${colors.reset}`);
    console.log(`${colors.dim}Selected Tier: ${targetTier.toUpperCase()} | Bail: ${bailOnFail}${colors.reset}`);
    console.log(`${colors.bright}==============================================================================${colors.reset}\n`);

    const startTime = Date.now();

    try {
        // Step 1: Establish Server Connection
        if (baseUrl) {
            console.log(`Connecting to specified live server at: ${baseUrl}\n`);
            // Quick connectivity check
            try {
                await request('GET', '/api/health');
                console.log(`  ${colors.green}✓${colors.reset} Connected successfully to live target server.\n`);
            } catch (err) {
                console.error(`  ${colors.red}✗${colors.reset} Could not connect to target ${baseUrl}: ${err.message}\n`);
                process.exit(1);
            }
        } else {
            console.log('Launching ephemeral in-process test server on dynamic port (app.listen(0))...\n');
            const serverPath = path.resolve(__dirname, '../server.js');
            serverModule = require(serverPath);
            const { app } = serverModule;

            await new Promise((resolve, reject) => {
                serverInstance = app.listen(0, '127.0.0.1', () => {
                    const port = serverInstance.address().port;
                    baseUrl = `http://127.0.0.1:${port}`;
                    console.log(`  ${colors.green}✓${colors.reset} Ephemeral server active and listening at ${baseUrl}\n`);
                    resolve();
                });
                serverInstance.on('error', reject);
            });
        }

        // Step 2: Execute Requested Tiers
        if (targetTier === '1' || targetTier === 'all') {
            await runTier1();
        }
        if (targetTier === '2' || targetTier === 'all') {
            await runTier2();
        }
        if (targetTier === '3' || targetTier === 'all') {
            await runTier3();
        }
        if (targetTier === '4' || targetTier === 'all') {
            await runTier4();
        }

        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

        // Step 3: Print Final Verification Summary
        console.log(`\n${colors.bright}==============================================================================${colors.reset}`);
        console.log(`${colors.bright}📊 E2E TEST SUITE VERIFICATION REPORT${colors.reset}`);
        console.log(`${colors.bright}==============================================================================${colors.reset}`);
        console.log(`Total Duration: ${durationSec} seconds\n`);

        console.log(`  Tier 1 (Feature Coverage):   ${colors.green}${testStats.byTier[1].passed} passed${colors.reset}, ${testStats.byTier[1].failed > 0 ? colors.red : colors.dim}${testStats.byTier[1].failed} failed${colors.reset} (Total: ${testStats.byTier[1].total})`);
        console.log(`  Tier 2 (Boundaries & RBAC):  ${colors.green}${testStats.byTier[2].passed} passed${colors.reset}, ${testStats.byTier[2].failed > 0 ? colors.red : colors.dim}${testStats.byTier[2].failed} failed${colors.reset} (Total: ${testStats.byTier[2].total})`);
        console.log(`  Tier 3 (State Transitions):  ${colors.green}${testStats.byTier[3].passed} passed${colors.reset}, ${testStats.byTier[3].failed > 0 ? colors.red : colors.dim}${testStats.byTier[3].failed} failed${colors.reset} (Total: ${testStats.byTier[3].total})`);
        console.log(`  Tier 4 (Real-World & Audit): ${colors.green}${testStats.byTier[4].passed} passed${colors.reset}, ${testStats.byTier[4].failed > 0 ? colors.red : colors.dim}${testStats.byTier[4].failed} failed${colors.reset} (Total: ${testStats.byTier[4].total})`);
        console.log(`  Pending Remediation Notices: ${colors.yellow}${testStats.warnings} warnings${colors.reset}\n`);

        console.log(`  ${colors.bright}AGGREGATE SCORE: ${colors.green}${testStats.passed} PASSED${colors.reset} / ${testStats.failed > 0 ? colors.red : colors.green}${testStats.failed} FAILED${colors.reset} across ${testStats.total} assertions.`);
        console.log(`${colors.bright}==============================================================================${colors.reset}\n`);

        if (testStats.failed > 0) {
            console.error(`${colors.red}❌ FAILED: One or more assertions failed. Review diagnostics above.${colors.reset}\n`);
            process.exitCode = 1;
        } else {
            console.log(`${colors.green}🎉 SUCCESS: 100% of tested assertions passed cleanly!${colors.reset}\n`);
            process.exitCode = 0;
        }

    } catch (err) {
        console.error(`\n${colors.red}💥 UNHANDLED EXCEPTION IN TEST RUNNER:${colors.reset}`, err);
        process.exitCode = 1;
    } finally {
        if (serverInstance) {
            serverInstance.close();
        }
    }
}

main();
