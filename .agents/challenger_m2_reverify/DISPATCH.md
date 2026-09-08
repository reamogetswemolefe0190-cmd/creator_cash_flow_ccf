# Dispatch Instructions for Challenger Re-verifier: Milestone M2 (Iteration 2)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_reverify`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: M2 Adversarial Re-verifier

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2\handoff.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md`.
4. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All empirical stress tests, fuzzing, and verifications must be authentic.

## Re-verification Protocol
1. **Adversarial Regression Suite Execution**:
   - Run `node tests/challenger_m2_adversarial.js`. Verify all 112 tests pass (specifically verifying `[TX_AMT_10]` and `[TX_AMT_18]`).
   - Run `node tests/adversarial_m2_challenger2.js`. Verify all 127 tests pass.
2. **Direct Defect Verification**:
   - Directly probe `POST /api/transactions` with:
     - `amount: [100]` -> verify HTTP 400 (`INVALID_AMOUNT`).
     - `amount: "100abc"` -> verify HTTP 400 (`INVALID_AMOUNT`).
     - `amount: "100<script>"` -> verify HTTP 400 (`INVALID_AMOUNT`).
     - `amount: " 250.50 "` -> verify HTTP 201 (valid numeric string allowed).
     - `amount: 500` -> verify HTTP 201 (valid integer allowed).
3. **Full Regression Execution**:
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Run `node test_admin_ui.js`
   - Run `node test_admin_m3.js`
   - Run `node tests/e2e_remediation_test.js`
   - Run `node tests/m2_verification_test.js`

## Output Requirements
Write your detailed re-verification report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_reverify\handoff.md`
State your explicit verdict: **APPROVE** or **FAIL**.
Send a completion message with your verdict when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T15:29:19Z
<USER_REQUEST>
You are Challenger Re-verifier for Milestone M2 (Iteration 2).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_reverify`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`, `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_reverify\DISPATCH.md`, `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2_remediation_2\handoff.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_1\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All empirical stress tests, fuzzing, and verifications must be authentic.

Execute Milestone M2 re-verification:
1. Run `node tests/challenger_m2_adversarial.js` (verify all 112/112 tests pass, confirming fix for [TX_AMT_10] and [TX_AMT_18]).
2. Run `node tests/adversarial_m2_challenger2.js` (verify all 127/127 tests pass).
3. Directly verify that `amount: [100]`, `amount: "100abc"`, and `amount: "100<script>"` are rejected with HTTP 400 (`INVALID_AMOUNT`), while valid amounts are accepted.
4. Run all regression test suites: `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node tests/e2e_remediation_test.js`, and `node tests/m2_verification_test.js`.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_reverify\handoff.md` with explicit verdict APPROVE or FAIL. Send a completion message when finished. Maintain progress.md with timestamps.
</USER_REQUEST>

