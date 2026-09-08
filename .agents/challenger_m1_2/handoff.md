# Milestone M1 Gate Empirical Stress & Security Handoff Report

- **Agent**: Challenger 2 (`challenger_m1_2`)
- **Role**: Empirical Threat Modeler & Stress Tester (critic, specialist)
- **Working Directory**: `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\challenger_m1_2`
- **Date**: 2026-09-04
- **Milestone**: M1 (Critical Security Hardening, PII Sanitization, Rate Limiting, Memory Bounds)
- **Explicit Verdict**: **FAIL**

---

## 1. Observation

Direct empirical observations, reproduction traces, exact line numbers, and tool execution outputs:

### 1.1 Test Suite Execution (`node tests/challenger_m1_stress.js`)
Command executed: `node tests/challenger_m1_stress.js`
Output:
```
Discovered 6 sliding-window route limiters.
1.1 Testing adminLoginAttempts memory bound (capacity 200 IPs):
  ✅ PASS: adminLoginAttempts Map bounded to MAX_TRACKED_IPS (200) — Observed size: 200 (max expected: 200) after 1000 unique simulated IPs
1.2 Testing createSlidingWindowLimiter capacity bounds:
  ✅ PASS: authRateLimiter tracker bounded to maxTrackedKeys (1000) — Observed size: 1000 after 2500 simulated IPs (capacity cap: 1000)
  ✅ PASS: transactionRateLimiter tracker bounded to maxTrackedKeys (2000) — Observed size: 2000 after 3000 simulated users (capacity cap: 2000)
  ✅ PASS: geminiRateLimiter tracker bounded to maxTrackedKeys (500) — Observed size: 500 after 1200 simulated IPs (capacity cap: 500)
  ✅ PASS: Memory Heap Stability during 7,700 IP flood operations — Heap delta: -0.04 MB
1.3 Testing TTL eviction & stale entry cleanup:
  ✅ PASS: Expired timestamps evicted during request filtering in adminLoginAttempts — Attempts remaining for IP: 1
  ✅ PASS: SlidingWindowLimiter evicts expired timestamps and permits request — Stored timestamps count: 1, allowed: true
1.4 Testing Concurrency Stress (100 parallel token validation requests):
  ✅ PASS: 100 concurrent admin token validations executed cleanly — 100/100 HTTP 200 OK in 399ms (250.63 req/sec)
1.5 Empirical Verification of Real HTTP Request IP Isolation:
  ❌ FAIL: Per-IP Rate Limiting Isolation behind Proxies/Load Balancers — FAILED: IP B (198.51.100.2) was blocked with HTTP 429 due to IP A (203.0.113.1) exhaustion! All proxy users collapse to single IP (Too many requests).
```

### 1.2 Defect #1: Reverse Proxy IP Collapsing / Rate Limiting Denial of Service (HIGH)
- **Source Code Locations**:
  - `server.js:269`:
    ```javascript
    function rateLimitAdminLogin(req, res, next) {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    ```
  - `server.js:313`:
    ```javascript
    function createSlidingWindowLimiter({
        windowMs,
        maxRequests,
        errorMessage = 'Too many requests',
        userFacingMessage = 'Rate limit exceeded. Please try again later.',
        keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
        maxTrackedKeys = 500
    })
    ```
- **Direct Empirical Proof**:
  - Executed two distinct IP requests over real HTTP:
    ```
    Request 1..10 from IP A (203.0.113.1): HTTP 401 Unauthorized
    Request 11 from IP A (203.0.113.1): HTTP 429 Too Many Requests (Rate limited)
    Request 1 from IP B (198.51.100.2): HTTP 429 Too Many Requests!
    ```
  - IP B was locked out on its very first attempt because `req.ip` is evaluated before `req.headers['x-forwarded-for']`. In Express, `req.ip` is populated from the TCP socket remote address by default and is never falsy. `app.set('trust proxy', true)` is not configured anywhere in `server.js`.
  - As a result, all clients connecting through any reverse proxy, load balancer, or CDN (e.g., Render, Netlify, Cloudflare, AWS ALB) share a single rate-limit bucket (`::ffff:127.0.0.1`). Any single attacker exhausting 5 admin login attempts or 10 user login attempts causes a global denial of service for all users on the platform.

### 1.3 Defect #2: Unhandled Error Trace & File Path Leakage in Development (MEDIUM)
- **Direct Empirical Proof**:
  - Sending an unlisted CORS origin (`Origin: https://evil.com`) or sending malformed JSON (`{ "email": ... unclosed`) triggers Express's default error handler.
  - HTTP Response:
    ```html
    HTTP/1.1 500 Internal Server Error
    Content-Type: text/html; charset=utf-8

    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Error</title></head>
    <body>
    <pre>Error: Blocked by CORS policy<br> &nbsp; &nbsp;at origin (C:\Users\User\OneDrive\Desktop\New folder (2)\server.js:442:22)...</pre>
    </body>
    </html>
    ```
  - Violates R2 requirement ("Normalize API error handling across all endpoints to return consistent JSON error envelopes with proper HTTP status codes").
  - Under `NODE_ENV=development` (the default setting in `.env`), full stack traces with absolute host filesystem paths (`C:\Users\User\...`) are leaked in HTTP responses.

### 1.4 PII & Credential Sanitization Verification (PASSED)
- Automated grep across all production files (`server.js`, `app.js`, `index.html`, `admin.html`, `stress_harness.js`, `package.json`):
  `git grep -n "reamogetswemolefe0190@gmail.com" -- server.js app.js index.html admin.html stress_harness.js package.json`
  - Output: 0 matches found.
- Zero plaintext fallback secrets found in production source files.
- `git check-ignore -v .env` output: `.gitignore:17:.env* .env` (Exit code 0).
- Response scans across 6 core endpoints (`/api/health`, `/api/admin/metrics`, `/api/admin/creators`, `/api/admin/audit-logs`, `/api/admin/telemetry`, `/api/transactions`): zero leaks of developer email or cryptographic secrets.
- `maskPII()` verified: properly redacts emails (`[REDACTED_EMAIL]`), phone numbers (`[REDACTED_PHONE]`), and ZAR currency (`[REDACTED_ZAR]`). Telemetry entries in `memoryDb.ai_telemetry` store only sanitized prompts.

### 1.5 Memory Bounds & TTL Eviction Verification (PASSED)
- `adminLoginAttempts`: strictly capped at 200 IPs (`MAX_TRACKED_IPS = 200`). Under 1,000 simulated IP insertions, size stayed at exactly 200.
- `authRateLimiter`: strictly capped at 1,000 keys (`maxTrackedKeys = 1000`). Under 2,500 simulated IP insertions, size stayed at exactly 1,000.
- `transactionRateLimiter`: strictly capped at 2,000 keys.
- `geminiRateLimiter`: strictly capped at 500 keys.
- Heap memory delta: -0.04 MB over 7,700 operations.
- Stale entry TTL eviction: expired timestamps (>15m) are filtered on request and purged by the 30s background `setInterval` sweep.

### 1.6 Sustained Brute-Force Lockout & Window Reset (PASSED)
- `POST /api/admin/auth/login`:
  - 5 failed attempts permitted.
  - Attempt 6 returned `HTTP 429 Too Many Requests` with `Retry-After: 900`.
  - 10 sustained attempts under active lockout all returned `HTTP 429`.
  - Upon TTL expiry (>15 min), lockout cleared, request succeeded (HTTP 401 instead of 429), and counter cleanly reset to 1.

---

## 2. Logic Chain

1. **Observation 1.2**: In `server.js`, both `rateLimitAdminLogin` (line 269) and `createSlidingWindowLimiter` (line 313) define their client IP resolution as:
   `const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';`
2. **Logic Step 1**: In the Express.js framework, `req.ip` is an active property derived from the socket remote address (`req.socket.remoteAddress`). Unless `app.set('trust proxy', true)` is explicitly configured, `req.ip` returns the direct TCP connection address (e.g. `::ffff:127.0.0.1` locally, or the reverse proxy address in cloud hosting).
3. **Logic Step 2**: Because `req.ip` is evaluated first in the logical OR chain (`req.ip || req.headers['x-forwarded-for']`), and `req.ip` is always a non-empty string, JavaScript short-circuits. `req.headers['x-forwarded-for']` is never evaluated.
4. **Empirical Verification**: Testing with two simulated clients sending distinct `X-Forwarded-For` headers proved that exhausting the limit for IP A immediately locks out IP B with HTTP 429.
5. **Consequence**: In any production deployment sitting behind a reverse proxy (Render, Netlify, Cloudflare, Nginx), all inbound requests appear from the reverse proxy's IP. 10 rapid failed login attempts by an attacker anywhere in the world will lock out every user globally from authenticating.
6. **Observation 1.3**: When an unlisted origin accesses the server or a malformed JSON payload is sent, Express falls back to its default HTML error handler.
7. **Logic Step 3**: Without a terminal Express error-handling middleware (`app.use((err, req, res, next) => ...)`), errors produce HTML pages instead of normalized JSON envelopes, and in development mode (`NODE_ENV=development` in `.env`), stack traces with absolute host filesystem paths are emitted to clients.
8. **Conclusion**: While PII sanitization, in-memory capacity bounds, and core lockout logic are successfully implemented, the reverse proxy IP collapse defect introduces a critical Denial of Service vulnerability and invalidates simulated per-IP rate limiting.

---

## 3. Caveats

- **Database Fallback Mode**: Stress testing was performed against `memoryDb` fallback mode because remote Supabase cloud credentials were not provided in `.env`. Supabase cloud PostgreSQL connection pool limits under high concurrency could not be tested against real cloud infrastructure.
- **Git Commit History**: Developer personal identifiers remain in past git commit author metadata and remote repository URL. Rewriting git history was out of scope for Milestone M1; all active files in the working tree are confirmed clean.

---

## 4. Conclusion & Explicit Verdict

### **VERDICT**: **FAIL**

Milestone M1 cannot be approved in its current state due to the **Reverse Proxy IP Collapsing / Rate Limit DoS defect**.

### Required Actionable Remediations:
1. **Fix IP Resolution in `server.js`**:
   - Enable proxy trust in Express:
     ```javascript
     app.set('trust proxy', true);
     ```
   - AND fix the header resolution order in lines 269 and 313:
     ```javascript
     const getClientIp = (req) => {
         const forwarded = req.headers['x-forwarded-for'];
         if (forwarded) {
             return forwarded.split(',')[0].trim();
         }
         return req.ip || req.socket?.remoteAddress || '127.0.0.1';
     };
     ```
2. **Add Centralized JSON Error Handling Middleware in `server.js`**:
   - At the end of `server.js`, register an error-handling middleware to prevent HTML stack trace leaks:
     ```javascript
     app.use((err, req, res, next) => {
         if (err.message === 'Blocked by CORS policy') {
             return res.status(403).json({ error: 'CORS policy violation', message: err.message });
         }
         if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
             return res.status(400).json({ error: 'Invalid JSON payload' });
         }
         res.status(err.status || 500).json({ error: 'Internal Server Error' });
     });
     ```

---

## 5. Verification Method

To independently reproduce and verify all findings:

1. **Run Challenger Stress Suite**:
   ```powershell
   node tests/challenger_m1_stress.js
   ```
   *Expected Result*: Fails on test 1.5 with:
   `FAILED: IP B (198.51.100.2) was blocked with HTTP 429 due to IP A (203.0.113.1) exhaustion!`

2. **Run Direct IP Isolation Reproduction Script**:
   ```powershell
   node -e "const http = require('http'); const { app } = require('./server'); const s = app.listen(0, '127.0.0.1', async () => { const port = s.address().port; function post(ip) { return new Promise(r => { const req = http.request({ port, path: '/api/admin/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip } }, res => r(res.statusCode)); req.write(JSON.stringify({ email: 'bad@test.com', password: 'bad' })); req.end(); }); } for (let i=0; i<5; i++) await post('1.1.1.1'); console.log('IP 1 attempt 6:', await post('1.1.1.1')); console.log('IP 2 attempt 1 (expect 401, got):', await post('2.2.2.2')); s.close(); });"
   ```
   *Observed Result*:
   `IP 1 attempt 6: 429`
   `IP 2 attempt 1 (expect 401, got): 429` (Collided!)

3. **Verify Git Ignore**:
   ```powershell
   git check-ignore -v .env
   ```
   *Expected Result*: `.gitignore:17:.env* .env` (Exit code 0).
