# Technical Analysis & Implementation Strategy: Milestone M3 — Audit Logging & PII Telemetry API

**Author**: Explorer M3_1  
**Project**: Creator Cash Flow — Admin Command Portal & Backend API  
**Target Milestone**: M3 (Audit Logging & PII Telemetry API)  
**Date**: 2026-08-07  
**Working Directory**: `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_m3_1`

---

## 1. Executive Summary & Scope Overview

Milestone M3 establishes the security auditing, operational creator governance, and privacy-preserving AI telemetry capabilities for the Creator Cash Flow platform. The goal of this investigation is to provide a complete, battle-tested implementation strategy for:

1. **`POST /api/admin/creators/:id/status`**: Guarded by `requireAdmin`. Performs creator account status (`active` / `suspended`) and plan tier (`Pro` / `Free`) mutations, logs optional admin notes, and enforces mandatory audit trail entries into Supabase `audit_logs` table and `memoryDb.audit_logs` fallback.
2. **`GET /api/admin/audit-logs`**: Guarded by `requireAdmin`. Retrieves chronological administrative audit trail with full field metadata.
3. **PII-Masked AI Telemetry in `POST /api/gemini`**: Automatically sanitizes sensitive PII (email addresses, phone numbers, ZAR currency values) from Gemini AI query prompts, classifies queries into domain category tags, records token usage, model, and latency, and enforces a 30-day automated retention TTL policy.
4. **`GET /api/admin/telemetry`**: Guarded by `requireAdmin`. Exposes PII-masked query telemetry logs subject to the 30-day automated TTL policy.
5. **Unit Testing Strategy (`test_admin_m3.js`)**: A comprehensive standalone automated unit test suite validating all M3 endpoints, permission enforcement (401/403), audit log persistence, PII regex masking edge cases, and 30-day TTL log filtering.

---

## 2. Current Backend Architecture & Baseline State

### 2.1 Server Framework & Middlewares (`server.js`)
- `server.js` uses Express.js with `requireAdmin` middleware (lines 204-222) which verifies signed JWTs containing `{ role: 'admin' }`.
- Dual-mode database execution:
  - **Supabase Cloud PostgreSQL** via `@supabase/supabase-js` client when credentials exist.
  - **High-Reliability `memoryDb` Fallback** when running locally or without active Supabase credentials.
- Existing `memoryDb` structure (lines 32-39):
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

### 2.2 SQL Schema Alignments (`database_setup.sql`)
The PostgreSQL schema in `database_setup.sql` already includes the definitions for `users`, `audit_logs`, and `ai_telemetry`:
- `public.users`: `id`, `email`, `password_hash`, `name`, `phyllo_user_id`, `plan_tier`, `status`, `created_at`.
- `public.audit_logs`:
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
- `public.ai_telemetry`:
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

## 3. Detailed Endpoint Implementation Strategy

### 3.1 `POST /api/admin/creators/:id/status` (Feature F08)

#### Purpose & Access Control
- **Access Control**: Guarded by `requireAdmin`. Rejects missing JWT with 401 and non-admin tokens with 403.
- **URL**: `POST /api/admin/creators/:id/status`
- **Request Body**:
  ```json
  {
    "status": "suspended", // "active" | "suspended" (optional if plan_tier provided)
    "plan_tier": "Pro",   // "Pro" | "Free" (optional if status provided, accepts planTier as alias)
    "note": "Account under investigation for Terms of Service violation"
  }
  ```

#### Proposed Handler Implementation Logic
```javascript
app.post('/api/admin/creators/:id/status', requireAdmin, async (req, res) => {
    try {
        const targetCreatorId = req.params.id;
        const { status, plan_tier, planTier, note } = req.body || {};
        const requestedTier = plan_tier || planTier;

        if (!status && !requestedTier) {
            return res.status(400).json({ error: 'Either status or plan_tier must be provided for mutation.' });
        }

        // Validate status enum if provided
        let newStatus = null;
        if (status) {
            const normalizedStatus = String(status).toLowerCase();
            if (!['active', 'suspended'].includes(normalizedStatus)) {
                return res.status(400).json({ error: 'Invalid status value. Allowed values: active, suspended' });
            }
            newStatus = normalizedStatus;
        }

        // Validate plan tier enum if provided
        let newTier = null;
        if (requestedTier) {
            const normalizedTier = String(requestedTier).toLowerCase();
            if (!['pro', 'free'].includes(normalizedTier)) {
                return res.status(400).json({ error: 'Invalid plan tier value. Allowed values: Pro, Free' });
            }
            newTier = normalizedTier === 'pro' ? 'Pro' : 'Free';
        }

        let existingCreator = null;

        // 1. Fetch Creator State
        if (supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', targetCreatorId)
                .maybeSingle();

            if (error) throw error;
            existingCreator = data;
        } else {
            existingCreator = memoryDb.users.find(u => u.id === targetCreatorId);
        }

        if (!existingCreator) {
            return res.status(404).json({ error: 'Target creator not found.' });
        }

        // Capture previous state snapshot
        const oldState = {
            status: existingCreator.status || 'active',
            plan_tier: existingCreator.plan_tier || existingCreator.planTier || 'Free'
        };

        // Apply mutations
        const updatedStatus = newStatus || oldState.status;
        const updatedTier = newTier || oldState.plan_tier;

        // 2. Perform Creator State Update
        if (supabase) {
            const { error: updateErr } = await supabase
                .from('users')
                .update({
                    status: updatedStatus,
                    plan_tier: updatedTier
                })
                .eq('id', targetCreatorId);

            if (updateErr) throw updateErr;
        } else {
            existingCreator.status = updatedStatus;
            existingCreator.plan_tier = updatedTier;
            existingCreator.planTier = updatedTier;
        }

        const newState = {
            status: updatedStatus,
            plan_tier: updatedTier,
            ...(note ? { note } : {})
        };

        // 3. Construct Mandatory Audit Log Entry
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);

        const auditEntry = {
            id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
            admin_id: req.admin.id || req.admin.email,
            target_creator_id: targetCreatorId,
            action_type: status && requestedTier ? 'STATUS_AND_PLAN_MUTATION' : status ? 'STATUS_MUTATION' : 'PLAN_MUTATION',
            old_value: JSON.stringify(oldState),
            new_value: JSON.stringify(newState),
            timestamp: new Date().toISOString(),
            ip_hash: ipHash
        };

        // 4. Dual-Store Insertion into Audit Ledger
        if (supabase) {
            try {
                await supabase.from('audit_logs').insert([auditEntry]);
            } catch (auditErr) {
                console.warn('⚠️ Supabase audit log insert notice:', auditErr.message);
            }
        }
        
        memoryDb.audit_logs.unshift(auditEntry);
        if (memoryDb.auditLogs && memoryDb.auditLogs !== memoryDb.audit_logs) {
            memoryDb.auditLogs.unshift(auditEntry);
        }

        return res.json({
            success: true,
            creator: {
                id: targetCreatorId,
                name: existingCreator.name,
                email: existingCreator.email,
                status: updatedStatus,
                plan_tier: updatedTier
            },
            audit_entry: auditEntry
        });

    } catch (err) {
        console.error('[CREATOR STATUS MUTATION ERROR]', err);
        return res.status(500).json({ error: 'Failed to update creator account status.' });
    }
});
```

---

### 3.2 `GET /api/admin/audit-logs` (Feature F09)

#### Purpose & Access Control
- **Access Control**: Guarded by `requireAdmin`. Rejects missing/invalid JWT.
- **URL**: `GET /api/admin/audit-logs`
- **Output**: Chronological audit log entries array (newest first).

#### Proposed Handler Implementation Logic
```javascript
app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
    try {
        let auditLogs = [];

        if (supabase) {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('timestamp', { ascending: false });

            if (!error && data) {
                auditLogs = data;
            }
        }

        // Merge with memoryDb fallback if memory contains unique entries or Supabase empty
        if (auditLogs.length === 0) {
            const memoryLogs = memoryDb.audit_logs || memoryDb.auditLogs || [];
            auditLogs = [...memoryLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        return res.json(auditLogs);
    } catch (err) {
        console.error('[GET AUDIT LOGS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve audit trail logs.' });
    }
});
```

---

### 3.3 PII-Safe AI Query Telemetry Engine & `POST /api/gemini` Integration (Features F10, F11)

#### PII Masking Regular Expressions & Rules
The PII masking engine must process raw prompts and replace sensitive entities:

1. **Email Addresses**:
   - **Regex**: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi`
   - **Replacement**: `[REDACTED_EMAIL]`

2. **Phone Numbers**:
   - Matches South African formats (`+27 82 123 4567`, `0821234567`, `+27821234567`, `011 456 7890`) and international numbers.
   - **Regex**: `/(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}|\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g`
   - **Validation**: Ensure match has 7+ total digits before replacing to prevent masking short numeric values.
   - **Replacement**: `[REDACTED_PHONE]`

3. **ZAR Currency Amounts**:
   - Matches South African Rand values in various formats: `R1,500`, `ZAR 5000`, `R500`, `R 1,500.00`, `R1500.00`, `ZAR 250,000`, `R 250 000`.
   - **Regex**: `/(?:ZAR|R)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\b(?:ZAR|R)\s?\d+(?:\.\d{1,2})?\b/gi`
   - **Replacement**: `[REDACTED_ZAR]`

#### PII Masking Implementation Function
```javascript
function maskPiiFromPrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';
    let masked = prompt;

    // 1. Redact Email Addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    masked = masked.replace(emailRegex, '[REDACTED_EMAIL]');

    // 2. Redact Phone Numbers
    const phoneRegex = /(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}|\+?\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    masked = masked.replace(phoneRegex, (match) => {
        const digitsOnly = match.replace(/\D/g, '');
        return digitsOnly.length >= 7 ? '[REDACTED_PHONE]' : match;
    });

    // 3. Redact ZAR Currency Values
    const zarRegex = /(?:ZAR|R)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\b(?:ZAR|R)\s?\d+(?:\.\d{1,2})?\b/gi;
    masked = masked.replace(zarRegex, '[REDACTED_ZAR]');

    return masked;
}
```

#### Category Classifier Algorithm
```javascript
function categorizePrompt(prompt) {
    const text = (prompt || '').toLowerCase();

    if (text.includes('tax') || text.includes('sars') || text.includes('deduct') || text.includes('write-off') || text.includes('holding')) {
        return 'Tax Deduction Strategy';
    }
    if (text.includes('gear') || text.includes('camera') || text.includes('lens') || text.includes('equipment') || text.includes('laptop') || text.includes('purchase') || text.includes('studio')) {
        return 'Gear Purchase Planning';
    }
    if (text.includes('income') || text.includes('earning') || text.includes('revenue') || text.includes('sponsor') || text.includes('brand') || text.includes('youtube') || text.includes('tiktok') || text.includes('patreon') || text.includes('cash flow')) {
        return 'Revenue & Cash Flow Optimization';
    }
    if (text.includes('expense') || text.includes('subscription') || text.includes('cost') || text.includes('outflow') || text.includes('spend')) {
        return 'Expense Management';
    }

    return 'General Creator Advice';
}
```

#### 30-Day Automated Retention TTL Policy Engine
To meet privacy compliance, queries older than 30 days are automatically purged/filtered out:
```javascript
const RETENTION_TTL_DAYS = 30;

function getThirtyDaysAgoIso() {
    const cutoff = new Date(Date.now() - RETENTION_TTL_DAYS * 24 * 60 * 60 * 1000);
    return cutoff.toISOString();
}

function filterActiveTelemetry(logs) {
    const cutoffDate = new Date(Date.now() - RETENTION_TTL_DAYS * 24 * 60 * 60 * 1000);
    return (logs || []).filter(entry => {
        const entryDate = new Date(entry.created_at || entry.timestamp);
        return entryDate >= cutoffDate;
    });
}
```

#### Enhanced `POST /api/gemini` Handler
```javascript
app.post('/api/gemini', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { prompt, systemContext } = req.body || {};
    
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body.' });
    }

    const startTime = Date.now();
    const categoryTag = categorizePrompt(prompt);
    const maskedPrompt = maskPiiFromPrompt(prompt);

    // Fallback response handling if API Key is not configured
    if (!apiKey) {
        const latencyMs = Date.now() - startTime;
        const estimatedTokens = Math.ceil((prompt.length + 80) / 4);

        // Record telemetry log entry even during fallback mode
        const telemetryEntry = {
            id: 'telemetry_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
            category_tag: categoryTag,
            prompt_masked: maskedPrompt,
            tokens_used: estimatedTokens,
            model: 'gemini-1.5-flash',
            latency_ms: latencyMs,
            created_at: new Date().toISOString()
        };

        recordTelemetryLog(telemetryEntry);

        return res.json({ 
            fallback: true, 
            message: 'Environment variable GEMINI_API_KEY not configured on server.',
            categoryTag
        });
    }

    try {
        const defaultSystemContext = systemContext || 'You are CCF Creator Intelligence, an expert financial advisor for modern creators. Provide concise, highly actionable 2-3 sentence financial guidance answering the user prompt directly.';

        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: defaultSystemContext },
                        { text: prompt }
                    ]
                }]
            })
        });

        const data = await apiResponse.json();
        const latencyMs = Date.now() - startTime;

        let responseText = '';
        let tokensUsed = 0;

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            responseText = data.candidates[0].content.parts[0].text;
            tokensUsed = data.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + responseText.length) / 4);
        } else {
            tokensUsed = Math.ceil(prompt.length / 4);
        }

        // Record PII-safe Telemetry Log Entry
        const telemetryEntry = {
            id: 'telemetry_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
            category_tag: categoryTag,
            prompt_masked: maskedPrompt,
            tokens_used: tokensUsed,
            model: 'gemini-1.5-flash',
            latency_ms: latencyMs,
            created_at: new Date().toISOString()
        };

        recordTelemetryLog(telemetryEntry);

        if (responseText) {
            return res.json({ text: responseText, source: 'Gemini 1.5 Flash (Backend API)', categoryTag });
        } else {
            return res.json({ fallback: true, error: 'Unexpected API response structure', raw: data });
        }
    } catch (error) {
        console.error('[GEMINI BACKEND PROXY ERROR]', error);
        return res.json({ fallback: true, error: error.message });
    }
});

// Telemetry Recorder Helper
async function recordTelemetryLog(entry) {
    if (supabase) {
        try {
            await supabase.from('ai_telemetry').insert([entry]);
        } catch (err) {
            console.warn('⚠️ Supabase ai_telemetry insert notice:', err.message);
        }
    }
    
    memoryDb.ai_telemetry.unshift(entry);
    if (memoryDb.aiTelemetry && memoryDb.aiTelemetry !== memoryDb.ai_telemetry) {
        memoryDb.aiTelemetry.unshift(entry);
    }

    // Apply automated TTL retention pruning on memoryDb
    memoryDb.ai_telemetry = filterActiveTelemetry(memoryDb.ai_telemetry);
}
```

---

### 3.4 `GET /api/admin/telemetry` (Feature F12)

#### Purpose & Access Control
- **Access Control**: Guarded by `requireAdmin`.
- **URL**: `GET /api/admin/telemetry`
- **Output**: Returns telemetry logs filtered by the 30-day retention policy.

#### Proposed Handler Implementation Logic
```javascript
app.get('/api/admin/telemetry', requireAdmin, async (req, res) => {
    try {
        const thirtyDaysAgoIso = getThirtyDaysAgoIso();
        let telemetryLogs = [];

        if (supabase) {
            const { data, error } = await supabase
                .from('ai_telemetry')
                .select('*')
                .gte('created_at', thirtyDaysAgoIso)
                .order('created_at', { ascending: false });

            if (!error && data) {
                telemetryLogs = data;
            }
        }

        if (telemetryLogs.length === 0) {
            const memoryLogs = memoryDb.ai_telemetry || memoryDb.aiTelemetry || [];
            telemetryLogs = filterActiveTelemetry(memoryLogs)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return res.json(telemetryLogs);
    } catch (err) {
        console.error('[GET TELEMETRY LOGS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve AI query telemetry logs.' });
    }
});
```

---

## 4. Dual-Store Object Property Aliases

To ensure `memoryDb` seamlessly satisfies both `memoryDb.audit_logs` (snake_case) and `memoryDb.auditLogs` (camelCase) references without breaking existing code or tests, `server.js` should define dual getters:

```javascript
// Add Property Aliases to memoryDb for cross-naming compatibility
if (!Object.getOwnPropertyDescriptor(memoryDb, 'auditLogs')) {
    Object.defineProperty(memoryDb, 'auditLogs', {
        get: function() { return this.audit_logs; },
        set: function(val) { this.audit_logs = val; }
    });
}

if (!Object.getOwnPropertyDescriptor(memoryDb, 'aiTelemetry')) {
    Object.defineProperty(memoryDb, 'aiTelemetry', {
        get: function() { return this.ai_telemetry; },
        set: function(val) { this.ai_telemetry = val; }
    });
}
```

---

## 5. Standalone Unit Testing Strategy (`test_admin_m3.js`)

A dedicated test runner script `test_admin_m3.js` will be created using standard Node.js `http` client and assertions (matching `test_admin_auth.js` and `test_admin_metrics.js`).

### 5.1 Test Groups & Assertions Outline

```javascript
/**
 * test_admin_m3.js
 * Comprehensive automated unit test suite for Milestone M3 (Audit Logging & PII Telemetry API)
 */
```

#### Test Group 1: Access Control & Middleware Rejections (HTTP 401 & 403)
- `POST /api/admin/creators/usr_seed_1/status` without Authorization header -> expect HTTP 401.
- `POST /api/admin/creators/usr_seed_1/status` with non-admin creator JWT -> expect HTTP 403.
- `GET /api/admin/audit-logs` without token -> expect HTTP 401.
- `GET /api/admin/audit-logs` with non-admin creator JWT -> expect HTTP 403.
- `GET /api/admin/telemetry` without token -> expect HTTP 401.
- `GET /api/admin/telemetry` with non-admin creator JWT -> expect HTTP 403.

#### Test Group 2: Creator Status & Plan Mutation (`POST /api/admin/creators/:id/status`)
- Send valid admin token to mutate creator `usr_seed_1`:
  `{ status: 'suspended', plan_tier: 'Pro', note: 'Fraud investigation' }`
- Assert HTTP 200 response with `success: true`.
- Assert updated creator properties (`status === 'suspended'`, `plan_tier === 'Pro'`).
- Assert `audit_entry` object in response contains:
  - `admin_id` matches admin user ID.
  - `target_creator_id === 'usr_seed_1'`.
  - `action_type` is non-empty string.
  - `old_value` contains previous status (`active`).
  - `new_value` contains new status (`suspended`) and note.
  - `timestamp` is valid ISO string.
  - `ip_hash` is 16-character hex string.
- Test 404 for invalid creator ID (`usr_nonexistent`) -> expect HTTP 404 `{ error: 'Target creator not found.' }`.
- Test 400 for invalid status value (`{ status: 'invalid_status' }`) -> expect HTTP 400.

#### Test Group 3: Chronological Audit Trail Retrieval (`GET /api/admin/audit-logs`)
- Call `GET /api/admin/audit-logs` with valid admin JWT.
- Assert HTTP 200 response returning JSON array.
- Assert array length is >= 1 and contains the newly created audit entry for `usr_seed_1`.
- Verify audit entry order is sorted descending by timestamp.

#### Test Group 4: PII Masking & Gemini Telemetry Logging (`POST /api/gemini`)
- Send AI query prompt containing emails, phone numbers, and ZAR values:
  `"My email is naledi@creator.co.za and my SA phone is +27 82 123 4567. How do I write off R1,500 for lens gear or ZAR 5000 camera equipment?"`
- Assert response status HTTP 200.
- Retrieve recorded telemetry log from `memoryDb.ai_telemetry` or `GET /api/admin/telemetry`.
- Assert `prompt_masked`:
  - `naledi@creator.co.za` replaced with `[REDACTED_EMAIL]`.
  - `+27 82 123 4567` replaced with `[REDACTED_PHONE]`.
  - `R1,500` replaced with `[REDACTED_ZAR]`.
  - `ZAR 5000` replaced with `[REDACTED_ZAR]`.
  - Unmasked text retained.
- Assert `category_tag === 'Gear Purchase Planning'` or `'Tax Deduction Strategy'`.
- Assert `tokens_used > 0`, `model === 'gemini-1.5-flash'`, `latency_ms >= 0`.

#### Test Group 5: 30-Day Automated Retention TTL Policy Filtering (`GET /api/admin/telemetry`)
- Manually inject 2 test records into `memoryDb.ai_telemetry`:
  1. Active record: `created_at = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()` (5 days old).
  2. Expired record: `created_at = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()` (35 days old).
- Execute `GET /api/admin/telemetry` with valid admin JWT.
- Assert HTTP 200 returning array.
- Assert array INCLUDES the 5-day-old record.
- Assert array EXCLUDES the 35-day-old record (validating the 30-day TTL policy).

---

## 6. Implementation Checklist & Verification Criteria

| Task | Component | File Target | Expected Outcome |
|------|-----------|-------------|------------------|
| 1 | Creator Status & Plan Mutation Route | `server.js` | `POST /api/admin/creators/:id/status` updates user state & appends audit entry |
| 2 | Audit Trail Retrieval Route | `server.js` | `GET /api/admin/audit-logs` returns chronological array of administrative mutations |
| 3 | PII Masking & Telemetry Proxy | `server.js` | `POST /api/gemini` masks email/phone/ZAR amounts & records telemetry entries |
| 4 | Telemetry Logs Route | `server.js` | `GET /api/admin/telemetry` returns PII-masked query logs filtered by 30-day TTL |
| 5 | Memory DB Property Aliases | `server.js` | `memoryDb.auditLogs` & `memoryDb.aiTelemetry` getter/setter aliases configured |
| 6 | Automated Test Suite | `test_admin_m3.js` | 100% pass rate across all 5 M3 test groups and security assertions |

---

## 7. Verification Method

To verify the M3 implementation once written by implementer agents:
1. Run `node test_admin_auth.js` (Verify M1 auth remains regression-free).
2. Run `node test_admin_metrics.js` (Verify M2 metrics remain regression-free).
3. Run `node test_admin_m3.js` (Verify all M3 status mutations, audit logs, PII masking, and 30-day TTL policy pass cleanly).
