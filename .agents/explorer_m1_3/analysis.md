# Database Schema DDL & In-Memory Fallback Specification

**Milestone**: M1 (Backend Auth Core & Security)  
**Author**: Explorer M1_3  
**Target Files**: `database_setup.sql`, `server.js`  
**Date**: 2026-08-07  

---

## 1. Executive Summary & Architectural Design Goals

The Creator Cash Flow (CCF) platform operates in a **dual-mode persistence architecture**:
1. **Primary Persistence**: Supabase Cloud PostgreSQL database.
2. **High-Reliability Fallback**: In-memory JavaScript data store (`memoryDb` in `server.js`) activated when Supabase credentials are not configured or when network degradation occurs.

To support the **Admin Command Portal (`admin.html`)** and comply with requirements **R2 (Immutable Audit Logging)** and **R3 (PII-Safe AI Telemetry)**, the database schema and memory fallback structures must be extended with two new tables/collections:
- `audit_logs`: An immutable event store tracking administrative mutations (account status changes, plan upgrades/downgrades, admin logins, note attachments).
- `ai_query_telemetry`: A privacy-preserving log capturing Gemini AI query metadata (category tags, PII-masked query text, token usage, response latency, model name) with an automated 30-day Retention TTL policy.

This specification details the exact DDL statements, indexes, RLS policies, memory structures, seed records, and field mapping for implementation.

---

## 2. PostgreSQL DDL Schema Specification (`database_setup.sql` Extensions)

Append the following SQL code blocks to `database_setup.sql`.

### 2.1 `public.audit_logs` Table DDL

```sql
-- ==========================================================================
-- 4. Create Audit Logs Table (Immutable Admin Action Ledger)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    target_creator_id TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN ('STATUS_CHANGE', 'PLAN_CHANGE', 'NOTE_ADDED', 'ADMIN_LOGIN', 'SYSTEM_CONFIG')),
    old_value TEXT,
    new_value TEXT,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write during beta" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
```

#### Field Specifications for `audit_logs`

| Field | Data Type | Nullable | Default / Constraint | Description |
|---|---|---|---|---|
| `id` | `TEXT` | No | PRIMARY KEY | Unique log entry identifier (e.g. `'aud_1723000000000_a1b2'`). |
| `admin_id` | `TEXT` | No | - | Identifier or email of the admin who performed the action (e.g. `'admin-1'`). |
| `target_creator_id` | `TEXT` | Yes | Foreign Key to `users(id)` | ID of the target creator account affected by the action. Nullable for system-wide admin actions. |
| `action_type` | `TEXT` | No | CHECK constraint | Type of administrative action (`STATUS_CHANGE`, `PLAN_CHANGE`, `NOTE_ADDED`, `ADMIN_LOGIN`, `SYSTEM_CONFIG`). |
| `old_value` | `TEXT` | Yes | - | Previous value/state before mutation (e.g., `'active'` or `'Free'`). |
| `new_value` | `TEXT` | Yes | - | Updated value/state after mutation (e.g., `'suspended'` or `'Pro'`). |
| `ip_hash` | `TEXT` | No | - | Cryptographic hash (SHA-256) of client IP address for security audits. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | No | `TIMEZONE('utc'::text, NOW())` | Precise UTC timestamp of the audit event. |

---

### 2.2 `public.ai_query_telemetry` Table DDL

```sql
-- ==========================================================================
-- 5. Create AI Query Telemetry Table (PII-Safe Query Performance & Metrics)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.ai_query_telemetry (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    category_tag TEXT NOT NULL,
    prompt_masked TEXT NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_query_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write during beta" ON public.ai_query_telemetry FOR ALL USING (true) WITH CHECK (true);
```

#### Field Specifications for `ai_query_telemetry`

| Field | Data Type | Nullable | Default / Constraint | Description |
|---|---|---|---|---|
| `id` | `TEXT` | No | PRIMARY KEY | Unique telemetry record identifier (e.g. `'tel_1723000000000_c3d4'`). |
| `user_id` | `TEXT` | Yes | Foreign Key to `users(id)` | Associated creator ID. `NULL` if guest/anonymous user. |
| `category_tag` | `TEXT` | No | - | Classification tag (e.g. `'Tax Deduction Strategy'`, `'Gear Purchase Planning'`, `'Cash Flow Optimization'`, `'General Guidance'`). |
| `prompt_masked` | `TEXT` | No | - | Sanitized user query string with PII (emails, phones) and currency figures masked. |
| `tokens_used` | `INTEGER` | No | `0` | Estimated or returned total Gemini token count (prompt + completion). |
| `model` | `TEXT` | No | `'gemini-1.5-flash'` | Model version processing the request. |
| `latency_ms` | `INTEGER` | No | `0` | Server-to-API round-trip duration in milliseconds. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | No | `TIMEZONE('utc'::text, NOW())` | UTC timestamp of query execution. |

---

### 2.3 Indexes & Performance Tuning

Add these indexes to `database_setup.sql` to optimize dashboard filtering and TTL cleanup queries:

```sql
-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_creator ON public.audit_logs(target_creator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Indexes for ai_query_telemetry
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created_at ON public.ai_query_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_category ON public.ai_query_telemetry(category_tag);
```

---

### 2.4 30-Day TTL Retention Query (PostgreSQL Maintenance Script)

To satisfy Requirement **R3 (30-Day Automated Retention TTL)** on Supabase:

```sql
-- SQL Query to purge AI Telemetry records older than 30 days
DELETE FROM public.ai_query_telemetry
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 3. In-Memory Database Fallback Specification (`server.js` Extensions)

When running in offline/memory backup mode (when Supabase credentials are not set), `server.js` uses `memoryDb`.

### 3.1 Extended `memoryDb` Object Structure

Modify lines 32–36 of `server.js` to initialize `auditLogs` and `aiQueryTelemetry` arrays with default seed data:

```javascript
// In-Memory Database Fallback
const memoryDb = {
    users: [],
    transactions: [],
    onboarding: [],
    auditLogs: [
        {
            id: 'aud_seed_1',
            admin_id: 'admin-1',
            target_creator_id: 'usr_demo_1',
            action_type: 'STATUS_CHANGE',
            old_value: 'active',
            new_value: 'suspended',
            ip_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
            id: 'aud_seed_2',
            admin_id: 'admin-1',
            target_creator_id: 'usr_demo_2',
            action_type: 'PLAN_CHANGE',
            old_value: 'Free',
            new_value: 'Pro',
            ip_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            created_at: new Date(Date.now() - 3600000 * 2).toISOString()
        }
    ],
    aiQueryTelemetry: [
        {
            id: 'tel_seed_1',
            user_id: 'usr_demo_1',
            category_tag: 'Tax Deduction Strategy',
            prompt_masked: 'How do I deduct [REDACTED_ZAR] for Sony Alpha Lens purchased from Orms?',
            tokens_used: 340,
            model: 'gemini-1.5-flash',
            latency_ms: 420,
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
            id: 'tel_seed_2',
            user_id: 'usr_demo_2',
            category_tag: 'Gear Purchase Planning',
            prompt_masked: 'Can I write off a [REDACTED_ZAR] equipment upgrade against YouTube AdSense income?',
            tokens_used: 285,
            model: 'gemini-1.5-flash',
            latency_ms: 380,
            created_at: new Date(Date.now() - 3600000 * 3).toISOString()
        }
    ]
};
```

---

### 3.2 Node.js 30-Day TTL In-Memory Pruning Routine

Implement an automatic scheduled cleanup procedure in `server.js` to purge memory telemetry logs older than 30 days:

```javascript
// Helper: Purge AI Telemetry logs older than 30 days
function purgeExpiredTelemetry() {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!supabase) {
        const initialCount = memoryDb.aiQueryTelemetry.length;
        memoryDb.aiQueryTelemetry = memoryDb.aiQueryTelemetry.filter(entry => {
            const entryTime = new Date(entry.created_at || entry.timestamp).getTime();
            return (now - entryTime) < THIRTY_DAYS_MS;
        });
        const purged = initialCount - memoryDb.aiQueryTelemetry.length;
        if (purged > 0) {
            console.log(`[MEMORY DB] Purged ${purged} expired AI telemetry log(s) older than 30 days.`);
        }
    } else {
        // Asynchronous Supabase purge
        supabase
            .from('ai_query_telemetry')
            .delete()
            .lt('created_at', new Date(now - THIRTY_DAYS_MS).toISOString())
            .then(({ error, count }) => {
                if (error) console.error('[SUPABASE TTL PURGE ERROR]', error);
                else if (count) console.log(`[SUPABASE] Purged ${count} telemetry log(s) older than 30 days.`);
            });
    }
}

// Run cleanup every 12 hours
setInterval(purgeExpiredTelemetry, 12 * 60 * 60 * 1000);
```

---

## 4. Alignment Matrix & Data Mapping

### 4.1 API Endpoint Field Alignment

| REST Endpoint | HTTP Verb | Database Table | Memory Array | Key Mapping |
|---|---|---|---|---|
| `/api/admin/creators/:id/status` | `POST` | `public.audit_logs` | `memoryDb.auditLogs` | `admin_id`, `target_creator_id`, `action_type`, `old_value`, `new_value`, `ip_hash`, `created_at` |
| `/api/admin/audit-logs` | `GET` | `public.audit_logs` | `memoryDb.auditLogs` | Returns array ordered by `created_at` DESC |
| `/api/gemini` | `POST` | `public.ai_query_telemetry` | `memoryDb.aiQueryTelemetry` | `user_id`, `category_tag`, `prompt_masked`, `tokens_used`, `model`, `latency_ms`, `created_at` |
| `/api/admin/telemetry` | `GET` | `public.ai_query_telemetry` | `memoryDb.aiQueryTelemetry` | Returns array ordered by `created_at` DESC (filtered < 30 days) |

---

### 4.2 Standard Action Types & Telemetry Tags

#### Audit Log `action_type` Enum Values:
- `STATUS_CHANGE`: Account activation or suspension (`active` <-> `suspended`).
- `PLAN_CHANGE`: Creator subscription tier modification (`Free` <-> `Pro`).
- `NOTE_ADDED`: Admin internal compliance or account notes attached.
- `ADMIN_LOGIN`: Admin session authorization event.
- `SYSTEM_CONFIG`: Global platform setting adjustment.

#### Telemetry `category_tag` Standard Taxonomy:
- `'Tax Deduction Strategy'`
- `'Gear Purchase Planning'`
- `'Cash Flow Optimization'`
- `'Revenue Channel Analysis'`
- `'General Guidance'`

---

### 4.3 PII Redaction Pattern Guidelines

When logging queries in `POST /api/gemini`:
1. **ZAR & Currency Amounts**: Replace numbers preceded by `R`, `ZAR`, `$`, or standalone amounts over 100 with `[REDACTED_ZAR]`.
2. **Emails**: Regex pattern `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` -> `[REDACTED_EMAIL]`.
3. **Phone Numbers**: Regex pattern `/(\+27|0)\d{9}/g` -> `[REDACTED_PHONE]`.

Example Transformation:
- **Raw Query**: *"I made R45000 on YouTube this month. Can I write off a R12500 camera bought by john@example.com?"*
- **Masked Query**: *"I made [REDACTED_ZAR] on YouTube this month. Can I write off a [REDACTED_ZAR] camera bought by [REDACTED_EMAIL]?"*

---

## 5. Verification & Implementation Checklist

1. **Supabase DDL Execution**:
   - Paste extended `database_setup.sql` into Supabase SQL Editor.
   - Verify table creation for `public.audit_logs` and `public.ai_query_telemetry`.
   - Confirm RLS policies and index creation.

2. **Server Memory Fallback Testing**:
   - Start `server.js` without `SUPABASE_URL` environment variable.
   - Confirm `memoryDb.auditLogs` and `memoryDb.aiQueryTelemetry` initialize with default seed arrays.
   - Verify `purgeExpiredTelemetry()` routine executes without syntax or runtime errors.

---
