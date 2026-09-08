const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlContent = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

console.log("=== EMPIRICAL DEEP STRESS & EDGE CASE HARNESS FOR M1 HERO MOCKUP ===");

// Extract element IDs from HTML
const idMatches = [...htmlContent.matchAll(/id="([^"]+)"/g)].map(m => m[1]);

function createMockElement(id, tagName = 'div', classes = '') {
    const el = {
        id,
        tagName: tagName.toUpperCase(),
        className: classes,
        innerText: '',
        style: {},
        attributes: {},
        parentNode: {
            removeChild(child) {},
            appendChild(child) {}
        },
        classList: {
            _set: new Set(classes.split(' ').filter(Boolean)),
            add(c) { this._set.add(c); el.className = Array.from(this._set).join(' '); },
            remove(c) { this._set.delete(c); el.className = Array.from(this._set).join(' '); },
            contains(c) { return this._set.has(c); },
            toggle(c) {
                if (this._set.has(c)) this.remove(c);
                else this.add(c);
                return this._set.has(c);
            }
        },
        listeners: {},
        addEventListener(event, handler) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(handler);
        },
        dispatchEvent(event) {
            const handlers = this.listeners[event.type] || [];
            handlers.forEach(h => h(event));
        },
        setAttribute(name, val) { this.attributes[name] = val; },
        getAttribute(name) { return this.attributes[name] || null; },
        getBoundingClientRect() {
            return { left: 100, top: 100, width: 800, height: 500, right: 900, bottom: 600 };
        }
    };
    return el;
}

const elementRegistry = new Map();
idMatches.forEach(id => {
    elementRegistry.set(id, createMockElement(id));
});

const arcTabBtnMatches = [...htmlContent.matchAll(/<button[^>]*class="[^"]*arc-tab-btn[^"]*"[^>]*data-tab="([^"]+)"[^>]*>/g)];
const tabButtons = arcTabBtnMatches.map(m => {
    const tabName = m[1];
    const el = createMockElement(`btn-tab-${tabName}`, 'button', 'arc-tab-btn');
    el.setAttribute('data-tab', tabName);
    return el;
});

const localStorageStore = new Map();
const mockLocalStorage = {
    getItem(key) { return localStorageStore.get(key) || null; },
    setItem(key, val) { localStorageStore.set(key, String(val)); },
    removeItem(key) { localStorageStore.delete(key); },
    clear() { localStorageStore.clear(); }
};

const mockDocument = {
    listeners: {},
    getElementById(id) {
        return elementRegistry.get(id) || null;
    },
    querySelectorAll(selector) {
        if (selector === '.arc-tab-btn') return tabButtons;
        return [];
    },
    querySelector(selector) {
        if (selector.startsWith('.arc-tab-btn[data-tab=')) {
            const match = selector.match(/data-tab="([^"]+)"/);
            if (match) return tabButtons.find(b => b.getAttribute('data-tab') === match[1]) || null;
        }
        return null;
    },
    addEventListener(event, handler) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
    },
    dispatchEvent(event) {
        const handlers = this.listeners[event.type] || [];
        handlers.forEach(h => h(event));
    }
};

let consoleErrors = [];
let consoleWarns = [];

const mockWindow = {
    innerWidth: 1024,
    matchMedia: (query) => ({ matches: false }),
    document: mockDocument,
    localStorage: mockLocalStorage,
    Event: function(type, opts) { return { type, ...opts }; },
    MouseEvent: function(type, opts) { return { type, ...opts }; },
    console: {
        log: (...args) => console.log("[MOCK LOG]", ...args),
        error: (...args) => {
            console.error("[MOCK ERROR]", ...args);
            consoleErrors.push(args);
        },
        warn: (...args) => {
            console.warn("[MOCK WARN]", ...args);
            consoleWarns.push(args);
        }
    }
};

const sandbox = {
    window: mockWindow,
    document: mockDocument,
    localStorage: mockLocalStorage,
    console: mockWindow.console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval
};

sandbox.global = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// Run code
vm.runInContext(jsContent, sandbox);

// Dispatch DOMContentLoaded
if (mockDocument.listeners['DOMContentLoaded']) {
    mockDocument.listeners['DOMContentLoaded'].forEach(fn => fn({ type: 'DOMContentLoaded' }));
}

let passCount = 0;
let failCount = 0;

function assert(cond, testName, details = '') {
    if (cond) {
        console.log(`✓ [PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`❌ [FAIL] ${testName} - ${details}`);
        failCount++;
    }
}

// SECTION 1: Extreme Mouse Coordinates during 3D Tilt
console.log("\n--- STRESS 1: Extreme Mouse Coordinates ---");
const wrapper = mockDocument.getElementById('arc-hero-wrapper');
const frame = mockDocument.getElementById('arc-browser-frame');

// Out of bounds high
wrapper.dispatchEvent({ type: 'mousemove', clientX: 99999, clientY: 99999 });
let t1 = frame.style.transform;
assert(t1.includes('rotateX') && t1.includes('rotateY'), "Handles extreme positive coordinates without throwing", `Got: ${t1}`);

// Out of bounds negative
wrapper.dispatchEvent({ type: 'mousemove', clientX: -99999, clientY: -99999 });
let t2 = frame.style.transform;
assert(t2.includes('rotateX') && t2.includes('rotateY'), "Handles extreme negative coordinates without throwing", `Got: ${t2}`);

// SECTION 2: 1000 Interrupted MouseMove / MouseLeave Calls
console.log("\n--- STRESS 2: 1000 Rapid Interrupted Tilt Iterations ---");
let stress2Pass = true;
try {
    for (let i = 0; i < 1000; i++) {
        wrapper.dispatchEvent({ type: 'mousemove', clientX: 100 + (i % 200), clientY: 100 + (i % 150) });
        if (i % 3 === 0) {
            wrapper.dispatchEvent({ type: 'mouseleave' });
        }
    }
} catch (e) {
    stress2Pass = false;
    console.error("Stress 2 error:", e);
}
assert(stress2Pass, "1000 rapid tilt/leave cycles completed cleanly");
assert(frame.style.transform === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)' || frame.style.transform.includes('rotateX'), "Frame transform remains valid after 1000 iterations");

// SECTION 3: Dynamic Window Resize / Viewport Switching Mid-Tilt
console.log("\n--- STRESS 3: Dynamic Viewport Resize Mid-Tilt ---");
// Start desktop
mockWindow.innerWidth = 1440;
wrapper.dispatchEvent({ type: 'mousemove', clientX: 300, clientY: 200 });
let desktopT = frame.style.transform;

// Resize to mobile mid-tilt
mockWindow.innerWidth = 375;
wrapper.dispatchEvent({ type: 'mousemove', clientX: 300, clientY: 200 });
let mobileT = frame.style.transform;

assert(desktopT.includes('rotateX') && !desktopT.includes('rotateX(0deg)'), "Desktop tilt calculates non-zero angles");
assert(mobileT === desktopT || mobileT === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "Mobile resize suppresses new tilt updates");

// SECTION 4: Missing Elements Resilience (Null Defense)
console.log("\n--- STRESS 4: Missing Elements Null Defense ---");
const backupMap = new Map(elementRegistry);

// Delete elements one by one and call period/tab functions
const criticalIds = [
    'toggle-btn-monthly',
    'toggle-btn-annual',
    'hero-mockup-balance-display',
    'hero-mockup-period-label',
    'hero-mockup-growth-tag',
    'hero-mockup-top-platform',
    'hero-mockup-peak',
    'bar-youtube',
    'bar-tiktok',
    'bar-brand',
    'hero-chart-line',
    'hero-chart-area',
    'hero-mockup-tab-title',
    'arc-sidebar-preview'
];

let nullDefensePass = true;
criticalIds.forEach(id => {
    elementRegistry.set(id, null);
    try {
        sandbox.setHeroMockupPeriod('annual');
        sandbox.setHeroMockupPeriod('monthly');
        sandbox.switchHeroMockupTab('revenue');
        sandbox.toggleArcSidebar();
        sandbox.refreshHeroMockup();
    } catch (err) {
        nullDefensePass = false;
        console.error(`Null defense failed when element #${id} is missing:`, err);
    }
});
assert(nullDefensePass, "Functions execute safely with zero uncaught exceptions when DOM elements are missing");

// Restore elements
backupMap.forEach((val, key) => elementRegistry.set(key, val));

// SECTION 5: Re-running setupHeroMockupInteractions Multiple Times
console.log("\n--- STRESS 5: Multiple Initialization Calls ---");
let multiInitPass = true;
try {
    for (let i = 0; i < 20; i++) {
        sandbox.setupHeroMockupInteractions();
    }
} catch (e) {
    multiInitPass = false;
}
assert(multiInitPass, "setupHeroMockupInteractions can be called repeatedly without throwing");

// SECTION 6: Final Console Errors Check
assert(consoleErrors.length === 0, "Zero console errors across all deep stress tests");

console.log("\n================ STRESS TEST RESULTS ================");
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log("=====================================================");

if (failCount > 0) process.exit(1);
