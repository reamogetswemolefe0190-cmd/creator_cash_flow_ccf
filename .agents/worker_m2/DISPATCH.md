# Dispatch Instructions for Worker: Milestone M2 (Input Sanitization, XSS Elimination & Error Normalization)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2`

## Role & Archetype
- Archetype: teamwork_preview_worker
- Role: Input Sanitization & Frontend Security Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch\handoff.md` (detailed line numbers for XSS, input schemas, error envelopes, and Gemini unification).
4. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\TEST_READY.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Milestone M2 Tasks
1. **Schema Input Validation (`middleware/validation.js` & `server.js`)**:
   - Implement schema validation middleware for:
     - `POST /api/auth/signup`: validate `name` (string, 2–70 chars), `email` (valid regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), `password` (string, 8–128 chars). Return HTTP 400 on invalid input.
     - `POST /api/auth/login`: validate `email` and `password` presence, guard `email.toLowerCase()` against non-string inputs (return HTTP 400 instead of 500).
     - `POST /api/transactions`: validate `type` (strictly `'income'` or `'expense'`), `amount` (finite number `> 0`, `<= 100,000,000`), `merchant` (non-empty string, max 100 chars, HTML stripped/escaped), `source` (max 50 chars), `category` (max 50 chars). Reject NaN/negative amounts with HTTP 400.
     - `POST /api/admin/creators/:id/status`: validate `status` (strictly `'active'` or `'suspended'`), `plan_tier` ('Pro'|'Free'), and sanitize `note` (max 500 chars).
2. **Frontend Stored XSS Elimination (`app.js`, `admin.html`)**:
   - In `app.js`:
     - Add `escapeHTML(str)` utility.
     - Lines 838, 861, 877 (`activityStream`, `revStream`, `expStream`): sanitize `${escapeHTML(a.desc || '')}` to eliminate stored XSS in transaction listings.
     - Line 2114 (`openGeminiKeyModal`): bind input value via DOM property `.value = currentKey` instead of raw template string interpolation.
   - In `admin.html`:
     - Add `escapeHTML(str)` utility.
     - Lines 1163–1199: sanitize creator name, email, and attributes in `tbody.innerHTML`.
     - Lines 1352–1356: sanitize `log.old_value`, `log.new_value`, and `log.admin_id` in audit trail.
     - Line 1397: sanitize `t.prompt_masked` in telemetry feed.
3. **API Error Normalization**:
   - Standardize JSON error responses to `{ "success": false, "error": "...", "code": "..." }`. Maintain top-level `error` key for backward compatibility with existing tests.
   - Correct Gemini AI endpoint (`POST /api/gemini` and `api/gemini.js`) to return HTTP 500 or 503 on failures (e.g. missing API key, upstream error) rather than HTTP 200.
   - Add 404 handler returning JSON `{ "error": "Not Found", "code": "ROUTE_NOT_FOUND" }`.
4. **Unified Gemini Service Module (`services/geminiService.js`)**:
   - Create `services/geminiService.js` encapsulating `maskPII`, `inferCategoryTag`, and `generateContent`.
   - Update `server.js`, `api/gemini.js`, and `netlify/functions/gemini.js` to use `services/geminiService.js`.
   - Ensure `server.js` re-exports `maskPII` and `inferCategoryTag` for test compatibility (`test_admin_m3.js`).
5. **Verification**:
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Run `node test_admin_ui.js`
   - Run `node test_admin_m3.js`
   - Run `node tests/e2e_remediation_test.js`
   - Verify transaction with `<script>alert(1)</script>` is safely escaped in DOM.
   - Verify AI endpoint without key returns HTTP 503/500, not 200.

## Output Requirements

## 2026-09-04T10:17:23Z
<USER_REQUEST>
You are Worker M2: Input Sanitization, XSS Elimination & Error Normalization Specialist.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\DISPATCH.md` first.
Also read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute Milestone M2 tasks:
1. Enforce schema validation and sanitization for transaction inputs (positive amount, valid type, sanitized merchant/source), user signup/login, and admin status updates (middleware/validation.js & server.js).
2. Audit and fix frontend files (app.js, admin.html) to eliminate all unsafe innerHTML XSS vectors using escapeHTML and DOM sanitization.
3. Normalize API error handling across all endpoints to return consistent JSON error envelopes with proper HTTP status codes. Correct the AI Gemini endpoint to return HTTP 500/503 on failures rather than HTTP 200.
4. Consolidate duplicate Gemini API implementations (api/gemini.js, Netlify functions, server.js) into a unified shared client module `services/geminiService.js`.
5. Run test suites: node test_full_site.js, node test_admin_auth.js, node test_admin_ui.js, node test_admin_m3.js, and node tests/e2e_remediation_test.js.

Write your handoff report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md` and send a message when complete. Maintain progress.md with timestamps.
</USER_REQUEST>

