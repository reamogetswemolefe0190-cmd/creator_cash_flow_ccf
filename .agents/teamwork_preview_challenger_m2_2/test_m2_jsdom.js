const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('=== JSDOM EMPIRICAL BROWSER SUITE FOR CCF MILESTONE M2 ===');

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

async function runJsdomTests() {
    const htmlPath = path.join(__dirname, '../../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Create JSDOM instance with index.html
    const dom = new JSDOM(htmlContent, {
        runScripts: "dangerously",
        resources: "usable",
        url: "http://localhost:3000"
    });

    const { window } = dom;
    const { document } = window;

    // Attach fetch mock to JSDOM window
    window.fetch = async (url, opts) => {
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
        return { json: async () => ({ success: true }) };
    };

    // Stub HTMLCanvasElement getContext
    window.HTMLCanvasElement.prototype.getContext = function() {
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
    };

    // Attach local storage mock
    const store = {};
    window.localStorage = {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        clear: () => { for (const k in store) delete store[k]; }
    };

    // Load app.js code into window context and expose top-level variables onto window
    const appJsPath = path.join(__dirname, '../../app.js');
    let appJsCode = fs.readFileSync(appJsPath, 'utf8');
    appJsCode += '\n window.onboardingState = onboardingState; window.state = state;';

    // Track uncaught ReferenceError exceptions
    let uncaughtErrors = [];
    window.addEventListener('error', (e) => {
        uncaughtErrors.push(e.error || e.message);
    });

    // Execute app.js in JSDOM window scope
    window.eval(appJsCode);

    // Initialize state token
    window.state.token = 'demo_token';

    console.log('\n--- 1. Testing Defensive Phyllo Guard when PhylloConnect is missing ---');
    assert(typeof window.PhylloConnect === 'undefined', 'window.PhylloConnect is undefined initially');

    // Go to step 5 in wizard
    window.nextOnboardStep(5);

    const connectList = document.getElementById('onboarding-connect-list');
    assert(connectList !== null, '#onboarding-connect-list exists in DOM');

    const ytCard = connectList.querySelector('.connection-platform-card');
    assert(ytCard !== null, 'YouTube connection platform card rendered in DOM');

    const ytBadge = document.getElementById('connect-YouTube');
    assert(ytBadge !== null, '#connect-YouTube badge element exists');

    // Trigger click on YouTube card
    ytCard.click();

    assert(ytBadge.innerText === 'Linking...', 'Clicking card updates badge text to Linking...');

    // Wait 500ms for fallback setTimeout
    await new Promise(r => setTimeout(r, 500));

    assert(ytCard.classList.contains('connected'), 'YouTube card gains .connected class via fallbackToMockConnect');
    assert(ytBadge.innerText === 'Connected', 'YouTube badge text changes to Connected');
    assert(window.eval('onboardingState.connected').includes('YouTube'), 'onboardingState.connected contains YouTube');

    const referenceErrors = uncaughtErrors.filter(err => String(err).includes('ReferenceError'));
    assert(referenceErrors.length === 0, `Zero ReferenceError console exceptions logged (Found: ${referenceErrors.length})`);

    console.log('\n--- 2. Testing Defensive Phyllo exception handling when PhylloConnect.initialize throws ---');
    window.PhylloConnect = {
        initialize: () => {
            throw new Error('SDK Crash Simulation');
        }
    };

    const ttCard = Array.from(connectList.querySelectorAll('.connection-platform-card')).find(c => c.innerHTML.includes('TikTok'));
    
    if (ttCard) {
        ttCard.click();
        await new Promise(r => setTimeout(r, 300));
        assert(ttCard.classList.contains('connected'), 'TikTok card connected via catch block fallback');
        assert(window.eval('onboardingState.connected').includes('TikTok'), 'TikTok added to connected platforms list');
    } else {
        assert(false, 'TikTok platform card not found in connect list');
    }

    delete window.PhylloConnect;

    console.log('\n--- 3. Testing Manual Skip Bypass Link Execution ---');
    const skipBtn = document.querySelector('button[onclick*="skipOnboardingConnection"]');
    assert(skipBtn !== null, 'Manual skip bypass button ("Skip & Enter Data Manually →") exists in DOM');

    let preventDefaultCalled = false;
    const mockEvt = { preventDefault: () => { preventDefaultCalled = true; } };
    window.skipOnboardingConnection(mockEvt);

    assert(preventDefaultCalled === true, 'skipOnboardingConnection prevents default link navigation');
    assert(window.eval('onboardingState.isManual') === true, 'skipOnboardingConnection sets onboardingState.isManual = true');

    const step6El = document.getElementById('onboard-step-6');
    assert(step6El && !step6El.classList.contains('hidden'), 'Wizard successfully advanced to Step 6 (unhidden)');

    console.log('\n--- 4. Testing Launch Pulse Spring Transition Animation ---');
    const wizardCard = document.querySelector('#view-onboarding .w-full.max-w-xl');
    const launchBtn = document.getElementById('btn-launch-command-center');
    
    assert(wizardCard !== null, 'Onboarding wizard card element exists in DOM');
    assert(launchBtn !== null, '#btn-launch-command-center button exists in DOM');

    window.executeLaunchSequence();

    assert(wizardCard.classList.contains('launching-pulse'), 'wizardCard has .launching-pulse class applied during launch sequence');
    assert(launchBtn.innerText === 'Launching Command Center...', 'Launch button text set to "Launching Command Center..."');
    assert(launchBtn.disabled === true, 'Launch button disabled attribute is set');

    await new Promise(r => setTimeout(r, 1150));

    assert(!wizardCard.classList.contains('launching-pulse'), '.launching-pulse class removed after 1.1s duration');
    assert(launchBtn.innerText === 'Launch Command Center', 'Launch button text restored');
    assert(launchBtn.disabled === false, 'Launch button enabled again');

    const viewApp = document.getElementById('view-app');
    assert(viewApp && !viewApp.classList.contains('hidden'), 'View switched to #view-app Command Center');

    console.log('\n--- 5. Testing Onboarding Payload Persistence to LocalStorage ---');
    const stored = window.localStorage.getItem('creator_cashflow_onboarding');
    assert(stored !== null, 'onboardingState retained in localStorage under key creator_cashflow_onboarding');
    
    const parsed = JSON.parse(stored);
    assert(parsed.isManual === true, 'localStorage payload contains isManual: true');
    assert(Array.isArray(parsed.connected), 'localStorage payload contains connected platforms array');

    console.log(`\n==================================================`);
    console.log(`JSDOM TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
    console.log(`==================================================\n`);

    if (testsFailed > 0) process.exit(1);
    else process.exit(0);
}

runJsdomTests().catch(err => {
    console.error('JSDOM test error:', err);
    process.exit(1);
});
