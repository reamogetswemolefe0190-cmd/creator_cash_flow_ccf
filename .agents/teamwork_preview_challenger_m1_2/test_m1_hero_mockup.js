const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM, ResourceLoader } = jsdom;

class NoFetchResourceLoader extends ResourceLoader {
    fetch(url, options) {
        return null;
    }
}

const htmlContent = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

console.log("=== EMPIRICAL JSDOM SUITE: M1 HERO MOCKUP CONTROLS ===");

let consoleErrors = [];
let consoleWarnings = [];

const dom = new JSDOM(htmlContent, {
    runScripts: "outside-only",
    resources: new NoFetchResourceLoader(),
    url: "http://localhost:3000/"
});

const window = dom.window;
const document = window.document;

// Polyfill window.matchMedia for JSDOM
window.matchMedia = window.matchMedia || function(query) {
    return {
        matches: false,
        media: query,
        onchange: null,
        addListener: function() {},
        removeListener: function() {},
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return false; }
    };
};

// Polyfill localStorage if needed
const localStorageStore = new Map();
window.localStorage = window.localStorage || {
    getItem(key) { return localStorageStore.get(key) || null; },
    setItem(key, val) { localStorageStore.set(key, String(val)); },
    removeItem(key) { localStorageStore.delete(key); },
    clear() { localStorageStore.clear(); }
};

// Capture errors
window.console.error = (...args) => {
    console.error("[JSDOM ERROR]", ...args);
    consoleErrors.push(args);
};

window.console.warn = (...args) => {
    console.warn("[JSDOM WARN]", ...args);
    consoleWarnings.push(args);
};

// Evaluate app.js script in window context synchronously
try {
    window.eval(jsContent);
    console.log("✓ app.js script evaluated successfully in JSDOM.");
} catch (err) {
    console.error("❌ Failed to evaluate app.js script:", err);
    process.exit(1);
}

// Trigger DOMContentLoaded
const event = new window.Event('DOMContentLoaded', {
    bubbles: true,
    cancelable: true
});
document.dispatchEvent(event);

console.log("✓ DOMContentLoaded dispatched in JSDOM.");

let passedCount = 0;
let failedCount = 0;

function assert(condition, name, details = '') {
    if (condition) {
        console.log(`✓ [PASS] ${name}`);
        passedCount++;
    } else {
        console.error(`❌ [FAIL] ${name} - ${details}`);
        failedCount++;
    }
}

// TEST 1: Period Toggle Functionality (setHeroMockupPeriod)
console.log("\n--- TEST 1: setHeroMockupPeriod ---");
window.setHeroMockupPeriod('annual');
let balance = document.getElementById('hero-mockup-balance-display').innerText;
let label = document.getElementById('hero-mockup-period-label').innerText;
assert(balance === 'R295,800', "Annual balance set to R295,800", `Got: ${balance}`);
assert(label === 'Net Profit (YTD 2026)', "Annual label set to Net Profit (YTD 2026)", `Got: ${label}`);

window.setHeroMockupPeriod('monthly');
balance = document.getElementById('hero-mockup-balance-display').innerText;
label = document.getElementById('hero-mockup-period-label').innerText;
assert(balance === 'R24,650', "Monthly balance set to R24,650", `Got: ${balance}`);
assert(label === 'Net Profit (July)', "Monthly label set to Net Profit (July)", `Got: ${label}`);

// TEST 2: Rapid Button Clicks / Toggle Stress
console.log("\n--- TEST 2: Rapid Period Toggling (100x) ---");
let rapidSuccess = true;
try {
    for (let i = 0; i < 100; i++) {
        const period = (i % 2 === 0) ? 'annual' : 'monthly';
        window.setHeroMockupPeriod(period);
    }
} catch (e) {
    rapidSuccess = false;
}
assert(rapidSuccess, "Rapid period toggle 100x completed without exception");

// TEST 3: Invalid Period Inputs
console.log("\n--- TEST 3: Invalid Period Arguments ---");
let invalidPass = true;
try {
    window.setHeroMockupPeriod('invalid_period');
    window.setHeroMockupPeriod(null);
    window.setHeroMockupPeriod(undefined);
} catch (e) {
    invalidPass = false;
}
assert(invalidPass, "Invalid period parameters handled gracefully");

// TEST 4: Tab Switching (switchHeroMockupTab)
console.log("\n--- TEST 4: switchHeroMockupTab ---");
['overview', 'revenue', 'tax'].forEach(tab => {
    window.switchHeroMockupTab(tab);
    const title = document.getElementById('hero-mockup-tab-title').innerText;
    const activeBtn = document.querySelector(`.arc-tab-btn[data-tab="${tab}"]`);
    assert(activeBtn && activeBtn.classList.contains('active'), `Tab '${tab}' active class set on button`);
});

// TEST 5: Sidebar Toggle
console.log("\n--- TEST 5: toggleArcSidebar ---");
const sidebar = document.getElementById('arc-sidebar-preview');
const initialHidden = sidebar.classList.contains('hidden');
window.toggleArcSidebar();
const toggledHidden = sidebar.classList.contains('hidden');
window.toggleArcSidebar();
const restoredHidden = sidebar.classList.contains('hidden');
assert(initialHidden !== toggledHidden && initialHidden === restoredHidden, "Sidebar toggle state toggles 'hidden' class correctly");

// TEST 6: 3D Tilt Tracking Mouse Events
console.log("\n--- TEST 6: 3D Tilt Tracking Mouse Events ---");
const wrapper = document.getElementById('arc-hero-wrapper');
const frame = document.getElementById('arc-browser-frame');

if (wrapper && frame) {
    wrapper.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 500,
        right: 900,
        bottom: 600
    });

    frame.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

    const mouseMoveEvent = new window.MouseEvent('mousemove', {
        clientX: 300,
        clientY: 200,
        bubbles: true
    });
    wrapper.dispatchEvent(mouseMoveEvent);
    assert(frame.style.transform.includes('rotateX') && frame.style.transform.includes('rotateY'), "MouseMove calculates 3D rotate transform", `Got: ${frame.style.transform}`);

    const mouseLeaveEvent = new window.MouseEvent('mouseleave', { bubbles: true });
    wrapper.dispatchEvent(mouseLeaveEvent);
    assert(frame.style.transform === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "MouseLeave resets 3D transform to 0deg", `Got: ${frame.style.transform}`);
}

// TEST 7: Mobile Viewport 3D Tilt Guard
console.log("\n--- TEST 7: Mobile Viewport 3D Tilt Guard ---");
frame.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });

const mouseMoveMobile = new window.MouseEvent('mousemove', {
    clientX: 300,
    clientY: 200,
    bubbles: true
});
wrapper.dispatchEvent(mouseMoveMobile);
assert(frame.style.transform === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "3D tilt skipped on mobile viewports (<640px)", `Got: ${frame.style.transform}`);

// TEST 8: Zero Console Errors
assert(consoleErrors.length === 0, "Zero console errors logged during JSDOM execution");

console.log("\n================ SUMMARY ================");
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);
console.log("=========================================");

if (failedCount > 0) process.exit(1);
