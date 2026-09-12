/* Direct Meta pilot UI. Provider tokens never enter this browser module. */
(() => {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const messages = {
        RECONNECT_REQUIRED: 'Your Instagram permission expired or changed. Connect again to refresh it.',
        INSTAGRAM_STORAGE_UNAVAILABLE: 'Instagram storage is not ready. Contact CCF support.',
        INSTAGRAM_NOT_CONFIGURED: 'Instagram connections are not enabled on this deployment yet.',
        META_PERMISSIONS_REQUIRED: 'Please grant all four requested read permissions and select your Page and Instagram account.',
        NO_INSTAGRAM_ACCOUNTS: 'No linked professional Instagram accounts were returned. Check the Facebook Page selected during login.',
        CONSENT_CANCELLED: 'Connection cancelled. You can try again whenever you are ready.',
        META_RATE_LIMIT: 'Meta is limiting requests. Please wait before refreshing.',
        RATE_LIMIT: 'Please wait a minute before trying again.',
        POST_NOT_OWNED: 'That post does not belong to this connected account.',
        META_PERMISSION_OR_REQUEST_FAILED: 'Meta could not provide this data. Check your permissions or reconnect.',
        META_UNAVAILABLE: 'Meta is temporarily unavailable. Please try again.'
    };
    let token = null, configured = false, initialised = false, connections = [], posts = [], after = null;
    let selected = '', metrics = null, message = '', busy = false, timer = null, generation = 0;
    const root = () => document.getElementById('instagram-panel');
    function reset() {
        token = null; configured = false; initialised = false; connections = []; posts = []; after = null;
        selected = ''; metrics = null; message = ''; busy = false; generation++;
        clearTimeout(timer);
    }
    async function api(path, options = {}) {
        const currentToken = token;
        const response = await fetch('/api/integrations/instagram' + path, { ...options, headers: { Authorization: 'Bearer ' + currentToken } });
        const data = await response.json();
        if (token !== currentToken) throw Error('SESSION_CHANGED');
        if (!response.ok) throw Error(messages[data.code] || (response.status === 401 || response.status === 403 ? 'Please sign in again, or check the account permissions.' : 'Instagram could not complete this request. Please try again.'));
        return data;
    }
    function permalink(value) {
        try { const url = new URL(value); return url.protocol === 'https:' && ['www.instagram.com', 'instagram.com'].includes(url.hostname) ? url.href : ''; }
        catch (_) { return ''; }
    }
    function draw() {
        const element = root();
        if (!element) return;
        element.innerHTML = `<div class="hq-section-head"><div><span class="hq-eyebrow">Direct Instagram · pilot</span><h2>Your content. Your results.</h2></div><button class="cc-btn cc-primary" data-ig="connect" ${busy || !configured ? 'disabled' : ''}>Connect Instagram <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; vertical-align: -2px; display: inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button></div>
            <p>Connect a professional Instagram account linked to a Facebook Page. CCF reads your profile, posts and performance—not your password, messages or income. These results stay private to your CCF account; campaign sharing is not enabled here.</p>
            <p class="customer-meta">Pilot access depends on your Meta app role and approved permissions. Connecting here does not publish or edit posts.</p>
            ${!configured && initialised ? '<p>Instagram setup is not complete on this deployment.</p>' : ''}
            <div role="status" aria-live="polite">${esc(message || (busy ? 'Loading…' : ''))}</div>
            <div class="hq-connections">${connections.map(account => `<article><span class="hq-platform">IG</span><div><strong>@${esc(account.username)}</strong><small>${Date.parse(account.expires_at) <= Date.now() ? 'Reconnect required' : 'Connected · permission expires ' + esc(new Date(account.expires_at).toLocaleDateString())}</small></div><button class="cc-btn" data-ig="posts" data-id="${esc(account.instagram_id)}" ${busy ? 'disabled' : ''}>View posts</button><button class="cc-btn" data-ig="disconnect" data-id="${esc(account.instagram_id)}" ${busy ? 'disabled' : ''}>Disconnect</button></article>`).join('')}</div>
            ${selected ? `<h3>Published posts</h3>${posts.length ? `<div class="customer-ledger-wrap"><table class="customer-ledger"><thead><tr><th>Post</th><th>Format</th><th>Performance</th></tr></thead><tbody>${posts.map(post => `<tr><td>${permalink(post.permalink) ? `<a href="${esc(permalink(post.permalink))}" target="_blank" rel="noopener noreferrer">${esc(post.caption.slice(0, 100) || 'Open Instagram post')} ↗</a>` : esc(post.caption.slice(0, 100) || 'Instagram post')}</td><td>${esc(post.mediaType)}</td><td><button class="cc-btn" data-ig="metrics" data-id="${esc(post.id)}" ${busy ? 'disabled' : ''}>View metrics</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No posts returned for this account.</p>'}${after ? `<button class="cc-btn" data-ig="more" ${busy ? 'disabled' : ''}>Load more posts</button>` : ''}` : ''}
            ${metrics ? `<div class="hq-panel"><h3>Post performance</h3><p class="customer-meta">Post ${esc(metrics.mediaId)} · Lifetime · Fetched ${esc(new Date(metrics.fetchedAt).toLocaleString())}</p><dl>${metrics.metrics.map(metric => `<dt>${esc(metric.name === 'saved' ? 'Saves' : metric.name)}</dt><dd>${metric.available ? esc(Number(metric.value).toLocaleString()) : 'Unavailable—not zero'}</dd>`).join('')}</dl><p class="customer-meta">Reach counts unique accounts for this post. These figures do not prove campaign attribution or that payment is due.</p></div>` : ''}`;
    }
    async function status() {
        const data = await api('/status');
        connections = data.connections || []; configured = data.configured; initialised = true;
    }
    async function task(work) {
        const run = generation;
        busy = true; message = ''; draw();
        try { await work(); } catch (error) { if (run === generation) message = error.message; }
        finally { if (run === generation) { busy = false; draw(); } }
    }
    async function poll(attempt, start, run) {
        if (run !== generation || !token) return;
        try {
            const result = await api('/attempt/' + attempt);
            if (result.status === 'complete') { await status(); message = 'Instagram connected. Choose View posts to see your content.'; busy = false; draw(); return; }
            if (['failed', 'expired'].includes(result.status)) { message = messages[result.code] || 'The connection did not finish. Please connect again.'; busy = false; draw(); return; }
        } catch (error) { if (run !== generation) return; message = error.message; busy = false; draw(); return; }
        if (Date.now() - start > 600000) { message = 'Connection window timed out. You can connect again.'; busy = false; draw(); return; }
        timer = setTimeout(() => poll(attempt, start, run), 4000);
    }
    async function connect() {
        // Open synchronously to avoid popup blockers. Polling works even if
        // Meta's cross-origin isolation severs window.opener.
        const popup = window.open('about:blank', '_blank', 'width=650,height=760');
        if (!popup) { message = 'Allow pop-ups for CCF, then click Connect Instagram again.'; draw(); return; }
        try { popup.document.title = 'Connecting Instagram'; popup.document.body.textContent = 'Opening secure Meta login…'; } catch (_) {}
        busy = true; message = 'Complete Meta login in the new window. Keep this CCF tab open.'; draw();
        const run = generation;
        try {
            const data = await api('/start', { method: 'POST' });
            const url = new URL(data.url);
            if (url.origin !== 'https://www.facebook.com') throw Error('Invalid connection address.');
            popup.location.href = data.url;
            poll(data.attempt, Date.now(), run);
        } catch (error) { popup.close(); if (run === generation) { busy = false; message = error.message; draw(); } }
    }
    async function handle(event) {
        const button = event.target.closest('[data-ig]');
        if (!button || busy) return;
        const id = button.dataset.id;
        if (button.dataset.ig === 'connect') return connect();
        if (button.dataset.ig === 'disconnect') {
            if (!window.confirm('Remove this connection and its saved token from CCF? To also revoke Meta permissions, remove Creator Cash Flow in Facebook Business Integrations.')) return;
            return task(async () => { await api('/' + id, { method: 'DELETE' }); if (selected === id) { selected = ''; posts = []; after = null; metrics = null; } await status(); message = 'Connection and saved token removed from CCF.'; });
        }
        if (button.dataset.ig === 'posts' || button.dataset.ig === 'more') return task(async () => {
            const more = button.dataset.ig === 'more';
            const accountId = more ? selected : id;
            const data = await api('/' + accountId + '/posts' + (more && after ? '?after=' + encodeURIComponent(after) : ''));
            selected = accountId; posts = more ? [...posts, ...data.posts] : data.posts; after = data.after; metrics = null;
        });
        if (button.dataset.ig === 'metrics') return task(async () => { metrics = await api('/' + selected + '/posts/' + id + '/insights'); });
    }
    window.CCFInstagram = {
        reset,
        mount(element, sessionToken) {
            if (token !== sessionToken) { reset(); token = sessionToken; }
            element.addEventListener('click', handle);
            draw();
            if (!initialised && !busy) task(status);
        }
    };
})();
