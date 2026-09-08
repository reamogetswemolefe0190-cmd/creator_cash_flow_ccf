const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlContent = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');

console.log("=== EMPIRICAL TEST SUITE: PURE NODE.JS DOM HARNESS FOR M1 HERO MOCKUP ===");

// 1. Parse IDs from index.html
const idMatches = [...htmlContent.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
console.log(`Found ${idMatches.length} DOM element IDs in index.html.`);

// Create mock element factory
function createMockElement(id, tagName = 'div', classes = '') {
    const el = {
        id,
        tagName: tagName.toUpperCase(),
        className: classes,
        innerText: '',
        style: {},
        attributes: {},
        parentNode: {
            removeChild(child) {
                // mock remove
            },
            appendChild(child) {
                // mock append
            }
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
        setAttribute(name, val) {
            this.attributes[name] = val;
        },
        getAttribute(name) {
            return this.attributes[name] || null;
        },
        getBoundingClientRect() {
            return { left: 50, top: 50, width: 800, height: 600, right: 850, bottom: 650 };
        }
    };
    return el;
}

// Map of elements
const elementRegistry = new Map();
idMatches.forEach(id => {
    elementRegistry.set(id, createMockElement(id));
});

// Also parse elements with class arc-tab-btn
const arcTabBtnMatches = [...htmlContent.matchAll(/<button[^>]*class="[^"]*arc-tab-btn[^"]*"[^>]*data-tab="([^"]+)"[^>]*>/g)];
const tabButtons = arcTabBtnMatches.map(m => {
    const tabName = m[1];
    const el = createMockElement(`btn-tab-${tabName}`, 'button', 'arc-tab-btn');
    el.setAttribute('data-tab', tabName);
    return el;
});

// Mock LocalStorage
const localStorageStore = new Map();
const mockLocalStorage = {
    getItem(key) { return localStorageStore.get(key) || null; },
    setItem(key, val) { localStorageStore.set(key, String(val)); },
    removeItem(key) { localStorageStore.delete(key); },
    clear() { localStorageStore.clear(); }
};

// Build Document & Window Mocks
const mockDocument = {
    listeners: {},
    getElementById(id) {
        return elementRegistry.get(id) || null;
    },
    querySelectorAll(selector) {
        if (selector === '.arc-tab-btn') {
            return tabButtons;
        }
        return [];
    },
    querySelector(selector) {
        if (selector.startsWith('.arc-tab-btn[data-tab=')) {
            const match = selector.match(/data-tab="([^"]+)"/);
            if (match) {
                return tabButtons.find(b => b.getAttribute('data-tab') === match[1]) || null;
            }
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

let capturedConsoleErrors = [];
let capturedConsoleWarns = [];

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
            capturedConsoleErrors.push(args);
        },
        warn: (...args) => {
            console.warn("[MOCK WARN]", ...args);
            capturedConsoleWarns.push(args);
        }
    }
};

// Create Context
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

// Bind top-level window props to global sandbox
sandbox.global = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);

// Execute app.js in sandbox
try {
    vm.runInContext(jsContent, sandbox);
    console.log("✓ app.js compiled and executed cleanly in sandbox.");
} catch (err) {
    console.error("❌ Exception executing app.js in sandbox:", err);
    process.exit(1);
}

// Dispatch DOMContentLoaded
const domLoadedEvent = { type: 'DOMContentLoaded' };
if (mockDocument.listeners['DOMContentLoaded']) {
    mockDocument.listeners['DOMContentLoaded'].forEach(fn => fn(domLoadedEvent));
    console.log("✓ DOMContentLoaded listeners executed.");
}

// TEST CASES
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, name, details = '') {
    if (condition) {
        console.log(`[PASS] ${name}`);
        testsPassed++;
    } else {
        console.error(`[FAIL] ${name} ${details}`);
        testsFailed++;
    }
}

// 1. setHeroMockupPeriod('annual')
sandbox.setHeroMockupPeriod('annual');
const balanceAnnual = mockDocument.getElementById('hero-mockup-balance-display').innerText;
const labelAnnual = mockDocument.getElementById('hero-mockup-period-label').innerText;
assert(balanceAnnual === 'R295,800', "setHeroMockupPeriod('annual') updates balance display to R295,800", `Got: ${balanceAnnual}`);
assert(labelAnnual === 'Net Profit (YTD 2026)', "setHeroMockupPeriod('annual') updates period label", `Got: ${labelAnnual}`);

// 2. setHeroMockupPeriod('monthly')
sandbox.setHeroMockupPeriod('monthly');
const balanceMonthly = mockDocument.getElementById('hero-mockup-balance-display').innerText;
const labelMonthly = mockDocument.getElementById('hero-mockup-period-label').innerText;
assert(balanceMonthly === 'R24,650', "setHeroMockupPeriod('monthly') updates balance display to R24,650", `Got: ${balanceMonthly}`);
assert(labelMonthly === 'Net Profit (July)', "setHeroMockupPeriod('monthly') updates period label", `Got: ${labelMonthly}`);

// 3. SVG line and area path updates
const linePath = mockDocument.getElementById('hero-chart-line').attributes['d'];
const areaPath = mockDocument.getElementById('hero-chart-area').attributes['d'];
assert(linePath === 'M 0,50 Q 50,45 100,30 T 200,20 T 300,5', "setHeroMockupPeriod('monthly') updates SVG line chart d attribute");
assert(areaPath === 'M 0,50 Q 50,45 100,30 T 200,20 T 300,5 L 300,60 L 0,60 Z', "setHeroMockupPeriod('monthly') updates SVG area chart d attribute");

// 4. Bar widths
const barYT = mockDocument.getElementById('bar-youtube').style.width;
assert(barYT === '74%', "setHeroMockupPeriod('monthly') updates YouTube bar width to 74%", `Got: ${barYT}`);

// 5. Rapid toggle stress test (500 iterations)
let rapidSuccess = true;
try {
    for (let i = 0; i < 500; i++) {
        sandbox.setHeroMockupPeriod(i % 2 === 0 ? 'annual' : 'monthly');
    }
} catch (e) {
    rapidSuccess = false;
}
assert(rapidSuccess, "Rapid toggle stress test (500x) executed without error");

// 6. switchHeroMockupTab
sandbox.switchHeroMockupTab('revenue');
const titleRevenue = mockDocument.getElementById('hero-mockup-tab-title').innerText;
assert(titleRevenue === 'Consolidated Revenue Streams', "switchHeroMockupTab('revenue') updates title", `Got: ${titleRevenue}`);

sandbox.switchHeroMockupTab('tax');
const titleTax = mockDocument.getElementById('hero-mockup-tab-title').innerText;
assert(titleTax === 'Tax Deduction & Savings Engine', "switchHeroMockupTab('tax') updates title", `Got: ${titleTax}`);

sandbox.switchHeroMockupTab('overview');
const titleOverview = mockDocument.getElementById('hero-mockup-tab-title').innerText;
assert(titleOverview === 'Creator Cash Flow Command Center', "switchHeroMockupTab('overview') updates title", `Got: ${titleOverview}`);

// 7. toggleArcSidebar
const sidebar = mockDocument.getElementById('arc-sidebar-preview');
const wasHidden = sidebar.classList.contains('hidden');
sandbox.toggleArcSidebar();
const nowHidden = sidebar.classList.contains('hidden');
assert(wasHidden !== nowHidden, "toggleArcSidebar toggles 'hidden' class on sidebar element");

// 8. 3D Tilt Event Handlers
const wrapper = mockDocument.getElementById('arc-hero-wrapper');
const frame = mockDocument.getElementById('arc-browser-frame');
assert(wrapper.listeners['mousemove'] && wrapper.listeners['mousemove'].length > 0, "MouseMove listener registered on arc-hero-wrapper");
assert(wrapper.listeners['mouseleave'] && wrapper.listeners['mouseleave'].length > 0, "MouseLeave listener registered on arc-hero-wrapper");

// Trigger mousemove
wrapper.dispatchEvent({ type: 'mousemove', clientX: 200, clientY: 150 });
const transformAfterMove = frame.style.transform;
assert(transformAfterMove.includes('rotateX') && transformAfterMove.includes('rotateY'), "MouseMove triggers 3D rotate transform", `Got: ${transformAfterMove}`);

// Trigger mouseleave
wrapper.dispatchEvent({ type: 'mouseleave' });
const transformAfterLeave = frame.style.transform;
assert(transformAfterLeave === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "MouseLeave resets 3D transform to 0deg", `Got: ${transformAfterLeave}`);

// 9. Mobile Viewport 3D Tilt Guard (<640px)
mockWindow.innerWidth = 400; // Mobile
wrapper.dispatchEvent({ type: 'mousemove', clientX: 200, clientY: 150 });
assert(frame.style.transform === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "3D tilt disabled on small screens (<640px)");

// 10. Pointer Coarse 3D Tilt Guard (Touch Devices)
mockWindow.innerWidth = 1024;
mockWindow.matchMedia = (q) => ({ matches: q.includes('coarse') });
wrapper.dispatchEvent({ type: 'mousemove', clientX: 200, clientY: 150 });
assert(frame.style.transform === 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', "3D tilt disabled on touch/coarse devices");

// 11. Zero Console Errors
assert(capturedConsoleErrors.length === 0, "Zero console errors logged during test suite execution");

console.log("\n================ SUMMARY ================");
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log("=========================================");

if (testsFailed > 0) {
    process.exit(1);
}
