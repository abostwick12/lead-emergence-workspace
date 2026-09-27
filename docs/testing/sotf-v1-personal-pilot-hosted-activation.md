# SOTF V1 personal-pilot hosted activation evidence

Date: 2026-09-14

## Accepted checkpoints and scope

- Accepted software: `88dedf0b12f491daae088c78a0c15be340493d10`
- Acceptance documentation: `182b7e10cc4219df75d7705e5f9b4379cabb31ae`
- Authorized target: `cirqqhuvzekbvysiyedg`
- Authorized operator: the existing Ministry repository migration authority
- Scope: Andrew's personal pilot only

The owner authorization permits the exact accepted migration delta, deployment
of the accepted Workspace runtime, Andrew-only bootstrap and entitlement,
feature activation, and a narrow authenticated Workspace/Lewis smoke test. It
does not permit Consulting changes, unrelated Entry or Ministry changes, a new
production stack, other-user activation, Professional Context/P2, unrelated
connectors, or unrelated hardening.

## Read-only live-state verification

| Boundary | Result |
| --- | --- |
| Workspace public origin | `https://workspace.leademergence.com` responds and redirects to the existing Workspace experience |
| MCP resource | `https://workspace.leademergence.com/api/mcp` returns the expected unauthenticated Bearer challenge |
| MCP authorization server | Live protected-resource metadata identifies `https://cirqqhuvzekbvysiyedg.supabase.co/auth/v1` |
| Ministry repository link | Existing `supabase/.temp/project-ref` is `cirqqhuvzekbvysiyedg`; it was not changed |
| Current Workspace production deployment | GitHub deployment `6401832979` succeeded from `e37d1e81d25a05f0fe2f7171ca437cbcb0d84513` on 2026-09-11 |
| Accepted runtime deployment status | `88dedf0b12f491daae088c78a0c15be340493d10` is not in the deployed commit's history and is not on a remote branch |
| Identity topology | Live Workspace MCP metadata confirms the authorized Ministry-backed topology; no redirect to Entry Supabase was observed or attempted |

The deployed `main` line and accepted SOTF line share
`56680058c076828d0de482fca66cbf75678cd6a1` as their merge base. The accepted
line was not merged with later production code during this run.

## Authoritative migration ledger and delta

The already-linked Ministry authority ran a read-only remote migration-list
operation. These accepted SOTF foundations are already recorded remotely and
must not be reapplied:

- `20260902162536_bundle_entitlement_foundation.sql`
- `20260906120000_sotf_operational_workflows.sql`

The exact missing accepted delta is:

| Migration | SHA-256 |
| --- | --- |
| `20260911143000_sotf_v1_daily_brief_slice.sql` | `89cd445fcad860209390b99ef910355305b998e88917048049e66e83d1b6d9fa` |
| `20260912162000_sotf_v1_outcome_semantic_parity.sql` | `6ccc13f81bb420c56a85ce1e373d0865f5715fe6a495636b44e57a339cda3c78` |
| `20260912190000_sotf_v1_unicode_truncation_parity.sql` | `751d2890370d8bc96a983229263855e625d03375c197c216de7c819ab9fe8350` |
| `20260913110000_sotf_v1_canonical_ordering_parity.sql` | `66ac0c10e4650e8131f0082b60dd39519aff9cebcba9f84c0fdd1b4da2cf5bdd` |
| `20260913150000_sotf_v1_reference_parsing_parity.sql` | `e5fd9e02389ed29867c59f910943f4b51a0e8ed71978159240640f944da1fedf` |
| `20260913200000_sotf_v1_time_zone_identifier_contract.sql` | `b3b2b247c7c1cf829ab0fc8dfeed7154f14eb3de4379c188229ca9d2405ea3cf` |
| `20260913213000_sotf_v1_time_zone_boundary_authority.sql` | `2e360569b345feb853d74012d36da8c3645af64398e390e926ae3132a548c520` |
| `20260914010000_sotf_v1_temporal_authority_consolidation.sql` | `3ac7360743af3d15e57327e3cfa4156e83f2ba4892d51be8cc0f5efb54dd9847` |

Immediately before mutation, the live ledger was re-read and the delta was
unchanged. An isolated clean Ministry `main` checkout at
`c96537b49a46bab50efeded1ae5c4aa2ad5632a4` supplied the migration-operator
boundary. Its dedicated temporary operator directory contained version-only
comment placeholders for already-applied remote history and the eight accepted
SQL files above. No file in the active dirty Ministry worktree was changed.

The operator dry run listed exactly the eight migrations above, with no roles,
seeds, vault changes, or other migrations. The production push then applied all
eight successfully in order. A postflight ledger read confirmed local/remote
parity for every version through `20260914010000`. No migration outside this
set was selected or applied.

## Backup and rollback gate

The read-only Supabase backup inventory for `cirqqhuvzekbvysiyedg` returned:

- `backups: null`
- `physical_backup_data: {}`
- `pitr_enabled: false`
- `walg_enabled: true`

Therefore no provider-managed recovery identifier was available. Andrew then
explicitly authorized one logical export to
`C:\Users\awbostwick\Documents\Lead Emergence Backups\SOTF V1\` and authorized
the sensitive shared-production contents required for recovery.

Before writing, the destination was verified as the direct Windows Documents
known folder rather than a reparse point or redirected OneDrive location.
Google Drive's root-preference database contained no configured mirror roots,
and the destination is outside the OneDrive and iCloud Drive roots. The sync
coverage gate passed.

Recovery identifier:
`sotf-v1-preactivation-cirqqhuvzekbvysiyedg-20260914T140354Z`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 506 | `088c1773b83a9729e74b30611675c4fd95d39a629360934ec97ac09645876e29` |
| `schema.sql` | 1,638,162 | `47aa204107c788d1510a6c915687c3593d17c01210c4e50032f896185ee238c0` |
| `data.sql` | 2,488,641 | `ce601c8cf201baad232a07f211c239e6405c50b12b66d773ad12b96c6f23d316` |
| `migration-history-schema.sql` | 1,116 | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| `migration-history-data.sql` | 1,208,805 | `d63fea84f22c27ec5f10c08406bdaefdf0d85dc1d67fb263584f602f1db272fc` |
| `manifest.json` | 3,082 | `c260fa15aa7fd77093bacb30201bdf31b4bf848b29ad2dac321437c8aa5d93ed` |

All expected artifacts exist and are non-empty. Non-mutating validation found
the expected Supabase/PostgreSQL SQL structures, COPY terminators where
applicable, no NUL bytes, and the preflight migration state: `20260902162536`
and `20260906120000` present, with all eight pending versions absent. Production
rows were not printed into this evidence.

The data dump reported circular foreign-key dependencies in existing non-SOTF
tables. The manifest therefore requires a reviewed constraint-safe restore
sequence on an isolated recovery target. This warning does not affect dump
readability or completeness; it prevents treating a naive ordered replay as a
validated restore procedure.

Inherited ACL access was removed recursively. Full control is limited to
`SENSENET\awbostwick` and `NT AUTHORITY\SYSTEM`; seven files/directories were
processed with zero ACL failures. The backup was not uploaded, synchronized,
published, committed, or transmitted.

Once established, rollback remains: disable the feature flag, revoke only
Andrew's SOTF entitlement, restore the prior immutable Workspace deployment,
leave additive database structures locked in place, and use a reviewed forward
migration for any schema correction. The backup is the recovery checkpoint for
unexpected data loss or corruption, not authorization for a destructive
down-migration.

## Mutation and cleanup state

- Hosted database mutations: the exact eight-migration SOTF V1 delta applied
- Hosted Auth/entitlement mutations: zero
- Hosted environment changes: `SOTF_PILOT_ENABLED` changed from `false` to
  `true` for the Workspace Production environment
- Deployments: accepted activation branch deployed and promoted to Production
- Pushes: `codex/sotf-v1-personal-pilot-activation` published; PRs and merges:
  zero
- Entry, Consulting, and unrelated Ministry changes: zero
- Backup/export files created: one authorized local recovery set; no remote copy

## Accepted Workspace production deployment

The accepted activation branch was published at
`ca41212355fba6fb2ad216b0d010531a3fdab2b7`. A runtime-only diff against
`88dedf0b12f491daae088c78a0c15be340493d10` is empty; intervening commits are
documentation evidence only. Vercel built preview deployment
`FdmB3X8PRyVp19X1f6vTtEJVoXQW`, then rebuilt it with the Production environment
as deployment `GkGmJQBFzWjxqTtqW8Lw5AVV3vAo`. The production build completed
Ready in 35 seconds and was promoted to the project production domains.

Before the build, the existing Production `SOTF_PILOT_ENABLED` value was read
as `false`, changed to `true`, saved successfully, and re-read as `true`.
Vercel required a new build for that configuration change; the production
deployment above is that new build.

No merge with `main` was performed. A proposed local merge with current `main`
was rejected by the execution safety layer and was not attempted again; no
merge state was created.

## Andrew identity and entitlement preflight

The canonical hosted Auth user was resolved to one Andrew account. Before
bootstrap, that account had no Personal Workspace, active owner membership, or
Personal plan row. Its only current Auth identity is the built-in email
identity; no trusted Lead Emergence Entry identity is yet linked. The
`ensure_personal_workspace()` authority therefore correctly cannot be invoked
until the normal Entry OAuth handoff completes. The active
`sotf_transition`-entitlement inventory is `0` for Andrew and `0` for all other
users, so enabling the environment gate did not expose SOTF to another account.

## Activation resume point

The normal production flow reaches the Lead Emergence login at
`entry.leademergence.com` and is waiting for Andrew's interactive password
entry. Password-manager contents were not accessed and no authentication
credential was invented or bypassed. After Andrew completes that login, the
remaining authorized sequence is: Entry consent/callback, canonical Personal
Workspace bootstrap, Andrew-only `sotf_transition` assignment, narrow
Workspace/Lewis smoke, and entitlement revocation/restoration.

## Post-handoff authentication recheck

After Andrew reported completing interactive sign-in, the retained Chrome tab
was re-read and the production `/workspace` route was requested directly. It
again redirected to `/login?next=%2Fworkspace`. Starting a fresh Workspace
handoff produced a new Entry authorization request but again reached the Entry
login form rather than an authenticated consent or callback.

The canonical production Auth record was then re-read. It remained the same
previously identified user, with `last_sign_in_at` unchanged at
`2026-08-28 16:06:57.013978+00`, only the built-in `email` identity, and no
Personal Workspace, membership, or plan. A second Andrew-scoped Auth search
found no newly created or alternate Andrew account. No entitlement or other
hosted row was changed during this recheck.

This is a reproducible session-boundary blocker, not evidence of an
authorization or migration defect. The exact retained browser tab is waiting
at the normal Entry login form for the current Workspace OAuth request. The
supported callback must complete in that same browser session before
`ensure_personal_workspace()` can verify a trusted Entry identity and create
Andrew's Personal Workspace. The activation remains fail closed: active
`sotf_transition` entitlements are still zero for Andrew and every other user.

## Entry production identity blocker

A fresh direct attempt against the canonical Entry login returned
`error=invalid_credentials`. Read-only inspection of the Entry production Auth
tenant (`neabiaimygdviwobpicj`) then searched first for Andrew's exact canonical
email address and separately for `andrew`. Both searches returned **No users
found**. No Entry account was created, invited, reset, or modified.

The failure is therefore reproducible and narrower than the earlier browser
session hypothesis: Andrew's canonical Workspace Auth account exists, but the
Entry production identity required to complete the trusted OAuth handoff does
not. Workspace bootstrap, Personal plan establishment, and the Andrew-only
`sotf_transition` assignment remain unattempted and fail closed.

Minimum activation scope is one supported Andrew-only Entry production account
using the canonical email, followed by the normal Entry-to-Workspace OAuth
handoff. That is an Entry hosted mutation and account-creation action outside
the current no-Entry-mutation boundary, so it requires explicit narrow owner
authorization before execution. No other Entry user, tenant, or application
state needs to change.

## Entry account creation and confirmation hold

After narrow owner authorization, Andrew used Entry's supported public signup
form. Read-only Auth verification found exactly one matching production user,
UID `53fc7b61-b10a-4816-bbc8-c87363c025d8`, with display name Andrew Bostwick
and the exact canonical email. No duplicate `andrew` result was created.

Entry recorded `Confirmation sent at` as
`2026-09-14 23:44:32.085045+00`, while `Confirmed at` and `Last signed in`
remained empty. A subsequent password attempt returned
`error=invalid_credentials`. The account therefore exists but has not completed
the supported email-confirmation step; OAuth resumption remains blocked before
any Workspace identity mapping or bootstrap. No confirmation resend, password
reset, admin confirmation, or other privileged mutation was performed.

## Entry PERSONAL access grant and OAuth recovery

After Andrew completed the supported email-confirmation and sign-in flow, the
Entry production Auth tenant contained exactly one user for the canonical
email, with confirmation complete and a successful sign-in recorded. Before
the owner-authorized access command, Andrew had no Entry identity profile, no
product entitlement, and no active `PERSONAL` access. The production totals
were three Auth users, two identity profiles, two product entitlements, and
five identity audit events.

The documented service-role/PostgreSQL administrative command
`public.set_entry_product_entitlement(...)` was then invoked once for Entry
Auth UID `53fc7b61-b10a-4816-bbc8-c87363c025d8`, product `PERSONAL`, status
`ACTIVE`, source
`sotf_v1_personal_pilot_owner_authorization_20260914`, and display name
`Andrew Bostwick`. It returned entitlement ID
`bea2f6a7-b949-4b6e-a734-8ac41832f361` with effective status `ACTIVE`.

Post-command verification found exactly one Andrew Auth user, one Andrew
identity profile, one Andrew product entitlement, one effective Andrew
`PERSONAL = ACTIVE` entitlement, and one matching audit event. Email
confirmation and the successful-sign-in state remained complete. Entry totals
became three Auth users, three identity profiles, three product entitlements,
and six audit events. The unchanged Auth-user count and the exact +1 changes to
the three command-owned tables establish that no second identity was created
and no unrelated Entry row changed. No Entry workspace or product-local role
was created.

Reloading the pending consent after the grant exposed the normal
`Continue to Workspace` action. The first authorization was consumed without a
usable callback in the retained browser, which still held an older synthetic
canary Workspace session. That session was treated as non-evidence and no
Workspace mutation was made through it.

A fresh supported `/auth/entry?next=%2Fworkspace` handoff then completed. The
Workspace production ledger recorded exactly one trusted
`custom:lead-emergence-entry-workspace-prod` identity on Andrew's pre-existing
canonical Workspace Auth user
`6f2f63f4-9ce2-4cda-85fe-4d808e3e11a0`. The provider subject is the exact Entry
Auth UID above, and both provider and Workspace emails are the canonical Andrew
email. Andrew's Workspace Auth `last_sign_in_at` advanced to
`2026-09-15 00:01:05.726741+00`; no provider identity for that subject belongs
to another Workspace user.

The callback followed the supported bootstrap path: Andrew now has exactly one
Personal Workspace, one active owner membership, and one active Personal plan.
The browser reached `/workspace/setup`. Active `sotf_transition` entitlements
remain zero, so SOTF access has not yet been granted. No second Workspace Auth
user was created, and the canonical Workspace user ID remained unchanged.

## SOTF entitlement operator blocker

Before any SOTF entitlement write, the Workspace production authority ledger
was re-read for Andrew's canonical Auth user and Personal Workspace. It found
exactly one matching Auth user, one trusted Entry provider identity with the
expected Entry subject, one Personal Workspace
(`0ba1358c-22ce-4c6b-b74a-d1ed0ac8470b`), one active owner membership, and one
active Personal plan. The `sotf_transition` catalog row is active. Current SOTF
entitlements remain zero for Andrew, zero globally, and zero for other users.

The enabled bundle mappings are exactly `agentic_workflows`, `career`,
`daily_brief`, `memory`, and `workspace_mcp`. The Personal plan separately owns
baseline `core_workspace`; the bundle does not replace that baseline. No
enabled mapping exists for `professional_context`, `leader_mode`,
`external_connectors`, `advanced_mcp`, or `advanced_automation`.

The same live preflight found Andrew's immutable
`workspace_bundle_operator` flag false and found **zero** production Auth users
with that approved operator flag. The accepted supported assignment path,
`workspace.issue_bundle_assignment(...)`, rechecks that immutable Auth record
and raises `42501` unless an approved operator invokes it. Andrew's normal
session could not reach the operator console and returned to the ordinary
Workspace setup route.

No entitlement row, Auth metadata, capability mapping, membership, plan,
connector, or other hosted state was changed. Direct invocation of the private
write helper was deliberately not used because it would bypass the accepted
operator-authority guard. Activation cannot proceed through the supported
mechanism until the identity owner authorizes and establishes one minimum
Workspace bundle operator (or identifies an already-approved operator whose
normal authenticated session can be used). No rollback is required for this
blocked phase.
