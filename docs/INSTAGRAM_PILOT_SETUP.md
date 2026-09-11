# Direct Instagram pilot — deployment handoff

Implemented locally; this document does not certify a live deployment or Meta approval.

## 1. Database

Run `migrations/20260911_instagram_connections.sql` in the Supabase SQL editor using the same project as the production CCF backend. It creates three private tables; it does not delete users, transactions or campaign records. RLS is enabled, public/anon/authenticated table privileges are revoked, and the backend service role handles ownership checks.

The backend MUST use `SUPABASE_SERVICE_ROLE_KEY`. Never grant public access to the new tables to fix an error.

## 2. Render environment

Keep the credentials already deployed and add the origin:

```text
META_APP_ID=4612466858973489
META_LOGIN_CONFIG_ID=4395581310658782
META_APP_SECRET=<the Facebook app secret stored privately in Render>
META_APP_ORIGIN=https://creator-cash-flow-ccf.onrender.com
```

No trailing slash in the origin. CCF must be opened on that exact origin while testing; a custom domain needs its own matching origin and callback configuration. Keep the existing `ENCRYPTION_KEY` stable. Changing it without re-encrypting records requires creators to reconnect. Never put Meta secrets or provider tokens in frontend JS, source control, screenshots or chat.

## 3. Meta dashboard

Under Facebook Login for Business settings, add this exact Valid OAuth Redirect URI:

```text
https://creator-cash-flow-ccf.onrender.com/api/integrations/instagram/callback
```

Use the existing General/User access token configuration, requesting only:

- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_manage_insights`

Configure the app's deauthorisation callback:

```text
https://creator-cash-flow-ccf.onrender.com/api/integrations/instagram/deauthorize
```

Configure the User Data Deletion callback:

```text
https://creator-cash-flow-ccf.onrender.com/api/integrations/instagram/data-deletion
```

Privacy notice: `https://creator-cash-flow-ccf.onrender.com/#privacy`. Have the operator review its accuracy before external onboarding. The app domain is `creator-cash-flow-ccf.onrender.com`. Meta may request business verification, access verification and App Review for the chosen permissions. These changes do not bypass those requirements.

## 4. Deploy code and smoke-test

Deploy these code changes through the normal repository/Render workflow after the migration and configuration are ready. The environment deployment alone does not install this code.

1. Open the exact configured CCF origin and sign in with a real creator account, not the demo.
2. Open Connected accounts → Connect Instagram. Allow the new login window and keep the original CCF tab open; CCF keeps its login session in page memory.
3. Log in with the Meta app-role account used in Graph API Explorer. Select the CCF Page and linked professional Instagram account; grant all requested read permissions.
4. Close the confirmation window after completion. CCF polls the server and shows the connected account.
5. View posts, load another page, then View metrics for a post you own. Confirm values against Instagram. Missing metrics must show unavailable, not zero. Existing-content insights may be unavailable depending on account conversion dates, format and Meta permissions.
6. Test cancelling login, an expired token/reconnect, and Disconnect. Disconnect deletes that connection and its token locally; removing the app in Facebook Business Integrations revokes Meta's grant. Meta callbacks delete all connection records associated with the affected Meta user.
7. Sign in as another CCF user and confirm the connection and results are not visible.
8. Verify signed deauthorisation and data-deletion callbacks in Meta's testing tools; do not submit fake production deletion requests for unrelated accounts.

## Boundaries of this release

- Read-only direct Instagram: account linking, paginated post metadata, lifetime reach/saves/likes/comments/shares, disconnect and signed Meta deletion callbacks.
- User tokens encrypted with AES-256-GCM and bound to CCF user/account IDs. OAuth state is short-lived, browser-bound and single-use in the database. No provider token is returned to the browser.
- The `/me/accounts` empty-list case falls back to Page IDs authorised in Meta's token debugger. No founder Page or Instagram ID is hardcoded as a fallback.
- No stored post/metric snapshots, automatic background refresh, campaign attachment, agency/brand sharing, report generation, payment triggers or revenue import yet. The displayed metrics are a fetch-time snapshot, not an attribution or payment guarantee.
- Phyllo remains separate and unchanged on the backend. Its sandbox data must not be labelled verified Instagram performance.
- Only app-role test users are expected to work before Meta approves external access. Do not launch unrestricted onboarding on the strength of Graph API Explorer success.
- Burst limiting is per server process. Multi-instance rollout needs a shared rate limiter and production monitoring. Live Meta OAuth and Supabase permissions must be smoke-tested after deployment; local tests use fake provider/database data.
- Expired OAuth attempts are purged per user on the next connect attempt. Review broader retention and scheduled cleanup before scaling. Deletion receipts contain only random confirmation codes and timestamps.

## Local checks

```text
npm run test:instagram
```

Coverage includes callback cookie/state binding, replay/expiry, demo rejection, per-user access, encryption/tampering, granted-Page fallback, pagination token stripping, unavailable metrics, ownership verification, and signed deletion callbacks.

Primary references: [Meta's official Instagram collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/), [Meta data-deletion callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/). Meta documentation pages were rate-limited during implementation; verify dashboard requirements and the live login flow before widening the pilot.
