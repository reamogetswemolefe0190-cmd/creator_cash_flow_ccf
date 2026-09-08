# Creator Cash Flow REST API Reference & Specification

**Version:** 3.0.0  
**Status:** Production Ready  
**Base URL (Production):** `https://creatorcashflow.co.za`  
**Base URL (Development/Staging):** `http://localhost:5000`  

---

## Table of Contents

1. [Architecture & System Overview](#1-architecture--system-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
   - [Creator JWT Authentication](#21-creator-jwt-authentication)
   - [Offline & Demo Mode Tokens](#22-offline--demo-mode-tokens)
   - [Administrator Authentication & Role Enforcement](#23-administrator-authentication--role-enforcement)
3. [Rate Limiting Policies](#3-rate-limiting-policies)
   - [Sliding-Window Architecture](#31-sliding-window-architecture)
   - [Client IP Resolution](#32-client-ip-resolution)
   - [Rate Limit Thresholds](#33-rate-limit-thresholds)
   - [HTTP 429 Semantics & Retry-After](#34-http-429-semantics--retry-after)
4. [Error Handling & Envelope Standards](#4-error-handling--envelope-standards)
   - [Standard Error Envelope](#41-standard-error-envelope)
   - [HTTP Status Codes Reference](#42-http-status-codes-reference)
5. [API Endpoint Specifications](#5-api-endpoint-specifications)
   - [Health & Diagnostics](#51-health--diagnostics)
     - `GET /api/health`
   - [Creator Authentication](#52-creator-authentication)
     - `POST /api/auth/register` (or `/api/auth/signup`)
     - `POST /api/auth/login`
   - [Cash Flow & Transactions Ledger](#53-cash-flow--transactions-ledger)
     - `GET /api/transactions`
     - `POST /api/transactions`
   - [Creator Onboarding](#54-creator-onboarding)
     - `POST /api/onboarding` (or `/api/onboarding/save`)
   - [Third-Party Integrations](#55-third-party-integrations)
     - `GET /api/integrations/phyllo/token` (or `POST /api/integrations/phyllo/token`)
   - [AI Cash Flow Advisory Proxy](#56-ai-cash-flow-advisory-proxy)
     - `POST /api/gemini`
   - [Administrator Command Portal](#57-administrator-command-portal)
     - `POST /api/admin/auth/login`
     - `GET /api/admin/auth/verify` (or `/api/admin/verify-auth`)
     - `GET /api/admin/metrics`
     - `GET /api/admin/creators`
     - `POST /api/admin/creators/:id/status`
     - `GET /api/admin/audit-logs`
     - `GET /api/admin/telemetry`
6. [Security & Privacy Governance](#6-security--privacy-governance)

---

## 1. Architecture & System Overview

Creator Cash Flow (CCF) is a financial management platform engineered for digital content creators, influencers, and independent creative businesses. The platform provides real-time income aggregation, expense tracking, sole-proprietor tax reserve estimation (15% ZAR), and generative AI financial intelligence.

### Backend Architecture
The backend is built as a modular Express.js application decoupled into:
- `config/`: Environment configuration (`config/env.js`) with production fail-fast assertions and CORS policies (`config/cors.js`).
- `middleware/`: Cryptographic authentication (`middleware/auth.js`, `middleware/adminAuth.js`), sliding-window rate limiters (`middleware/rateLimiter.js`), schema validators (`middleware/validation.js`), and centralized error handlers (`middleware/errorHandler.js`).
- `controllers/`: Business logic for authentication, admin operations, ledger entries, onboarding, integrations, and AI queries.
- `routes/`: Explicit route declarations mounted under `/api/*`.
- `services/`: Dual-write database services (`services/supabase.js`, `services/memoryDb.js`), password hashing (`services/bcrypt.js`), and unified Gemini AI services (`services/geminiService.js`).

### Dual-Storage Model
- **Primary:** Supabase Cloud PostgreSQL database for persistent, relational storage.
- **Fallback / In-Memory:** In-memory store (`memoryDb`) that automatically mirrors writes (dual-write). When Supabase is unavailable or in offline/test mode, the server operates continuously with zero downtime and bounded TTL cache eviction.

---

## 2. Authentication & Authorization

### 2.1 Creator JWT Authentication
Creator routes require standard JSON Web Tokens (JWT) passed in the HTTP `Authorization` header using the `Bearer` scheme:

```http
Authorization: Bearer <creator_jwt_token>
```

Creator tokens are signed using HMAC-SHA256 with `process.env.JWT_SECRET` and contain:
```json
{
  "id": "usr_1725465600000_a1b2c3d4",
  "email": "creator@example.com",
  "name": "Jane Creator",
  "iat": 1725465600,
  "exp": 1726070400
}
```
Creator tokens expire after **7 days**.

### 2.2 Offline & Demo Mode Tokens
To support seamless demonstration environments, offline testing, and frontend preview modes without network egress, the `authenticateToken` middleware accepts two special offline bypass tokens:
- `demo_token`
- `offline_token`

When either of these tokens is supplied, the request is authenticated with a virtual session:
```json
{
  "id": "demo_creator_user",
  "email": "demo@creatorcashflow.com",
  "name": "Demo Creator"
}
```

### 2.3 Administrator Authentication & Role Enforcement
Administrative routes (`/api/admin/*`, with the exception of `/api/admin/auth/login`) are protected by the `requireAdmin` middleware.

- **Admin Login:** Handled via `POST /api/admin/auth/login`.
- **Token Claims:** The signed JWT must contain `{ role: 'admin' }`.
- **Token Lifetime:** Admin tokens expire after **24 hours**.
- **Role Check Enforcement:** If a token is omitted, invalid, or possesses a role other than `'admin'`, the server immediately rejects the request:
  - Missing token: `HTTP 401 Unauthorized` (`{ "error": "Access token required" }`)
  - Expired or malformed token: `HTTP 401 Unauthorized` (`{ "error": "Invalid or expired token" }`)
  - Non-admin role: `HTTP 403 Forbidden` (`{ "error": "Forbidden: Administrative privileges required" }`)

---

## 3. Rate Limiting Policies

### 3.1 Sliding-Window Architecture
Creator Cash Flow employs in-memory sliding-window rate limiters with active background TTL cleanup. Each tracker maintains millisecond timestamps of incoming requests, purging expired records on intervals via unreferenced timers (`unref()`), ensuring process clean shutdown in test harnesses.

### 3.2 Client IP Resolution
Client IP addresses are extracted via `getClientIp(req)`:
1. Checks the `X-Forwarded-For` header (first IP in comma-separated list), supporting proxies such as Render, Vercel, Cloudflare, or AWS ALB.
2. Falls back to `req.ip` or `req.socket.remoteAddress`.
3. Defaults to `'127.0.0.1'` if unresolvable.

### 3.3 Rate Limit Thresholds

| Endpoint Scope | Path | Window | Max Requests | Capacity Cap | Key Generator |
|---|---|---|---|---|---|
| **Admin Login** | `POST /api/admin/auth/login` | 15 minutes | 5 attempts | 1,000 IPs | Client IP |
| **Creator Auth** | `POST /api/auth/login`, `/signup`, `/register` | 15 minutes | 10 requests | 1,000 IPs | Client IP |
| **Ledger Operations** | `GET`, `POST /api/transactions` | 1 minute | 60 requests | 2,000 keys | User ID (fallback IP) |
| **Admin Mutations** | `POST /api/admin/creators/:id/status` | 1 minute | 30 requests | 500 keys | Admin ID (fallback IP) |
| **Gemini AI Proxy** | `POST /api/gemini` | 1 minute | 15 requests | 500 keys | Client IP |

### 3.4 HTTP 429 Semantics & Retry-After
When a client exceeds the allowable rate threshold, the server responds with:
- **HTTP Status:** `429 Too Many Requests`
- **Header:** `Retry-After: <seconds>` (number of seconds until the oldest request exits the window)
- **Body:**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again after 42 seconds.",
  "retryAfterSeconds": 42
}
```

---

## 4. Error Handling & Envelope Standards

### 4.1 Standard Error Envelope
All error responses generated by the application conform to a unified JSON error envelope:

```json
{
  "success": false,
  "error": "Descriptive human-readable error explanation.",
  "code": "STANDARDIZED_ERROR_CODE"
}
```

### 4.2 HTTP Status Codes Reference

| HTTP Code | Description | Typical Use Cases |
|---|---|---|
| **200 OK** | Request succeeded | Successful GET, status mutation, or AI advisory response. |
| **201 Created** | Resource created | Successful registration (`/api/auth/register`) or transaction (`/api/transactions`). |
| **400 Bad Request** | Input validation failure | Invalid payload, schema violation, out-of-bounds amount, malformed email. |
| **401 Unauthorized** | Missing or invalid auth | Absent Bearer token, invalid signature, incorrect password. |
| **403 Forbidden** | Insufficient privileges | Non-admin token accessing `/api/admin/*`, or blocked CORS origin. |
| **404 Not Found** | Resource or route missing | Unrecognized route (`ROUTE_NOT_FOUND`) or non-existent creator ID. |
| **429 Too Many Requests** | Rate limit tripped | Exceeded request quota; includes `Retry-After` header. |
| **500 Internal Server Error** | Unexpected server failure | Database crash, unhandled runtime exception. |
| **503 Service Unavailable** | External dependency error | Supabase ping failure or upstream Gemini AI outage. |

---

## 5. API Endpoint Specifications

### 5.1 Health & Diagnostics

#### `GET /api/health`
Performs comprehensive real-time system diagnostics including database ping latency, Node.js process heap memory, system uptime, and external integration configuration status.

- **Authentication:** None (Public)
- **Rate Limit:** Unrestricted
- **Response Codes:** `200 OK` (healthy / active), `503 Service Unavailable` (degraded)

**Sample Request:**
```bash
curl -X GET http://localhost:5000/api/health
```

**Sample Response (200 OK):**
```json
{
  "name": "Creator Cash Flow API Engine",
  "status": "active",
  "state": "healthy",
  "version": "3.0.0",
  "timestamp": "2026-09-04T16:00:00.000Z",
  "uptimeSeconds": 1420,
  "database": "Memory Backup",
  "databaseDetails": {
    "provider": "Memory Backup",
    "status": "connected",
    "latencyMs": 1
  },
  "memory": {
    "heapUsedMB": 38.45,
    "heapTotalMB": 52.18,
    "rssMB": 72.11,
    "externalMB": 4.12
  },
  "inMemoryStores": {
    "rateLimitTrackedIps": 1,
    "auditLogsCount": 14,
    "telemetryCount": 6
  },
  "integrations": {
    "gemini": {
      "configured": true,
      "model": "gemini-1.5-flash"
    },
    "phyllo": {
      "configured": false
    },
    "resend": {
      "configured": false
    }
  },
  "security": "AES-256-CBC + JWT",
  "documentation": "https://creatorcashflow.co.za/"
}
```

---

### 5.2 Creator Authentication

#### `POST /api/auth/register` (Alias: `POST /api/auth/signup`)
Registers a new creator, securely hashes their password with bcrypt, stores the account in Supabase (or memoryDb fallback), pre-seeds starting demo ledger entries, dispatches a welcome email via Resend (if configured), and issues a 7-day JWT.

- **Authentication:** None (Public)
- **Rate Limit:** 10 requests / 15 minutes per IP
- **Headers:** `Content-Type: application/json`

**Request Body Parameters:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | Yes | 2–70 characters, sanitized |
| `email` | string | Yes | Valid email format, max 254 characters |
| `password` | string | Yes | 8–128 characters |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Sarah Miller", "email": "sarah@creatorflow.io", "password": "SecurePassword2026!"}'
```

**Sample Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful!",
  "userId": "usr_1725465600000_fa82910c",
  "email": "sarah@creatorflow.io",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` (`INVALID_NAME_LENGTH`, `INVALID_EMAIL_FORMAT`, `INVALID_PASSWORD_LENGTH`, `EMAIL_ALREADY_EXISTS`)
- `429 Too Many Requests` (Rate limit exceeded)

---

#### `POST /api/auth/login`
Authenticates an existing creator against their bcrypt password hash and returns an active JWT session token and user profile.

- **Authentication:** None (Public)
- **Rate Limit:** 10 requests / 15 minutes per IP
- **Headers:** `Content-Type: application/json`

**Request Body Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Account email address |
| `password` | string | Yes | Account plaintext password |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah@creatorflow.io", "password": "SecurePassword2026!"}'
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_1725465600000_fa82910c",
    "name": "Sarah Miller",
    "email": "sarah@creatorflow.io"
  }
}
```

**Error Responses:**
- `400 Bad Request` (`MISSING_EMAIL`, `MISSING_PASSWORD`)
- `401 Unauthorized` (`INVALID_CREDENTIALS`)

---

### 5.3 Cash Flow & Transactions Ledger

#### `GET /api/transactions`
Retrieves the authenticated creator's chronological income and expense ledger entries.

- **Authentication:** Creator JWT (`Bearer <token>`)
- **Rate Limit:** 60 requests / minute per user/IP
- **Headers:** `Authorization: Bearer <token>`

**Sample Request:**
```bash
curl -X GET http://localhost:5000/api/transactions \
  -H "Authorization: Bearer <creator_jwt>"
```

**Sample Response (200 OK):**
```json
{
  "transactions": [
    {
      "id": "tx_1725465600100",
      "date": "Sep 4",
      "source": "YouTube AdSense",
      "merchant": "Google Ireland Ltd",
      "type": "income",
      "category": "Ad Revenue",
      "taxStatus": "Taxable Income",
      "amount": 14250.00
    },
    {
      "id": "tx_1725465600200",
      "date": "Sep 3",
      "source": "Operating Expense",
      "merchant": "Sony Alpha Camera Store",
      "type": "expense",
      "category": "Gear & Equipment",
      "taxStatus": "100% Tax Write-Off",
      "amount": 8999.00
    }
  ]
}
```

---

#### `POST /api/transactions`
Records a new cash flow entry (income or expense) into the creator's ledger with strict schema validation, input sanitization, and dual-write persistence.

- **Authentication:** Creator JWT (`Bearer <token>`)
- **Rate Limit:** 60 requests / minute per user/IP
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`

**Request Body Parameters:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | string | Yes | Strictly `'income'` or `'expense'` |
| `amount` | number / string | Yes | Positive finite number > 0, max 100,000,000 |
| `merchant` | string | Yes | 1–100 characters (also accepts `desc` alias) |
| `source` | string | No | Optional platform source (max 50 chars) |
| `category` | string | No | Optional classification (max 50 chars) |
| `date` | string | No | Optional date label (defaults to current date e.g. "Sep 4") |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <creator_jwt>" \
  -d '{
    "type": "income",
    "amount": 25000.00,
    "merchant": "NordVPN Sponsorship",
    "source": "Brand Deals",
    "category": "Sponsorships"
  }'
```

**Sample Response (201 Created):**
```json
{
  "success": true,
  "message": "Transaction saved successfully.",
  "transaction": {
    "id": "tx_1725465600300",
    "date": "Sep 4",
    "source": "Brand Deals",
    "merchant": "NordVPN Sponsorship",
    "type": "income",
    "category": "Sponsorships",
    "taxStatus": "Taxable Income",
    "amount": 25000.00
  }
}
```

**Error Responses:**
- `400 Bad Request` (`INVALID_TRANSACTION_TYPE`, `MISSING_AMOUNT`, `INVALID_AMOUNT`, `AMOUNT_EXCEEDS_LIMIT`, `INVALID_MERCHANT_LENGTH`)
- `401 Unauthorized` (Token missing or expired)

---

### 5.4 Creator Onboarding

#### `POST /api/onboarding` (Alias: `POST /api/onboarding/save`)
Stores the creator's selections from the 3-Step Onboarding Wizard, including business type, linked platform channels, primary financial objective, and connection status.

- **Authentication:** Creator JWT or Offline Token (`Bearer <token>`)
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`

**Request Body Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `creatorType` | string | No | Business type (e.g. "Full-time Creator", "Agency") |
| `platforms` | array | No | Linked platforms (e.g. `["YouTube", "TikTok"]`) |
| `goal` | string | No | Selected objective (e.g. "Understand my profitability") |
| `connected` | boolean | No | Whether Phyllo or direct API connection was established |
| `isManual` | boolean | No | Whether manual fallback bypass was used |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/onboarding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer offline_token" \
  -d '{
    "creatorType": "Solo Creator",
    "platforms": ["YouTube", "Patreon"],
    "goal": "My profitability",
    "connected": true,
    "isManual": false
  }'
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding responses saved successfully."
}
```

---

### 5.5 Third-Party Integrations

#### `GET /api/integrations/phyllo/token` (Alias: `POST /api/integrations/phyllo/token`)
Generates a Phyllo Connect SDK token for linking YouTube, TikTok, Instagram, Twitch, and Patreon creator accounts. Maps active work platforms dynamically.

- **Authentication:** Optional Creator JWT (falls back to guest mode if absent)
- **Headers:** `Authorization: Bearer <token>` (optional)

**Sample Request:**
```bash
curl -X GET http://localhost:5000/api/integrations/phyllo/token
```

**Sample Response (200 OK):**
```json
{
  "sdkToken": "phyllo_sdk_token_live_sandbox_99a81bc...",
  "phylloUserId": "usr_phyllo_8829102",
  "platforms": {
    "YouTube": "14f10034-783b-483b-b23a-f100234a9912",
    "TikTok": "22e20011-992a-431c-a11b-c290123e4401",
    "Patreon": "33a30022-881b-412d-b22c-d380234f5512"
  }
}
```

---

### 5.6 AI Cash Flow Advisory Proxy

#### `POST /api/gemini`
Proxies natural language financial advisory prompts to Google Gemini 1.5 Flash. Applies automated PII masking (redacting emails, phone numbers, and raw ZAR monetary amounts) before logging query telemetry with a 30-day automated TTL policy.

- **Authentication:** None (Public proxy with rate limiting)
- **Rate Limit:** 15 queries / minute per IP
- **Headers:** `Content-Type: application/json`

**Request Body Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | Natural language query regarding creator cash flow, taxes, or budgeting |
| `systemContext` | string | No | Optional persona prompt context (e.g. "Business Analyst AI") |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Can I deduct my new Sony camera purchase as a business expense under South African tax guidelines?",
    "systemContext": "You are Creator Cash Flow Business Analyst AI."
  }'
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "text": "Yes, as a South African sole-proprietor or registered creator, equipment used exclusively for content production (such as cameras, lenses, and lighting) qualifies as a deductible operational expense or capital allowance under Section 11(e) of the Income Tax Act.",
  "source": "Gemini 1.5 Flash (Backend API)",
  "categoryTag": "Gear Purchase Planning",
  "tokensUsed": 164
}
```

**Error Responses:**
- `400 Bad Request` (`INVALID_PROMPT`)
- `429 Too Many Requests` (Rate limit exceeded)
- `503 Service Unavailable` (`AI_SERVICE_ERROR`, Gemini API key missing or upstream timeout)

---

### 5.7 Administrator Command Portal

#### `POST /api/admin/auth/login`
Authenticates an administrator with salted bcrypt password comparison and issues an administrative JWT containing `{ role: 'admin' }`. Protected by brute-force rate limiting (5 attempts / 15 min).

- **Authentication:** None (Public login gate)
- **Rate Limit:** 5 attempts / 15 minutes per IP
- **Headers:** `Content-Type: application/json`

**Request Body Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Administrator email address |
| `password` | string | Yes | Administrator password |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@creatorcashflow.com", "password": "SecureAdminPassword2026!"}'
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "admin_master_1",
    "email": "admin@creatorcashflow.com",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400 Bad Request` (`Email and password are required.`)
- `401 Unauthorized` (`Invalid credentials`)
- `429 Too Many Requests` (`Too many login attempts`)

---

#### `GET /api/admin/auth/verify` (Alias: `GET /api/admin/verify-auth`)
Verifies that the caller's JWT token has active administrative privileges (`role: 'admin'`).

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <admin_jwt>`

**Sample Response (200 OK):**
```json
{
  "success": true,
  "admin": {
    "id": "admin_master_1",
    "email": "admin@creatorcashflow.com",
    "role": "admin"
  }
}
```

**Error Responses:**
- `401 Unauthorized` (Token missing or expired)
- `403 Forbidden` (Token role is not `'admin'`)

---

#### `GET /api/admin/metrics`
Calculates platform-wide aggregate financial metrics, KPI scorecards, channel revenue breakdown, and a 6-month historical growth timeline for Chart.js rendering.

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <admin_jwt>`

**Sample Request:**
```bash
curl -X GET http://localhost:5000/api/admin/metrics \
  -H "Authorization: Bearer <admin_jwt>"
```

**Sample Response (200 OK):**
```json
{
  "totalCreators": 24,
  "gpvZar": 482500.00,
  "mrrZar": 4186.00,
  "taxReservesZar": 72375.00,
  "channelBreakdown": {
    "youtube": 184500.00,
    "tiktok": 92000.00,
    "patreon": 68000.00,
    "brand_deals": 138000.00
  },
  "timeline": [
    { "month": "Apr", "gpv": 80416, "mrr": 697, "creators": 4 },
    { "month": "May", "gpv": 160833, "mrr": 1395, "creators": 8 },
    { "month": "Jun", "gpv": 241250, "mrr": 2093, "creators": 12 },
    { "month": "Jul", "gpv": 321666, "mrr": 2790, "creators": 16 },
    { "month": "Aug", "gpv": 402083, "mrr": 3488, "creators": 20 },
    { "month": "Sep", "gpv": 482500, "mrr": 4186, "creators": 24 }
  ]
}
```

---

#### `GET /api/admin/creators`
Returns the complete creator directory with subscription plan tiers and account status.

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <admin_jwt>`

**Sample Response (200 OK):**
```json
[
  {
    "id": "usr_1725465600000_fa82910c",
    "name": "Sarah Miller",
    "email": "sarah@creatorflow.io",
    "plan_tier": "Pro",
    "status": "active",
    "created_at": "2026-09-04T12:00:00.000Z"
  }
]
```

---

#### `POST /api/admin/creators/:id/status`
Updates a creator's account status (`'active'` or `'suspended'`) and subscription plan tier (`'Pro'` or `'Free'`). Automatically records an immutable entry into the audit trail ledger with SHA-256 IP address hashing.

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Rate Limit:** 30 mutations / minute per admin/IP
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <admin_jwt>`

**Request Body Parameters:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `status` | string | No | `'active'` or `'suspended'` |
| `plan_tier` | string | No | `'Pro'` or `'Free'` (also accepts `planTier`) |
| `note` | string | No | Optional audit note (max 500 chars) |

**Sample Request:**
```bash
curl -X POST http://localhost:5000/api/admin/creators/usr_1725465600000_fa82910c/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_jwt>" \
  -d '{
    "status": "suspended",
    "plan_tier": "Free",
    "note": "Account under compliance review"
  }'
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "creator": {
    "id": "usr_1725465600000_fa82910c",
    "name": "Sarah Miller",
    "email": "sarah@creatorflow.io",
    "plan_tier": "Free",
    "status": "suspended",
    "created_at": "2026-09-04T12:00:00.000Z"
  },
  "audit_entry": {
    "id": "audit_1725465600400_b2c3d4e5",
    "admin_id": "admin_master_1",
    "target_creator_id": "usr_1725465600000_fa82910c",
    "action_type": "STATUS_AND_TIER_CHANGE",
    "old_value": "{\"status\":\"active\",\"plan_tier\":\"Pro\"}",
    "new_value": "{\"status\":\"suspended\",\"plan_tier\":\"Free\",\"note\":\"Account under compliance review\"}",
    "timestamp": "2026-09-04T16:05:00.000Z",
    "ip_hash": "a1f948e2b83c019d"
  }
}
```

**Error Responses:**
- `400 Bad Request` (`INVALID_STATUS_VALUE`, `INVALID_PLAN_TIER_VALUE`, `NOTE_TOO_LONG`, `EMPTY_MUTATION_PAYLOAD`)
- `404 Not Found` (`CREATOR_NOT_FOUND`)

---

#### `GET /api/admin/audit-logs`
Retrieves chronological immutable administrative audit logs.

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <admin_jwt>`

**Sample Response (200 OK):**
```json
[
  {
    "id": "audit_1725465600400_b2c3d4e5",
    "admin_id": "admin_master_1",
    "target_creator_id": "usr_1725465600000_fa82910c",
    "action_type": "STATUS_AND_TIER_CHANGE",
    "old_value": "{\"status\":\"active\",\"plan_tier\":\"Pro\"}",
    "new_value": "{\"status\":\"suspended\",\"plan_tier\":\"Free\",\"note\":\"Account under compliance review\"}",
    "timestamp": "2026-09-04T16:05:00.000Z",
    "ip_hash": "a1f948e2b83c019d"
  }
]
```

---

#### `GET /api/admin/telemetry`
Retrieves PII-masked query telemetry from the Gemini AI advisory assistant. Automatically filters out entries older than 30 days pursuant to the automated privacy TTL retention policy.

- **Authentication:** Admin JWT (`Bearer <token>`)
- **Headers:** `Authorization: Bearer <admin_jwt>`

**Sample Response (200 OK):**
```json
[
  {
    "id": "tel_1725465600500_c3d4e5f6",
    "category_tag": "Gear Purchase Planning",
    "prompt_masked": "Can I deduct my new Sony camera purchase as a business expense under South African tax guidelines?",
    "tokens_used": 164,
    "model": "gemini-1.5-flash",
    "latency_ms": 242,
    "created_at": "2026-09-04T16:04:00.000Z"
  }
]
```

---

## 6. Security & Privacy Governance

1. **Zero Hardcoded Secrets & PII**:
   All sensitive credentials (passwords, JWT secrets, encryption keys, personal developer emails) are strictly managed via environment variables (`.env`). The codebase enforces zero hardcoded secrets.
2. **CORS Whitelist**:
   Cross-Origin Resource Sharing is locked to authorized origins (`https://creatorcashflow.co.za`, `https://www.creatorcashflow.co.za`, `http://localhost:5000`, `http://127.0.0.1:5000`, `http://localhost:3000`). Unlisted origins receive `HTTP 403 Forbidden` (`CORS_ERROR`).
3. **PII Masking & Privacy**:
   Natural language queries sent to `/api/gemini` pass through regex-based PII scrubbers (`maskPII()`) that redact email addresses, phone numbers, and ZAR currency values before telemetry retention.
4. **Audit Immutability**:
   Administrative actions generate cryptographically traceable audit records with 16-character SHA-256 IP hashes, preventing plaintext IP storage while enabling accountability.
