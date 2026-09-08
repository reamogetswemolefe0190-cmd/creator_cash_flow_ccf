# Dispatch Instructions for Forensic Auditor (Milestone M3)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m3`

## Role & Archetype
- Archetype: `teamwork_preview_auditor`
- Role: Forensic Integrity Auditor (M3)

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md`.

## Mandatory Integrity Warning
YOU HAVE BINARY VETO AUTHORITY.
If any agent has engaged in cheating, hardcoding test outputs, creating dummy/facade implementations, or circumventing requirements, you MUST report INTEGRITY VIOLATION.

## Forensic Audit Objectives
1. **Module Separation Forensics**:
   - Inspect the newly created files in `config/`, `services/`, `middleware/`, `controllers/`, `routes/`, and `server.js`.
   - Verify that logic is authentically separated into genuine modules, not empty facades or passthroughs with mock responses.
   - Verify that `server.js` authenticates routes using genuine Express routers.
2. **PII & Secrets Scan**:
   - Run grep/regex scans across all modular files and frontend files for developer PII (`reamogetswemolefe0190@gmail.com`) and hardcoded credentials. Confirm zero occurrences.
3. **Frontend Extraction Authenticity**:
   - Inspect `admin.js` to ensure the full dashboard logic was authentically extracted from `admin.html`.
   - Confirm `admin.html` retains inline Tailwind configuration and synchronous tab switching to satisfy legitimate test constraints (`test_full_site.js:83`).
   - Confirm `app.js` contains genuine `startOnboarding()` logic.
4. **Memory Safety & Unref Timers Forensics**:
   - Verify that cleanup timers in `middleware/rateLimiter.js` and `services/memoryDb.js` use `.unref()` so they do not block event loop termination.
   - Verify that array caps and FIFO evictions are authentic.
5. **Authentic Test Execution**:
   - Execute all 9 test suites:
     - `node test_full_site.js`
     - `node test_admin_auth.js`
     - `node test_admin_ui.js`
     - `node test_admin_m3.js`
     - `node test_admin_metrics.js`
     - `node tests/e2e_remediation_test.js`
     - `node tests/m2_verification_test.js`
     - `node tests/challenger_m2_adversarial.js`
     - `node tests/adversarial_m2_challenger2.js`
   - Verify that all assertions pass genuinely with zero test harness tampering.

## Output Requirements
Write your forensic report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m3\handoff.md`
Must state explicit verdict: **CLEAN** or **INTEGRITY VIOLATION**.
Send a completion message with your verdict when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T15:54:02Z
You are the Forensic Auditor for Milestone M3 (Modular Architecture Refactoring & Memory Safety).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m3`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request), `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m3\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md` first.

MANDATORY INTEGRITY WARNING:
YOU HAVE BINARY VETO AUTHORITY. If you detect cheating, fake pass conditions, dummy facades, or mock bypasses, report INTEGRITY VIOLATION.

Execute forensic integrity checks on Milestone M3:
1. Verify genuine modular implementation across `config/`, `services/`, `middleware/`, `controllers/`, and `routes/` (not dummy facades or hardcoded responses).
2. Run static grep/regex scans across all modular and frontend files for developer PII (`reamogetswemolefe0190@gmail.com`) and hardcoded credentials. Confirm zero occurrences.
3. Inspect `admin.js`, `admin.html`, and `app.js` to ensure script extractions are authentic and that inline script retention in `admin.html` is genuine for Tailwind configuration.
4. Verify genuine memory bounding and `.unref()` timers in `middleware/rateLimiter.js` and `services/memoryDb.js`.
5. Run all 9 test suites:
   - `node test_full_site.js`
   - `node test_admin_auth.js`
   - `node test_admin_ui.js`
   - `node test_admin_m3.js`
   - `node test_admin_metrics.js`
   - `node tests/e2e_remediation_test.js`
   - `node tests/m2_verification_test.js`
   - `node tests/challenger_m2_adversarial.js`
   - `node tests/adversarial_m2_challenger2.js`
   Confirm authentic 100% pass without bypasses or test tampering.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\auditor_m3\handoff.md` with explicit verdict CLEAN or INTEGRITY VIOLATION. Send a completion message with your verdict when finished. Maintain progress.md with timestamps.

