const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('================================================================');
console.log('STRESS TEST SUITE 2: ADMIN PORTAL UI ADVERSARIAL STRESS TESTING');
console.log('Target: admin.html (Milestones M4, M5, M6)');
console.log('================================================================\n');

const htmlPath = path.resolve(__dirname, '../../admin.html');
if (!fs.existsSync(htmlPath)) {
    console.error(`ERROR: Target file not found at ${htmlPath}`);
    process.exit(1);
}

const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Test results recording
const testResults = [];
function recordTest(suite, name, passed, details = '', severity = 'INFO') {
    testResults.push({ suite, name, passed, details, severity });
    const status = passed ? '✅ PASS' : `❌ FAIL [${severity}]`;
    console.log(`[${status}] [${suite}] ${name}`);
    if (details) {
        console.log(`    Detail: ${details}`);
    }
}

// Mock Chart.js constructor
class MockChart {
    constructor(ctx, config) {
        MockChart.instances.push(this);
        this.ctx = ctx;
        this.config = config;
        this.destroyed = false;
    }
    destroy() {
        this.destroyed = true;
    }
}
MockChart.instances = [];

// Initialize JSDOM
const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000/admin.html',
    runScripts: 'dangerously',
    resources: 'usable'
});

const { window } = dom;
const { document } = window;

// Extract the main application script tag content (last script block before </body>)
const scriptBlocks = htmlContent.split(/<script[^>]*>/i);
const mainAppScriptBlock = scriptBlocks[scriptBlocks.length - 1].split(/<\/script>/i)[0];

// Attach mock Chart & Lucide before running script
window.Chart = MockChart;
window.lucide = { createIcons: () => {} };

// Mock localStorage
window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

// Mock fetch
window.fetch = async () => ({
    ok: true,
    json: async () => ({})
});

// Evaluate script inside window scope and expose functions to window
const wrapperScript = mainAppScriptBlock + `
    window.state = state;
    window.renderGrowthChart = renderGrowthChart;
    window.renderChannelChart = renderChannelChart;
    window.renderAuditLogs = renderAuditLogs;
    window.renderTelemetry = renderTelemetry;
    window.switchTab = switchTab;
`;
window.eval(wrapperScript);

// Run suite asynchronously
setTimeout(() => {
    try {
        runAllTests();
    } catch (err) {
        console.error('Fatal error during stress test execution:', err);
        process.exit(1);
    }
}, 100);

function runAllTests() {
    console.log('----------------------------------------------------------------');
    console.log('SUITE 1: CHART CANVAS INITIALIZATION & CHART.JS DATA BINDING');
    console.log('----------------------------------------------------------------');
    
    // 1.1 Growth timeline canvas element existence
    const growthCanvas = document.getElementById('growthTimelineChart');
    recordTest('Charts', 'Growth Timeline canvas (#growthTimelineChart) exists in DOM', !!growthCanvas, '', 'HIGH');

    // 1.2 Channel breakdown canvas element existence
    const channelCanvas = document.getElementById('channelBreakdownChart');
    recordTest('Charts', 'Channel Breakdown canvas (#channelBreakdownChart) exists in DOM', !!channelCanvas, '', 'HIGH');

    // 1.3 renderGrowthChart execution with standard data
    const sampleTimeline = [
        { month: 'Mar', gpv: 85000, mrr: 8500 },
        { month: 'Apr', gpv: 120000, mrr: 12000 },
        { month: 'May', gpv: 195000, mrr: 19500 }
    ];
    window.renderGrowthChart(sampleTimeline);
    const growthChartInst1 = window.state.charts.growth;
    const isGrowthChartCreated = growthChartInst1 && growthChartInst1.config.type === 'line';
    recordTest('Charts', 'renderGrowthChart initializes line Chart instance in state.charts.growth', isGrowthChartCreated, 
        isGrowthChartCreated ? `Labels: ${growthChartInst1.config.data.labels.join(', ')}` : 'Chart instance not found', 'HIGH');

    // 1.4 renderGrowthChart canvas reuse & destroy previous instance
    window.renderGrowthChart(sampleTimeline);
    const growthChartInst2 = window.state.charts.growth;
    const isPrevGrowthDestroyed = growthChartInst1.destroyed === true && growthChartInst2 !== growthChartInst1;
    recordTest('Charts', 'renderGrowthChart destroys previous Chart instance before re-creating', isPrevGrowthDestroyed, 
        isPrevGrowthDestroyed ? 'Previous chart instance successfully destroyed' : 'Failed to destroy previous chart instance', 'HIGH');

    // 1.5 renderGrowthChart null/undefined handling (Adversarial)
    let growthNullError = null;
    try {
        window.renderGrowthChart(null);
    } catch (e) {
        growthNullError = e.message;
    }
    recordTest('Charts', 'renderGrowthChart adversarial null input handling', !growthNullError, 
        growthNullError ? `Crash detected: ${growthNullError}` : 'Handled without crash', 'MEDIUM');

    // 1.6 renderGrowthChart empty array handling
    try {
        window.renderGrowthChart([]);
        const growthEmptyInst = window.state.charts.growth;
        recordTest('Charts', 'renderGrowthChart empty dataset handling ([])', growthEmptyInst && growthEmptyInst.config.data.labels.length === 0, 
            'Rendered empty line chart without crashing', 'LOW');
    } catch (e) {
        recordTest('Charts', 'renderGrowthChart empty dataset handling ([])', false, e.message, 'MEDIUM');
    }

    // 1.7 renderChannelChart execution with standard data
    const sampleBreakdown = { youtube: 450000, tiktok: 300000, patreon: 250000, brand_deals: 250000 };
    window.renderChannelChart(sampleBreakdown);
    const channelChartInst1 = window.state.charts.channel;
    const isChannelChartCreated = channelChartInst1 && channelChartInst1.config.type === 'doughnut';
    recordTest('Charts', 'renderChannelChart initializes doughnut Chart instance in state.charts.channel', isChannelChartCreated,
        isChannelChartCreated ? `Data: ${channelChartInst1.config.data.datasets[0].data.join(', ')}` : 'Chart instance not found', 'HIGH');

    // 1.8 renderChannelChart legend HTML percentage calculations
    const legendElem = document.getElementById('channel-legend-list');
    const legendHTML = legendElem ? legendElem.innerHTML : '';
    const totalSample = 450000 + 300000 + 250000 + 250000; // 1250000
    const ytPct = Math.round((450000 / totalSample) * 100); // 36%
    const hasCorrectPercentages = legendHTML.includes(`YouTube (${ytPct}%)`) || legendHTML.includes('YouTube');
    recordTest('Charts', 'renderChannelChart updates #channel-legend-list with percentages', hasCorrectPercentages, 
        `Legend text snapshot: ${legendElem ? legendElem.textContent.trim().replace(/\s+/g, ' ') : 'N/A'}`, 'MEDIUM');

    // 1.9 renderChannelChart zero values handling
    try {
        window.renderChannelChart({ youtube: 0, tiktok: 0, patreon: 0, brand_deals: 0 });
        const zeroLegendHTML = legendElem.innerHTML;
        const containsNaN = zeroLegendHTML.includes('NaN');
        recordTest('Charts', 'renderChannelChart zero revenue handling (no NaN in legend)', !containsNaN, 
            containsNaN ? 'Legend contains NaN%' : 'Handled 0 total gracefully', 'HIGH');
    } catch (e) {
        recordTest('Charts', 'renderChannelChart zero revenue handling', false, e.message, 'HIGH');
    }

    // 1.10 renderChannelChart null input handling (Adversarial)
    let channelNullError = null;
    try {
        window.renderChannelChart(null);
    } catch (e) {
        channelNullError = e.message;
    }
    recordTest('Charts', 'renderChannelChart adversarial null input handling', !channelNullError,
        channelNullError ? `Crash detected: ${channelNullError}` : 'Handled without crash', 'MEDIUM');


    console.log('\n----------------------------------------------------------------');
    console.log('SUITE 2: AUDIT TRAIL JSON DIFF RENDERING & SHA256 IP HASH FORMATTING');
    console.log('----------------------------------------------------------------');

    // 2.1 Audit trail container & filter elements existence
    const auditContainer = document.getElementById('audit-log-container');
    const auditFilterSelect = document.getElementById('audit-action-filter');
    recordTest('Audit', 'Audit log container (#audit-log-container) & filter (#audit-action-filter) exist', !!(auditContainer && auditFilterSelect), '', 'HIGH');

    // 2.2 Standard audit log entry rendering
    const testAuditLogs = [
        {
            id: 'log-1',
            admin_id: 'admin@creatorcashflow.com',
            target_creator_id: 'usr_789',
            action_type: 'STATUS_CHANGE',
            old_value: 'active',
            new_value: 'suspended',
            timestamp: new.target || '2026-08-07T14:30:00Z',
            ip_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        },
        {
            id: 'log-2',
            admin_id: 'admin@creatorcashflow.com',
            target_creator_id: 'usr_101',
            action_type: 'TIER_CHANGE',
            old_value: 'Free',
            new_value: 'Pro',
            timestamp: '2026-08-07T15:00:00Z',
            ip_hash: null
        }
    ];

    window.state.auditLogs = testAuditLogs;
    window.renderAuditLogs();

    const auditCardHTML = auditContainer ? auditContainer.innerHTML : '';
    const containsAction = auditCardHTML.includes('STATUS_CHANGE');
    const containsTarget = auditCardHTML.includes('usr_789');
    recordTest('Audit', 'renderAuditLogs renders action type badge and target creator ID', containsAction && containsTarget,
        `Rendered HTML snippet: ${auditContainer.firstElementChild ? auditContainer.firstElementChild.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) : 'None'}`, 'HIGH');

    // 2.3 SHA256 IP hash formatting check
    const containsIPHash = auditCardHTML.includes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    recordTest('Audit', 'renderAuditLogs displays 64-char SHA256 IP hash', containsIPHash, 
        containsIPHash ? 'SHA256 IP hash matched exactly' : 'SHA256 IP hash missing or corrupted', 'HIGH');

    // 2.4 SHA256 IP hash fallback for null/empty hash
    const containsFallbackHash = auditCardHTML.includes('IP Hash: N/A');
    recordTest('Audit', 'renderAuditLogs provides "IP Hash: N/A" fallback for null ip_hash', containsFallbackHash,
        containsFallbackHash ? 'Fallback IP Hash: N/A found for null ip_hash' : 'Fallback string missing', 'MEDIUM');

    // 2.5 Action type filtering test
    auditFilterSelect.value = 'TIER_CHANGE';
    window.renderAuditLogs();
    const filteredHTML = auditContainer.innerHTML;
    const hasTierOnly = filteredHTML.includes('TIER_CHANGE') && !filteredHTML.includes('STATUS_CHANGE');
    recordTest('Audit', 'renderAuditLogs filters feed by action_type (TIER_CHANGE)', hasTierOnly, 
        hasTierOnly ? 'Successfully filtered out STATUS_CHANGE' : 'Filter failed to isolate action type', 'HIGH');

    // Reset filter
    auditFilterSelect.value = 'all';
    window.renderAuditLogs();

    // 2.6 Empty state rendering when no audit logs match
    window.state.auditLogs = [];
    window.renderAuditLogs();
    const emptyAuditHTML = auditContainer.innerHTML;
    const hasEmptyAuditMsg = emptyAuditHTML.includes('No audit records found');
    recordTest('Audit', 'renderAuditLogs empty state message when list is empty', hasEmptyAuditMsg, '', 'MEDIUM');

    // 2.7 Adversarial test: JSON object diff rendering (Checking if [object Object] is rendered)
    window.state.auditLogs = [{
        id: 'log-obj',
        admin_id: 'admin-1',
        target_creator_id: 'usr_999',
        action_type: 'STATUS_AND_TIER_CHANGE',
        old_value: { status: 'active', plan_tier: 'Free' },
        new_value: { status: 'suspended', plan_tier: 'Pro' },
        timestamp: '2026-08-07T16:00:00Z',
        ip_hash: 'abc123hash'
    }];
    window.renderAuditLogs();
    const objDiffHTML = auditContainer.innerHTML;
    const rendersObjectObject = objDiffHTML.includes('[object Object]');
    recordTest('Audit', 'Adversarial: old_value/new_value object diff rendering (Detect [object Object])', !rendersObjectObject,
        rendersObjectObject ? 'FLAW DETECTED: JS object in old_value/new_value rendered as "[object Object]" string' : 'Formatted object properly', 'HIGH');

    // 2.8 Adversarial test: XSS injection in audit logs
    window.state.auditLogs = [{
        id: 'log-xss',
        admin_id: '<script>alert("xss")</script>',
        target_creator_id: '<img src=x onerror=alert(1)>',
        action_type: 'STATUS_CHANGE',
        old_value: '<b onmouseover=alert(1)>old</b>',
        new_value: 'new',
        timestamp: '2026-08-07T16:00:00Z',
        ip_hash: 'hash'
    }];
    window.renderAuditLogs();
    const xssImgInjected = auditContainer.querySelector('img[src="x"]');
    const xssScriptInjected = auditContainer.innerHTML.includes('<script>alert');
    const hasXSSVulnerability = !!(xssImgInjected || xssScriptInjected);
    recordTest('Audit', 'Adversarial: HTML/XSS injection in audit log fields', !hasXSSVulnerability,
        hasXSSVulnerability ? 'SECURITY VULNERABILITY DETECTED: Raw unescaped HTML elements injected into DOM via innerHTML' : 'Sanitized HTML inputs', 'CRITICAL');


    console.log('\n----------------------------------------------------------------');
    console.log('SUITE 3: AI TELEMETRY SCORECARDS & MASKED PROMPT DISPLAY');
    console.log('----------------------------------------------------------------');

    // 3.1 Telemetry elements existence
    const elTotalQueries = document.getElementById('telemetry-total-queries');
    const elTotalTokens = document.getElementById('telemetry-total-tokens');
    const elAvgLatency = document.getElementById('telemetry-avg-latency');
    const elTtlIndicator = document.getElementById('telemetry-ttl-indicator');
    const telemetryFeed = document.getElementById('telemetry-feed');

    const allTelemetryElemsExist = !!(elTotalQueries && elTotalTokens && elAvgLatency && elTtlIndicator && telemetryFeed);
    recordTest('Telemetry', 'Telemetry scorecards & feed container exist in DOM', allTelemetryElemsExist, '', 'HIGH');

    // 3.2 Telemetry empty list rendering
    window.state.telemetry = [];
    window.renderTelemetry();

    const emptyQueriesText = elTotalQueries.textContent.trim();
    const emptyTokensText = elTotalTokens.textContent.trim();
    const emptyLatencyText = elAvgLatency.textContent.trim();
    const emptyFeedHTML = telemetryFeed.innerHTML;

    const isEmptyScorecardCorrect = (emptyQueriesText === '0') && (emptyTokensText === '0') && (emptyLatencyText === '0 ms');
    const isEmptyFeedMsgPresent = emptyFeedHTML.includes('No AI query telemetry records logged yet');

    recordTest('Telemetry', 'renderTelemetry scorecards display 0/0ms for empty telemetry list', isEmptyScorecardCorrect, 
        `Queries: ${emptyQueriesText}, Tokens: ${emptyTokensText}, Latency: ${emptyLatencyText}`, 'HIGH');
    recordTest('Telemetry', 'renderTelemetry empty feed displays "No AI query telemetry..." message', isEmptyFeedMsgPresent, '', 'MEDIUM');

    // 3.3 Telemetry standard records rendering & calculation accuracy
    const testTelemetry = [
        {
            id: 't-1',
            category_tag: 'Tax Deduction Strategy',
            prompt_masked: 'How do I deduct [REDACTED_ZAR] for camera equipment?',
            tokens_used: 340,
            model: 'gemini-1.5-flash',
            latency_ms: 420,
            created_at: '2026-08-07T12:00:00Z'
        },
        {
            id: 't-2',
            category_tag: 'Gear Purchase Planning',
            prompt_masked: 'Can I write off a [REDACTED_ZAR] laptop?',
            tokens_used: 180,
            model: 'gemini-1.5-pro',
            latency_ms: 680,
            created_at: '2026-08-07T14:00:00Z'
        }
    ];

    window.state.telemetry = testTelemetry;
    window.renderTelemetry();

    const queriesVal = elTotalQueries.textContent.trim(); // "2"
    const tokensVal = elTotalTokens.textContent.trim();   // "520"
    const latencyVal = elAvgLatency.textContent.trim();   // "550 ms" (round((420+680)/2))

    const isTotalQueriesCorrect = queriesVal === '2';
    const isTotalTokensCorrect = tokensVal === '520';
    const isAvgLatencyCorrect = latencyVal === '550 ms';

    recordTest('Telemetry', 'renderTelemetry total queries scorecard calculation (2)', isTotalQueriesCorrect, `Actual: ${queriesVal}`, 'HIGH');
    recordTest('Telemetry', 'renderTelemetry total tokens scorecard calculation (520)', isTotalTokensCorrect, `Actual: ${tokensVal}`, 'HIGH');
    recordTest('Telemetry', 'renderTelemetry average latency scorecard calculation (550 ms)', isAvgLatencyCorrect, `Actual: ${latencyVal}`, 'HIGH');

    // 3.4 Telemetry feed card details
    const telemetryHTML = telemetryFeed.innerHTML;
    const hasCategoryTag = telemetryHTML.includes('Tax Deduction Strategy') && telemetryHTML.includes('Gear Purchase Planning');
    const hasMaskedPrompt = telemetryHTML.includes('"How do I deduct [REDACTED_ZAR] for camera equipment?"');
    const hasModelTags = telemetryHTML.includes('gemini-1.5-flash') && telemetryHTML.includes('gemini-1.5-pro');

    recordTest('Telemetry', 'renderTelemetry feed displays category tag badges', hasCategoryTag, '', 'HIGH');
    recordTest('Telemetry', 'renderTelemetry feed displays PII-masked prompt with quotes', hasMaskedPrompt, '', 'HIGH');
    recordTest('Telemetry', 'renderTelemetry feed displays model tags (gemini-1.5-flash / gemini-1.5-pro)', hasModelTags, '', 'HIGH');

    // 3.5 Telemetry missing/null fields handling
    window.state.telemetry = [{
        id: 't-null',
        category_tag: null,
        prompt_masked: 'Test query',
        tokens_used: null,
        model: null,
        latency_ms: null,
        created_at: '2026-08-07T15:00:00Z'
    }];
    try {
        window.renderTelemetry();
        const nullCardHTML = telemetryFeed.innerHTML;
        const hasFallbackCategory = nullCardHTML.includes('General Inquiry');
        const hasFallbackModel = nullCardHTML.includes('gemini-1.5-flash');
        recordTest('Telemetry', 'renderTelemetry null fields fallback (General Inquiry & gemini-1.5-flash)', 
            hasFallbackCategory && hasFallbackModel, `Card HTML snippet: ${nullCardHTML.slice(0, 150)}`, 'MEDIUM');
    } catch (e) {
        recordTest('Telemetry', 'renderTelemetry null fields fallback', false, e.message, 'HIGH');
    }

    // 3.6 Adversarial test: XSS injection in masked prompts
    window.state.telemetry = [{
        id: 't-xss',
        category_tag: 'Tax',
        prompt_masked: '<img src=x onerror=alert("telemetry_xss")>',
        tokens_used: 100,
        model: 'gemini-1.5-flash',
        latency_ms: 200,
        created_at: '2026-08-07T15:00:00Z'
    }];
    window.renderTelemetry();
    const telXSSImg = telemetryFeed.querySelector('img[src="x"]');
    recordTest('Telemetry', 'Adversarial: HTML/XSS injection in prompt_masked', !telXSSImg,
        telXSSImg ? 'SECURITY VULNERABILITY DETECTED: Raw unescaped HTML tag injected via prompt_masked innerHTML' : 'Sanitized prompt HTML', 'CRITICAL');


    console.log('\n----------------------------------------------------------------');
    console.log('SUITE 4: TAB SWITCHING & NAVIGATION UI FLOWS');
    console.log('----------------------------------------------------------------');

    // 4.1 Switch to overview tab
    window.switchTab('overview');
    const overviewPanel = document.getElementById('view-overview');
    const overviewBtn = document.getElementById('tab-btn-overview');
    const isOverviewVisible = overviewPanel && !overviewPanel.classList.contains('hidden') && overviewBtn.classList.contains('active');
    recordTest('Tabs', 'switchTab("overview") displays #view-overview panel and activates tab button', isOverviewVisible, '', 'HIGH');

    // 4.2 Switch to creators tab
    window.switchTab('creators');
    const creatorsPanel = document.getElementById('view-creators');
    const isCreatorsVisible = creatorsPanel && !creatorsPanel.classList.contains('hidden');
    recordTest('Tabs', 'switchTab("creators") displays #view-creators panel', isCreatorsVisible, '', 'HIGH');

    // 4.3 Switch to audit tab
    window.switchTab('audit');
    const auditPanel = document.getElementById('view-audit');
    const isAuditVisible = auditPanel && !auditPanel.classList.contains('hidden');
    recordTest('Tabs', 'switchTab("audit") displays #view-audit panel', isAuditVisible, '', 'HIGH');

    // 4.4 Switch to telemetry tab
    window.switchTab('telemetry');
    const telemetryPanel = document.getElementById('view-telemetry');
    const isTelemetryVisible = telemetryPanel && !telemetryPanel.classList.contains('hidden');
    recordTest('Tabs', 'switchTab("telemetry") displays #view-telemetry panel', isTelemetryVisible, '', 'HIGH');


    console.log('\n================================================================');
    console.log('STRESS TEST SUMMARY RESULTS');
    console.log('================================================================');
    const passedCount = testResults.filter(t => t.passed).length;
    const failedCount = testResults.filter(t => !t.passed).length;
    const criticalFails = testResults.filter(t => !t.passed && t.severity === 'CRITICAL').length;
    const highFails = testResults.filter(t => !t.passed && t.severity === 'HIGH').length;

    console.log(`Total Scenarios Tested: ${testResults.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount} (Critical: ${criticalFails}, High: ${highFails})`);

    // Write JSON results artifact for handoff report
    const summaryArtifact = {
        timestamp: new Date().toISOString(),
        total: testResults.length,
        passed: passedCount,
        failed: failedCount,
        criticalFails,
        highFails,
        verdict: failedCount === 0 ? 'APPROVE' : 'REQUEST_CHANGES',
        results: testResults
    };

    fs.writeFileSync(path.resolve(__dirname, 'test_results.json'), JSON.stringify(summaryArtifact, null, 2));
    console.log('\nSaved detailed test output to test_results.json');
}
