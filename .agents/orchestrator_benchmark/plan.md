# Master Plan: Creator Cash Flow Stress Testing & Benchmarking

## Overview
Establish a custom Node.js stress testing harness to benchmark the Creator Cash Flow Express/Supabase backend under high-concurrency workloads (100-200 concurrent users), capture latency/throughput telemetry, validate database connection pool stability, and ensure performance acceptance criteria are met (<250ms avg latency, p95/p99 metrics, 100% success rate under 150 concurrent users).

## Requirements & Acceptance Criteria
- **R1. Concurrency Load Generator**: Custom Node.js stress testing harness simulating 100-200 concurrent users performing high-frequency registration, authentication (JWT creation/validation), and transaction listings.
- **R2. Latency Metrics & Telemetry**: Track p95/p99 latencies, average response times, request throughput (req/sec), HTTP success/error rates, and DB query latency.
- **R3. Connection Pool Stability**: Validate Supabase / local backup connection pool handles concurrent read/write without leaks, lockups, or timeouts.
- **Acceptance Criteria**:
  1. Staging server handles a simulated load of 150 concurrent users executing requests.
  2. Average response latency remains under 250ms under peak target load (150 users).
  3. Harness reports p95/p99 latency values, throughput (requests/sec), and HTTP success/error rates.
  4. Server achieves 100% success rate (zero HTTP 500 errors, database pool failures, or server crashes).

## Milestones
- **M1: Backend Hardening & Database Indexing** [IN_PROGRESS]
  - Add B-tree indexes to `database_setup.sql` (`idx_transactions_user_id`, `idx_transactions_created_at`, `idx_audit_logs_timestamp`).
  - Harden `server.js` route error handling, connection pool safety, and dual-write memoryDb synchronization.
- **M2: Concurrency Load Generator & Telemetry Harness** [PLANNED]
  - Implement `stress_harness.js` supporting configurable VU load (100-200), HTTP `keepAlive` socket pool, high-precision nanosecond timing (`process.hrtime.bigint()`), percentile math (p50, p90, p95, p99, avg, min, max), throughput calculation, and JSON export.
- **M3: Load Testing & Benchmark Verification** [PLANNED]
  - Execute stress tests at 100, 150, 200 concurrent user loads against backend server.
  - Verify 150 concurrent user target load: avg latency < 250ms, 100% HTTP success (0 errors), p95/p99 reported.
- **M4: Code Review, Forensic Audit & Reporting** [PLANNED]
  - Reviewer inspection, Forensic Auditor integrity audit (CLEAN), report compilation, and Sentinel parent notification.
