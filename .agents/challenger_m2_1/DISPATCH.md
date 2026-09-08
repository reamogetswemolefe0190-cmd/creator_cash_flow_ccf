# Dispatch Instructions for Challenger 1: Milestone M2

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_1`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: Adversarial Input & XSS Verifier

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m2\handoff.md`.

## Adversarial Testing Mission
Empirically stress-test Milestone M2 security controls:
1. **Adversarial Input Fuzzing**: Send boundary and malicious payloads to `POST /api/transactions`, `POST /api/auth/signup`, `POST /api/auth/login`, and `POST /api/admin/creators/:id/status`:
   - Negative amounts, NaN, zero, massive amounts (1e12), strings in amount fields.
   - Array and object injections in email/password fields (e.g., `{ "$gt": "" }`, `["admin"]`).
   - XSS payloads in `merchant`, `source`, `category`, and admin `note` (`<script>alert(1)</script>`, `<img src=x onerror=...>`, `<svg/onload=...>`, `"><iframe src=evil.com>`).
   - Confirm all are rejected with HTTP 400 or safely stripped.
2. **AI Error Semantics Fuzzing**: Test `POST /api/gemini` and `api/gemini.js` with unconfigured/invalid keys and verify they return HTTP 500/503 with standardized JSON error bodies, NEVER HTTP 200.
3. **Frontend DOM XSS Verification**: Verify that stored transaction and creator data with XSS metacharacters render as escaped entities (`&lt;script&gt;`) in the DOM and cannot execute scripts.

## Output Requirements
Document test scripts, payloads, outputs, and explicit verdict (**APPROVE** or **FAIL**) in:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_1\handoff.md`
Send a message when complete.

## 2026-09-04T10:34:19Z
You are Challenger 1 for Milestone M2.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_1`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_1\DISPATCH.md` first.
Empirically stress-test Milestone M2 input validation and XSS:
1. Fuzz transactions and auth with invalid amounts (negative, NaN, strings), malformed objects/arrays, and oversized notes. Verify HTTP 400.
2. Probe XSS payloads (<script>alert(1)</script>, <img src=x onerror=...>) in merchant, source, note, and verify they render safely escaped in the browser DOM.
3. Test unconfigured/invalid Gemini requests and verify they return HTTP 500/503, NEVER HTTP 200.
Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m2_1\handoff.md` with explicit verdict APPROVE or FAIL. Send a message when finished.
