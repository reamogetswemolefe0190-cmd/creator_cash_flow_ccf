# Dispatch Instructions for Challenger 1: Milestone M1

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: Adversarial Security Verifier

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1\handoff.md`.

## Adversarial Testing Mission
Empirically stress-test the Milestone M1 security controls:
1. **Adversarial Rate-Limit Stress**: Write and execute a rapid request generator to test rate-limit enforcement across `/api/auth/login`, `/api/transactions`, `/api/gemini`, and `/api/admin/creators/:id/status`. Verify that rapid bursts trigger HTTP 429 Too Many Requests.
2. **Adversarial CORS Probing**: Send requests with unauthorized origins (e.g., `https://evil-attacker.com`, `http://malicious.org`) vs allowed origins (`http://localhost:5000`, `https://creatorcashflow.co.za`). Verify unauthorized origins are strictly blocked / not reflected with credentials.
3. **Admin Auth Gate Bypass Probe**: Attempt unauthenticated requests or requests with forged synthetic tokens (`adm_token_...`) against `/api/admin/*` to verify strict 401/403 rejection.

## Output Requirements
Write your test scripts, attack outputs, and empirical findings to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1\handoff.md`
State your verdict: **APPROVE** or **FAIL**.
Send a message when complete.

## 2026-09-04T09:54:08Z
You are Challenger 1 for Milestone M1.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1\DISPATCH.md` first.
Empirically stress-test Milestone M1 security controls:
1. Rate-limit burst attacks against /api/auth/login, /api/transactions, /api/gemini, /api/admin/creators/:id/status to verify HTTP 429 responses.
2. CORS probing with unauthorized vs whitelisted origins.
3. Unauthenticated/synthetic token admin access rejections (401/403).
Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_1\handoff.md` with explicit verdict APPROVE or FAIL. Send a message when finished.
