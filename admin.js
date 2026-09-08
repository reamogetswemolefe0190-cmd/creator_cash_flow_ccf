// ==========================================================================
// Creator Cash Flow - Administrator Command Portal Controller (admin.js)
// Extracted client application logic for authentication, metrics, creators,
// mutations, audit logging, and privacy-preserving AI telemetry
// ==========================================================================

const API_BASE_URL = window.location.origin && window.location.origin !== 'null' ? '' : '';

// State Container
const state = {
    token: localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || null,
    adminUser: null,
    metrics: null,
    creators: [],
    auditLogs: [],
    telemetry: [],
    selectedCreator: null,
    creatorFilterPlan: 'all',
    creatorSort: 'newest',
    selectedMutationPlan: 'Free',
    selectedMutationStatus: 'active',
    charts: {}
};

// Format Currency Helper
function formatZAR(amount) {
    const val = parseFloat(amount) || 0;
    return 'R ' + val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// HTML Entity Sanitizer Helper to Prevent XSS
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Helper: Auth Headers
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
    };
}

// Initialize Lucide Icons safely
function renderIcons() {
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

// DOM Ready Entrypoint
document.addEventListener('DOMContentLoaded', () => {
    renderIcons();
    setupEventListeners();
    checkSession();
});

// Event Listener Registrations
function setupEventListeners() {
    // Login Form
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Demo Login Button
    const demoBtn = document.getElementById('demo-login-btn');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            document.getElementById('admin-email').value = 'admin@creatorcashflow.com';
            document.getElementById('admin-password').value = 'AdminPass2026!';
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Tab Switching
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab || btn.id.replace('tab-btn-', '');
            switchTab(tabName);
        });
    });

    // Creator Search Input
    const searchInput = document.getElementById('creator-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', renderCreatorsTable);
    }

    // Plan Filter Tabs
    ['filter-plan-all', 'filter-plan-pro', 'filter-plan-free'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                state.creatorFilterPlan = btn.dataset.plan;
                document.querySelectorAll('[data-plan]').forEach(b => {
                    b.className = 'px-3 py-1 rounded-xl font-semibold text-zinc-400 hover:text-white';
                });
                btn.className = 'px-3 py-1 rounded-xl font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                renderCreatorsTable();
            });
        }
    });

    // Creator Sort Select
    const sortSelect = document.getElementById('creator-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.creatorSort = e.target.value;
            renderCreatorsTable();
        });
    }

    // Audit Action Filter
    const auditFilter = document.getElementById('audit-action-filter');
    if (auditFilter) {
        auditFilter.addEventListener('change', renderAuditLogs);
    }

    // Modal Toggles & Form
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    const planPro = document.getElementById('modal-plan-toggle-pro');
    const planFree = document.getElementById('modal-plan-toggle-free');
    if (planPro && planFree) {
        planPro.addEventListener('click', () => setModalPlan('Pro'));
        planFree.addEventListener('click', () => setModalPlan('Free'));
    }

    const statusActive = document.getElementById('modal-status-toggle-active');
    const statusSuspended = document.getElementById('modal-status-toggle-suspended');
    if (statusActive && statusSuspended) {
        statusActive.addEventListener('click', () => setModalStatus('active'));
        statusSuspended.addEventListener('click', () => setModalStatus('suspended'));
    }

    const mutationForm = document.getElementById('creator-mutation-form');
    if (mutationForm) {
        mutationForm.addEventListener('submit', handleMutationSubmit);
    }
}

// Global Quick Fill Helper
window.fillAdminCredentials = function() {
    const emailInput = document.getElementById('admin-email');
    const passInput = document.getElementById('admin-password');
    if (emailInput) emailInput.value = 'admin@creatorcashflow.com';
    if (passInput) passInput.value = 'AdminPass2026!';
};

// Check Active Session & Auto-Initialize Executive Portal
async function checkSession() {
    const storedToken = localStorage.getItem('adminToken') || localStorage.getItem('admin_token');
    if (storedToken) {
        state.token = storedToken;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/verify-auth`, {
                headers: { 'Authorization': `Bearer ${storedToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.admin) {
                    state.adminUser = data.admin;
                    hideLoginModal();
                    await initializeDashboard();
                    return;
                }
            }
        } catch (err) {
            console.warn('Session verification notice:', err);
        }
    }

    // No active authenticated session: display login gate
    showLoginModal();
}

// Login Handler with Live Backend Verification
async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const emailEl = document.getElementById('admin-email');
    const passEl = document.getElementById('admin-password');
    const email = (emailEl?.value || '').trim();
    const password = (passEl?.value || '').trim();
    const errorBanner = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');
    const btnText = document.getElementById('login-btn-text');

    if (errorBanner) errorBanner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Verifying Session...';

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.token) {
            if (btnText) btnText.textContent = 'Access Granted!';
            state.token = data.token;
            state.adminUser = data.admin;
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('admin_token', data.token);
            
            setTimeout(async () => {
                hideLoginModal();
                await initializeDashboard();
                if (btnText) btnText.textContent = 'Authenticate Session';
            }, 250);
            return;
        } else {
            if (btnText) btnText.textContent = 'Authenticate Session';
            if (errorText) errorText.textContent = data.error || data.message || 'Invalid administrator credentials';
            if (errorBanner) errorBanner.classList.remove('hidden');
            return;
        }
    } catch (err) {
        console.error('Login request failed:', err);
        if (btnText) btnText.textContent = 'Authenticate Session';
        if (errorText) errorText.textContent = 'Connection error: Unable to reach authentication server';
        if (errorBanner) errorBanner.classList.remove('hidden');
    }
}
window.handleLoginSubmit = handleLoginSubmit;

// Logout Handler
function handleLogout() {
    state.token = null;
    state.adminUser = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin_token');
    showLoginModal();
}

function showLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const dash = document.getElementById('admin-dashboard');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    if (dash) {
        dash.classList.add('hidden');
        dash.style.display = 'none';
    }
}

function hideLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const dash = document.getElementById('admin-dashboard');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    if (dash) {
        dash.classList.remove('hidden');
        dash.style.display = 'block';
    }
    renderIcons();
}

// Initialize Dashboard Data safely
async function initializeDashboard() {
    try { await fetchMetrics(); } catch (e) { console.warn('fetchMetrics error:', e); }
    try { await fetchCreators(); } catch (e) { console.warn('fetchCreators error:', e); }
    try { await fetchAuditLogs(); } catch (e) { console.warn('fetchAuditLogs error:', e); }
    try { await fetchTelemetry(); } catch (e) { console.warn('fetchTelemetry error:', e); }
    renderIcons();
}

// Real Database Metric Baselines
const EMPTY_METRICS = {
    totalCreators: 0,
    gpvZar: 0,
    mrrZar: 0,
    taxReservesZar: 0,
    channelBreakdown: { youtube: 0, tiktok: 0, patreon: 0, brand_deals: 0 },
    timeline: []
};

const DEMO_CREATORS = [
    { id: 'usr_c1', name: 'Sphiwe Khumalo', email: 'sphiwe@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-06-12T10:30:00Z', gpv: 145000 },
    { id: 'usr_c2', name: 'Naledi Dlamini', email: 'naledi.d@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-06-18T14:15:00Z', gpv: 98000 },
    { id: 'usr_c3', name: 'Sipho Sithole', email: 'sipho.s@gmail.com', plan_tier: 'Free', status: 'active', created_at: '2026-06-25T09:00:00Z', gpv: 42000 },
    { id: 'usr_c4', name: 'Kagiso Mokoena', email: 'kagiso.m@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-07-01T16:20:00Z', gpv: 73000 },
    { id: 'usr_c5', name: 'Lerato Ndlovu', email: 'lerato.nd@gmail.com', plan_tier: 'Free', status: 'suspended', created_at: '2026-07-05T11:45:00Z', gpv: 18000 },
    { id: 'usr_c6', name: 'Thabo Mthembu', email: 'thabo.mt@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-07-10T13:10:00Z', gpv: 110000 },
    { id: 'usr_c7', name: 'Zanele Mabaso', email: 'zanele.m@gmail.com', plan_tier: 'Free', status: 'active', created_at: '2026-07-15T08:30:00Z', gpv: 29000 },
    { id: 'usr_c8', name: 'Bongani Nkosi', email: 'bongani.nk@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-07-20T17:05:00Z', gpv: 84000 },
    { id: 'usr_c9', name: 'Ayanda Cele', email: 'ayanda.c@gmail.com', plan_tier: 'Free', status: 'active', created_at: '2026-07-25T12:00:00Z', gpv: 31000 },
    { id: 'usr_c10', name: 'Mandla Zulu', email: 'mandla.zulu@gmail.com', plan_tier: 'Pro', status: 'active', created_at: '2026-07-29T15:40:00Z', gpv: 165000 }
];

const DEMO_METRICS = {
    totalCreators: 10,
    gpvZar: 795000.00,
    mrrZar: 1794.00,
    taxReservesZar: 119250.00,
    channelBreakdown: { youtube: 420000, tiktok: 165000, patreon: 90000, brand_deals: 120000 },
    timeline: [
        { month: 'Mar', gpv: 95000, mrr: 299, creators: 2 },
        { month: 'Apr', gpv: 210000, mrr: 598, creators: 4 },
        { month: 'May', gpv: 390000, mrr: 897, creators: 6 },
        { month: 'Jun', gpv: 580000, mrr: 1196, creators: 8 },
        { month: 'Jul', gpv: 795000, mrr: 1794, creators: 10 }
    ]
};

const DEMO_AUDIT = [
    { id: 'aud_d1', admin_id: 'admin_master_1', target_creator_id: 'usr_c5', action_type: 'STATUS_CHANGE', old_value: 'active', new_value: 'suspended (SARS compliance review)', timestamp: '2026-08-01T09:30:00Z', ip_hash: '9f86d081884c7d65' },
    { id: 'aud_d2', admin_id: 'admin_master_1', target_creator_id: 'usr_c10', action_type: 'TIER_CHANGE', old_value: 'Free', new_value: 'Pro (Monthly Subscription Upgrade)', timestamp: '2026-08-03T14:20:00Z', ip_hash: '5e884898da280471' }
];

const DEMO_TELEMETRY = [
    { id: 'tel_d1', category_tag: 'Tax Deduction Strategy', prompt_masked: 'What gear expenses can [REDACTED_EMAIL] claim against SARS on R[REDACTED_ZAR] YouTube revenue?', tokens_used: 142, latency_ms: 380, model: 'gemini-1.5-flash', created_at: new Date().toISOString() },
    { id: 'tel_d2', category_tag: 'Patreon Tier Optimization', prompt_masked: 'Generate 3 tiered perks for South African subscribers at R[REDACTED_ZAR]/month', tokens_used: 198, latency_ms: 410, model: 'gemini-1.5-flash', created_at: new Date(Date.now() - 3600000).toISOString() }
];

window.loadDemoData = function() {
    state.creators = JSON.parse(JSON.stringify(DEMO_CREATORS));
    state.metrics = JSON.parse(JSON.stringify(DEMO_METRICS));
    state.auditLogs = JSON.parse(JSON.stringify(DEMO_AUDIT));
    state.telemetry = JSON.parse(JSON.stringify(DEMO_TELEMETRY));
    
    document.getElementById('metric-total-creators').textContent = state.metrics.totalCreators;
    document.getElementById('metric-gpv').textContent = formatZAR(state.metrics.gpvZar);
    document.getElementById('metric-mrr').textContent = formatZAR(state.metrics.mrrZar);
    document.getElementById('metric-tax-reserves').textContent = formatZAR(state.metrics.taxReservesZar);
    
    renderGrowthChart(state.metrics.timeline);
    renderChannelChart(state.metrics.channelBreakdown);
    renderCreatorsTable();
    renderAuditLogs();
    renderTelemetry();
    renderIcons();
};

window.resetZeroBaseline = function() {
    state.creators = [];
    state.metrics = JSON.parse(JSON.stringify(EMPTY_METRICS));
    state.auditLogs = [];
    state.telemetry = [];
    
    document.getElementById('metric-total-creators').textContent = '0';
    document.getElementById('metric-gpv').textContent = 'R 0.00';
    document.getElementById('metric-mrr').textContent = 'R 0.00';
    document.getElementById('metric-tax-reserves').textContent = 'R 0.00';
    
    renderGrowthChart([]);
    renderChannelChart({ youtube: 0, tiktok: 0, patreon: 0, brand_deals: 0 });
    renderCreatorsTable();
    renderAuditLogs();
    renderTelemetry();
    renderIcons();
};

// Fetch Metrics (Scorecards & Charts)
async function fetchMetrics() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/metrics`, { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            state.metrics = data;
        } else {
            state.metrics = state.metrics || EMPTY_METRICS;
        }
    } catch (err) {
        console.warn('API metrics notice, loading clean baseline:', err);
        state.metrics = state.metrics || EMPTY_METRICS;
    }

    const data = state.metrics || EMPTY_METRICS;
    document.getElementById('metric-total-creators').textContent = data.totalCreators || 0;
    document.getElementById('metric-gpv').textContent = formatZAR(data.gpvZar || 0);
    document.getElementById('metric-mrr').textContent = formatZAR(data.mrrZar || 0);
    document.getElementById('metric-tax-reserves').textContent = formatZAR(data.taxReservesZar || 0);

    renderGrowthChart(data.timeline || []);
    renderChannelChart(data.channelBreakdown || EMPTY_METRICS.channelBreakdown);
}

// Fetch Creators (Real Database Accounts Only)
async function fetchCreators() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/creators`, { headers: getAuthHeaders() });
        if (res.ok) {
            state.creators = await res.json();
        } else {
            state.creators = [];
        }
    } catch (err) {
        console.warn('API creators notice:', err);
        state.creators = [];
    }
    renderCreatorsTable();
}

// Fetch Audit Logs (Real Admin Actions Only)
async function fetchAuditLogs() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/audit-logs`, { headers: getAuthHeaders() });
        if (res.ok) {
            state.auditLogs = await res.json();
        } else {
            state.auditLogs = [];
        }
    } catch (err) {
        console.warn('Audit logs notice:', err);
        state.auditLogs = [];
    }
    renderAuditLogs();
}

// Fetch Telemetry (Real AI Queries Only)
async function fetchTelemetry() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/telemetry`, { headers: getAuthHeaders() });
        if (res.ok) {
            state.telemetry = await res.json();
        } else {
            state.telemetry = [];
        }
    } catch (err) {
        console.warn('Telemetry notice:', err);
        state.telemetry = [];
    }
    renderTelemetry();
}

// Switch Tabs
function switchTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        btn.style.color = '#A1A1AA';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        activeBtn.style.color = '#22C55E';
        activeBtn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
    }

    document.querySelectorAll('.admin-view-panel').forEach(panel => {
        panel.classList.add('hidden');
        panel.style.display = 'none';
    });
    const activePanel = document.getElementById(`view-${tabName}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
        activePanel.style.display = 'block';
    }

    if (tabName === 'creators') renderCreatorsTable();
    if (tabName === 'audit') renderAuditLogs();
    if (tabName === 'telemetry') renderTelemetry();

    renderIcons();
}
window.switchTab = switchTab;

// Render Creator Operations Table
function renderCreatorsTable() {
    const tbody = document.getElementById('creator-table-body');
    if (!tbody) return;

    const query = (document.getElementById('creator-search-input')?.value || '').toLowerCase();
    let filtered = state.creators.filter(c => {
        const name = c.name || '';
        const email = c.email || '';
        const matchesQuery = name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
        const matchesPlan = state.creatorFilterPlan === 'all' || (c.plan_tier || '').toLowerCase() === state.creatorFilterPlan;
        return matchesQuery && matchesPlan;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (state.creatorSort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (state.creatorSort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (state.creatorSort === 'name') return (a.name || '').localeCompare(b.name || '');
        return 0;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-zinc-400 text-xs">
            <div class="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 border border-white/10 text-zinc-500 mb-2">
                <i data-lucide="users" class="w-5 h-5"></i>
            </div>
            <p class="font-semibold text-zinc-300">No Registered Creators Yet</p>
            <p class="text-[11px] text-zinc-500 mt-1">Live creator sign-ups from creatorcashflow.co.za will appear here automatically.</p>
        </td></tr>`;
        renderIcons();
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const isPro = (c.plan_tier || '').toLowerCase() === 'pro';
        const isActive = (c.status || '').toLowerCase() === 'active';
        const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
        const initial = (c.name || c.email || 'C').charAt(0).toUpperCase();

        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-3.5 px-4 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                        ${escapeHTML(initial)}
                    </div>
                    <div>
                        <span class="block font-bold text-white">${escapeHTML(c.name || 'Creator')}</span>
                        <span class="block text-[11px] text-zinc-400">${escapeHTML(c.email || '')}</span>
                    </div>
                </td>
                <td class="py-3.5 px-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isPro ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}">
                        ${escapeHTML(c.plan_tier || 'Free')}
                    </span>
                </td>
                <td class="py-3.5 px-4">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${isActive ? 'text-emerald-400' : 'text-red-400'}">
                        <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-red-400'}"></span>
                        ${isActive ? 'Active' : 'Suspended'}
                    </span>
                </td>
                <td class="py-3.5 px-4 text-zinc-400 text-xs">${escapeHTML(dateStr)}</td>
                <td class="py-3.5 px-4 text-right">
                    <button onclick="openCreatorModal('${encodeURIComponent(c.id)}')" 
                        class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-zinc-300 text-xs font-semibold transition-all cursor-pointer">
                        Inspect & Manage
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    renderIcons();
}

// Open Creator Detail Modal
window.openCreatorModal = function(id) {
    const decodedId = typeof id === 'string' ? decodeURIComponent(id) : id;
    const creator = state.creators.find(c => c.id === id || c.id === decodedId);
    if (!creator) return;

    state.selectedCreator = creator;
    document.getElementById('modal-creator-name').textContent = creator.name || 'Creator';
    document.getElementById('modal-creator-email').textContent = creator.email || '';
    document.getElementById('modal-creator-id').textContent = creator.id;
    document.getElementById('modal-admin-note').value = '';

    setModalPlan(creator.plan_tier || 'Free');
    setModalStatus(creator.status || 'active');

    const m = document.getElementById('creator-detail-modal');
    if (m) {
        m.classList.remove('hidden');
        m.style.setProperty('display', 'flex', 'important');
        m.style.setProperty('pointer-events', 'auto', 'important');
    }
    renderIcons();
};

function closeModal() {
    const m = document.getElementById('creator-detail-modal');
    if (m) {
        m.classList.add('hidden');
        m.style.setProperty('display', 'none', 'important');
        m.style.setProperty('pointer-events', 'none', 'important');
    }
    state.selectedCreator = null;
}
window.closeModal = closeModal;

function setModalPlan(plan) {
    state.selectedMutationPlan = plan;
    const proBtn = document.getElementById('modal-plan-toggle-pro');
    const freeBtn = document.getElementById('modal-plan-toggle-free');

    if (plan.toLowerCase() === 'pro') {
        proBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer';
        freeBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer';
    } else {
        freeBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-white/30 bg-white/15 text-white transition-all cursor-pointer';
        proBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer';
    }
}

function setModalStatus(status) {
    state.selectedMutationStatus = status;
    const activeBtn = document.getElementById('modal-status-toggle-active');
    const suspendBtn = document.getElementById('modal-status-toggle-suspend');

    if (status.toLowerCase() === 'active') {
        activeBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer';
        suspendBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer';
    } else {
        suspendBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-red-500/50 bg-red-500/20 text-red-400 transition-all cursor-pointer';
        activeBtn.className = 'py-2 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer';
    }
}

// Save Creator Mutation (POST /api/admin/creators/:id/status)
async function handleMutationSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.selectedCreator) return;

    const id = state.selectedCreator.id;
    const note = document.getElementById('modal-admin-note').value;
    const btn = document.getElementById('submit-mutation-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Signing & Saving...</span>';
    }

    const payload = {
        plan_tier: state.selectedMutationPlan,
        status: state.selectedMutationStatus,
        note: note
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/creators/${id}/status`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const updated = await res.json();
            const idx = state.creators.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.creators[idx].plan_tier = state.selectedMutationPlan;
                state.creators[idx].status = state.selectedMutationStatus;
            }
            closeModal();
            renderCreatorsTable();
            fetchAuditLogs();
            fetchMetrics();
        } else {
            const err = await res.json().catch(() => ({}));
            alert('Mutation error: ' + (err.error || 'Failed to update'));
        }
    } catch (err) {
        console.warn('Mutation fetch notice, local fallback applied:', err);
        const idx = state.creators.findIndex(c => c.id === id);
        if (idx !== -1) {
            state.creators[idx].plan_tier = state.selectedMutationPlan;
            state.creators[idx].status = state.selectedMutationStatus;
        }
        closeModal();
        renderCreatorsTable();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Apply Mutation & Record Audit Log</span>';
        }
        renderIcons();
    }
}

// Render Audit Logs
function renderAuditLogs() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    const actionFilter = (document.getElementById('audit-action-filter')?.value || 'all');
    let filtered = state.auditLogs || [];
    if (actionFilter !== 'all') {
        filtered = filtered.filter(l => l.action_type === actionFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-zinc-500 italic text-xs">No audit records found</div>`;
        return;
    }

    container.innerHTML = filtered.map(log => {
        const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('en-ZA') : 'N/A';
        return `
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ${escapeHTML(log.action_type || '')}
                        </span>
                        <span class="text-xs font-mono text-zinc-400">Target: ${escapeHTML(log.target_creator_id || '')}</span>
                    </div>
                    <span class="text-[11px] text-zinc-500">${escapeHTML(dateStr)}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div class="bg-black/40 rounded-xl p-2.5 font-mono text-[11px] text-red-300/80 border border-red-500/10">
                        <span class="block text-[9px] uppercase tracking-wider text-zinc-500 font-sans font-bold">Old Value:</span>
                        <pre class="whitespace-pre-wrap font-mono">${escapeHTML(log.old_value || '')}</pre>
                    </div>
                    <div class="bg-black/40 rounded-xl p-2.5 font-mono text-[11px] text-emerald-300/80 border border-emerald-500/10">
                        <span class="block text-[9px] uppercase tracking-wider text-zinc-500 font-sans font-bold">New Value:</span>
                        <pre class="whitespace-pre-wrap font-mono">${escapeHTML(log.new_value || '')}</pre>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                    <span>Admin: ${escapeHTML(log.admin_id || '')}</span>
                    <span>IP Hash: ${escapeHTML((log.ip_hash || 'SHA256_EDGE').slice(0, 16))}...</span>
                </div>
            </div>
        `;
    }).join('');
}

// Render AI Telemetry View
function renderTelemetry() {
    const totalQueries = state.telemetry.length;
    const totalTokens = state.telemetry.reduce((sum, t) => sum + (t.tokens_used || 0), 0);
    const avgLatency = totalQueries > 0 ? Math.round(state.telemetry.reduce((sum, t) => sum + (t.latency_ms || 0), 0) / totalQueries) : 0;

    const totalQEl = document.getElementById('telemetry-total-queries');
    const totalTokEl = document.getElementById('telemetry-total-tokens');
    const avgLatEl = document.getElementById('telemetry-avg-latency');
    if (totalQEl) totalQEl.textContent = totalQueries;
    if (totalTokEl) totalTokEl.textContent = totalTokens.toLocaleString();
    if (avgLatEl) avgLatEl.textContent = `${avgLatency} ms`;

    const feed = document.getElementById('telemetry-feed');
    if (!feed) return;

    if (state.telemetry.length === 0) {
        feed.innerHTML = `<div class="p-8 text-center text-zinc-500 italic text-xs">No AI query telemetry records logged yet</div>`;
        return;
    }

    feed.innerHTML = state.telemetry.map(t => {
        const dateStr = new Date(t.created_at || t.timestamp).toLocaleString('en-ZA');
        return `
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        ${escapeHTML(t.category_tag || 'General Inquiry')}
                    </span>
                    <span class="text-[11px] text-zinc-500 font-mono">${escapeHTML(dateStr)}</span>
                </div>
                <div class="bg-black/50 rounded-xl p-3 border border-white/5 text-xs font-mono text-emerald-400">
                    "${escapeHTML(t.prompt_masked || '')}"
                </div>
                <div class="flex items-center justify-between text-[11px] text-zinc-400">
                    <span class="font-semibold text-zinc-300">Model: ${escapeHTML(t.model || 'gemini-1.5-flash')}</span>
                    <div class="flex items-center gap-3 font-mono">
                        <span>Tokens: <strong class="text-white">${escapeHTML(String(t.tokens_used))}</strong></span>
                        <span>Latency: <strong class="text-emerald-400">${escapeHTML(String(t.latency_ms))}ms</strong></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Chart.js Growth Timeline Line Chart
function renderGrowthChart(timelineData) {
    const ctx = document.getElementById('growthTimelineChart');
    if (!ctx) return;

    if (state.charts.growth) {
        state.charts.growth.destroy();
    }

    const labels = timelineData.map(t => t.month);
    const gpvValues = timelineData.map(t => t.gpv);
    const mrrValues = timelineData.map(t => t.mrr);

    state.charts.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gross Platform Volume (ZAR)',
                    data: gpvValues,
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 3
                },
                {
                    label: 'Monthly Recurring Revenue (ZAR)',
                    data: mrrValues,
                    borderColor: '#06B6D4',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 3,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#A1A1AA', font: { family: 'Plus Jakarta Sans', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatZAR(ctx.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#A1A1AA', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#A1A1AA', 
                        font: { size: 11 },
                        callback: (val) => 'R ' + (val / 1000) + 'k'
                    }
                }
            }
        }
    });
}

// Render Chart.js Revenue Channel Doughnut Chart
function renderChannelChart(breakdown) {
    const ctx = document.getElementById('channelBreakdownChart');
    if (!ctx) return;

    if (state.charts.channel) {
        state.charts.channel.destroy();
    }

    const dataValues = [
        breakdown.youtube || 0,
        breakdown.tiktok || 0,
        breakdown.patreon || 0,
        breakdown.brand_deals || 0
    ];

    const total = dataValues.reduce((a, b) => a + b, 0) || 1;

    state.charts.channel = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['YouTube AdSense', 'TikTok Rewards', 'Patreon Subs', 'Brand Deals'],
            datasets: [{
                data: dataValues,
                backgroundColor: ['#22C55E', '#06B6D4', '#F97316', '#6366F1'],
                borderWidth: 2,
                borderColor: '#050505'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pct = ((ctx.raw / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatZAR(ctx.raw)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update legend HTML
    const legendContainer = document.getElementById('channel-legend-list');
    if (legendContainer) {
        legendContainer.innerHTML = `
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span><span>YouTube (${((dataValues[0]/total)*100).toFixed(0)}%)</span></div>
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[#06B6D4]"></span><span>TikTok (${((dataValues[1]/total)*100).toFixed(0)}%)</span></div>
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[#F97316]"></span><span>Patreon (${((dataValues[2]/total)*100).toFixed(0)}%)</span></div>
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[#6366F1]"></span><span>Brands (${((dataValues[3]/total)*100).toFixed(0)}%)</span></div>
        `;
    }
}

// Immediate Execution Safeguard
try {
    renderIcons();
    setupEventListeners();
    checkSession();
} catch (e) {
    console.warn('Immediate execution notice:', e);
}
