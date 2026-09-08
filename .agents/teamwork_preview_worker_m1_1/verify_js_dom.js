const fs = require('fs');

// Verify style.css syntax / rules
const css = fs.readFileSync('style.css', 'utf8');
const requiredCss = [
    '.glass-pill-nav',
    '.glass-card',
    '.glass-card-nested',
    '.ambient-mesh-wrapper',
    '.ambient-orb-emerald',
    '.ambient-orb-teal',
    '.ambient-orb-indigo',
    '@keyframes floatEmerald',
    '@keyframes floatTeal',
    '@keyframes floatIndigo',
    '@keyframes pulseCenterCore',
    '.perspective-1000',
    '@keyframes floatBadge',
    '.animate-float',
    '.arc-tab-btn.active'
];

console.log("--- CSS VERIFICATION ---");
let cssPassed = true;
requiredCss.forEach(selector => {
    const present = css.includes(selector);
    console.log(`CSS ${selector}: ${present}`);
    if (!present) cssPassed = false;
});

// Verify index.html requirements
console.log("\n--- HTML VERIFICATION ---");
const html = fs.readFileSync('index.html', 'utf8');
const requiredHtml = [
    'glass-pill-nav',
    'ambient-mesh-wrapper',
    'ambient-orb-emerald',
    'ambient-orb-teal',
    'ambient-orb-indigo',
    'arc-hero-wrapper',
    'arc-browser-frame',
    'toggle-btn-monthly',
    'toggle-btn-annual',
    'hero-chart-line',
    'hero-chart-area',
    'glass-card'
];

let htmlPassed = true;
requiredHtml.forEach(tag => {
    const present = html.includes(tag);
    console.log(`HTML ${tag}: ${present}`);
    if (!present) htmlPassed = false;
});

if (cssPassed && htmlPassed) {
    console.log("\nALL PRE-FLIGHT VERIFICATIONS PASSED SUCCESSFULLY!");
} else {
    console.error("\nFAILED SOME VERIFICATIONS!");
    process.exit(1);
}
