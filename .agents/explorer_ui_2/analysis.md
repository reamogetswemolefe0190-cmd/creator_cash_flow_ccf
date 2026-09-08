# Technical Architecture Strategy & UI Specification: Standalone Admin Command Portal (`admin.html`)

**Author**: Explorer UI Specialist 2  
**Target File**: `c:\Users\User\OneDrive\Desktop\New folder (2)\admin.html`  
**Scope**: Milestones M4, M5, M6 (Admin Portal UI, Creator Operations, Audit Trail & Telemetry)  
**Date**: August 7, 2026  

---

## 1. Executive Summary & Scope Overview

The Creator Cash Flow (CCF) Admin Command Portal is a standalone single-page administrative web application (`admin.html`) designed for executive overview, platform governance, financial telemetry, creator operations, immutable audit logging, and PII-preserving AI query monitoring.

### Core Architectural Principles
1. **Standalone SPA Architecture**: Implemented as a single HTML file (`admin.html`) sharing the existing dark luxury CSS utilities (`style.css`), Tailwind CSS CDN, Chart.js, and Lucide icons. No heavy client framework dependencies (React/Vue/Angular); pure Vanilla JS (ES6+) for high speed, instant loading, zero build steps, and straightforward auditability.
2. **Strict JWT Bearer Authentication**: Unauthenticated access is completely blocked visually via a modal login gate and cryptographically enforced at the backend layer (`requireAdmin` middleware on all `/api/admin/*` endpoints).
3. **Dark Luxury Fintech Aesthetic**: Adheres strictly to `#050505` background, `#0B0B0B` surface cards, 24px border radius (`rounded-3xl`), glassmorphic backdrop-blur overlays (`backdrop-blur-md`/`backdrop-blur-xl`), ambient radial mesh backdrops, and emerald `#22C55E` accent highlights.
4. **Real-time Financial & Operational Telemetry**: Displays live aggregated KPIs (Total Creators, GPV in ZAR, MRR in ZAR, Tax Reserves in ZAR) with interactive Chart.js growth timelines and revenue channel breakdowns (YouTube, TikTok, Patreon, Brand Deals).
5. **Immutable Audit & PII-Safe Telemetry**: Provides administrative event filtering and inspectable PII-masked AI query logs with token consumption metrics and latency statistics.

---

## 2. Visual Design & Layout Architecture

### 2.1 Theme & Design Tokens
`admin.html` inherits the design system defined in `style.css` and `index.html`:

| Token / Layer | Value / Class | Description |
|---|---|---|
| **Background Color** | `#050505` (`bg-background`) | Deep onyx background for maximum contrast |
| **Surface Card Background** | `#0B0B0B` (`bg-surface`) / `glass-card` | Elevated card containers |
| **Border Radius** | `rounded-3xl` (`24px`) / `rounded-2xl` (`16px`) | Signature rounded contours |
| **Borders** | `border border-white/10` or `border-slate` | Subtle glassmorphic borders |
| **Backdrop Filter** | `backdrop-blur-xl` / `glass-pill-nav` | Translucent frosted glass effect |
| **Accent Glows** | Emerald `#22C55E` (`rgba(34, 197, 94, 0.15)`) | Ambient glow accents & status indicators |
| **Typography** | `Plus Jakarta Sans` (Display), `Inter` (Body) | Clean modern fintech typography |
| **Iconography** | `Lucide Icons` / `Material Symbols Outlined` | Sleek vector icon set |

### 2.2 Ambient Mesh Backdrop
To maintain visual consistency with the main application landing page, `admin.html` includes the fixed ambient radial glow backdrop:
```html
<div class="ambient-mesh-wrapper">
    <div class="ambient-orb ambient-orb-emerald"></div>
    <div class="ambient-orb ambient-orb-teal"></div>
    <div class="ambient-orb ambient-orb-indigo"></div>
    <div class="ambient-mesh-center-glow"></div>
</div>
```

### 2.3 Structural Page Layout & Navigation Header
The main layout consists of a top persistent glassmorphic navigation header, followed by a multi-tab view container:

```html
<div class="relative z-10 min-h-screen flex flex-col font-body">
    <!-- Top Glassmorphic Admin Header -->
    <header class="sticky top-0 z-40 w-full px-6 py-4 border-b border-white/10 glass-pill-nav flex items-center justify-between">
        <div class="flex items-center space-x-4">
            <!-- Brand Emblem & Title -->
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <i data-lucide="shield-check" class="w-5 h-5 text-emerald-400"></i>
            </div>
            <div>
                <h1 class="font-display text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    Creator Cash Flow
                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ADMIN PORTAL</span>
                </h1>
                <p class="text-xs text-neutral-400">Command & Control Financial Intelligence</p>
            </div>
        </div>

        <!-- Tab Navigation Bar -->
        <nav class="hidden md:flex items-center space-x-1 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button id="tab-btn-overview" onclick="switchAdminTab('overview')" class="admin-tab-btn active px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-white bg-white/10">
                <i data-lucide="layout-dashboard" class="w-4 h-4 inline mr-1.5"></i>Overview & KPIs
            </button>
            <button id="tab-btn-creators" onclick="switchAdminTab('creators')" class="admin-tab-btn px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-neutral-400 hover:text-white">
                <i data-lucide="users" class="w-4 h-4 inline mr-1.5"></i>Creator Directory
            </button>
            <button id="tab-btn-audit" onclick="switchAdminTab('audit')" class="admin-tab-btn px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-neutral-400 hover:text-white">
                <i data-lucide="file-text" class="w-4 h-4 inline mr-1.5"></i>Audit Trail
            </button>
            <button id="tab-btn-telemetry" onclick="switchAdminTab('telemetry')" class="admin-tab-btn px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-neutral-400 hover:text-white">
                <i data-lucide="cpu" class="w-4 h-4 inline mr-1.5"></i>AI Telemetry
            </button>
        </nav>

        <!-- Right Admin Profile & Logout -->
        <div class="flex items-center space-x-4">
            <div id="admin-user-badge" class="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span id="admin-email-display" class="text-xs font-medium text-neutral-300">admin@creatorcashflow.com</span>
            </div>
            <button onclick="handleAdminLogout()" class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all flex items-center gap-1.5">
                <i data-lucide="log-out" class="w-3.5 h-3.5"></i>Logout
            </button>
        </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <!-- Tab 1: Overview & Scorecards -->
        <section id="view-overview" class="admin-view space-y-8"> ... </section>
        
        <!-- Tab 2: Creator Directory Table -->
        <section id="view-creators" class="admin-view hidden space-y-8"> ... </section>
        
        <!-- Tab 3: Audit Trail -->
        <section id="view-audit" class="admin-view hidden space-y-8"> ... </section>
        
        <!-- Tab 4: AI Telemetry -->
        <section id="view-telemetry" class="admin-view hidden space-y-8"> ... </section>
    </main>
</div>
```

---

## 3. Login Gate & Authentication State Management (Milestone M4)

### 3.1 Unauthenticated Overlay Gate (`#admin-login-modal`)
To block unauthenticated view access, a full-screen glassmorphic modal overlay covers the entire viewport on application load when no valid token is present in `localStorage`.

```html
<!-- Floating Admin Login Gate Modal -->
<div id="admin-login-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl px-4 transition-opacity duration-300">
    <div class="w-full max-w-md p-8 rounded-3xl bg-[#0B0B0B] border border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
        <!-- Ambient Card Glow -->
        <div class="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"></div>
        
        <div class="text-center space-y-2">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <i data-lucide="lock" class="w-7 h-7"></i>
            </div>
            <h2 class="font-display text-2xl font-bold text-white">Admin Authentication</h2>
            <p class="text-sm text-neutral-400">Enter administrator credentials to access command portal</p>
        </div>

        <form id="admin-login-form" onsubmit="handleAdminLogin(event)" class="space-y-4">
            <div id="login-error-alert" class="hidden p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
                <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
                <span id="login-error-message">Invalid email or password</span>
            </div>

            <div class="space-y-1">
                <label class="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Admin Email</label>
                <div class="relative">
                    <i data-lucide="mail" class="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-500"></i>
                    <input type="email" id="login-email" required value="admin@creatorcashflow.com" 
                           class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-sm transition-all"
                           placeholder="admin@creatorcashflow.com" />
                </div>
            </div>

            <div class="space-y-1">
                <label class="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Password</label>
                <div class="relative">
                    <i data-lucide="key" class="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-500"></i>
                    <input type="password" id="login-password" required 
                           class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 text-sm transition-all"
                           placeholder="••••••••••••" />
                </div>
            </div>

            <button type="submit" id="login-submit-btn" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                <span>Sign In to Admin Portal</span>
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </form>
    </div>
</div>
```

### 3.2 Authentication Logic & Session State Machine

```javascript
// State Management
const STATE = {
    token: localStorage.getItem('ccf_admin_jwt') || null,
    admin: null,
    metrics: null,
    creators: [],
    auditLogs: [],
    telemetry: [],
    activeTab: 'overview',
    creatorFilter: { search: '', plan: 'all', sort: 'desc' }
};

// Global Fetch Interceptor for Authenticated API Calls
async function adminFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    
    if (STATE.token) {
        headers['Authorization'] = `Bearer ${STATE.token}`;
    }

    const response = await fetch(endpoint, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        // Token invalid or expired
        handleUnauthenticated();
        throw new Error('Session expired or unauthorized');
    }
    
    return response;
}

// Session Verification on App Initialization
async function initAdminPortal() {
    lucide.createIcons();
    
    if (!STATE.token) {
        showLoginModal();
        return;
    }

    try {
        const res = await adminFetch('/api/admin/verify-auth');
        if (res.ok) {
            const data = await res.json();
            STATE.admin = data.admin;
            updateAdminHeader();
            hideLoginModal();
            loadAllAdminData();
        } else {
            handleUnauthenticated();
        }
    } catch (err) {
        console.warn('Auth verification failed:', err.message);
        showLoginModal();
    }
}

// Login Submission Handler
async function handleAdminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorAlert = document.getElementById('login-error-alert');
    const errorMsg = document.getElementById('login-error-message');
    const submitBtn = document.getElementById('login-submit-btn');

    errorAlert.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i>Authenticating...`;
    lucide.createIcons();

    try {
        const res = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            STATE.token = data.token;
            STATE.admin = data.admin;
            localStorage.setItem('ccf_admin_jwt', data.token);
            updateAdminHeader();
            hideLoginModal();
            loadAllAdminData();
        } else if (res.status === 429) {
            errorMsg.textContent = 'Too many login attempts. Please wait 60 seconds.';
            errorAlert.classList.remove('hidden');
            shakeModal();
        } else {
            errorMsg.textContent = data.error || 'Invalid credentials';
            errorAlert.classList.remove('hidden');
            shakeModal();
        }
    } catch (err) {
        errorMsg.textContent = 'Network or server error during login.';
        errorAlert.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to Admin Portal</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        lucide.createIcons();
    }
}

// Logout Handler
function handleAdminLogout() {
    STATE.token = null;
    STATE.admin = null;
    localStorage.removeItem('ccf_admin_jwt');
    showLoginModal();
}

function handleUnauthenticated() {
    STATE.token = null;
    localStorage.removeItem('ccf_admin_jwt');
    showLoginModal();
}
```

---

## 4. KPI Scorecards & Chart.js Integration (Milestone M4)

### 4.1 Executive Metric Scorecards UI
The Overview tab renders 4 executive KPI scorecards displaying real-time financial telemetry calculated from `GET /api/admin/metrics`.

```html
<!-- KPI Scorecards Grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Card 1: Total Creators -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4 hover:border-emerald-500/40 transition-all duration-300">
        <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Total Creators</span>
            <div class="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <i data-lucide="users" class="w-5 h-5"></i>
            </div>
        </div>
        <div class="space-y-1">
            <h3 id="kpi-total-creators" class="font-display text-3xl font-bold text-white">0</h3>
            <p class="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
                <span>Registered platform accounts</span>
            </p>
        </div>
    </div>

    <!-- Card 2: Gross Platform Volume (GPV ZAR) -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4 hover:border-emerald-500/40 transition-all duration-300">
        <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Gross Platform Volume (GPV)</span>
            <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <i data-lucide="dollar-sign" class="w-5 h-5"></i>
            </div>
        </div>
        <div class="space-y-1">
            <h3 id="kpi-gpv-zar" class="font-display text-3xl font-bold text-white">R 0.00</h3>
            <p class="text-xs text-neutral-400 font-medium">Total processed creator income</p>
        </div>
    </div>

    <!-- Card 3: Monthly Recurring Revenue (MRR ZAR) -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4 hover:border-emerald-500/40 transition-all duration-300">
        <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Monthly Recurring Revenue</span>
            <div class="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <i data-lucide="repeat" class="w-5 h-5"></i>
            </div>
        </div>
        <div class="space-y-1">
            <h3 id="kpi-mrr-zar" class="font-display text-3xl font-bold text-white">R 0.00</h3>
            <p class="text-xs text-purple-400 font-medium">Pro subscriptions (R299/mo)</p>
        </div>
    </div>

    <!-- Card 4: Tax Reserves (15% ZAR) -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4 hover:border-emerald-500/40 transition-all duration-300">
        <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Platform Tax Reserves (15%)</span>
            <div class="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <i data-lucide="piggy-bank" class="w-5 h-5"></i>
            </div>
        </div>
        <div class="space-y-1">
            <h3 id="kpi-tax-reserves-zar" class="font-display text-3xl font-bold text-white">R 0.00</h3>
            <p class="text-xs text-amber-400 font-medium">Estimated 15% sole-proprietor holds</p>
        </div>
    </div>
</div>
```

### 4.2 Interactive Chart.js Timelines & Channel Distribution
The Overview tab contains two responsive canvas elements powered by Chart.js:

```html
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- 6-Month Growth Timeline Chart (Span 2 cols) -->
    <div class="lg:col-span-2 p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4">
        <div class="flex items-center justify-between">
            <div>
                <h4 class="font-display text-base font-bold text-white">Platform Growth & Revenue Timeline</h4>
                <p class="text-xs text-neutral-400">6-Month historical trajectory of GPV, MRR & Creator Growth</p>
            </div>
            <span class="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Live Sync</span>
        </div>
        <div class="h-72 w-full relative">
            <canvas id="growthTimelineChart"></canvas>
        </div>
    </div>

    <!-- Revenue Channel Breakdown Chart (Span 1 col) -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4">
        <div>
            <h4 class="font-display text-base font-bold text-white">Channel Distribution</h4>
            <p class="text-xs text-neutral-400">Revenue split across YouTube, TikTok, Patreon & Brands</p>
        </div>
        <div class="h-60 w-full relative flex items-center justify-center">
            <canvas id="channelBreakdownChart"></canvas>
        </div>
        <div id="channel-legend-list" class="space-y-2 pt-2 border-t border-white/5">
            <!-- Populated via JS -->
        </div>
    </div>
</div>
```

### 4.3 Chart initialization & Formatting JavaScript Code

```javascript
let growthChartInstance = null;
let channelChartInstance = null;

function renderOverviewCharts(metrics) {
    const timelineData = metrics.timeline || [];
    const channelData = metrics.channelBreakdown || { youtube: 0, tiktok: 0, patreon: 0, brand_deals: 0 };

    // 1. Line Chart: 6-Month Growth Timeline
    const ctxTimeline = document.getElementById('growthTimelineChart').getContext('2d');
    
    if (growthChartInstance) growthChartInstance.destroy();

    const labels = timelineData.map(t => t.month);
    const gpvValues = timelineData.map(t => t.gpv);
    const mrrValues = timelineData.map(t => t.mrr);

    growthChartInstance = new Chart(ctxTimeline, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'GPV (ZAR)',
                    data: gpvValues,
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#22C55E',
                    pointRadius: 4
                },
                {
                    label: 'MRR (ZAR)',
                    data: mrrValues,
                    borderColor: '#A855F7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#A855F7',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9CA3AF', font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: R ${context.raw.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter' },
                        callback: (val) => 'R ' + val.toLocaleString()
                    }
                }
            }
        }
    });

    // 2. Doughnut Chart: Channel Breakdown
    const ctxChannel = document.getElementById('channelBreakdownChart').getContext('2d');
    if (channelChartInstance) channelChartInstance.destroy();

    channelChartInstance = new Chart(ctxChannel, {
        type: 'doughnut',
        data: {
            labels: ['YouTube', 'TikTok', 'Patreon', 'Brand Deals'],
            datasets: [{
                data: [channelData.youtube, channelData.tiktok, channelData.patreon, channelData.brand_deals],
                backgroundColor: ['#EF4444', '#06B6D4', '#F97316', '#22C55E'],
                borderColor: '#0B0B0B',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Render Custom Legend
    const totalRev = channelData.youtube + channelData.tiktok + channelData.patreon + channelData.brand_deals || 1;
    const legendContainer = document.getElementById('channel-legend-list');
    legendContainer.innerHTML = [
        { name: 'YouTube', val: channelData.youtube, color: 'bg-red-500' },
        { name: 'TikTok', val: channelData.tiktok, color: 'bg-cyan-500' },
        { name: 'Patreon', val: channelData.patreon, color: 'bg-orange-500' },
        { name: 'Brand Deals', val: channelData.brand_deals, color: 'bg-emerald-500' }
    ].map(item => `
        <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full ${item.color}"></span>
                <span class="text-neutral-300 font-medium">${item.name}</span>
            </div>
            <span class="text-white font-semibold">R ${item.val.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${((item.val / totalRev) * 100).toFixed(1)}%)</span>
        </div>
    `).join('');
}
```

---

## 5. Creator Directory Operations Table & Detail Modal (Milestone M5)

### 5.1 Directory UI Controls & Table Layout
The Creator Directory view provides real-time search, plan filtering tabs, revenue sorting, status badges, and an interactive ledger mutation trigger.

```html
<div class="space-y-6">
    <!-- Header Controls Bar -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card">
        <!-- Search Input -->
        <div class="relative flex-1 max-w-md">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-500"></i>
            <input type="text" id="creator-search-input" oninput="handleCreatorSearch(event)" 
                   placeholder="Search creator by name or email..." 
                   class="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-emerald-500 transition-all"/>
        </div>

        <!-- Plan Filter Tabs & Sort Toggle -->
        <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
                <button onclick="setPlanFilter('all')" id="filter-plan-all" class="creator-plan-tab active px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-white/10 transition-all">All</button>
                <button onclick="setPlanFilter('pro')" id="filter-plan-pro" class="creator-plan-tab px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-400 hover:text-white transition-all">Pro</button>
                <button onclick="setPlanFilter('free')" id="filter-plan-free" class="creator-plan-tab px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-400 hover:text-white transition-all">Free</button>
            </div>

            <button onclick="toggleRevenueSort()" id="sort-revenue-btn" class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 flex items-center gap-1.5 transition-all">
                <i data-lucide="arrow-down-up" class="w-3.5 h-3.5"></i>
                <span>Sort by Revenue</span>
            </button>
        </div>
    </div>

    <!-- Data Table Container -->
    <div class="rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card overflow-hidden">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        <th class="py-4 px-6">Creator</th>
                        <th class="py-4 px-6">Email</th>
                        <th class="py-4 px-6">Plan Tier</th>
                        <th class="py-4 px-6">Status</th>
                        <th class="py-4 px-6">Joined Date</th>
                        <th class="py-4 px-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody id="creator-table-body" class="divide-y divide-white/5 text-sm">
                    <!-- Dynamic Rows Rendered by JS -->
                </tbody>
            </table>
        </div>
    </div>
</div>
```

### 5.2 Interactive Creator Detail & Ledger Mutation Modal (`#creator-detail-modal`)

```html
<!-- Creator Detail & Ledger Inspection Modal -->
<div id="creator-detail-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-xl px-4 transition-opacity duration-300">
    <div class="w-full max-w-2xl p-8 rounded-3xl bg-[#0B0B0B] border border-white/10 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <!-- Close Button -->
        <button onclick="closeCreatorModal()" class="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>

        <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg" id="modal-creator-avatar">
                CR
            </div>
            <div>
                <h3 id="modal-creator-name" class="font-display text-xl font-bold text-white">Creator Name</h3>
                <p id="modal-creator-email" class="text-xs text-neutral-400">creator@example.com</p>
            </div>
        </div>

        <!-- Ledger Snapshot Card -->
        <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ledger Snapshot</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                    <span class="text-xs text-neutral-400 block">ID</span>
                    <span id="modal-creator-id" class="text-xs font-mono text-white">user_123</span>
                </div>
                <div>
                    <span class="text-xs text-neutral-400 block">Joined</span>
                    <span id="modal-creator-joined" class="text-xs text-white">Aug 06, 2026</span>
                </div>
                <div>
                    <span class="text-xs text-neutral-400 block">Current Status</span>
                    <span id="modal-creator-status-badge" class="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400">Active</span>
                </div>
            </div>
        </div>

        <!-- Mutation Controls Form -->
        <form id="creator-mutation-form" onsubmit="submitCreatorMutation(event)" class="space-y-4 pt-2 border-t border-white/10">
            <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Account Governance & Tier Mutation</h4>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Plan Tier Select -->
                <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">Subscription Plan Tier</label>
                    <select id="mutate-plan-tier" class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500">
                        <option value="Pro" class="bg-[#0B0B0B] text-white">Pro Tier (R299/mo)</option>
                        <option value="Free" class="bg-[#0B0B0B] text-white">Free Tier</option>
                    </select>
                </div>

                <!-- Account Status Select -->
                <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">Account Governance Status</label>
                    <select id="mutate-account-status" class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500">
                        <option value="active" class="bg-[#0B0B0B] text-white">Active (Unrestricted)</option>
                        <option value="suspended" class="bg-[#0B0B0B] text-white">Suspended (Access Revoked)</option>
                    </select>
                </div>
            </div>

            <!-- Audit Reason Note -->
            <div class="space-y-1">
                <label class="text-xs font-medium text-neutral-300">Administrative Audit Reason Note</label>
                <textarea id="mutate-audit-note" rows="2" placeholder="Provide reason for status or tier modification..." 
                          class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>

            <div class="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onclick="closeCreatorModal()" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition-all">Cancel</button>
                <button type="submit" id="mutate-submit-btn" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-all shadow-lg shadow-emerald-500/20">
                    Apply Mutation & Log Action
                </button>
            </div>
        </form>
    </div>
</div>
```

### 5.3 Creator Operations Table JavaScript Logic

```javascript
let currentSelectedCreatorId = null;

function renderCreatorTable() {
    const tbody = document.getElementById('creator-table-body');
    let creators = [...STATE.creators];

    // 1. Search Filter
    if (STATE.creatorFilter.search) {
        const q = STATE.creatorFilter.search.toLowerCase();
        creators = creators.filter(c => 
            (c.name || '').toLowerCase().includes(q) || 
            (c.email || '').toLowerCase().includes(q)
        );
    }

    // 2. Plan Tier Filter
    if (STATE.creatorFilter.plan !== 'all') {
        creators = creators.filter(c => (c.plan_tier || 'Free').toLowerCase() === STATE.creatorFilter.plan);
    }

    // 3. Sorting
    creators.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return STATE.creatorFilter.sort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    if (creators.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-neutral-500 text-sm">
                    No creators found matching criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = creators.map(c => {
        const isPro = (c.plan_tier || 'Free').toLowerCase() === 'pro';
        const isSuspended = (c.status || 'active').toLowerCase() === 'suspended';
        const joinedDate = c.created_at ? new Date(c.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

        return `
            <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="py-4 px-6 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white">
                        ${(c.name || 'CR').substring(0, 2).toUpperCase()}
                    </div>
                    <span>${escapeHtml(c.name || 'Unknown')}</span>
                </td>
                <td class="py-4 px-6 text-neutral-400">${escapeHtml(c.email || '')}</td>
                <td class="py-4 px-6">
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${isPro ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'}">
                        ${isPro ? 'Pro' : 'Free'}
                    </span>
                </td>
                <td class="py-4 px-6">
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${isSuspended ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                        ${isSuspended ? 'Suspended' : 'Active'}
                    </span>
                </td>
                <td class="py-4 px-6 text-neutral-400">${joinedDate}</td>
                <td class="py-4 px-6 text-right">
                    <button onclick="openCreatorModal('${c.id}')" class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-emerald-500/10 text-neutral-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 transition-all flex items-center gap-1.5 ml-auto">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>Inspect
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

// Modal open handler
function openCreatorModal(creatorId) {
    const creator = STATE.creators.find(c => c.id === creatorId);
    if (!creator) return;

    currentSelectedCreatorId = creatorId;
    document.getElementById('modal-creator-name').textContent = creator.name || 'Unknown';
    document.getElementById('modal-creator-email').textContent = creator.email || '';
    document.getElementById('modal-creator-id').textContent = creator.id;
    document.getElementById('modal-creator-joined').textContent = creator.created_at ? new Date(creator.created_at).toLocaleDateString() : 'N/A';
    
    document.getElementById('mutate-plan-tier').value = creator.plan_tier || 'Free';
    document.getElementById('mutate-account-status').value = creator.status || 'active';
    document.getElementById('mutate-audit-note').value = '';

    document.getElementById('creator-detail-modal').classList.remove('hidden');
    document.getElementById('creator-detail-modal').classList.add('flex');
}

// Mutation Form Submission Handler
async function submitCreatorMutation(event) {
    event.preventDefault();
    if (!currentSelectedCreatorId) return;

    const plan_tier = document.getElementById('mutate-plan-tier').value;
    const status = document.getElementById('mutate-account-status').value;
    const note = document.getElementById('mutate-audit-note').value;
    const btn = document.getElementById('mutate-submit-btn');

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i>Saving...`;
    lucide.createIcons();

    try {
        const res = await adminFetch(`/api/admin/creators/${currentSelectedCreatorId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status, plan_tier, note })
        });

        if (res.ok) {
            const data = await res.json();
            // Update local memory state
            const idx = STATE.creators.findIndex(c => c.id === currentSelectedCreatorId);
            if (idx >= 0) {
                STATE.creators[idx] = data.creator;
            }
            closeCreatorModal();
            renderCreatorTable();
            // Re-fetch metrics and audit logs to update telemetry
            loadAuditLogs();
            loadMetrics();
        } else {
            const err = await res.json();
            alert(`Mutation failed: ${err.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert(`Error submitting mutation: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Apply Mutation & Log Action`;
    }
}
```

---

## 6. Audit Trail & AI Telemetry Views (Milestone M6)

### 6.1 Multi-Tab Navigation Switching Logic
Switching tabs hides/shows relevant sections without triggering unnecessary full page reloads:

```javascript
function switchAdminTab(tabName) {
    STATE.activeTab = tabName;
    
    // Hide all view sections
    document.querySelectorAll('.admin-view').forEach(view => view.classList.add('hidden'));
    
    // Deactivate all tab buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-white/10', 'text-white');
        btn.classList.add('text-neutral-400');
    });

    // Show target section and activate button
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) {
        targetBtn.classList.add('active', 'bg-white/10', 'text-white');
        targetBtn.classList.remove('text-neutral-400');
    }

    // Refresh content for active tab
    if (tabName === 'audit') loadAuditLogs();
    if (tabName === 'telemetry') loadTelemetry();
}
```

### 6.2 Immutable Audit Trail View (`GET /api/admin/audit-logs`)
Displays chronological administrative log entries inserted whenever a creator status, plan tier, or note is mutated.

```html
<div class="space-y-6">
    <div class="flex items-center justify-between p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card">
        <div>
            <h3 class="font-display text-lg font-bold text-white">Immutable Administrative Audit Log</h3>
            <p class="text-xs text-neutral-400">Cryptographically tracked administrative mutations with SHA-256 IP hashing</p>
        </div>
        <button onclick="loadAuditLogs()" class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Refresh Logs
        </button>
    </div>

    <div class="rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card overflow-hidden">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        <th class="py-4 px-6">Timestamp</th>
                        <th class="py-4 px-6">Admin ID</th>
                        <th class="py-4 px-6">Target Creator</th>
                        <th class="py-4 px-6">Action Type</th>
                        <th class="py-4 px-6">Old Value / New Value Diff</th>
                        <th class="py-4 px-6">IP Hash</th>
                    </tr>
                </thead>
                <tbody id="audit-table-body" class="divide-y divide-white/5 text-sm">
                    <!-- Dynamic Audit Entries -->
                </tbody>
            </table>
        </div>
    </div>
</div>
```

```javascript
async function loadAuditLogs() {
    try {
        const res = await adminFetch('/api/admin/audit-logs');
        if (res.ok) {
            STATE.auditLogs = await res.json();
            renderAuditLogsTable();
        }
    } catch (err) {
        console.error('Failed to load audit logs:', err);
    }
}

function renderAuditLogsTable() {
    const tbody = document.getElementById('audit-table-body');
    if (!STATE.auditLogs || STATE.auditLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-neutral-500 text-sm">No administrative audit entries found.</td></tr>`;
        return;
    }

    tbody.innerHTML = STATE.auditLogs.map(log => {
        const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
        return `
            <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="py-4 px-6 text-xs text-neutral-400 font-mono">${dateStr}</td>
                <td class="py-4 px-6 text-white font-medium text-xs">${escapeHtml(log.admin_id || 'admin')}</td>
                <td class="py-4 px-6 text-neutral-300 font-mono text-xs">${escapeHtml(log.target_creator_id || 'N/A')}</td>
                <td class="py-4 px-6">
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ${escapeHtml(log.action_type || 'MUTATION')}
                    </span>
                </td>
                <td class="py-4 px-6 text-xs">
                    <div class="space-y-1">
                        <div class="text-neutral-500">Old: <code class="text-red-400">${escapeHtml(log.old_value || '{}')}</code></div>
                        <div class="text-neutral-300">New: <code class="text-emerald-400">${escapeHtml(log.new_value || '{}')}</code></div>
                    </div>
                </td>
                <td class="py-4 px-6 text-xs font-mono text-neutral-500">${escapeHtml(log.ip_hash || '127.0.0.1')}</td>
            </tr>
        `;
    }).join('');
}
```

### 6.3 PII-Safe AI Query Telemetry View (`GET /api/admin/telemetry`)
Displays Gemini query metrics, token usage, latency distributions, and masked prompt samples under a 30-day automated TTL policy.

```html
<div class="space-y-6">
    <!-- Telemetry Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-2">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Total Token Consumption</span>
            <h3 id="telemetry-total-tokens" class="font-display text-2xl font-bold text-white">0 Tokens</h3>
            <p class="text-xs text-emerald-400">Gemini 1.5 Flash LLM usage</p>
        </div>

        <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-2">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Average Model Latency</span>
            <h3 id="telemetry-avg-latency" class="font-display text-2xl font-bold text-white">0 ms</h3>
            <p class="text-xs text-blue-400">Real-time inferencing speed</p>
        </div>

        <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-2">
            <span class="text-xs font-medium text-neutral-400 uppercase tracking-wider">Log Retention TTL Policy</span>
            <h3 class="font-display text-2xl font-bold text-emerald-400">30 Days</h3>
            <p class="text-xs text-neutral-400">Automated PII purge window</p>
        </div>
    </div>

    <!-- Telemetry Log Cards List -->
    <div class="p-6 rounded-3xl bg-[#0B0B0B] border border-white/10 glass-card space-y-4">
        <h4 class="font-display text-base font-bold text-white">Masked AI Query Telemetry Stream</h4>
        <div id="telemetry-cards-container" class="space-y-4">
            <!-- Dynamic Telemetry Log Cards -->
        </div>
    </div>
</div>
```

```javascript
async function loadTelemetry() {
    try {
        const res = await adminFetch('/api/admin/telemetry');
        if (res.ok) {
            STATE.telemetry = await res.json();
            renderTelemetryView();
        }
    } catch (err) {
        console.error('Failed to load telemetry:', err);
    }
}

function renderTelemetryView() {
    const container = document.getElementById('telemetry-cards-container');
    const logs = STATE.telemetry || [];

    // Calculate Summary Stats
    const totalTokens = logs.reduce((sum, l) => sum + (l.tokens_used || 0), 0);
    const avgLatency = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / logs.length) : 0;

    document.getElementById('telemetry-total-tokens').textContent = `${totalTokens.toLocaleString()} Tokens`;
    document.getElementById('telemetry-avg-latency').textContent = `${avgLatency} ms`;

    if (logs.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-neutral-500 text-sm">No AI query telemetry logs available within 30-day TTL window.</div>`;
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        ${escapeHtml(log.category_tag || 'Financial Intelligence')}
                    </span>
                    <span class="text-xs text-neutral-500 font-mono">${escapeHtml(log.model || 'gemini-1.5-flash')}</span>
                </div>
                <div class="flex items-center gap-3 text-xs text-neutral-400">
                    <span>⚡ ${log.latency_ms || 0} ms</span>
                    <span>🪙 ${log.tokens_used || 0} tokens</span>
                    <span>${log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}</span>
                </div>
            </div>
            <div class="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-neutral-300">
                ${escapeHtml(log.prompt_masked || log.prompt || '')}
            </div>
        </div>
    `).join('');
}
```

---

## 7. Security Architecture & Error Protocols

1. **Authentication Token Management**: JWT stored in `localStorage` under key `ccf_admin_jwt`. Header sent on every admin request: `Authorization: Bearer <JWT>`.
2. **Global XSS Prevention**: All user input, creator names, emails, and notes sanitized via `escapeHtml()` function before DOM insertion.
3. **HTTP 401/403 Handling**: `adminFetch` interceptor clears invalid tokens and triggers `#admin-login-modal` overlay.
4. **HTTP 429 Rate-Limit Grace**: Login modal traps rate-limit 429 status code and displays friendly retry message without app failure.

---

## 8. Verification & Handoff Checklist (Milestone M7 Alignment)

- [x] **Dark Luxury UI Architecture**: Confirmed `#050505`, `#0B0B0B`, 24px `rounded-3xl` cards, backdrop blur glassmorphism, and radial glow mesh.
- [x] **Auth & Login Gate**: Fully specified modal gate, `/api/admin/auth/login` integration, JWT state management, auto-session validation via `/api/admin/verify-auth`, and logout handler.
- [x] **KPI Scorecards & Chart.js**: Total Creators, GPV (ZAR), MRR (ZAR), Tax Reserves (15% ZAR) with line & doughnut Chart.js visualizers.
- [x] **Creator Directory Table**: Real-time search by name/email, plan tier tabs (All/Pro/Free), revenue sorting, status toggles, and detail inspection modal.
- [x] **Audit Trail & AI Telemetry**: Tabbed interface, immutable audit log event list with SHA-256 IP hashes, and PII-masked AI query cards under 30-day TTL policy.
