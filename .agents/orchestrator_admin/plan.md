# Execution Plan — Creator Cash Flow Admin Portal & Backend API

## Overview
Decompose and build a secure, standalone Admin Command Portal (`admin.html`) and backend API integration (`server.js`) for Creator Cash Flow featuring:
1. Cryptographically enforced admin authentication & session security (R1)
2. Immutable admin action audit logging (R2)
3. PII-safe AI query telemetry & privacy retention (R3)
4. Platform KPI scorecards & financial telemetry (R4)
5. Creator management & operations table (R5)
6. Full-stack backend integration & role-protected middleware in `server.js` (R6)
7. Requirement-driven E2E test suite & automated verification script

## Milestone Roadmap & Verification Plan
- **Milestone M1**: Backend Auth Core & DB Extensions (F01–F05)
  - Implement `requireAdmin` middleware, `POST /api/admin/auth/login`, seeded admin user, rate limiting, and DB schemas for `audit_logs` and `ai_telemetry`.
  - Gate checks: Unit tests for admin auth & 401/403 rejection.

- **Milestone M2**: Platform KPI Scorecards API (F06–F07)
  - Implement `GET /api/admin/metrics` endpoint with aggregated GPV (ZAR), MRR, Tax Reserves, and channel breakdown timeline.
  - Gate checks: Verification of metric calculations and JSON schema response.

- **Milestone M3**: Audit Logging & PII Telemetry API (F08–F12)
  - Implement `POST /api/admin/creators/:id/status` (with audit log insertion), `GET /api/admin/audit-logs`, PII masking in `POST /api/gemini`, 30-day retention TTL, and `GET /api/admin/telemetry`.
  - Gate checks: Audit entry verification on creator status changes & PII masking regex validation.

- **Milestone M4**: Admin Portal UI - Login & KPI Dashboard (F13–F16)
  - Build `admin.html` with dark luxury aesthetic, dedicated login gate, active session validation, live KPI scorecards, and Chart.js timelines.
  - Gate checks: Visual rendering & auth session persistence.

- **Milestone M5**: Admin Portal UI - Creator Operations Table (F17–F18)
  - Implement Creator Directory table in `admin.html` with real-time search, plan filtering tabs (All/Pro/Free), revenue sorting, and interactive Detail Modal.
  - Gate checks: Search responsiveness & status mutation integration.

- **Milestone M6**: Admin Portal UI - Audit Trail & Telemetry Views (F19–F20)
  - Implement "Audit Trail" tab and "AI Telemetry" tab views in `admin.html`.
  - Gate checks: Chronological log display & telemetry metric rendering.

- **Milestone M7**: E2E Test Suite & Final System Verification (F21)
  - Create `test_admin_suite.js` to execute automated end-to-end testing across all admin API endpoints and portal flows.
  - Gate checks: 100% pass rate on E2E test suite & clean forensic audit.

## Execution Iteration Loop (Per Milestone)
1. **Explorer**: Technical investigation & implementation strategy.
2. **Worker**: Code implementation with explicit write boundaries & automated unit tests.
3. **Reviewer & Challenger**: Independent code review & adversarial execution testing.
4. **Forensic Auditor**: Binary veto integrity verification.
5. **Gate Evaluation**: Documented in `GATE_STATUS.md`.
