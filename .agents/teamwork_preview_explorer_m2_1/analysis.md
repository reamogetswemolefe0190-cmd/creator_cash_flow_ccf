# Milestone M2 Implementation Strategy — High-Conversion 6-Step Onboarding Wizard (F5 & F6)

## Executive Overview
This document provides the exact, file-by-file modification strategy for **Milestone M2 (High-Conversion 6-Step Onboarding Wizard)** of Creator Cash Flow (CCF). It covers:
- **Feature F5**: 6-Step Onboarding Wizard Flow (Step progress bar indicator `Step X of 6`, percentage progress fill bar, `← Back` navigation buttons for steps 2–6, step state validation via `validateStep(stepNum)` preventing advancing without selecting an option).
- **Feature F6**: Platform Choice & Goal Selection Cards (Interactive cards with active emerald ring borders `ring-2 ring-accent-emerald`, platform & goal visual icons, radio checkmark status indicators).
- **Glassmorphic Polish**: Backdrop blur (`backdrop-blur-xl`), translucent container overlays (`bg-surface/80`), ambient radial mesh glow backdrop, and smooth Framer-inspired `@keyframes onboardStepIn` entry transitions.

---

## Codebase Audit & Baseline State

### 1. `index.html` (Lines 415–532)
- `#view-onboarding` container wraps the onboarding wizard in `.w-full.max-w-xl.bg-surface.border.border-white/[0.08]`.
- 6 step divs exist (`#onboard-step-1` to `#onboard-step-6`).
- **Gaps**:
  - Missing step counter header (`Step 1 of 6`).
  - Missing progress bar indicator fill line.
  - Missing `← Back` navigation button on steps 2–6.
  - Missing validation error banner/message container.
  - Choice cards in steps 2, 3, 4 lack platform/goal icons, checkmark indicators, and high-contrast visual hierarchy.

### 2. `app.js` (Lines 154–230)
- `nextOnboardStep(stepNum)` toggles `.hidden` on step divs.
- Choice handlers (`selectCreatorType`, `togglePlatformChoice`, `selectGoal`) manipulate `onboardingState`.
- **Gaps**:
  - `onboardingState` lacks `currentStep` tracking (defaults to untracked step index).
  - No `validateStep(stepNum)` logic. Advancing step 2, 3, or 4 without picking an option currently allowed.
  - No `prevOnboardStep()` handler for `← Back` navigation.
  - No `updateOnboardingProgress(stepNum)` function to update step counter text, bar width, and back button visibility.

### 3. `style.css` (Lines 24–29, 95–109)
- `.onboard-choice-card.active` defines standard green border and glow.
- **Gaps**:
  - Lacks emerald ring border focus styling (`ring-2 ring-accent-emerald`).
  - Lacks checkmark indicator icon states (`.check-indicator`).
  - Lacks shake keyframes (`@keyframes shake`) for validation failure feedback.
  - Lacks smooth step entry animation (`@keyframes onboardStepIn`).

---

## Detailed Technical Modification Strategy

### 1. `index.html` Modifications (`index.html:415-532`)

#### A. Ambient Glow & Wizard Container Setup (`index.html:415-418`)
Replace the `#view-onboarding` wrapper header with:
```html
<div id="view-onboarding" class="onboarding-wrapper hidden min-h-screen flex items-center justify-center p-md relative overflow-hidden">
    
    <!-- Ambient Multi-Color Radial Gradient Glow Backdrop -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-accent-emerald/20 via-teal-500/10 to-indigo-600/20 rounded-full blur-[120px] opacity-60"></div>
    </div>

    <!-- Glassmorphic Card Container -->
    <div class="w-full max-w-xl bg-surface/80 backdrop-blur-xl border border-white/[0.12] card-shadow rounded-3xl p-6 sm:p-8 relative z-10 space-y-md">
        
        <!-- Step Navigation Bar (Back Button & Counter) -->
        <div class="flex items-center justify-between min-h-[24px]" id="onboard-nav-header">
            <button id="onboard-back-btn" class="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-white transition-colors invisible" onclick="prevOnboardStep()">
                <span class="material-symbols-outlined text-sm">arrow_back</span>
                Back
            </button>
            <span id="onboard-step-counter" class="text-xs font-bold text-text-secondary tracking-wide">Step 1 of 6</span>
        </div>

        <!-- Step Progress Bar Fill Indicator -->
        <div class="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-md">
            <div id="onboard-progress-fill" class="h-full bg-accent-emerald transition-all duration-300 ease-out rounded-full" style="width: 16.666%;"></div>
        </div>

        <!-- Selection Validation Banner -->
        <div id="onboard-validation-error" class="hidden p-xs px-sm bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-xs">
            <span class="material-symbols-outlined text-sm">error</span>
            <span id="onboard-error-text">Please make a selection to continue.</span>
        </div>
```

#### B. Step 2 (Creator Type) Choice Cards with Visual Indicators (`index.html:433-450`)
```html
<div class="onboarding-step hidden space-y-md" id="onboard-step-2">
    <div class="text-center space-y-xs">
        <h1 class="font-display text-2xl font-extrabold text-white">What kind of creator are you?</h1>
        <p class="text-xs text-text-secondary">Select your primary content format to customize your revenue views.</p>
    </div>
    <div class="grid grid-cols-1 gap-md">
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between group" data-value="YouTuber" onclick="selectCreatorType(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center icon-container transition-colors">
                    <span class="material-symbols-outlined text-red-500 text-xl">play_circle</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">YouTube Creator</div>
                    <p class="text-xs text-text-secondary">Longform video, shorts, and Google AdSense</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between group" data-value="TikTok" onclick="selectCreatorType(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center icon-container transition-colors">
                    <span class="material-symbols-outlined text-cyan-400 text-xl">music_note</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">TikTok Creator</div>
                    <p class="text-xs text-text-secondary">Shortform video, rewards, and brand sponsorships</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between group" data-value="Streamer" onclick="selectCreatorType(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center icon-container transition-colors">
                    <span class="material-symbols-outlined text-purple-400 text-xl">sensors</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">Streamer</div>
                    <p class="text-xs text-text-secondary">Live broadcasts, subscriber support, and ads</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
    </div>
    <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl active:scale-95 transition-transform mt-lg shadow-lg hover:bg-white/90" onclick="nextOnboardStep(3)">Continue</button>
</div>
```

#### C. Step 3 (Revenue Sources) Choice Cards (`index.html:453-474`)
```html
<div class="onboarding-step hidden space-y-md" id="onboard-step-3">
    <div class="text-center space-y-xs">
        <h1 class="font-display text-2xl font-extrabold text-white">Which platforms generate revenue?</h1>
        <p class="text-xs text-text-secondary">Select all platforms you want to track in your dashboard.</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-md" id="onboard-choice-grid">
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="YouTube" onclick="togglePlatformChoice(this)">
            <div class="flex items-center gap-sm">
                <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-red-500 text-base">play_circle</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm">YouTube</div>
                    <div class="text-[11px] text-text-secondary">AdSense</div>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-lg">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="TikTok" onclick="togglePlatformChoice(this)">
            <div class="flex items-center gap-sm">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-cyan-400 text-base">music_note</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm">TikTok</div>
                    <div class="text-[11px] text-text-secondary">Rewards</div>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-lg">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="Instagram" onclick="togglePlatformChoice(this)">
            <div class="flex items-center gap-sm">
                <div class="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-pink-400 text-base">photo_camera</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm">Instagram</div>
                    <div class="text-[11px] text-text-secondary">Sponsorships</div>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-lg">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="Patreon" onclick="togglePlatformChoice(this)">
            <div class="flex items-center gap-sm">
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-amber-400 text-base">account_balance_wallet</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm">Patreon</div>
                    <div class="text-[11px] text-text-secondary">Subscriptions</div>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-lg">radio_button_unchecked</span>
            </div>
        </div>
    </div>
    <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl active:scale-95 transition-transform mt-lg shadow-lg hover:bg-white/90" onclick="nextOnboardStep(4)">Continue</button>
</div>
```

#### D. Step 4 (Primary Goal) Choice Cards (`index.html:477-491`)
```html
<div class="onboarding-step hidden space-y-md" id="onboard-step-4">
    <div class="text-center space-y-xs">
        <h1 class="font-display text-2xl font-extrabold text-white">What's your primary goal?</h1>
        <p class="text-xs text-text-secondary">We'll prioritize your dashboard intelligence based on your objective.</p>
    </div>
    <div class="grid grid-cols-1 gap-md">
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="Track Revenue" onclick="selectGoal(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-emerald-400 text-xl">trending_up</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">Track Revenue</div>
                    <p class="text-xs text-text-secondary">Consolidate income streams into a single live view</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="Understand Profitability" onclick="selectGoal(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-teal-400 text-xl">pie_chart</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">Understand Profitability</div>
                    <p class="text-xs text-text-secondary">Calculate net margins after expenses and tax holds</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
        <div class="onboard-choice-card border border-white/[0.08] bg-background/60 hover:bg-white/[0.03] p-md rounded-2xl cursor-pointer flex items-center justify-between" data-value="Prepare Taxes" onclick="selectGoal(this)">
            <div class="flex items-center gap-md">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center icon-container">
                    <span class="material-symbols-outlined text-indigo-400 text-xl">shield</span>
                </div>
                <div>
                    <div class="font-bold text-white text-sm sm:text-base">Prepare Taxes</div>
                    <p class="text-xs text-text-secondary">Automate tax write-offs and quarterly estimations</p>
                </div>
            </div>
            <div class="check-indicator text-white/20 transition-colors">
                <span class="material-symbols-outlined text-xl">radio_button_unchecked</span>
            </div>
        </div>
    </div>
    <button class="w-full bg-white text-black font-bold font-label-lg py-md rounded-xl active:scale-95 transition-transform mt-lg shadow-lg hover:bg-white/90" onclick="nextOnboardStep(5)">Continue</button>
</div>
```

---

### 2. `app.js` Modifications (`app.js:25-30, 156-228`)

#### A. Initialize `currentStep` in `onboardingState` (`app.js:25-30`)
```javascript
const onboardingState = {
    currentStep: 1,
    creatorType: '',
    platforms: [],
    goal: '',
    connected: []
};
```

#### B. Step Navigation, Validation & Progress Controller (`app.js:156-228`)
```javascript
// Step validation engine
function validateStep(stepNum) {
    let isValid = true;
    let errorMsg = '';

    if (stepNum === 2) {
        if (!onboardingState.creatorType) {
            isValid = false;
            errorMsg = 'Please select your creator type to continue.';
        }
    } else if (stepNum === 3) {
        if (!onboardingState.platforms || onboardingState.platforms.length === 0) {
            isValid = false;
            errorMsg = 'Please select at least one platform.';
        }
    } else if (stepNum === 4) {
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
        // Shake step container to give immediate user feedback
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

// Progress Bar & Navigation Header Synchronizer
function updateOnboardingProgress(stepNum) {
    onboardingState.currentStep = stepNum;

    // Update Step Counter Text
    const counterEl = document.getElementById('onboard-step-counter');
    if (counterEl) {
        counterEl.innerText = `Step ${stepNum} of 6`;
    }

    // Update Progress Bar Fill Width
    const progressFill = document.getElementById('onboard-progress-fill');
    if (progressFill) {
        const percentage = Math.min(100, Math.max(0, (stepNum / 6) * 100));
        progressFill.style.width = `${percentage}%`;
    }

    // Update Back Button Visibility
    const backBtn = document.getElementById('onboard-back-btn');
    if (backBtn) {
        if (stepNum > 1) {
            backBtn.classList.remove('invisible');
        } else {
            backBtn.classList.add('invisible');
        }
    }

    // Clear validation error message on step navigation
    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

// Main Step Transition Handler
function nextOnboardStep(targetStepNum) {
    const currentStepNum = onboardingState.currentStep || 1;

    // Validate current step before advancing forward
    if (targetStepNum > currentStepNum) {
        if (!validateStep(currentStepNum)) {
            return false;
        }
    }

    document.querySelectorAll('.onboarding-step').forEach(step => {
        step.classList.add('hidden');
    });

    const nextStep = document.getElementById(`onboard-step-${targetStepNum}`);
    if (nextStep) {
        nextStep.classList.remove('hidden');
    }

    updateOnboardingProgress(targetStepNum);

    if (targetStepNum === 5) {
        const connectList = document.getElementById('onboarding-connect-list');
        if (connectList) {
            connectList.innerHTML = '';
            if (onboardingState.platforms.length === 0) {
                onboardingState.platforms = ['YouTube', 'TikTok'];
            }
            onboardingState.platforms.forEach(platform => {
                const card = document.createElement('div');
                card.className = "connection-platform-card flex justify-between items-center p-md bg-surface/60 border border-white/[0.08] rounded-2xl cursor-pointer hover:bg-white/[0.04] transition-all";
                card.onclick = (e) => simulatePlatformConnect(card, platform);
                
                card.innerHTML = `
                    <div class="flex items-center gap-sm">
                        <span class="material-symbols-outlined text-accent-emerald">${platform === 'YouTube' ? 'play_circle' : platform === 'TikTok' ? 'music_note' : platform === 'Instagram' ? 'photo_camera' : 'account_balance_wallet'}</span>
                        <span class="font-body-md font-semibold text-white">${platform} Channel</span>
                    </div>
                    <span class="connect-badge text-xs font-bold border border-white/[0.08] bg-background px-md py-xs rounded-xl" id="connect-${platform}">Connect</span>
                `;
                connectList.appendChild(card);
            });
        }
    }

    if (targetStepNum === 6) {
        triggerMagicMoment();
    }

    return true;
}

// Back Navigation Handler
function prevOnboardStep() {
    const currentStepNum = onboardingState.currentStep || 1;
    if (currentStepNum > 1) {
        nextOnboardStep(currentStepNum - 1);
    }
}

// Choice Handler Updates (with checkmark indicator toggles)
function selectCreatorType(element) {
    document.querySelectorAll('#onboard-step-2 .onboard-choice-card').forEach(opt => {
        opt.classList.remove('active');
        const icon = opt.querySelector('.check-indicator span');
        if (icon) icon.innerText = 'radio_button_unchecked';
    });
    element.classList.add('active');
    const icon = element.querySelector('.check-indicator span');
    if (icon) icon.innerText = 'check_circle';
    onboardingState.creatorType = element.getAttribute('data-value');

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

    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');
}

function selectGoal(element) {
    document.querySelectorAll('#onboard-step-4 .onboard-choice-card').forEach(opt => {
        opt.classList.remove('active');
        const icon = opt.querySelector('.check-indicator span');
        if (icon) icon.innerText = 'radio_button_unchecked';
    });
    element.classList.add('active');
    const icon = element.querySelector('.check-indicator span');
    if (icon) icon.innerText = 'check_circle';
    onboardingState.goal = element.getAttribute('data-value');

    const errorEl = document.getElementById('onboard-validation-error');
    if (errorEl) errorEl.classList.add('hidden');
}
```

---

### 3. `style.css` Modifications (`style.css:24-30, 80-110`)

Add these CSS rules to `style.css`:

```css
/* ==========================================================================
   FEATURE F5 & F6: ONBOARDING WIZARD STYLING & ANIMATIONS
   ========================================================================== */

/* Active Choice Card Ring & Glow */
.onboard-choice-card {
    position: relative;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.onboard-choice-card.active {
    border-color: #22C55E !important;
    background-color: rgba(34, 197, 94, 0.08) !important;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4), 0 8px 25px -5px rgba(34, 197, 94, 0.25) !important;
}

.onboard-choice-card.active .check-indicator {
    color: #22C55E !important;
}

.onboard-choice-card.active .icon-container {
    background-color: rgba(34, 197, 94, 0.15) !important;
    border-color: rgba(34, 197, 94, 0.3) !important;
}

.onboard-choice-card.active .icon-container span {
    color: #22C55E !important;
}

/* Validation Shake Keyframes */
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
}

.animate-shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

/* Fluid Step Entry Transition */
@keyframes onboardStepIn {
    from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.onboarding-step:not(.hidden) {
    animation: onboardStepIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

---

## Responsive Viewport Optimization (375px to 1440px+)

1. **375px (iPhone SE)**:
   - Mobile card container padding `p-6` (24px) allows adequate breathing room.
   - Text size on titles `text-2xl` scales down gracefully.
   - Platform choice cards stack single-column smoothly.
2. **390px / 430px (iPhone 14 / Pro Max)**:
   - Full touch target height (`min-h-[48px]`) for all choice cards and buttons.
3. **768px (Tablet)**:
   - Step 3 revenue grid displays clean 2x2 grid layout (`sm:grid-cols-2`).
4. **1024px / 1440px+ (Desktop)**:
   - Centered wizard card at `max-w-xl` with backdrop glow filling ambient screen space.

---

## Conclusion & Action Plan for Implementer
This strategy provides exact HTML, CSS, and JS snippets required to fulfill **F5** and **F6** under **Milestone M2**. All changes align with the Arc & Framer-inspired design system.
