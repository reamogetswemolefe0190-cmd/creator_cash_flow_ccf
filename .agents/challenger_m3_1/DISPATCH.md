# Dispatch Instructions for Challenger 1 (Milestone M3)

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_1`

## Role & Archetype
- Archetype: `teamwork_preview_challenger`
- Role: Memory Safety & Bounded Structures Challenger 1

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All stress tests, fuzzing, and verifications must be authentic.

## Empirical Challenge Objectives
1. **Memory Map Bounds Stress Testing**:
   - Write a stress verification script testing `middleware/rateLimiter.js` and `services/memoryDb.js`.
   - Inject 1,500 distinct client IPs into rate limiters and verify that maps never grow beyond 1,000 entries.
   - Inject 1,500 audit logs and 1,500 telemetry records into `memoryDb` and verify FIFO truncation at 1,000 items.
   - Verify that all cleanup timers are unreferenced (`.unref()`) so the Node.js event loop does not hang upon test completion.
2. **Backward Compatibility Verification**:
   - Confirm that requiring `./server` yields all 10 exported symbols:
     `{ app, server, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET, maskPII, inferCategoryTag, getClientIp }`.
   - Test that each symbol functions identically to the pre-refactoring contract.
3. **Execute Test Suites**:
   - Run `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node test_admin_metrics.js`, `node tests/e2e_remediation_test.js`, `node tests/m2_verification_test.js`, `node tests/challenger_m2_adversarial.js`, `node tests/adversarial_m2_challenger2.js`.

## Output Requirements
Write your challenge report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_1\handoff.md`
Must state explicit verdict: **APPROVE** or **FAIL**.
Send a completion message when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T15:54:02Z

You are Challenger 1 for Milestone M3 (Modular Architecture Refactoring & Memory Safety).
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_1`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request), `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_1\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m3\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All empirical stress tests, fuzzing, and verifications must be authentic.

Empirically stress-test Milestone M3:
1. Memory map capacity bounds: write and execute a stress verification harness testing `middleware/rateLimiter.js` (inject 1,500 distinct IPs, verify cap at 1,000) and `services/memoryDb.js` (inject 1,500 audit logs and 1,500 telemetry records, verify FIFO cap at 1,000).
2. Unreferenced timer verification: verify all cleanup intervals call `.unref()` so Node.js process does not hang.
3. Backward compatibility: verify all 10 exported symbols from `server.js` behave as expected.
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

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m3_1\handoff.md` with explicit verdict APPROVE or FAIL. Send a completion message when finished. Maintain progress.md with timestamps.
