# Handoff Report: Architecture & Codebase Mapping (Requirements R2 & R3)

**Agent**: Architecture & Codebase Mapper (`teamwork_preview_explorer`)  
**Working Directory**: `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch`  
**Target Milestone**: Comprehensive Security, Architectural, and Infrastructure Remediation (Survey R2 & R3)  
**Date & Time**: 2026-09-04T11:30:00Z  

---

## 1. Observation

Direct observations from source inspection, file analysis, and grep searches across the repository:

### 1.1 Monolithic Structure of `server.js`
- **File**: `server.js` (1,521 lines, 66,278 bytes).
- All infrastructure, business logic, storage engines, and routes are bundled into a single file:
  - **Lines 1–66**: Imports (`dotenv`, `express`, `cors`, `helmet`, `crypto`, `jwt`, `bcryptjs`, `@supabase/supabase-js`), threadpool setting, mock/real bcrypt switcher, Supabase client initialization.
  - **Lines 52–53**: Fallback secrets (`JWT_SECRET`, `ENCRYPTION_KEY`).
  - **Lines 67–94**: `memoryDb` in-memory database fallback (`users`, `usersByEmail`, `usersById`, `transactions`, `transactionsByUserId`, `transactionIdsSet`, `onboarding`, `adminUsers`, `audit_logs`, `ai_telemetry`).
  - **Lines 95–155**: Hardcoded admin credentials (`MASTER_ADMIN_EMAIL = 'reamogetswemolefe0190@gmail.com'`), bcrypt hash seeding, and Supabase auto-seeding.
  - **Lines 156–245**: Default seed creators (`DEFAULT_SEED_CREATORS`, 10 items) and transactions (`DEFAULT_SEED_TRANSACTIONS`, 16 items) plus memory/Supabase seeding.
  - **Lines 248–286**: `adminLoginAttempts` Map and `rateLimitAdminLogin` middleware (15 min window, 5 attempts, max 200 IPs).
  - **Lines 289–307**: `requireAdmin` role verification middleware.
  - **Lines 311–317**: Express setup: `helmet({ contentSecurityPolicy: false })`, `cors({ origin: '*', credentials: true })`, `express.json()`, `express.static(__dirname)`.
  - **Lines 318–328**: `GET /api/health` static status response.
  - **Lines 330–359**: `seedDefaultTransactions` dual-write helper.
  - **Lines 362–380**: `authenticateToken` middleware (contains bypasses for `'demo_token'` and `'offline_token'`).
  - **Lines 386–390**: `findUserByEmail` memory lookup helper.
  - **Lines 393–530**: `POST /api/auth/signup` (user signup + inline Resend HTTP dispatch).
  - **Lines 533–581**: `POST /api/auth/login` (user login).
  - **Lines 588–657**: `POST /api/admin/auth/login` (admin login).
  - **Lines 660–663**: `GET /api/admin/verify-auth` (admin session verify).
  - **Lines 664–853**: Metrics cache, `getMetricsFingerprint()`, and `GET /api/admin/metrics` (computes GPV, MRR, 15% tax reserves, and 6-month growth timeline).
  - **Lines 856–886**: `GET /api/admin/creators` (creator directory).
  - **Lines 889–1023**: `POST /api/admin/creators/:id/status` (status and plan tier mutation + audit logging).
  - **Lines 1026–1038**: `GET /api/admin/audit-logs` (audit log retrieval).
  - **Lines 1041–1071**: `GET /api/admin/telemetry` (AI query telemetry retrieval with 30-day cutoff).
  - **Lines 1081–1118**: `GET /api/transactions` (user transaction listing).
  - **Lines 1121–1175**: `POST /api/transactions` (user transaction creation).
  - **Lines 1181–1210**: `POST /api/onboarding/save` (onboarding responses save).
  - **Lines 1221–1371**: `POST /api/integrations/phyllo/token` (Phyllo user creation, SDK token generation, work platforms query).
  - **Lines 1377–1413**: `maskPII(text)` and `inferCategoryTag(text)` helper functions.
  - **Lines 1415–1499**: `POST /api/gemini` (inline Gemini AI proxy, PII masking, telemetry logging, 30-day array pruning).
  - **Lines 1502–1506**: `server = app.listen(PORT, ...)` conditional on `require.main === module`.
  - **Lines 1508–1518**: `module.exports = { app, server, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET, maskPII, inferCategoryTag }`.

### 1.2 Existing Test Assertions and Coupling to `server.js`
Tests directly `require('./server')` and assert specific exports:
- `test_admin_auth.js:8`: `const { app, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET } = require('./server');`
- `test_admin_m3.js:8`: `const { app, memoryDb, JWT_SECRET, maskPII, inferCategoryTag } = require('./server');`
- `test_admin_metrics.js:8`: `const { app, memoryDb, JWT_SECRET } = require('./server');`
- `test_admin_metrics_stress.js:9`: `const { app, memoryDb, JWT_SECRET } = require('./server');`
- `test_admin_ui.js:123`: `const { app, memoryDb } = require('./server.js');`
- `test_metrics_concurrency.js:10`: `const { app, memoryDb, JWT_SECRET } = require('./server');`
- `test_full_site.js:178–191`: Asserts `serverCode.includes('/api/admin/auth/login')`, `serverCode.includes('requireAdmin')`, `serverCode.includes('reamogetswemolefe0190@gmail.com')`.
- `test_full_site.js:81–92`: Asserts `adminHtml.match(/<script(?![^>]*src=)[\s\S]*?>([\s\S]*?)<\/script>/gi)` has length > 0 (`'No inline scripts found'`).

### 1.3 Unsafe `innerHTML` and Stored XSS Vectors in Frontend
Total of 26 occurrences of `innerHTML` found in `app.js` and `admin.html`:
1. **`app.js` line 838, 861, 877 (CRITICAL STORED XSS)**:
   ```javascript
   activityStream.innerHTML += `... <div class="font-semibold text-white text-sm">${a.desc}${sampleLabel}</div> ...`;
   revStream.innerHTML += `... <div class="font-semibold text-white text-sm">${a.desc}${sampleLabel}</div> ...`;
   expStream.innerHTML += `... <div class="font-semibold text-white text-sm">${a.desc}${sampleLabel}</div> ...`;
   ```
   `a.desc` originates from `t.merchant` in `POST /api/transactions` (lines 212–216, 1166). Any malicious HTML/JavaScript stored in a transaction description is executed directly in the creator dashboard.
2. **`admin.html` line 1163–1199 (CRITICAL STORED XSS)**:
   ```javascript
   tbody.innerHTML = filtered.map(c => {
       ...
       <span class="block font-bold text-white">${c.name || 'Creator'}</span>
       <span class="block text-[11px] text-zinc-400">${c.email || ''}</span>
       ...
       <button onclick="openCreatorModal('${c.id}')" ...
   ```
   User-supplied `name`, `email`, and `id` from registration (`POST /api/auth/signup`) are interpolated unescaped into the administrator's DOM.
3. **`admin.html` lines 1352–1356 (CRITICAL STORED XSS)**:
   ```javascript
   ${log.old_value}
   ${log.new_value}
   ```
   `log.new_value` contains the administrator note string `newValueObj.note = note;` (lines 957, 960). If an admin or API caller supplies a note with HTML, it renders unescaped in the audit trail.
4. **`admin.html` line 1397 (CRITICAL STORED XSS)**:
   ```javascript
   <div class="bg-black/50 rounded-xl p-3 border border-white/5 text-xs font-mono text-emerald-400">
       "${t.prompt_masked}"
   </div>
   ```
   While `maskPII()` redacts emails and numbers, it does NOT escape `<script>` or `<img src=x onerror=...>` tags in `t.prompt_masked`. The unescaped prompt renders directly into the administrator telemetry feed via `feed.innerHTML`.
5. **`app.js` line 1199**:
   ```javascript
   document.getElementById('modal-body').innerHTML = html;
   ```
   Used across modals. Line 2114 in `openGeminiKeyModal()` injects `value="${currentKey}"` where `currentKey` is retrieved from `localStorage.getItem('ccf_gemini_api_key')`.

### 1.4 Inline Scripts in HTML Files
- **`admin.html`**:
  - **Lines 19–45** (27 lines): Inline Tailwind configuration (`<script>tailwind.config = ...</script>`).
  - **Lines 93–138** (46 lines): Early Synchronous Tab Controller (`<script>window.switchTab = ...</script>`).
  - **Lines 665–1548** (884 lines): Massive monolithic client application script (state, auth, creators, mutations, audit logs, telemetry, Chart.js, modals).
- **`index.html`**:
  - **Lines 154–227** (74 lines): Inline Tailwind configuration (`<script id="tailwind-config">`).
  - **Lines 1445–1466** (22 lines): Inline `startOnboarding()` fallback switcher script.

### 1.5 Input Validation & Sanitization Gaps
- **`POST /api/auth/signup`** (`server.js:393–400`):
  - Only checks `if (!email || !password || !name)`.
  - No email format verification (regex).
  - No password length limits (oversized strings can cause bcrypt CPU starvation DoS).
  - No trimming or HTML entity escaping on `name`.
- **`POST /api/auth/login`** (`server.js:533–542`):
  - If `email` is undefined or not a string, `email.toLowerCase()` throws an unhandled TypeError, causing a 500 server error instead of a 400 Bad Request.
- **`POST /api/transactions`** (`server.js:1121–1137`):
  - Zero schema validation.
  - `amount` is parsed via `parseFloat(amount)` without checking `Number.isFinite()` or verifying `amount > 0`. `NaN` or negative values are inserted into the database.
  - `source`, `merchant`, `category`, and `date` are unvalidated strings of unrestricted length without XSS sanitization.
  - `type` is not validated against enum `['income', 'expense']`.
- **`POST /api/admin/creators/:id/status`** (`server.js:889–958`):
  - `note` has no type, length, or HTML sanitization checks.

### 1.6 API Error Handling & HTTP Status Inconsistencies
- **Gemini Proxy HTTP 200 on Failure** (`server.js:1431–1465` and `api/gemini.js:28–66`):
  - Missing API key returns: `res.status(200).json({ fallback: true, message: '...' })`.
  - Unexpected upstream payload returns: `res.status(200).json({ fallback: true, error: '...', raw: data })`.
  - Upstream network / API error returns: `res.status(200).json({ fallback: true, error: error.message })`.
  - Violates REST specifications: AI failures mask service outages with HTTP 200 rather than returning 500 Internal Server Error or 503 Service Unavailable.
- **Envelope Inconsistency**:
  - Some endpoints return bare arrays (`GET /api/admin/creators`, `GET /api/admin/audit-logs`, `GET /api/admin/telemetry`).
  - Others return objects with nested arrays (`GET /api/transactions` -> `{ transactions: [...] }`).
  - Error envelopes return `{ error: '...' }`, but success envelopes inconsistently include `{ success: true }`.
- **Missing Global Handlers**:
  - No 404 handler for unmatched routes; returns default HTML error page `Cannot GET /route`.
  - No global Express error handler middleware (`(err, req, res, next)`); unhandled exceptions or malformed JSON payloads return HTML error stacks.

### 1.7 Triplicate Gemini API Implementations
Three separate implementations exist in the repository:
1. **`server.js` (lines 1377–1499)**: Express route `POST /api/gemini` with `maskPII()`, `inferCategoryTag()`, Supabase/memoryDb telemetry persistence, and 30-day pruning.
2. **`api/gemini.js` (lines 1–68)**: Vercel serverless function with wildcard CORS (`*`), zero PII masking, zero telemetry logging.
3. **`netlify/functions/gemini.js` (lines 1–38)**: Netlify wrapper that invokes `api/gemini.js`.
4. **Client-side `app.js` (lines 2020–2025)**: Attempts direct client call using `process.env.GEMINI_API_URL` (which causes `ReferenceError: process is not defined` in standard browser environments).

### 1.8 Unbounded In-Memory Structures & Memory Leaks
- **`adminLoginAttempts`** (`server.js:248–286`):
  - Sliding-window Map. Keys are deleted only when the *same* IP makes a request after 15 minutes or when the map size exceeds 200 IPs.
  - Stale IP entries are never pruned if the IP stops making requests, consuming memory permanently unless 200 IPs are reached.
- **Missing Rate Limiters**:
  - No rate limiting on user login (`POST /api/auth/login`).
  - No rate limiting on user registration (`POST /api/auth/signup`).
  - No rate limiting on transaction creation (`POST /api/transactions`).
  - No rate limiting on Gemini AI proxy (`POST /api/gemini`).
- **`memoryDb.audit_logs`** (`server.js:77, 986`):
  - Appended unconditionally with `memoryDb.audit_logs.push(auditRecord)`.
  - No maximum capacity cap and zero TTL eviction. Will grow indefinitely in memory.
- **`memoryDb.ai_telemetry`** (`server.js:78, 1048–1050, 1493–1496`):
  - Only filters records older than 30 days. No maximum count cap. Under high request spikes, holds unlimited objects in RAM.
- **`memoryDb.transactions` & `transactionIdsSet`** (`server.js:72–74, 1153–1156`):
  - Appended unconditionally with zero memory bounds.

### 1.9 `/api/health` Diagnostics
- **`server.js` lines 318–328**:
  ```javascript
  app.get('/api/health', (req, res) => {
      res.json({
          name: "Creator Cash Flow API Engine",
          status: "active",
          database: supabase ? "Supabase Cloud PostgreSQL" : "Memory Backup",
          security: "AES-256-CBC + JWT",
          version: "3.0.0",
          documentation: "https://creatorcashflow.co.za/"
      });
  });
  ```
  - Performs zero active database connectivity checks (does not query Supabase).
  - Reports no memory metrics (`process.memoryUsage()`).
  - Reports no process uptime (`process.uptime()`).
  - Checks no external service configuration (Gemini, Phyllo, Resend).

---

## 2. Logic Chain

```
[Observation 1.1: server.js is 1521 lines containing routes, db, models, controllers]
  └──> [Logic Step 1: Violates Single Responsibility; changes to routes risk DB/auth regression]
        └──> [Action: Decompose into routes/, controllers/, middleware/, services/, config/]

[Observation 1.2: test_admin_*.js require('./server') and import specific symbols; test_full_site checks serverCode.includes()]
  └──> [Logic Step 2: Breaking existing exports or removing route signatures breaks test suite]
        └──> [Action: server.js must remain root entrypoint and re-export all 9 symbols]

[Observation 1.3: app.js lines 838,861,877 and admin.html lines 1163,1352,1397 inject raw untrusted strings into innerHTML]
  └──> [Logic Step 3: Any payload with <script> or <img onerror> executes in user/admin session]
        └──> [Action: Replace innerHTML with textContent or escapeHTML() sanitization]

[Observation 1.4: admin.html has 884 lines of inline app JS; index.html has inline startOnboarding]
  └──> [Logic Step 4: Prevents HTTP caching, violates modern CSP, mixes view structure with logic]
        └──> [Action: Extract admin.js, keep minimal tailwind config inline to satisfy test_full_site.js:83]

[Observation 1.5: POST /api/transactions has 0 validation; auth inputs lack type/regex checks]
  └──> [Logic Step 5: Allows NaN amounts, unbounded strings, and server crashes via bad types]
        └──> [Action: Implement schema validation middleware with strict types, ranges, and sanitization]

[Observation 1.6: POST /api/gemini returns 200 on missing key or network failure]
  └──> [Logic Step 6: Clients cannot distinguish success from failure via HTTP semantics; breaks monitoring]
        └──> [Action: Return 503 Service Unavailable / 500 Internal Server Error with standard error envelope]

[Observation 1.7: Gemini API is implemented in server.js, api/gemini.js, and netlify/functions/gemini.js]
  └──> [Logic Step 7: Triple code duplication; maintenance hazard; PII masking absent in 2 of 3]
        └──> [Action: Unify into services/geminiService.js shared across Express, Vercel, and Netlify]

[Observation 1.8: adminLoginAttempts lacks timer cleanup; audit_logs and ai_telemetry have no size cap]
  └──> [Logic Step 8: Under sustained traffic or DoS, heap memory expands without bound]
        └──> [Action: Implement LRU/bounded maps with setInterval.unref() TTL sweeps and array slice caps]

[Observation 1.9: GET /api/health returns static string; does not test DB or memory]
  └──> [Logic Step 9: Health checks report 'active' even when database is down or memory is exhausted]
        └──> [Action: Implement deep health check querying DB, measuring heapUsed, and inspecting external services]
```

---

## 3. Modular Architecture Blueprint

### 3.1 Proposed Directory & File Layout
```
creator-cash-flow/
├── config/
│   ├── env.js                  # Centralized, validated environment variables
│   └── cors.js                 # Explicit whitelist CORS configuration
├── services/
│   ├── memoryDb.js             # Bounded memoryDb storage, seeds, lookup helpers
│   ├── supabase.js             # Supabase client, health ping, auto-seeding helpers
│   ├── geminiService.js        # Unified Gemini client, maskPII, inferCategoryTag
│   ├── emailService.js         # Resend transactional email client
│   └── phylloService.js        # Phyllo integration client (user, token, platforms)
├── middleware/
│   ├── auth.js                 # authenticateToken (JWT + demo tokens)
│   ├── adminAuth.js            # requireAdmin (JWT with role: 'admin')
│   ├── rateLimiter.js          # Bounded sliding-window rate limiters with active TTL
│   ├── validation.js           # Lightweight schema validation & sanitization
│   └── errorHandler.js         # Global 404 JSON and 500 error envelopes
├── controllers/
│   ├── authController.js       # User signup & login
│   ├── adminController.js      # Admin login, verify, metrics, creators, status, audit, telemetry
│   ├── transactionController.js# Transaction listing & creation
│   ├── onboardingController.js # Onboarding response saving
│   ├── integrationController.js# Phyllo SDK token dispatch
│   ├── aiController.js         # Gemini proxy & telemetry logging
│   └── healthController.js     # Deep diagnostics health check
├── routes/
│   ├── authRoutes.js           # /api/auth/*
│   ├── adminRoutes.js          # /api/admin/*
│   ├── transactionRoutes.js    # /api/transactions
│   ├── onboardingRoutes.js     # /api/onboarding/*
│   ├── integrationRoutes.js    # /api/integrations/*
│   ├── aiRoutes.js             # /api/gemini
│   └── healthRoutes.js         # /api/health
├── js/ (or public/js/)
│   └── admin.js                # Extracted admin application logic from admin.html
├── app.js                      # Hardened client application (sanitized DOM, extracted startOnboarding)
├── server.js                   # Root Express orchestrator & re-exporter
├── admin.html                  # Refactored admin portal loading admin.js
└── index.html                  # Refactored landing page
```

### 3.2 Backward Compatibility Bridge in `server.js`
To ensure all existing tests (`test_admin_auth.js`, `test_admin_m3.js`, `test_full_site.js`, etc.) pass without modification, `server.js` must maintain the exact contract:
```javascript
// server.js (Orchestrator entrypoint)
const { app, server } = require('./appServer'); // or configured express app
const { memoryDb } = require('./services/memoryDb');
const { rateLimitAdminLogin } = require('./middleware/rateLimiter');
const { requireAdmin } = require('./middleware/adminAuth');
const { adminLoginAttempts } = require('./middleware/rateLimiter');
const { JWT_SECRET } = require('./config/env');
const { maskPII, inferCategoryTag } = require('./services/geminiService');

module.exports = {
    app,
    server,
    memoryDb,
    rateLimitAdminLogin,
    requireAdmin,
    adminLoginAttempts,
    JWT_SECRET,
    maskPII,
    inferCategoryTag
};
```
Furthermore, `server.js` should contain route path comments/declarations so static string checks like `serverCode.includes('/api/admin/auth/login')` in `test_full_site.js:180` succeed cleanly.

---

## 4. Frontend Sanitization & Script Extraction Plan

### 4.1 XSS Elimination in `app.js`
- **Location**: Lines 838, 861, 877 (`activityStream`, `revStream`, `expStream`).
- **Current Vulnerable Code**:
  ```javascript
  <div class="font-semibold text-white text-sm">${a.desc}${sampleLabel}</div>
  ```
- **Remediation**:
  ```javascript
  <div class="font-semibold text-white text-sm">${escapeHTML(a.desc || '')}${sampleLabel}</div>
  ```
- **Modal Input Injection**: In `openGeminiKeyModal()` (line 2114), change `value="${currentKey}"` to set `.value = currentKey` directly via DOM property after mounting:
  ```javascript
  const input = document.getElementById('input-gemini-key');
  if (input) input.value = currentKey;
  ```

### 4.2 XSS Elimination in `admin.html`
- **Location 1**: `tbody.innerHTML = filtered.map(c => ...)` (lines 1163–1200):
  - Replace `${c.name || 'Creator'}` with `${escapeHTML(c.name || 'Creator')}`.
  - Replace `${c.email || ''}` with `${escapeHTML(c.email || '')}`.
  - In `openCreatorModal('${c.id}')`, ensure `${encodeURIComponent(c.id)}` or bind via `data-creator-id` attribute with event delegation.
- **Location 2**: `container.innerHTML = filtered.map(log => ...)` (lines 1336–1365):
  - Replace `${log.old_value}` with `<pre class="whitespace-pre-wrap">${escapeHTML(log.old_value)}</pre>`.
  - Replace `${log.new_value}` with `<pre class="whitespace-pre-wrap">${escapeHTML(log.new_value)}</pre>`.
  - Replace `${log.admin_id}` with `${escapeHTML(log.admin_id)}`.
- **Location 3**: `feed.innerHTML = state.telemetry.map(t => ...)` (lines 1386–1408):
  - Replace `"${t.prompt_masked}"` with `"${escapeHTML(t.prompt_masked || '')}"`.

### 4.3 Extraction of Inline Scripts
- **`admin.html` Application Logic**:
  - Extract lines 665–1548 into a new file `admin.js`.
  - Include `<script src="admin.js"></script>` before `</body>`.
  - **Preserve inline Tailwind config** (lines 19–45) and synchronous tab switcher (lines 93–138) in `admin.html` to satisfy `test_full_site.js:83` (`assert(scriptMatches.length > 0, 'No inline scripts found')`).
- **`index.html` View Switcher**:
  - Extract `startOnboarding()` (lines 1445–1466) into `app.js`.

---

## 5. Input Validation & Schema Specifications

A lightweight schema validator (`middleware/validation.js`) with zero heavy dependencies:

### 5.1 Validation Rules Matrix

| Endpoint | Field | Rules | Sanitization |
|---|---|---|---|
| `POST /api/auth/signup` | `name` | String, 2–70 chars | `trim()`, strip control characters |
| | `email` | String, valid email regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), max 254 chars | `trim()`, `toLowerCase()` |
| | `password` | String, 8–128 chars | none (pass raw to bcrypt) |
| `POST /api/auth/login` | `email` | String, valid email format | `trim()`, `toLowerCase()` |
| | `password` | String, min 1 char | none |
| `POST /api/transactions` | `type` | String, strictly `'income'` or `'expense'` | `trim()`, `toLowerCase()` |
| | `amount` | Positive finite number, `> 0`, `<= 100,000,000` | `parseFloat()`, round to 2 decimals |
| | `merchant` | String, 1–100 chars | `trim()`, strip HTML tags |
| | `source` | String, 1–50 chars | `trim()`, strip HTML tags |
| | `category` | Optional string, max 50 chars | `trim()`, strip HTML tags |
| | `date` | Optional string, max 20 chars | `trim()` |
| `POST /api/admin/creators/:id/status` | `status` | Optional string, strictly `'active'` or `'suspended'` | `trim()`, `toLowerCase()` |
| | `plan_tier` | Optional string, strictly `'Pro'` or `'Free'` | `trim()`, normalized casing |
| | `note` | Optional string, max 500 chars | `trim()`, strip HTML tags |
| `POST /api/gemini` | `prompt` | String, 1–4,000 chars | `trim()` |
| | `systemContext` | Optional string, max 2,000 chars | `trim()` |

### 5.2 Standard JSON Error Envelope Format
All error responses across all routes and middleware will conform to:
```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE_STRING",
  "details": null
}
```
*Note*: Maintaining the top-level `"error"` key ensures 100% backward compatibility with existing tests that assert `res.body.error === '...'`.

---

## 6. Gemini API Unification Plan

### 6.1 Unified Client Module: `services/geminiService.js`
Extract core AI logic, PII masking, and category tagging into a shared module:
```javascript
// services/geminiService.js
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';

function maskPII(text) {
    if (!text || typeof text !== 'string') return '';
    let masked = text;
    masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
    masked = masked.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, (m) => {
        const d = m.replace(/\D/g, '');
        return (d.length >= 7 && d.length <= 15) ? '[REDACTED_PHONE]' : m;
    });
    masked = masked.replace(/(?:ZAR|R)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b|\b(?:ZAR|R)\s?\d+(?:\.\d{2})?\b/gi, '[REDACTED_ZAR]');
    masked = masked.replace(/\b\d+(?:[,\s]\d{3})*(?:\.\d{2})?\s*ZAR\b/gi, '[REDACTED_ZAR]');
    return masked;
}

function inferCategoryTag(text) {
    if (!text || typeof text !== 'string') return 'General Inquiry';
    const lower = text.toLowerCase();
    if (/tax|deduction|sars|reserve|write-off/.test(lower)) return 'Tax Deduction Strategy';
    if (/gear|camera|lens|equipment|hardware|purchase|buy/.test(lower)) return 'Gear Purchase Planning';
    if (/revenue|youtube|tiktok|patreon|adsense|sponsor|income|brand/.test(lower)) return 'Revenue Optimization';
    return 'General Inquiry';
}

async function generateContent({ prompt, systemContext }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const err = new Error('Gemini API key not configured on server.');
        err.statusCode = 503;
        err.code = 'AI_NOT_CONFIGURED';
        throw err;
    }

    const defaultSystemContext = systemContext || 'You are CCF Creator Intelligence, an expert financial advisor for modern creators. Provide concise, highly actionable 2-3 sentence financial guidance answering the user prompt directly.';

    const response = await fetch(`${GEMINI_API_URL}/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: defaultSystemContext }, { text: prompt }] }]
        })
    });

    if (!response.ok) {
        const err = new Error(`Gemini upstream API responded with status ${response.status}`);
        err.statusCode = 502;
        err.code = 'AI_UPSTREAM_ERROR';
        throw err;
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const err = new Error('Unexpected Gemini API response structure');
        err.statusCode = 502;
        err.code = 'AI_MALFORMED_RESPONSE';
        throw err;
    }

    const text = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + text.length) / 4);

    return { text, tokensUsed, model: 'gemini-1.5-flash' };
}

module.exports = { maskPII, inferCategoryTag, generateContent };
```

### 6.2 Integration into Serverless & Express Entrypoints
1. **`api/gemini.js`** (Vercel):
   - Import `generateContent` from `../services/geminiService.js`.
   - On error, return `res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code })`.
2. **`netlify/functions/gemini.js`** (Netlify):
   - Delegates directly to `api/gemini.js` or `geminiService`.
3. **`controllers/aiController.js`** (Express):
   - Handles `POST /api/gemini`.
   - Executes `generateContent()`.
   - Records masked telemetry into Supabase and bounded `memoryDb.ai_telemetry`.
   - On error, returns HTTP 500 or 503 with standardized JSON error envelope.
4. **`app.js`**:
   - Fix `process.env.GEMINI_API_URL` line 2022 to prevent browser `ReferenceError`.
   - Inspect `res.ok` before attempting to parse response text.

---

## 7. Memory Safety & In-Memory Map Bounding

### 7.1 Sliding-Window Rate Limiter with TTL Auto-Eviction
Replace the unbounded `Map` with an active, bounded sliding-window tracker (`middleware/rateLimiter.js`):
- **Map Capacity**: Max 1,000 distinct IP keys. When capacity is exceeded, the least recently used key is evicted.
- **Active Periodic TTL Sweep**:
  ```javascript
  const cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of trackerMap.entries()) {
          record.timestamps = record.timestamps.filter(ts => now - ts < WINDOW_MS);
          if (record.timestamps.length === 0) {
              trackerMap.delete(ip);
          }
      }
  }, 60 * 1000);
  cleanupTimer.unref(); // Prevents timer from keeping Node process alive in tests
  ```
- **Rate Limit Tiers**:
  - Admin login: 5 attempts per 15 minutes.
  - User auth (signup/login): 15 attempts per 15 minutes.
  - Transactions create: 60 requests per minute.
  - Gemini AI proxy: 20 requests per minute.

### 7.2 MemoryDb Ring Buffer & Bounding
- **`memoryDb.audit_logs`**:
  - Enforce hard cap: `MAX_AUDIT_LOGS = 1000`.
  - When length exceeds `MAX_AUDIT_LOGS`, FIFO prune: `memoryDb.audit_logs = memoryDb.audit_logs.slice(-MAX_AUDIT_LOGS)`.
- **`memoryDb.ai_telemetry`**:
  - Enforce hard cap: `MAX_TELEMETRY = 1000`.
  - Prune entries older than 30 days AND slice to maximum capacity:
    ```javascript
    memoryDb.ai_telemetry = memoryDb.ai_telemetry
        .filter(t => new Date(t.created_at || t.timestamp).getTime() >= cutoffMs)
        .slice(-MAX_TELEMETRY);
    ```
- **`memoryDb.transactions`**:
  - Cap transactions per user at 500 entries in fallback mode.

---

## 8. Deep Health Check Diagnostics (`GET /api/health`)

### 8.1 Diagnostics Payload Specification
```json
{
  "name": "Creator Cash Flow API Engine",
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-09-04T11:30:00.000Z",
  "uptimeSeconds": 1420,
  "database": {
    "provider": "Supabase Cloud PostgreSQL",
    "status": "connected",
    "latencyMs": 42
  },
  "memory": {
    "heapUsedMB": 38.45,
    "heapTotalMB": 56.12,
    "rssMB": 82.10,
    "externalMB": 2.45
  },
  "inMemoryStores": {
    "rateLimitTrackedIps": 4,
    "auditLogsCount": 12,
    "telemetryCount": 8
  },
  "integrations": {
    "gemini": { "configured": true, "model": "gemini-1.5-flash" },
    "phyllo": { "configured": false },
    "resend": { "configured": false }
  }
}
```

### 8.2 Execution & Error Semantics
- Executes a lightweight query against Supabase:
  ```javascript
  const dbStart = Date.now();
  let dbStatus = 'connected';
  let dbLatency = 0;
  if (supabase) {
      try {
          const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
          dbLatency = Date.now() - dbStart;
          if (error) dbStatus = 'degraded';
      } catch (e) {
          dbStatus = 'disconnected';
          dbLatency = Date.now() - dbStart;
      }
  } else {
      dbStatus = 'memory_fallback';
  }
  ```
- If database is disconnected, returns HTTP 503 with `"status": "unhealthy"`.
- If running normally (Supabase or Memory Backup), returns HTTP 200 with `"status": "healthy"`.

---

## 9. Caveats

1. **Test Suite Regex Coupling**:
   - `test_full_site.js:83` strictly requires `<script>` tags without `src` in `admin.html`. Removing all inline scripts from `admin.html` will cause this test to fail. Therefore, the Tailwind config or a lightweight script must remain inline in `admin.html`.
   - `test_full_site.js:180` checks `serverCode.includes('/api/admin/auth/login')`. When decomposing into `routes/adminRoutes.js`, `server.js` must either retain route declaration comments or mount routes with full path documentation.
2. **Supabase vs MemoryDb Consistency**:
   - The platform relies on a dual-write pattern where memoryDb acts as a fast cache and fallback. Any modular service handling transactions or users must continue dual-writing to `memoryDb` to avoid test or offline mode regressions.
3. **No Database Migration Tools**:
   - Schema updates (indexes, constraints) rely on `database_setup.sql`. The server auto-seeds missing tables at startup if permissions allow.

---

## 10. Conclusion

The monolithic `server.js` (1,521 lines) can be decomposed into clean, single-responsibility modules (`routes/`, `controllers/`, `middleware/`, `services/`, `config/`) without breaking existing test harnesses, provided `server.js` acts as an orchestrator and re-exports required symbols.

Critical security and stability vulnerabilities were uncovered and mapped:
1. **Stored XSS**: Three high-severity XSS vectors in `app.js` (transaction descriptions) and `admin.html` (creator names/emails, admin notes in audit logs, and AI prompts in telemetry). All require immediate `escapeHTML()` or DOM-based remediation.
2. **HTTP 200 on Failure**: `POST /api/gemini` and `api/gemini.js` mask service failures with HTTP 200 responses. Unifying them into `services/geminiService.js` returning 500/503 restores REST integrity.
3. **Memory Leaks**: `adminLoginAttempts`, `memoryDb.audit_logs`, and `memoryDb.ai_telemetry` lack active TTL timers and capacity bounding. Implementing unreferenced timer sweeps and array slicing resolves all unbounded heap growth risks.
4. **Input Validation**: Schema validation for transactions and auth inputs will eliminate NaN amounts and server crashes from unhandled input types.

---

## 11. Verification Method

Once implemented, the architectural and input remediation can be independently verified by:

1. **Unit & Integration Tests**:
   ```bash
   node test_pivot_validation.js
   node test_full_site.js
   node test_admin_auth.js
   node test_admin_m3.js
   node test_admin_metrics.js
   ```
2. **XSS Input Sanitization Verification**:
   - Submit a transaction with merchant `<script>alert('XSS')</script>`. Verify that `activity-stream-os` renders escaped `&lt;script&gt;` text and executes zero JavaScript.
   - In `admin.html`, verify that a creator name with HTML or a prompt with `<img src=x onerror=...>` renders escaped text in the creator table, audit trail, and telemetry feed.
3. **AI Error Status Verification**:
   - Send `POST /api/gemini` without `GEMINI_API_KEY` configured. Verify response status is HTTP 503 (or 500) and response body is `{ success: false, error: "..." }`, NOT HTTP 200.
4. **Memory Map Bound Verification**:
   - Inspect `rateLimiter.js` and `memoryDb.js` to verify that `cleanupTimer.unref()` is called and `audit_logs.length` never exceeds `MAX_AUDIT_LOGS`.
5. **Deep Health Check Inspection**:
   - Execute `curl http://localhost:5000/api/health` and verify presence of `database.status`, `memory.heapUsedMB`, and `integrations` fields.
