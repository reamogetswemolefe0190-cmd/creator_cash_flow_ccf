# Dispatch Instructions for Challenger 2: Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_2`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: API Error & Boundary Stress Challenger

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.

## Adversarial Testing Mission
Empirically stress-test Milestone M2:
1. **API Error Normalization & Boundary Stress**: Test malformed JSON, truncated payloads, missing Content-Type headers, unmatched routes (404), and unhandled method verbs across all endpoints. Verify all return clean structured JSON error envelopes with proper status codes.
2. **Gemini Service Concurrency & Telemetry Check**: Send concurrent AI requests and verify that PII masking strictly redacts emails, phone numbers, and ZAR currency from prompts in telemetry records.
3. **Admin Status Mutation Boundaries**: Test oversized notes (>500 chars), invalid plan tiers, and invalid status values. Verify strict rejection.

## Output Requirements
Document test scripts, outputs, and explicit verdict (**APPROVE** or **FAIL**) in:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_2\handoff.md`
Send a message when complete.

## 2026-09-04T10:34:19Z
You are Challenger 2 for Milestone M2.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_2\DISPATCH.md` first.
Empirically stress-test Milestone M2 error normalization & service boundaries:
1. Test malformed JSON, truncated bodies, unmatched routes (404), and verify clean structured JSON error envelopes with proper status codes.
2. Verify PII masking in telemetry logs under concurrent AI requests.
3. Verify admin status mutation boundaries.
Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_2\handoff.md` with explicit verdict APPROVE or FAIL. Send a message when finished.

