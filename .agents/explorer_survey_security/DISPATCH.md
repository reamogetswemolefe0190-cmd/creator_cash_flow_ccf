# Dispatch Instructions for Explorer: Security & PII Audit

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security`

## Role & Archetype
- Archetype: teamwork_preview_explorer
- Role: Security & PII Investigator

## Authoritative Reference
Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (specifically the latest follow-up from 2026-09-04T09:20:13Z) before starting.

## Mission & Objectives
Thoroughly explore the codebase at `c:\Users\User\OneDrive\Desktop\New folder (2)` to survey and map all security vulnerabilities and PII leaks, specifically targeting Requirement R1:
1. Identify all occurrences of hardcoded credentials, fallback secrets (JWT secret, encryption key, fallback admin passwords), and personal developer email (`reamogetswemolefe0190@gmail.com`) across all production source files, config files, and tests.
2. Check `.gitignore` to see if `.env*` files are excluded and verify whether any `.env` files are tracked or present.
3. Investigate CORS configuration in `server.js` and any other server/serverless files (e.g. wildcard `origin: '*', credentials: true`) vs the required whitelist (`https://creatorcashflow.co.za`, `https://www.creatorcashflow.co.za`, `http://localhost:5000`, `http://127.0.0.1:5000`, `http://localhost:3000`).
4. Investigate rate limiting across all routes (`/api/auth/login`, `/api/auth/register`, `/api/transactions`, `/api/admin/*`, `/api/gemini`) and identify gaps.
5. Inspect Multer / file upload middleware for MIME type validation, file size limits (5MB cap), or unused dependencies.

## Output Requirements
Write your detailed findings and evidence to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security\handoff.md`
Maintain `progress.md` in your folder.


## 2026-09-04T09:23:11Z
You are the Security & PII Investigator.
Your working directory is:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security`

Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (authoritative user request) and `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security\DISPATCH.md` first.

Explore the codebase at `c:\Users\User\OneDrive\Desktop\New folder (2)` to survey and map all security vulnerabilities and PII leaks, specifically targeting Requirement R1:
1. Identify all occurrences of hardcoded credentials, fallback secrets (JWT secret, encryption key, fallback admin passwords), and personal developer email (reamogetswemolefe0190@gmail.com) across all production source files, config files, and tests.
2. Check .gitignore to see if .env* files are excluded and verify whether any .env files are tracked or present.
3. Investigate CORS configuration in server.js and any other server/serverless files vs the required whitelist (https://creatorcashflow.co.za, https://www.creatorcashflow.co.za, http://localhost:5000, http://127.0.0.1:5000, http://localhost:3000).
4. Investigate rate limiting across all routes (/api/auth/login, /api/auth/register, /api/transactions, /api/admin/*, /api/gemini) and identify gaps.
5. Inspect Multer / file upload middleware for MIME type validation, file size limits (5MB cap), or unused dependencies.

Write your report to `c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_security\handoff.md` and send a completion message with the path when finished. Maintain progress.md with timestamps for heartbeat liveness.

## 2026-09-04T09:30:42Z
**Context**: Security & PII Survey
**Content**: Checking in on your progress for the Security & PII Survey (Requirement R1). Please update your progress.md and report your current status.
**Action**: Please reply with your status and estimated time to completion of handoff.md.

