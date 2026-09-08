/* ==========================================================================
   Creator Cash Flow - Admin Command Portal (`admin.html`) UI Stress Testing
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function runUiStressTest() {
    console.log('🚀 Running UI Stress Test Suite for admin.html...\n');

    const adminHtmlPath = path.join(__dirname, '../../admin.html');
    if (!fs.existsSync(adminHtmlPath)) {
        console.error(`❌ CRITICAL: admin.html not found at path: ${adminHtmlPath}`);
        process.exit(1);
    }

    const htmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, detail = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
            failed++;
        }
    }

    // Helper to create fresh JSDOM instance with executed scripts
    function createDomInstance() {
        // Inject window bindings synchronously into inline script
        const patchedHtml = htmlContent.replace(
            'const state = {',
            'const state = window.state = {'
        ).replace(
            'function formatZAR(amount) {',
            `window.renderCreatorsTable = renderCreatorsTable;
            window.renderAuditLogs = renderAuditLogs;
            window.renderTelemetry = renderTelemetry;
            window.openCreatorModal = openCreatorModal;
            window.closeModal = closeModal;
            window.setModalPlan = setModalPlan;
            window.setModalStatus = setModalStatus;
            window.handleMutationSubmit = handleMutationSubmit;
            window.fetchCreators = fetchCreators;
            window.fetchMetrics = fetchMetrics;
            window.fetchAuditLogs = fetchAuditLogs;
            window.fetchTelemetry = fetchTelemetry;
            window.handleLogout = handleLogout;
            function formatZAR(amount) {`
        );

        const dom = new JSDOM(patchedHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/'
        });

        // Mock window fetch & localStorage
        const window = dom.window;
        window.localStorage.setItem('adminToken', 'test_valid_jwt_token');

        // Mock Chart & Lucide
        window.Chart = function() {
            return { destroy: () => {} };
        };
        window.lucide = { createIcons: () => {} };

        return dom;
    }

    // =========================================================================
    // TEST SUITE 1: Search Filtering Responsiveness
    // =========================================================================
    console.log('--- TEST SUITE 1: Search Filtering Responsiveness ---');
    {
        const dom = createDomInstance();
        const { window } = dom;
        const { document } = window;
        const state = window.state;
        const renderCreatorsTable = window.renderCreatorsTable;

        // Seed state with standard creators
        state.creators = [
            { id: 'usr_1', name: 'Naledi Molefe', email: 'naledi@creator.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-02-15T10:00:00.000Z', monthly_cash_flow: 45000 },
            { id: 'usr_2', name: 'Sipho Dlamini', email: 'sipho@vlogsa.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-03-01T11:20:00.000Z', monthly_cash_flow: 62000 },
            { id: 'usr_3', name: 'Jessica van der Merwe', email: 'jessica@techreviews.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-03-18T14:15:00.000Z', monthly_cash_flow: 28000 },
            { id: 'usr_4', name: 'Thabo Mokoena', email: 'thabo@fitnessza.co.za', plan_tier: 'Free', status: 'active', created_at: '2026-04-05T09:30:00.000Z', monthly_cash_flow: 12000 }
        ];

        // 1.1 Match by name substring
        const searchInput = document.getElementById('creator-search-input');
        searchInput.value = 'Naledi';
        renderCreatorsTable();
        const rows1 = document.querySelectorAll('#creator-table-body tr');
        assert(rows1.length === 1 && rows1[0].textContent.includes('Naledi Molefe'), 'Search matches creator name substring ("Naledi")');

        // 1.2 Match by email substring
        searchInput.value = 'techreviews';
        renderCreatorsTable();
        const rows2 = document.querySelectorAll('#creator-table-body tr');
        assert(rows2.length === 1 && rows2[0].textContent.includes('jessica@techreviews.co.za'), 'Search matches email substring ("techreviews")');

        // 1.3 Empty search string returns all
        searchInput.value = '';
        renderCreatorsTable();
        const rows3 = document.querySelectorAll('#creator-table-body tr');
        assert(rows3.length === 4, 'Empty search string returns all 4 creators');

        // 1.4 Non-matching query returns empty fallback message
        searchInput.value = 'nonexistent_user_query_xyz';
        renderCreatorsTable();
        const tbody = document.getElementById('creator-table-body');
        assert(tbody.textContent.includes('No creators match current filters'), 'Non-matching query shows fallback message "No creators match current filters"');

        // 1.5 Edge case: Untrimmed search string with spaces (" Naledi ")
        searchInput.value = ' Naledi ';
        renderCreatorsTable();
        const rows5 = document.querySelectorAll('#creator-table-body tr');
        assert(rows5.length === 1, 'Search query with leading/trailing spaces matches correctly (" Naledi ")', `Actual rows matched: ${rows5.length}`);

        // 1.6 Adversarial Stress: Creator with undefined/null name or email
        state.creators.push({ id: 'usr_5', name: undefined, email: null, plan_tier: 'Free', status: 'active' });
        try {
            searchInput.value = 'test';
            renderCreatorsTable();
            assert(true, 'Search table handles null/undefined name/email without throwing JS error');
        } catch (err) {
            assert(false, 'Search table handles null/undefined name/email without throwing JS error', err.message);
        }
    }

    // =========================================================================
    // TEST SUITE 2: Tab Filtering (All, Pro, Free)
    // =========================================================================
    console.log('\n--- TEST SUITE 2: Tab Filtering (All, Pro, Free) ---');
    {
        const dom = createDomInstance();
        const { window } = dom;
        const { document } = window;
        const state = window.state;
        const renderCreatorsTable = window.renderCreatorsTable;

        state.creators = [
            { id: 'usr_1', name: 'Naledi Molefe', email: 'naledi@creator.co.za', plan_tier: 'Pro', status: 'active' },
            { id: 'usr_2', name: 'Sipho Dlamini', email: 'sipho@vlogsa.co.za', plan_tier: 'Pro', status: 'active' },
            { id: 'usr_3', name: 'Jessica van der Merwe', email: 'jessica@techreviews.co.za', plan_tier: 'Free', status: 'active' },
            { id: 'usr_4', name: 'Thabo Mokoena', email: 'thabo@fitnessza.co.za', plan_tier: undefined, status: 'active' } // Missing plan_tier defaults to 'Free' visually
        ];

        document.getElementById('creator-search-input').value = '';

        // 2.1 Tab "All"
        state.creatorFilterPlan = 'all';
        renderCreatorsTable();
        let rows = document.querySelectorAll('#creator-table-body tr');
        assert(rows.length === 4, 'Tab "All" displays all 4 creators');

        // 2.2 Tab "Pro"
        state.creatorFilterPlan = 'pro';
        renderCreatorsTable();
        rows = document.querySelectorAll('#creator-table-body tr');
        assert(rows.length === 2, 'Tab "Pro" displays only 2 Pro creators');

        // 2.3 Tab "Free"
        state.creatorFilterPlan = 'free';
        renderCreatorsTable();
        rows = document.querySelectorAll('#creator-table-body tr');
        
        // Check if missing plan_tier (rendered visually as Free) is captured by 'free' tab filter
        const handlesMissingTierInFreeFilter = (rows.length === 2);
        assert(handlesMissingTierInFreeFilter, 'Tab "Free" includes creators with missing/null plan_tier that render as "Free"', `Found ${rows.length} rows instead of 2`);
    }

    // =========================================================================
    // TEST SUITE 3: Revenue Volume Sorting Algorithms
    // =========================================================================
    console.log('\n--- TEST SUITE 3: Revenue Volume Sorting Algorithms ---');
    {
        const dom = createDomInstance();
        const { window } = dom;
        const { document } = window;

        const sortSelect = document.getElementById('creator-sort-select');
        const options = Array.from(sortSelect.options).map(o => o.value);

        const hasRevenueDesc = options.includes('revenue_desc') || options.includes('highest_revenue') || options.includes('revenue-desc');
        const hasRevenueAsc = options.includes('revenue_asc') || options.includes('lowest_revenue') || options.includes('revenue-asc');

        assert(hasRevenueDesc, 'Sort select contains option for highest revenue volume (descending)');
        assert(hasRevenueAsc, 'Sort select contains option for lowest revenue volume (ascending)');
    }

    // =========================================================================
    // TEST SUITE 4: Modal Open/Close State Machine & Mutation Submission
    // =========================================================================
    console.log('\n--- TEST SUITE 4: Modal Open/Close & Input Mutation Submission ---');
    {
        const dom = createDomInstance();
        const { window } = dom;
        const { document } = window;
        const state = window.state;
        const openCreatorModal = window.openCreatorModal;
        const closeModal = window.closeModal;
        const setModalPlan = window.setModalPlan;
        const setModalStatus = window.setModalStatus;

        state.creators = [
            { id: 'usr_100', name: 'Test Creator', email: 'test@creator.com', plan_tier: 'Free', status: 'active' }
        ];

        // 4.1 Open Modal
        openCreatorModal('usr_100');
        const modal = document.getElementById('creator-detail-modal');
        assert(!modal.classList.contains('hidden'), 'openCreatorModal opens modal (removes "hidden" class)');
        assert(document.getElementById('modal-creator-name').textContent === 'Test Creator', 'Modal populates creator name correctly');
        assert(document.getElementById('modal-creator-email').textContent === 'test@creator.com', 'Modal populates creator email correctly');
        assert(state.selectedCreator && state.selectedCreator.id === 'usr_100', 'state.selectedCreator is set');

        // 4.2 State Machine Toggle: Set Plan to Pro and Status to Suspended
        setModalPlan('Pro');
        assert(state.selectedMutationPlan === 'Pro', 'setModalPlan("Pro") updates state.selectedMutationPlan');

        setModalStatus('suspended');
        assert(state.selectedMutationStatus === 'suspended', 'setModalStatus("suspended") updates state.selectedMutationStatus');

        // 4.3 Close Modal
        closeModal();
        assert(modal.classList.contains('hidden'), 'closeModal closes modal (adds "hidden" class)');
        assert(state.selectedCreator === null, 'closeModal clears state.selectedCreator to null');
    }

    // =========================================================================
    // TEST SUITE 5: Session Expiry Handling (401/403 API Responses)
    // =========================================================================
    console.log('\n--- TEST SUITE 5: Session Expiry Handling (401/403 Responses) ---');
    {
        const dom = createDomInstance();
        const { window } = dom;
        const state = window.state;
        const fetchCreators = window.fetchCreators;
        const fetchMetrics = window.fetchMetrics;
        const fetchAuditLogs = window.fetchAuditLogs;
        const fetchTelemetry = window.fetchTelemetry;

        // Mock fetch to simulate 401 Unauthorized
        window.fetch = async function(url) {
            return {
                ok: false,
                status: 401,
                json: async () => ({ error: 'JWT token expired or invalid' })
            };
        };

        // Call fetch routines and check if state token is cleared and user is logged out
        await fetchCreators();
        await fetchMetrics();
        await fetchAuditLogs();
        await fetchTelemetry();

        const isLoggedOut = (state.token === null) || window.document.getElementById('admin-login-modal').classList.contains('hidden') === false;

        assert(isLoggedOut, '401/403 responses during fetch automatically invoke handleLogout and show login gate', `state.token is "${state.token}"`);
    }

    console.log('\n==================================================');
    console.log(`STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    return { passed, failed };
}

runUiStressTest();
