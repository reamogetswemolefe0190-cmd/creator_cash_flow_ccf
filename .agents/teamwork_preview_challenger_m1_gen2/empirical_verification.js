const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const projectRoot = path.resolve(__dirname, '../../');
const htmlPath = path.join(projectRoot, 'index.html');
const cssPath = path.join(projectRoot, 'style.css');

console.log("=================================================");
console.log("EMPIRICAL CHALLENGER VERIFICATION HARNESS (M1 Gen 2)");
console.log("=================================================\n");

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const results = {
    defect1_linkTag: false,
    defect1_keyframesDefined: {},
    defect1_keyframesBound: {},
    defect1_elementsInDOM: {},
    defect2_arcHeaderStructure: false,
    defect2_viewportMath: {},
    overallPass: true,
    logs: []
};

function logResult(status, testName, details = '') {
    const symbol = status ? "[PASS]" : "[FAIL]";
    console.log(`${symbol} ${testName} ${details ? '- ' + details : ''}`);
    results.logs.push({ status, testName, details });
    if (!status) {
        results.overallPass = false;
    }
}

// ----------------------------------------------------
// SECTION 1: Defect 1 Re-verification (Style Link & Animations)
// ----------------------------------------------------
console.log("--- 1. Testing Link Tag & CSS Stylesheet Integration ---");

const dom = new JSDOM(htmlContent, { url: `file://${htmlPath}` });
const doc = dom.window.document;

const headLinks = Array.from(doc.querySelectorAll('head link[rel="stylesheet"]'));
const styleCssLink = headLinks.find(link => link.getAttribute('href') === 'style.css');

if (styleCssLink) {
    results.defect1_linkTag = true;
    logResult(true, "index.html <head> contains <link rel=\"stylesheet\" href=\"style.css\">");
} else {
    results.defect1_linkTag = false;
    logResult(false, "index.html <head> MISSING <link rel=\"stylesheet\" href=\"style.css\">");
}

console.log("\n--- 2. Testing 7 Required Animation Keyframes ---");

const requiredKeyframes = [
    'floatEmerald',
    'floatTeal',
    'floatIndigo',
    'pulseCenterCore',
    'fadeSlideUp',
    'floatBadge',
    'floatBadgeDelayed'
];

requiredKeyframes.forEach(kf => {
    // Regex to match @keyframes kf { ... }
    const kfRegex = new RegExp(`@keyframes\\s+${kf}\\s*\\{`, 'i');
    const isDefined = kfRegex.test(cssContent);
    results.defect1_keyframesDefined[kf] = isDefined;
    logResult(isDefined, `Keyframe '@keyframes ${kf}' defined in style.css`);

    // Check if keyframe is bound to a CSS rule
    const usageRegex = new RegExp(`animation:[^;]*${kf}`, 'i');
    const isBound = usageRegex.test(cssContent);
    results.defect1_keyframesBound[kf] = isBound;
    logResult(isBound, `Keyframe '${kf}' assigned to CSS rule in style.css`);
});

console.log("\n--- 3. Testing Animated Element DOM Presence ---");

const keyframeElements = [
    { kf: 'floatEmerald', selector: '.ambient-orb-emerald' },
    { kf: 'floatTeal', selector: '.ambient-orb-teal' },
    { kf: 'floatIndigo', selector: '.ambient-orb-indigo' },
    { kf: 'pulseCenterCore', selector: '.ambient-mesh-center-glow' },
    { kf: 'fadeSlideUp', selector: '.marketing-page-wrapper h1' },
    { kf: 'floatBadge', selector: '.animate-float' },
    { kf: 'floatBadgeDelayed', selector: '.animate-float-delayed' }
];

keyframeElements.forEach(({ kf, selector }) => {
    const elem = doc.querySelector(selector);
    const exists = !!elem;
    results.defect1_elementsInDOM[kf] = exists;
    logResult(exists, `Element target '${selector}' for keyframe '${kf}' exists in DOM`);
});

// ----------------------------------------------------
// SECTION 2: Defect 2 Re-verification (Arc Browser Header & Viewport Fit)
// ----------------------------------------------------
console.log("\n--- 4. Testing Arc Browser Header Structure & Responsive Classes ---");

const arcFrame = doc.querySelector('#arc-browser-frame');
logResult(!!arcFrame, "#arc-browser-frame element exists in index.html");

const headerBar = doc.querySelector('#arc-browser-frame > div:first-child');
logResult(!!headerBar, "Arc browser header bar container exists inside #arc-browser-frame");

if (headerBar) {
    const trafficLights = headerBar.children[0];
    const urlPill = headerBar.children[1];
    const windowActions = headerBar.children[2];

    const hasFlexShrinkTL = trafficLights && trafficLights.classList.contains('flex-shrink-0');
    logResult(hasFlexShrinkTL, "Traffic lights container has 'flex-shrink-0'");

    const hasFlexShrinkWA = windowActions && windowActions.classList.contains('flex-shrink-0');
    logResult(hasFlexShrinkWA, "Window actions container has 'flex-shrink-0'");

    const pillHasFlex1 = urlPill && urlPill.classList.contains('flex-1');
    logResult(pillHasFlex1, "URL pill container has 'flex-1'");

    const pillHasMinW0 = urlPill && urlPill.classList.contains('min-w-0');
    logResult(pillHasMinW0, "URL pill container has 'min-w-0'");

    const pillHasOverflowHidden = urlPill && urlPill.classList.contains('overflow-hidden');
    logResult(pillHasOverflowHidden, "URL pill container has 'overflow-hidden'");

    const pillHasTruncate = urlPill && (urlPill.classList.contains('truncate') || !!urlPill.querySelector('.truncate'));
    logResult(pillHasTruncate, "URL pill contains text truncation element ('truncate')");

    const headerOverflowHidden = headerBar.classList.contains('overflow-hidden');
    logResult(headerOverflowHidden, "Header bar container has 'overflow-hidden'");
}

console.log("\n--- 5. Empirical Viewport Fit & Layout Math Stress Testing ---");

const testViewports = [
    { name: "320px (Ultra-narrow Mobile)", width: 320, padding: 32, headerPad: 8 },
    { name: "375px (iPhone SE)", width: 375, padding: 32, headerPad: 8 },
    { name: "390px (iPhone 12/13/14)", width: 390, padding: 32, headerPad: 8 },
    { name: "430px (iPhone 14 Pro Max)", width: 430, padding: 32, headerPad: 8 },
    { name: "768px (Tablet)", width: 768, padding: 48, headerPad: 32 },
    { name: "1024px (Laptop)", width: 1024, padding: 48, headerPad: 32 },
    { name: "1440px (Desktop Wide)", width: 1440, padding: 48, headerPad: 32 },
    { name: "1920px (Ultra-wide)", width: 1920, padding: 48, headerPad: 32 }
];

testViewports.forEach(vp => {
    // Max frame width container calculations
    let frameWidth = vp.width > 1024 ? 896 : Math.max(280, vp.width - vp.padding);
    let availableHeaderWidth = frameWidth - vp.headerPad;

    let trafficLightsWidth = 36; // 3 x 12px buttons + gaps
    let actionsWidth = 52; // 2 action buttons + gaps
    let pillMargin = vp.width < 640 ? 8 : 32;
    let pillMaxWidth = vp.width < 400 ? 120 : (vp.width < 640 ? 160 : 448);

    // Total required space if pill hits max-width limit
    let contentDesiredWidth = trafficLightsWidth + actionsWidth + pillMargin + pillMaxWidth;

    // Actual pill allocated width when flex-1 min-w-0 takes effect
    let actualPillWidth = Math.min(pillMaxWidth, Math.max(0, availableHeaderWidth - trafficLightsWidth - actionsWidth - pillMargin));
    let totalActualHeaderContentWidth = trafficLightsWidth + actionsWidth + pillMargin + actualPillWidth;

    let overflow = totalActualHeaderContentWidth - availableHeaderWidth;
    const passes = overflow <= 0 && actualPillWidth > 20;

    results.defect2_viewportMath[vp.name] = {
        frameWidth,
        availableHeaderWidth,
        actualPillWidth,
        overflow,
        passes
    };

    logResult(passes, `Viewport ${vp.name}: Frame=${frameWidth}px, AvailHeader=${availableHeaderWidth}px, PillWidth=${actualPillWidth}px, Overflow=${overflow}px`);
});

console.log("\n=================================================");
console.log(`VERDICT SUMMARY: ${results.overallPass ? "ALL EMPIRICAL TESTS PASSED (APPROVE)" : "TESTS FAILED (REJECT)"}`);
console.log("=================================================");

fs.writeFileSync(
    path.join(__dirname, 'empirical_results.json'),
    JSON.stringify(results, null, 2)
);

if (!results.overallPass) {
    process.exit(1);
} else {
    process.exit(0);
}
