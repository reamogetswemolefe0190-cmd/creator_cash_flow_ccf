# Project: Creator Cash Flow Comprehensive Remediation

## Architecture
- **Backend Architecture**: Express.js modular architecture decomposed into `routes/`, `controllers/`, `middleware/`, `services/`, and `config/` with root `server.js` orchestrating and re-exporting symbols for complete backward compatibility.
- **Dual-Storage Engine**: PostgREST / Supabase Cloud PostgreSQL with active connectivity diagnostics and bounded, high-reliability local `memoryDb` fallback with automated TTL eviction.
- **Security & PII Subsystem**: Centralized `.env` configuration, strict CORS whitelisting, comprehensive IP/user rate limiters with active timer cleanup and reverse proxy support, and full sanitization of developer PII.
- **Frontend Architecture**: Sanitized DOM manipulation (`escapeHTML`), decoupled JavaScript modules (`admin.js`, `app.js`), dark luxury glassmorphism UI.
- **Unified AI Engine**: Shared `services/geminiService.js` client providing PII masking, query categorization, telemetry logging, and proper HTTP 500/503 error semantics across Express, Vercel, and Netlify.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PII & Secret Sanitization | Remove developer email `reamogetswemolefe0190@gmail.com`, plaintext passwords, fallback secrets from server.js, admin.html, app.js, index.html, stress_harness.js; migrate to .env | M1 | R1, AC1 |
| 2 | Git Ignore Configuration | Add `.env*` to `.gitignore`; verify `git check-ignore -v .env` passes | M1 | R1, AC2 |
| 3 | Explicit CORS Whitelist | Replace wildcard `*` with authorized domain whitelist across server.js and serverless functions | M1 | R1, AC3 |
| 4 | Comprehensive Rate Limiting | Add bounded rate limiters across /api/auth/*, /api/transactions, /api/admin/creators/:id/status, /api/gemini | M1 | R1, AC4 |
| 5 | Multer Pruning & Upload Security | Prune unused multer from package.json or apply strict 5MB cap and MIME whitelist | M1 | R1 |
| 6 | Test PII Assertion Update | Update `test_full_site.js:179` and `stress_harness.js:280` to eliminate hardcoded personal email while asserting secure admin auth | M1 | R1, R4 |
| 7 | Schema Input Validation | Implement validation on transactions, profiles, and auth inputs rejecting invalid types, negative amounts, and oversized strings | M2 | R2 |
| 8 | Stored XSS Elimination | Replace unsafe `innerHTML` with `escapeHTML()` and DOM textContent across `app.js` and `admin.html` | M2 | R2 |
| 9 | API Error Normalization | Standardize JSON error envelopes and return HTTP 500/503 for Gemini AI failures instead of HTTP 200 | M2 | R2 |
| 10 | Gemini API Unification | Unify triplicate implementations into single shared `services/geminiService.js` module | M2 | R2, AC6 |
| 11 | Modular Server Decomposition | Decompose monolithic `server.js` (1,521 lines) into routes, controllers, middleware, services while re-exporting required symbols | M3 | R3, AC5 |
| 12 | Frontend Script Extraction | Extract 884 lines of inline script in `admin.html` into `admin.js`; extract `startOnboarding` from `index.html` | M3 | R3 |
| 13 | Bounded Memory & TTL Eviction | Implement active TTL sweeps and size caps on rate limiters, audit logs, and AI telemetry | M3 | R3 |
| 14 | Deep Health Diagnostics | Upgrade `/api/health` with Supabase connectivity check, memory metrics, uptime, and dependency status | M3 | R3 |
| 15 | Package Test Runner Script | Configure `"test": "node test_pivot_validation.js && node test_full_site.js"` in `package.json` | M4 | R4, AC7 |
| 16 | CI/CD GitHub Actions Workflow | Create `.github/workflows/test.yml` with Node 18/20 matrix, background server health polling, security scans, and test execution | M4 | R4 |
| 17 | Comprehensive API Documentation | Create `docs/API.md` covering all 12 public and admin endpoints | M4 | R4 |
| 18 | E2E Regression & Victory Verification | Pass 100% across all pivot validation tests (37/37), full-site tests (11/11), admin tests (232/232), and clean forensic audit | M5 | AC7, AC8 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Security Hardening & PII Sanitization | Features 1–6: Secrets/PII removal, .gitignore, CORS whitelist, comprehensive rate limiting, Multer audit, test assertion update | none | DONE |
| M2 | Input Sanitization, XSS Elimination & Error Normalization | Features 7–10: Input validation schema, frontend XSS fixes (app.js, admin.html), error normalization (500/503 for AI), unified Gemini client | M1 | DONE |
| M3 | Modular Architecture Refactoring & Memory Safety | Features 11–14: Decompose server.js into routes/controllers/middleware/services, extract admin.js, bounded in-memory TTL maps, deep /api/health | M2 | DONE |
| M4 | QA, Test Automation & CI/CD Pipeline | Features 15–17: package.json test script, .github/workflows/test.yml, docs/API.md | M3 | IN_PROGRESS |
| M5 | Final E2E Test Pass & Hardening | Feature 18: Full test suite pass (npm test), admin test suites, challenger verification, forensic audit | M4 | PLANNED |

## Interface Contracts
### `middleware/validation.js` ↔ Controllers
- `validateSignup`: checks `name` (2-70 chars), `email` (valid regex), `password` (8-128 chars). Returns 400 with `{ success: false, error: "...", code: "INVALID_INPUT" }`.
- `validateTransaction`: checks `type` ('income'|'expense'), `amount` (finite number > 0), `merchant` (sanitized string 1-100 chars).

### `services/geminiService.js` ↔ Controllers & Serverless
- `maskPII(text: string) -> string`: Redacts emails, phone numbers, and ZAR amounts.
- `inferCategoryTag(text: string) -> string`: Returns tax, gear, revenue, or general inquiry.
- `generateContent({ prompt: string, systemContext?: string }) -> Promise<{ text: string, tokensUsed: number, model: string }>`: Throws error with `.statusCode` (503/502) and `.code`.

### `server.js` Compatibility Re-Exports
- Exports: `{ app, server, memoryDb, rateLimitAdminLogin, requireAdmin, adminLoginAttempts, JWT_SECRET, maskPII, inferCategoryTag }`.
