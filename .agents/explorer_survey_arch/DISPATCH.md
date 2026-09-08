# Dispatch Instructions for Explorer: Architecture & Codebase Mapping

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch`

## Role & Archetype
- Archetype: teamwork_preview_explorer
- Role: Architecture & Codebase Mapper

## Authoritative Reference
Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (specifically the latest follow-up from 2026-09-04T09:20:13Z) before starting.

## Mission & Objectives
Thoroughly explore the codebase at `c:\Users\User\OneDrive\Desktop\New folder (2)` to survey and map architectural structure, inputs/XSS, and memory safety, specifically targeting Requirements R2 & R3:
1. Examine `server.js` structure and map all routes, controllers, middleware, and database services currently bundled in it. Detail how it can be cleanly decomposed into modules (`routes/`, `controllers/`, `middleware/`, `services/`).
2. Audit frontend files (`app.js`, `index.html`, `admin.html`, and other JS/HTML files) for unsafe `innerHTML` assignments, XSS vectors, and inline scripts that need to be extracted into dedicated cacheable JavaScript modules.
3. Investigate input validation and sanitization for transaction and profile inputs (e.g. schema validation).
4. Analyze API error handling across all endpoints to assess whether consistent JSON error envelopes with proper HTTP status codes are returned (e.g. checking if AI endpoint returns 200 on failure instead of 500/503).
5. Map duplicate Gemini API implementations (`api/gemini.js`, Netlify functions, `server.js`) and plan unification into a single shared client module.
6. Inspect in-memory tracking maps (e.g., rate-limit IP trackers, audit logs) for unbounded memory growth and lack of TTL eviction.
7. Inspect `/api/health` diagnostics and determine what is needed for deep checks (database connectivity, memory usage, external dependencies).

## Output Requirements
Write your detailed findings, code locations, and architecture map to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_arch\handoff.md`
Maintain `progress.md` in your folder.
Notify the orchestrator via send_message when complete.
