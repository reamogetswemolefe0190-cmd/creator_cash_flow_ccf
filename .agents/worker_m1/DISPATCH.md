# Dispatch Instructions for Worker: Milestone M1 (Security Hardening & PII Sanitization)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1`

## Role & Archetype
- Archetype: teamwork_preview_worker
- Role: Security Hardening Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative request, latest follow-up).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security\handoff.md` (detailed line-by-line evidence).
4. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Implementation Tasks
1. **PII & Secrets Migration**:
   - `server.js`:
     - Remove `MASTER_ADMIN_EMAIL = 'reamogetswemolefe0190@gmail.com'`. Read strictly from `process.env.ADMIN_EMAIL || 'admin@creatorcashflow.co.za'`.
     - Remove hardcoded passwords (`'R3@m0g3tsw3M0l3f3'`, `'AdminPass2026!'`, `'CreatorPass2026!'`, `'Password123!'`). Read from `process.env.ADMIN_PASSWORD`.
     - Remove fallback secrets `'fallback-creator-cashflow-secret-key-2026'` and `'12345678901234567890123456789012'`. Ensure `process.env.JWT_SECRET` and `process.env.ENCRYPTION_KEY` are used. For local test compatibility, support standard env defaults or test fallback only in non-production.
   - `admin.html`:
     - Remove hardcoded `value="reamogetswemolefe0190@gmail.com"` and `value="R3@m0g3tsw3M0l3f3"` on login inputs. Set clean empty/placeholder values.
     - Remove unauthenticated bypass in `checkSession()` that synthesizes master admin token.
     - Remove client-side hardcoded credential checks.
   - `app.js`:
     - Replace personal developer name/email placeholders (`Reamogetswe Molefe`, `reamogetswe@creator.co.za`) with generic examples (`Thabo Ndlovu`, `creator@creatorcashflow.co.za`).
     - Fix `process.env.GEMINI_API_URL` reference error in browser.
   - `index.html`:
     - Remove developer personal name where appropriate.
   - `stress_harness.js`:
     - Replace `reamogetswemolefe0190@gmail.com` with `process.env.ADMIN_EMAIL || 'admin@creatorcashflow.co.za'`.
   - `test_full_site.js:179`:
     - Update assertion from `assert(serverCode.includes('reamogetswemolefe0190@gmail.com'))` to `assert(serverCode.includes('ADMIN_EMAIL') || serverCode.includes('/api/admin/auth/login'))`.
2. **.gitignore Hardening**:
   - Add `.env`, `.env*`, `.env.local` to `.gitignore`.
   - Verify with `git check-ignore -v .env`.
3. **CORS Whitelist**:
   - In `server.js`, replace `origin: '*', credentials: true` with an explicit whitelist:
     `['https://creatorcashflow.co.za', 'https://www.creatorcashflow.co.za', 'http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:3000']`.
   - Update `api/gemini.js` and `netlify/functions/gemini.js` to enforce origin matching against whitelist.
4. **Comprehensive Rate Limiting**:
   - Implement rate limiters across `/api/auth/signup`, `/api/auth/login`, `/api/transactions`, `/api/admin/creators/:id/status`, and `/api/gemini`.
   - Ensure sliding window has active TTL cleanup (unref'd timer) so maps do not leak memory.
5. **Multer Pruning**:
   - Remove unused `multer` dependency from `package.json` if dead, or configure 5MB cap & MIME validation.
6. **Verification**:
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Verify `git check-ignore -v .env` exits with 0.
   - Perform automated scan: zero matches for `reamogetswemolefe0190@gmail.com` in codebase.

## Output Requirements
Write `handoff.md` in your working directory documenting:
- Observation (all files modified and lines changed)
- Logic Chain (rationale)
- Caveats (any edge cases)
- Conclusion (status)
- Verification Method (exact commands run and outputs)
Send a message when complete.

## 2026-09-04T09:35:06Z
Execute Milestone M1 tasks:
1. Remove all hardcoded personal developer PII (reamogetswemolefe0190@gmail.com) and fallback secrets from server.js, admin.html, app.js, index.html, stress_harness.js. Migrate to .env and environment variables. Update test_full_site.js:179 to assert admin auth via env without hardcoded personal email.
2. Add .env, .env*, .env.local to .gitignore and verify git check-ignore -v .env exits 0.
3. Configure explicit CORS whitelist in server.js, api/gemini.js, netlify/functions/gemini.js.
4. Implement bounded sliding-window rate limiters with active TTL cleanup across /api/auth/*, /api/transactions, /api/admin/creators/:id/status, and /api/gemini.
5. Prune dead multer dependency from package.json or configure 5MB cap and MIME filtering.
6. Verify changes: run node test_full_site.js, node test_admin_auth.js, and verify 0 occurrences of reamogetswemolefe0190@gmail.com in production source files.

## 2026-09-04T09:45:17Z
From Parent (ec5f2cec-590e-47ae-b452-b23f83e7857a):
Checking in on your implementation progress for Milestone M1.
Update progress.md with your current active step and reply with your status.

