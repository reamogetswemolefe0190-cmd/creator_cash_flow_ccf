# M1 Technical Analysis & Implementation Guide: Backend Auth Core & Security

## Executive Summary
This document outlines the detailed architecture and implementation strategy for **Milestone M1 (Backend Auth Core & Security)** of the Creator Cash Flow Admin Portal. It investigates `server.js`, existing dependencies in `package.json`, and database fallback mechanisms to provide the Implementer with an exact, production-ready blueprint.

---

## 1. Existing System Audit

### 1.1 `server.js` Capabilities & Gaps
- **Existing Dependencies**: `express`, `cors`, `helmet`, `jsonwebtoken` (9.0.2), `bcryptjs` (2.4.3), `@supabase/supabase-js`.
- **Existing Auth Routes**:
  - `POST /api/auth/signup` and `POST /api/auth/login` currently exist for creator users.
  - Creator login signs tokens with payload `{ id, email, name }` (missing `role`).
  - Middleware `authenticateToken` validates JWT tokens but does **not** enforce role-based access control (`role: 'admin'`).
- **Database Architecture**:
  - Dual-mode support: Supabase Cloud PostgreSQL with fallback to in-memory `memoryDb`.
  - `memoryDb` currently contains `users`, `transactions`, `onboarding` arrays. It lacks `adminUsers`, `audit_logs`, and `ai_telemetry`.

### 1.2 Required M1 Features & Artifacts
1. **Default Seeded Admin User**: `admin@creatorcashflow.com` with salted bcrypt password hash.
2. **Rate Limiter / Brute-Force Protection**: In-memory sliding window rate limiter on `POST /api/admin/auth/login` (HTTP 429 when threshold exceeded).
3. **Admin Login Endpoint**: `POST /api/admin/auth/login` returning HTTP 200 with JWT token and admin user details or HTTP 401/429 errors.
4. **JWT Payload Contract**: Signed JWT payload explicitly containing `{ id, email, role: 'admin' }`.
5. **Role-Protected Middleware (`requireAdmin`)**: Validates Bearer JWT tokens, ensuring `decoded.role === 'admin'`. Rejects invalid/missing requests with HTTP 401/403.
6. **DB Schema & `memoryDb` Extensions**: DDL tables and fallback arrays for `admin_users`, `audit_logs`, and `ai_telemetry`.

---

## 2. Implementation Strategy & Code Specifications

### 2.1 Default Seeded Admin Account & Seeding Logic
To guarantee instant availability across both Supabase and Memory Backup modes without async boot delays, the seeded admin user credentials should be defined with a secure fallback password:
- **Email**: `admin@creatorcashflow.com`
- **Default Password**: `AdminPass2026!` (configurable via `process.env.ADMIN_PASSWORD`)

#### Seeding Implementation (Memory & Supabase)
```javascript
// Pre-calculated bcrypt hash for 'AdminPass2026!' with 10 salt rounds
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'AdminPass2026!';
const DEFAULT_ADMIN_EMAIL = 'admin@creatorcashflow.com';

// Ensure memoryDb contains admin Users array
if (!memoryDb.adminUsers) {
    memoryDb.adminUsers = [
        {
            id: 'admin_seed_1',
            email: DEFAULT_ADMIN_EMAIL,
            passwordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASS, 10),
            role: 'admin',
            created_at: new Date().toISOString()
        }
    ];
}

// Supabase Auto-Seeding Helper on Server Initialization
async function seedAdminAccountInSupabase() {
    if (!supabase) return;
    try {
        const { data: existing } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', DEFAULT_ADMIN_EMAIL)
            .maybeSingle();

        if (!existing) {
            const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
            await supabase.from('admin_users').insert([{
                id: 'admin_seed_1',
                email: DEFAULT_ADMIN_EMAIL,
                password_hash: passwordHash,
                role: 'admin'
            }]);
            console.log('✅ Seeded default admin user in Supabase admin_users table.');
        }
    } catch (err) {
        console.warn('⚠️ Supabase admin seeding notice:', err.message);
    }
}
```

---

### 2.2 Rate Limiting / Brute-Force Protection Middleware
Because `express-rate-limit` is not listed in `package.json`, an in-memory sliding-window rate limiter should be implemented directly in `server.js` for zero-dependency reliability:

```javascript
// In-memory brute force protection tracking
const adminLoginAttempts = new Map();

function rateLimitAdminLogin(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
    const MAX_ATTEMPTS = 5;           // Max 5 attempts per window

    const record = adminLoginAttempts.get(ip);

    if (!record || now > record.resetTime) {
        adminLoginAttempts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return next();
    }

    if (record.count >= MAX_ATTEMPTS) {
        const retryAfterSecs = Math.ceil((record.resetTime - now) / 1000);
        return res.status(429).json({
            error: 'Too many login attempts',
            message: `Rate limit exceeded. Too many failed admin login attempts from this IP. Please try again after ${retryAfterSecs} seconds.`,
            retryAfterSeconds: retryAfterSecs
        });
    }

    record.count += 1;
    next();
}
```

---

### 2.3 `POST /api/admin/auth/login` Implementation Design
This route validates credentials against Supabase or `memoryDb`, checks the password hash via `bcrypt.compare`, signs the JWT with explicit `{ id, email, role: 'admin' }`, and returns the session payload.

```javascript
app.post('/api/admin/auth/login', rateLimitAdminLogin, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let adminUser = null;

        if (supabase) {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (data && !error) {
                adminUser = {
                    id: data.id,
                    email: data.email,
                    passwordHash: data.password_hash,
                    role: data.role || 'admin'
                };
            }
        }

        // Fallback to memoryDb if not found in Supabase or running in memory mode
        if (!adminUser) {
            const memAdmin = (memoryDb.adminUsers || []).find(a => a.email === normalizedEmail);
            if (memAdmin) {
                adminUser = memAdmin;
            }
        }

        if (!adminUser) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Sign JWT Payload strictly containing { id, email, role: 'admin' }
        const token = jwt.sign(
            {
                id: adminUser.id,
                email: adminUser.email,
                role: 'admin'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.json({
            success: true,
            token,
            admin: {
                id: adminUser.id,
                email: adminUser.email,
                role: 'admin'
            }
        });
    } catch (err) {
        console.error('[ADMIN LOGIN ERROR]', err);
        return res.status(500).json({ error: 'Server error during admin authentication.' });
    }
});
```

---

### 2.4 `requireAdmin` Role-Checking Middleware Strategy
The `requireAdmin` middleware guards all `/api/admin/*` protected routes:

```javascript
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired session token' });
        }
        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Administrative privileges required' });
        }
        req.admin = decoded;
        next();
    });
}
```

#### HTTP Response Contract Mapping
- **Missing Token / Header**: HTTP 401 `{ "error": "Access token required" }`
- **Invalid / Expired Token**: HTTP 403 `{ "error": "Invalid or expired session token" }`
- **Non-Admin Role**: HTTP 403 `{ "error": "Forbidden: Administrative privileges required" }`
- **Valid Admin Token**: Calls `next()`, attaching `req.admin = { id, email, role: 'admin' }`.

---

### 2.5 DB Extensions & `memoryDb` Structures

#### 1. In-Memory Database Fallback (`memoryDb`) Updates
```javascript
const memoryDb = {
    users: [],
    adminUsers: [],
    transactions: [],
    onboarding: [],
    audit_logs: [],
    ai_telemetry: []
};
```

#### 2. PostgreSQL DDL Schema Definitions (`database_setup.sql`)
```sql
-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Immutable Audit Trail Ledger Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    target_creator_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(255)
);

-- 3. PII-Safe AI Query Telemetry Table
CREATE TABLE IF NOT EXISTS ai_telemetry (
    id VARCHAR(255) PRIMARY KEY,
    category_tag VARCHAR(100) NOT NULL,
    prompt_masked TEXT NOT NULL,
    tokens_used INT DEFAULT 0,
    model VARCHAR(100) DEFAULT 'gemini-1.5-flash',
    latency_ms INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Step-by-Step Implementation Guide for Implementer

1. **Update `memoryDb` Initialization** in `server.js` to include `adminUsers: []`, `audit_logs: []`, and `ai_telemetry: []`.
2. **Add Default Admin Seeding** on startup to populate `memoryDb.adminUsers` and invoke `seedAdminAccountInSupabase()`.
3. **Implement `rateLimitAdminLogin` Middleware** in `server.js` for `POST /api/admin/auth/login`.
4. **Implement `POST /api/admin/auth/login` Route** matching the exact response contract.
5. **Implement `requireAdmin` Middleware** for role validation.
6. **Update/Create `database_setup.sql`** with the DDL definitions for `admin_users`, `audit_logs`, and `ai_telemetry`.

---

## 4. Verification Plan

### Test Scenarios
1. **Successful Admin Login**:
   - `POST /api/admin/auth/login` with `{"email": "admin@creatorcashflow.com", "password": "AdminPass2026!"}` -> Expects HTTP 200, `{ success: true, token: "...", admin: { id, email, role: 'admin' } }`.
2. **Invalid Password**:
   - `POST /api/admin/auth/login` with wrong password -> Expects HTTP 401 `{ error: 'Invalid credentials' }`.
3. **Rate Limiting**:
   - Fire 6 consecutive login requests from the same IP -> 6th request expects HTTP 429 `{ error: 'Too many login attempts' }`.
4. **JWT Verification & Role Check**:
   - Inspect signed token using `jwt.verify` -> Ensure `payload.role === 'admin'`.
5. **Protected Route Authorization**:
   - Send GET request to a test `/api/admin/*` route without header -> HTTP 401.
   - Send request with user token (`role: undefined` or `role: 'creator'`) -> HTTP 403.
   - Send request with admin JWT -> HTTP 200 / success.
