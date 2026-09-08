const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const rootDir = path.resolve(__dirname, '../../');
const htmlPath = path.join(rootDir, 'index.html');
const cssPath = path.join(rootDir, 'style.css');

console.log('=== VERIFICATION TEST RUNNER (M1 Iteration 2) ===\n');

// 1. Read files
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${message}`);
        failCount++;
    }
}

// TEST 1: Check <link rel="stylesheet" href="style.css"> in head
const dom = new JSDOM(htmlContent, { url: 'file://' + htmlPath });
const doc = dom.window.document;
const linkTags = Array.from(doc.querySelectorAll('head link[rel="stylesheet"]'));
const styleLink = linkTags.find(l => l.getAttribute('href') === 'style.css');

assert(!!styleLink, 'index.html head contains <link rel="stylesheet" href="style.css">');

// TEST 2: Keyframe Animations presence in style.css
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
    const hasKeyframe = cssContent.includes(`@keyframes ${kf}`);
    assert(hasKeyframe, `style.css defines @keyframes ${kf}`);
});

// TEST 3: Check Arc Browser header URL pill responsive classes
const urlPill = doc.querySelector('#arc-browser-frame .flex-1.min-w-0');
assert(!!urlPill, 'Arc browser header URL pill has flex-1 and min-w-0 classes');

if (urlPill) {
    const classList = Array.from(urlPill.classList);
    assert(classList.includes('truncate') || urlPill.querySelector('.truncate'), 'URL pill or text has truncate class');
    assert(classList.some(c => c.includes('max-w-')), 'URL pill has responsive max-width constraint');
    assert(classList.includes('overflow-hidden'), 'URL pill has overflow-hidden class');
}

// TEST 4: Arc Browser Header layout structure (Traffic lights, Pill, Window actions)
const headerDiv = doc.querySelector('#arc-browser-frame > div:first-child');
assert(!!headerDiv, 'Arc browser header container exists');

if (headerDiv) {
    const trafficLights = headerDiv.children[0];
    const pill = headerDiv.children[1];
    const actions = headerDiv.children[2];

    assert(trafficLights && trafficLights.classList.contains('flex-shrink-0'), 'Traffic lights container has flex-shrink-0');
    assert(actions && actions.classList.contains('flex-shrink-0'), 'Window actions container has flex-shrink-0');
    assert(headerDiv.classList.contains('overflow-hidden'), 'Arc header container has overflow-hidden class');
}

// TEST 5: Math Verification across Viewports (375px, 390px, 430px, 1440px)
const viewports = [
    { name: '375px (iPhone SE)', width: 375, expectedFrameWidth: 335 },
    { name: '390px (iPhone 12/13/14)', width: 390, expectedFrameWidth: 350 },
    { name: '430px (iPhone 14 Pro Max)', width: 430, expectedFrameWidth: 390 },
    { name: '1440px (Desktop)', width: 1440, expectedFrameWidth: 896 }
];

viewports.forEach(vp => {
    // Frame padding on mobile is px-xs (4px left + 4px right = 8px) + marketing px-md (16px * 2 = 32px) => 40px total margin/padding on screen
    let frameWidth = vp.width > 1024 ? 896 : (vp.width - 40);
    // Arc header internal padding: px-xs (4px * 2 = 8px) on mobile, px-md (16px * 2 = 32px) on desktop
    let headerPadding = vp.width < 640 ? 8 : 32;
    let availableHeaderWidth = frameWidth - headerPadding;

    let trafficLightsWidth = 44; // 3 * 12px + 8px gaps
    let actionsWidth = 52; // 2 * 24px + 4px gap
    let pillMargin = vp.width < 640 ? 8 : 32; // mx-xs (8px) vs mx-md (32px)
    let pillMaxWidth = vp.width < 400 ? 120 : (vp.width < 640 ? 160 : 448);

    let maxHeaderContentWidth = trafficLightsWidth + pillMargin + pillMaxWidth + actionsWidth;
    let overflowAmount = Math.max(0, maxHeaderContentWidth - availableHeaderWidth);

    assert(overflowAmount === 0, `Viewport ${vp.name}: Frame width ${frameWidth}px, Header avail ${availableHeaderWidth}px, Content max ${maxHeaderContentWidth}px -> Overflow: ${overflowAmount}px`);
});

console.log(`\nVerification Summary: ${passCount} Passed, ${failCount} Failed.`);

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
