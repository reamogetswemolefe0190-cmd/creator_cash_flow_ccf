# Adversarial Challenge Report: Milestone M1 (Arc & Framer Landing Page Redesign)

**Auditor / Challenger**: Challenger 1 (EMPIRICAL CHALLENGER)  
**Milestone**: M1 (Arc & Framer Landing Page Redesign)  
**Target Files**: `index.html`, `style.css`, `app.js`  
**Verdict**: **REJECT**

---

## Challenge Summary

**Overall risk assessment**: **HIGH**

While Worker M1 authored keyframe animations and glassmorphic styling utilities in `style.css` and added interactive mockup controller functions in `app.js`, empirical testing using headless Chrome DevTools Protocol (CDP) across viewports (375px, 390px, 430px, 1440px) uncovered critical implementation flaws that compromise visual stability, animation execution, and mobile responsive layout integrity.

---

## Challenges

### [CRITICAL] Challenge 1: `style.css` is Not Linked in `index.html` — All Custom Keyframes & Glassmorphic Utilities Are Inert

- **Assumption challenged**: Worker M1 claimed that ambient multi-color radial gradient backdrop meshes with keyframe drift animations (`floatEmerald`, `floatTeal`, `floatIndigo`, `pulseCenterCore`) and hover lift card shadows are functioning on the live landing page.
- **Attack scenario**: Loaded `http://localhost:3000` via Chrome CDP and queried `document.styleSheets` for keyframe rules. Inspected `<head>` of `index.html`.
- **Empirical evidence**:
  - `index.html` lines 1–97 contain links to Google Fonts, Chart.js, Lucide, Tailwind CDN, and Phyllo SDK, but **zero** `<link rel="stylesheet" href="style.css">` tags.
  - CDP execution returned `keyframesFound: [ { name: "floatEmerald", found: false }, { name: "floatTeal", found: false }, { name: "floatIndigo", found: false }, { name: "pulseCenterCore", found: false }, { name: "fadeSlideUp", found: false }, { name: "floatBadge", found: false }, { name: "floatBadgeDelayed", found: false } ]`.
- **Blast radius**: None of the 7 custom CSS keyframe animations defined in `style.css` execute. Ambient background mesh gradient orbs (`.ambient-orb-emerald`, `.ambient-orb-teal`, `.ambient-orb-indigo`) and floating live sync badges remain completely static. Glassmorphic card hover lift transitions (`transform: translateY(-2px)`) and specular backdrop saturation in `style.css` are not loaded.
- **Mitigation**: Add `<link rel="stylesheet" href="style.css">` inside `<head>` of `index.html`.

---

### [HIGH] Challenge 2: Arc Hero Mockup Header Elements Overflow Card Container on Mobile Viewports (375px / 390px)

- **Assumption challenged**: Worker M1 claimed responsive layout sweeps across viewports (375px, 390px, 430px, 1440px+) without layout overlaps or clipping.
- **Attack scenario**: Simulated 375px viewport (iPhone SE) via CDP emulation and measured bounding rects (`getBoundingClientRect()`) for all child elements of `#arc-browser-frame`.
- **Empirical evidence**:
  - In `index.html` lines 190–214, the Arc window header flex container houses traffic light dots on the left, a fixed-width URL bar (`flex-1 max-w-md mx-md`), and window action buttons (`flex items-center gap-xs text-text-secondary`) on the right.
  - On a 375px viewport (viewport width 419px rendered window bounds), the right window action buttons (`sidebar toggle`, `reload mockup`) are pushed to `right: 488px` (exceeding the container width by 69px).
- **Blast radius**: Action buttons extend outside the right edge of the Arc Browser frame on narrow screens (iPhone SE / iPhone 14), causing element clipping and visual layout distortion.
- **Mitigation**: Add responsive utility classes (e.g. `hidden sm:flex` or `truncate` on URL text) to allow the header top bar to collapse gracefully on screens under 640px.

---

### [MEDIUM] Challenge 3: Floating Live Sync Badge Edge Proximity & Clipping Risk on Small Viewports

- **Assumption challenged**: Worker M1 claimed floating badges (`+R18,420 AdSense` and `R4,200 Tax Guard`) render floating mockups without layout overlaps across viewports (375px to 1440px+).
- **Attack scenario**: Evaluated bounding boxes of `.badge-top-right` on 375px mobile viewports.
- **Empirical evidence**:
  - In `index.html` line 162, `.badge-top-right` uses absolute offset `absolute -top-6 -right-2 sm:-top-8 sm:-right-8`.
  - On a 375px screen (335px frame width), the right edge of `.badge-top-right` reaches `363px`, leaving only 12px margin from the screen edge. On 320px screens or under scaled display settings, the badge is clipped off-screen.
- **Blast radius**: Potential visual clipping of live sync floating badges on small mobile screens.
- **Mitigation**: Restrict absolute badge positioning on mobile viewports using responsive modifiers (`hidden sm:flex` or scale down badge padding on screens < 430px).

---

## Stress Test Results

| Scenario / Test Case | Target Element / Feature | Expected Behavior | Actual Empirical Result | Pass / Fail |
|---|---|---|---|---|
| 1. Keyframe Animation Loading | `style.css` keyframes in `index.html` | Keyframe rules present in `document.styleSheets` | 0 keyframe rules loaded (`found: false` for all 7 keyframes) | **FAIL** |
| 2. Ambient Mesh Keyframe Drift | `.ambient-orb-emerald` float animation | Drifts via `@keyframes floatEmerald` | Static orb (keyframe rule missing from page) | **FAIL** |
| 3. Mobile Arc Header Bounds (375px) | Header actions div in `#arc-browser-frame` | `right <= winW` (contained within card header) | `right: 488px` vs `winW: 419px` (overflows container by 69px) | **FAIL** |
| 4. Desktop Arc Header Bounds (1440px) | Header actions div in `#arc-browser-frame` | Contained inside frame | `right: 1145px` vs `winW: 1440px` | **PASS** |
| 5. Period Toggle Interaction | `#toggle-btn-monthly` / `#toggle-btn-annual` | Toggle balance (`R24,650` ↔ `R295,800`) & sparkline path | Balance toggled correctly, SVG path updated (`d` attribute) | **PASS** |
| 6. Mockup Tab Switcher | `switchHeroMockupTab('revenue'/'tax')` | Active tab state and header title update | Titles updated: `Consolidated Revenue Streams` / `Tax Deduction & Savings Engine` | **PASS** |
| 7. Arc Sidebar Toggle | `toggleArcSidebar()` | Toggles `.hidden` class on `#arc-sidebar-preview` | Hidden class toggled (`initHidden: true` -> `afterHidden: false`) | **PASS** |
| 8. JS Console Errors | Execution across viewports | Zero console errors | 0 runtime exceptions thrown | **PASS** |

---

## Unchallenged Areas

- **Phyllo SDK Connection Flow**: Out of scope for Milestone M1 (planned for Milestone M2).
- **Backend API Endpoints (`server.js`)**: Out of scope for Milestone M1 landing page redesign.

---

## Explicit Verdict

**REJECT** — Milestone M1 requires candidate fixes:
1. Add `<link rel="stylesheet" href="style.css">` to `<head>` of `index.html`.
2. Fix responsive flex layout of `#arc-browser-frame` header top bar on viewports < 480px to prevent window action buttons from overflowing the right edge of the card container.
