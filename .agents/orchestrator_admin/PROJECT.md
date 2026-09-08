# Project: Creator Cash Flow — Admin Command Portal & Backend API

## Architecture
- **Backend Stack**: Node.js / Express server (`server.js`) with dual-mode operational database (Supabase Cloud PostgreSQL + high-reliability `memoryDb` fallback).
- **Authentication**: Salted `bcryptjs` password hashing, signed `jsonwebtoken` JWTs with explicit `role: 'admin'`, and `requireAdmin` role-checking middleware protecting all `/api/admin/*` endpoints.
- **Frontend Stack**: Standalone `admin.html` featuring dark luxury aesthetic (`#050505`, `#0B0B0B`, 24px radius), Tailwind CSS theme variables, glassmorphic card overlays, Chart.js financial timelines, and interactive DOM modals.
- **Security & Privacy**: Rate-limited admin login, immutable audit trail logging (`audit_logs`), PII-masked AI query telemetry (`ai_telemetry`), and 30-day automated TTL log retention.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Admin Bcrypt & Seed Account | Default seeded admin (`admin@creatorcashflow.com`) with bcrypt hashed password | M1 | R1, R6 |
| F02 | Admin JWT Role Tagging | JWT payload containing `role: 'admin'` and 24h/7d validity | M1 | R1, R6 |
| F03 | Admin Login Endpoint | `POST /api/admin/auth/login` with brute-force rate limiting | M1 | R1, R6 |
| F04 | Role-Protected Middleware | `requireAdmin` middleware returning 401/403 on missing/non-admin JWT | M1 | R1, R6 |
| F05 | DB Schema Extensions | DDL schema & `memoryDb` fallback arrays for `audit_logs` and `ai_telemetry` | M1 | R2, R3 |
| F06 | KPI Metrics API | `GET /api/admin/metrics` returning Total Creators, GPV, MRR, Platform Tax Reserves | M2 | R4, R6 |
| F07 | Revenue Distribution Timeline Logic | Revenue calculations across YouTube, TikTok, Patreon, and Brand Deals | M2 | R4, R6 |
| F08 | Creator Status Mutation API | `POST /api/admin/creators/:id/status` updating status/tier & logging audit entry | M3 | R2, R6 |
| F09 | Audit Logs API | `GET /api/admin/audit-logs` returning chronological administrative trail | M3 | R2, R6 |
| F10 | PII-Safe Telemetry Logging | PII masking (email/phone/ZAR amounts) on Gemini queries in `POST /api/gemini` | M3 | R3, R6 |
| F11 | 30-Day TTL Telemetry Policy | Automated retention TTL filter removing telemetry logs older than 30 days | M3 | R3, R6 |
| F12 | AI Telemetry API | `GET /api/admin/telemetry` returning masked query logs, token usage, latency | M3 | R3, R6 |
| F13 | Admin Portal Theme & Layout | `admin.html` with dark luxury design system (`#050505`, `#0B0B0B`, 24px radius) | M4 | R1, Acceptance |
| F14 | Login Gate UI & Session Management | Admin login overlay, credential validation, session persistence, logout flow | M4 | R1, Acceptance |
| F15 | Executive KPI Scorecards UI | Real-time scorecards displaying Total Creators, GPV, MRR, and Tax Reserves | M4 | R4, Acceptance |
| F16 | Interactive Financial Charts | Chart.js revenue timelines and channel distribution breakdown charts | M4 | R4, Acceptance |
| F17 | Creator Directory Table | Operations table with search, tier tabs (All/Pro/Free), revenue sorting | M5 | R5, Acceptance |
| F18 | Creator Detail Inspection Modal | Interactive modal displaying ledger snapshot, plan toggle, and suspend/reactivate | M5 | R5, Acceptance |
| F19 | Audit Trail View Tab | Chronological audit trail UI view with event filtering | M6 | R2, Acceptance |
| F20 | AI Telemetry View Tab | AI telemetry UI view displaying token metrics, latency, model source, masked query | M6 | R3, Acceptance |
| F21 | E2E Test Suite & Verification | Automated verification script testing auth, 401/403, KPIs, audit log, search | M7 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Auth Core & DB Extensions | `requireAdmin`, login route, seeded admin, DB schemas for audit & telemetry | None | DONE |
| M2 | Platform KPI Scorecards API | `GET /api/admin/metrics` endpoint and financial aggregation logic | M1 | DONE |
| M3 | Audit Logging & PII Telemetry API | Creator status mutation API, audit trail logging, PII-masked AI query telemetry | M1 | IN_PROGRESS |
| M4 | Admin Portal UI - Login & KPI Dashboard | `admin.html` dark luxury layout, login gate, KPI cards, Chart.js timelines | M1, M2 | PLANNED |
| M5 | Admin Portal UI - Creator Operations Table | Searchable, filterable creator table & detail modal with status mutation controls | M3, M4 | PLANNED |
| M6 | Admin Portal UI - Audit Trail & Telemetry Views | Chronological Audit Trail tab & PII-masked AI Telemetry tab in `admin.html` | M3, M4 | PLANNED |
| M7 | E2E Test Suite & Final System Verification | `test_admin_suite.js` automated script validating full-stack portal | M1-M6 | PLANNED |

## Interface Contracts
### `POST /api/admin/auth/login`
- **Request**: `{ "email": "admin@creatorcashflow.com", "password": "<password>" }`
- **Response**: `{ "success": true, "token": "<JWT_TOKEN>", "admin": { "id": "admin-1", "email": "..." } }`
- **Error**: HTTP 401 `{ "error": "Invalid credentials" }` or HTTP 429 `{ "error": "Too many login attempts" }`

### `GET /api/admin/metrics`
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Response**: `{ "totalCreators": 42, "gpvZar": 1250000, "mrrZar": 85000, "taxReservesZar": 187500, "channelBreakdown": { "youtube": 450000, "tiktok": 300000, "patreon": 250000, "brand_deals": 250000 }, "timeline": [...] }`

### `POST /api/admin/creators/:id/status`
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Request**: `{ "status": "suspended" | "active", "plan_tier": "Pro" | "Free", "note": "Reason" }`
- **Response**: `{ "success": true, "creator": {...}, "audit_entry": {...} }`

### `GET /api/admin/audit-logs`
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Response**: `[ { "id": "1", "admin_id": "...", "target_creator_id": "...", "action_type": "STATUS_CHANGE", "old_value": "active", "new_value": "suspended", "timestamp": "...", "ip_hash": "..." } ]`

### `GET /api/admin/telemetry`
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Response**: `[ { "id": "1", "category_tag": "Tax Deduction Strategy", "prompt_masked": "How do I deduct [REDACTED_ZAR] for gear?", "tokens_used": 340, "model": "gemini-1.5-flash", "latency_ms": 420, "created_at": "..." } ]`

## Code Layout
- `server.js`: Express application with backend auth, requireAdmin middleware, admin routes, DB logic, and fallback array structures.
- `admin.html`: Standalone Admin Command Portal single-page web app.
- `style.css`: Shared glassmorphic design system and Tailwind theme extensions.
- `database_setup.sql`: Database schema definition for Supabase PostgreSQL.
- `test_admin_suite.js`: Automated E2E verification test suite.
