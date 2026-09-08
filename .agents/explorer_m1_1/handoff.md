# Handoff Report: `requireAdmin` Middleware Implementation Design (Milestone M1)

## 1. Observation
- **Project Structure**: Express REST API server located at `server.js` (`c:\Users\User\OneDrive\Desktop\New folder (2)\server.js`).
- **Dependencies**: `jsonwebtoken` (v9.0.2) and `bcryptjs` (v2.4.3) are installed as specified in `package.json` lines 12 & 17.
- **Existing Auth Middleware**: `authenticateToken` function at `server.js:73-91` checks `req.headers['authorization']`, allows `demo_token`/`offline_token`, calls `jwt.verify(token, JWT_SECRET)`, and returns HTTP 403 on JWT error or HTTP 401 on missing token.
- **Master Spec & Acceptance Criteria**: `PROJECT.md` (F02, F04, M1 scope) and `ORIGINAL_REQUEST.md` (R1, R6) specify that `requireAdmin` must protect all `/api/admin/*` endpoints, check Bearer JWT signature with `JWT_SECRET`, enforce `role === 'admin'`, and return HTTP 401 (missing/invalid token) or HTTP 403 (unauthorized role).

## 2. Logic Chain
1. **Header Parsing**: `requireAdmin` must extract `req.headers['authorization']`, check for `Bearer <token>` format, and reject missing or malformed headers immediately with HTTP 401 (`{ error: 'Admin authorization header required' }`).
2. **Signature Verification**: `jwt.verify(token, JWT_SECRET)` verifies token authenticity and expiration. Any verification error (tampered token, expired token, malformed signature, or demo token bypass attempt) must trigger an HTTP 401 Unauthorized response (`{ error: 'Invalid or expired admin session token' }`).
3. **Role Check**: Once signature is verified, `requireAdmin` checks `decoded.role === 'admin'`. If `role` is missing or not equal to `'admin'`, identity is confirmed but privileges are insufficient, returning HTTP 403 Forbidden (`{ error: 'Forbidden: Insufficient privileges. Admin role required.' }`).
4. **Context Propagation**: On successful authorization (`role === 'admin'`), `req.user` is populated with `decoded` payload and `next()` is called, allowing downstream handlers (e.g. status mutation, audit logging) access to `req.user.id` and `req.user.email`.

## 3. Caveats
- `JWT_SECRET` must be synchronized between token signing in `POST /api/admin/auth/login` and token verification in `requireAdmin`. Default fallback string `'fallback-creator-cashflow-secret-key-2026'` is defined in `server.js:16`.
- `requireAdmin` must NOT allow demo tokens (`demo_token` or `offline_token`), unlike the standard `authenticateToken` middleware used for creator endpoints.
- `/api/admin/auth/login` must NOT have `requireAdmin` applied, as it is the public login gateway.

## 4. Conclusion
The implementation design for `requireAdmin` middleware is fully formulated, documented in `analysis.md`, and ready for implementation in `server.js` by Implementer M1.

## 5. Verification Method
- **Inspection**: Review `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_m1_1\analysis.md` for exact function signature, status code matrices, and route mounting strategies.
- **Code Check**: Once implemented in `server.js`, test with HTTP requests:
  - Missing token -> HTTP 401
  - Invalid / Expired token -> HTTP 401
  - Token with `role: 'creator'` -> HTTP 403
  - Token with `role: 'admin'` -> HTTP 200 / Next middleware
