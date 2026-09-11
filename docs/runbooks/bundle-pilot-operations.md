# Bundle pilot operations

This runbook covers the generic client bundle entitlement path. The same flow
serves all active bundle definitions. `SOTF Bundle` is catalog data with
internal key `sotf_transition`; it is not a cohort, membership type, account
type, or authorization special case.

## Operator authorization

An approved operator has `workspace_bundle_operator: true` in immutable Supabase
Auth app metadata. The database reads the current Auth record for every grant,
invite, or revocation, so removing the flag takes effect without trusting a
stale browser claim. Operator designation remains an Auth-administration duty;
the Workspace browser runtime contains no service-role key and cannot designate
new operators.

The operator signs in normally and opens `/workspace/operator/bundles`. The
console carries the operator's normal access token to bounded Workspace APIs.
Every API is re-authorized in Postgres and fails closed for ordinary users.

## Review and direct assignment

1. Resolve the client's Personal Workspace ID through the approved support
   workflow.
2. Open `/workspace/operator/bundles`, enter that Workspace ID, and select
   **Review client**.
3. Confirm the verified owner name, email, and Workspace name before changing
   access. Stop if any identity detail is unexpected.
4. Review the status of every active catalog bundle and select **Grant bundle**
   for the intended item.
5. Verify the card changes to **Active**, then have the owner open the bundle.

The console calls `POST /api/operator/bundles/assign` with the bundle key,
Workspace ID, and a unique idempotency key. Before any write, the review API
returns only the verified active Personal Workspace owner and safe catalog
state; it never returns invite hashes. The database rechecks operator authority
and the target owner for every operation. A grant writes one canonical
`bundle_entitlements` row with `operator_assignment` source and the issuer's
user ID. Repeating the exact request, or granting a Workspace that already has
current access, returns the existing entitlement without duplicating state.

## Pilot invite and claim

1. Open `/workspace/operator/bundles` and select the exact bundle.
2. Enter the intended user's exact email and select **Create invite**.
3. Share the returned single-use link only with that intended user.
4. The user signs in, opens the link, and activates the named bundle.
5. If the invite should no longer be used, select **Withdraw invite** before it
   is claimed.

The issuance API derives an opaque, retry-stable token using the server-only
`BUNDLE_INVITE_TOKEN_SECRET`. Postgres stores only its SHA-256 hash. The default
expiry is seven days, with a database-enforced range of five minutes through
thirty days. Claim requires the matching Auth email and an active owner
membership in the claimant's Personal Workspace. It produces the same canonical
entitlement contract as assignment, with `invite` as the source. A retry by the
same claimant returns the original result; every other repeated, mismatched,
invalid, expired, or revoked claim fails closed.

Invite rows remain in `workspace_private`, which is absent from the Data API.
Responses never include the token hash or private invitation internals.

## Resolution and lifecycle

`GET /api/workspaces/{workspaceId}/bundles/{bundleKey}` returns the source-neutral
canonical state:

- `available`: active catalog item with no entitlement;
- `active`: current, unrevoked, unexpired entitlement;
- `unavailable`: missing or unavailable catalog item;
- `expired`: current entitlement passed its expiry;
- `revoked`: latest entitlement was explicitly revoked.

An active entitlement also returns its enabled bundle capability mappings.
Personal plan status remains foundational; bundle capabilities are additive and
do not bypass membership, RLS, a suspended plan, provider-release gates, or
other feature-specific authorization.

Operators remove an active entitlement by expanding **Remove access**, entering
a required audit reason, and confirming. Removed and expired items can be
granted again without rewriting their history. Operators can also withdraw the
invite currently displayed by the console. Expiry, revocation, actor, reason,
source, and historical grants remain preserved structurally.

## Local acceptance

Start the repository-local Supabase stack, replay migrations with
`supabase db reset --workdir .bundle-local`, and run `npm run test:rls`. The production-shaped
HTTP acceptance is `npm run test:bundle:local`; it requires a loopback Next.js
server plus local Supabase URL, anon key, and a test-only local service key for
disposable Auth fixture creation. All Workspace fixture and product writes run
as normal authenticated users through RLS and the product APIs. Run the harness
only on a freshly reset local database, then run
`supabase db reset --workdir .bundle-local`
again to remove its fixed acceptance fixtures. Connected console acceptance is
in `tests/e2e/bundle-operator-connected.spec.ts` and covers both desktop and
mobile emulation. This reset-based lifecycle
preserves the repository's deliberate denial of Workspace-schema access to the
service role.

Never run this repository's acceptance harness against a linked or hosted
project.
