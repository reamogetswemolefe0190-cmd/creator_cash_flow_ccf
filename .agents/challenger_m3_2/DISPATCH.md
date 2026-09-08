# Dispatch Instructions for Challenger 2 (Milestone M3)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_2`

## Role & Archetype
- Archetype: `teamwork_preview_challenger`
- Role: Modular Route & Deep Health Diagnostics Challenger 2

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All stress tests, fuzzing, and verifications must be authentic.

## Empirical Challenge Objectives
1. **Deep Health Diagnostics Probing**:
   - Query `GET /api/health` and verify the response structure contains:
     - `status`: `'healthy'` or `'degraded'`
     - `database`: provider, status, latency in ms
     - `memory`: `heapUsedMB`, `heapTotalMB`, `rssMB` (must be non-zero positive numbers)
     - `uptimeSeconds`: positive number
     - `integrations`: object with boolean configuration flags
   - Verify proper HTTP status codes (200 for healthy/degraded, 503 if critical fail).
2. **Modular Route Concurrency Stress Testing**:
   - Send concurrent requests across modular routes:
     - Creator auth (`POST /api/auth/register`, `POST /api/auth/login`)
     - Creator transactions (`GET /api/transactions`, `POST /api/transactions`)
     - Admin endpoints (`POST /api/admin/auth/login`, `GET /api/admin/metrics`, `GET /api/admin/audit-logs`)
     - Gemini proxy (`POST /api/gemini`)
   - Verify zero router crashes, memory leaks, or unhandled promise rejections.
3. **Frontend Script Extraction Verification**:
   - Verify `admin.html` includes `<script src="admin.js"></script>` and that the inline Tailwind config and tab switcher remain present (`test_full_site.js:83`).
   - Verify `index.html` references `app.js` and `startOnboarding()` executes without undefined errors.
4. **Execute Test Suites**:
   - Run `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node test_admin_metrics.js`, `node tests/e2e_remediation_test.js`, `node tests/m2_verification_test.js`, `node tests/challenger_m2_adversarial.js`, `node tests/adversarial_m2_challenger2.js`.

## Output Requirements
Write your challenge report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_2\handoff.md`
Must state explicit verdict: **APPROVE** or **FAIL**.

## 2026-09-04T15:54:02Z
You are Challenger 2 for Milestone M3 (Modular Architecture Refactoring & Memory Safety).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request), `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_2\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All empirical stress tests, fuzzing, and verifications must be authentic.

Empirically stress-test Milestone M3:
1. Deep health diagnostics: probe `GET /api/health` and verify all fields (`status`, `database.status`, `database.latency`, `memory.heapUsedMB`, `memory.rssMB`, `uptimeSeconds`, `integrations`).
2. Concurrent modular routing: stress test concurrent requests across modular auth, transaction, admin, and AI endpoints.
3. Frontend script extraction: verify `admin.html` -> `admin.js` (and inline Tailwind retention for `test_full_site.js:83`), and `index.html` -> `app.js` (`startOnboarding`).
4. Run all test suites:
   - `node test_full_site.js`
   - `node test_admin_auth.js`
   - `node test_admin_ui.js`
   - `node test_admin_m3.js`
   - `node test_admin_metrics.js`
   - `node tests/e2e_remediation_test.js`
   - `node tests/m2_verification_test.js`
   - `node tests/challenger_m2_adversarial.js`
   - `node tests/adversarial_m2_challenger2.js`

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_2\handoff.md` with explicit verdict APPROVE or FAIL. Send a completion message when finished. Maintain progress.md with timestamps.
