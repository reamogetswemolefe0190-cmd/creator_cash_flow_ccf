# Handoff Report — Creator Cash Flow Backend Survey

## 1. Observation
- **Server Entry Point**: `server.js` (`package.json:5`). Runs on port 5000 (`process.env.PORT || 5000`).
- **Middleware Pipeline**: `helmet`, `cors`, `express.json()`, `express.static()`. Custom middlewares: `authenticateToken` (`server.js:298`), `requireAdmin` (`server.js:239`), `rateLimitAdminLogin` (`server.js:200`).
- **Auth Systems**:
  - Creator Auth: `/api/auth/signup` (`server.js:323`), `/api/auth/login` (`server.js:448`). Uses bcrypt password hashing and 7-day JWTs. Token bypasses available for `'demo_token'` / `'offline_token'`.
  - Admin Auth: `/api/admin/auth/login` (`server.js:503`), `/api/admin/verify-auth` (`server.js:575`). Uses bcrypt password hashing, 24-hour JWTs with explicit `role: 'admin'`, and rate limiting (5 attempts per 15 min window).
- **Transaction Endpoints**:
  - `GET /api/transactions` (`server.js:942`): Protected by `authenticateToken`. Queries transactions for `req.user.id`.
  - `POST /api/transactions` (`server.js:977`): Protected by `authenticateToken`. Creates transaction record with auto-assigned category/tax status defaults.
- **Dual Persistence Mechanism**: Primary Supabase Cloud PostgreSQL client via `@supabase/supabase-js`; automatic fallback to in-memory store (`memoryDb`) when Supabase credentials are unavailable.

## 2. Logic Chain
1. **Entry Point Verification**: `package.json` specifies `"main": "server.js"` and `"start": "node server.js"`. `server.js` imports Express, configures security headers, database connections, and routes.
2. **Auth Mechanism**:
   - `authenticateToken` parses `Authorization: Bearer <token>`, verifies JWT via `JWT_SECRET`, attaches decoded payload `{ id, email, name }` to `req.user`. Also handles demo tokens.
   - `requireAdmin` parses `Authorization: Bearer <token>`, verifies JWT, validates `decoded.role === 'admin'`, attaches `req.admin`.
3. **Transaction Flow**:
   - `GET /api/transactions` reads records matching `req.user.id` from Supabase or `memoryDb.transactions` and formats column fields.
   - `POST /api/transactions` extracts payload fields (`source`, `merchant`, `type`, `category`, `amount`, `date`), formats `tax_status` and ID, and writes to database.

## 3. Caveats
- No caveats. Server codebase was completely explored via read-only file inspection (`server.js`, `package.json`, `app.js`, `api/gemini.js`, `database_setup.sql`).

## 4. Conclusion
The Creator Cash Flow backend architecture is fully centered in `server.js` with clear routing separation across Auth (`/api/auth/*`), Admin (`/api/admin/*`), Transactions (`/api/transactions`), Onboarding (`/api/onboarding/*`), Phyllo (`/api/integrations/phyllo/*`), and Gemini AI (`/api/gemini`). All endpoint signatures, payloads, headers, and authentication rules have been mapped into `analysis.md`.

## 5. Verification Method
- Inspect `c:\Users\User\OneDrive\Desktop\New folder (2)\server.js` lines 200-317 for middleware definitions.
- Inspect lines 323-577 for Auth & Admin endpoints.
- Inspect lines 942-1019 for Transaction endpoints.
- Execute unit test scripts (e.g. `node test_admin_auth.js`) if needed.
