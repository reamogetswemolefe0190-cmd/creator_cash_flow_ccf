# Security & PII Audit Report: Requirement R1 Remediation Mapping

**Investigator**: Security & PII Investigator (`teamwork_preview_explorer`)  
**Target Milestone**: Requirement R1 (Security Hardening, PII Sanitization, CORS Whitelisting, Rate Limiting, Multer Audit)  
**Date**: 2026-09-04  
**Working Directory**: `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security`

---

## 1. Observation

### 1.1 Personal Developer PII (`reamogetswemolefe0190@gmail.com` and Developer Identity)
The personal developer email and name are hardcoded in multiple production source files, HTML templates, scripts, and test assertions:

1. **`server.js` (lines 96, 104, 110–116, 134–149)**:
   - Line 96: `const MASTER_ADMIN_EMAIL = 'reamogetswemolefe0190@gmail.com';`
   - Line 104: `const DEFAULT_ADMIN_EMAIL = MASTER_ADMIN_EMAIL;`
   - Lines 110–116: Auto-seeds master admin with `{ id: 'admin_master_1', email: MASTER_ADMIN_EMAIL, ... }` into `memoryDb.adminUsers`.
   - Lines 134–149: `seedAdminAccountInSupabase()` seeds `admin_master_1` with `MASTER_ADMIN_EMAIL` into Supabase cloud table `admin_users`.

2. **`admin.html` (lines 165, 167, 234, 722, 808, 816, 840)**:
   - Line 165: `<input type="email" id="admin-email" required value="reamogetswemolefe0190@gmail.com" ...>`
   - Line 167: `placeholder="reamogetswemolefe0190@gmail.com">`
   - Line 234: `<span id="admin-email-display" class="block font-semibold text-white">reamogetswemolefe0190@gmail.com</span>`
   - Line 722: `document.getElementById('admin-email').value = 'reamogetswemolefe0190@gmail.com';`
   - Line 808: `if (emailInput) emailInput.value = 'reamogetswemolefe0190@gmail.com';`
   - Line 816: `state.adminUser = { id: 'admin_master_1', email: 'reamogetswemolefe0190@gmail.com', role: 'admin' };` (executed in `checkSession()`, providing an unauthenticated auto-login bypass).
   - Line 840: `const isMasterAdmin = (email.toLowerCase() === 'reamogetswemolefe0190@gmail.com' || email.toLowerCase() === 'admin@creatorcashflow.com') && ...`

3. **`app.js` (lines 1010, 1024, 1055)**:
   - Line 1010: `placeholder="e.g. Reamogetswe Molefe"`
   - Line 1024: `placeholder="reamogetswe@creator.co.za"`
   - Line 1055: `const name = document.getElementById('reg-name').value.trim() || 'Reamogetswe';`

4. **`index.html` (lines 26, 32, 143)**:
   - Lines 26, 32: `"https://github.com/reamogetswemolefe0190-cmd/creator-cash-flow"`
   - Line 143: `<span class="text-xs font-bold text-white">Reamogetswe</span>`

5. **`stress_harness.js` (line 280)**:
   - Line 280: `{ id: 'admin_master_1', email: 'reamogetswemolefe0190@gmail.com', role: 'admin' }`

6. **`test_full_site.js` (line 179)** — **CRITICAL REGRESSION RISK**:
   - Line 178–179:
     ```javascript
     it('server.js contains master admin credential verification', () => {
         assert(serverCode.includes('reamogetswemolefe0190@gmail.com'), 'Missing master admin email');
     ```
   - *Impact*: Any naive removal of the email from `server.js` causes `test_full_site.js` to fail.

7. **Git Configuration & History**:
   - Local remote: `remote.origin.url=https://github.com/reamogetswemolefe0190-cmd/creator-cash-flow.git`
   - Commit history author: `Reamogetswe Molefe <reamogetswemolefe0190@gmail.com>` across git commits.

---

### 1.2 Hardcoded Passwords & Fallback Secrets
Production files contain plaintext passwords and hardcoded cryptographic secrets:

1. **`server.js` Cryptographic Secrets & Fallbacks**:
   - Line 52: `const JWT_SECRET = process.env.JWT_SECRET || 'fallback-creator-cashflow-secret-key-2026';`
   - Line 53: `const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32 bytes`
   - Line 56: `const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iekofqagtcztyavhunai.supabase.co';`

2. **`server.js` Plaintext Passwords & Seed Hashes**:
   - Line 97: `const MASTER_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'R3@m0g3tsw3M0l3f3';`
   - Line 101: `const FALLBACK_ADMIN_PASS = 'AdminPass2026!';`
   - Lines 198, 227: `const creatorPassHash = bcrypt.hashSync('CreatorPass2026!', BCRYPT_ROUNDS);`
   - Lines 22, 35: In stress/test mock bcrypt:
     ```javascript
     if (password === 'Password123!' || password === 'AdminPass2026!' || password === 'CreatorPass2026!') {
         return true;
     }
     ```
     This allows authentication bypass for any account using those hardcoded strings when `NODE_ENV === 'test'` or `STRESS_TEST === 'true'`.

3. **`admin.html` Hardcoded Plaintext Passwords & Client-Side Token Generation**:
   - Line 175: `<input type="password" id="admin-password" required value="R3@m0g3tsw3M0l3f3" ...>`
   - Line 723: `document.getElementById('admin-password').value = 'R3@m0g3tsw3M0l3f3';`
   - Line 809: `if (passInput) passInput.value = 'R3@m0g3tsw3M0l3f3';`
   - Line 841: `(password === 'R3@m0g3tsw3M0l3f3' || password === 'AdminPass2026!')`
   - Lines 815, 874: Generates unsigned pseudo-token on client side: `'adm_token_' + Date.now() + '_master'`.

4. **`stress_harness.js` Secret Discrepancy & Hardcoded Passwords**:
   - Line 270: `password: 'AdminPass2026!'`
   - Line 278: `const jwtSecret = process.env.JWT_SECRET || 'creator_cash_flow_secret_key_2026';` *(Notice: differs from `server.js:52`'s `'fallback-creator-cashflow-secret-key-2026'`!)*
   - Line 300: `const password = 'Password123!';`

5. **`test_admin_auth.js` & `test_admin_ui.js`**:
   - `test_admin_auth.js` lines 100, 128, 211: `password: 'AdminPass2026!'`
   - `test_admin_ui.js` line 161: `password: 'AdminPass2026!'`

6. **`app.js` Insecure API Key Storage & Browser Execution Error**:
   - Line 2021: `const savedKey = localStorage.getItem('ccf_gemini_api_key');`
   - Line 2022: `const geminiApiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';`  
     *(In browsers, `process.env` is undefined and causes `ReferenceError: process is not defined` if executed directly)*.
   - Line 2025: `fetch(`${geminiApiUrl}/models/gemini-1.5-flash:generateContent?key=${savedKey}`, ...)` leaks user Gemini API keys in plaintext browser fetch calls.

---

### 1.3 `.gitignore` and `.env*` Tracking Status
Inspection of `.gitignore` and git tracking status revealed:

1. **`.gitignore` Contents (`.gitignore` lines 1–14)**:
   ```gitignore
   # Operating System Files
   .DS_Store
   Thumbs.db
   desktop.ini

   # IDE & Editor Files
   .vscode/
   .idea/
   *.swp

   # Temporary / Log files
   *.log
   node_modules/
   ```
   - **Finding**: There is **zero exclusion** for `.env*`, `.env`, `.env.local`, `.env.*`.
2. **`git check-ignore` verification**:
   - Command: `git check-ignore -v .env`
   - Result: Exited with code `1` (not ignored).
   - If a developer copies `.env.example` to `.env` to configure secrets, git immediately flags `.env` as an untracked file to be committed.
3. **Current File Tracking**:
   - `.env.example` is tracked (commit `29bbe9ad62f9b8e34d660b204ac97e39804b5c54`).
   - No active `.env` file exists on disk currently.

---

### 1.4 CORS Configuration Analysis
Analysis across server and serverless proxy handlers revealed permissive wildcard headers conflicting with HTTP/Fetch standards:

1. **`server.js` (line 314)**:
   ```javascript
   app.use(cors({ origin: '*', credentials: true }));
   ```
   - **Finding**: W3C / WHATWG Fetch specification strictly forbids combining `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`. Browsers automatically reject credentialed responses with this configuration.
   - **Requirement**: Must replace with an explicit whitelist:
     `['https://creatorcashflow.co.za', 'https://www.creatorcashflow.co.za', 'http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:3000']`

2. **`api/gemini.js` (lines 8–10)**:
   ```javascript
   res.setHeader('Access-Control-Allow-Credentials', true);
   res.setHeader('Access-Control-Allow-Origin', '*');
   ```
   - Serverless proxy endpoint has the same invalid wildcard + credentials combination.

3. **`netlify/functions/gemini.js` (line 33)**:
   ```javascript
   headers: {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*'
   }
   ```
   - Uses wildcard origin `*`.

---

### 1.5 Rate Limiting Across All Routes & Comprehensive Gaps
Inspection of `server.js` and serverless routes identified that only a single endpoint implements rate limiting:

1. **Existing Rate Limiter (`server.js` lines 247–286, 588)**:
   - `rateLimitAdminLogin`: In-memory sliding-window (5 attempts per 15 minutes, IP-based, capped at 200 tracked IPs).
   - Applied **only** to `POST /api/admin/auth/login`.

2. **Complete Inventory of Rate Limiting Gaps Across All Other Routes**:
   | Route | Method | Current Middleware | Rate Limiting Present? | Vulnerability / Threat Vector |
   |---|---|---|---|---|
   | `/api/auth/signup` | POST | None | ❌ **NONE** | Unrestricted user registration flood, DB storage exhaustion, spam accounts |
   | `/api/auth/login` | POST | None | ❌ **NONE** | Brute-force credential stuffing against user creator accounts |
   | `/api/transactions` | POST | `authenticateToken` | ❌ **NONE** | High-frequency transaction insertion flood; memoryDb / Supabase bloating |
   | `/api/transactions` | GET | `authenticateToken` | ❌ **NONE** | Repeated database scraping and read exhaustion |
   | `/api/admin/creators/:id/status` | POST | `requireAdmin` | ❌ **NONE** | Rapid status mutation hammering and audit log flood |
   | `/api/admin/metrics` | GET | `requireAdmin` | ❌ **NONE** | CPU-intensive metric recalculation abuse |
   | `/api/admin/creators` | GET | `requireAdmin` | ❌ **NONE** | Unthrottled creator registry dumping |
   | `/api/admin/audit-logs` | GET | `requireAdmin` | ❌ **NONE** | Audit ledger dumping |
   | `/api/admin/telemetry` | GET | `requireAdmin` | ❌ **NONE** | Unthrottled query history retrieval |
   | `/api/admin/verify-auth` | GET | `requireAdmin` | ❌ **NONE** | Session verification polling spam |
   | `/api/integrations/phyllo/token`| POST | None | ❌ **NONE** | Downstream third-party API rate-limit exhaustion and staging cost abuse |
   | `/api/gemini` | POST | None | ❌ **NONE** | Gemini 1.5 Flash API token exhaustion, quota burn, denial of service |
   | `api/gemini.js` (Serverless) | POST | None | ❌ **NONE** | Unprotected public serverless function vulnerable to bot abuse |
   | `netlify/functions/gemini.js` | POST | None | ❌ **NONE** | Unprotected serverless redirect |

3. **Memory Management / Eviction Defect in `adminLoginAttempts` (`server.js` lines 278–283)**:
   - Eviction occurs only when `adminLoginAttempts.size > 200`, popping just one key (`adminLoginAttempts.keys().next().value`). No scheduled background cleanup or TTL-based garbage collection exists for expired IP records.

---

### 1.6 Multer / File Upload Middleware Audit
1. **Dependency in `package.json` (line 18)**:
   - `"multer": "^1.4.5-lts.1"` is listed under `dependencies`.
2. **Codebase Grep (`require('multer')`)**:
   - Result: **0 occurrences** across all JavaScript and configuration files (`server.js`, `app.js`, `api/gemini.js`, `netlify/functions/gemini.js`).
   - Multer is an orphaned, unused dependency adding ~20 transitively installed npm packages to the bundle.
3. **Frontend Upload Mock (`app.js` lines 1736–1805, `index.html` line 1335)**:
   - "Upload Financial Record" modal renders static UI claiming `"PDF, PNG, CSV up to 10MB"`.
   - Has **no `<input type="file">`** element.
   - Submitting the form (`submitRecordEntry()`) only reads text fields (`#rec-title`, `#rec-amount`, `#rec-category`) and prepends a mock `<div>` to `#records-document-list`.
   - No `multipart/form-data` is sent to the backend, and no backend route accepts uploads.
4. **Security Defect**:
   - If file upload functionality is retained, there is currently **no MIME type validation**, **no 5MB file cap** (the UI advertises 10MB), and **no virus/extension sanitization**.

---

## 2. Logic Chain

1. **From Observations 1.1 & 1.2**:
   - Because `server.js` (lines 52–53, 96–101) defines fallback strings (`'fallback-creator-cashflow-secret-key-2026'`, `'12345678901234567890123456789012'`, `'R3@m0g3tsw3M0l3f3'`, `'AdminPass2026!'`), if environment variables are omitted or misconfigured, the application silently defaults to publicly known keys.
   - Because `admin.html` (lines 165–175, 805–819, 840–841) embeds both the developer email and master password in plaintext input values and client-side JavaScript, any user viewing page source or inspecting DOM attributes can retrieve credentials and impersonate the administrator.
   - Because `admin.html:814-819` generates a synthetic master admin token if `state.token` is missing, unauthenticated visitors automatically gain access to the executive interface if the API is offline.
   - Because `test_full_site.js:179` explicitly requires `'reamogetswemolefe0190@gmail.com'` in `server.js`, refactoring `server.js` without simultaneously updating `test_full_site.js` will break CI and test suites.

2. **From Observation 1.3**:
   - Because `.gitignore` does not include `.env*`, any `.env` file generated during local development or staging is treated as untracked source code by git, creating an immediate risk of accidental commit to GitHub.

3. **From Observation 1.4**:
   - Because `cors({ origin: '*', credentials: true })` violates modern web specifications, browsers operating under CORS will drop or reject authenticated cross-origin requests. Concurrently, permitting wildcard access on API endpoints allows arbitrary malicious third-party origins to trigger unauthenticated endpoints.

4. **From Observation 1.5**:
   - Because only `POST /api/admin/auth/login` possesses a rate limiter, all customer-facing authentication routes (`/api/auth/signup`, `/api/auth/login`), data creation routes (`/api/transactions`), administrative mutation routes (`/api/admin/creators/:id/status`), and external LLM proxy routes (`/api/gemini`) are completely vulnerable to automated request flooding, password brute-forcing, and resource exhaustion.

5. **From Observation 1.6**:
   - Because `multer` is declared in `package.json` but never imported or invoked anywhere in the codebase, it represents dead code and unneeded dependency weight. If file uploads are needed, Multer must be configured with a 5MB maximum file size and strict MIME type checking (`application/pdf`, `image/png`, `image/jpeg`, `text/csv`). Otherwise, it should be cleanly pruned from `package.json`.

---

## 3. Caveats

1. **Git Historical Commits**: The developer's name and personal email exist in past git commit author metadata and the origin remote URL (`reamogetswemolefe0190-cmd`). Removing these from past commits would require destructive history rewrites (`git filter-repo` / force push), which may conflict with active remote branches. This report focuses on production code, configuration files, and test files within the working tree.
2. **Supabase Database Row-Level Security (RLS)**: While exploring `database_setup.sql`, policies were observed with `USING (true) WITH CHECK (true)` ("Allow public read/write during beta"). Although out of the strict R1 scope, this represents an open security gap on the database layer that should be hardened alongside backend credentials.
3. **Frontend Mock vs Backend Integration for File Uploads**: Since the frontend records feature is purely client-side DOM manipulation and no backend file upload endpoint currently exists, the engineering team must decide whether to prune `multer` or build out the full multipart upload route.

---

## 4. Conclusion & Actionable Recommendations

To satisfy **Requirement R1 (Critical Security Hardening & PII Sanitization)** and pass all acceptance criteria:

1. **PII & Secrets Migration**:
   - Remove `MASTER_ADMIN_EMAIL` and `MASTER_ADMIN_PASS` constants from `server.js`. Read strictly from `process.env.ADMIN_EMAIL` (defaulting in production to a generic address like `admin@creatorcashflow.co.za` if configured in `.env`) and `process.env.ADMIN_PASSWORD`.
   - Remove fallback strings `'fallback-creator-cashflow-secret-key-2026'` and `'12345678901234567890123456789012'`. Throw an explicit initialization error on server startup if `JWT_SECRET` or `ENCRYPTION_KEY` is missing in production.
   - Remove pre-filled `value="reamogetswemolefe0190@gmail.com"` and `value="R3@m0g3tsw3M0l3f3"` from `admin.html:165,175`.
   - Remove the client-side credential check `isMasterAdmin` and auto-login bypass (`checkSession()` synthesizing tokens) from `admin.html`.
   - Update `app.js:1010,1024,1055` to replace developer name placeholders with generic creator examples (e.g. `Thabo Ndlovu`, `creator@creatorcashflow.co.za`).
   - Update `test_full_site.js:179` to assert that admin authentication is enforced via environment configuration rather than hardcoding the developer's personal email.

2. **`.gitignore` Hardening**:
   - Add `.env`, `.env*`, and `.env.local` to `.gitignore`. Verify with `git check-ignore -v .env`.

3. **CORS Whitelist Implementation**:
   - Replace `app.use(cors({ origin: '*', credentials: true }))` in `server.js` with:
     ```javascript
     const ALLOWED_ORIGINS = [
         'https://creatorcashflow.co.za',
         'https://www.creatorcashflow.co.za',
         'http://localhost:5000',
         'http://127.0.0.1:5000',
         'http://localhost:3000'
     ];
     app.use(cors({
         origin: (origin, callback) => {
             if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                 callback(null, true);
             } else {
                 callback(new Error('Blocked by CORS policy'));
             }
         },
         credentials: true
     }));
     ```
   - Update `api/gemini.js` and `netlify/functions/gemini.js` to enforce origin matching against `ALLOWED_ORIGINS` rather than `*`.

4. **Comprehensive Rate Limiting**:
   - Implement reusable, bounded sliding-window rate limiters:
     - **Auth Limiter** (`/api/auth/login`, `/api/auth/signup`): 10 requests per 15 minutes per IP.
     - **Transaction Limiter** (`POST /api/transactions`): 60 requests per minute per IP/User.
     - **Admin Mutation Limiter** (`POST /api/admin/creators/:id/status`): 30 requests per minute per admin.
     - **AI Gemini Proxy Limiter** (`POST /api/gemini`, `api/gemini.js`): 15 requests per minute per IP.
   - Add periodic TTL pruning to prevent in-memory Map leaks.

5. **Multer / Upload Remediation**:
   - If file archiving remains mock/client-side, run `npm uninstall multer` and remove line 18 from `package.json`.
   - If real file uploads are required, configure Multer with:
     ```javascript
     const upload = multer({
         limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
         fileFilter: (req, file, cb) => {
             const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv'];
             if (allowed.includes(file.mimetype)) cb(null, true);
             else cb(new Error('Invalid file format. Allowed: PDF, PNG, JPEG, CSV.'));
         }
     });
     ```

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Developer Email & Secrets Presence**:
   ```powershell
   git grep -n "reamogetswemolefe0190@gmail.com"
   git grep -n "R3@m0g3tsw3M0l3f3"
   git grep -n "fallback-creator-cashflow"
   ```
   *Expected Output*: Matches in `server.js`, `admin.html`, `stress_harness.js`, and `test_full_site.js`.

2. **Verify `.gitignore` Rule Defect**:
   ```powershell
   git check-ignore -v .env
   echo "Exit Code: $LASTEXITCODE"
   ```
   *Expected Output*: Empty output and Exit Code `1` (demonstrating `.env` is currently NOT ignored).

3. **Verify Permissive CORS**:
   Inspect `server.js:314`, `api/gemini.js:8-9`, and `netlify/functions/gemini.js:33`. Confirm presence of `origin: '*'` and `credentials: true`.

4. **Verify Rate Limiting Gaps**:
   Inspect `server.js` route registrations (lines 319–1415). Observe that `rateLimitAdminLogin` is attached exclusively to line 588 (`POST /api/admin/auth/login`).

5. **Verify Multer Dead Dependency**:
   ```powershell
   git grep "require('multer')"
   ```
   *Expected Output*: 0 matches across the repository despite declaration in `package.json`.

6. **Verify Test Regression Risk**:
   ```powershell
   node test_full_site.js
   ```
   *Expected Output*: Passes today because line 179 asserts the presence of the developer email. Invalidation condition: removing email from `server.js` without updating `test_full_site.js` causes test failure.
