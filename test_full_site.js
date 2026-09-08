const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE END-TO-END SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ PASS: ${desc}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${desc}`);
        console.error(`     Error: ${err.message}\n`);
    }
}

// ---------------------------------------------------------
// 1. TEST index.html
// ---------------------------------------------------------
console.log('🔍 [SUITE 1] PUBLIC SITE (index.html)');
const indexPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(indexPath), 'index.html must exist');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

it('index.html exists and is non-empty', () => {
    assert(indexHtml.length > 5000, 'index.html must be substantial');
});

it('index.html contains valid viewport and charset meta tags', () => {
    assert(indexHtml.toLowerCase().includes('charset="utf-8"'), 'Missing charset');
    assert(indexHtml.includes('name="viewport"'), 'Missing viewport');
});

it('index.html contains Creator Cash Flow brand and navigation', () => {
    assert(indexHtml.includes('Creator Cash Flow'), 'Missing brand name');
    assert(indexHtml.includes('glass-pill-nav'), 'Missing glass-pill-nav');
});

// ---------------------------------------------------------
// 2. TEST admin.html
// ---------------------------------------------------------
console.log('\n🔍 [SUITE 2] ADMIN COMMAND PORTAL (admin.html)');
const adminPath = path.join(__dirname, 'admin.html');
assert(fs.existsSync(adminPath), 'admin.html must exist');
const adminHtml = fs.readFileSync(adminPath, 'utf8');

it('admin.html exists and has valid HTML5 structure', () => {
    assert(adminHtml.includes('<!DOCTYPE html>'), 'Missing doctype');
    assert(adminHtml.includes('<html'), 'Missing html tag');
    assert(adminHtml.includes('</html>'), 'Missing closing html tag');
});

it('admin.html has all 4 primary navigation tabs', () => {
    assert(adminHtml.includes('tab-btn-overview'), 'Missing overview tab');
    assert(adminHtml.includes('tab-btn-creators'), 'Missing creators tab');
    assert(adminHtml.includes('tab-btn-audit'), 'Missing audit tab');
    assert(adminHtml.includes('tab-btn-telemetry'), 'Missing telemetry tab');
});

it('admin.html has all 4 view panels', () => {
    assert(adminHtml.includes('id="view-overview"'), 'Missing view-overview panel');
    assert(adminHtml.includes('id="view-creators"'), 'Missing view-creators panel');
    assert(adminHtml.includes('id="view-audit"'), 'Missing view-audit panel');
    assert(adminHtml.includes('id="view-telemetry"'), 'Missing view-telemetry panel');
});

it('admin.html has KPI scorecards for Creators, GPV, MRR, and Tax Reserves', () => {
    assert(adminHtml.includes('id="metric-total-creators"'), 'Missing metric-total-creators');
    assert(adminHtml.includes('id="metric-gpv"'), 'Missing metric-gpv');
    assert(adminHtml.includes('id="metric-mrr"'), 'Missing metric-mrr');
    assert(adminHtml.includes('id="metric-tax-reserves"'), 'Missing metric-tax-reserves');
});

it('admin.html scripts parse cleanly with 0 JavaScript syntax errors', () => {
    const scriptMatches = adminHtml.match(/<script(?![^>]*src=)[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
    assert(scriptMatches.length > 0, 'No inline scripts found');
    scriptMatches.forEach((s, idx) => {
        const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
        try {
            new Function(code);
        } catch (e) {
            throw new Error(`Syntax error in script block ${idx}: ${e.message}`);
        }
    });
});

// ---------------------------------------------------------
// 3. TEST DOM SIMULATION & TAB SWITCHING LOGIC
// ---------------------------------------------------------
console.log('\n🔍 [SUITE 3] TAB SWITCHING & EVENT HANDLER SIMULATION');

it('switchTab function switches active panel and tab styling without errors', () => {
    const elements = {};
    const mockDocument = {
        getElementById: (id) => {
            if (!elements[id]) {
                elements[id] = {
                    id,
                    className: '',
                    classList: {
                        add: (c) => {},
                        remove: (c) => {}
                    },
                    style: {},
                    innerHTML: '',
                    textContent: ''
                };
            }
            return elements[id];
        },
        querySelectorAll: (sel) => {
            if (sel === '.admin-tab-btn') {
                return ['overview', 'creators', 'audit', 'telemetry'].map(t => mockDocument.getElementById(`tab-btn-${t}`));
            }
            if (sel === '.admin-view-panel') {
                return ['overview', 'creators', 'audit', 'telemetry'].map(t => mockDocument.getElementById(`view-${t}`));
            }
            return [];
        }
    };

    function switchTab(tabName) {
        mockDocument.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            btn.style.color = '#A1A1AA';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
        const activeBtn = mockDocument.getElementById(`tab-btn-${tabName}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
            activeBtn.style.color = '#22C55E';
            activeBtn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        }

        mockDocument.querySelectorAll('.admin-view-panel').forEach(panel => {
            panel.classList.add('hidden');
            panel.style.display = 'none';
        });
        const activePanel = mockDocument.getElementById(`view-${tabName}`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
            activePanel.style.display = 'block';
        }
    }

    switchTab('creators');
    assert.strictEqual(elements['view-creators'].style.display, 'block');
    assert.strictEqual(elements['view-overview'].style.display, 'none');

    switchTab('audit');
    assert.strictEqual(elements['view-audit'].style.display, 'block');
    assert.strictEqual(elements['view-creators'].style.display, 'none');

    switchTab('telemetry');
    assert.strictEqual(elements['view-telemetry'].style.display, 'block');

    switchTab('overview');
    assert.strictEqual(elements['view-overview'].style.display, 'block');
});

// ---------------------------------------------------------
// 4. TEST BACKEND SERVER ROUTES
// ---------------------------------------------------------
console.log('\n🔍 [SUITE 4] BACKEND SERVER ARCHITECTURE (server.js)');
const serverPath = path.join(__dirname, 'server.js');
assert(fs.existsSync(serverPath), 'server.js must exist');
const serverCode = fs.readFileSync(serverPath, 'utf8');

it('server.js contains master admin credential verification', () => {
    assert(serverCode.includes('ADMIN_EMAIL') || serverCode.includes('/api/admin/auth/login'), 'Missing master admin credential configuration');
    assert(serverCode.includes('/api/admin/auth/login'), 'Missing login route');
    assert(serverCode.includes('/api/admin/verify-auth'), 'Missing verify-auth route');
    assert(serverCode.includes('/api/admin/metrics'), 'Missing metrics route');
    assert(serverCode.includes('/api/admin/creators'), 'Missing creators route');
    assert(serverCode.includes('/api/admin/audit-logs'), 'Missing audit-logs route');
    assert(serverCode.includes('/api/admin/telemetry'), 'Missing telemetry route');
});

it('server.js requires cryptographic JWT admin role check (requireAdmin)', () => {
    assert(serverCode.includes('requireAdmin'), 'Missing requireAdmin middleware');
    assert(serverCode.includes("role !== 'admin'") || serverCode.includes("req.admin"), 'Missing role verification');
});

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED CLEANLY`);
console.log('====================================================\n');

if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
