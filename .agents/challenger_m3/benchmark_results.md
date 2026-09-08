# Creator Cash Flow Backend - Empirical Benchmark & Load Test Report

**Execution Date**: 2026-08-09T00:35:55Z  
**Test Harness**: `stress_harness.js`  
**Target Server URL**: `http://localhost:5000`  
**Challenger Subagent**: `challenger_m3`  

---

## Executive Summary

Empirical load testing was performed across three benchmark runs (100 VUs, 150 VUs, and 200 VUs) using high-resolution nanosecond precision timing (`process.hrtime.bigint()`). While the Express API server demonstrated high stability with **0 HTTP 500 internal server errors** and zero process crashes, it **failed the target latency acceptance threshold (<250ms)** by a significant margin due to CPU event loop blocking from high-cost synchronous bcrypt hashing and remote database network roundtrips during user signup.

---

## Benchmark Results Summary Table

| Run | Concurrency (VUs) | Target / Actual Duration | Total Reqs | Success Rate (%) | Throughput (req/s) | Avg Latency (ms) | p50 Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | HTTP 500s | Network Errors |
|:---:|:-----------------:|:------------------------:|:----------:|:----------------:|:------------------:|:----------------:|:----------------:|:----------------:|:----------------:|:---------:|:--------------:|
| 1   | 100 VUs           | 15s / 27.33s             | 101        | 99.01%           | 3.70 req/sec       | 23,912.18 ms     | 24,749.32 ms     | 27,011.04 ms     | 27,271.48 ms     | 0         | 1              |
| 2   | **150 VUs (Target)** | 20s / 38.50s          | 152        | **98.68%**       | **3.95 req/sec**   | **31,609.99 ms** | **33,509.03 ms** | **38,420.91 ms** | **38,429.24 ms** | **0**     | **1**          |
| 3   | 200 VUs (Max)     | 20s / 54.34s             | 202        | 99.01%           | 3.72 req/sec       | 45,781.08 ms     | 48,809.52 ms     | 54,100.00 ms     | 54,275.54 ms     | 0         | 2              |

---

## Detailed Benchmark Runs

### Benchmark Run 1: Baseline Load (100 VUs)
- **Concurrency**: 100 Virtual Users
- **Target Duration**: 15 seconds | **Actual Duration**: 27.33 seconds
- **Total Requests Executed**: 101
- **Throughput**: 3.70 req/sec
- **Success Rate**: 99.01% (100 2xx successes, 0 4xx errors, 0 5xx errors, 1 network socket error)
- **Overall Latency Breakdown**:
  - **Min**: 8,770.88 ms
  - **Avg**: 23,912.18 ms
  - **Max**: 27,272.09 ms
  - **p50**: 24,749.32 ms
  - **p90**: 27,000.98 ms
  - **p95**: 27,011.04 ms
  - **p99**: 27,271.48 ms
- **Endpoint Performance**:
  - `POST /api/auth/signup`: Count = 100, Success Rate = 100.0%, Avg = 24,063.59 ms, p95 = 27,011.04 ms, p99 = 27,271.48 ms
  - `POST /api/auth/login`: Count = 1, Success Rate = 0.0%, Avg = 8,770.88 ms (Timed out at end of test window)

### Benchmark Run 2: Target Acceptance Load (150 VUs)
- **Concurrency**: 150 Virtual Users
- **Target Duration**: 20 seconds | **Actual Duration**: 38.50 seconds
- **Total Requests Executed**: 152
- **Throughput**: 3.95 req/sec
- **Success Rate**: 98.68% (150 2xx successes, 1 4xx error, 0 5xx errors, 1 network socket error)
- **Overall Latency Breakdown**:
  - **Min**: 6,885.61 ms
  - **Avg**: **31,609.99 ms**
  - **Max**: 38,429.54 ms
  - **p50**: 33,509.03 ms
  - **p90**: 38,416.52 ms
  - **p95**: **38,420.91 ms**
  - **p99**: **38,429.24 ms**
- **Endpoint Performance**:
  - `POST /api/auth/signup`: Count = 150, Success Rate = 100.0%, Avg = 31,853.77 ms, p95 = 38,420.91 ms, p99 = 38,429.24 ms
  - `POST /api/auth/login`: Count = 1, Success Rate = 0.0%, Avg = 9,699.17 ms
  - `GET /api/transactions`: Count = 1, Success Rate = 0.0%, Avg = 16,953.02 ms

### Benchmark Run 3: Maximum Spike Load (200 VUs)
- **Concurrency**: 200 Virtual Users
- **Target Duration**: 20 seconds | **Actual Duration**: 54.34 seconds
- **Total Requests Executed**: 202
- **Throughput**: 3.72 req/sec
- **Success Rate**: 99.01% (200 2xx successes, 0 4xx errors, 0 5xx errors, 2 network socket errors)
- **Overall Latency Breakdown**:
  - **Min**: 18,182.26 ms
  - **Avg**: 45,781.08 ms
  - **Max**: 54,275.54 ms
  - **p50**: 48,809.52 ms
  - **p90**: 54,060.00 ms
  - **p95**: 54,100.00 ms
  - **p99**: 54,275.54 ms
- **Endpoint Performance**:
  - `POST /api/auth/signup`: Count = 200, Success Rate = 100.0%, Avg = 46,056.45 ms, p95 = 54,100.00 ms, p99 = 54,275.54 ms
  - `POST /api/auth/login`: Count = 2, Success Rate = 0.0%, Avg = 18,244.25 ms

---

## Acceptance Criteria Verification Matrix

| Acceptance Criterion | Required Threshold | Empirical Finding | Status |
|:---------------------|:-------------------|:------------------|:------:|
| **150 VU Load Handling** | 100% success rate (0 500s, 0 socket errors, 0 crashes) | 98.68% success rate (0 HTTP 500s, 0 crashes, but 1 socket connection error) | ❌ **FAIL** |
| **Response Latency Target** | Average latency < 250ms at 150 VUs | **31,609.99 ms** average latency (~126x over target threshold) | ❌ **CRITICAL FAIL** |
| **Percentile Telemetry** | Capture and report p95/p99 percentiles | p95 (38.4s) & p99 (38.4s) fully captured and recorded | ✅ **PASS** |
| **DB Connection Pool Stability** | No connection leaks, pool lockups, or fatal DB errors | Express & DB pool remained operational without process crashes | ⚠️ **PARTIAL PASS** |

---

## Root Cause Analysis & Bottlenecks

1. **CPU Bound Password Hashing (`bcrypt` Cost 10)**:
   - `server.js` calls `bcrypt.hash(password, 10)` synchronously within the libuv threadpool during every `POST /api/auth/signup`.
   - Node.js defaults to `UV_THREADPOOL_SIZE=4`. When 100-200 VUs trigger CPU-heavy bcrypt operations simultaneously, the 4 libuv worker threads are saturated immediately, queuing requests up to 30-50 seconds.
2. **Synchronous Remote Database Network Roundtrips on Signup**:
   - `app.post('/api/auth/signup')` performs an existing user lookup, a user insertion, and triggers `seedDefaultTransactions(userId)` which performs an additional insert of 5 transactions into Supabase Cloud.
   - Under 150 VUs, hundreds of HTTP/HTTPS requests to remote Supabase Cloud occur concurrently, aggravating request latency.
3. **Workflow Stalls in Stress Harness**:
   - Because step 1 (`signup`) takes ~30-40 seconds to complete per VU, the duration window expires before VUs can reach steps 3-5 (`GET /api/transactions`, `POST /api/transactions`, `GET /api/admin/metrics`).

---

## Technical Recommendations for Remediation

1. **Optimize Hashing Configuration**:
   - Set `process.env.UV_THREADPOOL_SIZE = 64` or `128` at server startup to expand libuv thread pool capacity.
   - Reduce bcrypt rounds in benchmark/test environment (e.g. `BCRYPT_ROUNDS=4` or quick async hash) to avoid CPU thread starvation under load.
2. **Asynchronous / Non-blocking DB Seed Insertion**:
   - Make default transaction seeding (`seedDefaultTransactions`) asynchronous or deferred so signup HTTP responses are returned immediately without waiting for 5 bulk DB inserts to finish.
3. **Connection Pooling & Socket Reuse Tuning**:
   - Verify connection pool reuse settings for Supabase client / PostgREST connection reuse to prevent socket resets under burst traffic.
