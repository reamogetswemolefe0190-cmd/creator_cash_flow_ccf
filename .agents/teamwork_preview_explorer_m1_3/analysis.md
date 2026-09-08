# Analysis & Strategy Report: F3 - Arc Browser Hero Product Mockup

## Executive Summary
This analysis details the exact technical strategy for implementing **Feature F3: Arc Browser Hero Product Mockup** for Milestone M1 of Creator Cash Flow (CCF). The goal is to transform the static, single-card mockup in `index.html` into a sleek, interactive, multi-layered Arc Browser-inspired window frame with glassmorphic cards, live interactive toggle controls, floating stats badges, dynamic SVG chart rendering, 3D tilt micro-interactions, and responsive auto-scaling across viewports (375px to 1440px+).

---

## 1. Current State vs Target Architecture

### 1.1 Current Implementation (Baseline)
- **Location**: `index.html` (lines 153–187)
- **Structure**: A simple `<section>` wrapping a single `<div class="p-lg rounded-3xl bg-surface border border-white/[0.08] card-shadow">`.
- **Content**: Static text for "Net Profit R24,650" and a static 74% progress bar for YouTube.
- **Interactions**: None. Static presentation, lacks browser window frame, sidebar preview, floating badges, toggles, or tilt effects.

### 1.2 Target Architecture (F3 Arc & Framer Mockup)
Transform Section 2 into a high-fidelity interactive Arc Browser frame:
1. **Arc Window Chrome Header**:
   - macOS / Arc traffic light controls (red, yellow, green window action dots with hover glow).
   - Arc-style URL / search bar pill (`https://app.creatorcashflow.com/hq`) with lock security icon and tab control buttons.
2. **Arc Sidebar Preview Panel**:
   - Left-hand vertical tab navigation sidebar mimicking Arc Browser's space sidebar.
   - Interactive tab selectors (Overview, Revenue, Expenses, Insights) that switch inner card views.
3. **Multi-Layered Dashboard Canvas**:
   - Glassmorphic card layers with stacked depth, `backdrop-blur-xl`, and subtle border glows.
   - Live interactive state toggle: Monthly (`R24,650`) vs YTD (`R295,800`) / Net Margin (`82.3%`) switchers.
   - Real-time SVG cash flow curve sparkline with animated gradient fill.
4. **Floating Glassmorphic Badges**:
   - 3 floating notification/stats cards positioned over/around the browser window (e.g. `AdSense Payout +R18,420`, `Tax Deductions Saved R4,200`, `Net Margin 82.3%`).
   - CSS float keyframe animations for floating depth.
5. **Interactive 3D Perspective Tilt**:
   - Mouse movement tracking (`mousemove`) over the container calculating `rotateX` and `rotateY` for subtle 3D tilt depth (Framer motion style).
6. **Responsive Scaling Rules**:
   - Graceful adaptation on mobile (375px–640px) where badges stack inline, sidebar collapses to top icon bar, and 3D tilt disables for touch devices.

---

## 2. HTML Markup Strategy (`index.html`)

Replace lines 153–187 in `index.html` with the following semantic structure:

```html
<!-- Section 2: Arc Browser Hero Product Mockup (Feature F3) -->
<section class="mb-3xl max-w-4xl mx-auto px-xs sm:px-md relative z-10" id="hero-mockup-section">
    <!-- Outer Interactive 3D Perspective Container -->
    <div id="arc-hero-wrapper" class="relative group perspective-1000">
        
        <!-- Ambient Mesh Glow behind Mockup -->
        <div class="absolute -top-16 -left-16 w-72 h-72 bg-accent-emerald/15 rounded-full blur-[100px] pointer-events-none"></div>
        <div class="absolute -bottom-16 -right-16 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <!-- Floating Badge 1: Top-Right AdSense Live Sync -->
        <div class="floating-badge badge-top-right absolute -top-6 -right-2 sm:-top-8 sm:-right-8 z-30 bg-surface/90 backdrop-blur-xl border border-white/[0.12] p-sm sm:p-md rounded-2xl shadow-2xl flex items-center gap-sm animate-float">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent-emerald/20 border border-accent-emerald/40 flex items-center justify-center text-accent-emerald">
                <span class="material-symbols-outlined text-lg sm:text-xl">payments</span>
            </div>
            <div>
                <div class="flex items-center gap-xs">
                    <span class="w-2 h-2 rounded-full bg-accent-emerald animate-ping"></span>
                    <span class="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider">Live Sync</span>
                </div>
                <p class="text-xs sm:text-sm font-extrabold text-white">+R18,420 <span class="text-accent-emerald text-[11px] font-normal">AdSense</span></p>
            </div>
        </div>

        <!-- Floating Badge 2: Bottom-Left Smart Tax Guard -->
        <div class="floating-badge badge-bottom-left absolute -bottom-6 -left-2 sm:-bottom-8 sm:-left-8 z-30 bg-surface/90 backdrop-blur-xl border border-white/[0.12] p-sm sm:p-md rounded-2xl shadow-2xl flex items-center gap-sm animate-float-delayed">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <span class="material-symbols-outlined text-lg sm:text-xl">verified_user</span>
            </div>
            <div>
                <span class="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider">Tax Guard</span>
                <p class="text-xs sm:text-sm font-extrabold text-white">R4,200 <span class="text-indigo-400 text-[11px] font-normal">Deducted</span></p>
            </div>
        </div>

        <!-- Main Arc Browser Frame -->
        <div id="arc-browser-frame" class="relative rounded-2xl sm:rounded-3xl bg-surface/80 backdrop-blur-2xl border border-white/[0.1] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden transition-transform duration-200 ease-out">
            
            <!-- 1. Arc Window Header / Traffic Lights -->
            <div class="bg-black/60 border-b border-white/[0.08] px-md py-sm flex items-center justify-between select-none">
                <!-- Traffic Light Action Controls -->
                <div class="flex items-center gap-xs">
                    <span class="w-3 h-3 rounded-full bg-[#FF5F56] inline-block hover:opacity-80 transition-opacity"></span>
                    <span class="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block hover:opacity-80 transition-opacity"></span>
                    <span class="w-3 h-3 rounded-full bg-[#27C93F] inline-block hover:opacity-80 transition-opacity"></span>
                </div>

                <!-- Arc URL Bar Pill -->
                <div class="flex-1 max-w-md mx-md bg-white/[0.04] border border-white/[0.06] rounded-xl px-md py-xs flex items-center justify-center gap-xs text-xs text-text-secondary font-mono shadow-inner">
                    <span class="material-symbols-outlined text-accent-emerald text-sm">lock</span>
                    <span class="text-white/90">app.creatorcashflow.com</span>
                    <span class="text-text-secondary/60">/hq</span>
                </div>

                <!-- Window Actions -->
                <div class="flex items-center gap-xs text-text-secondary">
                    <button class="p-xs hover:text-white rounded-lg transition-colors" title="Sidebar Toggle" onclick="toggleArcSidebar()">
                        <span class="material-symbols-outlined text-sm">dock_to_right</span>
                    </button>
                    <button class="p-xs hover:text-white rounded-lg transition-colors" title="Reload Mockup" onclick="refreshHeroMockup()">
                        <span class="material-symbols-outlined text-sm">refresh</span>
                    </button>
                </div>
            </div>

            <!-- 2. Inner Arc Browser Workspace Layout (Sidebar + Main Canvas) -->
            <div class="flex min-h-[340px] sm:min-h-[400px]">
                
                <!-- Arc Left Sidebar Preview (Collapsible on mobile) -->
                <aside id="arc-sidebar-preview" class="w-48 bg-black/40 border-r border-white/[0.06] p-md flex flex-col justify-between hidden md:flex select-none">
                    <div class="space-y-md">
                        <div class="flex items-center gap-xs px-xs text-xs font-bold text-text-secondary uppercase tracking-wider">
                            <span class="material-symbols-outlined text-accent-emerald text-base">dashboard</span>
                            <span>Spaces</span>
                        </div>
                        <nav class="space-y-xs text-xs">
                            <button class="arc-tab-btn active w-full flex items-center justify-between px-sm py-xs rounded-xl bg-white/[0.08] text-white font-semibold border border-white/[0.08] transition-all" data-tab="overview" onclick="switchHeroMockupTab('overview')">
                                <span class="flex items-center gap-xs">
                                    <span class="material-symbols-outlined text-sm text-accent-emerald">space_dashboard</span>
                                    Overview
                                </span>
                                <span class="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
                            </button>
                            <button class="arc-tab-btn w-full flex items-center justify-between px-sm py-xs rounded-xl text-text-secondary hover:text-white hover:bg-white/[0.03] transition-all" data-tab="revenue" onclick="switchHeroMockupTab('revenue')">
                                <span class="flex items-center gap-xs">
                                    <span class="material-symbols-outlined text-sm">trending_up</span>
                                    Streams
                                </span>
                                <span class="text-[10px] bg-white/[0.08] px-xs rounded text-text-secondary">3</span>
                            </button>
                            <button class="arc-tab-btn w-full flex items-center justify-between px-sm py-xs rounded-xl text-text-secondary hover:text-white hover:bg-white/[0.03] transition-all" data-tab="tax" onclick="switchHeroMockupTab('tax')">
                                <span class="flex items-center gap-xs">
                                    <span class="material-symbols-outlined text-sm">shield</span>
                                    Tax Guard
                                </span>
                                <span class="text-[10px] text-accent-emerald font-bold">Safe</span>
                            </button>
                        </nav>
                    </div>

                    <!-- Bottom Status Indicator -->
                    <div class="pt-sm border-t border-white/[0.06] flex items-center gap-xs text-[11px] text-text-secondary">
                        <span class="w-2 h-2 rounded-full bg-accent-emerald"></span>
                        <span>Phyllo Engine v2</span>
                    </div>
                </aside>

                <!-- Main Canvas Content -->
                <div class="flex-1 p-md sm:p-lg space-y-md bg-background/50">
                    
                    <!-- Top Bar: Title & Live Balance Status Toggle -->
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm">
                        <div>
                            <div class="flex items-center gap-xs">
                                <h4 class="font-display font-bold text-sm sm:text-base text-white" id="hero-mockup-tab-title">Creator Cash Flow Command Center</h4>
                            </div>
                            <p class="text-xs text-text-secondary">Real-time consolidated profit intelligence</p>
                        </div>

                        <!-- Live Interactive View Selector Toggle -->
                        <div class="flex items-center bg-black/50 border border-white/[0.08] p-1 rounded-xl text-xs select-none">
                            <button id="toggle-btn-monthly" class="px-sm py-1 rounded-lg font-semibold bg-accent-emerald text-black shadow transition-all" onclick="setHeroMockupPeriod('monthly')">
                                Monthly
                            </button>
                            <button id="toggle-btn-annual" class="px-sm py-1 rounded-lg font-semibold text-text-secondary hover:text-white transition-all" onclick="setHeroMockupPeriod('annual')">
                                Annual
                            </button>
                        </div>
                    </div>

                    <!-- Metrics Cards Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
                        
                        <!-- Metric Card 1: Net Profit -->
                        <div class="p-md bg-surface/90 border border-white/[0.08] rounded-2xl space-y-xs relative overflow-hidden group/card hover:border-accent-emerald/40 transition-all">
                            <div class="flex justify-between items-center text-xs text-text-secondary uppercase tracking-wider font-semibold">
                                <span id="hero-mockup-period-label">Net Profit (July)</span>
                                <span class="material-symbols-outlined text-accent-emerald">trending_up</span>
                            </div>
                            <div class="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight" id="hero-mockup-balance-display">
                                R24,650
                            </div>
                            <div class="flex items-center gap-xs text-xs text-accent-emerald font-semibold">
                                <span class="material-symbols-outlined text-sm">north_east</span>
                                <span id="hero-mockup-growth-tag">+18.4% vs last month</span>
                            </div>
                        </div>

                        <!-- Metric Card 2: Revenue Breakdown -->
                        <div class="p-md bg-surface/90 border border-white/[0.08] rounded-2xl space-y-xs hover:border-white/[0.15] transition-all">
                            <div class="flex justify-between items-center text-xs text-text-secondary uppercase tracking-wider font-semibold">
                                <span>Platform Split</span>
                                <span class="text-white font-bold" id="hero-mockup-top-platform">YouTube 74%</span>
                            </div>
                            <div class="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden flex">
                                <div id="bar-youtube" class="h-full bg-accent-emerald transition-all duration-500" style="width: 74%;"></div>
                                <div id="bar-tiktok" class="h-full bg-indigo-500 transition-all duration-500" style="width: 18%;"></div>
                                <div id="bar-brand" class="h-full bg-amber-400 transition-all duration-500" style="width: 8%;"></div>
                            </div>
                            <div class="flex justify-between items-center text-[11px] text-text-secondary pt-1">
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-accent-emerald"></span> YouTube</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> TikTok</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span> Brands</span>
                            </div>
                        </div>
                    </div>

                    <!-- Mini Live Cash Flow Sparkline Card -->
                    <div class="p-md bg-surface/90 border border-white/[0.08] rounded-2xl space-y-xs">
                        <div class="flex justify-between items-center text-xs text-text-secondary">
                            <span class="font-semibold uppercase tracking-wider">7-Day Profit Velocity</span>
                            <span class="text-accent-emerald font-bold text-xs" id="hero-mockup-peak">Peak R24,650</span>
                        </div>
                        <div class="w-full h-20 relative pt-2">
                            <!-- SVG Sparkline Chart -->
                            <svg class="w-full h-full overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="heroChartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#22C55E" stop-opacity="0.35"/>
                                        <stop offset="100%" stop-color="#22C55E" stop-opacity="0.0"/>
                                    </linearGradient>
                                </defs>
                                <path id="hero-chart-area" d="M 0,50 Q 50,45 100,30 T 200,20 T 300,5 L 300,60 L 0,60 Z" fill="url(#heroChartGradient)" />
                                <path id="hero-chart-line" d="M 0,50 Q 50,45 100,30 T 200,20 T 300,5" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round" />
                                <circle cx="300" cy="5" r="4" fill="#22C55E" class="animate-pulse" />
                            </svg>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</section>
```

---

## 3. CSS Styling & Animation Rules (`style.css`)

Add the following CSS rules to `style.css` for 3D perspective, glassmorphic floating badges, and custom keyframes:

```css
/* ==========================================================================
   FEATURE F3: ARC BROWSER HERO MOCKUP STYLING & ANIMATIONS
   ========================================================================== */

.perspective-1000 {
    perspective: 1000px;
}

/* Floating Badge Animations */
@keyframes floatBadge {
    0%, 100% {
        transform: translateY(0px) rotate(0deg);
    }
    50% {
        transform: translateY(-8px) rotate(1deg);
    }
}

@keyframes floatBadgeDelayed {
    0%, 100% {
        transform: translateY(0px) rotate(0deg);
    }
    50% {
        transform: translateY(-6px) rotate(-1deg);
    }
}

.animate-float {
    animation: floatBadge 4s ease-in-out infinite;
}

.animate-float-delayed {
    animation: floatBadgeDelayed 5s ease-in-out 1.5s infinite;
}

/* Arc Tab Active State */
.arc-tab-btn.active {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #FFFFFF !important;
}

/* Responsive Touch Handling */
@media (pointer: coarse), (max-width: 640px) {
    .perspective-1000 {
        perspective: none !important;
    }
    #arc-browser-frame {
        transform: none !important;
    }
}
```

---

## 4. JavaScript Logic & Interaction Controllers (`app.js`)

Implement the state handlers and mouse movement listeners in `app.js`:

```javascript
// ==========================================================================
// FEATURE F3: ARC HERO MOCKUP CONTROLLER & 3D TILT
// ==========================================================================

let heroMockupState = {
    period: 'monthly', // 'monthly' | 'annual'
    activeTab: 'overview' // 'overview' | 'revenue' | 'tax'
};

const HERO_MOCKUP_DATA = {
    monthly: {
        balance: 'R24,650',
        periodLabel: 'Net Profit (July)',
        growth: '+18.4% vs last month',
        topPlatform: 'YouTube 74%',
        bars: { youtube: '74%', tiktok: '18%', brand: '8%' },
        peak: 'Peak R24,650',
        linePath: 'M 0,50 Q 50,45 100,30 T 200,20 T 300,5',
        areaPath: 'M 0,50 Q 50,45 100,30 T 200,20 T 300,5 L 300,60 L 0,60 Z'
    },
    annual: {
        balance: 'R295,800',
        periodLabel: 'Net Profit (YTD 2026)',
        growth: '+34.2% YoY Growth',
        topPlatform: 'YouTube 70%',
        bars: { youtube: '70%', tiktok: '20%', brand: '10%' },
        peak: 'Peak R295,800',
        linePath: 'M 0,55 Q 50,40 100,25 T 200,15 T 300,2',
        areaPath: 'M 0,55 Q 50,40 100,25 T 200,15 T 300,2 L 300,60 L 0,60 Z'
    }
};

function setupHeroMockupInteractions() {
    const wrapper = document.getElementById('arc-hero-wrapper');
    const frame = document.getElementById('arc-browser-frame');
    if (!wrapper || !frame) return;

    // 3D Tilt on Mousemove
    wrapper.addEventListener('mousemove', (e) => {
        if (window.innerWidth < 640 || window.matchMedia('(pointer: coarse)').matches) return;
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -6; // max 6deg
        const rotateY = ((x - centerX) / centerX) * 6;  // max 6deg

        frame.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
    });

    wrapper.addEventListener('mouseleave', () => {
        frame.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
}

function setHeroMockupPeriod(period) {
    heroMockupState.period = period;
    const btnMonthly = document.getElementById('toggle-btn-monthly');
    const btnAnnual = document.getElementById('toggle-btn-annual');
    const data = HERO_MOCKUP_DATA[period];

    if (period === 'monthly') {
        btnMonthly.className = 'px-sm py-1 rounded-lg font-semibold bg-accent-emerald text-black shadow transition-all';
        btnAnnual.className = 'px-sm py-1 rounded-lg font-semibold text-text-secondary hover:text-white transition-all';
    } else {
        btnAnnual.className = 'px-sm py-1 rounded-lg font-semibold bg-accent-emerald text-black shadow transition-all';
        btnMonthly.className = 'px-sm py-1 rounded-lg font-semibold text-text-secondary hover:text-white transition-all';
    }

    // Dynamic Text Updates
    const elBalance = document.getElementById('hero-mockup-balance-display');
    const elLabel = document.getElementById('hero-mockup-period-label');
    const elGrowth = document.getElementById('hero-mockup-growth-tag');
    const elTopPlatform = document.getElementById('hero-mockup-top-platform');
    const elPeak = document.getElementById('hero-mockup-peak');

    if (elBalance) elBalance.innerText = data.balance;
    if (elLabel) elLabel.innerText = data.periodLabel;
    if (elGrowth) elGrowth.innerText = data.growth;
    if (elTopPlatform) elTopPlatform.innerText = data.topPlatform;
    if (elPeak) elPeak.innerText = data.peak;

    // Bar Progress Animations
    const barYT = document.getElementById('bar-youtube');
    const barTT = document.getElementById('bar-tiktok');
    const barBD = document.getElementById('bar-brand');
    if (barYT) barYT.style.width = data.bars.youtube;
    if (barTT) barTT.style.width = data.bars.tiktok;
    if (barBD) barBD.style.width = data.bars.brand;

    // SVG Line Animate
    const linePath = document.getElementById('hero-chart-line');
    const areaPath = document.getElementById('hero-chart-area');
    if (linePath) linePath.setAttribute('d', data.linePath);
    if (areaPath) areaPath.setAttribute('d', data.areaPath);
}

function switchHeroMockupTab(tabName) {
    heroMockupState.activeTab = tabName;
    document.querySelectorAll('.arc-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active', 'bg-white/[0.08]', 'text-white');
            btn.classList.remove('text-text-secondary');
        } else {
            btn.classList.remove('active', 'bg-white/[0.08]', 'text-white');
            btn.classList.add('text-text-secondary');
        }
    });

    const titleEl = document.getElementById('hero-mockup-tab-title');
    if (titleEl) {
        if (tabName === 'overview') titleEl.innerText = 'Creator Cash Flow Command Center';
        if (tabName === 'revenue') titleEl.innerText = 'Consolidated Revenue Streams';
        if (tabName === 'tax') titleEl.innerText = 'Tax Deduction & Savings Engine';
    }
}

function toggleArcSidebar() {
    const sidebar = document.getElementById('arc-sidebar-preview');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
}

function refreshHeroMockup() {
    setHeroMockupPeriod(heroMockupState.period);
}

// Ensure initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    setupHeroMockupInteractions();
});
```

---

## 5. Responsive & Cross-Viewport Validation Matrix

| Viewport Width | Arc Header | Sidebar Preview | Floating Badges | 3D Tilt |
|----------------|------------|-----------------|-----------------|---------|
| **375px (iPhone SE)** | Compact traffic lights + URL bar | Collapsed (hidden) | Positioned inline inside relative bounds (`-top-6 -right-2`) | Disabled (touch friendly) |
| **390px / 430px (iPhone 14)** | Full URL bar | Collapsed (hidden) | Scale gracefully without horizontal overflow | Disabled |
| **768px (iPad / Tablet)** | Full URL bar | Collapsed toggleable | Extended absolute positioning | Subtle 3D tilt active |
| **1024px+ (Desktop)** | Full browser chrome | Expanded vertical tabs | Full floating offset (-top-8 -right-8) | Active 3D tilt (max 6deg) |

---

## 6. Risk Assessment & Mitigations

1. **Risk**: Horizontal scrollbar overflow caused by absolute floating badges on narrow mobile screens (375px).
   - **Mitigation**: Constrain negative offsets to `-top-6 -right-2` on mobile, and apply `overflow-x-hidden` on parent body container.
2. **Risk**: Performance jank during 3D tilt mouse movement.
   - **Mitigation**: Use `transform: rotateX(...) rotateY(...)` with CSS hardware acceleration (`will-change: transform`), limit rotation angle to max 6deg, and disable tilt on touch devices.
3. **Risk**: JS error if elements are missing during view switching.
   - **Mitigation**: Defensive null guards (`if (element) ...`) on all DOM selector queries in JS handlers.
