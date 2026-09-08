# Analysis & Implementation Strategy: `requireAdmin` Middleware

## Executive Summary
This document defines the exact architecture, security specifications, and implementation strategy for the `requireAdmin` Express middleware in `server.js` for Milestone M1 (Backend Auth Core & Security). 

The `requireAdmin` middleware serves as the primary security gateway protecting all `/api/admin/*` endpoints (metrics, creator management, telemetry, and audit logs) within the Creator Cash Flow platform. It guarantees that only cryptographically verified JSON Web Tokens (JWT) bearing an explicit `role: 'admin'` claim gain access to administrative operations.

---

## Core Requirements Matrix

| Requirement ID | Description | Enforced Rationale & Response |
|---|---|---|
| **REQ-AUTH-01** | Extract Bearer JWT from `Authorization` header | Reads `req.headers['authorization']`, parses `Bearer <token>` format. |
| **REQ-AUTH-02** | Cryptographic Signature & Expiration Verification | Uses `jsonwebtoken.verify(token, JWT_SECRET)`. Fails if tampered, malformed, or expired. |
| **REQ-AUTH-03** | Role Enforcement (`role === 'admin'`) | Validates `decoded.role === 'admin'`. Rejects regular user tokens. |
| **REQ-AUTH-04** | HTTP 401 Unauthorized Response | Returned when token is missing, malformed, unreadable, signature invalid, or expired. |
| **REQ-AUTH-05** | HTTP 403 Forbidden Response | Returned when JWT is validly signed, but payload lacks `role === 'admin'` (e.g. regular creator token). |
| **REQ-AUTH-06** | Request Context Propagation | Attaches `decoded` payload to `req.user` for downstream audit logging (`admin_id`). |

---

## HTTP Status Code Decision Matrix

To ensure compliance with RFC 7235 and OAuth2/JWT standards:

| Condition | HTTP Status | Response Payload | Rationale |
|---|---|---|---|
| No `Authorization` header present | `401 Unauthorized` | `{ "error": "Admin authorization header required" }` | Unauthenticated request. Identity cannot be determined. |
| Header format is not `Bearer <token>` | `401 Unauthorized` | `{ "error": "Malformed authorization header format. Expected Bearer <token>" }` | Invalid credentials presentation format. |
| Empty Bearer token string | `401 Unauthorized` | `{ "error": "Admin access token required" }` | Missing credential payload. |
| Signature verification fails (bad secret / tampered) | `401 Unauthorized` | `{ "error": "Invalid or expired admin session token" }` | Unauthenticated. Credential check failed. |
| JWT token has expired | `401 Unauthorized` | `{ "error": "Invalid or expired admin session token" }` | Session expired. Re-authentication required. |
| JWT verified, but `role !== 'admin'` | `403 Forbidden` | `{ "error": "Forbidden: Insufficient privileges. Admin role required." }` | Authenticated identity established (e.g. regular creator user), but access to resource is prohibited. |
| JWT verified and `role === 'admin'` | `next()` (200 OK) | N/A (Passes control to route handler) | Authentication & Authorization successful. |

---

## Detailed Step-by-Step Logic Flow

```
   HTTP Request to /api/admin/*
                │
                ▼
  [Check Authorization Header]
        │                │
     Missing         Present
        │                │
        ▼                ▼
     Return 401     [Parse Bearer Format]
                         │           │
                     Malformed    Valid Format
                         │           │
                         ▼           ▼
                      Return 401   [jwt.verify(token, JWT_SECRET)]
                                        │                     │
                                     Invalid/Expired       Valid Signature
                                        │                     │
                                        ▼                     ▼
                                     Return 401         [Check decoded.role === 'admin']
                                                              │                   │
                                                           Not Admin            Is Admin
                                                              │                   │
                                                              ▼                   ▼
                                                           Return 403         Set req.user = decoded
                                                                                  Call next()
```

---

## Exact Implementation Code Strategy for `server.js`

### 1. The `requireAdmin` Middleware Function

```javascript
/**
 * Role-Protected Middleware for Admin Command Portal (/api/admin/*)
 * Enforces valid Bearer JWT authentication and 'admin' role privileges.
 * 
 * Status Codes:
 * - 401 Unauthorized: Missing, malformed, invalid, or expired JWT token.
 * - 403 Forbidden: Valid JWT token present, but user lacks 'admin' role.
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Admin authorization header required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ error: 'Malformed authorization header format. Expected Bearer <token>' });
    }

    const token = parts[1];
    if (!token || token.trim() === '') {
        return res.status(401).json({ error: 'Admin access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired admin session token' });
        }

        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges. Admin role required.' });
        }

        req.user = decoded;
        next();
    });
}
```

### 2. Admin Token Issuance in `POST /api/admin/auth/login`

When an administrator logs in successfully via `POST /api/admin/auth/login`, the token must be generated with explicit role tagging:

```javascript
const adminToken = jwt.sign(
    {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: 'admin'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
);
```

### 3. Route Protection Integration Map

`requireAdmin` must be attached to every administrative API route handler in `server.js`:

```javascript
// Public Admin Login Route (Unprotected by requireAdmin)
app.post('/api/admin/auth/login', adminLoginHandler);

// Protected Admin Routes (All protected by requireAdmin)
app.get('/api/admin/metrics', requireAdmin, getMetricsHandler);
app.get('/api/admin/creators', requireAdmin, getCreatorsHandler);
app.post('/api/admin/creators/:id/status', requireAdmin, updateCreatorStatusHandler);
app.get('/api/admin/telemetry', requireAdmin, getTelemetryHandler);
app.get('/api/admin/audit-logs', requireAdmin, getAuditLogsHandler);
```

---

## Comparison with Existing `authenticateToken` Middleware

| Metric / Behavior | `authenticateToken` (Existing) | `requireAdmin` (Proposed) |
|---|---|---|
| Target Endpoints | `/api/transactions`, `/api/onboarding/*` | All `/api/admin/*` endpoints (except `/api/admin/auth/login`) |
| Demo Token Bypass | Accepts `demo_token` & `offline_token` | **STRICTLY REJECTS** non-JWT and demo tokens |
| Invalid JWT Error Code | Returns `403` | Returns `401` (Unauthorized) |
| Missing Token Error Code | Returns `401` | Returns `401` (Unauthorized) |
| Role Check | None (Any valid user token accepted) | Enforces `decoded.role === 'admin'` |
| Insufficient Role Error Code | N/A | Returns `403` (Forbidden) |

---

## Verification & Testing Matrix

To verify `requireAdmin` implementation in Milestone M7, the following test cases must be passed:

1. **Test 401 No Header**: Request `GET /api/admin/metrics` with no Authorization header -> Expect `401 Unauthorized`.
2. **Test 401 Bad Header Format**: Request `GET /api/admin/metrics` with `Authorization: InvalidFormat xyz` -> Expect `401 Unauthorized`.
3. **Test 401 Invalid Token Signature**: Request `GET /api/admin/metrics` with `Authorization: Bearer invalid.jwt.token` -> Expect `401 Unauthorized`.
4. **Test 401 Demo Token Attempt**: Request `GET /api/admin/metrics` with `Authorization: Bearer demo_token` -> Expect `401 Unauthorized`.
5. **Test 403 Regular Creator Token**: Request `GET /api/admin/metrics` with a valid JWT signed with `JWT_SECRET` but having `role: 'creator'` (or missing `role`) -> Expect `403 Forbidden`.
6. **Test 200 Admin Token Success**: Request `GET /api/admin/metrics` with a valid JWT signed with `JWT_SECRET` having `role: 'admin'` -> Expect `200 OK`.
