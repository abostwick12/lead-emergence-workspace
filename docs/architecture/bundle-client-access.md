# Bundle client access

## Purpose

The client-access surface turns the generic entitlement engine into a safe,
reviewable operating workflow for every active bundle. It gives an authorized
operator one place to verify the intended Personal Workspace, see current
access, grant or remove an individual bundle, and issue or withdraw an invite.

## Trust boundary

The browser page checks the signed-in user's immutable Auth app metadata only
to decide whether to render the console. That is presentation, not authority.
Every catalog review and mutation uses a bearer-bound Workspace client and is
authorized again in Postgres by `workspace_private.is_bundle_operator()`. That
function requires a direct session and rereads the current `auth.users` record;
a stale or forged JWT claim cannot preserve operator authority.

`workspace.get_bundle_operator_state(target_workspace_id)` is the only new
database bridge. With no target it returns the active catalog in an unscoped
`available` state. With a target it accepts only a Personal Workspace whose
owner has an active owner membership, then returns:

- verified Workspace and owner identifiers, owner display name, and normalized
  Auth email when one is present;
- active bundle definitions and enabled capability counts;
- the newest effective entitlement state, source, timing, and removal reason.

It does not return token hashes, invite records, service credentials, operator
designation controls, private bundle content, or client work product. The
private implementation is not executable by `anon` or `authenticated`; only
the fail-closed public wrapper is callable by an authenticated session.

## Lifecycle

The console composes existing bounded APIs rather than adding a second write
model:

1. `GET /api/operator/bundles/state` reviews the catalog or one verified client.
2. `POST /api/operator/bundles/assign` grants the selected bundle to the active
   Personal Workspace owner.
3. `POST /api/operator/bundles/entitlements/revoke` removes the exact reviewed
   entitlement and requires a bounded audit reason.
4. A later assignment creates a new active entitlement while retaining removed
   history.
5. `POST /api/operator/bundles/invites` creates a seven-day, email-bound,
   single-use invite; `POST /api/operator/bundles/invites/revoke` withdraws it.

The UI refreshes authoritative database state after every entitlement change.
Buttons stay disabled until a target has been reviewed, and changing the
Workspace ID immediately clears the verified target from browser state.

## Configuration

Invite signing requires `BUNDLE_INVITE_TOKEN_SECRET` in the server runtime. The
local production harness strips only Supabase administrative secrets and may
carry this application signing secret. Production-shaped local acceptance uses
the canonical HTTPS Workspace origin for generated links while the application
itself remains on loopback.

## Scope

This milestone changes no hosted database, production deployment, operator
designation, external provider, payment system, client account, or marketplace
listing. See the [operations runbook](../runbooks/bundle-pilot-operations.md)
and [acceptance record](../testing/bundle-client-access-acceptance.md).
