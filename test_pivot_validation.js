const fs = require('fs');
const http = require('http');

console.log('🧪 RUNNING 12-POINT STRATEGIC PIVOT VERIFICATION SUITE...\n');

let failed = 0;
let passed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

// 1. Check index.html content
const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('--- 1. Testing Removal of Tax Guard & SARS Visual Identity ---');
assert(!indexHtml.includes('SARS Tax Guard'), 'Zero occurrences of "SARS Tax Guard"');
assert(!indexHtml.includes('15% Tax Guard'), 'Zero occurrences of "15% Tax Guard"');
assert(!indexHtml.includes('R3,125 Reserved'), 'Zero occurrences of "R3,125 Reserved"');
assert(!indexHtml.includes('Tax Liability'), 'Zero occurrences of "Tax Liability" in UI');

console.log('\n--- 2. Testing Flagship "Financial Readiness" & "Creator Health" ---');
assert(indexHtml.includes('Financial Readiness'), 'Contains "Financial Readiness" branding');
assert(indexHtml.includes('Creator Health'), 'Contains "Creator Health" feature');
assert(indexHtml.includes('82') && indexHtml.includes('Healthy'), 'Contains "82 Healthy" score');
assert(indexHtml.includes('Income tracked'), 'Contains "Income tracked ✓" check item');
assert(indexHtml.includes('Expenses organised') || indexHtml.includes('Expenses tracked'), 'Contains "Expenses organised" check item');

console.log('\n--- 3. Testing "Financial Records" Archive Hub ---');
assert(indexHtml.includes('Financial Records'), 'Contains "Financial Records" view');
assert(indexHtml.includes('2026 Archive'), 'Contains "2026 Archive" badge');
assert(indexHtml.includes('R182,450'), 'Contains Total Income stat "R182,450"');
assert(indexHtml.includes('R43,220'), 'Contains Total Expenses stat "R43,220"');
assert(indexHtml.includes('238'), 'Contains Transactions count "238"');
assert(indexHtml.includes('18'), 'Contains Documents count "18"');
assert(indexHtml.includes('Keep your financial records organised and accessible.'), 'Contains Records tagline');

console.log('\n--- 4. Testing Reworked 3-Step Onboarding Flow ---');
assert(indexHtml.includes('Tell us about your creator business'), 'Step 1 title: "Tell us about your creator business"');
assert(indexHtml.includes('Where does your money come from?'), 'Step 2 title: "Where does your money come from?"');
assert(indexHtml.includes('What do you want to understand?'), 'Step 3 title: "What do you want to understand?"');
assert(indexHtml.includes('My revenue'), 'Step 3 option: "My revenue"');
assert(indexHtml.includes('My expenses'), 'Step 3 option: "My expenses"');
assert(indexHtml.includes('My profitability'), 'Step 3 option: "My profitability"');
assert(indexHtml.includes('My cash flow'), 'Step 3 option: "My cash flow"');
assert(indexHtml.includes('My business growth'), 'Step 3 option: "My business growth"');
assert(indexHtml.includes('Your Creator HQ is ready.'), 'Magic Moment: "Your Creator HQ is ready."');
assert(indexHtml.includes("We've created your financial workspace around your business."), 'Magic Moment description');
assert(indexHtml.includes("Let's see how you're doing →"), 'Magic moment CTA button');

console.log('\n--- 5. Testing Dashboard Architecture & Business Analyst AI ---');
assert(indexHtml.includes('tab-records'), 'Dashboard includes tab-records element');
assert(indexHtml.includes('Business Analyst AI'), 'AI assistant rebranded to "Business Analyst AI"');
assert(indexHtml.includes('Good afternoon 👋'), 'Dashboard greeting is "Good afternoon 👋"');

// 2. Check app.js
const appJs = fs.readFileSync('app.js', 'utf8');
console.log('\n--- 6. Testing app.js Logic & Event Handlers ---');
assert(appJs.includes('selectGoalOption'), 'app.js defines selectGoalOption for Step 3');
assert(appJs.includes('openUploadRecordModal'), 'app.js defines openUploadRecordModal');
assert(appJs.includes('submitRecordEntry'), 'app.js defines submitRecordEntry');
assert(appJs.includes('Business Analyst AI'), 'app.js defines Business Analyst AI system context');

// 3. Test Local Express Server
console.log('\n--- 7. Testing Local Staging Server HTTP Response ---');

function runServerCheck(serverToClose = null) {
    const req = http.get('http://localhost:5000/', (res) => {
        assert(res.statusCode === 200, `Local staging server HTTP status ${res.statusCode}`);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            assert(data.includes('Financial Readiness'), 'Server serves updated Financial Readiness HTML');
            assert(data.includes('Creator Health'), 'Server serves updated Creator Health HTML');
            console.log(`\n========================================`);
            console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
            console.log(`========================================\n`);
            if (serverToClose) {
                serverToClose.close(() => {
                    if (failed > 0) process.exit(1);
                    else process.exit(0);
                });
            } else {
                if (failed > 0) process.exit(1);
                else process.exit(0);
            }
        });
    });

    req.on('error', (err) => {
        console.error('❌ Server connection error:', err.message);
        failed++;
        if (serverToClose) serverToClose.close(() => process.exit(1));
        else process.exit(1);
    });
}

// Check if server is already running on port 5000; if not, spin up ephemeral instance
const probeReq = http.get('http://localhost:5000/', () => {
    runServerCheck(null);
});

probeReq.on('error', () => {
    try {
        const { app } = require('./server');
        const ephemeralServer = app.listen(5000, () => {
            runServerCheck(ephemeralServer);
        });
        ephemeralServer.on('error', (e) => {
            console.error('❌ Ephemeral server error:', e.message);
            failed++;
            process.exit(1);
        });
    } catch (e) {
        console.error('❌ Failed to launch fallback server:', e.message);
        failed++;
        process.exit(1);
    }
});
