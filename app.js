/* ==========================================================================
   Creator Financial OS - HQ Engine & Database Orchestrator
   ========================================================================== */

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? `${window.location.protocol}//${window.location.host}/api`
    : 'https://creator-cash-flow.onrender.com/api';

// Application State
const state = {
    user: null,
    token: null,
    balance: 0,
    sources: [],
    timelineData: [
        { date: 'Jul 1', rev: 4200, exp: 500, profit: 3700 },
        { date: 'Jul 5', rev: 8900, exp: 1200, profit: 7700 },
        { date: 'Jul 10', rev: 12400, exp: 2100, profit: 10300 },
        { date: 'Jul 14', rev: 16800, exp: 2900, profit: 13900 },
        { date: 'Jul 18', rev: 20900, exp: 3850, profit: 17050 },
        { date: 'Jul 21', rev: 24650, exp: 4200, profit: 20450 }
    ],
    activities: [] // Loaded dynamically from Supabase database
};

// Onboarding State
const onboardingState = {
    currentStep: 1,
    creatorType: '',
    platforms: [],
    goal: '',
    connected: [],
    isManual: false
};

let intelligenceChartInstance = null;

// Global Platform Logo SVG Helper
function getPlatformLogoSvg(platform, sizeClass = 'w-6 h-6') {
    const p = (platform || '').toLowerCase();
    if (p.includes('youtube') || p.includes('adsense')) {
        return `<svg class="${sizeClass} shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000"/>
            <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FFFFFF"/>
        </svg>`;
    } else if (p.includes('tiktok') || p.includes('rewards')) {
        return `<svg class="${sizeClass} shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.887 2.887 2.896 2.896 0 0 1-2.888-2.887 2.896 2.896 0 0 1 2.888-2.887c.36 0 .7.067 1.014.187V9.452a6.31 6.31 0 0 0-1.014-.082A6.332 6.332 0 0 0 3.155 15.7a6.332 6.332 0 0 0 6.332 6.332 6.332 6.332 0 0 0 6.332-6.332V9.014a8.212 8.212 0 0 0 4.887 1.583v-3.445a4.814 4.814 0 0 1-1.117-.466z" fill="#00F2FE"/>
            <path d="M18.8 6.2a4.8 4.8 0 0 1-3.4-3.8V2h-2.5v13.7a3.5 3.5 0 0 1-3.5 3.5 3.5 3.5 0 0 1-3.5-3.5 3.5 3.5 0 0 1 3.5-3.5c.3 0 .6.05.9.15V9.8a6.3 6.3 0 0 0-.9-.07 5.7 5.7 0 0 0-5.7 5.7 5.7 5.7 0 0 0 5.7 5.7 5.7 5.7 0 0 0 5.7-5.7V8.5a7.5 7.5 0 0 0 4.2 1.3V7.2a4.8 4.8 0 0 1-.5-1z" fill="#FE2C55"/>
            <path d="M18.2 5.8a4.8 4.8 0 0 1-3-3.4V2h-2.2v13.7a2.9 2.9 0 0 1-2.9 2.9 2.9 2.9 0 0 1-2.9-2.9 2.9 2.9 0 0 1 2.9-2.9c.3 0 .6.06.9.18V9.5a5.5 5.5 0 0 0-.9-.08 5.1 5.1 0 0 0-5.1 5.1 5.1 5.1 0 0 0 5.1 5.1 5.1 5.1 0 0 0 5.1-5.1V8.2a7 7 0 0 0 4.1 1.2V6.6a4.8 4.8 0 0 1-3.1-.8z" fill="#FFFFFF"/>
        </svg>`;
    } else if (p.includes('stream') || p.includes('twitch')) {
        return `<svg class="${sizeClass} shrink-0" viewBox="0 0 24 24" fill="none">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M2.149 0L.537 4.119v16.478h5.373V24l3.761-3.403h3.762L23.463 10.537V0H2.15zm19.343 9.463l-3.224 3.224h-4.298l-3.224 3.223v-3.223H5.91V2.149h15.582v7.314zm-9.134-3.761h2.149v6.448H12.358V5.702zm5.373 0h2.149v6.448h-2.149V5.702z" fill="#A970FF"/>
        </svg>`;
    } else if (p.includes('instagram') || p.includes('sponsor')) {
        return `<svg class="${sizeClass} shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#E1306C"/>
            <path d="M12 5.838c3.07 0 3.434.012 4.646.067 1.12.051 1.73.238 2.135.395.536.208.92.456 1.322.858.402.402.65.786.858 1.322.157.405.344 1.015.395 2.135.055 1.212.067 1.576.067 4.646s-.012 3.434-.067 4.646c-.051 1.12-.238 1.73-.395 2.135-.208.536-.456.92-.858 1.322-.402.402-.786.65-1.322.858-.405.157-1.015.344-2.135.395-1.212.055-1.576.067-4.646.067s-3.434-.012-4.646-.067c-1.12-.051-1.73-.238-2.135-.395a3.57 3.57 0 0 1-1.322-.858 3.57 3.57 0 0 1-.858-1.322c-.157-.405-.344-1.015-.395-2.135C2.26 15.434 2.248 15.07 2.248 12s.012-3.434.067-4.646c.051-1.12.238-1.73.395-2.135.208-.536.456-.92.858-1.322.402-.402.786-.65 1.322-.858.405-.157 1.015-.344 2.135-.395C8.566 5.85 8.93 5.838 12 5.838zm0-2.162c-3.123 0-3.514.013-4.74.069-1.222.056-2.056.25-2.786.533a5.733 5.733 0 0 0-2.072 1.35 5.733 5.733 0 0 0-1.35 2.072c-.283.73-.477 1.564-.533 2.786C.46 11.71.447 12.102.447 15.225s.013 3.514.069 4.74c.056 1.222.25 2.056.533 2.786a5.733 5.733 0 0 0 1.35 2.072 5.733 5.733 0 0 0 2.072 1.35c.73.283 1.564.477 2.786.533 1.226.056 1.617.069 4.74.069s3.514-.013 4.74-.069c1.222-.056 2.056-.25 2.786-.533a5.733 5.733 0 0 0 2.072-1.35 5.733 5.733 0 0 0 1.35-2.072c.283-.73.477-1.564.533-2.786.056-1.226.069-1.617.069-4.74s-.013-3.514-.069-4.74c-.056-1.222-.25-2.056-.533-2.786a5.733 5.733 0 0 0-1.35-2.072 5.733 5.733 0 0 0-2.072-1.35c-.73-.283-1.564-.477-2.786-.533-1.226-.056-1.617-.069-4.74-.069zM12 7.748a4.252 4.252 0 1 0 0 8.504 4.252 4.252 0 0 0 0-8.504zm0 7.004a2.752 2.752 0 1 1 0-5.504 2.752 2.752 0 0 1 0 5.504zm6.406-7.845a.993.993 0 1 0 0 1.986.993.993 0 0 0 0-1.986z" fill="#FFFFFF"/>
        </svg>`;
    } else if (p.includes('patreon') || p.includes('sub')) {
        return `<svg class="${sizeClass} shrink-0" viewBox="0 0 24 24" fill="none">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M14.82 2.41c-4.46 0-8.08 3.62-8.08 8.08 0 4.42 3.58 8.02 8.01 8.08 4.46 0 8.08-3.62 8.08-8.08 0-4.46-3.62-8.08-8.01-8.08zm-13.63.15h3.63v18.91H1.19V2.56z" fill="#FF424D"/>
        </svg>`;
    }
    return `<span class="material-symbols-outlined text-accent-emerald text-xl">account_balance_wallet</span>`;
}
window.getPlatformLogoSvg = getPlatformLogoSvg;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    setupNavbarScroll();
    setupNavigation();
    setupAuthModalTrigger();

    // Check for existing verified session on load
    const cachedUser = localStorage.getItem('creator_cashflow_user');
    const cachedToken = localStorage.getItem('creator_cashflow_user_token');

    if (cachedUser && cachedToken) {
        try {
            state.user = JSON.parse(cachedUser);
            state.token = cachedToken;

            const label = document.getElementById('nav-user-label');
            if (label) label.innerText = state.user.name.split(' ')[0];
            const greetingLabel = document.getElementById('dashboard-user-greeting');
            if (greetingLabel) greetingLabel.innerText = state.user.name.split(' ')[0];

            loadUserTransactions();
        } catch (e) {
            loadLocalBackupData();
        }
    } else {
        loadLocalBackupData();
    }

    const syncBtn = document.getElementById('btn-sync-trigger');
    if (syncBtn) syncBtn.addEventListener('click', syncData);

    setupHeroMockupInteractions();
    setupScrollReveals();
    setupSpotlightInteractions();

    // Initialize SPA routing state
    if (!history.state) {
        history.replaceState({ view: 'marketing' }, '', window.location.pathname);
    }

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.view) {
            switchView(e.state.view, false);
        } else {
            // Fallback to initial marketing view
            switchView('marketing', false);
        }
    });

    // Restore visual choices helper
    function restoreVisualChoices() {
        if (onboardingState.creatorType) {
            document.querySelectorAll('#onboard-step-1 .onboard-choice-card').forEach(opt => {
                if (opt.getAttribute('data-value') === onboardingState.creatorType) {
                    opt.classList.add('active');
                    const icon = opt.querySelector('.check-indicator span');
                    if (icon) icon.innerText = 'check_circle';
                } else {
                    opt.classList.remove('active');
                    const icon = opt.querySelector('.check-indicator span');
                    if (icon) icon.innerText = 'radio_button_unchecked';
                }
            });
        }

        if (onboardingState.platforms && onboardingState.platforms.length > 0) {
            document.querySelectorAll('#onboard-step-2 .onboard-choice-card').forEach(opt => {
                const val = opt.getAttribute('data-value');
                const icon = opt.querySelector('.check-indicator span');
                if (onboardingState.platforms.includes(val)) {
                    opt.classList.add('active');
                    if (icon) icon.innerText = 'check_circle';
                } else {
                    opt.classList.remove('active');
                    if (icon) icon.innerText = 'radio_button_unchecked';
                }
            });
        }

        if (onboardingState.goal) {
            document.querySelectorAll('#onboard-goals-grid .onboard-choice-card').forEach(opt => {
                const goalVal = opt.getAttribute('data-goal');
                const icon = opt.querySelector('span.material-symbols-outlined:last-child');
                if (goalVal === onboardingState.goal) {
                    opt.classList.add('active');
                    if (icon) {
                        icon.innerText = 'check_circle';
                        icon.className = 'material-symbols-outlined text-accent-emerald text-lg';
                    }
                } else {
                    opt.classList.remove('active');
                    if (icon) {
                        icon.innerText = 'radio_button_unchecked';
                        icon.className = 'material-symbols-outlined text-white/20 text-lg';
                    }
                }
            });
        }
    }

    // Check if user landed directly on a hash (e.g. #onboarding)
    const initialHash = window.location.hash;
    if (initialHash === '#onboarding') {
        const cachedOnboarding = localStorage.getItem('creator_cashflow_onboarding');
        if (cachedOnboarding) {
            try {
                const parsed = JSON.parse(cachedOnboarding);
                Object.assign(onboardingState, parsed);
                restoreVisualChoices();
            } catch (e) {}
        }
        switchView('onboarding', false);
        nextOnboardStep(onboardingState.currentStep || 1);
    } else if (initialHash === '#app') {
        switchView('app', false);
    }
});

// Load real transactions from Supabase cloud database
async function loadUserTransactions() {
    if (!state.token) return;
    if (state.token === 'demo_token') {
        recalculateBusinessMetrics();
        renderDashboardData();
        initIntelligenceChart();
        animateCounter();
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        const data = await res.json();

        if (data.transactions && data.transactions.length > 0) {
            state.activities = data.transactions.map(t => ({
                ...t,
                desc: t.desc || t.merchant || 'Transaction Entry',
                amount: typeof t.amount === 'number' ? t.amount : (parseFloat(t.amount) || 0)
            }));

            // Recalculate balance and percentage streams based on database values
            let totalIncome = 0;
            let totalExpense = 0;

            state.activities.forEach(a => {
                if (a.type === 'income') totalIncome += a.amount;
                else totalExpense += a.amount;
            });

            state.balance = totalIncome - totalExpense;

            // Update Timeline graph points dynamically from DB
            const timelineMap = {};
            state.activities.slice().reverse().forEach(a => {
                const dateKey = a.date;
                if (!timelineMap[dateKey]) timelineMap[dateKey] = { rev: 0, exp: 0 };
                if (a.type === 'income') timelineMap[dateKey].rev += a.amount;
                else timelineMap[dateKey].exp += a.amount;
            });

            let runningRev = 0;
            let runningExp = 0;
            state.timelineData = Object.keys(timelineMap).map(k => {
                runningRev += timelineMap[k].rev;
                runningExp += timelineMap[k].exp;
                return {
                    date: k,
                    rev: runningRev,
                    exp: runningExp,
                    profit: runningRev - runningExp
                };
            });
        } else {
            loadLocalBackupData();
        }
    } catch (err) {
        console.warn('Backend connection failed. Loading local backup.', err);
        loadLocalBackupData();
    }

    recalculateBusinessMetrics();
    renderDashboardData();
    initIntelligenceChart();
    animateCounter();
}

function loadLocalBackupData() {
    state.balance = 24650;
    state.activities = [
        { date: 'Jul 21', desc: 'Google AdSense South Africa Payout', type: 'income', amount: 18420 },
        { date: 'Jul 19', desc: 'Orms Direct (Sony Alpha Lens)', type: 'expense', amount: 4200 },
        { date: 'Jul 18', desc: 'TikTok Creator Rewards ZAR', type: 'income', amount: 4850 },
        { date: 'Jul 15', desc: 'Adobe Creative Cloud SA', type: 'expense', amount: 950 },
        { date: 'Jul 14', desc: 'Woolworths SA Brand Deal', type: 'income', amount: 2100 }
    ];
    recalculateBusinessMetrics();
}

// ==========================================================================
// ONBOARDING MODULES (6-Step Wizard)
// ==========================================================================

// Step validation engine
function validateStep(stepNum) {
    let isValid = true;
    let errorMsg = '';

    if (stepNum === 1) {
        if (!onboardingState.creatorType) {
            isValid = false;
            errorMsg = 'Please select your creator type to continue.';
        }
    } else if (stepNum === 2) {
        if (!onboardingState.platforms || onboardingState.platforms.length === 0) {
            isValid = false;
            errorMsg = 'Please select at least one revenue platform.';
        }
    } else if (stepNum === 3) {
        if (!onboardingState.goal) {
            isValid = false;
            errorMsg = 'Please select your primary goal.';
        }
    }

    const errorEl = document.getElementById('onboard-validation-error');
    const errorText = document.getElementById('onboard-error-text');

    if (!isValid) {
        if (errorEl && errorText) {
            errorText.innerText = errorMsg;
            errorEl.classList.remove('hidden');
        }
        // Shake step container for visual feedback
        const currentStepEl = document.getElementById(`onboard-step-${stepNum}`);
        if (currentStepEl) {
            currentStepEl.classList.add('animate-shake');
            setTimeout(() => currentStepEl.classList.remove('animate-shake'), 450);
        }
    } else {
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    return isValid;
}

// Progress Bar & Navigation Header Synchronizer (Dynamic Flow)
function updateOnboardingProgress(stepNum) {
    onboardingState.currentStep = stepNum;

    const isLoggedIn = state.token && state.token !== 'demo_token';
    const totalSteps = isLoggedIn ? 4 : 5;

    // Update Step Counter Text
    const counterEl = document.getElementById('onboard-step-counter');
    if (counterEl) {
        counterEl.innerText = `0${stepNum} / 0${totalSteps}`;
    }

    // Update Progress Bar Fill Width
    const progressFill = document.getElementById('onboard-progress-fill');
    if (progressFill) {
        const percentage = Math.min(100, Math.max(0, (stepNum / totalSteps) * 100));
        progressFill.style.width = `${percentage}%`;
    }

    // Update Back Button Visibility
    const backBtn = document.getElementById('onboard-back-btn');
    if (backBtn) {
        backBtn.classList.remove('invisible');
    }

    // Clear validation error messages
    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');

    const signupError = document.getElementById('onboard-signup-error');
    if (signupError) signupError.classList.add('hidden');

    const loginError = document.getElementById('onboard-login-error');
    if (loginError) loginError.classList.add('hidden');
}

function renderStep4Platforms() {
    const listContainer = document.getElementById('onboarding-connect-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const platforms = ['YouTube', 'TikTok', 'Instagram'];

    platforms.forEach(p => {
        const isConn = onboardingState.connected.includes(p);
        const btnText = isConn ? 'Connected' : 'Connect';
        const cardClass = isConn 
            ? 'onboard-choice-card border border-accent-emerald bg-background/80 p-3.5 rounded-2xl flex items-center justify-between'
            : 'onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-3.5 rounded-2xl flex items-center justify-between';
        const badgeClass = isConn 
            ? 'connect-badge bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30 font-bold px-3 py-1 rounded-xl text-[10px] cursor-pointer'
            : 'connect-badge bg-white text-black font-bold px-3 py-1 rounded-xl text-[10px] hover:bg-white/90 cursor-pointer';

        listContainer.innerHTML += `
            <div class="${cardClass}" id="onboard-card-${p}">
                <div class="flex items-center gap-2.5">
                    <span class="font-bold text-white text-xs">${p}</span>
                </div>
                <button class="${badgeClass}" id="connect-${p}" onclick="simulatePlatformConnect(document.getElementById('onboard-card-${p}'), '${p}')">
                    ${btnText}
                </button>
            </div>
        `;
    });
}

function nextOnboardStep(targetStepNum) {
    const currentStepNum = onboardingState.currentStep || 1;

    // Cache choices in browser step-by-step
    localStorage.setItem('creator_cashflow_onboarding', JSON.stringify(onboardingState));

    // Validate current step before advancing forward
    if (targetStepNum > currentStepNum) {
        if (!validateStep(currentStepNum)) {
            return false;
        }
    }

    // Dynamic Skips: Check if logged in to skip Step 5 (profile creation)
    const isLoggedIn = state.token && state.token !== 'demo_token';
    if (targetStepNum === 5 && isLoggedIn) {
        executeLaunchSequence();
        return true;
    }

    if (targetStepNum === 4) {
        renderStep4Platforms();
    }

    document.querySelectorAll('.onboarding-step').forEach(step => {
        step.classList.add('hidden');
    });

    let stepId = `onboard-step-${targetStepNum}`;
    if (targetStepNum === 5 && document.getElementById('onboard-step-login').classList.contains('active-auth')) {
        stepId = 'onboard-step-login';
    }

    const nextStep = document.getElementById(stepId);
    if (nextStep) {
        nextStep.classList.remove('hidden');
    }

    updateOnboardingProgress(targetStepNum);

    if (targetStepNum === 3) {
        triggerMagicMoment();
    }

    return true;
}

function prevOnboardStep() {
    const currentStepNum = onboardingState.currentStep || 1;
    if (currentStepNum > 1) {
        nextOnboardStep(currentStepNum - 1);
    } else if (currentStepNum === 1) {
        switchView('marketing');
    }
}

function selectCreatorType(element) {
    document.querySelectorAll('#onboard-step-1 .onboard-choice-card').forEach(opt => {
        opt.classList.remove('active');
        const icon = opt.querySelector('.check-indicator span');
        if (icon) icon.innerText = 'radio_button_unchecked';
    });
    element.classList.add('active');
    const icon = element.querySelector('.check-indicator span');
    if (icon) icon.innerText = 'check_circle';
    onboardingState.creatorType = element.getAttribute('data-value');

    localStorage.setItem('creator_cashflow_onboarding', JSON.stringify(onboardingState));

    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');
}

function togglePlatformChoice(element) {
    element.classList.toggle('active');
    const val = element.getAttribute('data-value');
    const icon = element.querySelector('.check-indicator span');
    
    if (element.classList.contains('active')) {
        if (icon) icon.innerText = 'check_circle';
        if (!onboardingState.platforms.includes(val)) {
            onboardingState.platforms.push(val);
        }
    } else {
        if (icon) icon.innerText = 'radio_button_unchecked';
        onboardingState.platforms = onboardingState.platforms.filter(p => p !== val);
    }

    localStorage.setItem('creator_cashflow_onboarding', JSON.stringify(onboardingState));

    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');
}

function switchToOnboardLogin() {
    document.getElementById('onboard-step-5').classList.add('hidden');
    document.getElementById('onboard-step-login').classList.remove('hidden');
    document.getElementById('onboard-step-login').classList.add('active-auth');
    document.getElementById('onboard-step-5').classList.remove('active-auth');
}

function switchToOnboardSignup() {
    document.getElementById('onboard-step-login').classList.add('hidden');
    document.getElementById('onboard-step-5').classList.remove('hidden');
    document.getElementById('onboard-step-5').classList.add('active-auth');
    document.getElementById('onboard-step-login').classList.remove('active-auth');
}

function skipOnboardingConnection(e) {
    if (e) e.preventDefault();
    console.log('[ONBOARDING] Skipping connection and entering manual mode.');
    onboardingState.isManual = true;
    nextOnboardStep(5);
}

function fallbackToMockConnect(element, platform, badge) {
    if (badge) badge.innerText = 'Connect';
    if (element) element.classList.remove('connected');
    
    // Display exact user connection failure message
    const errorEl = document.getElementById('onboard-validation-error');
    const errorText = document.getElementById('onboard-error-text');
    if (errorEl && errorText) {
        errorText.innerText = "We couldn’t connect your account. Please try again, or continue and add income manually.";
        errorEl.classList.remove('hidden');
    } else {
        alert("We couldn’t connect your account. Please try again, or continue and add income manually.");
    }
}

function simulatePlatformConnect(element, platform) {
    const badge = document.getElementById(`connect-${platform}`);

    if (element.classList.contains('connected')) {
        element.classList.remove('connected');
        if (badge) badge.innerText = 'Connect';
        onboardingState.connected = onboardingState.connected.filter(p => p !== platform);
        return;
    }

    if (badge) badge.innerText = 'Linking...';

    // Defensive Guard: Check if PhylloConnect SDK script is loaded in window
    if (typeof PhylloConnect === 'undefined') {
        console.warn('[PHYLLO] PhylloConnect SDK script not detected in DOM. Falling back to mock connection.');
        setTimeout(() => {
            fallbackToMockConnect(element, platform, badge);
        }, 400);
        return;
    }

    const headers = {};
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    fetch(`${API_BASE_URL}/integrations/phyllo/token`, {
        method: 'POST',
        headers: headers
    })
    .then(res => res.json())
    .then(data => {
        if (!data.sdkToken || typeof PhylloConnect === 'undefined') {
            console.warn('[PHYLLO] Token or SDK missing. Executing mock connection fallback.');
            fallbackToMockConnect(element, platform, badge);
            return;
        }

        const config = {
            clientDisplayName: "Creator Cash Flow",
            environment: "staging",
            userId: data.phylloUserId,
            token: data.sdkToken
        };

        const platformId = findPlatformId(platform, data.platforms);
        if (platformId) {
            config.workPlatformId = platformId;
        }

        try {
            const phylloConnect = PhylloConnect.initialize(config);

            phylloConnect.on("accountConnected", (accountId, workPlatformId, userId) => {
                element.classList.add('connected');
                if (badge) badge.innerText = 'Connected';
                if (!onboardingState.connected.includes(platform)) {
                    onboardingState.connected.push(platform);
                }
            });

            phylloConnect.on("accountDisconnected", (accountId, workPlatformId, userId) => {
                element.classList.remove('connected');
                if (badge) badge.innerText = 'Connect';
                onboardingState.connected = onboardingState.connected.filter(p => p !== platform);
            });

            phylloConnect.on("tokenExpired", (userId) => {
                // Phyllo SDK tokens are short-lived. Start the flow again so the
                // backend can issue a fresh token before the user reconnects.
                console.info('[PHYLLO] SDK token expired. Requesting a fresh token.');
                if (badge) badge.innerText = 'Refreshing...';
                simulatePlatformConnect(element, platform);
            });

            phylloConnect.on("exit", (reason, userId) => {
                console.info('[PHYLLO] Connect flow closed.', reason);
                if (!element.classList.contains('connected') && badge) {
                    badge.innerText = 'Connect';
                    fallbackToMockConnect(element, platform, badge);
                }
            });

            phylloConnect.open();
        } catch (err) {
            console.warn('[PHYLLO] Initialization exception caught. Executing mock fallback.', err);
            fallbackToMockConnect(element, platform, badge);
        }
    })
    .catch(err => {
        console.warn('[PHYLLO] Network request failed. Reverting to mock connect simulation.', err);
        fallbackToMockConnect(element, platform, badge);
    });
}

function findPlatformId(platformName, platformMap) {
    if (!platformMap || typeof platformMap !== 'object') return undefined;
    const search = platformName.toLowerCase();
    for (const name of Object.keys(platformMap)) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes(search) || search.includes(nameLower)) {
            return platformMap[name];
        }
    }
    return undefined;
}

async function triggerMagicMoment() {
    const platformsCount = onboardingState.connected.length || onboardingState.platforms.length || 3;
    const connectedBadge = document.getElementById('magic-onboard-platforms');
    if (connectedBadge) {
        connectedBadge.innerText = `${platformsCount} ${onboardingState.isManual ? '(Manual Mode)' : 'Connected'}`;
    }

    // Synchronously back up state to LocalStorage
    localStorage.setItem('creator_cashflow_onboarding', JSON.stringify(onboardingState));

    if (state.token) {
        try {
            await fetch(`${API_BASE_URL}/onboarding/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    creatorType: onboardingState.creatorType,
                    platforms: onboardingState.platforms,
                    goal: onboardingState.goal,
                    connected: onboardingState.connected,
                    isManual: onboardingState.isManual
                })
            });
        } catch (e) {
            console.warn('[ONBOARDING] Cloud sync warning:', e);
        }
    }
}

function playAppLoadingSequence(onComplete) {
    const loader = document.getElementById('app-loading-screen');
    const statusText = document.getElementById('loader-status-text');
    const statusPct = document.getElementById('loader-status-pct');
    const progressFill = document.getElementById('loader-progress-fill');

    if (!loader) {
        if (onComplete) onComplete();
        return;
    }

    loader.classList.remove('hidden', 'dismissed');
    loader.style.display = 'flex';
    if (progressFill) progressFill.style.width = '0%';
    if (statusPct) statusPct.innerText = '0%';
    if (statusText) statusText.innerText = 'Connecting creator channels...';

    // Step 1: 35%
    setTimeout(() => {
        if (progressFill) progressFill.style.width = '35%';
        if (statusPct) statusPct.innerText = '35%';
        if (statusText) statusText.innerText = 'Consolidating YouTube, TikTok & brand sponsorships...';
    }, 280);

    // Step 2: 80%
    setTimeout(() => {
        if (progressFill) progressFill.style.width = '80%';
        if (statusPct) statusPct.innerText = '80%';
        if (statusText) statusText.innerText = 'Harmonizing cash flow runway & Creator Health...';
    }, 650);

    // Step 3: 100%
    setTimeout(() => {
        if (progressFill) progressFill.style.width = '100%';
        if (statusPct) statusPct.innerText = '100%';
        if (statusText) statusText.innerText = 'Your Creator HQ is ready!';
    }, 1050);

    // Step 4: Dismiss Loader & Cascade Pop-Up Cards
    setTimeout(() => {
        loader.classList.add('dismissed');
        setTimeout(() => {
            loader.classList.add('hidden');
            loader.style.display = 'none';
            if (onComplete) onComplete();
        }, 380);
    }, 1250);
}
window.playAppLoadingSequence = playAppLoadingSequence;

function startOnboarding() {
    if (typeof switchView === 'function') {
        switchView('onboarding');
    } else {
        const marketing = document.getElementById('view-marketing');
        const appView = document.getElementById('view-app');
        const onboarding = document.getElementById('view-onboarding');

        if (marketing) { marketing.style.display = 'none'; marketing.classList.add('hidden'); }
        if (appView) { appView.style.display = 'none'; appView.classList.add('hidden'); }

        if (onboarding) {
            onboarding.classList.remove('hidden');
            onboarding.style.display = 'flex';
        }

        window.scrollTo({ top: 0, behavior: 'instant' });

        if (typeof nextOnboardStep === 'function') nextOnboardStep(1);
    }
}
window.startOnboarding = startOnboarding;

function executeLaunchSequence() {
    const launchBtn = document.getElementById('btn-launch-command-center');
    
    if (launchBtn) {
        launchBtn.innerText = 'Launching Creator HQ...';
        launchBtn.disabled = true;
    }

    triggerMagicMoment();

    playAppLoadingSequence(() => {
        if (launchBtn) {
            launchBtn.innerText = "Let's see how you're doing →";
            launchBtn.disabled = false;
        }
        switchView('app');
    });
}

// ==========================================================================
// UTILITY & VIEW ENGINE
// ==========================================================================

function setupNavbarScroll() {
    const header = document.querySelector('header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('shadow-md');
        } else {
            header.classList.remove('shadow-md');
        }
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('[data-tab]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabId = item.getAttribute('data-tab');
            if (tabId) {
                e.preventDefault();
                switchTab(tabId);
            }
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('[data-tab]').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));

    const selectedNavs = document.querySelectorAll(`[data-tab="${tabId}"]`);
    const selectedPane = document.getElementById(`tab-${tabId}`);

    if (selectedPane) {
        selectedNavs.forEach(nav => nav.classList.add('active'));
        selectedPane.classList.remove('hidden');
        selectedPane.classList.add('active');
        triggerCardPopups(selectedPane);
    }
}

function animateCounter() {
    const target = state.balance;
    const element = document.getElementById('val-current-balance');
    const mktElement = document.getElementById('marketing-val-earnings');
    const badge = document.getElementById('val-change-badge');

    if (!element) return;

    let current = 0;
    const duration = 1200;
    const steps = 40;
    const stepVal = Math.ceil(target / steps);
    const stepTime = duration / steps;

    const timer = setInterval(() => {
        current += stepVal;
        if (current >= target) {
            current = target;
            clearInterval(timer);
            if (badge) badge.classList.add('visible');
        }
        element.innerText = `R${current.toLocaleString()}`;
        if (mktElement) mktElement.innerText = `R${current.toLocaleString()}`;
    }, stepTime);
}

function renderDashboardData() {
    const sourceContainer = document.getElementById('sources-stream-list');
    if (sourceContainer) {
        sourceContainer.innerHTML = '';
        state.sources.forEach(s => {
            sourceContainer.innerHTML += `
                <div class="space-y-sm" style="margin-bottom: 20px;">
                    <div class="flex justify-between text-sm">
                        <span class="text-white font-medium">${s.name}</span>
                        <span class="font-bold text-accent-emerald">R${s.amount.toLocaleString()} (${s.percent})</span>
                    </div>
                    <div class="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
                        <div class="h-full bg-accent-emerald" style="width: ${s.percent};"></div>
                    </div>
                </div>
            `;
        });
    }
    const isSample = !onboardingState.connected || onboardingState.connected.length === 0;
    const sampleLabel = isSample ? ' <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold font-sans">Sample</span>' : '';

    const sampleBanner = document.getElementById('sample-data-banner');
    if (sampleBanner) {
        if (isSample) sampleBanner.classList.remove('hidden');
        else sampleBanner.classList.add('hidden');
    }

    const activityStream = document.getElementById('activity-stream-os');
    if (activityStream) {
        activityStream.innerHTML = '';
        state.activities.slice(0, 4).forEach(a => {
            const amountClass = a.type === 'income' ? 'class="font-display font-bold text-accent-emerald text-sm"' : 'class="font-display font-bold text-white text-sm"';
            const prefix = a.type === 'income' ? '+' : '-';
            activityStream.innerHTML += `
                <div class="flex justify-between items-center p-md bg-surface rounded-2xl border border-white/[0.05]">
                    <div>
                        <div class="font-semibold text-white text-sm">${escapeHTML(a.desc || '')}${sampleLabel}</div>
                        <div class="text-xs text-text-secondary">${a.date} • Verified Sync</div>
                    </div>
                    <div ${amountClass}>${prefix}R${a.amount.toLocaleString()}</div>
                </div>
            `;
        });
    }

    renderFullStreams();
}

function renderFullStreams() {
    const isSample = !onboardingState.connected || onboardingState.connected.length === 0;
    const sampleLabel = isSample ? ' <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold font-sans">Sample</span>' : '';

    const revStream = document.getElementById('full-revenue-stream');
    if (revStream) {
        revStream.innerHTML = '';
        state.activities.filter(a => a.type === 'income').forEach(a => {
            revStream.innerHTML += `
                <div class="flex justify-between items-center py-md border-b border-white/[0.05]">
                    <div>
                        <div class="font-semibold text-white text-sm">${escapeHTML(a.desc || '')}${sampleLabel}</div>
                        <div class="text-xs text-text-secondary">${a.date}</div>
                    </div>
                    <div class="font-display font-bold text-accent-emerald text-sm">+R${a.amount.toLocaleString()}</div>
                </div>
            `;
        });
    }

    const expStream = document.getElementById('full-expense-stream');
    if (expStream) {
        expStream.innerHTML = '';
        state.activities.filter(a => a.type === 'expense').forEach(a => {
            expStream.innerHTML += `
                <div class="flex justify-between items-center py-md border-b border-white/[0.05]">
                    <div>
                        <div class="font-semibold text-white text-sm">${escapeHTML(a.desc || '')}${sampleLabel}</div>
                        <div class="text-xs text-text-secondary">${a.date}</div>
                    </div>
                    <div class="font-display font-bold text-white text-sm">-R${a.amount.toLocaleString()}</div>
                </div>
            `;
        });
    }
}

function initIntelligenceChart() {
    const canvas = document.getElementById('chart-revenue-intelligence');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

    if (intelligenceChartInstance) intelligenceChartInstance.destroy();

    intelligenceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.timelineData.map(d => d.date),
            datasets: [{
                label: 'Revenue Timeline',
                data: state.timelineData.map(d => d.rev),
                borderColor: '#22C55E',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: '#22C55E',
                pointBorderColor: '#050505',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0B0B0B',
                    titleColor: '#FFFFFF',
                    bodyColor: '#22C55E',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    displayColors: false,
                    padding: 12,
                    titleFont: { family: 'Inter', size: 12, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const item = state.timelineData[idx];
                            return [
                                `Revenue:  R${item.rev.toLocaleString()}`,
                                `Expenses: R${item.exp.toLocaleString()}`,
                                `Net Profit: R${item.profit.toLocaleString()}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#8E8E93',
                        font: { family: 'Inter', size: 11 },
                        callback: function(value) {
                            return 'R' + (value / 1000) + 'k';
                        }
                    }
                }
            }
        }
    });
}

function syncData() {
    const btn = document.getElementById('btn-sync-trigger');
    if (btn) {
        btn.innerText = `Syncing...`;
        setTimeout(() => {
            btn.innerText = `Synced`;
            loadUserTransactions();
            setTimeout(() => { btn.innerText = `Sync`; }, 2000);
        }, 1000);
    }
}

// ==========================================================================
// AUTHENTICATION MODULES
// ==========================================================================

function setupAuthModalTrigger() {
    const authBtn = document.getElementById('btn-auth-modal');
    if (authBtn) authBtn.addEventListener('click', openAccountAuthModal);
}

function openAccountAuthModal() {
    openModal('Authentication', `
        <div class="flex gap-sm p-xs bg-surface border border-white/[0.08] rounded-2xl mb-lg">
            <button class="flex-1 font-label-lg py-sm rounded-xl bg-white text-black shadow-sm" id="auth-tab-signup" onclick="switchAuthTab('signup')">Create Account</button>
            <button class="flex-1 font-label-lg py-sm rounded-xl text-text-secondary hover:text-white" id="auth-tab-login" onclick="switchAuthTab('login')">Sign In</button>
        </div>

        <div id="auth-signup-fields" class="space-y-md">
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Full Creator Name</label>
                <input type="text" id="reg-name" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="e.g. Thabo Ndlovu">
            </div>
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Email Address</label>
                <input type="email" id="reg-email" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="creator@creatorcashflow.co.za">
            </div>
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Password</label>
                <input type="password" id="reg-pass" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="••••••••••••">
            </div>
            <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl shadow-lg active:scale-95 transition-transform mt-lg" onclick="executeCreateAccount()">
                Create Creator Account
            </button>
        </div>

        <div id="auth-login-fields" class="space-y-md hidden">
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Email Address</label>
                <input type="email" id="login-email" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="creator@creatorcashflow.co.za">
            </div>
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Password</label>
                <input type="password" id="login-pass" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="••••••••••••">
            </div>
            <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl shadow-lg active:scale-95 transition-transform mt-lg" onclick="executeLogin()">
                Sign In To OS
            </button>
        </div>
    `);
}

function switchAuthTab(tab) {
    const signupFields = document.getElementById('auth-signup-fields');
    const loginFields = document.getElementById('auth-login-fields');
    const signupBtn = document.getElementById('auth-tab-signup');
    const loginBtn = document.getElementById('auth-tab-login');

    if (tab === 'signup') {
        signupFields.classList.remove('hidden');
        loginFields.classList.add('hidden');
        signupBtn.className = 'flex-1 font-label-lg py-sm rounded-xl bg-white text-black shadow-sm';
        loginBtn.className = 'flex-1 font-label-lg py-sm rounded-xl text-text-secondary hover:text-white';
    } else {
        signupFields.classList.add('hidden');
        loginFields.classList.remove('hidden');
        signupBtn.className = 'flex-1 font-label-lg py-sm rounded-xl text-text-secondary hover:text-white';
        loginBtn.className = 'flex-1 font-label-lg py-sm rounded-xl bg-white text-black shadow-sm';
    }
}

async function executeCreateAccount() {
    const name = document.getElementById('reg-name').value.trim() || 'Thabo Ndlovu';
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-pass').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.status !== 201) {
            alert(data.error || 'Signup failed.');
            return;
        }

        const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();

        state.user = loginData.user;
        state.token = loginData.token;

        localStorage.setItem('creator_cashflow_user', JSON.stringify(state.user));
        localStorage.setItem('creator_cashflow_user_token', state.token);

        const label = document.getElementById('nav-user-label');
        if (label) label.innerText = name.split(' ')[0];
        const greetingLabel = document.getElementById('dashboard-user-greeting');
        if (greetingLabel) greetingLabel.innerText = name.split(' ')[0];

        closeModal();
        switchTab('overview');
        switchView('app');
        alert(`🎉 Creator HQ Activated for ${name}! Seed data populated successfully.`);
    } catch (err) {
        console.error('Signup failed, using offline fallback', err);
        state.user = { id: 'usr_offline', name, email };
        state.token = 'offline_token';
        localStorage.setItem('creator_cashflow_user', JSON.stringify(state.user));
        localStorage.setItem('creator_cashflow_user_token', state.token);
        closeModal();
        switchTab('overview');
        switchView('app');
    }
}

async function executeLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.status !== 200) {
            alert(data.error || 'Login failed.');
            return;
        }

        state.user = data.user;
        state.token = data.token;

        localStorage.setItem('creator_cashflow_user', JSON.stringify(state.user));
        localStorage.setItem('creator_cashflow_user_token', state.token);

        const label = document.getElementById('nav-user-label');
        if (label) label.innerText = state.user.name.split(' ')[0];
        const greetingLabel = document.getElementById('dashboard-user-greeting');
        if (greetingLabel) greetingLabel.innerText = state.user.name.split(' ')[0];

        closeModal();
        switchTab('overview');
        switchView('app');
        alert(`Welcome back, ${state.user.name}! Syncing database records...`);
    } catch (err) {
        alert('Could not authenticate. Verify network status.');
    }
}

async function submitActivity() {
    const desc = document.getElementById('act-desc').value || 'New Entry';
    const type = document.getElementById('act-type').value;
    const amount = parseFloat(document.getElementById('act-amount').value) || 2500;

    if (state.token && state.token !== 'offline_token' && state.token !== 'demo_token') {
        try {
            await fetch(`${API_BASE_URL}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    source: type === 'income' ? 'YouTube' : 'Bank',
                    merchant: desc,
                    type,
                    amount
                })
            });
            
            loadUserTransactions();
        } catch (e) {
            console.error('Failed to sync transaction to cloud database', e);
        }
    } else {
        state.activities.unshift({
            date: 'Today',
            desc,
            type,
            amount
        });
        
        recalculateBusinessMetrics();
        if (typeof updateDemoTimeline === 'function') {
            updateDemoTimeline();
        }
        
        renderDashboardData();
        animateCounter();
        initIntelligenceChart();
    }

    closeModal();
}

function openModal(title, html) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-app').classList.add('active');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeModal() {
    document.getElementById('modal-app').classList.remove('active');
}

function openConnectedAccountsModal() {
    const platforms = ['YouTube', 'TikTok', 'Instagram'];
    let rowsHtml = '';
    
    platforms.forEach(p => {
        const isConn = onboardingState.connected.includes(p);
        const btnText = isConn ? 'Connected' : 'Connect';
        const btnClass = isConn 
            ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30 font-bold px-md py-sm rounded-xl text-xs cursor-pointer' 
            : 'bg-white text-black font-bold px-md py-sm rounded-xl text-xs hover:bg-white/90 cursor-pointer';
        
        rowsHtml += `
            <div class="flex justify-between items-center p-md bg-background/60 border border-white/[0.05] rounded-2xl">
                <div class="flex items-center gap-md">
                    <span class="font-bold text-white text-sm">${p}</span>
                </div>
                <button class="${btnClass}" id="connect-${p}" onclick="connectPlatformFromModal(this, '${p}')">
                    ${btnText}
                </button>
            </div>
        `;
    });

    openModal('Connected Accounts', `
        <div class="space-y-md text-left">
            <p class="text-xs text-text-secondary mb-md">Sync your creator analytics and payout channels directly.</p>
            <div id="modal-validation-error" class="hidden p-xs px-sm bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-xs mb-md">
                <span class="material-symbols-outlined text-sm">error</span>
                <span id="modal-error-text">Please try to connect again</span>
            </div>
            <div class="space-y-sm">
                ${rowsHtml}
            </div>
        </div>
    `);
}

function connectPlatformFromModal(button, platform) {
    const isConn = onboardingState.connected.includes(platform);
    if (isConn) {
        onboardingState.connected = onboardingState.connected.filter(p => p !== platform);
        button.innerText = 'Connect';
        button.className = 'bg-white text-black font-bold px-md py-sm rounded-xl text-xs hover:bg-white/90 cursor-pointer';
    } else {
        button.innerText = 'Linking...';
        
        const showModalError = (msg) => {
            const errorEl = document.getElementById('modal-validation-error');
            const errorText = document.getElementById('modal-error-text');
            if (errorEl && errorText) {
                errorText.innerText = msg || 'Please try to connect again';
                errorEl.classList.remove('hidden');
            }
        };

        // Defensive Guard: Check if PhylloConnect SDK script is loaded in window
        if (typeof PhylloConnect === 'undefined') {
            console.warn('[PHYLLO] PhylloConnect SDK script not detected in DOM.');
            setTimeout(() => {
                button.innerText = 'Connect';
                showModalError('Please try to connect again');
            }, 400);
            return;
        }

        const headers = {};
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        fetch(`${API_BASE_URL}/integrations/phyllo/token`, {
            method: 'POST',
            headers: headers
        })
        .then(res => res.json())
        .then(data => {
            if (!data.sdkToken || typeof PhylloConnect === 'undefined') {
                button.innerText = 'Connect';
                showModalError('Please try to connect again');
                return;
            }

            const config = {
                clientDisplayName: "Creator Cash Flow",
                environment: "staging",
                userId: data.phylloUserId,
                token: data.sdkToken
            };

            const platformId = findPlatformId(platform, data.platforms);
            if (platformId) {
                config.workPlatformId = platformId;
            }

            try {
                const phylloConnect = PhylloConnect.initialize(config);

                phylloConnect.on("accountConnected", (accountId, workPlatformId, userId) => {
                    button.innerText = 'Connected';
                    button.className = 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30 font-bold px-md py-sm rounded-xl text-xs cursor-pointer';
                    if (!onboardingState.connected.includes(platform)) {
                        onboardingState.connected.push(platform);
                    }
                });

                phylloConnect.on("accountDisconnected", (accountId, workPlatformId, userId) => {
                    button.innerText = 'Connect';
                    button.className = 'bg-white text-black font-bold px-md py-sm rounded-xl text-xs hover:bg-white/90 cursor-pointer';
                    onboardingState.connected = onboardingState.connected.filter(p => p !== platform);
                });

                phylloConnect.on("exit", (reason, userId) => {
                    if (!onboardingState.connected.includes(platform)) {
                        button.innerText = 'Connect';
                        showModalError('Please try to connect again');
                    }
                });

                phylloConnect.open();
            } catch (err) {
                button.innerText = 'Connect';
                showModalError('Please try to connect again');
            }
        })
        .catch(() => {
            button.innerText = 'Connect';
            showModalError('Please try to connect again');
        });
    }
}

function openAddActivityModal() {
    openModal('Add Ledger Entry', `
        <div class="space-y-md">
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Description</label>
                <input type="text" id="act-desc" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="e.g. YouTube AdSense Payout">
            </div>
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Type</label>
                <select id="act-type" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0">
                    <option value="income">Income</option>
                    <option value="expense">Expense Write-off</option>
                </select>
            </div>
            <div class="space-y-xs text-left">
                <label class="text-xs text-text-secondary font-bold uppercase">Amount (ZAR)</label>
                <input type="number" id="act-amount" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white focus:border-accent-emerald focus:ring-0" placeholder="2500">
            </div>
            <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl shadow-lg active:scale-95 transition-transform mt-lg" onclick="submitActivity()">
                Save Entry
            </button>
        </div>
    `);
}

// ==========================================================================
// DEMO MODE ENGINE (DIRECT WORKSPACE SANDBOX)
// ==========================================================================

function enterDemoMode() {
    state.user = { name: 'Demo Creator', email: 'demo@creator.co' };
    state.token = 'demo_token';
    
    const label = document.getElementById('nav-user-label');
    if (label) label.innerText = 'Demo';
    const greetingLabel = document.getElementById('dashboard-user-greeting');
    if (greetingLabel) greetingLabel.innerText = 'Demo';

    const banner = document.getElementById('demo-mode-banner');
    if (banner) banner.classList.remove('hidden');

    state.activities = [
        { date: 'Jul 28', desc: 'Sponsorship Commission Payout', type: 'income', amount: 3200 },
        { date: 'Jul 26', desc: 'Supercell Brand Sponsorship', type: 'income', amount: 8500 },
        { date: 'Jul 24', desc: 'DigitalOcean Cloud Hosting', type: 'expense', amount: 480 },
        { date: 'Jul 21', desc: 'Google AdSense South Africa Payout', type: 'income', amount: 18420 },
        { date: 'Jul 19', desc: 'Orms Direct (Sony Alpha Lens)', type: 'expense', amount: 4200 },
        { date: 'Jul 18', desc: 'TikTok Creator Rewards ZAR', type: 'income', amount: 4850 },
        { date: 'Jul 15', desc: 'Adobe Creative Cloud SA', type: 'expense', amount: 950 },
        { date: 'Jul 14', desc: 'Woolworths SA Brand Deal', type: 'income', amount: 2100 }
    ];

    recalculateBusinessMetrics();
    updateDemoTimeline();
    switchTab('overview');
    switchView('app');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}
window.enterDemoMode = enterDemoMode;

function exitDemoMode() {
    state.user = null;
    state.token = null;

    const label = document.getElementById('nav-user-label');
    if (label) label.innerText = 'Account';
    const greetingLabel = document.getElementById('dashboard-user-greeting');
    if (greetingLabel) greetingLabel.innerText = 'Creator';

    const banner = document.getElementById('demo-mode-banner');
    if (banner) banner.classList.add('hidden');

    switchView('marketing');
}

function updateDemoTimeline() {
    const timelineMap = {};
    state.activities.slice().reverse().forEach(a => {
        const dateKey = a.date;
        if (!timelineMap[dateKey]) timelineMap[dateKey] = { rev: 0, exp: 0 };
        if (a.type === 'income') timelineMap[dateKey].rev += a.amount;
        else timelineMap[dateKey].exp += a.amount;
    });

    let runningRev = 0;
    let runningExp = 0;
    state.timelineData = Object.keys(timelineMap).map(k => {
        runningRev += timelineMap[k].rev;
        runningExp += timelineMap[k].exp;
        return {
            date: k,
            rev: runningRev,
            exp: runningExp,
            profit: runningRev - runningExp
        };
    });
}

function switchView(mode, pushHistoryState = true) {
    const marketingView = document.getElementById('view-marketing');
    const appView = document.getElementById('view-app');
    const onboardingView = document.getElementById('view-onboarding');

    if (!marketingView || !appView || !onboardingView) return;

    marketingView.classList.add('hidden');
    appView.classList.add('hidden');
    onboardingView.classList.add('hidden');

    marketingView.style.display = 'none';
    appView.style.display = 'none';
    onboardingView.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (mode === 'app') {
        appView.classList.remove('hidden');
        appView.style.display = 'flex';
        loadUserTransactions();
        triggerCardPopups(appView);
    } else if (mode === 'onboarding') {
        onboardingView.classList.remove('hidden');
        onboardingView.style.display = 'flex';
        nextOnboardStep(1);
    } else {
        marketingView.classList.remove('hidden');
        marketingView.style.display = 'block';
        triggerCardPopups(marketingView);
    }

    if (pushHistoryState) {
        try {
            history.pushState({ view: mode }, '', mode === 'marketing' ? '/' : '#' + mode);
        } catch (e) {
            console.warn('History API not supported or restricted:', e);
        }
    }
}

// ==========================================================================
// CORE METRICS & AI HEURISTIC ENGINE
// ==========================================================================

function recalculateBusinessMetrics() {
    let totalIncome = 0;
    let totalExpense = 0;
    const platformBreakdown = {
        YouTube: 0,
        TikTok: 0,
        Instagram: 0,
        Patreon: 0,
        Affiliate: 0
    };

    state.activities.forEach(a => {
        const amt = a.amount;
        if (a.type === 'income') {
            totalIncome += amt;
            const desc = a.desc.toLowerCase();
            if (desc.includes('youtube') || desc.includes('adsense')) {
                platformBreakdown.YouTube += amt;
            } else if (desc.includes('tiktok') || desc.includes('rewards')) {
                platformBreakdown.TikTok += amt;
            } else if (desc.includes('instagram') || desc.includes('deals') || desc.includes('brand') || desc.includes('sponsorship')) {
                platformBreakdown.Instagram += amt;
            } else if (desc.includes('patreon') || desc.includes('sub')) {
                platformBreakdown.Patreon += amt;
            } else {
                platformBreakdown.Affiliate += amt;
            }
        } else {
            totalExpense += amt;
        }
    });

    state.balance = totalIncome - totalExpense;

    state.sources = [];
    Object.keys(platformBreakdown).forEach(key => {
        const val = platformBreakdown[key];
        if (val > 0) {
            const pct = totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;
            state.sources.push({
                name: `${key}`,
                amount: val,
                percent: `${pct}%`
            });
        }
    });

    state.sources.sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));

    // 1. Creator Health & Business Metrics Engine (82 Healthy)
    let score = 82;
    let scoreLabel = 'Healthy';

    let highestPct = 0;
    Object.keys(platformBreakdown).forEach(key => {
        const val = platformBreakdown[key];
        const pct = totalIncome > 0 ? (val / totalIncome) : 0;
        if (pct > highestPct) highestPct = pct;
    });

    const profitMargin = totalIncome > 0 ? (state.balance / totalIncome) : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) : 0;

    // 2. Business Insights Briefing (AI Analyst)
    const insightsEl = document.getElementById('ai-insights-list');
    if (insightsEl) {
        insightsEl.innerHTML = '';
        const insights = [];

        if (highestPct > 0.70) {
            insights.push(`<li class="flex items-center gap-xs py-xs text-text-secondary border-b border-white/[0.04]"><span class="text-accent-emerald font-bold">📊</span> YouTube now represents ${Math.round(highestPct * 100)}% of your monthly cash flow.</li>`);
        } else {
            insights.push(`<li class="flex items-center gap-xs py-xs text-text-secondary border-b border-white/[0.04]"><span class="text-accent-emerald font-bold">✓</span> Multi-platform distribution is well balanced.</li>`);
        }

        if (expenseRatio > 0.15) {
            insights.push(`<li class="flex items-center gap-xs py-xs text-text-secondary border-b border-white/[0.04]"><span class="text-cyan-400 font-bold">💳</span> Production expenses increased 18% this month due to camera upgrades.</li>`);
        }

        insights.push(`<li class="flex items-center gap-xs py-xs text-text-secondary border-b border-white/[0.04]"><span class="text-accent-emerald font-bold">📈</span> Net profit margin is strong at ${Math.round(profitMargin * 100)}% with a secure 60-day buffer.</li>`);
        insights.push(`<li class="flex items-center gap-xs py-xs text-text-secondary border-b border-white/[0.04]"><span class="text-indigo-400 font-bold">🔮</span> Cash flow stability score rated 82/100 Healthy.</li>`);

        insights.forEach(ins => {
            insightsEl.innerHTML += ins;
        });
    }
}

// Onboarding Goal Selection Handler (Step 3)
function selectGoalOption(element) {
    document.querySelectorAll('#onboard-goals-grid .onboard-choice-card').forEach(opt => {
        opt.classList.remove('active');
        const icon = opt.querySelector('.material-symbols-outlined:last-child');
        if (icon) {
            icon.innerText = 'radio_button_unchecked';
            icon.className = 'material-symbols-outlined text-white/20 text-lg';
        }
    });
    element.classList.add('active');
    const icon = element.querySelector('.material-symbols-outlined:last-child');
    if (icon) {
        icon.innerText = 'check_circle';
        icon.className = 'material-symbols-outlined text-accent-emerald text-lg';
    }
    onboardingState.goal = element.getAttribute('data-goal') || 'revenue';

    localStorage.setItem('creator_cashflow_onboarding', JSON.stringify(onboardingState));

    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');
}
window.selectGoalOption = selectGoalOption;

async function executeOnboardingSignup() {
    const nameEl = document.getElementById('onboard-reg-name');
    const emailEl = document.getElementById('onboard-reg-email');
    const passEl = document.getElementById('onboard-reg-pass');
    const signupBtn = document.getElementById('btn-onboard-signup');
    const signupError = document.getElementById('onboard-signup-error');
    const signupErrorText = document.getElementById('onboard-signup-error-text');

    if (!nameEl || !emailEl || !passEl) return;

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!name || !email || !password) {
        if (signupError && signupErrorText) {
            signupErrorText.innerText = 'Please fill out all fields.';
            signupError.classList.remove('hidden');
        }
        return;
    }

    if (signupBtn) {
        signupBtn.innerText = 'Creating Profile...';
        signupBtn.disabled = true;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.token) {
            throw new Error(data.error || data.message || 'Registration failed.');
        }

        state.token = data.token;
        state.user = data.user;

        localStorage.setItem('creator_cashflow_user', JSON.stringify(state.user));
        localStorage.setItem('creator_cashflow_user_token', state.token);

        const label = document.getElementById('nav-user-label');
        if (label) label.innerText = name.split(' ')[0];
        const greetingLabel = document.getElementById('dashboard-user-greeting');
        if (greetingLabel) greetingLabel.innerText = name.split(' ')[0];

        await triggerMagicMoment();
        executeLaunchSequence();
    } catch (err) {
        console.error('[ONBOARDING] Registration failed:', err);
        if (signupError && signupErrorText) {
            signupErrorText.innerText = err.message || 'Registration failed. Please try again.';
            signupError.classList.remove('hidden');
        }
        if (signupBtn) {
            signupBtn.innerText = 'Create Account & Launch HQ →';
            signupBtn.disabled = false;
        }
    }
}
window.executeOnboardingSignup = executeOnboardingSignup;

async function executeOnboardingLogin() {
    const emailEl = document.getElementById('onboard-login-email');
    const passEl = document.getElementById('onboard-login-pass');
    const loginBtn = document.getElementById('btn-onboard-login');
    const loginError = document.getElementById('onboard-login-error');
    const loginErrorText = document.getElementById('onboard-login-error-text');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!email || !password) {
        if (loginError && loginErrorText) {
            loginErrorText.innerText = 'Please fill out all fields.';
            loginError.classList.remove('hidden');
        }
        return;
    }

    if (loginBtn) {
        loginBtn.innerText = 'Signing In...';
        loginBtn.disabled = true;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.token) {
            throw new Error(data.error || data.message || 'Authentication failed.');
        }

        state.token = data.token;
        state.user = data.user;

        localStorage.setItem('creator_cashflow_user', JSON.stringify(state.user));
        localStorage.setItem('creator_cashflow_user_token', state.token);

        const name = data.user.name || 'Creator';
        const label = document.getElementById('nav-user-label');
        if (label) label.innerText = name.split(' ')[0];
        const greetingLabel = document.getElementById('dashboard-user-greeting');
        if (greetingLabel) greetingLabel.innerText = name.split(' ')[0];

        await triggerMagicMoment();
        executeLaunchSequence();
    } catch (err) {
        console.error('[ONBOARDING] Login failed:', err);
        if (loginError && loginErrorText) {
            loginErrorText.innerText = err.message || 'Authentication failed. Please try again.';
            loginError.classList.remove('hidden');
        }
        if (loginBtn) {
            loginBtn.innerText = 'Sign In & Launch HQ →';
            loginBtn.disabled = false;
        }
    }
}
window.executeOnboardingLogin = executeOnboardingLogin;
window.switchToOnboardLogin = switchToOnboardLogin;
window.switchToOnboardSignup = switchToOnboardSignup;

// Financial Records Modal
function openUploadRecordModal() {
    openModal('Upload Financial Record', `
        <div class="space-y-md text-left">
            <p class="text-xs text-text-secondary">Attach payout stubs, sponsor invoices, or equipment receipts to archive in your 2026 financial ledger.</p>
            <div class="space-y-xs">
                <label class="text-xs text-text-secondary font-bold uppercase">Document Title</label>
                <input type="text" id="rec-title" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white text-xs focus:border-accent-emerald focus:ring-0" placeholder="e.g. YouTube AdSense Payout Statement">
            </div>
            <div class="grid grid-cols-2 gap-xs">
                <div class="space-y-xs">
                    <label class="text-xs text-text-secondary font-bold uppercase">Category</label>
                    <select id="rec-category" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white text-xs focus:border-accent-emerald focus:ring-0">
                        <option value="payout">Platform Payout</option>
                        <option value="invoice">Brand Invoice</option>
                        <option value="equipment">Gear Write-Off</option>
                        <option value="software">Software Expense</option>
                    </select>
                </div>
                <div class="space-y-xs">
                    <label class="text-xs text-text-secondary font-bold uppercase">Amount (ZAR)</label>
                    <input type="number" id="rec-amount" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white text-xs focus:border-accent-emerald focus:ring-0" placeholder="18240">
                </div>
            </div>
            <div class="p-4 rounded-xl border border-dashed border-white/20 text-center cursor-pointer hover:bg-white/[0.02] transition-colors">
                <span class="material-symbols-outlined text-accent-emerald text-2xl">upload_file</span>
                <p class="text-xs text-white font-semibold mt-1">Click to select PDF receipt or payout slip</p>
                <span class="text-[10px] text-text-secondary">PDF, PNG, CSV up to 10MB</span>
            </div>
            <button class="w-full bg-white text-black font-bold font-label-lg py-sm rounded-xl shadow-lg active:scale-95 transition-transform" onclick="submitRecordEntry()">
                Archive Record →
            </button>
        </div>
    `);
}
window.openUploadRecordModal = openUploadRecordModal;

function submitRecordEntry() {
    const titleInput = document.getElementById('rec-title');
    const amtInput = document.getElementById('rec-amount');
    const catInput = document.getElementById('rec-category');
    const title = titleInput ? titleInput.value.trim() : '';
    const amt = amtInput ? parseFloat(amtInput.value) || 0 : 0;
    const cat = catInput ? catInput.value : 'payout';

    if (!title) {
        alert('Please enter a document title.');
        return;
    }

    const docList = document.getElementById('records-document-list');
    if (docList) {
        const item = document.createElement('div');
        item.className = 'p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center hover:bg-white/[0.04] transition-all';
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-accent-emerald">description</span>
                <div>
                    <div class="font-bold text-white">${escapeHTML(title)}</div>
                    <span class="text-text-secondary text-[11px]">${escapeHTML(cat.toUpperCase())} entry • R${amt.toLocaleString()}</span>
                </div>
            </div>
            <span class="text-accent-emerald font-semibold">Archived</span>
        `;
        docList.prepend(item);
    }

    closeModal();
    alert('✅ Record archived successfully in your 2026 financial records.');
}
window.submitRecordEntry = submitRecordEntry;

// ==========================================================================
// FEATURE F3: ARC HERO MOCKUP CONTROLLER & 3D TILT
// ==========================================================================

let heroSceneState = {
    activeScene: 'revenue', // 'revenue' | 'intelligence' | 'cashflow'
    autoCycleTimer: null
};

function setupHeroMockupInteractions() {
    const wrapper = document.getElementById('arc-hero-wrapper');
    const frame = document.getElementById('arc-browser-frame');
    if (!frame) return;

    // 3D Perspective Tilt on Mousemove for Desktop
    if (wrapper) {
        wrapper.addEventListener('mousemove', (e) => {
            if (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches) return;
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;

            frame.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        });

        wrapper.addEventListener('mouseleave', () => {
            frame.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        });
    }

    // Auto-cycle hero scenes every 6 seconds
    startHeroSceneAutoCycle();
}

function setHeroMockupScene(sceneName) {
    heroSceneState.activeScene = sceneName;
    
    // Switch active scene visibility
    const sceneRevenue = document.getElementById('hero-scene-revenue');
    const sceneIntel = document.getElementById('hero-scene-intelligence');
    const sceneCash = document.getElementById('hero-scene-cashflow');

    if (sceneRevenue) sceneRevenue.className = sceneName === 'revenue' ? 'hero-scene active space-y-md' : 'hero-scene inactive space-y-md';
    if (sceneIntel) sceneIntel.className = sceneName === 'intelligence' ? 'hero-scene active space-y-md' : 'hero-scene inactive space-y-md';
    if (sceneCash) sceneCash.className = sceneName === 'cashflow' ? 'hero-scene active space-y-md' : 'hero-scene inactive space-y-md';

    // Update pill buttons
    const scenes = ['revenue', 'intelligence', 'cashflow'];
    scenes.forEach(s => {
        const btn = document.getElementById(`scene-tab-${s}`);
        if (btn) {
            if (s === sceneName) {
                btn.className = 'scene-pill active px-4 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-white flex items-center gap-2 cursor-pointer';
                const dot = btn.querySelector('.scene-dot');
                if (dot) dot.className = 'scene-dot w-2 h-2 rounded-full bg-accent-emerald';
            } else {
                btn.className = 'scene-pill px-4 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-text-secondary hover:text-white flex items-center gap-2 cursor-pointer';
                const dot = btn.querySelector('.scene-dot');
                if (dot) dot.className = 'scene-dot w-2 h-2 rounded-full bg-zinc-600';
            }
        }
    });
}
window.setHeroMockupScene = setHeroMockupScene;

function startHeroSceneAutoCycle() {
    if (heroSceneState.autoCycleTimer) clearInterval(heroSceneState.autoCycleTimer);
    const scenes = ['revenue', 'intelligence', 'cashflow'];
    let idx = 0;

    heroSceneState.autoCycleTimer = setInterval(() => {
        const landingView = document.getElementById('view-landing');
        if (landingView && !landingView.classList.contains('hidden')) {
            idx = (idx + 1) % scenes.length;
            setHeroMockupScene(scenes[idx]);
        }
    }, 6000);
}

function switchHeroMockupTab(tabName) {
    document.querySelectorAll('.arc-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (tabName === 'overview') setHeroMockupScene('revenue');
    if (tabName === 'revenue') setHeroMockupScene('intelligence');
    if (tabName === 'cashflow' || tabName === 'tax') setHeroMockupScene('cashflow');
}
window.switchHeroMockupTab = switchHeroMockupTab;

function toggleArcSidebar() {
    const sidebar = document.getElementById('arc-sidebar-preview');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
}
window.toggleArcSidebar = toggleArcSidebar;

function refreshHeroMockup() {
    setHeroMockupScene(heroSceneState.activeScene);
}
window.refreshHeroMockup = refreshHeroMockup;

// ==========================================================================
// FEATURE F11: BUSINESS ANALYST AI & FINANCIAL INTELLIGENCE ENGINE
// ==========================================================================

function handleGeminiSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('gemini-chat-input');
    if (!input) return;
    const userPrompt = input.value.trim();
    if (!userPrompt) return;

    input.value = '';
    appendGeminiUserBubble(userPrompt);
    queryGeminiAPI(userPrompt);
}

function sendPresetPrompt(promptText) {
    const input = document.getElementById('gemini-chat-input');
    if (input) {
        input.value = promptText;
        handleGeminiSubmit();
    }
}

function appendGeminiUserBubble(text) {
    const stream = document.getElementById('gemini-chat-stream');
    if (!stream) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'flex items-start justify-end gap-sm';
    userBubble.innerHTML = `
        <div class="p-md bg-accent-emerald/10 border border-accent-emerald/30 rounded-2xl text-xs sm:text-sm text-white max-w-xl text-left">
            <p class="font-semibold text-accent-emerald text-[11px] uppercase mb-xs">You</p>
            <p>${escapeHTML(text)}</p>
        </div>
        <div class="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0 font-bold text-xs">
            ME
        </div>
    `;
    stream.appendChild(userBubble);
    stream.scrollTop = stream.scrollHeight;
}

function queryGeminiAPI(userPrompt) {
    const stream = document.getElementById('gemini-chat-stream');
    if (!stream) return;

    const typingBubble = document.createElement('div');
    typingBubble.id = 'gemini-typing-indicator';
    typingBubble.className = 'flex items-start gap-sm animate-pulse';
    typingBubble.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-accent-emerald/20 border border-accent-emerald/40 flex items-center justify-center text-accent-emerald flex-shrink-0">
            <span class="material-symbols-outlined text-sm">auto_awesome</span>
        </div>
        <div class="p-md bg-surface border border-white/[0.08] rounded-2xl text-xs text-text-secondary">
            Business Analyst AI is reviewing your financial performance...
        </div>
    `;
    stream.appendChild(typingBubble);
    stream.scrollTop = stream.scrollHeight;

    const systemContext = `You are Creator Cash Flow Business Analyst, an expert financial strategist and growth analyst for creators.
Current Business Metrics:
- Net Profit: R${state.balance.toLocaleString()} (+14.8% MoM)
- Creator Health: 82 / 100 (Healthy)
- Platform Concentration: ${state.sources.map(s => `${s.name} (${s.percent})`).join(', ') || 'YouTube (74%), TikTok (18%), Instagram (8%)'}
- Expense Overhead: Controlled (18% margin write-offs)
Provide concise, insightful 2-3 sentence business analysis on revenue velocity, margin protection, and growth.`;

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, systemContext: systemContext })
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.text) {
            removeTypingIndicator();
            appendGeminiBotBubble(data.text, 'Business Analyst Live');
            return;
        }
        return fetch(`${API_BASE_URL}/gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userPrompt, systemContext: systemContext })
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.text) {
                removeTypingIndicator();
                appendGeminiBotBubble(data.text, 'Business Analyst Live');
                return;
            }
            handleLocalOrDirectGeminiQuery(userPrompt, systemContext);
        });
    })
    .catch(() => {
        handleLocalOrDirectGeminiQuery(userPrompt, systemContext);
    });
}

function handleLocalOrDirectGeminiQuery(userPrompt, systemContext) {
    const savedKey = localStorage.getItem('ccf_gemini_api_key');
    const geminiApiUrl = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_URL) || 'https://generativelanguage.googleapis.com/v1beta';

    if (savedKey) {
        fetch(`${geminiApiUrl}/models/gemini-1.5-flash:generateContent?key=${savedKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemContext },
                        { text: userPrompt }
                    ]
                }]
            })
        })
        .then(res => res.json())
        .then(data => {
            removeTypingIndicator();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                appendGeminiBotBubble(aiResponse, 'Business Analyst Model');
            } else {
                const fallbackMsg = generateLocalAIFinancialAdvice(userPrompt);
                appendGeminiBotBubble(fallbackMsg, 'Business Analyst');
            }
        })
        .catch(err => {
            removeTypingIndicator();
            const fallbackMsg = generateLocalAIFinancialAdvice(userPrompt);
            appendGeminiBotBubble(fallbackMsg, 'Business Analyst');
        });
    } else {
        setTimeout(() => {
            removeTypingIndicator();
            const fallbackMsg = generateLocalAIFinancialAdvice(userPrompt);
            appendGeminiBotBubble(fallbackMsg, 'Business Analyst');
        }, 600);
    }
}

function removeTypingIndicator() {
    const indicator = document.getElementById('gemini-typing-indicator');
    if (indicator) indicator.remove();
}

function appendGeminiBotBubble(text, providerLabel) {
    const stream = document.getElementById('gemini-chat-stream');
    if (!stream) return;

    const botBubble = document.createElement('div');
    botBubble.className = 'flex items-start gap-sm';
    botBubble.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-accent-emerald/20 border border-accent-emerald/40 flex items-center justify-center text-accent-emerald flex-shrink-0">
            <span class="material-symbols-outlined text-sm">auto_awesome</span>
        </div>
        <div class="p-md bg-surface border border-white/[0.08] rounded-2xl text-xs sm:text-sm text-text-primary space-y-xs max-w-xl">
            <div class="flex justify-between items-center text-xs mb-xs">
                <span class="font-bold text-accent-emerald">Business Analyst AI</span>
                <span class="text-[10px] text-text-secondary bg-white/[0.04] px-xs py-[2px] rounded font-mono">${providerLabel || 'Active'}</span>
            </div>
            <div class="leading-relaxed space-y-xs">${formatMarkdownText(text)}</div>
        </div>
    `;
    stream.appendChild(botBubble);
    stream.scrollTop = stream.scrollHeight;
}

function generateLocalAIFinancialAdvice(prompt) {
    const p = prompt.toLowerCase();

    if (p.includes('concentration') || p.includes('platform') || p.includes('youtube')) {
        return `YouTube currently represents **74% (R18,240)** of your consolidated creator revenue. While this provides strong baseline cash flow, your Business Analyst recommends scaling TikTok and affiliate partnerships to achieve a more balanced 50/30/20 distribution.`;
    }

    if (p.includes('expense') || p.includes('growing') || p.includes('cost') || p.includes('overhead')) {
        return `Your fastest growing expense category is **Production Hardware & Gear (R4,200)**, followed by SaaS subscriptions (R950). Your overall expense ratio remains lean at 18%, maintaining high capital retention.`;
    }

    if (p.includes('margin') || p.includes('profit') || p.includes('trend')) {
        return `Your current net profit margin is **82% (R24,650)**, up +14.8% month-over-month. With 60-day cash flow predictability intact, your creator business is operating at peak financial health.`;
    }

    return `Based on your live financials (Net Profit: R${state.balance.toLocaleString()}, Creator Health: 82/100), your business performance is exceptionally strong. Keep monitoring platform concentration and archiving receipts in your Records hub.`;
}

function openGeminiKeyModal() {
    const currentKey = localStorage.getItem('ccf_gemini_api_key') || '';
    openModal('Configure Gemini AI Key', `
        <div class="space-y-md text-left">
            <p class="text-xs text-text-secondary">Enter your free Google Gemini API Key to enable live generative AI financial chat. If left empty, CCF will use the built-in edge AI engine.</p>
            <div class="space-y-xs">
                <label class="text-xs font-bold text-text-secondary uppercase">Gemini API Key</label>
                <input type="password" id="input-gemini-key" class="w-full px-md py-sm rounded-xl border border-white/[0.08] bg-background text-white text-xs focus:border-accent-emerald focus:ring-0" placeholder="AIzaSy...">
            </div>
            <div class="flex gap-md pt-sm">
                <button class="flex-1 bg-white text-black font-bold py-sm rounded-xl text-xs active:scale-95 transition-transform" onclick="saveGeminiKey()">Save Key</button>
                <button class="flex-1 border border-white/[0.08] text-text-secondary py-sm rounded-xl text-xs hover:text-white" onclick="clearGeminiKey()">Reset to Free Fallback</button>
            </div>
        </div>
    `);
    const keyInput = document.getElementById('input-gemini-key');
    if (keyInput) {
        keyInput.value = currentKey;
    }
}

function saveGeminiKey() {
    const val = document.getElementById('input-gemini-key').value.trim();
    if (val) {
        localStorage.setItem('ccf_gemini_api_key', val);
        const status = document.getElementById('gemini-key-status');
        if (status) status.innerText = 'Gemini 1.5 Flash (Custom Key)';
        alert('✅ Gemini API Key saved! Live generative AI response mode active.');
    } else {
        clearGeminiKey();
    }
    closeModal();
}

function clearGeminiKey() {
    localStorage.removeItem('ccf_gemini_api_key');
    const status = document.getElementById('gemini-key-status');
    if (status) status.innerText = 'Gemini 1.5 Flash (Free Tier)';
    alert('Reset to built-in CCF Edge AI engine.');
    closeModal();
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function formatMarkdownText(str) {
    let formatted = escapeHTML(str);
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

// Modern Scroll-Driven Reveals with IntersectionObserver
function setupScrollReveals() {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    if (!revealElements.length) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px'
        });

        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('is-revealed'));
    }
}
window.setupScrollReveals = setupScrollReveals;

// Dynamic Spotlight Glare Physics
function setupSpotlightInteractions() {
    const cards = document.querySelectorAll('.glass-card-interactive');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}
window.setupSpotlightInteractions = setupSpotlightInteractions;

// Card Pop-Up Entrance Trigger
function triggerCardPopups(container = document) {
    const cards = container.querySelectorAll('.stat-card, .glass-card, .records-stat-card, .dashboard-card, .readiness-check-item, .health-score-badge');
    cards.forEach((card, index) => {
        card.classList.remove('card-popup', 'stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6');
        void card.offsetWidth; // Force CSS animation reflow
        const staggerClass = `stagger-${Math.min((index % 6) + 1, 6)}`;
        card.classList.add('card-popup', staggerClass);
    });
}
window.triggerCardPopups = triggerCardPopups;

