const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('=== CCF MILESTONE M2 EMPIRICAL VERIFICATION HARNESS ===');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ PASS: ${message}`);
        testsPassed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        testsFailed++;
    }
}

// --------------------------------------------------------------------------
// TEST LAYER 1: BACKEND SERVER API (/api/onboarding/save)
// --------------------------------------------------------------------------
async function testBackendAPI() {
    console.log('\n--- TEST LAYER 1: Backend REST API (/api/onboarding/save) ---');
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            creatorType: 'YouTube Creator',
            platforms: ['YouTube', 'TikTok'],
            goal: 'Track Revenue',
            connected: ['YouTube'],
            isManual: false
        });

        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/onboarding/save',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer demo_token`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    assert(res.statusCode === 200, `POST /api/onboarding/save returned status 200 (Got ${res.statusCode})`);
                    assert(json.success === true, `Response success is true: ${json.message}`);
                } catch (e) {
                    assert(false, `Failed to parse response JSON: ${e.message}`);
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            assert(false, `HTTP connection to live server on 5000 failed: ${err.message}`);
            resolve();
        });

        req.write(postData);
        req.end();
    });
}

// --------------------------------------------------------------------------
// TEST LAYER 2: FRONTEND LOGIC & PHYLLO / LAUNCH / PERSISTENCE HARNESS
// --------------------------------------------------------------------------
async function testFrontendLogic() {
    console.log('\n--- TEST LAYER 2: Frontend Logic (Phyllo Guard, Manual Skip, Launch Animation, Persistence) ---');

    class FakeClassList {
        constructor() { this.classes = new Set(); }
        add(...c) { c.forEach(x => this.classes.add(x)); }
        remove(...c) { c.forEach(x => this.classes.delete(x)); }
        toggle(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
        contains(c) { return this.classes.has(c); }
    }

    class FakeElement {
        constructor(id = '', tag = 'div') {
            this.id = id;
            this.tagName = tag.toUpperCase();
            this.classList = new FakeClassList();
            this.children = [];
            this.attributes = {};
            this.style = {};
            this.innerText = '';
            this.innerHTML = '';
            this.disabled = false;
            this.onclick = null;
            this.listeners = {};
        }
        setAttribute(k, v) { this.attributes[k] = v; }
        getAttribute(k) { return this.attributes[k] || null; }
        appendChild(child) { this.children.push(child); return child; }
        querySelector(selector) {
            if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                return this.children.find(c => c.classList.contains(cls)) || null;
            }
            return this.children[0] || null;
        }
        querySelectorAll(selector) {
            return this.children;
        }
        addEventListener(event, fn) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(fn);
        }
        getContext(ctx) {
            return {
                createLinearGradient: () => ({ addColorStop: () => {} }),
                fillRect: () => {},
                clearRect: () => {},
                getImageData: () => ({ data: [0,0,0,0] }),
                putImageData: () => {},
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                fillText: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                translate: () => {},
                scale: () => {},
                rotate: () => {},
                arc: () => {},
                fill: () => {},
                measureText: () => ({ width: 0 }),
                transform: () => {},
                rect: () => {},
                clip: () => {}
            };
        }
    }

    const elements = {};
    const getEl = (id) => {
        if (!elements[id]) elements[id] = new FakeElement(id, id === 'revenueChart' ? 'canvas' : 'div');
        return elements[id];
    };

    const mockLocalStorage = (() => {
        let store = {};
        return {
            getItem: (key) => store[key] || null,
            setItem: (key, val) => { store[key] = String(val); },
            clear: () => { store = {}; }
        };
    })();

    global.window = global;
    global.localStorage = mockLocalStorage;
    global.API_BASE_URL = 'http://localhost:5000/api';
    global.document = {
        getElementById: (id) => getEl(id),
        querySelector: (selector) => {
            if (selector.includes('view-onboarding')) return getEl('wizard-card');
            if (selector.includes('header')) return getEl('header');
            return getEl('default-node');
        },
        querySelectorAll: (selector) => {
            return [getEl('choice-1'), getEl('choice-2')];
        },
        createElement: (tag) => new FakeElement('', tag),
        addEventListener: (event, fn) => {},
        body: new FakeElement('body')
    };

    global.Chart = function() {
        return { destroy: () => {}, update: () => {} };
    };

    global.fetch = async (url, opts) => {
        if (url.includes('/integrations/phyllo/token')) {
            return {
                json: async () => ({
                    sdkToken: 'phyllo_mock_sdk_token_999',
                    phylloUserId: 'phyllo_user_123',
                    platforms: { youtube: 'work_platform_yt_001' }
                })
            };
        }
        if (url.includes('/onboarding/save')) {
            return {
                json: async () => ({ success: true, message: 'Onboarding responses saved successfully.' })
            };
        }
        return { json: async () => ({ success: true, transactions: [] }) };
    };

    const appJsPath = path.join(__dirname, '../../app.js');
    let appJsCode = fs.readFileSync(appJsPath, 'utf8');
    appJsCode += '\n global.onboardingState = onboardingState; global.state = state;';
    eval(appJsCode);

    global.state.token = 'demo_token';

    // ----------------------------------------------------------------------
    // Test 2.1: Defensive Phyllo Script Missing State (Zero ReferenceError)
    // ----------------------------------------------------------------------
    console.log('\nSub-Test 2.1: Defensive Phyllo script missing state (typeof PhylloConnect === "undefined")');
    delete global.PhylloConnect;

    assert(typeof PhylloConnect === 'undefined', 'PhylloConnect is undefined in global scope');

    const card = new FakeElement('card-yt');
    const badge = new FakeElement('connect-YouTube');
    elements['connect-YouTube'] = badge;

    let consoleWarningLogged = false;
    const origWarn = console.warn;
    console.warn = (...args) => {
        if (args[0] && args[0].includes('[PHYLLO]')) consoleWarningLogged = true;
        origWarn(...args);
    };

    let referenceErrorThrown = false;
    try {
        simulatePlatformConnect(card, 'YouTube');
    } catch (e) {
        if (e instanceof ReferenceError) referenceErrorThrown = true;
    }

    assert(!referenceErrorThrown, 'Calling simulatePlatformConnect when PhylloConnect is undefined throws ZERO ReferenceError exceptions');
    assert(badge.innerText === 'Linking...', 'Badge status initially updated to Linking...');
    assert(consoleWarningLogged, 'Console logs clear warning indicating fallback to mock connection');

    await new Promise(r => setTimeout(r, 450));

    assert(card.classList.contains('connected'), 'Card element gains .connected class via fallbackToMockConnect');
    assert(badge.innerText === 'Connected', 'Badge text updated to Connected');
    assert(onboardingState.connected.includes('YouTube'), 'onboardingState.connected includes YouTube');

    console.warn = origWarn;

    // ----------------------------------------------------------------------
    // Test 2.2: Defensive Phyllo Exception Handling (catch block execution)
    // ----------------------------------------------------------------------
    console.log('\nSub-Test 2.2: Defensive Phyllo Exception Handling (PhylloConnect.initialize throws)');

    global.PhylloConnect = {
        initialize: () => {
            throw new Error('Simulated Phyllo SDK runtime crash');
        }
    };

    const card2 = new FakeElement('card-tiktok');
    const badge2 = new FakeElement('connect-TikTok');
    elements['connect-TikTok'] = badge2;

    let caughtExceptionNoCrash = true;
    try {
        simulatePlatformConnect(card2, 'TikTok');
    } catch (e) {
        caughtExceptionNoCrash = false;
    }

    assert(caughtExceptionNoCrash, 'simulatePlatformConnect cleanly catches Phyllo SDK initialization exceptions');
    
    await new Promise(r => setTimeout(r, 100));

    assert(card2.classList.contains('connected'), 'Fallback to mock connect successfully marks TikTok card as connected');
    assert(onboardingState.connected.includes('TikTok'), 'TikTok added to onboardingState.connected after exception catch');

    delete global.PhylloConnect;

    // ----------------------------------------------------------------------
    // Test 2.3: Manual Skip Bypass Link Execution
    // ----------------------------------------------------------------------
    console.log('\nSub-Test 2.3: Manual Skip Bypass Link Execution');

    let preventDefaultCalled = false;
    const mockEvent = { preventDefault: () => { preventDefaultCalled = true; } };

    skipOnboardingConnection(mockEvent);

    assert(preventDefaultCalled, 'skipOnboardingConnection calls e.preventDefault()');
    assert(onboardingState.isManual === true, 'skipOnboardingConnection sets onboardingState.isManual to true');
    assert(onboardingState.currentStep === 6, 'skipOnboardingConnection advances wizard to Step 6');

    // ----------------------------------------------------------------------
    // Test 2.4: Launch Pulse Spring Transition Animation
    // ----------------------------------------------------------------------
    console.log('\nSub-Test 2.4: Launch Pulse Spring Transition Animation');

    const wizardCard = getEl('wizard-card');
    const launchBtn = getEl('btn-launch-command-center');

    executeLaunchSequence();

    assert(wizardCard.classList.contains('launching-pulse'), 'executeLaunchSequence adds launching-pulse CSS class to wizard card');
    assert(launchBtn.innerText === 'Launching Command Center...', 'Launch button text changes to "Launching Command Center..."');
    assert(launchBtn.disabled === true, 'Launch button disabled state is set to true');

    await new Promise(r => setTimeout(r, 1150));

    assert(!wizardCard.classList.contains('launching-pulse'), 'After 1.1s delay, launching-pulse class is removed from card');
    assert(launchBtn.innerText === 'Launch Command Center', 'Launch button text restored to "Launch Command Center"');
    assert(launchBtn.disabled === false, 'Launch button disabled state restored to false');

    // ----------------------------------------------------------------------
    // Test 2.5: Onboarding Payload Persistence (localStorage & POST /api/onboarding/save)
    // ----------------------------------------------------------------------
    console.log('\nSub-Test 2.5: Onboarding Payload Persistence to LocalStorage & API');

    onboardingState.creatorType = 'YouTube Creator';
    onboardingState.platforms = ['YouTube', 'TikTok'];
    onboardingState.goal = 'Track Revenue';
    onboardingState.connected = ['YouTube'];
    onboardingState.isManual = true;

    await triggerMagicMoment();

    const storedData = localStorage.getItem('creator_cashflow_onboarding');
    assert(storedData !== null, 'onboardingState synchronously saved to localStorage key creator_cashflow_onboarding');

    const parsedData = JSON.parse(storedData);
    assert(parsedData.creatorType === 'YouTube Creator', 'Saved localStorage creatorType matches state');
    assert(parsedData.goal === 'Track Revenue', 'Saved localStorage goal matches state');
    assert(parsedData.isManual === true, 'Saved localStorage isManual matches state');
}

// Run test suite
(async () => {
    try {
        await testBackendAPI();
        await testFrontendLogic();
        
        console.log(`\n==================================================`);
        console.log(`TOTAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
        console.log(`==================================================\n`);

        if (testsFailed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (e) {
        console.error('Test runner exception:', e);
        process.exit(1);
    }
})();
