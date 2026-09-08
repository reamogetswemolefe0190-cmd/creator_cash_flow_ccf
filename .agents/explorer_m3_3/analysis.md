# Milestone M3 Technical Analysis & Implementation Strategy: Audit Logging & PII Telemetry API

## Executive Summary
This document outlines the complete technical architecture and implementation strategy for **Milestone M3: Audit Logging & PII Telemetry API** of the Creator Cash Flow Admin Portal & Backend API. M3 introduces cryptographically enforced administrative mutations, immutable audit trail logging, PII-masked AI query telemetry with automated 30-day retention policies, and administrative telemetry endpoints.

---

## 1. Baseline Observations & Project State

### 1.1 Backend Architecture (`server.js`)
- **Server Framework**: Node.js / Express server (`server.js`, 1021 lines).
- **Dual Database Pattern**: Supabase Cloud PostgreSQL client (`supabase`) with `memoryDb` fallback arrays for offline/testing environments:
  ```javascript
  const memoryDb = {
      users: [],
      transactions: [],
      onboarding: [],
      adminUsers: [],
      audit_logs: [],
      ai_telemetry: []
  };
  ```
- **Admin Middleware**: `requireAdmin` (lines 204-222) verifies JWT `Authorization: Bearer <token>` and enforces `decoded.role === 'admin'`. Rejects unauthenticated requests with `401 Access token required` / `401 Invalid or expired token` and unauthorized requests with `403 Forbidden: Administrative privileges required`.
- **Existing Admin Endpoints (M1 & M2)**:
  - `POST /api/admin/auth/login` (Admin login with rate limiting)
  - `GET /api/admin/verify-auth` (Admin token verification)
  - `GET /api/admin/metrics` (Platform KPI scorecards & revenue telemetry)
- **Target Handler for Telemetry**:
  - `POST /api/gemini` (lines 960-1001) is currently a basic proxy for Gemini 1.5 Flash without PII masking or telemetry storage.

### 1.2 Schema Definition (`database_setup.sql`)
- **Audit Logs Table (`public.audit_logs`)** (lines 62-74):
  ```sql
  CREATE TABLE IF NOT EXISTS public.audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      target_creator_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
      ip_hash TEXT
  );
  ```
- **AI Telemetry Table (`public.ai_telemetry`)** (lines 77-88):
  ```sql
  CREATE TABLE IF NOT EXISTS public.ai_telemetry (
      id TEXT PRIMARY KEY,
      category_tag TEXT NOT NULL,
      prompt_masked TEXT NOT NULL,
      tokens_used INT DEFAULT 0,
      model TEXT DEFAULT 'gemini-1.5-flash',
      latency_ms INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
  );
  ```

---

## 2. Technical Implementation Specifications for M3

### Component 1: `POST /api/admin/creators/:id/status` (Creator Status & Plan Mutation)
- **Security**: Guarded by `requireAdmin` middleware.
- **Route Parameters**: `:id` (creator ID, e.g. `usr_seed_1`).
- **Request Body**:
  ```json
  {
    "status": "active" | "suspended",
    "plan_tier": "Pro" | "Free",
    "note": "Optional administrative note"
  }
  ```
- **Validation Rules**:
  - Rejects with HTTP 400 if neither `status` nor `plan_tier` is provided.
  - Rejects with HTTP 400 if `status` is not `"active"` or `"suspended"`.
  - Rejects with HTTP 400 if `plan_tier` is not `"Pro"` or `"Free"`.
- **Creator Lookup & State Capture**:
  - Fetch target creator from Supabase `users` table or `memoryDb.users`.
  - If not found, return HTTP 404 `{ "error": "Creator not found" }`.
  - Capture pre-mutation state (`old_value`):
    ```json
    { "status": "active", "plan_tier": "Pro" }
    ```
- **Mutation & Audit Entry Insertion**:
  - Update target creator record in Supabase / `memoryDb.users`.
  - Compute SHA256 IP hash from request IP:
    ```javascript
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const ip_hash = crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 16);
    ```
  - Determine `action_type`:
    - Both changed: `"STATUS_AND_TIER_CHANGE"`
    - Status changed: `"STATUS_CHANGE"`
    - Plan tier changed: `"TIER_CHANGE"`
  - Construct audit record:
    ```javascript
    const auditEntry = {
        id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
        admin_id: req.admin.id || req.admin.email,
        target_creator_id: req.params.id,
        action_type: actionType,
        old_value: JSON.stringify(oldValueObj),
        new_value: JSON.stringify(newValueObj),
        timestamp: new Date().toISOString(),
        ip_hash: ip_hash
    };
    ```
  - Write audit record to Supabase `audit_logs` table AND `memoryDb.audit_logs` (with fallback alias `memoryDb.auditLogs = memoryDb.audit_logs`).
- **Response Payload (HTTP 200)**:
  ```json
  {
    "success": true,
    "message": "Creator account status updated successfully",
    "creator": {
      "id": "usr_seed_1",
      "name": "Naledi Molefe",
      "email": "naledi@creator.co.za",
      "plan_tier": "Free",
      "status": "suspended"
    },
    "audit_entry": auditEntry
  }
  ```

---

### Component 2: `GET /api/admin/audit-logs` (Audit Log Query API)
- **Security**: Guarded by `requireAdmin` middleware.
- **Data Source**: Supabase `audit_logs` table ordered by `timestamp` descending, falling back to `memoryDb.audit_logs`.
- **Response Payload (HTTP 200)**:
  ```json
  [
    {
      "id": "audit_1723059000000_a1b2",
      "admin_id": "admin_seed_1",
      "target_creator_id": "usr_seed_10",
      "action_type": "STATUS_CHANGE",
      "old_value": "{\"status\":\"active\",\"plan_tier\":\"Pro\"}",
      "new_value": "{\"status\":\"suspended\",\"plan_tier\":\"Pro\",\"note\":\"Policy review\"}",
      "timestamp": "2026-08-07T19:22:00.000Z",
      "ip_hash": "e3b0c44298fc1c14"
    }
  ]
  ```

---

### Component 3: PII Masking & AI Query Telemetry in `POST /api/gemini`
- **PII Sanitization Utility (`maskPII(text)`)**:
  1. **Email Masking**:
     - Pattern: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi`
     - Replacement: `[REDACTED_EMAIL]`
  2. **ZAR Currency Masking**:
     - Pattern: `/(?:ZAR|R)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b|\b(?:ZAR|R)\s?\d+(?:\.\d{2})?\b/gi`
     - Replacement: `[REDACTED_ZAR]`
     - Handles formats: `R1,500`, `ZAR 5000`, `R500`, `R1 500`, `R500.00`, `ZAR 5,000`.
  3. **Phone Number Masking**:
     - Pattern: `/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g` with digit length check (7-15 digits).
     - Replacement: `[REDACTED_PHONE]`
- **Category Tag Classifier (`inferCategoryTag(prompt)`)**:
  - Tax/Deduction/SARS -> `"Tax Deduction Strategy"`
  - Gear/Equipment/Camera/Lens -> `"Gear Purchase Planning"`
  - YouTube/TikTok/Patreon/AdSense -> `"Revenue Optimization"`
  - Budget/Cash Flow/Expense -> `"Cash Flow & Budgeting"`
  - Fallback -> `"General Financial Query"`
- **Telemetry Record Construction**:
  ```javascript
  const telemetryEntry = {
      id: 'tel_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      category_tag: categoryTag,
      prompt_masked: maskedPrompt,
      tokens_used: tokensUsed,
      model: 'gemini-1.5-flash',
      latency_ms: latencyMs,
      created_at: new Date().toISOString()
  };
  ```
- **30-Day Automated Retention TTL Policy**:
  - Cutoff timestamp: `Date.now() - (30 * 24 * 60 * 60 * 1000)`.
  - Filter `memoryDb.ai_telemetry` array to exclude entries older than 30 days.
  - Execute background purge in Supabase: `DELETE FROM ai_telemetry WHERE created_at < cutoff`.

---

### Component 4: `GET /api/admin/telemetry` (AI Telemetry Query API)
- **Security**: Guarded by `requireAdmin` middleware.
- **TTL Filter Enforcement**: Purges/filters entries older than 30 days before returning.
- **Response Payload (HTTP 200)**:
  ```json
  [
    {
      "id": "tel_1723059000000_f1a2",
      "category_tag": "Tax Deduction Strategy",
      "prompt_masked": "How do I write off [REDACTED_ZAR] gear for [REDACTED_EMAIL]?",
      "tokens_used": 184,
      "model": "gemini-1.5-flash",
      "latency_ms": 340,
      "created_at": "2026-08-07T19:22:00.000Z"
    }
  ]
  ```

---

### Component 5: `GET /api/admin/creators` (Creator Directory API)
- **Security**: Guarded by `requireAdmin` middleware.
- **Data Source**: Returns all creators from Supabase `users` table or `memoryDb.users` with linked revenue calculations.
- **Response Payload (HTTP 200)**:
  ```json
  [
    {
      "id": "usr_seed_1",
      "name": "Naledi Molefe",
      "email": "naledi@creator.co.za",
      "plan_tier": "Pro",
      "status": "active",
      "created_at": "2026-02-15T10:00:00.000Z",
      "total_revenue": 100000.00
    }
  ]
  ```

---

## 3. Unit Testing Strategy (`test_admin_m3.js`)
To verify M3 functionality and prevent regressions, `test_admin_m3.js` will execute 10 comprehensive tests:
1. `POST /api/admin/creators/:id/status` rejection without JWT (HTTP 401).
2. `POST /api/admin/creators/:id/status` rejection with creator JWT (HTTP 403).
3. Successful creator status mutation (`active` -> `suspended`) & audit log entry creation.
4. Successful creator plan tier mutation (`Free` -> `Pro`) & audit log entry creation.
5. Creator mutation 404 handling for invalid creator ID.
6. `GET /api/admin/audit-logs` verification of chronological audit trail structure and IP hashing.
7. `POST /api/gemini` PII masking verification for email (`[REDACTED_EMAIL]`), phone (`[REDACTED_PHONE]`), and ZAR currency (`[REDACTED_ZAR]`).
8. `POST /api/gemini` category tag classification verification.
9. `GET /api/admin/telemetry` retrieval of masked telemetry entries.
10. Automated 30-Day TTL retention policy verification (confirming records > 30 days old are excluded).

---

## 4. Architectural Verification Plan
- Run `node test_admin_m3.js` to assert all 10 unit test cases.
- Run previous milestone test suites (`node test_admin_auth.js` and `node test_admin_metrics.js`) to guarantee backward compatibility and zero regressions.
