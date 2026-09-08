# Dispatch Instructions for Challenger 2: Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_2`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: M2 Error Boundaries & Concurrency Challenger 2

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All stress tests, fuzzing, and verifications must be authentic. Do not fabricate results.

## Adversarial Stress Testing Protocol
Empirically stress-test Milestone M2 error normalization, boundary handling, and service isolation:
1. **Malformed Payloads & Route Error Handling**:
   - Send malformed JSON, truncated bodies, and unexpected content types to API endpoints. Verify clean JSON error envelopes with proper status codes.
   - Probe non-existent API routes (e.g. `GET /api/nonexistent`, `POST /api/unknown/endpoint`). Verify the JSON 404 handler returns `{ success: false, error: 'Not Found', code: 'ROUTE_NOT_FOUND' }` with HTTP 404 (not HTML 404).
2. **Admin Mutation Boundary Stress**:
   - Test `POST /api/admin/creators/:id/status` with oversized notes (>500 chars), invalid status values (`banned`, `deleted`), invalid plan tiers (`Enterprise`), and non-existent creator IDs. Verify proper validation and rejection.
3. **PII Masking Integrity in Service**:
   - Test `maskPII` in `services/geminiService.js` against various patterns: South African phone numbers, international formats, email addresses, and currency amounts. Ensure redaction occurs before telemetry logging.
4. **Full Regression Execution**:
   - Run `node test_full_site.js`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node tests/e2e_remediation_test.js`, and `node tests/m2_verification_test.js`.

## Output Requirements
Write your adversarial test report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_rem_2\handoff.md`
Conclude with an explicit verdict: **APPROVE** or **FAIL**.
Send a completion message with your verdict when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T14:22:37Z
Dispatched as Challenger 2 for Milestone M2.
