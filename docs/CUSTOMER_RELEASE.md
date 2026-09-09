# Customer-facing release

This release separates real creator accounts and transaction records from the collaboration demonstration. Creator accounts are free during this release. Public support and privacy contact: reamogetswemolefe@creatorcashflow.co.za.

## Implemented

- Accessible mobile menu, simplified public navigation, no public admin link or floating tour dock.
- External scripts and registered event listeners; `script-src-attr 'none'` remains enforced.
- Real signup/login, memory-only browser session, own-account transaction retrieval, record creation and CSV export.
- New customer accounts start empty; welcome emails no longer claim verification or seed financial data.
- Production signup/login and transaction reads/writes return a service error if durable storage is unavailable, instead of silently using temporary memory.
- Demo-only creator/agency/brand workspaces. Shared campaign revisions, approval history, conversation and invoice status are explicitly browser-local; no real invitations, approvals, notifications or payments are sent.
- Privacy, service, security and availability content; unsubstantiated compliance, receipt-certification and uptime badges removed.

## Release verification

The targeted browser check exercises real local test APIs: registration, empty ledger, invalid/valid login, transaction save and CSV download. It also checks campaign revision/approval/invoice transitions, escaped feedback, all public routes at desktop/mobile widths, mobile menu behaviour and absence of inline event attributes/CSP errors.

Production must supply a working Supabase configuration with the existing users/transactions schema. Tests use the isolated in-memory test environment; production database permissions, live email delivery and deployment configuration still require post-deploy verification. Existing user data is not migrated or deleted.

## Capability limits

Collaboration remains a demonstration, not a deployed multi-tenant campaign backend. No self-service password reset, email ownership verification, subscription billing or real money movement is introduced. The privacy/service pages describe actual release behaviour and do not assert legal certification. Operational retention and privacy-request processes remain the operator's responsibility.

## Deployment

Keep the existing Render service and Git repository. No Sites migration is required. Review the changed files and deploy through the existing release process, then smoke-test registration with an approved test account, persistence across restart, login, mobile navigation and policy links. This local implementation does not itself publish a new live version.
