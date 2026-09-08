# Technical Environment & Load Benchmark Infrastructure Survey

## Executive Summary

This survey provides a comprehensive technical breakdown of the Creator Cash Flow (CCF) backend architecture, environment configuration, server runtime options, installed dependencies, and existing benchmark infrastructure. It establishes the architectural foundation and harness design specifications for building a custom, high-concurrency Node.js load testing system capable of benchmarking the backend under 100–200 concurrent creator user workloads.

---

## 1. Environment & Configuration Survey

### 1.1 Configuration Parameters & Defaults (`server.js` & `.env.example`)
The CCF backend (`server.js`) utilizes `dotenv` to load environment variables from a `.env` file at startup. Currently, no `.env` file exists in the workspace root, so `server.js` relies on hardcoded fallback values for development and testing.

| Environment Variable | Configured / Default Value | Usage in Code | Fallback Behavior |
| --- | --- | --- | --- |
| `PORT` | `5000` | Server listening TCP port (`const PORT = process.env.PORT \|\| 5000`) | Listens on port `5000` |
| `NODE_ENV` | `production` (in `.env.example`) | Node execution environment | Defaults to standard Node environment |
| `JWT_SECRET` | `'fallback-creator-cashflow-secret-key-2026'` | Cryptographic signing secret for user & admin JWT tokens | Uses 42-char fallback secret string |
| `ENCRYPTION_KEY` | `'12345678901234567890123456789012'` | 32-byte secret key for AES-256 payload encryption | Uses 32-char fallback string |
| `SUPABASE_URL` | `'https://iekofqagtcztyavhunai.supabase.co'` | Cloud Supabase PostgreSQL database URL | Hardcoded Supabase URL string |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | `undefined` (or `'your-supabase-anon-key'`) | Supabase API key for client initialization | **Triggers In-Memory Backup Mode (`memoryDb`)** |
| `ADMIN_PASSWORD` | `'R3@m0g3tsw3M0l3f3'` | Master Admin password for `reamogetswemolefe0190@gmail.com` | Pre-hashed with `bcrypt` (10 rounds) |
| `RESEND_API_KEY` | `undefined` | Optional API key for sending welcome email notifications | Skipped if absent |
| `GEMINI_API_KEY` | `undefined` | Key for Google Gemini 1.5 Flash AI backend proxy (`POST /api/gemini`) | Returns fallback message if absent |

### 1.2 Database Operational Modes
The server is architected with a dual database strategy:
1. **Cloud Supabase PostgreSQL Mode**: Activated when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` are valid.
2. **High-Reliability In-Memory Backup Mode (`memoryDb`)**: Activated automatically when Supabase credentials are not configured.
   - `memoryDb` maintains Javascript in-memory arrays for `users`, `transactions`, `onboarding`, `adminUsers`, `audit_logs`, and `ai_telemetry`.
   - Seeding routines automatically populate `memoryDb` with 2 seeded admin users, 10 default creator profiles, and 16+ financial transaction records across YouTube, TikTok, Patreon, and Brand Deals.

---

## 2. Dependencies & Package Analysis (`package.json`)

### 2.1 Dependencies Summary
The project operates with minimal external dependencies, listed in `package.json`:

```json
{
  "name": "creator-cash-flow-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

### 2.2 External Load Testing Libraries Status
- **`autocannon` / `artillery` / `k6`**: Not present in `package.json` or `node_modules`.
- **`axios` / `undici`**: Not installed as standalone dependencies (`fetch` is natively built into Node.js v18+ runtime).
- **Available Native Tooling**: Node.js core modules (`http`, `https`, `perf_hooks`, `crypto`, `worker_threads`, `process.hrtime.bigint()`, native `fetch`) are completely available. This allows designing a zero-dependency, hyper-performant, custom Node.js load testing harness without installing external packages.

---

## 3. Server Runner & Startup Mechanics

### 3.1 Startup Commands
- **Production Start**: `npm start` (executes `node server.js`).
- **Development Start**: `npm run dev` (executes `nodemon server.js`).
- **Direct Node Execution**: `node server.js`.
- **Environment Overrides**: e.g., `PORT=5005 NODE_ENV=staging node server.js`.

### 3.2 Dual-Mode Execution Architecture
`server.js` exports its internal instances at the bottom of the module:

```javascript
let server = null;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`⚡ Creator Cash Flow Secure Backend API running on port ${PORT}`);
    });
}

module.exports = {
    app,
    server,
    memoryDb,
    rateLimitAdminLogin,
    requireAdmin,
    adminLoginAttempts,
    JWT_SECRET,
    maskPII,
    inferCategoryTag
};
```

This structure supports two distinct server execution modes for load testing:
1. **Standalone External Process Mode**:
   - The server is started in a separate shell or child process (`node server.js`).
   - Listens on `http://127.0.0.1:5000` (or custom `PORT`).
   - Testing harness sends network requests over local TCP sockets.
2. **In-Process Ephemeral Server Mode**:
   - The test harness requires `./server` directly (`const { app } = require('./server')`).
   - Spawns an ephemeral HTTP server on port `0` (`app.listen(0, '127.0.0.1')`).
   - Allows zero-port-conflict dynamic benchmark execution with instant memory reset capability between test runs.

---

## 4. Survey of Existing Benchmark & Telemetry Infrastructure

The repository contains several existing test scripts:
- **`test_metrics_concurrency.js`**: An empirical benchmark script for `GET /api/admin/metrics`.
  - Utilizes custom `http.Agent` with keep-alive enabled (`keepAlive: true`, `maxSockets: 1000`, `maxFreeSockets: 200`) to prevent socket exhaustion.
  - Measures request latency using `perf_hooks` (`performance.now()`).
  - Computes latency percentiles via a custom `calculatePercentiles(durations)` helper (`min`, `p50`, `p90`, `p95`, `p99`, `max`, `avg`).
- **`test_admin_metrics_stress.js`**: Tests edge cases and dynamic array mutations under stress.
- **`test_admin_auth.js` / `test_admin_m3.js` / `test_admin_ui.js`**: Test JWT authentication, rate limiting, and RBAC middleware (`requireAdmin`).

---

## 5. Architectural Design Considerations for Custom Load Testing Harness

To satisfy the requirements of the Original Request (simulating 100–200 concurrent users, tracking p95/p99 latencies, ensuring < 250ms average latency, and verifying 100% success rate without connection pool leaks), the custom load harness should incorporate the following design specifications:

### 5.1 Workload Pipelines & Scenario Modeling
The load generator must simulate realistic concurrent creator activity across four core user journeys:
1. **Registration & Auth Flow (20% Weight)**: `POST /api/auth/signup` followed by `POST /api/auth/login` to obtain session JWTs.
2. **Ledger Read Operations (50% Weight)**: `GET /api/transactions` with `Authorization: Bearer <token>`.
3. **Ledger Write Operations (20% Weight)**: `POST /api/transactions` with random amounts, merchants, and categories.
4. **Admin KPI & Audit Monitoring (10% Weight)**: `POST /api/admin/auth/login` and `GET /api/admin/metrics` with admin privileges.

### 5.2 High-Precision Telemetry & Timer Resolution
- Use **`process.hrtime.bigint()`** for nanosecond-precision request latency measurement:
  ```javascript
  const start = process.hrtime.bigint();
  // ... execute HTTP request ...
  const end = process.hrtime.bigint();
  const latencyMs = Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
  ```

### 5.3 Percentile Calculation Algorithm
Sort latency observations array $L$ of length $N$:
- **$p50$ (Median)**: $L[\lfloor N \times 0.50 \rfloor]$
- **$p95$**: $L[\lfloor N \times 0.95 \rfloor]$
- **$p99$**: $L[\lfloor N \times 0.99 \rfloor]$
- **Mean Latency**: $\frac{1}{N} \sum_{i=1}^{N} L[i]$

### 5.4 Socket & Connection Pool Tuning
To support 150–200 concurrent workers without local TCP port exhaustion or `ECONNRESET` errors:
```javascript
const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 500,
    maxFreeSockets: 100,
    timeout: 15000
});
```

### 5.5 Concurrency Control Architecture
Implement worker pools using async concurrency loops (e.g. `Promise.all(Array.from({ length: CONCURRENCY }).map(workerFn))`) or worker threads, executing requests continuously across a fixed test duration (e.g., 30–60 seconds), recording throughput (requests/sec), error counts, status code distribution, and latency arrays.

---

## 6. Recommendations for Implementation Phase
1. Build the stress harness as a self-contained Node.js script (e.g. `stress_test_harness.js`) using native `http`/`https` modules.
2. Provide CLI options or environment controls for target host/port, concurrency level (default 150), test duration, and ramp-up time.
3. Incorporate detailed output formatting showing throughput, p50/p95/p99 latencies, status code breakdown, and pass/fail assertion checks against the acceptance criteria (< 250ms avg latency, 0% error rate).
