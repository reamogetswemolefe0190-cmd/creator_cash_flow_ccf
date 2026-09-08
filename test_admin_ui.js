/* ==========================================================================
   Creator Cash Flow - Admin Command Portal (`admin.html`) Automated Verification Suite
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');

async function runVerification() {
    console.log('🚀 Starting Creator Cash Flow Admin Portal (admin.html) Verification...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // TEST 1: File Existence & Basic Structure
    // -------------------------------------------------------------------------
    console.log('1. Checking file existence & HTML5 boilerplate...');
    const adminPath = path.join(__dirname, 'admin.html');
    assert(fs.existsSync(adminPath), 'admin.html exists in project root');

    const htmlContent = fs.readFileSync(adminPath, 'utf8');

    assert(htmlContent.includes('<!DOCTYPE html>'), 'Valid HTML5 doctype declaration');
    assert(htmlContent.includes('https://cdn.tailwindcss.com'), 'Tailwind CSS CDN script included');
    assert(htmlContent.includes('https://cdn.jsdelivr.net/npm/chart.js'), 'Chart.js CDN script included');
    assert(htmlContent.includes('https://unpkg.com/lucide@latest'), 'Lucide Icons script included');
    assert(htmlContent.includes('style.css'), 'style.css linked');

    // -------------------------------------------------------------------------
    // TEST 2: Mandatory DOM Element IDs (M4, M5, M6)
    // -------------------------------------------------------------------------
    console.log('\n2. Verifying mandatory DOM element IDs...');
    
    // Auth & Gate
    assert(htmlContent.includes('id="admin-login-modal"'), 'Modal #admin-login-modal present');
    assert(htmlContent.includes('id="admin-login-form"'), 'Form #admin-login-form present');
    assert(htmlContent.includes('id="admin-email"'), 'Input #admin-email present');
    assert(htmlContent.includes('id="admin-password"'), 'Input #admin-password present');
    assert(htmlContent.includes('id="login-submit-btn"'), 'Button #login-submit-btn present');
    assert(htmlContent.includes('id="demo-login-btn"'), 'Button #demo-login-btn present');
    assert(htmlContent.includes('id="login-error-msg"'), 'Banner #login-error-msg present');

    // Dashboard & Header
    assert(htmlContent.includes('id="admin-dashboard"'), 'Container #admin-dashboard present');
    assert(htmlContent.includes('id="admin-status-badge"'), 'Badge #admin-status-badge present');
    assert(htmlContent.includes('id="admin-logout-btn"'), 'Button #admin-logout-btn present');

    // Tab Navigation & Views
    assert(htmlContent.includes('id="tab-btn-overview"'), 'Tab #tab-btn-overview present');
    assert(htmlContent.includes('id="tab-btn-creators"'), 'Tab #tab-btn-creators present');
    assert(htmlContent.includes('id="tab-btn-audit"'), 'Tab #tab-btn-audit present');
    assert(htmlContent.includes('id="tab-btn-telemetry"'), 'Tab #tab-btn-telemetry present');

    assert(htmlContent.includes('id="view-overview"'), 'View #view-overview present');
    assert(htmlContent.includes('id="view-creators"'), 'View #view-creators present');
    assert(htmlContent.includes('id="view-audit"'), 'View #view-audit present');
    assert(htmlContent.includes('id="view-telemetry"'), 'View #view-telemetry present');

    // Scorecards & Charts (M4)
    assert(htmlContent.includes('id="metric-total-creators"'), 'Metric #metric-total-creators present');
    assert(htmlContent.includes('id="metric-gpv"'), 'Metric #metric-gpv present');
    assert(htmlContent.includes('id="metric-mrr"'), 'Metric #metric-mrr present');
    assert(htmlContent.includes('id="metric-tax-reserves"'), 'Metric #metric-tax-reserves present');
    assert(htmlContent.includes('id="growthTimelineChart"'), 'Canvas #growthTimelineChart present');
    assert(htmlContent.includes('id="channelBreakdownChart"'), 'Canvas #channelBreakdownChart present');

    // Creator Directory Operations Table (M5)
    assert(htmlContent.includes('id="creator-search-input"'), 'Input #creator-search-input present');
    assert(htmlContent.includes('id="filter-plan-all"'), 'Filter button #filter-plan-all present');
    assert(htmlContent.includes('id="filter-plan-pro"'), 'Filter button #filter-plan-pro present');
    assert(htmlContent.includes('id="filter-plan-free"'), 'Filter button #filter-plan-free present');
    assert(htmlContent.includes('id="creator-sort-select"'), 'Select #creator-sort-select present');
    assert(htmlContent.includes('id="creator-table-body"'), 'Tbody #creator-table-body present');

    // Detail Inspection & Status Mutation Modal (M5)
    assert(htmlContent.includes('id="creator-detail-modal"'), 'Modal #creator-detail-modal present');
    assert(htmlContent.includes('id="modal-creator-name"'), 'Element #modal-creator-name present');
    assert(htmlContent.includes('id="modal-creator-email"'), 'Element #modal-creator-email present');
    assert(htmlContent.includes('id="modal-creator-id"'), 'Element #modal-creator-id present');
    assert(htmlContent.includes('id="modal-plan-toggle-pro"'), 'Button #modal-plan-toggle-pro present');
    assert(htmlContent.includes('id="modal-plan-toggle-free"'), 'Button #modal-plan-toggle-free present');
    assert(htmlContent.includes('id="modal-status-toggle-active"'), 'Button #modal-status-toggle-active present');
    assert(htmlContent.includes('id="modal-status-toggle-suspended"'), 'Button #modal-status-toggle-suspended present');
    assert(htmlContent.includes('id="modal-admin-note"'), 'Textarea #modal-admin-note present');
    assert(htmlContent.includes('id="submit-mutation-btn"'), 'Button #submit-mutation-btn present');

    // Audit Trail & Telemetry Views (M6)
    assert(htmlContent.includes('id="audit-log-container"'), 'Container #audit-log-container present');
    assert(htmlContent.includes('id="audit-action-filter"'), 'Select #audit-action-filter present');

    assert(htmlContent.includes('id="telemetry-total-queries"'), 'Metric #telemetry-total-queries present');
    assert(htmlContent.includes('id="telemetry-total-tokens"'), 'Metric #telemetry-total-tokens present');
    assert(htmlContent.includes('id="telemetry-avg-latency"'), 'Metric #telemetry-avg-latency present');
    assert(htmlContent.includes('id="telemetry-ttl-indicator"'), 'Indicator #telemetry-ttl-indicator present');
    assert(htmlContent.includes('id="telemetry-feed"'), 'Container #telemetry-feed present');

    // -------------------------------------------------------------------------
    // TEST 3: API Integration Logic & Local Storage Keys
    // -------------------------------------------------------------------------
    console.log('\n3. Verifying API route integrations & storage keys in JS controller...');
    assert(htmlContent.includes('/api/admin/auth/login'), 'Integrates POST /api/admin/auth/login');
    assert(htmlContent.includes('/api/admin/metrics'), 'Integrates GET /api/admin/metrics');
    assert(htmlContent.includes('/api/admin/creators'), 'Integrates GET /api/admin/creators');
    assert(htmlContent.includes('/status'), 'Integrates POST /api/admin/creators/:id/status');
    assert(htmlContent.includes('/api/admin/audit-logs'), 'Integrates GET /api/admin/audit-logs');
    assert(htmlContent.includes('/api/admin/telemetry'), 'Integrates GET /api/admin/telemetry');
    assert(htmlContent.includes('adminToken') || htmlContent.includes('admin_token'), 'Saves JWT admin token in localStorage');

    // -------------------------------------------------------------------------
    // TEST 4: Backend Contract End-to-End Verification
    // -------------------------------------------------------------------------
    console.log('\n4. Testing live Express API contract endpoints against server.js...');
    const { app, memoryDb } = require('./server.js');
    
    // Start temporary test server instance
    const testPort = 5999;
    const server = app.listen(testPort, async () => {
        try {
            // Helper function for HTTP requests
            function request(method, path, body = null, token = null) {
                return new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: 'localhost',
                        port: testPort,
                        path: path,
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                resolve({ status: res.statusCode, data: JSON.parse(data) });
                            } catch (e) {
                                resolve({ status: res.statusCode, raw: data });
                            }
                        });
                    });
                    req.on('error', reject);
                    if (body) req.write(JSON.stringify(body));
                    req.end();
                });
            }

            // Step 4.1: Admin Login
            const loginRes = await request('POST', '/api/admin/auth/login', {
                email: 'admin@creatorcashflow.com',
                password: 'AdminPass2026!'
            });
            assert(loginRes.status === 200 && loginRes.data.success, 'POST /api/admin/auth/login returns HTTP 200 & JWT');
            const adminToken = loginRes.data.token;

            // Step 4.2: GET /api/admin/metrics
            const metricsRes = await request('GET', '/api/admin/metrics', null, adminToken);
            assert(metricsRes.status === 200, 'GET /api/admin/metrics returns HTTP 200 with Bearer token');
            assert(typeof metricsRes.data.totalCreators === 'number', 'metrics.totalCreators is a valid number');
            assert(typeof metricsRes.data.gpvZar === 'number', 'metrics.gpvZar is a valid number');
            assert(typeof metricsRes.data.mrrZar === 'number', 'metrics.mrrZar is a valid number');
            assert(typeof metricsRes.data.taxReservesZar === 'number', 'metrics.taxReservesZar is a valid number');

            // Step 4.3: GET /api/admin/creators
            const creatorsRes = await request('GET', '/api/admin/creators', null, adminToken);
            assert(creatorsRes.status === 200 && Array.isArray(creatorsRes.data), 'GET /api/admin/creators returns creator array');

            const targetCreator = creatorsRes.data[0];
            assert(targetCreator && targetCreator.id, 'Creator array contains valid seed creator');

            // Step 4.4: POST /api/admin/creators/:id/status mutation
            const mutationRes = await request('POST', `/api/admin/creators/${targetCreator.id}/status`, {
                status: 'suspended',
                plan_tier: 'Pro',
                note: 'E2E Automated UI Test Mutation'
            }, adminToken);
            assert(mutationRes.status === 200 && mutationRes.data.success, 'POST status mutation returns HTTP 200');

            // Step 4.5: GET /api/admin/audit-logs
            const auditRes = await request('GET', '/api/admin/audit-logs', null, adminToken);
            assert(auditRes.status === 200 && Array.isArray(auditRes.data), 'GET /api/admin/audit-logs returns audit log array');
            assert(auditRes.data.some(log => log.target_creator_id === targetCreator.id), 'Newly recorded mutation entry present in audit logs');

            // Step 4.6: GET /api/admin/telemetry
            const telemetryRes = await request('GET', '/api/admin/telemetry', null, adminToken);
            assert(telemetryRes.status === 200 && Array.isArray(telemetryRes.data), 'GET /api/admin/telemetry returns telemetry array');

        } catch (err) {
            console.error('Test server error:', err);
            failed++;
        } finally {
            server.close(() => {
                console.log('\n==================================================');
                console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
                console.log('==================================================');
                if (failed > 0) {
                    process.exit(1);
                } else {
                    console.log('🎉 ALL ADMIN UI & API INTEGRATION TESTS PASSED!');
                    process.exit(0);
                }
            });
        }
    });
}

runVerification();
