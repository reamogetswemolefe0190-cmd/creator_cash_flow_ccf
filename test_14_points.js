const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING 14-POINT EDITORIAL DESIGN & MOTION BRIEF');
console.log('====================================================\n');

let passCount = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passCount++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
    }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

console.log('🔍 [POINT 1 & 2] DESKTOP HERO & 3-SCENE SYSTEM');
assert(html.includes('id="arc-browser-frame"'), 'Hero browser window frame element exists');
assert(html.includes('id="hero-scene-revenue"') && html.includes('id="hero-scene-intelligence"') && html.includes('id="hero-scene-cashflow"'), 'All 3 hero scenes (Revenue, Intelligence, Cashflow) are present in DOM');
assert(html.includes('id="scene-tab-revenue"') && html.includes('id="scene-tab-intelligence"') && html.includes('id="scene-tab-cashflow"'), 'Interactive scene switcher tabs (Revenue, Intelligence, Waterfall) are present');
assert(js.includes('function setHeroMockupScene') && js.includes('function startHeroSceneAutoCycle'), 'Hero 3-scene state switcher and automatic cycling engine implemented');

console.log('\n🔍 [POINT 3] "THE REALITY" 3-STAGE EDITORIAL NARRATIVE');
assert(html.includes('Your money is everywhere.') && html.includes('editorial-num'), 'Stage 01: Visual fragmentation narrative present');
assert(html.includes('The profitability blindspot.'), 'Stage 02: Gross views vs Real net cash narrative present');
assert(html.includes('No runway forecasting.'), 'Stage 03: 60-day payout lag forecasting narrative present');

console.log('\n🔍 [POINT 4] ANIMATED MONEY FLOW SHOWCASE');
assert(html.includes('id="money-flow-section"'), 'Money Flow product showcase section exists');
assert(html.includes('R18,240') && html.includes('R4,435') && html.includes('R25,650'), 'Consolidated streams (YouTube, TikTok, Brands, Affiliate) totaling R25,650 present');
assert(css.includes('@keyframes moneyStreamFlow'), 'Money stream animated particle flow keyframes configured');

console.log('\n🔍 [POINT 5 & 6] DESKTOP 1440px vs MOBILE 390px COMPOSITION');
assert(html.includes('id="mobile-hero-mockup-card"'), 'Bespoke mobile 390px card mockup element present');
assert(css.includes('.hero-scene-container'), 'Hero scene container styling exists');

console.log('\n🔍 [POINT 7 & 8] STREAMLINED 3-STEP IMMERSIVE ONBOARDING');
assert(html.includes('id="onboard-step-1"') && html.includes('id="onboard-step-2"') && html.includes('id="onboard-step-3"'), 'Streamlined 3-step onboarding canvas present');
assert(html.includes('What do you create?') && html.includes('Where does your money come from?'), 'Direct, creator-focused onboarding step headlines present');
assert(js.includes('updateOnboardingProgress'), 'Onboarding progress counter and bar synchronizer active');

console.log('\n🔍 [POINT 9 & 10] 3-LAYER HQ INTELLIGENCE HIERARCHY');
assert(html.includes('R24,650') && html.includes('+18.4% vs last month'), 'Layer 1: Real-time net cash status present');
assert(html.includes('SARS Compliance Guard') && html.includes('R3,125'), 'Layer 2 & Point 11: SARS Tax Guard reserve card present');
assert(html.includes('Stream Acceleration Intelligence') && html.includes('Executive Intelligence Briefing'), 'Layer 3: Predictive creator action briefing present');

console.log('\n🔍 [POINT 12, 13 & 14] MOTION SYSTEM & DESIGN TOKENS');
assert(css.includes('cubic-bezier(0.16, 1, 0.3, 1)'), 'Cohesive premium easing curve token configured');
assert(css.includes('.btn-magnetic'), 'Interactive magnetic button physics class configured');
assert(css.includes('.waterfall-step'), 'Cash flow waterfall connecting step styles configured');

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passCount}/${totalTests} TESTS PASSED CLEANLY`);
console.log('====================================================\n');

if (passCount === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
