# Dispatch Instructions for Worker M3: Modular Architecture Refactoring & Memory Safety

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3`

## Role & Archetype
- Archetype: teamwork_preview_worker
- Role: Modular Architecture & Memory Safety Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch\handoff.md` (detailed architectural blueprint and file mappings).
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Implementation Objectives

### 1. Modular Server Decomposition (Feature 11)
Decompose monolithic `server.js` into clean, single-responsibility modules:
- `config/`:
  - `config/env.js`: Environment variables, fallback validation (fail-fast in production).
  - `config/cors.js`: Whitelisted CORS configuration.
- `services/`:
  - `services/memoryDb.js`: `memoryDb` in-memory database, seed creators & transactions, lookup helpers.
  - `services/geminiService.js`: Retain existing unified Gemini client (`maskPII`, `inferCategoryTag`, `generateContent`).
- `middleware/`:
  - `middleware/auth.js`: `authenticateToken` with JWT validation and demo/offline token support.
  - `middleware/adminAuth.js`: `requireAdmin` role verification.
  - `middleware/rateLimiter.js`: Sliding-window rate limiters with active unreferenced TTL cleanup timers (`cleanupTimer.unref()`). Bounded map capacity (max 1,000 IPs).
  - `middleware/validation.js`: Retain existing input validation and sanitization middleware.
  - `middleware/errorHandler.js`: Centralized JSON error handler and catch-all 404 JSON envelope.
- `controllers/`:
  - `controllers/authController.js`: User signup and login.
  - `controllers/adminController.js`: Admin login, verify auth, metrics, creators list, creator status mutation, audit logs, telemetry.
  - `controllers/transactionController.js`: User transactions list and create.
  - `controllers/onboardingController.js`: Onboarding data save.
  - `controllers/integrationController.js`: Phyllo SDK integration.
  - `controllers/aiController.js`: Gemini AI endpoint.
  - `controllers/healthController.js`: Health diagnostics check.
- `routes/`:
  - `routes/authRoutes.js`: Mounts `/api/auth/*`
  - `routes/adminRoutes.js`: Mounts `/api/admin/*`
  - `routes/transactionRoutes.js`: Mounts `/api/transactions`
  - `routes/onboardingRoutes.js`: Mounts `/api/onboarding/*`
  - `routes/integrationRoutes.js`: Mounts `/api/integrations/*`
  - `routes/aiRoutes.js`: Mounts `/api/gemini`
  - `routes/healthRoutes.js`: Mounts `/api/health`
- **CRITICAL BACKWARD COMPATIBILITY BRIDGE in `server.js`**:
  `server.js` MUST remain the root entrypoint and re-export all required symbols:
  ```javascript
  module.exports = {
      app,
      server,
      memoryDb,
      rateLimitAdminLogin,
      requireAdmin,
      adminLoginAttempts,
      JWT_SECRET,
      maskPII,
      inferCategoryTag,
      getClientIp
  };
  ```
  `server.js` must also contain route path declarations/strings so static assertions in tests like `test_full_site.js:180` (`serverCode.includes('/api/admin/auth/login')`, `serverCode.includes('requireAdmin')`) pass.

### 2. Frontend Script Extraction (Feature 12)
- In `admin.html`:
  - Extract client application JavaScript (lines 665–1548) into `admin.js`.
  - Include `<script src="admin.js"></script>` before `</body>`.
  - **CRITICAL**: RETAIN the inline Tailwind configuration script tag (`<script>tailwind.config = ...</script>`) and synchronous tab switcher inline in `admin.html` so `test_full_site.js:83` passes!
- In `index.html`:
  - Extract inline `startOnboarding()` into `app.js` (or link to `app.js`).

### 3. Bounded In-Memory Tracking Maps with TTL (Feature 13)
- In `middleware/rateLimiter.js`:
  - `adminLoginAttempts`: Cap map at 1,000 distinct IPs. Prune expired entries periodically via `setInterval(..., 60000).unref()`.
- In `services/memoryDb.js`:
  - `memoryDb.audit_logs`: Bounded ring buffer with FIFO cap (max 1,000 entries).
  - `memoryDb.ai_telemetry`: Bounded ring buffer with FIFO cap (max 1,000 entries) and 30-day cutoff.

### 4. Deep Health Check Diagnostics (Feature 14)
- Upgrade `GET /api/health` to perform active diagnostics:
  - `status`: `'healthy'` or `'degraded'`
  - `timestamp`: current ISO timestamp string
  - `uptimeSeconds`: process uptime
  - `database`: provider, connection status, latency
  - `memory`: `{ heapUsedMB, heapTotalMB, rssMB }`
  - `integrations`: status of Gemini, Phyllo, Resend
  - Returns HTTP 200 with standard JSON envelope.

### 5. Test Suite Verification
Run all automated test suites and verify 100% pass:
```bash
node test_full_site.js
node test_admin_auth.js
node test_admin_ui.js
node test_admin_m3.js
node test_admin_metrics.js
node tests/e2e_remediation_test.js
node tests/m2_verification_test.js
node tests/challenger_m2_adversarial.js
node tests/adversarial_m2_challenger2.js
```

## Output Requirements
Write your detailed implementation and verification report to:

## 2026-09-04T15:39:10Z
You are Worker M3: Modular Architecture Refactoring & Memory Safety Specialist.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`, `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute Milestone M3:
1. Decompose `server.js` into modular files under `config/`, `services/`, `middleware/`, `controllers/`, and `routes/`.
   - Preserve all exports in `server.js`: `{ app, server, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET, maskPII, inferCategoryTag, getClientIp }`.
   - Preserve route strings/comments in `server.js` (`/api/admin/auth/login`, `requireAdmin`) for `test_full_site.js:180`.
2. Extract client JavaScript from `admin.html` (lines 665–1548) into `admin.js` (<script src="admin.js"></script>).
   - RETAIN the inline Tailwind configuration script tag (`<script>tailwind.config = ...</script>`) and synchronous tab switcher inline in `admin.html` so `test_full_site.js:83` passes!
3. Extract `startOnboarding()` from `index.html` into `app.js`.
4. Implement bounded TTL in-memory maps in `middleware/rateLimiter.js` and `services/memoryDb.js` (active unref timer sweeps, max 1000 items, FIFO slicing for audit logs & telemetry).
5. Upgrade `GET /api/health` with deep diagnostics (database ping, memory metrics `heapUsedMB`/`rssMB`, uptime, external service config).
6. Verify all test suites: `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node test_admin_metrics.js`, `node tests/e2e_remediation_test.js`, `node tests/m2_verification_test.js`, `node tests/challenger_m2_adversarial.js`, `node tests/adversarial_m2_challenger2.js`.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md` and send a message when complete. Maintain progress.md with timestamps.
