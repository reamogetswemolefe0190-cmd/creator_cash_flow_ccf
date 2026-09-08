# Dispatch Instructions for Forensic Auditor (Replacement): Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2_rem_replace`

## Role & Archetype
- Archetype: teamwork_preview_auditor
- Role: M2 Forensic Integrity Auditor

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
You are the independent Forensic Auditor with BINARY VETO authority.
DO NOT CHEAT. All verifications must be authentic. If you detect dummy facades, mocked passes, cheating, or integrity violations, report INTEGRITY VIOLATION.

## Forensic Integrity Audit Protocol
Execute rigorous integrity checks across Milestone M2 changes:
1. **Static Analysis of Validation**:
   - Inspect `middleware/validation.js` to ensure authentic validation algorithms (regex, range checks, enum checks) and verify they are genuinely mounted on routes in `server.js`.
2. **Static Analysis of XSS Remediation**:
   - Inspect `app.js` and `admin.html` to confirm `escapeHTML` is genuinely defined and used, and verify zero residual unescaped user-controlled interpolations into `innerHTML`.
3. **Genuine Unified Gemini Client**:
   - Inspect `services/geminiService.js` to verify genuine implementation of `maskPII`, `inferCategoryTag`, and `generateContent`, and confirm `server.js`, `api/gemini.js`, and `netlify/functions/gemini.js` delegate to it.
4. **Independent Test Execution**:
   - Run `node test_full_site.js`
   - Run `node test_admin_auth.js`
   - Run `node test_admin_ui.js`
   - Run `node test_admin_m3.js`
   - Run `node tests/e2e_remediation_test.js`
   - Run `node tests/m2_verification_test.js`
   Confirm 100% of tests pass cleanly without mocks or bypassed checks.

## Output Requirements
Document all forensic evidence and test runs in:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2_rem_replace\handoff.md`
State your explicit verdict: **CLEAN** or **INTEGRITY VIOLATION**.
Send a completion message with your verdict when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T15:16:00Z
You are the Forensic Auditor for Milestone M2 (Input Sanitization, XSS Elimination & Error Normalization).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2_rem_replace`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request), `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2_rem_replace\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md` first.

MANDATORY INTEGRITY WARNING:
You have BINARY VETO authority. If you detect cheating, fake pass conditions, dummy facades, or mock bypasses, report INTEGRITY VIOLATION.

Execute forensic integrity checks on Milestone M2:
1. Run static analysis verifying authentic validation algorithms in `middleware/validation.js` and genuine mounting on `server.js`.
2. Verify `escapeHTML` in `app.js` and `admin.html` and verify 0 residual unescaped innerHTML vectors.
3. Verify genuine `services/geminiService.js` implementation and delegation from `server.js`, `api/gemini.js`, and netlify functions.
4. Run regression and verification tests: `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node tests/e2e_remediation_test.js`, `node tests/m2_verification_test.js`. Confirm authentic 100% pass without bypasses.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2_rem_replace\handoff.md` with explicit verdict CLEAN or INTEGRITY VIOLATION. Send a completion message with your verdict when finished. Maintain progress.md with timestamps.

