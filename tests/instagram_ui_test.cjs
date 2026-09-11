'use strict';
// Isolated browser fixtures: no production login, database or Meta calls.
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

async function main() {
    const app = express(); app.use(express.static(path.resolve(__dirname, '..')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    let browser;
    try {
        browser = await chromium.launch({ headless: true, channel: 'msedge' });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
        let connected = true;
        const id = '17841475024653722';
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
            if (url.origin !== base) return route.abort();
            if (url.pathname === '/api/auth/login') return json({ token: 'isolated-test-session', user: { name: 'Test Creator' } });
            if (url.pathname === '/api/transactions') return json({ transactions: [] });
            if (url.pathname === '/api/integrations/phyllo/status') return json({ configured: false, connections: [], environment: 'sandbox' });
            if (url.pathname === '/api/integrations/instagram/status') return json({ configured: true, connections: connected ? [{ instagram_id: id, username: 'testcreator', expires_at: '2030-01-01T00:00:00Z' }] : [] });
            if (url.pathname === '/api/integrations/instagram/' + id && route.request().method() === 'DELETE') { connected = false; return json({ disconnected: true }); }
            if (url.pathname.endsWith('/posts')) return json({ posts: [{ id: url.searchParams.has('after') ? '17870423907650107' : '17870423907650106', caption: '<img src=x onerror=alert(1)> Test campaign post', mediaType: 'IMAGE', permalink: 'https://www.instagram.com/p/test/' }], after: url.searchParams.has('after') ? null : 'cursor' });
            if (url.pathname.endsWith('/insights')) return json({ mediaId: '17870423907650106', fetchedAt: '2026-09-11T12:00:00Z', metrics: [{ name: 'reach', value: 11, available: true }, { name: 'saved', value: 0, available: true }, { name: 'likes', value: null, available: false }] });
            if (url.pathname.startsWith('/api/')) return json({});
            return route.continue();
        });
        const page = await context.newPage();
        await page.goto(base + '/#login');
        await page.locator('#auth-email').fill('test@example.com');
        await page.locator('#auth-password').fill('test-only-password');
        await page.locator('#customer-auth button').click();
        await page.locator('.hq-sidebar [data-action="account-tab"][data-tab="connections"]').click();
        await page.locator('[data-ig="posts"]').waitFor();
        await page.locator('[data-ig="posts"]').click();
        await page.locator('[data-ig="metrics"]').first().waitFor();
        assert.equal(await page.locator('#instagram-panel img').count(), 0, 'Post captions must be escaped');
        await page.locator('[data-ig="more"]').click();
        await page.waitForFunction(() => document.querySelectorAll('[data-ig="metrics"]').length === 2);
        assert.equal(await page.locator('[data-ig="more"]').count(), 0);
        await page.locator('[data-ig="metrics"]').first().click();
        await page.getByText('Unavailable—not zero', { exact: true }).waitFor();
        await page.screenshot({ path: path.resolve(__dirname, '../.instagram-qa/desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.resolve(__dirname, '../.instagram-qa/mobile.png'), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page-level mobile overflow');
        assert.ok(await page.evaluate(() => [...document.querySelectorAll('#instagram-panel article, #instagram-panel [data-ig]')].every(el => el.getBoundingClientRect().right <= innerWidth)), 'Connection card and actions must fit mobile viewport');
        page.on('dialog', dialog => dialog.accept());
        await page.locator('[data-ig="disconnect"]').click();
        await page.getByText('Connection and saved token removed from CCF.', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-ig="posts"]').count(), 0);
        await page.locator('[data-action="logout"]').click();
        assert.equal(await page.locator('#instagram-panel').count(), 0);
        console.log('Instagram UI passed: real-account navigation, posts, pagination, escaped captions, metrics/unavailable states, mobile overflow, disconnect and logout. Screenshots: .instagram-qa/');
    } finally { if (browser) await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
