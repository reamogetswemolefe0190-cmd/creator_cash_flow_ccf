# Dispatch Instructions for Worker: Milestone M1 Remediation (Iteration 2)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1_remediation`

## Role & Archetype
- Archetype: teamwork_preview_worker
- Role: Security Hardening Remediation Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1\handoff.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2\handoff.md`.
4. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\GATE_STATUS.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Tasks
1. **Fix Rate Limiter IP Extraction & Reverse Proxy Support in `server.js`**:
   - Enable proxy support: `app.set('trust proxy', 1);`.
   - In `createSlidingWindowLimiter` (line 313) and `rateLimitAdminLogin` (line 269):
     Prioritize `X-Forwarded-For` header:
     ```javascript
     const forwarded = req.headers['x-forwarded-for'];
     const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.ip || req.socket?.remoteAddress || '127.0.0.1';
     return clientIp;
     ```
   - Verify that requests with distinct `X-Forwarded-For` headers are isolated into separate rate-limiting buckets and do not collapse onto `127.0.0.1`.
2. **Normalize CORS Error Handling**:
   - In `server.js`, handle CORS errors gracefully: ensure unlisted origins receive a clean HTTP 403 response (`{ "error": "Blocked by CORS policy" }`) without logging unhandled 500 error stack traces.
3. **Verify Concurrency & Stress Tests**:
   - Run `node tests/challenger_m1_security_test.js` (from Challenger 1).
   - Run `node stress_harness.js --duration=3 --concurrency=10` and verify zero false-positive 429 lockouts across distinct VUs.
   - Run standard regression suite:
     - `node test_full_site.js`
     - `node test_admin_auth.js`
     - `node test_admin_ui.js`
     - `node test_m1_verification.js`
     - `node tests/e2e_remediation_test.js`

## Output Requirements
Write `handoff.md` in your working directory documenting the changes made, test outputs, and verification results.
Send a message when complete.

## 2026-09-04T10:03:45Z
You are the Security Hardening Remediation Specialist for Milestone M1 (Iteration 2).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1_remediation`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1_remediation\DISPATCH.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Remediate the two defects found by the Challengers:
1. In server.js, enable `app.set('trust proxy', 1)` and fix `keyGenerator` in rate limiters to prioritize `req.headers['x-forwarded-for']` before `req.ip` so clients behind reverse proxies and multi-VU stress harnesses are isolated by their unique IP.
2. In server.js, handle CORS rejection gracefully returning a clean HTTP 403 JSON envelope without throwing 500 error stack traces.
3. Verify that `node tests/challenger_m1_security_test.js` passes, `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_m1_verification.js`, and `node tests/e2e_remediation_test.js` all pass 100%.

Write your handoff report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1_remediation\handoff.md` and send a message when finished. Maintain progress.md with timestamps.
