const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const ids = [
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

let allFound = true;
ids.forEach(id => {
    const found = html.includes(`id="${id}"`);
    console.log(`${id}: ${found}`);
    if (!found) allFound = false;
});

if (!allFound) {
    console.error("ERROR: Missing IDs in index.html!");
    process.exit(1);
} else {
    console.log("SUCCESS: All IDs found in index.html!");
}
