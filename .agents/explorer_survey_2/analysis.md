# Creator Cash Flow Backend: Database Architecture, Connection Setup, Pooling & Query Analysis

**Executive Summary**:
This report presents a thorough survey of the database connection setup, pooling parameters, Supabase Cloud PostgreSQL integration, local memory backup mechanisms, and DB query behaviors in the Creator Cash Flow (CCF) Express/Node.js backend (`server.js` and `database_setup.sql`). The investigation identifies key architecture patterns, query performance bottlenecks, missing indexes, transaction atomicity risks, and potential connection pooling vulnerabilities under high concurrency (100–200 parallel users).

---

## 1. Database Architecture & Setup

### 1.1 Dual-Database Strategy
The Creator Cash Flow backend operates on a hybrid dual-database architecture:
1. **Primary Cloud Database**: **Supabase Cloud PostgreSQL** (`https://iekofqagtcztyavhunai.supabase.co`) accessed via the official `@supabase/supabase-js` client SDK (`v2.39.0`).
2. **Secondary High-Reliability Fallback**: **In-Memory Database (`memoryDb`)**, initialized as a Node.js JavaScript object containing stateful arrays (`users`, `transactions`, `onboarding`, `adminUsers`, `audit_logs`, `ai_telemetry`).

### 1.2 Database Initialization (`server.js`, Lines 19–39)
- **Supabase Client Setup**:
  ```javascript
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iekofqagtcztyavhunai.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  let supabase = null;

  if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== 'your-supabase-anon-key') {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('🔌 Connected to Supabase Cloud Database: ' + SUPABASE_URL);
  } else {
      console.log('⚠️ Supabase credentials not fully configured. Running in high-reliability Memory Backup Mode.');
  }
  ```
- **In-Memory Database Fallback Setup**:
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

### 1.3 Database Schema & Indexing (`database_setup.sql`)
The PostgreSQL schema defines 6 relational tables:
1. `public.users`: `id` (PK), `email` (UNIQUE), `password_hash`, `name`, `phyllo_user_id`, `plan_tier`, `status`, `created_at`.
2. `public.transactions`: `id` (PK), `user_id` (FK to `users.id` ON DELETE CASCADE), `date`, `source`, `merchant`, `type`, `category`, `tax_status`, `amount` (`NUMERIC(12,2)`), `created_at`.
3. `public.onboarding_responses`: `user_id` (PK, FK to `users.id`), `creator_type`, `platforms`, `goal`, `created_at`.
4. `public.admin_users`: `id` (PK), `email` (UNIQUE), `password_hash`, `role`, `created_at`.
5. `public.audit_logs`: `id` (PK), `admin_id`, `target_creator_id`, `action_type`, `old_value`, `new_value`, `timestamp`, `ip_hash`.
6. `public.ai_telemetry`: `id` (PK), `category_tag`, `prompt_masked`, `tokens_used`, `model`, `latency_ms`, `created_at`.

**Security (RLS)**: Row Level Security is enabled on all 6 tables with open policies (`"Allow public read/write during beta"`: `USING (true) WITH CHECK (true)`).

---

## 2. Connection Pooling Configurations & Parameters

### 2.1 Connection Architecture
- `@supabase/supabase-js` communicates over **HTTPS REST requests (PostgREST API)** via standard HTTP `fetch`.
- It does **not** create or manage a persistent TCP socket pool via Node `pg` / `pg.Pool`.
- Connection pooling for database queries is managed upstream at the Supabase Cloud Infrastructure tier via **PgBouncer / Supavisor**.

### 2.2 Client-Side Pooling Parameters
- **`maxConnections` / `maxSockets`**: Not explicitly configured on the `createClient` call in `server.js`. Uses Node's default HTTP agent (`http.globalAgent` / `https.globalAgent`), which defaults to unlimited sockets or standard environment defaults.
- **`idleTimeout` / `connectionTimeout`**: Default Supabase REST client timeouts apply. No application-level socket timeout or keep-alive agent is attached.
- **Retry Strategy & Failover**: `@supabase/supabase-js` standard HTTP client does not automatically execute retry logic with exponential backoff on transient 503/504 connection errors.

---

## 3. Local Memory Backup Architecture & Dual-Storage Mechanics

### 3.1 Initial Startup Fallback vs. Dynamic Runtime Fallback
- **Static Startup Fallback**: If Supabase credentials are missing or default (`your-supabase-anon-key`), `supabase` remains `null` and the server runs 100% in `memoryDb` mode.
- **Dynamic Runtime Fallback Inconsistency**:
  - **Endpoints with Dynamic Fallback**:
    - `GET /api/admin/creators` (lines 720-742): If Supabase returns an error (`!error && data`), it falls back to returning creators from `memoryDb`.
    - `GET /api/admin/audit-logs` (lines 889-894): Falls back to sorting and returning `memoryDb.audit_logs`.
    - `GET /api/admin/telemetry` (lines 913-925): Falls back to filtering and returning `memoryDb.ai_telemetry`.
    - `POST /api/admin/auth/login` (lines 514-537): Checks Supabase first; if not found or error, checks `memoryDb.adminUsers`.
  - **Endpoints WITHOUT Dynamic Fallback**:
    - `GET /api/admin/metrics` (lines 585-588): If Supabase returns `uErr` or `tErr`, code executes `throw uErr`, causing an uncaught exception that returns HTTP 500 (`Failed to compute platform KPI metrics`).
    - `GET /api/transactions` (lines 944-951): Throws `error` on Supabase query failure, returning HTTP 500 (`Failed to retrieve ledger data`).
    - `POST /api/transactions` (line 997): Throws `error` on Supabase insert failure, returning HTTP 500.
    - `POST /api/auth/login` (line 455): On Supabase query error, returns HTTP 401 (`Invalid email or password`).
    - `POST /api/auth/signup` (line 349): Throws `error`, returning HTTP 500.

### 3.2 Dual-Write Data Synchronization & Drift Risk
- **Dual-Write Endpoints**:
  - `POST /api/admin/creators/:id/status` writes to Supabase inside `try/catch` and unconditionally updates `memoryDb.users` and `memoryDb.audit_logs`.
  - `POST /api/gemini` inserts to Supabase `ai_telemetry` inside `try/catch` and unconditionally pushes to `memoryDb.ai_telemetry`.
- **Single-Write Branching Endpoints (`if (supabase) ... else ...`)**:
  - `POST /api/auth/signup` inserts new users and default transactions into Supabase **only** when `supabase` is active. It does NOT write to `memoryDb.users` or `memoryDb.transactions`.
  - `POST /api/transactions` inserts new transactions into Supabase **only** when `supabase` is active.
- **Data Drift Vulnerability**: If Supabase becomes temporarily unreachable mid-operation, any route falling back to `memoryDb` will serve outdated seed data because user registrations and transactions created while Supabase was online were never mirrored to `memoryDb`.

---

## 4. Database Query Behaviors, Bottlenecks & Indexing

### 4.1 Route-by-Route Query Analysis

| Endpoint Route | Supabase Queries Executed | In-Memory Operations / Processing | Potential Bottlenecks & Concerns |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/signup` | 1. `users.select('id').eq('email')`<br>2. `users.insert(...)`<br>3. `transactions.insert(...)` (5 seed rows) | Hashes password (`bcrypt`), generates random user ID, sends Resend email | **3 discrete HTTP round-trips**. Non-atomic: if transaction insert fails, user record remains in DB. |
| `POST /api/auth/login` | `users.select('*').eq('email').single()` | Compares password (`bcrypt.compare`), signs JWT | Fast unique index lookup. Error returns 401 instead of 500 on DB failure. |
| `POST /api/admin/auth/login` | `admin_users.select('*').eq('email').maybeSingle()` | Compares password (`bcrypt.compare`), signs JWT | Checks Supabase then memoryDb. Fast unique index lookup. |
| `GET /api/admin/metrics` | 1. `users.select('*')`<br>2. `transactions.select('*')` | Aggregates totalCreators, GPV, MRR, 15% tax reserves, channel breakdown, and 6-month growth timeline in JS loop | **CRITICAL BOTTLENECK**: Performs **full table scans** on both `users` and `transactions` tables. Pulls all raw data over PostgREST HTTP into Node.js memory on every request. |
| `GET /api/admin/creators` | `users.select('*').order('created_at', { ascending: false })` | Maps columns to array | **Full table scan** on `users`. No pagination (`LIMIT`/`OFFSET`). `created_at` lacks B-tree index. |
| `POST /api/admin/creators/:id/status` | 1. `users.select('*').eq('id')`<br>2. `audit_logs.insert(...)`<br>3. `users.update(...)` | Validates input, hashes IP address (`SHA256`) | **3 discrete HTTP round-trips**. Non-atomic: if user update fails after audit log insert, audit trail records a false mutation. |
| `GET /api/transactions` | `transactions.select('*').eq('user_id').order('created_at', { ascending: false })` | Maps columns to array | **CRITICAL INDEX MISSING**: No B-tree index on `transactions.user_id`. Triggers Sequential Scan on PostgreSQL per query. |
| `POST /api/transactions` | `transactions.insert(...)` | Generates transaction ID, formats date | 1 HTTP insert. Primary key indexed. |
| `POST /api/onboarding/save` | `onboarding_responses.upsert(...)` | Formats payload | Primary key `user_id` indexed. |
| `POST /api/gemini` | `ai_telemetry.insert(...)` | Masks PII (email, phone, ZAR), infers category tag | Asynchronous insert with `try/catch`. |

### 4.2 Critical Indexing Deficits (`database_setup.sql`)
1. **`transactions.user_id`**: **MISSING INDEX**. Querying `GET /api/transactions` executes a full table sequential scan in PostgreSQL.
2. **`transactions(user_id, created_at DESC)`**: **MISSING INDEX**. No composite index for ordering transactions by date per user.
3. **`users.created_at`**: **MISSING INDEX**. Querying `GET /api/admin/creators` orders by `created_at` without an index.
4. **`audit_logs.timestamp`**: **MISSING INDEX**. `GET /api/admin/audit-logs` sorts by timestamp without an index.
5. **`ai_telemetry.created_at`**: **MISSING INDEX**. `GET /api/admin/telemetry` filters by 30-day TTL (`gte('created_at', cutoff)`) without an index.

### 4.3 Transaction Isolation & Atomicity
- None of the multi-step database operations (signup + seed transactions; admin status change + audit log insert) use PostgreSQL transactions (`BEGIN ... COMMIT`).
- Every PostgREST call is an isolated HTTP request. Network glitches or server crashes during multi-step calls can leave orphan user accounts or orphan audit log entries.

---

## 5. Pooling Vulnerabilities & Failure Modes under High Concurrency (100–200 Parallel Users)

1. **Sequential Scan CPU Saturation**:
   - Under a concurrent load of 150 parallel users executing `GET /api/transactions`, PostgreSQL will spawn 150 concurrent sequential table scans due to the missing index on `transactions.user_id`.
   - CPU utilization on the database instance will spike to 100%, forcing query latencies to exceed 1000ms+ and leading to PostgREST HTTP gateway timeouts (504 Gateway Timeout).
2. **HTTP Socket Exhaustion**:
   - Node's default HTTP agent without persistent keep-alive pooling can exhaust available socket handles or ephemeral ports under high-frequency request bursts (200 req/sec), resulting in `ECONNRESET` or `ETIMEDOUT` errors.
3. **Unhandled Supabase Query Errors & Cascading 500s**:
   - Because `GET /api/admin/metrics` and `GET /api/transactions` do not catch Supabase query errors to activate `memoryDb` fallback, any PostgREST pool saturation or timeout immediately manifests as HTTP 500 server errors to end users.

---

## 6. Recommended Optimization Roadmap

1. **Add Required Database Indexes**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
   CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
   CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created_at ON public.ai_telemetry(created_at DESC);
   ```
2. **Server-Side Aggregations for Admin Metrics**:
   - Replace in-memory full table scanning in `GET /api/admin/metrics` with PostgreSQL aggregation queries (`SUM`, `COUNT`) or a dedicated Supabase RPC function.
3. **Standardized Dual-Writing & Fallback Logic**:
   - Ensure all write endpoints (`signup`, `transactions`) mirror writes to `memoryDb` so that secondary fallback reads always serve complete, up-to-date data.
   - Wrap Supabase reads in uniform `try/catch` handlers that gracefully fall back to `memoryDb` on network or pool failure.
4. **Custom HTTP Agent with Connection Pooling**:
   - Configure `@supabase/supabase-js` with a custom Node `https.Agent` featuring `keepAlive: true` and `maxSockets: 500` to prevent socket exhaustion during load spikes.
