# Dispatch Instructions for Worker M2 (Iteration 2): Transaction Validation Remediation

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2`

## Role & Archetype
- Archetype: teamwork_preview_worker
- Role: Input Validation Remediation Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md` (exact defect report and code lines).
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Objectives
1. **Fix Loose Parsing in `middleware/validation.js:validateTransaction`**:
   - Challenger 1 reported that `parseFloat(amount)` coerced arrays (e.g. `amount: [100]`) and trailing alphanumeric strings (e.g. `amount: "100abc"`, `"100<script>"`) into `100`, returning HTTP 201 Created instead of HTTP 400 Bad Request (`INVALID_AMOUNT`).
   - Add strict type verification rejecting arrays, objects, booleans, and non-number/non-string inputs.
   - For string inputs, ensure the value strictly conforms to `/^\d+(\.\d+)?$/` after trimming.
   - Retain existing range limits (`0 < amount <= 100,000,000`) and rounding (`Math.round(parsedAmount * 100) / 100`).
2. **Enhance `sanitizeString` in `middleware/validation.js`**:
   - Strip dangling/orphan angle brackets: `str.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim()`.
3. **Execute Test Verification**:
   - Run `node tests/challenger_m2_adversarial.js` — all 112/112 tests MUST pass!
   - Run `node tests/adversarial_m2_challenger2.js` — all 127/127 tests MUST pass!
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Run `node test_admin_ui.js`
   - Run `node test_admin_m3.js`
   - Run `node tests/e2e_remediation_test.js`
   - Run `node tests/m2_verification_test.js`

## Output Requirements
Write your detailed implementation and test execution report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2\handoff.md`
Send a completion message with your report path when complete. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T15:24:37Z
You are Worker M2 (Iteration 2): Input Validation Remediation Specialist.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`, `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute Milestone M2 Iteration 2 remediation:
1. Fix loose `parseFloat(amount)` in `middleware/validation.js:validateTransaction`. Reject arrays (`[100]`), objects, non-numeric strings (`"100abc"`), and tags with HTTP 400 (`INVALID_AMOUNT`). Enforce regex `/^\d+(\.\d+)?$/` on string inputs.
2. Enhance `sanitizeString` in `middleware/validation.js` to strip orphan angle brackets: `str.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim()`.
3. Verify changes:
   - Run `node tests/challenger_m2_adversarial.js` (MUST pass 112/112).
   - Run `node tests/adversarial_m2_challenger2.js` (MUST pass 127/127).
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Run `node test_admin_ui.js`
   - Run `node test_admin_m3.js`
   - Run `node tests/e2e_remediation_test.js`
   - Run `node tests/m2_verification_test.js`

Write your handoff report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2\handoff.md` and send a message when complete. Maintain progress.md with timestamps.

