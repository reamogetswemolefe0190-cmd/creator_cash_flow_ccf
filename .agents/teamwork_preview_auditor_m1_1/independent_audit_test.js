const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const htmlPath = path.join(rootDir, 'index.html');
const cssPath = path.join(rootDir, 'style.css');
const jsPath = path.join(rootDir, 'app.js');

console.log("==================================================");
console.log("INDEPENDENT FORENSIC AUDIT SUITE - MILESTONE M1");
console.log("==================================================");

let violations = [];
let passCount = 0;

function assert(condition, testName, failureMsg) {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${testName}: ${failureMsg}`);
        violations.push({ testName, failureMsg });
    }
}

// 1. Load Source Files
assert(fs.existsSync(htmlPath), "HTML File Exists", "index.html not found");
assert(fs.existsSync(cssPath), "CSS File Exists", "style.css not found");
assert(fs.existsSync(jsPath), "JS File Exists", "app.js not found");

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// 2. Feature F1: Floating Glassmorphic Pill Navbar
console.log("\n--- Auditing Feature F1 (Floating Pill Navbar) ---");
assert(html.includes('glass-pill-nav'), "HTML includes glass-pill-nav element", "Missing class glass-pill-nav in index.html");
assert(html.includes('rounded-full') && html.includes('backdrop-blur-xl'), "HTML navbar has rounded pill and blur classes", "Navbar missing rounded-full or backdrop-blur-xl");
assert(css.includes('.glass-pill-nav'), "CSS defines .glass-pill-nav", "Missing .glass-pill-nav rule in style.css");
assert(css.includes('backdrop-filter: blur(20px)'), "CSS .glass-pill-nav uses 20px backdrop blur", "Missing blur(20px) in CSS");

// 3. Feature F2: Ambient Multi-Color Mesh Backdrops
console.log("\n--- Auditing Feature F2 (Ambient Gradient Mesh) ---");
assert(html.includes('ambient-mesh-wrapper'), "HTML includes ambient-mesh-wrapper", "Missing ambient-mesh-wrapper in index.html");
assert(html.includes('ambient-orb-emerald') && html.includes('ambient-orb-teal') && html.includes('ambient-orb-indigo'), "HTML includes 3 ambient gradient orbs", "Missing color orbs in index.html");
assert(css.includes('@keyframes floatEmerald'), "CSS defines floatEmerald keyframes", "Missing floatEmerald in style.css");
assert(css.includes('@keyframes floatTeal'), "CSS defines floatTeal keyframes", "Missing floatTeal in style.css");
assert(css.includes('@keyframes floatIndigo'), "CSS defines floatIndigo keyframes", "Missing floatIndigo in style.css");
assert(css.includes('@keyframes pulseCenterCore'), "CSS defines pulseCenterCore keyframes", "Missing pulseCenterCore in style.css");

// 4. Feature F3: Arc Hero Product Mockup
console.log("\n--- Auditing Feature F3 (Arc Hero Mockup & 3D Tilt) ---");
assert(html.includes('id="arc-hero-wrapper"') && html.includes('id="arc-browser-frame"'), "HTML includes Arc hero wrapper and browser frame", "Missing hero mockup IDs in index.html");
assert(html.includes('toggle-btn-monthly') && html.includes('toggle-btn-annual'), "HTML includes Monthly & Annual toggle buttons", "Missing toggle buttons in index.html");
assert(html.includes('hero-chart-line') && html.includes('hero-chart-area'), "HTML includes SVG chart line and area paths", "Missing SVG chart paths in index.html");
assert(js.includes('HERO_MOCKUP_DATA'), "JS defines HERO_MOCKUP_DATA object", "Missing HERO_MOCKUP_DATA in app.js");
assert(js.includes('setupHeroMockupInteractions'), "JS defines setupHeroMockupInteractions function", "Missing setupHeroMockupInteractions in app.js");
assert(js.includes('setHeroMockupPeriod'), "JS defines setHeroMockupPeriod function", "Missing setHeroMockupPeriod in app.js");
assert(js.includes('switchHeroMockupTab'), "JS defines switchHeroMockupTab function", "Missing switchHeroMockupTab in app.js");
assert(js.includes('rotateX') && js.includes('rotateY'), "JS implements 3D tilt calculation", "Missing rotateX/rotateY tilt math in app.js");

// 5. Feature F4: Glassmorphic Cards
console.log("\n--- Auditing Feature F4 (Glassmorphic Cards) ---");
assert(html.includes('glass-card') && html.includes('glass-card-nested'), "HTML uses glass-card and glass-card-nested utilities", "Missing glass-card usage in index.html");
assert(css.includes('.glass-card'), "CSS defines .glass-card class", "Missing .glass-card in style.css");
assert(css.includes('.glass-card-nested'), "CSS defines .glass-card-nested class", "Missing .glass-card-nested in style.css");

// 6. Prohibited Integrity Check (Hardcoded test results / Facades)
console.log("\n--- Auditing Prohibited Patterns ---");
const facadePatterns = [
    /function\s+\w+\s*\([^)]*\)\s*\{\s*return\s+true;\s*\}/g,
    /function\s+\w+\s*\([^)]*\)\s*\{\s*return\s+false;\s*\}/g,
    /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*TODO/g
];
let dummyCount = 0;
facadePatterns.forEach(pattern => {
    const matches = js.match(pattern);
    if (matches) dummyCount += matches.length;
});
assert(dummyCount === 0, "No dummy facade function stubs found in app.js", `Found ${dummyCount} dummy function stubs`);

console.log("\n==================================================");
console.log(`AUDIT SUMMARY: ${passCount} PASSED, ${violations.length} VIOLATIONS`);
console.log("==================================================");

if (violations.length > 0) {
    console.error("VERDICT: INTEGRITY VIOLATION");
    process.exit(1);
} else {
    console.log("VERDICT: CLEAN");
    process.exit(0);
}
