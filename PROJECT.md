# Project: Creator Cash Flow Stress Testing & Benchmarking

## Architecture
- Backend API: Express.js running on Node.js (`server.js`), supporting both Supabase Cloud PostgreSQL (via PostgREST) and high-reliability local `memoryDb` fallback.
- Stress Test Harness: Native Node.js modular concurrency runner using `http.Agent` socket pooling, high-resolution timers (`process.hrtime.bigint()`), worker thread/async concurrency pools, and percentile sorting algorithms.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | High-Concurrency Load Generator | Simulates 100-200 concurrent users performing registration, login/JWT auth, transaction reads & writes | M2 | R1 |
| 2 | Latency & Telemetry Metrics | Calculates p95/p99 latencies, avg response time, request throughput (req/sec), HTTP success/error rates | M2 | R2 |
| 3 | Database Connection Pooling Stability | Validates Supabase/memoryDb connection pool stability, prevents timeouts, lockups, leaks | M1, M3 | R3 |
| 4 | Backend DB & Error Hardening | Adds missing B-tree indexes, hardens route error handling, and ensures 100% success rate under load | M1 | R3, AC |
| 5 | Benchmark Verification (150 users, <250ms avg latency) | Runs load test at 150 concurrent users, verifies <250ms avg latency and 100% success rate | M3 | AC |
| 6 | Forensic Audit & Quality Verification | Independent code review, non-cheating verification, and benchmark auditing | M4 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Hardening & Database Indexing | Add B-tree indexes to `database_setup.sql`, harden `server.js` route error handling and dual-storage fallbacks | none | DONE |
| M2 | Concurrency Load Generator & Telemetry Harness | Build `stress_harness.js` Node.js script supporting 100-200 VUs, tracking p95/p99/avg latency, throughput, error rates | M1 | DONE |
| M3 | Load Testing & Benchmark Verification | Execute stress tests at 100, 150, 200 VUs; verify 150 VUs < 250ms avg latency, 100% HTTP success | M2 | IN_PROGRESS |
| M4 | Code Review, Forensic Audit & Reporting | Independent review, forensic integrity audit (CLEAN), report generation, notify Sentinel | M3 | PLANNED |

## Code Layout
- `server.js`: Primary Express server and route handlers
- `database_setup.sql`: Database schema & index definitions
- `stress_harness.js`: Custom Node.js load testing harness
- `stress_test_report.json`: Benchmark metrics output file
