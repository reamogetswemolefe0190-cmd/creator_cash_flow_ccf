# Creator Cash Flow Backend Survey & Architectural Analysis

## 1. Executive Summary
This document details the survey and architectural analysis of the **Creator Cash Flow** backend REST API server. The backend is built using Express.js on Node.js with a dual-persistence architecture: primary storage via Supabase Cloud PostgreSQL, with a fallback in-memory database (`memoryDb`) for high reliability and local testing.

---

## 2. Server Entry Points & Server Architecture

### 2.1 File Locations & Configuration
- **Primary Entry Point**: `server.js` (declared in `package.json` `"main": "server.js"` and `"start": "node server.js"`)
- **Serverless Proxies**: 
  - `api/gemini.js` (Vercel serverless function proxy)
  - `netlify/functions/gemini.js` (Netlify function handler delegating to `api/gemini.js`)
- **Default Port**: `process.env.PORT || 5000`
- **Environment Variables**:
  - `PORT`: Server listen port
  - `JWT_SECRET`: Secret key for JWT signing & verification (fallback: `'fallback-creator-cashflow-secret-key-2026'`)
  - `ENCRYPTION_KEY`: 32-byte key for AES-256-CBC
  - `SUPABASE_URL`: Supabase project URL (`https://iekofqagtcztyavhunai.supabase.co`)
  - `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`: Supabase API credentials
  - `ADMIN_PASSWORD`: Master admin password override
  - `RESEND_API_KEY`: API key for sending welcome emails via Resend
  - `PHYLLO_AUTH_HEADER`: Auth header for Phyllo integrations API
  - `GEMINI_API_KEY`: API key for Gemini 1.5 Flash AI requests

### 2.2 Global Middleware Pipeline
1. `helmet({ contentSecurityPolicy: false })`: Express security headers (CSP disabled for inline demo scripts & external CDNs).
2. `cors({ origin: '*', credentials: true })`: CORS headers for cross-origin requests.
3. `express.json()`: Request body parsing for JSON payloads.
4. `express.static(__dirname)`: Serving static frontend files (e.g. `index.html`, `admin.html`, `app.js`, `style.css`).

### 2.3 Custom Middleware Modules
1. **`authenticateToken(req, res, next)`** (`server.js:298-316`):
   - **Header**: `Authorization: Bearer <token>`
   - **Bypass Tokens**: `'demo_token'` and `'offline_token'` set `req.user = { id: 'demo_creator_user', email: 'demo@creatorcashflow.com', name: 'Demo Creator' }`.
   - **Verification**: Verifies JWT using `JWT_SECRET`. If invalid/expired, returns `HTTP 403 Forbidden` (`{ error: 'Invalid or expired session token' }`). If missing token, returns `HTTP 401 Unauthorized` (`{ error: 'Access token required' }`).
   - **Attached Payload**: Sets `req.user` decoded from token payload `{ id, email, name }`.

2. **`requireAdmin(req, res, next)`** (`server.js:239-257`):
   - **Header**: `Authorization: Bearer <token>`
   - **Verification**: Verifies JWT using `JWT_SECRET`.
   - **Authorization**: Checks `decoded.role === 'admin'`. If role is missing or not `'admin'`, returns `HTTP 403 Forbidden` (`{ error: 'Forbidden: Administrative privileges required' }`). If missing token or invalid token, returns `HTTP 401 Unauthorized`.
   - **Attached Payload**: Sets `req.admin` decoded from token payload `{ id, email, role }`.

3. **`rateLimitAdminLogin(req, res, next)`** (`server.js:200-236`):
   - **Scope**: Applied to `POST /api/admin/auth/login`.
   - **Limit**: Max 5 failed/successful login attempts per IP within a sliding 15-minute window (`15 * 60 * 1000 ms`).
   - **Response when exceeded**: `HTTP 429 Too Many Requests` (`{ error: 'Too many login attempts', message: '...', retryAfterSeconds: number }`).

---

## 3. Authentication & Authorization Endpoints

### 3.1 Creator Registration (`POST /api/auth/signup`)
- **File**: `server.js:323-445`
- **Authentication**: Public (None)
- **HTTP Method**: `POST`
- **Endpoint URL**: `/api/auth/signup`
- **Request Headers**: `Content-Type: application/json`
- **Request Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123!",
    "name": "Jane Creator"
  }
  ```
- **Validation Rules**:
  - `email`, `password`, and `name` are mandatory. Returns `400` if any are missing (`{ error: 'Name, email, and password are required.' }`).
  - Checks duplicate email in Supabase `users` table / `memoryDb.users`. Returns `400` if email exists (`{ error: 'An account with this email already exists.' }`).
- **Processing Logic**:
  - Hashes password using `bcrypt.hash(password, 10)`.
  - Generates `userId` formatted as `usr_<timestamp>_<4_random_hex_bytes>`.
  - Seeds default starter transactions for the new creator via `seedDefaultTransactions(userId)`.
  - Dispatches welcome transactional email via Resend API if `RESEND_API_KEY` is configured.
- **Success Response** (`HTTP 201 Created`):
  ```json
  {
    "message": "Registration successful!",
    "userId": "usr_1770503000000_a1b2c3d4",
    "email": "user@example.com"
  }
  ```
- **Error Responses**:
  - `HTTP 400 Bad Request`: Validation failure or existing user.
  - `HTTP 500 Internal Server Error`: `{ error: 'Server error during signup.' }`

---

### 3.2 Creator Authentication (`POST /api/auth/login`)
- **File**: `server.js:448-496`
- **Authentication**: Public (None)
- **HTTP Method**: `POST`
- **Endpoint URL**: `/api/auth/login`
- **Request Headers**: `Content-Type: application/json`
- **Request Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123!"
  }
  ```
- **Validation & Auth Logic**:
  - Looks up user by lowercased email in Supabase `users` or `memoryDb.users`. Returns `401` (`{ error: 'Invalid email or password.' }`) if not found.
  - Validates password using `bcrypt.compare(password, user.passwordHash)`. Returns `401` on mismatch.
- **JWT Token Generation**:
  - Signed with `JWT_SECRET`.
  - Expiration: `7d` (7 days).
  - Payload: `{ id: string, email: string, name: string }`
- **Success Response** (`HTTP 200 OK`):
  ```json
  {
    "message": "Login successful",
    "token": "<JWT_STRING>",
    "user": {
      "id": "usr_1770503000000_a1b2c3d4",
      "name": "Jane Creator",
      "email": "user@example.com"
    }
  }
  ```
- **Error Responses**:
  - `HTTP 401 Unauthorized`: Invalid credentials.
  - `HTTP 500 Internal Server Error`: `{ error: 'Server error during login.' }`

---

### 3.3 Admin Authentication (`POST /api/admin/auth/login`)
- **File**: `server.js:503-572`
- **Authentication**: Public (guarded by `rateLimitAdminLogin`)
- **HTTP Method**: `POST`
- **Endpoint URL**: `/api/admin/auth/login`
- **Request Headers**: `Content-Type: application/json`
- **Request Payload**:
  ```json
  {
    "email": "reamogetswemolefe0190@gmail.com",
    "password": "R3@m0g3tsw3M0l3f3"
  }
  ```
- **Validation & Auth Logic**:
  - Evaluates rate limiting (max 5 attempts per 15 mins).
  - Validates `email` and `password` presence (`400 Bad Request`).
  - Looks up normalized email in Supabase `admin_users` or `memoryDb.adminUsers`. Returns `401` (`{ error: 'Invalid credentials' }`) if missing.
  - Validates password hash via `bcrypt.compare`.
- **JWT Token Generation**:
  - Signed with `JWT_SECRET`.
  - Expiration: `24h` (24 hours).
  - Payload: `{ id: string, email: string, role: 'admin' }`
- **Success Response** (`HTTP 200 OK`):
  ```json
  {
    "success": true,
    "token": "<ADMIN_JWT_STRING>",
    "admin": {
      "id": "admin_master_1",
      "email": "reamogetswemolefe0190@gmail.com",
      "role": "admin"
    }
  }
  ```
- **Error Responses**:
  - `HTTP 400 Bad Request`: Missing fields.
  - `HTTP 401 Unauthorized`: Invalid credentials.
  - `HTTP 429 Too Many Requests`: Rate limit exceeded.
  - `HTTP 500 Internal Server Error`: `{ error: 'Server error during admin authentication.' }`

---

### 3.4 Admin Verify Session (`GET /api/admin/verify-auth`)
- **File**: `server.js:575-577`
- **Authentication**: Protected (`requireAdmin`)
- **HTTP Method**: `GET`
- **Endpoint URL**: `/api/admin/verify-auth`
- **Request Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Success Response** (`HTTP 200 OK`):
  ```json
  {
    "success": true,
    "admin": {
      "id": "admin_master_1",
      "email": "reamogetswemolefe0190@gmail.com",
      "role": "admin"
    }
  }
  ```

---

## 4. Transaction & Cash Flow Ledger Endpoints

### 4.1 Get User Transactions (`GET /api/transactions`)
- **File**: `server.js:942-974`
- **Authentication**: Protected (`authenticateToken`)
- **HTTP Method**: `GET`
- **Endpoint URL**: `/api/transactions`
- **Request Headers**: `Authorization: Bearer <USER_JWT>`
- **Query Parameters**: None (returns all transaction records associated with `req.user.id`).
- **Database Query**:
  - Supabase: `supabase.from('transactions').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })`
  - Memory fallback: `memoryDb.transactions.filter(t => t.user_id === req.user.id)`
- **Response Format Mapping**: Converts DB `tax_status` field to camelCase `taxStatus` in output array.
- **Success Response** (`HTTP 200 OK`):
  ```json
  {
    "transactions": [
      {
        "id": "tx_seed_101",
        "date": "Feb 20",
        "source": "YouTube",
        "merchant": "Google AdSense SA",
        "type": "income",
        "category": "YouTube AdSense",
        "taxStatus": "Taxable Income",
        "amount": 45000.00
      }
    ]
  }
  ```
- **Error Response**:
  - `HTTP 401 Unauthorized`: Token missing.
  - `HTTP 403 Forbidden`: Token invalid.
  - `HTTP 500 Internal Server Error`: `{ error: 'Failed to retrieve ledger data.' }`

---

### 4.2 Create Transaction (`POST /api/transactions`)
- **File**: `server.js:977-1019`
- **Authentication**: Protected (`authenticateToken`)
- **HTTP Method**: `POST`
- **Endpoint URL**: `/api/transactions`
- **Request Headers**:
  - `Authorization: Bearer <USER_JWT>`
  - `Content-Type: application/json`
- **Request Payload**:
  ```json
  {
    "source": "YouTube",
    "merchant": "Google AdSense South Africa",
    "type": "income",
    "category": "YouTube AdSense",
    "amount": 15000.00,
    "date": "Aug 09"
  }
  ```
- **Field Defaults & Business Rules**:
  - `id`: `tx_<timestamp>`
  - `user_id`: `req.user.id`
  - `date`: defaults to current date in `MMM DD` format if omitted.
  - `category`: defaults to `'Creator Revenue'` if `type === 'income'`, else `'Operating Expense'`.
  - `tax_status`: defaults to `'Taxable Income'` if `type === 'income'`, else `'100% Tax Write-Off'`.
  - `amount`: parsed via `parseFloat(amount)`.
- **Persistence**: Inserted into Supabase `transactions` table or unshifted to `memoryDb.transactions`.
- **Success Response** (`HTTP 201 Created`):
  ```json
  {
    "message": "Transaction saved successfully.",
    "transaction": {
      "id": "tx_1770503500000",
      "date": "Aug 09",
      "source": "YouTube",
      "merchant": "Google AdSense South Africa",
      "type": "income",
      "category": "YouTube AdSense",
      "taxStatus": "Taxable Income",
      "amount": 15000.00
    }
  }
  ```
- **Error Responses**:
  - `HTTP 401 Unauthorized` / `403 Forbidden`
  - `HTTP 500 Internal Server Error`: `{ error: 'Failed to save transaction.' }`

---

## 5. Other Backend API Endpoints Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | Public | Health check and system status report |
| `/api/onboarding/save` | POST | User JWT | Save onboarding wizard responses |
| `/api/integrations/phyllo/token` | POST | Optional User JWT | Obtain Phyllo SDK user and connection token |
| `/api/admin/metrics` | GET | Admin JWT | Aggregate platform KPIs (GPV, MRR, Chart.js timeline) |
| `/api/admin/creators` | GET | Admin JWT | Retrieve complete creator directory |
| `/api/admin/creators/:id/status` | POST | Admin JWT | Update creator status/tier + record immutable audit log |
| `/api/admin/audit-logs` | GET | Admin JWT | Query chronological administrative audit trail |
| `/api/admin/telemetry` | GET | Admin JWT | Query PII-masked AI query logs (30-day TTL) |
| `/api/gemini` | POST | Public | Gemini 1.5 Flash AI proxy with PII masking & telemetry |

---

## 6. Architecture & Data Flow Summary

```
                 +-----------------------------------+
                 |           Client Layer            |
                 | (index.html, admin.html, app.js)  |
                 +-----------------+-----------------+
                                   |
                   Authorization: Bearer <JWT>
                                   |
                                   v
                 +-----------------------------------+
                 |          Express Server           |
                 |            (server.js)            |
                 +-----------------+-----------------+
                                   |
         +-------------------------+-------------------------+
         | Middleware Pipeline:                              |
         | - Helmet & CORS                                   |
         | - rateLimitAdminLogin (POST /api/admin/auth/login)|
         | - authenticateToken (User JWT)                    |
         | - requireAdmin (Admin JWT & role=='admin')        |
         +-------------------------+-------------------------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
     +-------------------------+       +--------------------------+
     |   Supabase Cloud DB     |       |    In-Memory Fallback    |
     |   (PostgreSQL REST API) |       |        (memoryDb)        |
     +-------------------------+       +--------------------------+
```
