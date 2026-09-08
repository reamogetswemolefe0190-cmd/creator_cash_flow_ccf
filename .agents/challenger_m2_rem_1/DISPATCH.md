# Dispatch Instructions for Challenger 1: Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: M2 Input Validation & XSS Challenger 1

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All stress tests, fuzzing, and verifications must be authentic. Do not fabricate results.

## Adversarial Stress Testing Protocol
Empirically stress-test Milestone M2 input validation and XSS elimination:
1. **Transaction & Auth Input Fuzzing**:
   - Fuzz `POST /api/transactions` with negative amounts, `0`, `NaN`, non-numeric strings, infinite numbers, out-of-range (>100,000,000) amounts, and invalid types (`transfer`, `invest`). Verify strict HTTP 400 rejection.
   - Fuzz `POST /api/auth/login` and `signup` with non-string types (objects, arrays, booleans, null) to ensure no unhandled 500 runtime exceptions (e.g. `email.toLowerCase is not a function`). Verify strict HTTP 400 rejection.
2. **DOM Stored XSS Probing**:
   - Test XSS attack vectors in `merchant`, `source`, `category`, and notes: e.g. `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>`, `"><script>alert(1)</script>`.
   - Verify that data returned by endpoints and rendered in `app.js` and `admin.html` is escaped via `escapeHTML()` and cannot execute in the DOM.
3. **Gemini Error Normalization**:
   - Probe `POST /api/gemini` with unconfigured/invalid environment, missing prompts, and malformed inputs. Verify that responses return HTTP 500 or 503 (never HTTP 200) with a structured JSON envelope `{ success: false, error: '...', code: '...' }`.
4. **Regression Test Verification**:
   - Run `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node tests/e2e_remediation_test.js`, and `node tests/m2_verification_test.js`.

## Output Requirements
Write your adversarial test report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md`
Conclude with an explicit verdict: **APPROVE** or **FAIL**.
Send a completion message with your verdict when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T14:22:36Z
<USER_REQUEST>
You are Challenger 1 for Milestone M2 (Input Sanitization, XSS Elimination & Error Normalization).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request), `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All stress tests and verifications must be authentic.

Empirically stress-test Milestone M2 input validation and XSS elimination:
1. Fuzz transactions and auth with invalid amounts (negative, 0, NaN, strings, huge numbers), malformed objects/arrays, and verify HTTP 400 rejection.
2. Probe stored XSS vectors (<script>, <img onerror>, svg) in transaction descriptions and admin logs to verify proper escaping in browser DOM.
3. Test unconfigured/invalid Gemini requests and verify they return HTTP 500/503 (never HTTP 200).
4. Run test suites: `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node tests/e2e_remediation_test.js`, and `node tests/m2_verification_test.js`.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md` with explicit verdict APPROVE or FAIL. Send a completion message when finished. Maintain progress.md with timestamps.
</USER_REQUEST>
