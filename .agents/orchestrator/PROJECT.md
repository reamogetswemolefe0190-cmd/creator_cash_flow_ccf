# Project: Creator Cash Flow (CCF) Redesign

## Architecture
- **Frontend**: Vanilla HTML5/ES6 SPA (`index.html`, `app.js`, `style.css`), Tailwind CSS CDN, Chart.js, Lucide Icons, Phyllo Connect SDK. Served on port 3000 via HTTP server (`python -m http.server 3000` or `npx serve`).
- **Backend**: Node.js/Express REST API (`server.js`) running on port 5000 (`npm start` / `npm run dev`), integrating Supabase Cloud PostgreSQL with in-memory DB fallback (`memoryDb`).
- **Dependencies**: `npm install` installs express, @supabase/supabase-js, bcryptjs, cors, jsonwebtoken, etc.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Floating Glassmorphic Pill Navbar | Full-width glass backdrop, rounded pill bar, translucent overlay, navigation links | M1 | ORIGINAL_REQUEST R1 |
| F2 | Ambient Multi-Color Mesh Backdrops | Animated floating radial gradients (emerald, teal, violet) with CSS drift keyframes | M1 | ORIGINAL_REQUEST R1 |
| F3 | Arc Browser Hero Product Mockup | Multi-layered interactive browser frame, live stats, status toggles, depth tilt | M1 | ORIGINAL_REQUEST R1 |
| F4 | Glassmorphic Cards & Layout (Landing) | Translucent cards (`bg-white/[0.03]`, `backdrop-blur-md`), grid layout, responsive | M1 | ORIGINAL_REQUEST R1 |
| F5 | 6-Step Onboarding Wizard Flow | 6 distinct steps, step progress bar, "← Back" navigation buttons, step state validation | M2 | ORIGINAL_REQUEST R2 |
| F6 | Platform Choice & Goal Cards | Platform choice selection (YouTube, Twitch, TikTok, etc.), goal selection cards | M2 | ORIGINAL_REQUEST R2 |
| F7 | Phyllo Connection & Fallback Bypass | Phyllo Connect integration, defensive JS guard (`typeof PhylloConnect`), manual skip bypass link | M2 | ORIGINAL_REQUEST R2 |
| F8 | Launch Transition & Dashboard Sync | Celebratory spring launch transition animation, state persistence, dashboard command center switch | M2 | ORIGINAL_REQUEST R2 |
| F9 | Micro-Interactions & Hover Lift | 2px translateY card lifts on hover, vibrant emerald border glows, active selection indicator springs | M3 | ORIGINAL_REQUEST R3 |
| F10| Hero Text Staggered Entrance | Staggered entrance animation delays (100ms, 200ms, 300ms) for hero text, titles, callouts | M3 | ORIGINAL_REQUEST R3 |
| F11| Viewport & Mobile Polish | Visual sweep & padding optimization for 375px (iPhone SE), 390px (iPhone 14), 430px (iPhone 14 Pro Max) to 1440px+ | M3 | Acceptance Criteria |
| F12| Zero JS Console Errors | Defensive guards across scripts, clean console execution during all interactions | M3 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Arc & Framer Landing Page Redesign | Floating pill navbar, ambient multi-color gradient mesh glows, Arc browser hero mockup, glassmorphic cards | none | DONE |
| M2 | High-Conversion 6-Step Onboarding Wizard | 6-step wizard, progress bar, back buttons, platform/goal selection, Phyllo connection with defensive guard & manual bypass, launch transition | M1 | DONE |
| M3 | Modern Motion & Micro-Interactions & Responsive Sweep | Staggered entrance animations, 2px card lifts, vibrant border glows, 375px-1440px viewport polish, zero console errors | M1, M2 | IN_PROGRESS |
| M4 | Final Milestone & Hardening | Pass 100% E2E test suite across viewports and execute Tier 5 adversarial hardening | M1, M2, M3 | PLANNED |

## Interface Contracts
### Frontend (`index.html` / `app.js` / `style.css`) ↔ Backend (`server.js`)
- `POST /api/onboarding/save`: `{ creatorType, platforms, goal, connected }` → `{ success: true, message: "Onboarding responses saved successfully" }`
- `GET /api/integrations/phyllo/token`: `{ user_id, work_platform_id }` → `{ sdk_token, user_id, ... }` (or mock fallback if unconfigured)
- `GET http://localhost:5000/`: API health check → status 200

## Code Layout
- `index.html`: Marketing hero, onboarding wizard modal, app dashboard views, modal containers.
- `style.css`: Glassmorphic styling classes, keyframes (ambient gradient drift, staggered fadeSlideUp, hover lifts, selection springs), theme variables.
- `app.js`: SPA routing, onboarding step controller, Phyllo connect handlers, selection validation, dashboard updates.
- `server.js`: Express REST endpoints, Supabase/memoryDb store, Phyllo token proxy.
