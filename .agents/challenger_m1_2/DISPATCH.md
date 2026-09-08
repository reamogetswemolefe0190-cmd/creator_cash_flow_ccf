# Dispatch Instructions for Challenger 2: Milestone M1

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2`

## Role & Archetype
- Archetype: teamwork_preview_challenger
- Role: Empirical Threat Modeler & Stress Tester

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m1\handoff.md`.

## Adversarial Testing Mission
Empirically stress-test the Milestone M1 implementation:
1. **Memory & Concurrency Stress**: Benchmark the bounded sliding-window rate limiters. Verify that tracking thousands of simulated IPs does not result in unbounded memory expansion and that expired entries are evicted.
2. **PII & Credential Injection Attack**: Run dynamic scans and automated checks for any residual plaintext secrets, hardcoded JWT secrets, or developer email occurrences in running server responses, error traces, and source code.
3. **Session Replay & Brute Force Lockout**: Test the rate-limited endpoints under sustained attack to ensure lockout thresholds reset cleanly after the window expires.

## Output Requirements
Write your test scripts, memory metrics, and findings to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2\handoff.md`
State your verdict: **APPROVE** or **FAIL**.

## 2026-09-04T09:54:08Z
You are Challenger 2 for Milestone M1.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2\DISPATCH.md` first.
Empirically stress-test Milestone M1:
1. Memory & concurrency stress: test rate limiters with simulated IPs and verify bounded memory and TTL eviction.
2. PII & credential injection checks across running server responses and error traces.
3. Sustained brute-force lockout and window reset verification.
Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2\handoff.md` with explicit verdict APPROVE or FAIL. Send a message when finished.
