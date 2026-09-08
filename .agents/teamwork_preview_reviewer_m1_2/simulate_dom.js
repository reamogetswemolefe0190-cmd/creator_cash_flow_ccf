const fs = require('fs');

class MockElement {
    constructor(id, tagName = 'div') {
        this.id = id;
        this.tagName = tagName;
        this.className = '';
        this.innerText = '';
        this.style = {};
        this.attributes = {};
        this.classList = {
            add: (...cls) => {
                const current = new Set(this.className.split(' ').filter(Boolean));
                cls.forEach(c => current.add(c));
                this.className = Array.from(current).join(' ');
            },
            remove: (...cls) => {
                const current = new Set(this.className.split(' ').filter(Boolean));
                cls.forEach(c => current.delete(c));
                this.className = Array.from(current).join(' ');
            },
            toggle: (cls) => {
                const current = new Set(this.className.split(' ').filter(Boolean));
                if (current.has(cls)) current.delete(cls);
                else current.add(cls);
                this.className = Array.from(current).join(' ');
            },
            contains: (cls) => this.className.split(' ').includes(cls)
        };
        this.listeners = {};
    }

    setAttribute(attr, val) {
        this.attributes[attr] = val;
    }

    getAttribute(attr) {
        return this.attributes[attr];
    }

    addEventListener(event, handler) {
        this.listeners[event] = handler;
    }

    getBoundingClientRect() {
        return { left: 0, top: 0, width: 800, height: 400 };
    }
}

const elements = {};
const idsToMock = [
    'arc-hero-wrapper',
    'arc-browser-frame',
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

idsToMock.forEach(id => {
    elements[id] = new MockElement(id);
});

global.document = {
    getElementById: (id) => elements[id] || new MockElement(id),
    querySelectorAll: (selector) => {
        if (selector === '.arc-tab-btn') {
            const btn1 = new MockElement('b1'); btn1.setAttribute('data-tab', 'overview'); btn1.className = 'arc-tab-btn active';
            const btn2 = new MockElement('b2'); btn2.setAttribute('data-tab', 'revenue'); btn2.className = 'arc-tab-btn';
            const btn3 = new MockElement('b3'); btn3.setAttribute('data-tab', 'tax'); btn3.className = 'arc-tab-btn';
            return [btn1, btn2, btn3];
        }
        return [];
    },
    addEventListener: (event, handler) => {}
};

global.window = {
    innerWidth: 1024,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {}
};

// Load app.js code
const jsCode = fs.readFileSync('app.js', 'utf8');

try {
    eval(jsCode);
    console.log("Successfully evaluated app.js without errors.");
} catch (e) {
    console.error("Evaluation error:", e);
    process.exit(1);
}

// Test setHeroMockupPeriod('annual')
console.log("\n--- Testing setHeroMockupPeriod('annual') ---");
setHeroMockupPeriod('annual');
console.log("Balance display:", elements['hero-mockup-balance-display'].innerText);
console.log("Period label:", elements['hero-mockup-period-label'].innerText);
console.log("Growth tag:", elements['hero-mockup-growth-tag'].innerText);
console.log("Line path SVG:", elements['hero-chart-line'].getAttribute('d'));

if (elements['hero-mockup-balance-display'].innerText !== 'R295,800') {
    console.error("FAIL: Expected annual balance R295,800");
    process.exit(1);
}

// Test setHeroMockupPeriod('monthly')
console.log("\n--- Testing setHeroMockupPeriod('monthly') ---");
setHeroMockupPeriod('monthly');
console.log("Balance display:", elements['hero-mockup-balance-display'].innerText);
console.log("Period label:", elements['hero-mockup-period-label'].innerText);

if (elements['hero-mockup-balance-display'].innerText !== 'R24,650') {
    console.error("FAIL: Expected monthly balance R24,650");
    process.exit(1);
}

// Test switchHeroMockupTab('revenue')
console.log("\n--- Testing switchHeroMockupTab('revenue') ---");
switchHeroMockupTab('revenue');
console.log("Tab title:", elements['hero-mockup-tab-title'].innerText);

if (elements['hero-mockup-tab-title'].innerText !== 'Consolidated Revenue Streams') {
    console.error("FAIL: Expected title 'Consolidated Revenue Streams'");
    process.exit(1);
}

// Test toggleArcSidebar()
console.log("\n--- Testing toggleArcSidebar() ---");
toggleArcSidebar();
console.log("Sidebar className:", elements['arc-sidebar-preview'].className);
toggleArcSidebar();
console.log("Sidebar className after 2nd toggle:", elements['arc-sidebar-preview'].className);

// Test setupHeroMockupInteractions()
console.log("\n--- Testing setupHeroMockupInteractions() ---");
setupHeroMockupInteractions();
console.log("MouseMove listener attached:", typeof elements['arc-hero-wrapper'].listeners['mousemove'] === 'function');
console.log("MouseLeave listener attached:", typeof elements['arc-hero-wrapper'].listeners['mouseleave'] === 'function');

// Simulate mousemove event
if (elements['arc-hero-wrapper'].listeners['mousemove']) {
    elements['arc-hero-wrapper'].listeners['mousemove']({
        clientX: 200,
        clientY: 100
    });
    console.log("Frame transform on mousemove:", elements['arc-browser-frame'].style.transform);
}

console.log("\nALL SIMULATED INTERACTION TESTS PASSED CLEANLY!");
