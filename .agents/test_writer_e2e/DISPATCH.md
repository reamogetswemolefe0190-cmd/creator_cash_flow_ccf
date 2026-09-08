# Dispatch Instructions for E2E Test Writer

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\test_writer_e2e`

## Role & Archetype
- Archetype: teamwork_preview_test_writer
- Role: E2E Test Architect & Writer

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All tests must be genuine, requirement-driven, opaque-box tests. Tests must independently verify user-facing behavior, security rules, and error handling.

## Mission & Objectives
Establish the E2E Testing Track for Creator Cash Flow:
1. Review all 18 features from `PROJECT.md § Feature Inventory` and map 4 tiers of tests:
   - Tier 1: Feature Coverage (happy path, isolated verification)
   - Tier 2: Boundary & Corner Cases (empty/negative amounts, oversized strings, invalid tokens, brute force threshold)
   - Tier 3: Cross-Feature Combinations (auth -> transaction -> metrics -> audit logs)
   - Tier 4: Real-World Application Scenarios (creator lifecycle from registration to status mutation)
2. Create `TEST_INFRA.md` documenting test architecture, invocation, pass/fail semantics, and coverage matrix.
3. Implement automated test scripts under `tests/e2e_remediation_test.js` or equivalent that run against the API and static frontend assets without modifying source code.
4. When test cases are implemented and verified, publish `TEST_READY.md` summarizing the test harness and test counts.

## Output Requirements
Write `handoff.md` in your working directory with the test catalog, test execution results, and paths to created test files.
Publish `TEST_READY.md`.
Send a message when complete.

## 2026-09-04T09:35:06Z
<USER_REQUEST>
You are the E2E Test Architect & Writer.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\test_writer_e2e`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request) and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\test_writer_e2e\DISPATCH.md` first.
Also read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All tests must be genuine, requirement-driven, opaque-box tests. Tests must independently verify user-facing behavior, security rules, and error handling.

Execute the E2E Testing Track:
1. Design opaque-box test suites across Tiers 1-4 covering all 18 features from PROJECT.md § Feature Inventory.
2. Create TEST_INFRA.md documenting the test architecture and coverage matrix.
3. Write automated test harness scripts (e.g. tests/e2e_remediation_test.js) that execute against the API and verify functionality, rate limiting, PII absence, and error handling.
4. Run the tests to confirm functionality and publish TEST_READY.md when complete.

Write your handoff report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\test_writer_e2e\handoff.md` and send a completion message when finished. Maintain progress.md with timestamps.
</USER_REQUEST>

