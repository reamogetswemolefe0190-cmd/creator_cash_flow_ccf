const fs = require('fs');

// Read files
const htmlContent = fs.readFileSync('index.html', 'utf8');
const jsContent = fs.readFileSync('app.js', 'utf8');

// Check F3 HTML Elements
console.log('=== 1. ARC TRAFFIC LIGHTS HEADER CHECK ===');
const trafficLights = [
    '#FF5F56', // Red
    '#FFBD2E', // Yellow
    '#27C93F'  // Green
];
trafficLights.forEach(color => {
    const hasColor = htmlContent.includes(color);
    console.log(`Traffic light color ${color}: ${hasColor ? 'PASS' : 'FAIL'}`);
});

const urlBar = htmlContent.includes('app.creatorcashflow.com/hq');
console.log(`Arc URL bar present (app.creatorcashflow.com/hq): ${urlBar ? 'PASS' : 'FAIL'}`);

console.log('\n=== 2. EVENT HANDLERS & JS FUNCTIONS CHECK ===');
const f3Functions = [
    'setupHeroMockupInteractions',
    'setHeroMockupPeriod',
    'switchHeroMockupTab',
    'toggleArcSidebar',
    'refreshHeroMockup'
];
f3Functions.forEach(fn => {
    const hasFn = jsContent.includes(`function ${fn}`);
    console.log(`Function ${fn}: ${hasFn ? 'PASS' : 'FAIL'}`);
});

console.log('\n=== 3. MONTHLY/ANNUAL TOGGLE DATA CHECK ===');
const hasMonthlyData = jsContent.includes("balance: 'R24,650'") && jsContent.includes("Net Profit (July)");
const hasAnnualData = jsContent.includes("balance: 'R295,800'") && jsContent.includes("Net Profit (YTD 2026)");
console.log(`Monthly data config: ${hasMonthlyData ? 'PASS' : 'FAIL'}`);
console.log(`Annual data config: ${hasAnnualData ? 'PASS' : 'FAIL'}`);

console.log('\n=== 4. SVG SPARKLINE PATHS CHECK ===');
const hasSparklineArea = htmlContent.includes('id="hero-chart-area"');
const hasSparklineLine = htmlContent.includes('id="hero-chart-line"');
const hasMonthlyPath = jsContent.includes("linePath: 'M 0,50 Q 50,45 100,30 T 200,20 T 300,5'");
const hasAnnualPath = jsContent.includes("linePath: 'M 0,55 Q 50,40 100,25 T 200,15 T 300,2'");
console.log(`SVG sparkline area element: ${hasSparklineArea ? 'PASS' : 'FAIL'}`);
console.log(`SVG sparkline line element: ${hasSparklineLine ? 'PASS' : 'FAIL'}`);
console.log(`Monthly SVG line path config: ${hasMonthlyPath ? 'PASS' : 'FAIL'}`);
console.log(`Annual SVG line path config: ${hasAnnualPath ? 'PASS' : 'FAIL'}`);

console.log('\n=== 5. 3D TILT PERSPECTIVE CHECK ===');
const hasPerspectiveClass = htmlContent.includes('perspective-1000') && jsContent.includes('rotateX(') && jsContent.includes('rotateY(');
console.log(`3D tilt perspective implementation: ${hasPerspectiveClass ? 'PASS' : 'FAIL'}`);

console.log('\n=== 6. SIDEBAR SPACE TABS CHECK ===');
const tabs = ['overview', 'revenue', 'tax'];
tabs.forEach(tab => {
    const hasTabBtn = htmlContent.includes(`data-tab="${tab}"`) && htmlContent.includes(`switchHeroMockupTab('${tab}')`);
    console.log(`Sidebar tab '${tab}': ${hasTabBtn ? 'PASS' : 'FAIL'}`);
});
