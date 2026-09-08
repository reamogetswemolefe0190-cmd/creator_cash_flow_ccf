# Explorer Survey 2 Handoff Report

## 1. Observation
Direct, verifiable observations from codebase inspection of `server.js`, `database_setup.sql`, `package.json`, `.env.example`, and performance test scripts (`test_metrics_concurrency.js`, `test_admin_metrics_stress.js`):

1. **Database Client Setup (`server.js`, lines 19-30)**:
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
   Package `@supabase/supabase-js` is version `^2.39.0` (`package.json`, line 11). `createClient` is instantiated once at module load without custom HTTPS agents, custom pool limits, or socket keep-alive options.

2. **In-Memory Backup Structure (`server.js`, lines 31-39)**:
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

3. **Database Schema & Missing Indexes (`database_setup.sql`)**:
   - `users`: PRIMARY KEY (`id`), UNIQUE (`email`).
   - `transactions`: PRIMARY KEY (`id`), FOREIGN KEY (`user_id` REFERENCES `users(id)` ON DELETE CASCADE).
   - `onboarding_responses`: PRIMARY KEY (`user_id`).
   - `admin_users`: PRIMARY KEY (`id`), UNIQUE (`email`).
   - `audit_logs`: PRIMARY KEY (`id`).
   - `ai_telemetry`: PRIMARY KEY (`id`).
   - **Observed Absence**: Zero `CREATE INDEX` statements exist in `database_setup.sql`. Specifically, `transactions.user_id`, `transactions.created_at`, `users.created_at`, `audit_logs.timestamp`, and `ai_telemetry.created_at` lack B-tree indexes.

4. **Query Behaviors & Dual-Storage Inconsistency (`server.js`)**:
   - `GET /api/admin/metrics` (lines 585-592):
     ```javascript
     if (supabase) {
         const { data: usersData, error: uErr } = await supabase.from('users').select('*');
         if (uErr) throw uErr;
         users = usersData || [];

         const { data: txData, error: tErr } = await supabase.from('transactions').select('*');
         if (tErr) throw tErr;
         transactions = txData || [];
     }
     ```
     Executes full table scans (`select('*')`) on both `users` and `transactions` tables without filtering, streaming all records over HTTP to aggregate in JS memory. If `uErr` or `tErr` occurs, it throws an unhandled error returning HTTP 500 without falling back to `memoryDb`.
   - `POST /api/auth/signup` (lines 334-367) & `POST /api/transactions` (lines 995-1000):
     Uses `if (supabase) { ... } else { ... }`. When `supabase` is non-null, write operations occur ONLY in Supabase and are NOT written to `memoryDb`.
   - `GET /api/admin/creators` (lines 720-742), `GET /api/admin/audit-logs` (lines 889-894), `GET /api/admin/telemetry` (lines 913-925):
     Attempt to read from Supabase first; if Supabase returns an error or no data, they dynamically fall back to reading from `memoryDb`.

---

## 2. Logic Chain

1. **Premise 1**: `@supabase/supabase-js` uses PostgREST over HTTPS. Connections are managed upstream by Supabase (PgBouncer/Supavisor), while Node client side uses default `http.globalAgent` without explicit socket pool limits or exponential backoff retry configuration.
2. **Premise 2**: Under heavy concurrent user load (100–200 parallel users requesting `GET /api/transactions`), PostgreSQL must resolve queries for each user.
3. **Step A**: Because `database_setup.sql` does NOT define a B-tree index on `transactions.user_id`, PostgreSQL is forced to execute full table Sequential Scans for every `GET /api/transactions` query.
4. **Step B**: Executing 150+ concurrent Sequential Scans rapidly consumes database CPU and PostgREST connection slots, elevating response latencies and triggering gateway timeouts or 503/504 connection errors.
5. **Step C**: When Supabase PostgREST queries fail, endpoints like `GET /api/admin/metrics` and `GET /api/transactions` throw unhandled errors, returning HTTP 500 responses to clients rather than falling back to `memoryDb`.
6. **Step D**: Furthermore, because `signup` and `POST /api/transactions` perform single-branch writes (`if (supabase) ... else ...`), data created while Supabase is online is never mirrored to `memoryDb`. If secondary fallback endpoints (`GET /api/admin/creators`) fall back to `memoryDb` during a Supabase outage, they return stale/outdated initial seed data, creating data drift.

---

## 3. Caveats

- **External Supabase Instance Configuration**: The exact PgBouncer pool size (e.g. 20 vs 60 connection limit) configured in the remote Supabase cloud dashboard (`https://iekofqagtcztyavhunai.supabase.co`) was not directly inspectable via local code view; analysis is based on standard Supabase default tier behaviors.
- **Node Environment**: Benchmarks and code inspection assume standard Node.js runtime (v18+ / v20+) executing Express.

---

## 4. Conclusion

The Creator Cash Flow backend features a working dual-database setup (Supabase Cloud + `memoryDb`), but exhibits three major structural vulnerabilities under high concurrent load:
1. **Critical Missing Indexing**: Missing B-tree index on `transactions.user_id` causes PostgreSQL sequential scans during user transaction reads under concurrency.
2. **In-Memory Full Table Aggregation**: `GET /api/admin/metrics` fetches all users and transactions raw over HTTP instead of leveraging SQL server-side aggregation (`SUM`, `COUNT`, `GROUP BY`).
3. **Dual-Storage Synchronization & Fallback Asymmetry**: Single-write branching on signup/transactions creates data drift between Supabase and `memoryDb`, while fallback behavior on query failure is inconsistent across routes.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Missing Indexes in SQL Schema**:
   Inspect `database_setup.sql` to confirm no `CREATE INDEX` statements exist for `transactions.user_id`, `users.created_at`, or `audit_logs.timestamp`:
   ```bash
   grep -i "CREATE INDEX" database_setup.sql
   ```
   *Expected result*: No matches found.

2. **Verify Full Table Scan Behavior in `GET /api/admin/metrics`**:
   Inspect `server.js` at lines 585–593:
   ```bash
   node -e "const fs = require('fs'); const content = fs.readFileSync('server.js','utf8'); console.log(content.includes('supabase.from(\'users\').select(\'*\')'));"
   ```
   *Expected result*: `true`.

3. **Verify Concurrency Benchmark Harness**:
   Execute the existing concurrency test harness:
   ```bash
   node test_metrics_concurrency.js
   ```
   *Expected result*: Validates response latencies and status codes across parallel requests.
