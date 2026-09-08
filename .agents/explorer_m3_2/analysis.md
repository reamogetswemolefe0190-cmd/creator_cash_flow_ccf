# Technical Investigation & Strategy Report: Milestone M3 — Audit Logging & PII Telemetry API

**Author**: Explorer Subagent (`explorer_m3_2`)  
**Target Milestone**: M3 (Audit Logging & PII Telemetry API)  
**Date**: 2026-08-07  
**Working Directory**: `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_m3_2`

---

## 1. Executive Summary

Milestone M3 establishes the security, compliance, and observability foundation for the Creator Cash Flow Admin Portal. It introduces immutable administrative audit logging and PII-preserving AI query telemetry.

This report provides a complete technical analysis of the existing codebase (`server.js`, `database_setup.sql`, and test suites) and formulates an evidence-based implementation strategy for the following components:
1. **`POST /api/admin/creators/:id/status`**: Guarded by `requireAdmin`, performs status (`active`/`suspended`) and plan tier (`Pro`/`Free`) mutations, and produces mandatory immutable entries in `audit_logs` (Supabase) and `memoryDb.audit_logs`.
2. **`GET /api/admin/audit-logs`**: Guarded by `requireAdmin`, retrieves the chronological audit trail from Supabase PostgreSQL or `memoryDb`.
3. **PII-Masked Telemetry in `POST /api/gemini`**: Inspects Gemini AI requests, applies regex masking for emails, phone numbers, and ZAR currency values (`R1,500`, `ZAR 5000`, `R500`), computes token consumption and latency, tags queries by intent category, and persists records in `ai_telemetry`.
4. **`GET /api/admin/telemetry`**: Guarded by `requireAdmin`, returns telemetry records with an automated 30-day TTL policy filter.
5. **Automated Unit Test Strategy**: Formulates `test_admin_m3.js` to systematically verify auth guards, state mutations, audit trail contents, PII masking edge cases, and 30-day TTL enforcement.

---

## 2. Architecture & Data Model Analysis

### 2.1 Database Schemas (`database_setup.sql`)

`database_setup.sql` already contains DDL definitions for both `audit_logs` and `ai_telemetry`:

#### `public.audit_logs`
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

#### `public.ai_telemetry`
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

### 2.2 Dual-Mode Persistence & `memoryDb` Compatibility

In `server.js`, the in-memory fallback database `memoryDb` is defined as:
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

#### Property Alias Recommendation
To support property naming variations across specs (`auditLogs` vs `audit_logs`, `aiTelemetry` vs `ai_telemetry`), `server.js` should define accessor properties on `memoryDb`:
```javascript
Object.defineProperty(memoryDb, 'auditLogs', {
    get() { return this.audit_logs; },
    set(v) { this.audit_logs = v; },
    configurable: true,
    enumerable: true
});

Object.defineProperty(memoryDb, 'aiTelemetry', {
    get() { return this.ai_telemetry; },
    set(v) { this.ai_telemetry = v; },
    configurable: true,
    enumerable: true
});
```

---

## 3. Technical Implementation Strategy for M3 Endpoints

### 3.1 Endpoint 1: Creator Account Status Mutation (`POST /api/admin/creators/:id/status`)

#### Route Definition & Middleware
- **Path**: `POST /api/admin/creators/:id/status`
- **Middleware**: `requireAdmin` (validates JWT, ensures `req.admin.role === 'admin'`).
- **Target Parameter**: `req.params.id` (Creator User ID).

#### Input Payload & Validation
```json
{
  "status": "suspended",
  "plan_tier": "Pro",
  "note": "Policy violation investigation"
}
```
1. Accept optional/provided fields: `status`, `plan_tier` (or `planTier`), `note`.
2. Validation:
   - If `status` is provided, it must be either `'active'` or `'suspended'` (case-insensitive check).
   - If `plan_tier` is provided, it must be either `'Pro'` or `'Free'` (case-insensitive check).
   - If neither `status` nor `plan_tier` is provided, return HTTP 400 `{ error: "Invalid mutation payload. Provide status ('active'/'suspended') or plan_tier ('Pro'/'Free')." }`.

#### Creator Lookup Logic
1. Primary (Supabase Cloud PostgreSQL):
   ```javascript
   let creator = null;
   if (supabase) {
       const { data, error } = await supabase.from('users').select('*').eq('id', creatorId).maybeSingle();
       if (data && !error) creator = data;
   }
   ```
2. Fallback (`memoryDb.users`):
   ```javascript
   if (!creator) {
       creator = memoryDb.users.find(u => u.id === creatorId);
   }
   ```
3. If not found in either data store, return HTTP 404 `{ error: "Creator not found" }`.

#### Mutation Execution & Audit Record Generation
1. Record current state:
   - `oldStatus = creator.status || 'active'`
   - `oldPlanTier = creator.plan_tier || creator.planTier || 'Free'`
2. Determine new state:
   - `newStatus = status ? normalizedStatus : oldStatus`
   - `newPlanTier = plan_tier ? normalizedPlanTier : oldPlanTier`
3. Classify `action_type`:
   - If status changed AND plan tier changed: `'ACCOUNT_MUTATION'`
   - Else if status changed: `'STATUS_CHANGE'`
   - Else if plan tier changed: `'PLAN_TIER_CHANGE'`
   - Else: `'NOTE_ADDED'`
4. Build `old_value` and `new_value` strings:
   - `old_value`: `status: ${oldStatus}, plan_tier: ${oldPlanTier}`
   - `new_value`: `status: ${newStatus}, plan_tier: ${newPlanTier}${note ? ` (Note: ${note})` : ''}`
5. Anonymize IP hash:
   ```javascript
   const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
   const ip_hash = crypto.createHash('sha256').update(rawIp + (process.env.IP_SALT || 'ccf_salt_2026')).digest('hex').substring(0, 16);
   ```
6. Build `auditEntry`:
   ```javascript
   const auditEntry = {
       id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
       admin_id: req.admin.id || req.admin.email,
       target_creator_id: creatorId,
       action_type: actionType,
       old_value: oldValueStr,
       new_value: newValueStr,
       timestamp: new Date().toISOString(),
       ip_hash: ip_hash
   };
   ```
7. Database Persistence:
   - In Supabase: Update `users` table (`status`, `plan_tier`), insert `auditEntry` into `audit_logs`.
   - In `memoryDb`: Update `memoryDb.users` item, insert `auditEntry` into `memoryDb.audit_logs`.

#### HTTP Response
- Status: `200 OK`
- Body:
  ```json
  {
    "success": true,
    "creator": {
      "id": "usr_seed_10",
      "status": "suspended",
      "plan_tier": "Pro"
    },
    "audit_entry": {
      "id": "audit_1723050000000_a1b2",
      "admin_id": "admin_seed_1",
      "target_creator_id": "usr_seed_10",
      "action_type": "STATUS_CHANGE",
      "old_value": "status: active, plan_tier: Pro",
      "new_value": "status: suspended, plan_tier: Pro (Note: Policy violation)",
      "timestamp": "2026-08-07T19:30:00.000Z",
      "ip_hash": "e3b0c44298fc1c14"
    }
  }
  ```

---

### 3.2 Endpoint 2: Retrieve Audit Trail (`GET /api/admin/audit-logs`)

#### Route Definition & Middleware
- **Path**: `GET /api/admin/audit-logs`
- **Middleware**: `requireAdmin`

#### Fetching & Sorting Strategy
1. Primary (Supabase Cloud PostgreSQL):
   ```javascript
   if (supabase) {
       const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
       if (!error && data) return res.json(data);
   }
   ```
2. Fallback (`memoryDb.audit_logs`):
   ```javascript
   const logs = [...(memoryDb.audit_logs || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
   return res.json(logs);
   ```

---

### 3.3 Feature 3: PII-Masked AI Query Telemetry in `POST /api/gemini`

#### Existing Route Inspection
Currently, `POST /api/gemini` in `server.js` (lines 960-1001) forwards prompts to Gemini 1.5 Flash API or returns a fallback when `GEMINI_API_KEY` is not present.

#### PII & Financial Masking Specifications
The prompt text must undergo regex sanitization to strip sensitive PII and raw ZAR monetary figures before storing in telemetry logs.

```javascript
function maskPII(text) {
    if (!text || typeof text !== 'string') return '';
    let masked = text;

    // 1. Mask Email Addresses
    masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

    // 2. Mask Phone Numbers (South African + International formats)
    // Matches formats like +27 82 123 4567, 0821234567, 011-555-0199
    masked = masked.replace(/(?:\+?27|0)\s*(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g, '[REDACTED_PHONE]');

    // 3. Mask ZAR Currency Amounts
    // Handles formats like: R1,500, R1500, R 1,500.00, ZAR 5000, ZAR5000, 5000 ZAR, R500
    masked = masked.replace(/(?:ZAR\s*|R\s*)(?:\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi, '[REDACTED_ZAR]');
    masked = masked.replace(/\b\d+(?:[,\s]\d{3})*(?:\.\d{2})?\s*ZAR\b/gi, '[REDACTED_ZAR]');

    return masked;
}
```

#### Test Masking Examples

| Raw Prompt Input | Masked Prompt Output |
|---|---|
| `How do I write off my R1,500 Sony lens purchase? Email me at creator@test.co.za` | `How do I write off my [REDACTED_ZAR] Sony lens purchase? Email me at [REDACTED_EMAIL]` |
| `My phone is 0821234567. I made ZAR 5000 from TikTok and R500 from Patreon.` | `My phone is [REDACTED_PHONE]. I made [REDACTED_ZAR] from TikTok and [REDACTED_ZAR] from Patreon.` |
| `Should I register for VAT if my revenue reaches R 1,000,000.00?` | `Should I register for VAT if my revenue reaches [REDACTED_ZAR]?` |

#### Intent Categorization Logic (`category_tag`)
```javascript
function categorizePrompt(prompt) {
    const lower = (prompt || '').toLowerCase();
    if (lower.includes('tax') || lower.includes('deduction') || lower.includes('write-off') || lower.includes('sars') || lower.includes('reserve')) {
        return 'Tax Deduction Strategy';
    }
    if (lower.includes('gear') || lower.includes('camera') || lower.includes('lens') || lower.includes('equipment') || lower.includes('laptop') || lower.includes('purchase') || lower.includes('buy')) {
        return 'Gear Purchase Planning';
    }
    if (lower.includes('sponsor') || lower.includes('brand') || lower.includes('earning') || lower.includes('income') || lower.includes('rate') || lower.includes('monetiz') || lower.includes('revenue')) {
        return 'Revenue Optimization';
    }
    return 'General Financial Guidance';
}
```

#### Latency, Tokens, and Telemetry Storage
1. Latency: Measure start time `const startTime = Date.now()` before API call and compute `const latency_ms = Date.now() - startTime`.
2. Token Usage:
   - If Gemini API returns `data.usageMetadata.totalTokenCount`, use that value.
   - Otherwise, estimate: `Math.ceil(((prompt || '').length + (responseText || '').length) / 4)`.
3. Construct Telemetry Record:
   ```javascript
   const telemetryEntry = {
       id: 'telem_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
       category_tag: categorizePrompt(prompt),
       prompt_masked: maskPII(prompt),
       tokens_used: tokensUsed,
       model: 'gemini-1.5-flash',
       latency_ms: latencyMs,
       created_at: new Date().toISOString()
   };
   ```
4. Insert into Supabase `ai_telemetry` and `memoryDb.ai_telemetry`.

---

### 3.4 Endpoint 4: AI Query Telemetry Endpoint (`GET /api/admin/telemetry`)

#### Route Definition & Middleware
- **Path**: `GET /api/admin/telemetry`
- **Middleware**: `requireAdmin`

#### 30-Day TTL Policy Filtering
The endpoint must automatically exclude logs older than 30 days.

```javascript
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const cutoffIsoDate = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

if (supabase) {
    const { data, error } = await supabase
        .from('ai_telemetry')
        .select('*')
        .gte('created_at', cutoffIsoDate)
        .order('created_at', { ascending: false });

    if (!error && data) return res.json(data);
}

// Fallback to memoryDb
const cutoffTimestamp = Date.now() - THIRTY_DAYS_MS;
const validLogs = (memoryDb.ai_telemetry || [])
    .filter(t => {
        const itemTime = new Date(t.created_at || t.timestamp).getTime();
        return itemTime >= cutoffTimestamp;
    })
    .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));

return res.json(validLogs);
```

---

## 4. Automated Unit Test Strategy (`test_admin_m3.js`)

A new test suite file `test_admin_m3.js` will be created to validate all M3 capabilities.

### Test Suite Structure & Verification Coverage

| # | Test Focus | Description & Validation Criteria |
|---|---|---|
| 1 | Auth Protection Guards | Verify `POST /api/admin/creators/:id/status`, `GET /api/admin/audit-logs`, and `GET /api/admin/telemetry` return HTTP 401 for missing/invalid tokens and HTTP 403 for non-admin role tokens. |
| 2 | Invalid Creator / Body Payload Handling | Test `POST /api/admin/creators/nonexistent_id/status` returns HTTP 404. Test invalid `status` or `plan_tier` values return HTTP 400. |
| 3 | Creator Status & Plan Mutation | Issue valid admin mutation changing creator `usr_seed_1` from `active` to `suspended` and `Free` to `Pro`. Verify HTTP 200 and updated fields. |
| 4 | Audit Log Record Validation | Check generated audit entry for correct `admin_id`, `target_creator_id`, `action_type`, `old_value`, `new_value`, ISO `timestamp`, and 16-char `ip_hash`. |
| 5 | Audit Logs Retrieval API | Call `GET /api/admin/audit-logs` with valid admin token. Verify JSON array returns chronological list containing the audit entry. |
| 6 | PII & Financial Masking Verification | Call `POST /api/gemini` with prompts containing emails (`admin@test.com`), phone numbers (`082 123 4567`), and ZAR amounts (`R1,500`, `ZAR 5000`, `R500`). Assert telemetry record stores masked text without raw PII. |
| 7 | Query Category Classification | Test prompts for keyword routing ("tax" -> "Tax Deduction Strategy", "lens" -> "Gear Purchase Planning", "sponsor" -> "Revenue Optimization"). |
| 8 | Telemetry Retrieval & 30-Day TTL Filter | Call `GET /api/admin/telemetry`. Inject an artificial telemetry entry with `created_at` timestamp 35 days in the past. Assert `GET /api/admin/telemetry` excludes the expired entry while including recent entries. |

---

## 5. Risk Assessment & Mitigations

1. **In-Memory vs Supabase Dual DB Consistency**:
   - *Risk*: Data written to `memoryDb` during offline fallback mode might differ from Supabase schema key naming.
   - *Mitigation*: Define property aliases (`auditLogs` -> `audit_logs`, `aiTelemetry` -> `ai_telemetry`) on `memoryDb` and keep snake_case field structures uniform.
2. **Regex Over-Masking**:
   - *Risk*: ZAR currency regex might accidentally redact non-currency single letter 'R's or number strings.
   - *Mitigation*: Limit pattern to explicit `R` followed by digits/commas (e.g. `/R\s*\d[\d,.]*/gi`) and `ZAR` bounds.
3. **Date Parsing across Viewports/Environments**:
   - *Risk*: Non-standard date strings in `created_at` / `timestamp`.
   - *Mitigation*: Always store standard ISO 8601 UTC strings (`new Date().toISOString()`).

---

## 6. Implementation Guidance for Implementer Agent

When implementer is dispatched for M3:
1. Update `server.js` with helper functions (`maskPII`, `categorizePrompt`, property getters on `memoryDb`).
2. Implement `POST /api/admin/creators/:id/status` endpoint.
3. Implement `GET /api/admin/audit-logs` endpoint.
4. Enhance `POST /api/gemini` handler to perform PII masking, latency tracking, token computation, and telemetry persistence.
5. Implement `GET /api/admin/telemetry` endpoint with 30-day TTL policy.
6. Create `test_admin_m3.js` and execute `node test_admin_m3.js` to verify 100% pass rate.
