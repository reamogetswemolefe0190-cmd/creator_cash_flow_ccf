const http = require('http');
const { spawn } = require('child_process');

process.env.PORT = 5001;
const serverProcess = spawn('node', ['server.js'], {
    cwd: 'c:\\Users\\User\\OneDrive\\Desktop\\New folder (2)',
    env: { ...process.env, PORT: '5001' }
});

serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER]: ${data.toString().trim()}`);
});

serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERR]: ${data.toString().trim()}`);
});

async function runTests() {
    // Wait 2.5 seconds for server startup
    await new Promise(r => setTimeout(r, 2500));

    try {
        console.log('Testing GET http://127.0.0.1:5001/ ...');
        const healthRes = await fetch('http://127.0.0.1:5001/');
        const healthData = await healthRes.json();
        console.log('Health status:', healthRes.status, healthData.name);

        console.log('Testing POST http://127.0.0.1:5001/api/onboarding/save ...');
        const onboardRes = await fetch('http://127.0.0.1:5001/api/onboarding/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer demo_token'
            },
            body: JSON.stringify({
                creatorType: 'YouTuber',
                platforms: ['YouTube', 'TikTok'],
                goal: 'Track Revenue',
                connected: ['YouTube'],
                isManual: false
            })
        });
        const onboardData = await onboardRes.json();
        console.log('Onboarding save status:', onboardRes.status, onboardData);

        serverProcess.kill();
        if (onboardRes.status === 200 && onboardData.success) {
            console.log('PASSED ALL API TESTS');
            process.exit(0);
        } else {
            console.error('FAILED API TEST EXPECTATION');
            process.exit(1);
        }
    } catch (err) {
        console.error('Test failed with error:', err);
        serverProcess.kill();
        process.exit(1);
    }
}

runTests();
