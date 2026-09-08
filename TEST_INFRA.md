# Creator Cash Flow — End-to-End Test Infrastructure & Coverage Specification (`TEST_INFRA.md`)

## 1. Executive Overview & Testing Philosophy

This document defines the automated end-to-end (E2E) testing infrastructure, architecture, and verification methodology for the **Creator Cash Flow (CCF)** platform remediation.

### 1.1 Strict Opaque-Box Methodology
In accordance with the project's **Mandatory Integrity Protocol**, all test suites implemented under this testing track are strictly **opaque-box, requirement-driven, and independent**:
- **No Mocking of Core Logic**: Requests are executed over real HTTP sockets against the Express application.
- **Genuine Requirement Assertions**: Every expected value is derived directly from authoritative specifications in `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- **Zero Facade Testing**: No trivial assertion loops or tautological tests.
- **Strict Isolation**: Test runs generate unique test entities (e.g. timestamps/cryptographic nonces in emails and usernames) to prevent cross-run pollution and race conditions.
- **Adversarial Security & Edge Coverage**: Explicit validation of input boundary rejections, rate-limiting HTTP 429 thresholds, unauthorized/forbidden access rejections (401/403), CORS origin headers, and cryptographic PII redaction.

---

## 2. Test Architecture: The 4-Tier Verification Framework

The testing track is structured across four progressive tiers, ensuring complete multi-dimensional coverage across unit contracts, security boundaries, full lifecycle workflows, and static asset integrity.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 4: REAL-WORLD & SYSTEM INTEGRITY                │
│  - Full Creator Journey (Signup -> Onboard -> Revenue -> Ledger)       │
│  - Brute Force Security Lockdown & Recovery                            │
│  - Deep Forensic Scan (Zero Hardcoded PII, .env Ignore, Git Check)     │
│  - Deep Health Diagnostics & Uptime Telemetry                         │
├────────────────────────────────────────────────────────────────────────┤
│             TIER 3: CROSS-FEATURE COMBINATIONS & STATE TRANSITIONS     │
│  - Lifecycle: Register -> Transact -> Metrics -> Admin Audit Trail     │
│  - AI Telemetry PII Masking (Email, Phone, ZAR Redaction + Tags)       │
│  - Status Mutation Immutability & SHA-256 IP Hash Chain                │
│  - High-Throughput Ledger Integrity & Dual-Storage Consistency        │
├────────────────────────────────────────────────────────────────────────┤
│                 TIER 2: BOUNDARY, SECURITY & CORNER CASES              │
│  - Malformed & Empty Payloads (400 Bad Request)                        │
│  - Negative & NaN Financial Amounts Rejection                          │
│  - Oversized Strings & Injection Resistance                            │
│  - Rate Limiting Enforcement (Auth 10/15m, Admin 5/15m -> HTTP 429)    │
│  - RBAC Enforcement (No Token 401, Creator-as-Admin 403)               │
│  - CORS Policy Enforcement (Whitelist Allowed, Unlisted Blocked)      │
├────────────────────────────────────────────────────────────────────────┤
│                   TIER 1: FEATURE COVERAGE & HAPPY PATH                │
│  - System Health & Diagnostics (GET /api/health)                       │
│  - Creator Authentication: Signup & Login (JWT Generation)             │
│  - Ledger Operations: GET /api/transactions & POST /api/transactions   │
│  - Onboarding Persistence: POST /api/onboarding/save                   │
│  - Integration Handshake: POST /api/integrations/phyllo/token          │
│  - Admin Auth, Verify & Metrics (GET /api/admin/metrics)               │
│  - Admin Creator Directory & Status Mutation                           │
│  - Admin Audit Logs & AI Telemetry Retrieval                           │
│  - Gemini AI Proxy Query Execution                                     │
│  - Static Asset Delivery (HTML, CSS, JS, Manifest)                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comprehensive Feature Coverage Matrix (18/18 Features)

| Feature ID | Feature Name | Target Tier(s) | Test Case IDs | Authoritative Reference | Expected Output & Pass Criteria |
|---|---|---|---|---|---|
| **F1** | PII & Secret Sanitization | Tier 4 | `T4_PII_SCAN` | `ORIGINAL_REQUEST.md:130`, `PROJECT.md:13` | Codebase scan confirms 0 instances of developer email (`reamogetswemolefe0190@gmail.com`) and fallback secrets in active source code. |
| **F2** | Git Ignore Configuration | Tier 4 | `T4_GIT_IGNORE` | `ORIGINAL_REQUEST.md:131`, `PROJECT.md:14` | `git check-ignore -v .env` exits with code 0; `.env*` entries present in `.gitignore`. |
| **F3** | Explicit CORS Whitelist | Tier 2 | `T2_CORS_WHITELIST`, `T2_CORS_FORBIDDEN` | `ORIGINAL_REQUEST.md:132`, `PROJECT.md:15` | Preflight/request with `Origin: http://localhost:5000` returns `Access-Control-Allow-Origin: http://localhost:5000`. Unlisted origin does not receive permissive reflection. |
| **F4** | Comprehensive Rate Limiting | Tier 2, Tier 4 | `T2_AUTH_RATELIMIT`, `T2_ADMIN_RATELIMIT`, `T4_BRUTE_FORCE` | `ORIGINAL_REQUEST.md:133`, `PROJECT.md:16` | Exceeding request thresholds on `/api/auth/login` (10 req), `/api/admin/auth/login` (5 req), `/api/transactions`, or `/api/gemini` returns HTTP 429 Too Many Requests. |
| **F5** | Multer Pruning & Upload Security | Tier 4 | `T4_DEPENDENCY_AUDIT` | `ORIGINAL_REQUEST.md:134`, `PROJECT.md:17` | `package.json` audited: unused multer pruned or strictly capped at 5MB with MIME whitelist. |
| **F6** | Test PII Assertion Update | Tier 4 | `T4_TEST_ASSERTION_SCAN` | `PROJECT.md:18`, `ORIGINAL_REQUEST.md:149` | `test_full_site.js` and `stress_harness.js` verified free of hardcoded developer email assertions. |
| **F7** | Schema Input Validation | Tier 2 | `T2_INPUT_VAL_AUTH`, `T2_INPUT_VAL_TX_NEG`, `T2_INPUT_VAL_TX_TYPE` | `ORIGINAL_REQUEST.md:137`, `PROJECT.md:19` | Rejects negative transaction amounts, non-numeric amounts, invalid transaction types, and malformed emails with HTTP 400. |
| **F8** | Stored XSS Elimination | Tier 4 | `T4_XSS_DOM_AUDIT` | `ORIGINAL_REQUEST.md:138`, `PROJECT.md:20` | `app.js` and `admin.html` audited for absence of raw unsanitized `innerHTML` string concatenations with user data; `escapeHTML` utilized. |
| **F9** | API Error Normalization | Tier 1, Tier 2 | `T1_AI_FALLBACK_STATUS`, `T2_NORM_ERROR_ENVELOPE` | `ORIGINAL_REQUEST.md:139`, `PROJECT.md:21` | Standard JSON error format `{ "error": ... }`. Upstream AI failures return HTTP 500 or 503 rather than HTTP 200. |
| **F10** | Gemini API Unification | Tier 1, Tier 3 | `T1_AI_QUERY`, `T3_AI_TELEMETRY` | `ORIGINAL_REQUEST.md:140`, `PROJECT.md:22` | Calls to `/api/gemini` route through unified client, redacting PII, logging telemetry with latency and token metrics. |
| **F11** | Modular Server Decomposition | Tier 1, Tier 4 | `T1_SERVER_EXPORTS`, `T4_SERVER_HEALTH` | `ORIGINAL_REQUEST.md:143`, `PROJECT.md:23` | Server runs cleanly; modular routes and middleware re-exported through `server.js` maintaining 100% backward compatibility with test harnesses. |
| **F12** | Frontend Script Extraction | Tier 1, Tier 4 | `T1_STATIC_ASSETS`, `T4_SCRIPT_SEPARATION` | `ORIGINAL_REQUEST.md:144`, `PROJECT.md:24` | `admin.html` script decoupled into dedicated `admin.js`; `startOnboarding` decoupled from `index.html`. |
| **F13** | Bounded Memory & TTL Eviction | Tier 3 | `T3_TELEMETRY_TTL`, `T3_AUDIT_IMMUTABILITY` | `ORIGINAL_REQUEST.md:145`, `PROJECT.md:25` | `memoryDb` maps and telemetry lists implement bounded size limits and 30-day TTL eviction rules. |
| **F14** | Deep Health Diagnostics | Tier 1, Tier 4 | `T1_HEALTH_CHECK`, `T4_DEEP_HEALTH` | `ORIGINAL_REQUEST.md:146`, `PROJECT.md:26` | `GET /api/health` returns HTTP 200 with database status, system uptime, memory usage metrics, and timestamp. |
| **F15** | Package Test Runner Script | Tier 4 | `T4_PKG_SCRIPTS` | `ORIGINAL_REQUEST.md:149`, `PROJECT.md:27` | `package.json` contains `"test": "node test_pivot_validation.js && node test_full_site.js"`. |
| **F16** | CI/CD GitHub Actions Workflow | Tier 4 | `T4_WORKFLOW_FILE` | `ORIGINAL_REQUEST.md:150`, `PROJECT.md:28` | `.github/workflows/test.yml` exists with Node 18/20 test matrix and server health polling. |
| **F17** | Comprehensive API Documentation | Tier 4 | `T4_API_DOCS` | `ORIGINAL_REQUEST.md:151`, `PROJECT.md:29` | `docs/API.md` exists and documents all 12+ public and administrative endpoints. |
| **F18** | E2E Regression & Victory Verification | Tier 1-4 | `ALL_TIERS` | `ORIGINAL_REQUEST.md:164`, `PROJECT.md:30` | Complete test suite executes with 100% pass rate across core validation, security gates, and lifecycle scenarios. |

---

## 4. Test Suite Execution & Invocation

### 4.1 Prerequisites
- **Runtime**: Node.js v18+ or v20+
- **Dependencies**: Built-in standard library (`http`, `https`, `assert`, `fs`, `path`, `crypto`, `child_process`). Uses existing project modules `jsonwebtoken` and `bcryptjs`.
- **Target Server**: Can run against an existing running server (`http://localhost:5000` or custom port) OR automatically spin up an ephemeral background instance on a dynamic open port (`0`).

### 4.2 CLI Commands

```bash
# Run the complete E2E remediation test suite across all 4 tiers
node tests/e2e_remediation_test.js

# Run a specific tier
node tests/e2e_remediation_test.js --tier=1    # Tier 1: Feature Coverage & Happy Path
node tests/e2e_remediation_test.js --tier=2    # Tier 2: Boundary & Corner Cases
node tests/e2e_remediation_test.js --tier=3    # Tier 3: Cross-Feature State Transitions
node tests/e2e_remediation_test.js --tier=4    # Tier 4: Real-World Scenarios & Forensics

# Run against a specific target server URL
node tests/e2e_remediation_test.js --url=http://localhost:5000

# Run in strict exit mode (fails immediately on first error)
node tests/e2e_remediation_test.js --bail
```

### 4.3 Output Format & Exit Semantics
- **Exit Code 0**: All executed assertions and tier verification suites passed cleanly.
- **Exit Code 1**: One or more assertions failed, with detailed failure logs specifying expected vs actual outputs, endpoint, HTTP status, and payload details.
