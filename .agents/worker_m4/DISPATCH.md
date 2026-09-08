# Dispatch Instructions for Worker M4: QA, Test Automation & CI/CD Pipeline

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m4`

## Role & Archetype
- Archetype: `teamwork_preview_worker`
- Role: QA, Test Automation & CI/CD Pipeline Specialist

## Mandatory References
1. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request).
2. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra\handoff.md` (survey report on QA, test infrastructure, CI/CD, and docs).
3. Read `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\orchestrator_remediation\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Implementation Objectives

### 1. Configure `package.json` Test Script (Feature 15)
- Update `package.json` `"scripts"` to add:
  `"test": "node test_pivot_validation.js && node test_full_site.js"`
- Verify that `npm test` runs both `test_pivot_validation.js` (37 assertions) and `test_full_site.js` (11 assertions) and exits 0 cleanly.

### 2. Establish GitHub Actions CI Workflow (Feature 16)
- Create `.github/workflows/test.yml` with:
  - Workflow name: `CI / Automated Regression Tests`
  - Trigger on: `push` and `pull_request` on `[main, master]`.
  - Matrix testing: `node-version: [18.x, 20.x]`.
  - Operating system: `ubuntu-latest`.
  - Steps:
    1. Checkout code (`actions/checkout@v4`).
    2. Set up Node.js (`actions/setup-node@v4` with cache: `'npm'`).
    3. Install dependencies (`npm ci` or `npm install`).
    4. Start server in background (`node server.js &`).
    5. Poll `/api/health` until ready (`curl --retry 10 --retry-delay 1 http://localhost:5000/api/health`).
    6. Run core regression suite: `npm test` (`node test_pivot_validation.js && node test_full_site.js`).
    7. Run administrative and verification test suites:
       `node test_admin_auth.js && node test_admin_ui.js && node test_admin_m3.js && node test_admin_metrics.js`.
    8. Run opaque-box E2E test suite: `node tests/e2e_remediation_test.js`.
    9. Run challenger adversarial test suites: `node tests/challenger_m2_adversarial.js && node tests/adversarial_m2_challenger2.js && node tests/challenger_m3_bounds_stress.js && node tests/challenger_m3_stress2.js`.

### 3. Comprehensive API Documentation (Feature 17)
- Create `docs/API.md` detailing:
  - **Overview**: Architecture, base URLs, environment configuration.
  - **Authentication**: Creator JWT Bearer tokens, Admin JWT authentication, offline/demo mode token fallback.
  - **Error Handling & Normalization**: Standard JSON error envelopes (`{ success: false, error: string, code: string }`), HTTP status code standards (200, 201, 400, 401, 403, 404, 429, 500, 503).
  - **Rate Limiting**: Rate limits across endpoints, sliding window algorithms, IP resolution, and HTTP 429 semantics.
  - **Detailed Endpoint Specifications** (Method, URL, Auth, Request Headers, Body Parameters, Sample Request, Sample Response, Status Codes):
    - `POST /api/auth/register` (Creator registration & welcome email)
    - `POST /api/auth/login` (Creator login & JWT issuance)
    - `GET /api/transactions` (Creator transaction history)
    - `POST /api/transactions` (Record income/expense with schema validation & dual write)
    - `POST /api/onboarding` (Store onboarding platform & audience selections)
    - `GET /api/integrations/phyllo/token` (Phyllo SDK connect token)
    - `POST /api/admin/auth/login` (Admin login with brute-force rate limiter)
    - `GET /api/admin/auth/verify` (Admin session verification)
    - `GET /api/admin/metrics` (Platform KPI scorecard & 6-month timeline)
    - `GET /api/admin/creators` (Creator directory listing)
    - `POST /api/admin/creators/:id/status` (Creator status/plan tier mutation with immutable audit log & SHA-256 IP hashing)
    - `GET /api/admin/audit-logs` (Immutable admin audit trail)
    - `GET /api/admin/telemetry` (PII-masked AI query telemetry with 30-day TTL)
    - `POST /api/gemini` (AI cash flow advisory proxy with PII redactor & latency tracking)
    - `GET /api/health` (Deep diagnostics: database ping latency, process memory, uptime, integration statuses)

### 4. Verification
- Run `npm test` and verify that it executes `test_pivot_validation.js && test_full_site.js` and exits with code 0 (48/48 assertions passing).
- Run all test suites:
  - `npm test`
  - `node test_admin_auth.js`
  - `node test_admin_ui.js`
  - `node test_admin_m3.js`
  - `node test_admin_metrics.js`
  - `node tests/e2e_remediation_test.js`
  - `node tests/m2_verification_test.js`
  - `node tests/challenger_m2_adversarial.js`
  - `node tests/adversarial_m2_challenger2.js`
  - `node tests/challenger_m3_bounds_stress.js`
  - `node tests/challenger_m3_stress2.js`
- Verify that `docs/API.md` and `.github/workflows/test.yml` are created and valid.

## Output Requirements
Write your detailed implementation and verification report to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m4\handoff.md`
Send a completion message when finished. Maintain `progress.md` with timestamps for liveness heartbeat.

## 2026-09-04T16:03:17Z
<USER_REQUEST>
You are Worker M4: QA, Test Automation & CI/CD Pipeline Specialist.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m4`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md`, `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m4\DISPATCH.md`, and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra\handoff.md` first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute Milestone M4:
1. Update `package.json` to configure `"scripts": { "test": "node test_pivot_validation.js && node test_full_site.js", ... }`.
2. Create `.github/workflows/test.yml` implementing the GitHub Actions CI pipeline running automated regression tests on Node 18 & 20 matrix on pushes and PRs.
3. Create comprehensive production-grade `docs/API.md` documenting all public and administrative API endpoints, authentication mechanisms, rate limit policies, and error envelopes.
4. Run `npm test` and verify that both `test_pivot_validation.js` (37 assertions) and `test_full_site.js` (11 assertions) execute cleanly and exit 0.
5. Run all test suites: `npm test`, `node test_admin_auth.js`, `node test_admin_ui.js`, `node test_admin_m3.js`, `node test_admin_metrics.js`, `node tests/e2e_remediation_test.js`, `node tests/m2_verification_test.js`, `node tests/challenger_m2_adversarial.js`, `node tests/adversarial_m2_challenger2.js`, `node tests/challenger_m3_bounds_stress.js`, `node tests/challenger_m3_stress2.js`.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\worker_m4\handoff.md` and send a message when complete. Maintain progress.md with timestamps.
</USER_REQUEST>
