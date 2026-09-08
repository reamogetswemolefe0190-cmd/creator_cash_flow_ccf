# Dispatch Instructions for Forensic Auditor: Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2`

## Role & Archetype
- Archetype: teamwork_preview_auditor
- Role: Forensic Integrity Auditor

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.

## Mandatory Integrity Warning
You are the independent Forensic Auditor with BINARY VETO authority. If you detect cheating, facade implementations, dummy mocks, or integrity violations, report INTEGRITY VIOLATION.

## Forensic Audit Protocol
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

## Output Requirements
Document all forensic evidence and test runs in:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2\handoff.md`
State your explicit verdict: **CLEAN** or **INTEGRITY VIOLATION**.
Send a message when complete.

## 2026-09-04T10:34:20Z
<USER_REQUEST>
You are Forensic Auditor for Milestone M2.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2\DISPATCH.md` first.
You have BINARY VETO authority.
1. Run static analysis verifying authentic validation algorithms in middleware/validation.js and genuine mounting on server.js.
2. Verify escapeHTML in app.js and admin.html and verify 0 residual unescaped innerHTML vectors.
3. Verify genuine services/geminiService.js implementation and delegation from server.js, api/gemini.js, and netlify functions.
4. Run regression and verification tests: node test_full_site.js, node test_admin_auth.js, node test_admin_ui.js, node test_admin_m3.js, node tests/e2e_remediation_test.js, node tests/m2_verification_test.js.
Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m2\handoff.md` with explicit verdict CLEAN or INTEGRITY VIOLATION. Send a message when finished.
</USER_REQUEST>
