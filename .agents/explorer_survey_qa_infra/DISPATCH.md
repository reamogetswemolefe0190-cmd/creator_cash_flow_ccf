# Dispatch Instructions for Explorer: QA & Infrastructure Investigation

## Working Directory
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra`

## Role & Archetype
- Archetype: teamwork_preview_explorer
- Role: QA & Infrastructure Investigator

## Authoritative Reference
Read `c:\Users\User\OneDrive\Desktop\New folder (2)\ORIGINAL_REQUEST.md` (specifically the latest follow-up from 2026-09-04T09:20:13Z) before starting.

## Mission & Objectives
Thoroughly explore the codebase at `c:\Users\User\OneDrive\Desktop\New folder (2)` to survey and map QA, test infrastructure, CI/CD, and docs, specifically targeting Requirement R4:
1. Inspect `package.json` scripts, dependencies, and devDependencies. Check current `test` script vs required `"test": "node test_pivot_validation.js && node test_full_site.js"`.
2. Inspect existing test files: `test_pivot_validation.js`, `test_full_site.js`, stress testing scripts, and any other test harnesses. Count the tests, see how they execute, how mock servers or staging environments are spun up, and identify what prerequisites/environment variables they need.
3. Check GitHub Actions workflows under `.github/workflows/` (or lack thereof) to understand what is needed for `.github/workflows/test.yml` running automated regression tests on all pushes and PRs.
4. Check existing documentation under `docs/` or project root to see what API documentation exists and outline what `docs/API.md` needs to cover (public and admin endpoints).
5. Review acceptance criteria from `ORIGINAL_REQUEST.md` across all requirements and define verification checks.

## Output Requirements
Write your detailed findings, test execution inventory, and CI/CD plan to:
`c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\explorer_survey_qa_infra\handoff.md`
Maintain `progress.md` in your folder.
Notify the orchestrator via send_message when complete.
