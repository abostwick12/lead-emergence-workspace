# Entry-dev first-party Workspace sign-in — implementation draft

Prepared October 13, 2026. **Review draft; disabled; not ready for hosted execution.**

Desktop validation completed October 14, 2026 on local branch
`codex/p2-5-preview-first-party-auth-local-db`. The ZIP's patch matched both
`SHA256SUMS.txt` and the approved SHA-256
`0f786f583e4d5d330e9ad474ea18ad3ee86b029789f5018e26ea6911da1c9e88`.
It imported cleanly from the exact base below. Local validation found and corrected
a missing SQL terminator, a legacy reconciliation regression, and a nullable
admission predicate that allowed missing-pin provisioning. The corrected predicate
returns explicit false. Strict first-party identity/ownership checks remain; the
legacy branch retains supported empty-linkage reconciliation without overwriting
incompatible linkage. See [Desktop proof and attempt history](../testing/preview-first-party-auth-local-validation.md).

**Desktop overall result is PARTIAL, acceptance NO.** A later hosted metadata SELECT
used a CLI path that initialized Entry-dev login credentials (POST `cli/login-role`,
HTTP 201). This violated the no-hosted-mutation restriction. Resulting role/expiry
and residual impact are unknown; hosted work stopped. The linked proof records the
incident separately from the passing local tests. No cleanup was attempted.

## Approved outcome and exclusions

Andrew approved preparing the Preview-only code/access-rule draft and then approved
an isolated checkout despite the existing root checkout's staged deletions.
Base: Workspace main `5523eb62b333a2e60fd033c471fb99354a05a6db`.
Branch: `codex/p2-5-preview-first-party-auth`.
No existing checkout was repaired, reset, staged, or deleted.

The customer observable remains: start at the dedicated Workspace Preview login,
authenticate at Entry-dev, return to the same user's owned workspace, renew the
session, and deny wrong-client/wrong-user access. This draft does not close that
observable or any production/ChatGPT acceptance gate.

No hosted migration, OAuth registration, setting change, real login/consent,
deployment, push, PR, or merge is authorized by the draft approval. No new package
dependency, service, table, schema, role, or database function is introduced.

## Concrete proposed flow

1. A dedicated **public OAuth client with PKCE** redirects directly to Entry-dev's
   `/auth/v1/oauth/authorize`, using the exact Workspace callback. This is distinct
   from Supabase's Custom Provider sign-in. No client secret is required or copied.
2. State and verifier live in one host-only, Secure, HttpOnly, SameSite=Lax cookie
   scoped to the callback, expiring in ten minutes. The callback consumes it before
   exchanging any code. The return path uses the existing pathname allowlist.
3. The callback exchanges the code at `/auth/v1/oauth/token`. Supabase `getClaims`
   verifies signature/expiry; application checks require the Entry-dev issuer,
   authenticated audience/role, the exact browser client, a UUID subject/session,
   and absence of the MCP marker. `getUser` must agree with the token subject.
4. The existing SSR/browser session store uses a dedicated Preview cookie name.
   A bounded fetch adapter sends refresh-token requests to the OAuth endpoint and
   verifies the refreshed user with Auth. It supplies the user record auth-js
   requires, retains a rotated refresh token, and does not rewrite other requests.
5. The SQL draft narrowly extends the existing direct-session predicate for the
   pinned browser client, requiring a matching Auth session/user/client and no
   active MCP resource grant. Membership/ownership conditions remain intact.
6. Provisioning uses the same-project authenticated user UUID as canonical identity
   and the explicit linkage marker `first-party:workspace-preview`. This marker is
   **not** a fabricated Custom Provider. The existing profile constraint is extended
   for precisely this marker. Legacy provider identity verification remains intact.
   Existing incompatible profiles/workspaces fail closed; no relinking occurs.

## Exact boundaries and dormant configuration

| Boundary | Required value |
| --- | --- |
| Supabase project | `https://vnjdubrnmxvmsccxmhst.supabase.co` |
| Token issuer | `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1` |
| Workspace origin | `https://lead-emergence-workspace-entry-dev.vercel.app` |
| OAuth callback | `https://lead-emergence-workspace-entry-dev.vercel.app/auth/callback/sign-in` |
| OAuth scopes | `email profile` (no ID token assumed) |
| Deployment | `VERCEL_ENV=preview`; sign-in request must use the dedicated host |
| Public feature gate | `NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED=true` |
| Public client pin | `NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID=<actual newly approved public client UUID>` |
| Database client pin | Existing private `product_settings` key `workspace_preview_browser_client_id`, same actual UUID |
| Session cookie | `sb-entry-dev-workspace-preview` |

Every configuration row above is proposed, not provisioned. With the feature flag
absent the code retains the existing Custom Provider path. With the database pin
absent OAuth tokens remain denied. A fresh read-only query returned **zero** rows
for that pin on Entry-dev. No synthetic test UUID is an executable client choice.

The SQL review draft now has one matching forward **local-validation** migration,
`supabase/migrations/20261014101027_preview_first_party_auth_local_validation.sql`,
created with `supabase migration new`. Both files have SHA-256
`fa72e26f625fdbf0f952f7a71439ff1d7cfca5dea679cb833c7bef4a5524358e`.
Only a disposable local database received it. All 38 historical migration sources
remain unchanged. The originating body was derived from the October 13 Entry-dev
observation; Desktop testing restored the approved Workspace base's supported
legacy reconciliation behavior. A bounded hosted read found no installed first-party
marker/pin, but full historical-definition equality and Auth settings were not
established. Re-read the target function/constraint/ACL safely before any later
execution proposal; this local migration is not an approved hosted package.

## Supporting verification

- Focused tests cover configuration boundaries, S256/state/expiry, code exchange,
  token client/issuer/audience/role/session checks, renewal through the **installed
  Supabase SDK**, rotated tokens, wrong-client renewal, and untouched requests.
- Callback route tests use explicit mocks: success ordering, state rejection,
  replay, Auth/token subject mismatch, verification failure, Production denial.
- Unit fixtures are labelled synthetic and never sent to hosted Auth.
- Boundary scan, schema contracts, typecheck, lint, unit tests, and production build
  are recorded in `docs/testing/test-evidence.md`. They are supporting evidence,
  not real login or database acceptance.

## Blocking review and execution gates

**Local database behavior tested; hosted behavior NOT TESTED.** The original
October 13 environment lacked a database runner. Desktop's dedicated disposable
Supabase stack applied 38 existing migrations plus the one corrected forward
migration. The new matrix passed 81 assertions and the unchanged legacy suite
passed 70, total 151/151. All fixtures rolled back; postflight found zero users,
clients, sessions, workspaces, profiles, tasks, grants and browser-pin rows. The
task-owned containers/volumes were removed. The following cases passed locally:

| Case | Required observable |
| --- | --- |
| Dedicated browser client, matching issuer/session/user, no MCP grant | Own workspace provisions; canonical ID equals Auth user ID |
| Missing pin, wrong client/issuer/audience, missing/mismatched session | Provisioning and workspace reads/writes denied |
| MCP marker or active MCP grant on browser client | Browser access denied |
| Existing coherent first-party graph | Same workspace returned; no duplicate |
| Existing incompatible canonical/provider linkage or broken membership | Denial; graph unchanged |
| User A attempts User B workspace reads/writes | Denial; no persisted write |
| Legacy Custom Provider/direct sessions | Existing behavior preserved |
| Existing MCP clients and resource grants | Existing MCP behavior preserved; no browser admission |

**Session behavior needs real acceptance.** Verify Auth `/user`, SDK cookie
roundtrip, concurrent renewal/rotation, sign-out, and a full token renewal after
real sign-in. Test Workspace consent/ChatGPT connection from this browser session
as a separate acceptance gate; mocks do not establish hosted authorization support.

**Review gate remains OPEN.** No PR exists; no exact-head CodeRabbit review ran.
No claim that this draft is mergeable or production-ready is made.

**Execution package remains separate.** It must identify the actual public client,
Entry authorization UI/Site URL, callback registration, database pin, Auth hook
registration, exact reviewed SQL checksum, branch settings, deployment SHA, test
identity and one OAuth attempt. Preserve the legacy clients/providers/settings.
Refresh the current hook: its inspected body treats an OAuth token as MCP only
when one matching active resource grant exists. Do not change the hook or create a
browser client's MCP grant to work around browser admission.

## Reversal proposal (not authorized)

Disable the Preview feature flag and redeploy the previously approved build; remove
the browser pin under separate approval. Remove only the new Preview session cookie
from the test browser. Existing tokens are still denied by the removed pin, but
Auth session/client revocation requires its own scoped action. Preserve any created
profile/workspace and its marker until an owner-reviewed record/session inventory
establishes whether cleanup is needed. Do not restore the old constraint while
first-party marker rows remain. No automatic data deletion or identity conversion.
