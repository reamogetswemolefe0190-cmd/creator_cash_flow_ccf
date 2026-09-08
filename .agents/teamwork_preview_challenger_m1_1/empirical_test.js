const { spawn } = require('child_process');
const http = require('http');

const BROWSER_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.id = 1;
        this.callbacks = new Map();
        this.eventListeners = new Map();
    }

    async connect() {
        this.ws = new WebSocket(this.wsUrl);
        await new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });

        this.ws.onmessage = (msg) => {
            const res = JSON.parse(msg.data);
            if (res.id && this.callbacks.has(res.id)) {
                const cb = this.callbacks.get(res.id);
                this.callbacks.delete(res.id);
                if (res.error) cb.reject(res.error);
                else cb.resolve(res.result);
            } else if (res.method && this.eventListeners.has(res.method)) {
                const listener = this.eventListeners.get(res.method);
                if (listener) listener(res.params);
            }
        };
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    on(event, listener) {
        this.eventListeners.set(event, listener);
    }

    async close() {
        if (this.ws) this.ws.close();
    }
}

async function waitForCdp() {
    for (let i = 0; i < 15; i++) {
        try {
            const info = await getJson(`http://127.0.0.1:${PORT}/json/version`);
            if (info && info.webSocketDebuggerUrl) return info;
        } catch(e) {}
        await sleep(400);
    }
    throw new Error('CDP server failed to start on port ' + PORT);
}

async function runEmpiricalTests() {
    console.log('--- Launching Edge Process for CDP ---');
    const chromeProcess = spawn(BROWSER_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--remote-allow-origins=*'
    ], { stdio: 'ignore' });

    let versionInfo;
    try {
        versionInfo = await waitForCdp();
        console.log('Connected to Browser CDP:', versionInfo.Browser);
    } catch (e) {
        console.error('Failed to connect to CDP port:', e.message);
        chromeProcess.kill();
        process.exit(1);
    }

    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    let pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
        console.error('No page target found');
        chromeProcess.kill();
        process.exit(1);
    }

    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const consoleLogs = [];
    const pageErrors = [];

    cdp.on('Console.messageAdded', (params) => {
        consoleLogs.push(params.message);
    });

    cdp.on('Runtime.exceptionThrown', (params) => {
        pageErrors.push(params.exceptionDetails);
    });

    const viewports = [
        { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
        { name: 'iPhone 14', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
        { name: 'iPhone 14 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, isMobile: true },
        { name: 'Desktop 1440p', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false }
    ];

    const results = {
        viewports: {},
        interactionTests: {},
        cssPerformance: {},
        consoleErrors: []
    };

    for (const vp of viewports) {
        console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
        
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: vp.deviceScaleFactor,
            mobile: vp.isMobile
        });

        await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
        await sleep(1500);

        // Evaluate layout metrics
        const evalRes = await cdp.send('Runtime.evaluate', {
            expression: `
            (() => {
                const docEl = document.documentElement;
                const body = document.body;
                const winWidth = window.innerWidth;
                const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
                const hasHorizontalOverflow = scrollWidth > winWidth + 1; // 1px tolerance

                // Find elements causing horizontal overflow
                const overflowingElements = [];
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    // check if element extends beyond right edge
                    if (rect.right > winWidth + 2 && rect.width > 0) {
                        const isMeshWrapper = el.classList.contains('ambient-mesh-wrapper');
                        const computedOverflow = getComputedStyle(el).overflow;
                        if (!isMeshWrapper && computedOverflow !== 'hidden') {
                            overflowingElements.push({
                                tagName: el.tagName,
                                id: el.id,
                                className: el.className,
                                right: Math.round(rect.right),
                                left: Math.round(rect.left),
                                width: Math.round(rect.width),
                                windowWidth: winWidth
                            });
                        }
                    }
                });

                // Glass Pill Navbar metrics
                const navPill = document.querySelector('.glass-pill-nav');
                const navHeader = document.querySelector('header');
                let navInfo = null;
                if (navPill && navHeader) {
                    const pillRect = navPill.getBoundingClientRect();
                    const headerRect = navHeader.getBoundingClientRect();
                    const style = getComputedStyle(navPill);
                    navInfo = {
                        width: Math.round(pillRect.width),
                        left: Math.round(pillRect.left),
                        right: Math.round(pillRect.right),
                        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
                        borderRadius: style.borderRadius,
                        headerTop: Math.round(headerRect.top)
                    };
                }

                // Ambient mesh metrics
                const meshWrapper = document.querySelector('.ambient-mesh-wrapper');
                let meshInfo = null;
                if (meshWrapper) {
                    const rect = meshWrapper.getBoundingClientRect();
                    const style = getComputedStyle(meshWrapper);
                    meshInfo = {
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        overflow: style.overflow,
                        orbsCount: meshWrapper.querySelectorAll('.ambient-orb').length
                    };
                }

                // Arc Hero Mockup metrics
                const arcFrame = document.getElementById('arc-browser-frame');
                let arcInfo = null;
                if (arcFrame) {
                    const rect = arcFrame.getBoundingClientRect();
                    const periodLabel = document.getElementById('hero-mockup-period-label')?.innerText;
                    const balance = document.getElementById('hero-mockup-balance-display')?.innerText;
                    const badgeTopRight = document.querySelector('.badge-top-right')?.getBoundingClientRect();
                    const badgeBottomLeft = document.querySelector('.badge-bottom-left')?.getBoundingClientRect();
                    arcInfo = {
                        width: Math.round(rect.width),
                        left: Math.round(rect.left),
                        right: Math.round(rect.right),
                        periodLabel,
                        balance,
                        badgeTopRight: badgeTopRight ? {
                            left: Math.round(badgeTopRight.left),
                            right: Math.round(badgeTopRight.right),
                            clippedLeft: badgeTopRight.left < 0,
                            clippedRight: badgeTopRight.right > winWidth
                        } : null,
                        badgeBottomLeft: badgeBottomLeft ? {
                            left: Math.round(badgeBottomLeft.left),
                            right: Math.round(badgeBottomLeft.right),
                            clippedLeft: badgeBottomLeft.left < 0,
                            clippedRight: badgeBottomLeft.right > winWidth
                        } : null
                    };
                }

                // Glass cards check
                const glassCards = document.querySelectorAll('.glass-card, .glass-card-nested');
                const glassCardsCount = glassCards.length;

                return {
                    winWidth,
                    scrollWidth,
                    hasHorizontalOverflow,
                    overflowingElements: overflowingElements.slice(0, 10),
                    navInfo,
                    meshInfo,
                    arcInfo,
                    glassCardsCount
                };
            })()
            `,
            returnByValue: true
        });

        results.viewports[vp.name] = evalRes.result.value;
    }

    // Interaction Tests (Desktop Viewport)
    console.log(`\n=== Executing Interaction & Visual Stability Tests ===`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(1000);

    const interactionRes = await cdp.send('Runtime.evaluate', {
        expression: `
        (() => {
            const report = { steps: [] };

            // Step 1: Initial State Check
            const bal1 = document.getElementById('hero-mockup-balance-display')?.innerText;
            report.steps.push({ step: 'Initial Balance', value: bal1, pass: bal1 === 'R24,650' });

            // Step 2: Toggle Annual Period
            setHeroMockupPeriod('annual');
            const bal2 = document.getElementById('hero-mockup-balance-display')?.innerText;
            const line2 = document.getElementById('hero-chart-line')?.getAttribute('d');
            report.steps.push({ step: 'Annual Balance', value: bal2, linePath: line2, pass: bal2 === 'R295,800' });

            // Step 3: Toggle Monthly Period Back
            setHeroMockupPeriod('monthly');
            const bal3 = document.getElementById('hero-mockup-balance-display')?.innerText;
            report.steps.push({ step: 'Monthly Balance Back', value: bal3, pass: bal3 === 'R24,650' });

            // Step 4: Switch Tabs
            switchHeroMockupTab('revenue');
            const title1 = document.getElementById('hero-mockup-tab-title')?.innerText;
            report.steps.push({ step: 'Tab Revenue Title', value: title1, pass: title1 === 'Consolidated Revenue Streams' });

            switchHeroMockupTab('tax');
            const title2 = document.getElementById('hero-mockup-tab-title')?.innerText;
            report.steps.push({ step: 'Tab Tax Title', value: title2, pass: title2 === 'Tax Deduction & Savings Engine' });

            switchHeroMockupTab('overview');
            const title3 = document.getElementById('hero-mockup-tab-title')?.innerText;
            report.steps.push({ step: 'Tab Overview Title', value: title3, pass: title3 === 'Creator Cash Flow Command Center' });

            // Step 5: Toggle Arc Sidebar
            const sidebar = document.getElementById('arc-sidebar-preview');
            const initHidden = sidebar.classList.contains('hidden');
            toggleArcSidebar();
            const afterToggleHidden = sidebar.classList.contains('hidden');
            toggleArcSidebar();
            report.steps.push({ step: 'Sidebar Toggle', initHidden, afterToggleHidden, pass: initHidden !== afterToggleHidden });

            return report;
        })()
        `,
        returnByValue: true
    });

    results.interactionTests = interactionRes.result.value;

    // Check CSS Keyframe Rules & Performance
    const cssRes = await cdp.send('Runtime.evaluate', {
        expression: `
        (() => {
            const stylesheets = Array.from(document.styleSheets);
            let keyframeNames = [];
            stylesheets.forEach(ss => {
                try {
                    const rules = Array.from(ss.cssRules || []);
                    rules.forEach(r => {
                        if (r.type === CSSRule.KEYFRAMES_RULE) {
                            keyframeNames.push(r.name);
                        }
                    });
                } catch(e) {}
            });

            return {
                keyframeNames,
                emeraldOrbAnimated: !!document.querySelector('.ambient-orb-emerald'),
                tealOrbAnimated: !!document.querySelector('.ambient-orb-teal'),
                indigoOrbAnimated: !!document.querySelector('.ambient-orb-indigo')
            };
        })()
        `,
        returnByValue: true
    });

    results.cssPerformance = cssRes.result.value;
    results.consoleErrors = consoleLogs.filter(l => l.level === 'error').concat(pageErrors);

    console.log('\n================ EMPIRICAL TEST RESULTS ================');
    console.log(JSON.stringify(results, null, 2));

    await cdp.close();
    chromeProcess.kill();

    // Write raw test results to JSON file
    require('fs').writeFileSync(
        'c:\\Users\\User\\OneDrive\\Desktop\\New folder (2)\\.agents\\teamwork_preview_challenger_m1_1\\empirical_results.json',
        JSON.stringify(results, null, 2)
    );
}

runEmpiricalTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
