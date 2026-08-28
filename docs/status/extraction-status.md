# Extraction status

Phase: Gate D — production cutover and stabilization
Status: **Production cutover complete; 14-day stabilization in progress**
Cutover instant: `2026-08-21T19:18:22Z`
Stabilization window: 2026-08-21 through 2026-09-04

## Production sources

- Workspace D2 and three-clock source: `176557902e5f2096fb81135d636ec1b4c7f28b45`
- Workspace merge: `6b6f8867e3a3bca05207339b249857aa7dea5715` ([PR #2](https://github.com/abostwick12/lead-emergence-workspace/pull/2))
- Workspace production deployment: `https://lead-emergence-workspace-5i5vex7yf-emergence-projects.vercel.app`, promoted at `https://lead-emergence-workspace.vercel.app`
- Ministry D1 source: `e41b10aa75f974e2a1acd10a8cf70c7e514ca5c5`
- Ministry D1 merge: `ba61a28f297d72ee359d097fda805032d155f801`
- Ministry Gate D source: `10f3edd5170709f292719520a2565c07896e3edc`
- Ministry Gate D merge: `713ef4342601f38ddca867e70a0708266da616a0` ([PR #390](https://github.com/abostwick12/emergence-ministry-platform/pull/390))
- Ministry production deployment: `https://emergence-ministry-platform-lbschkzjt-emergence-projects.vercel.app`, promoted at `https://emergence-ministry-platform.vercel.app`

## Gate status

- Gate A: **Complete** — Workspace schemas, RLS/grants, storage policy, and cross-product controls validated.
- Gate B: **Complete** — approved Workspace data migrated and reconciled; no Workspace Storage objects migrated.
- Gate C: **Complete** — production Workspace live and accepted.
- Gate D: **Cutover complete; stabilization in progress** — Ministry navigation removed, legacy UI routes redirected, legacy APIs retired, the confirmed legacy tables write-frozen, D1/D2 deployed, clocks deployed, and production smoke/security checks passed.

Hosted migration history records `20260821181638_ministry_gmail_boundary`, `20260821191020_workspace_clock_preferences`, and `20260821191057_legacy_command_center_write_freeze`. The clock package SHA-256 is `05e100e3f5f2c7b041ba9bc1373912d9f26f4d8fbe125831f45ab7304dde85d2`.

The seven retained legacy tables remain readable with their pre-cutover counts: `personal_tasks` 0, `daily_briefing_cache` 1, `ai_conversations` 18, `personal_integrations` 7, `sage_memory` 0, `capture_inbox` 0, and `job_applications` 0. Each has one statement-level `gate_d_legacy_write_freeze` trigger covering INSERT, UPDATE, and DELETE. No legacy record was deleted, moved, or overwritten.

The Ministry Gmail boundary is deployed and does not use `personal_integrations`. `lead_emergence_private.ministry_gmail_tokens` remains empty, so Ministry Gmail actions are explicitly unavailable until a separate Ministry OAuth authorization is completed. No personal token was copied or reused.

Workspace uploads remain disabled and personal integrations remain reconnect-required. Consulting OS was not changed. The daily stabilization heartbeat `lead-emergence-stabilization-monitor` is active for 14 runs. Legacy cleanup is not authorized and requires a separate approval after stabilization.

Rollback remains viable: redeploy the recorded pre-Gate-D application sources, then apply a reviewed rollback migration that removes only the seven freeze triggers and their private trigger function. Retain the additive clock preference column and all legacy/Workspace evidence.

## Goal C — Workspace / Personal productization

Status: **local and isolated hosted candidate validated; the two reviewed advisor migrations are applied and postflight-validated on the Personal sandbox only; Preview Entry-to-Workspace one-login SSO passes with no second credential prompt; the final immutable Workspace Preview and both open PR checks are green; real ChatGPT/Claude MCP client acceptance, two legacy Personal sandbox fixture identities, and distinct production Entry backend capacity remain; production cutover is not approved**.

The productization source adds one-login Personal SSO consumption, shared native and AI-assisted setup, Workspace MCP authorization, Personal plan/capability resolution, plan-safe Settings, first-value Home behavior, useful empty states, and production operations documentation. The custom Workspace domain was already healthy before this goal; the Vercel rollback URL remains available.

No Goal C migration has been applied to the shared hosted project. The ministry repository remains its sole migration authority. No Goal C PR has been merged, no real user has been migrated or activated, no external connector token has been copied, no billing/trial/pricing has been activated or invented, and no production-cutover gate approval is recorded here.

Workspace PR [#4](https://github.com/abostwick12/lead-emergence-workspace/pull/4) and Entry PR [#2](https://github.com/abostwick12/lead-emergence-entry/pull/2) are open and mergeable. Workspace Vercel Preview checks are green; Entry's final quality rerun is recorded in `docs/testing/test-evidence.md`. Authenticated Vercel inspection verified the final runtime-bearing Workspace and Entry branch deployments READY, both Next.js builds successful, zero error-level runtime events, zero 5xx error events, and environment-specific origins. Production `NEXT_PUBLIC_APP_URL` and `WORKSPACE_MCP_RESOURCE_URI` are canonical at `https://workspace.leademergence.com`; Preview uses its branch origin. Entry Preview routes Personal to the Workspace branch origin. The isolated Personal custom provider is enabled with the exact Preview Entry OAuth client, and a synthetic entitled Entry identity completed Entry → Workspace SSO with no second password before reaching the first-run setup method screen. The existing custom-domain Workspace remains the healthy pre-cutover application; no productization code has been merged or deployed to it.

On 2026-08-22 the user explicitly authorized the recommended isolated path: temporarily pause the described Consulting development sandbox, restore the Personal sandbox, apply the exact additive Goal C migration through the designated authority, configure the environment-specific Entry OAuth client and Workspace provider, and provision a dedicated Entry origin. This approval excludes the shared production Supabase project, real users, billing, paid upgrades, PR merges, and production cutover.

On 2026-08-22 the user separately gave fresh written authorization to apply exactly `20260822132000_workspace_private_rls.sql` and `20260822133500_workspace_advisor_performance.sql` to the isolated Personal sandbox `nhkugzifuapplwpnfpbt`. This recorded gate applies only to those two reviewed forward migrations on that sandbox. It does not authorize any migration on shared production `cirqqhuvzekbvysiyedg`, any Ministry or Consulting mutation, a paid-plan change, a real-user migration, a PR merge, or production cutover.

After exact target confirmation, `lead-emergence-meridian-sandbox` (`lpqgjnuvfvuuashcmlxq`) was paused with its data preserved and Personal sandbox `nhkugzifuapplwpnfpbt` was restored to `ACTIVE_HEALTHY`. The isolated Personal sandbox received the Workspace foundation, clock, productization, Data API exposure, pgTAP acceptance support, and first-capture analytics migrations. The cross-product Gate A hardening migration was intentionally not applied because it targets an absent Ministry-owned `public` policy and the Supabase safety guard rejected that boundary-crossing mutation. Shared production remains unchanged.

Hosted evidence now includes 91/91 post-migration transactional assertions, one-login SSO, first-run/native completion/resume/switching/first-value/returning-user browser acceptance, plan and no-connector states, mobile acceptance, exact Preview MCP metadata, safe unauthenticated MCP denial, a real OAuth consent screen for a synthetic public client, zero browser console errors, and zero Vercel error-level or 5xx events. A hosted first-capture check exposed a missing analytics event; forward migration `20260822124500_workspace_first_capture_event.sql` now records it exactly once without capture content. Hosted migration `20260822135401_workspace_private_rls` enables defense-in-depth RLS on all three server-owned private configuration tables while leaving the unexposed, grant-revoked no-policy posture intact. A later hosted native run exposed that final optional setup fields were not saved when completion was selected directly; Workspace source commit `bc08ade88f2f3425fbad10f7544cef5c96c12a30` fixes the order, and the permanent desktop/mobile regression now fills and persists all three final-step fields before completion. Final immutable deployment `dpl_A9FDQpTZR9PRNQ53bqxaxDUu2nDP` then persisted all ten active setup areas, rendered first-value Home, and bypassed onboarding on return; its exact temporary Personal redirect was removed after acceptance while the durable Preview callback remained.

Hosted migration `20260822135407_workspace_advisor_performance` preserves policy semantics while making 51 Auth helper evaluations init-plan safe and adds covering indexes for all 40 previously uncovered Workspace/private foreign keys. Postflight reports zero Workspace `auth_rls_initplan` findings, zero uncovered Workspace/private foreign keys, 91/91 hosted pgTAP, and no PostgreSQL error/fatal entry in either migration window. Forty-eight Workspace/private unused-index INFO notices are retained because the newly created and previously existing indexes have no representative workload history on this fresh sandbox. Shared production remains unchanged.

Entry Preview OAuth app `Lead Emergence Personal Workspace (preview)` exists with callback `https://nhkugzifuapplwpnfpbt.supabase.co/auth/v1/callback`. Its public client ID is configured in Entry Preview, its regenerated secret is stored only in the Personal custom provider, and the current Entry Preview deployment is READY. Personal Auth logs record a successful `custom:lead-emergence-entry-workspace-preview` callback and user session after the secret was corrected. The intended Entry production Supabase organization is still full with `lead-emergence-consulting-dev` and `lead-emergence-entry-dev`; no project was created, no charge occurred, and Consulting was not paused or modified.

Entry SSO source and its isolated Preview remain green. The authorized dedicated Vercel project `lead-emergence-entry` owns the verified DNS-only custom domain `https://entry.leademergence.com` and is configured as Next.js on Node `24.x`. Exact public Production origins and a new environment-specific handoff signing keypair/redemption secret are stored in Vercel; Supabase credentials and OAuth client IDs remain absent. Vercel automatically classified the project's first Git build as Production and assigned the new aliases. The credential-incomplete project was immediately paused, and automatic Git deployment is now disconnected until cutover authorization; the non-production Preview project owns PR Vercel checks instead. The custom domain returns `503 DEPLOYMENT_PAUSED`; no Entry chooser route, real user, or approved traffic was cut over. The only current Entry database is the isolated development backend in a separate Free organization, so a distinct production Entry identity backend and its exact Auth/OAuth configuration remain required before unpausing or live one-login acceptance. `www.leademergence.com` remains the Ministry application and no Ministry route or alias changed.

Current Personal-sandbox security advisors report no finding against exposed `workspace` data or Workspace Storage. Three `workspace_private` RLS-with-no-policy INFO findings are intentional deny-all posture on unexposed, grant-revoked server tables. The remaining two INFO findings and one SECURITY DEFINER warning target inherited `public` objects outside Workspace authority; leaked-password protection remains disabled and is documented without a paid-plan change. Performance advisors report only fresh-sandbox unused-index INFO for Workspace/private; covering foreign-key and Auth init-plan findings remain resolved.

Local and external acceptance evidence is recorded in `docs/testing/test-evidence.md`: all required application checks, a fresh database rebuild, 93 pgTAP assertions, 10 desktop/mobile browser cases, database lint, full dependency audit, boundary scan, sensitive-data scan, green PR checks, and custom-domain/TLS baseline checks pass. This evidence is not a hosted-migration or cutover approval.

Final Goal C cleanup removed the two reserved Goal C identities from Entry
development and verified zero associated sessions, refresh tokens, profiles,
entitlements, links, nonces, or audit subjects. Personal remains clean of
Workspace tenants, MCP authorizations, active OAuth clients, and active OAuth
consents. A later authoritative recheck surfaced two older fixed-ID Personal
sandbox Auth fixtures created on 2026-08-12, with six stale sessions/refresh
tokens and two inherited `platform_user_profiles` rows but no Workspace, MCP,
or OAuth user data. The current Dashboard session cannot access the `EMERGEnce`
organization that owns Personal, so those exact fixtures remain pending owner
sign-in and deletion.
ADR-0011 records the proposed production allocation: preserve Ministry,
promote the already-accepted Personal project as the Workspace candidate, and
use a new partner-backed project—or Meridian only after preservation review and
explicit repurpose approval—for Entry. No infrastructure change is authorized
by that proposal.

A fresh real-client attempt confirmed the remaining gate precisely: the
available ChatGPT and Claude browser sessions resolve to their sign-in pages,
and no connected Chrome or Edge session is available. A temporary `.test` Entry
identity and audited Personal entitlement were created only to stage the flow,
then removed when client sign-in proved unavailable; independent SQL reports
zero remaining dependent rows. Live Preview metadata, unauthenticated challenge,
and exact ChatGPT/Claude CORS preflights still pass. The complete operator-assisted
connect/use/natural-refresh/disconnect/old-bearer/reconnect/client-revoke matrix
and cleanup procedure is fixed in `docs/runbooks/real-client-mcp-acceptance.md`.

Current public landing inspection confirms the seven-stage redesign is live;
the remaining production defect is destination routing. Live Personal actions
still point to the legacy Ministry login/register paths, and Consulting uses the
older role query. Open, clean, green Ministry PR #391 preserves the redesign and
its READY Preview supplies the Workspace sign-in, unified Entry signup, and
role-safe Consulting return paths. It remains unmerged and last in the release
sequence so no public action routes into paused Entry or pre-productization
Workspace infrastructure.

## Workspace integration-vault migration gate

Status: **Approved for Ministry-authority application**.

On 2026-08-26, the user gave written approval: “migration approved.” This
authorizes exactly the additive Workspace migration
`20260825000000_workspace_integration_vault.sql` from Workspace merge
`36fa146e931980d7084448e9b9e51ea6388ec5f5` (PR #5). Its scope is the
provider constraint expansion, private ciphertext-only credential and OAuth
attempt storage, and owner-scoped connection RPCs. It does not authorize the
copying or activation of any existing provider token, Ministry or Consulting
mutation, real-user activation, billing change, or wider production cutover.

The Ministry repository remains the sole authority for the hosted migration.
Before it is applied, its operator must confirm the exact shared-hosted target,
review the packaged migration against current Ministry `main`, take the
repository's normal backup/preflight evidence, and record postflight results.

## Workspace integration-vault migration postflight

Status: **Applied and verified**.

On 2026-08-26, following the user's selection of
`cirqqhuvzekbvysiyedg` (`emergence-ministry-platform`), the Ministry authority
applied package version `20260826190000`. The package contains the exact SQL
body from Workspace migration `20260825000000_workspace_integration_vault.sql`
at Workspace merge `36fa146e931980d7084448e9b9e51ea6388ec5f5` (SHA-256
`f30ce33605b8e1b71d9e9053dd1294070440e4ec7df462b93c2006233d8a268e`).

Preflight confirmed the Workspace/private schemas, integration table, owner
guard, timestamp helper, and all required connection columns; no existing
connection would violate the expanded provider constraint. Postflight confirms
the credential and OAuth-attempt tables are private-only and not exposed,
neither has `anon` or `authenticated` table grants, all three owner-scoped RPCs
exist, only `authenticated` can execute them, and `anon` cannot. The API schema
cache was refreshed. A rolled-back authorization check confirmed that anonymous
calls, authenticated non-owner writes, and direct authenticated credential reads
are denied. No token, credential, provider connection, user record, Ministry or
Consulting data, billing setting, route, or application deployment changed.

The Supabase security advisor continues to report existing Ministry/public and
Auth warnings outside this Workspace migration; no remediation outside the
approved scope was performed.

## Lewis Phase 0 task-action release gate

Status: **Blocked after target preflight; no migration or app promotion applied.**

On 2026-08-27, the user authorized live production work for the Lewis MCP
connection. This gate authorizes exactly the additive Workspace migration
`20260827124853_lewis_phase0_task_actions.sql` (SHA-256
`e36489290be9a519a50b08e9d45a71d1cd2a0e2ec415b9f25b8608c87fb0bce7`) and
the matching Workspace application release that exposes only `list_tasks`,
`create_task`, `update_task`, and `delete_task`, fixes MCP origin handling,
and accurately describes authorization/tool availability. Task creation is
idempotent; update and permanent deletion require explicit client confirmation.

This gate does not authorize external-provider OAuth credentials or actions,
the copying or reuse of any token, Ministry or Consulting mutation, billing or
plan changes, a real-user data migration, legacy cleanup, or a broader claim
of full Workspace parity. It does permit only a user-explicit task mutation
after the caller has authorized Lewis.

The Ministry repository remains the sole authority for the shared-hosted
migration. Target preflight on 2026-08-27 found that the intended shared
production project `cirqqhuvzekbvysiyedg` has `workspace.tasks` but lacks the
existing MCP authorization table and guard functions required by this additive
migration. Separately, the public resource metadata at
`https://workspace.leademergence.com/api/mcp` declares
`nhkugzifuapplwpnfpbt` (`lead-emergence-personal-sandbox`) as its OAuth
authority, and that project has the MCP foundation but not the new task RPCs.

The original scope authorization is not an authorization to apply SQL to the
wrong target. A fresh, target-specific decision is required: either an
explicitly temporary repair of the sandbox-backed live endpoint, or the larger
production cutover that first establishes the Workspace MCP foundation on the
shared project. Do not apply this migration or promote the app until that
decision is recorded. Until then, no task is represented as saved through
ChatGPT or Claude.

## Lewis shared-production foundation cutover decision

Status: **User-selected production path; exact package, identity-continuity
plan, and target preflight are required before the live application promotion.**

On 2026-08-27, the user selected the consumer-ready path: establish the full
Workspace/MCP foundation on shared production `cirqqhuvzekbvysiyedg`
(`emergence-ministry-platform`) first, then deploy Lewis. This rejects a
temporary sandbox repair. The required additive shared-production foundation is
the reviewed Workspace productization/MCP authorization stack, its direct
session/RLS hardening and OAuth-session handling, the production MCP resource
configuration, and the Phase 0 task-action migration. It must be reconciled
with the already-applied shared integration-vault package and remain under the
Ministry repository's migration authority.

The selection authorizes preparation of that exact Ministry-hosted package,
read-only target preflight, and the associated production cutover evidence. An
application promotion may occur only after the package has been reviewed,
recorded here with its source hashes and shared-target postflight results, and
the shared Auth/OAuth configuration has been verified. The public MCP endpoint
must then advertise the shared project's authorization server rather than the
sandbox one.

This decision does **not** authorize copying or overwriting real user records,
passwords, sessions, tasks, or other personal data from the sandbox, nor the
copying/reuse of external-provider tokens. The inventory shows that the
sandbox contains active Workspace data while the shared project has a different
Auth population. A separate identity-and-data continuity plan, reconciliation
evidence, and explicit data-migration approval are therefore release gates:
Lewis must not be promoted in a way that silently strands a user's existing
Workspace data. External connector OAuth remains reconnect-required and is not
enabled by this decision.

## Lewis shared-production foundation package preflight

Status: **Applied and database-verified; runtime and identity cutover remain
blocked.**

On 2026-08-27, Ministry-authority commit `143943c` prepared the
`workspace-shared-production-foundation` package for shared project
`cirqqhuvzekbvysiyedg`. It contains seven ordered target migrations:
productization, first-capture analytics, private RLS hardening, advisor
performance hardening, OAuth session-client handling, production resource
alignment, and Phase 0 Lewis task actions. Each target migration has the exact
reviewed Workspace source body and SHA-256 provenance in its header; the
package is ordered after shared version `20260826190000` of the integration
vault.

Read-only preflight on the shared project returned
`eligible_for_foundation_package: true`. It confirmed the Workspace and private
schemas, required core tables/functions and storage bucket, and the previously
applied integration-vault tables, while confirming none of the productization
or MCP task objects are already partially present. This is database evidence
only; it neither activates the shared Auth hook/Entry identity provider nor
applies any DDL.

The previously considered disposable branch was not created. After the
Entry-development rehearsal, the user gave explicit live-production approval
for this exact package. An immediate repeat of the preflight again returned
`eligible_for_foundation_package: true`, so the Ministry authority applied the
reviewed package directly to the shared target.

The Entry-development bootstrap rehearsal recorded below validates the
additive core, task-RPC grants, private receipt boundary, RLS, and source
provenance without touching shared data. Under the user's recorded
live-production authorization and selected shared-foundation-first path, the
exact reviewed seven-migration package
`workspace-shared-production-foundation` was applied to
`cirqqhuvzekbvysiyedg` after an immediate repeat of its read-only preflight.
That authorization was limited to the package's additive schema and
authorization objects; it did not authorize Vercel promotion, Auth dashboard
hook/provider changes, external connector activation, or any data/identity
migration.

### Shared-production execution evidence — 2026-08-27

The following seven ordered migrations applied successfully to
`cirqqhuvzekbvysiyedg`: `20260827161000_workspace_productization`,
`20260827161100_workspace_first_capture_event`,
`20260827161200_workspace_private_rls`,
`20260827161300_workspace_advisor_performance`,
`20260827161400_workspace_mcp_oauth_session_client`,
`20260827161500_workspace_mcp_production_resource`, and
`20260827161600_workspace_lewis_phase0_task_actions`.

The package postflight passed: the canonical resource is
`https://workspace.leademergence.com/api/mcp`; all required Workspace tables,
functions, profile/membership changes, and private RLS controls exist; the
Entry provider database configuration is enabled; task receipts are private;
anonymous task-RPC execution is denied while authenticated execution is
granted; the custom-hook function is restricted to `supabase_auth_admin`; and
external connectors remain disabled with an integration limit of zero. The
package access-control assertion returned
`workspace_shared_production_foundation_access_controls_verified: true`.

Security-advisor output has no new Workspace scope warning or error. The four
scope-specific RLS-with-no-policy INFO notices are intentional deny-all,
private-table defense in depth; fresh Workspace/private indexes report only
unused-index INFO before representative workload exists. No advisor finding
was remediated outside this package.

This is a database-only foundation cutover. No Vercel runtime/environment was
changed, no Auth dashboard hook or custom Entry provider was saved, no
user/identity/task data was copied, and no external connector OAuth credential
or integration was activated. The public endpoint still advertises the paused
Personal sandbox `nhkugzifuapplwpnfpbt` as its OAuth authority, so ChatGPT and
Claude task writes remain unavailable until the separate runtime and
identity-continuity release gates pass.

### Runtime configuration gap — read-only inspection

The shared Auth dashboard confirms that the OAuth server and dynamic OAuth app
registration are enabled with authorization path `/oauth/consent`, but its
current Site URL is `https://www.leademergence.com`. That produces
`https://www.leademergence.com/oauth/consent`, while the canonical Workspace
domain is the host that currently serves the Workspace consent route. The
`www` host remains the Ministry application and returns its own 404 response
for Workspace protected-resource metadata. No shared custom Entry provider and
no Auth hook are configured in the dashboard. These are release blockers, not
safe defaults to change while the production Entry identity authority and
runtime environment remain unresolved.

## Lewis Entry-dev bootstrap rehearsal gate

Status: **User-authorized isolated Workspace bootstrap rehearsal on the
partner-backed Entry development project; no production promotion.**

On 2026-08-27, after confirming that either project in the separate partner
Sandbox organization could be used, the user authorized an isolated rehearsal.
The selected target is `vnjdubrnmxvmsccxmhst`
(`lead-emergence-entry-dev`), not the Consulting development project. This
choice keeps Consulting data and integration tokens out of scope while retaining
the target's existing Entry identity schema untouched.

The authorized package is
`workspace-entry-dev-bootstrap-rehearsal`, containing the eleven reviewed
Workspace source migrations from commit
`3f420ce8d7bafca9de4d039b8e53bbeb1d885159`: foundation, coexistence
hardening, clock preferences, productization, first-capture event, private RLS,
advisor performance, MCP OAuth session handling, MCP resource alignment,
integration vault, and Lewis Phase 0 task actions. Its preflight must first
confirm that the Entry identity schema exists and all Workspace artifacts are
absent. After successful preflight, applying that exact additive package,
postflight, access-control test, and database advisors is authorized on this
target only.

This gate does not authorize Vercel configuration, public DNS or route changes,
an Auth custom token hook, a custom OAuth provider, ChatGPT/Claude connection,
external connector enablement, user/task/identity migration, credential reuse,
or any shared-production DDL. The rehearsal does not read or modify
`entry_identity` records and does not access Consulting data.

Execution evidence: target preflight returned
`eligible_for_entry_dev_bootstrap: true`. The following exact target
migrations then applied successfully on Entry development:
`20260827170000_workspace_foundation`,
`20260827170100_workspace_gate_a_cross_product_hardening`,
`20260827170200_workspace_clock_preferences`,
`20260827170300_workspace_productization`,
`20260827170400_workspace_first_capture_event`,
`20260827170500_workspace_private_rls`,
`20260827170600_workspace_advisor_performance`,
`20260827170700_workspace_mcp_oauth_session_client`, and
`20260827171000_workspace_lewis_phase0_task_actions`.

The managed hosted-migration safety control declined
`20260827170800_workspace_mcp_production_resource` because it persistently
aligns an Entry-development OAuth audience to the live MCP resource, and it
declined `20260827170900_workspace_integration_vault` because it creates
connector credential/OAuth-attempt storage. Neither migration was applied and
no workaround was attempted. The productization source already retains the
canonical resource setting as source behavior, but the target Auth hook remains
unconfigured, no provider/client is enabled for this target, and no runtime is
pointed at it.

Partial postflight verifies Workspace schemas, all core task RPCs, authenticated
task-RPC grants, deny-all private task receipts, private Storage, external
connector capability disabled, integration limit zero, Entry identity tables
preserved, and the custom-hook grant restricted to
`supabase_auth_admin`. The only expected incomplete postflight fields are the
two integration-vault tables. The package's direct `SET ROLE anon` test cannot
run through the hosted SQL executor because that executor lacks role-switch
permission; privilege inspection confirms anonymous task execution is denied.
Security advisor output contains only the intentional private-table
RLS-with-no-policy deny-all INFO notices, one existing Entry audit-table INFO,
and the target's pre-existing leaked-password-protection WARN. Performance
advisor output is fresh-schema unused-index INFO only. No external connector,
OAuth consent, user data, or shared-production object changed.

## Lewis internal Workspace-parity source candidate

Status: **Source and local verification complete; not applied or deployed.**

The Workspace source branch now includes
`20260828000252_lewis_workspace_parity_actions`. It extends Lewis from the
original onboarding, leadership-state, capture, and Phase 0 task contract with
controlled internal Workspace parity actions: list/resolve/discard Quick
Captures; list/create/delete memory; list/create/update career opportunities;
replace explicitly confirmed configuration; and read integration-connection
metadata. It deliberately does not create a general table/data API, bypass RLS,
return credentials, activate a connector, or perform an external side effect.

All actions remain scoped by the existing OAuth audience, bearer user,
registered MCP client, personal Workspace ownership, and plan capability. The
source requires explicit user confirmation for writes, flags discard/deletion
and configuration replacement as destructive, and uses private idempotency
receipts for creates and replacement. Local schema lint, source contracts,
unit tests, pgTAP/RLS tests, boundary checks, typecheck, lint, and production
build all pass; detailed evidence is in `docs/testing/test-evidence.md`.

This source candidate is **not** an authorization to apply its migration to a
hosted project or deploy it. The remaining consumer-production release gates
are still: a deliberate production Entry identity decision; configured shared
Auth hook and Entry provider; a Workspace-owned Vercel production project and
environment alignment; live ChatGPT and Claude OAuth/client acceptance; and a
separately reviewed connector OAuth/action framework. Until those gates are
approved and passed, the shared runtime still exposes only the prior live MCP
contract and no ChatGPT or Claude task is represented as saved.

## Lewis consumer-readiness source hardening — 2026-08-28

Status: **Local source and verification complete; no hosted migration,
runtime deployment, Auth configuration, connector activation, or production
cutover is authorized by this record.**

The source candidate now also includes
`20260828002432_lewis_connector_capability_gates` and
`20260828004945_lewis_workspace_preference_parity`.

- External connectors fail closed unless the direct Workspace owner has an
  active plan with `external_connectors` enabled and a positive
  `integration_limit`. The gate validates provider-to-credential-family
  mapping, reserves capacity for active OAuth attempts, enables RLS on the
  private credential/attempt tables, and prevents an in-flight OAuth callback
  from recreating a credential after native disconnect.
- Native disconnect removes the Workspace-held encrypted credential, clears
  linked metadata, and invalidates relevant OAuth attempts. It does not claim
  provider-side grant revocation; that remains a provider-adapter release gate.
- ChatGPT and Claude are now modeled exclusively as `mcp_oauth` assistant
  connections rather than API-key integrations. The generic credential route
  rejects them.
- Lewis adds narrow preference/assistant parity only: read/save three valid
  display-clock time zones, list assistant states without client IDs, and
  disconnect only the current assistant with explicit confirmation. It still
  does not activate external providers, return credentials, send messages, or
  create calendar events.
- The consumer production matrix and ordered cutover gates are recorded in
  `docs/architecture/lewis-consumer-mcp-readiness.md`. A clean dedicated Entry
  production identity authority remains the recommended path; promotion of a
  populated development identity project requires a separate approved identity
  inventory, cleanup/retention decision, and secret/session rotation plan.

All three new source migrations were applied only to the local Supabase stack.
The local ledger matches source through `20260828004945`, and local schema lint
reports no errors. The shared production runtime remains on its previous live
MCP contract and external connectors remain disabled there.

## Consumer connector release control — 2026-08-28

Status: **Local source and verification complete; no hosted migration,
runtime deployment, Auth configuration, provider consent, or production cutover
is authorized by this record.**

The source candidate now also includes
`20260828011121_lewis_connector_release_registry`. It introduces a private,
default-off provider release registry. An active Personal plan and external
connection capacity no longer suffice to start OAuth or save a credential: the
provider must also be explicitly released in both the source application and
the database. Generic integration routes reject unreleased providers, while a
legacy connection can still be natively disconnected and purged.

The public catalog now accurately labels external providers as planned. It no
longer claims that Workspace can send Slack messages, create Calendar events,
draft/send Gmail, write files, create exports, or otherwise operate a provider
without its separately reviewed action adapter. Future provider releases must
include the action contract, exact scopes, confirmation UX, idempotency,
outbound audit, refresh/revocation, provider test evidence, and a written
production gate.

A read-only live smoke check of the Workspace assistant-connection route found
that it remains stuck at “Loading your private workspace” with an
`AuthRetryableFetchError` before sign-in. This confirms the current paused or
misaligned public runtime/identity configuration is a release blocker. It was
observed only; no production setting was changed.

## Assistant connection parity control — 2026-08-28

Status: **Local source and verification complete; no hosted migration, runtime
deployment, Auth configuration, external-provider consent, or production
cutover is authorized by this record.**

The source candidate now also includes
`20260828100646_lewis_assistant_connection_parity`. Native Workspace already
lets an owner revoke any ChatGPT or Claude connection. Lewis now has the same
confirmed capability through an opaque `connection_id` returned from its
assistant-connection list. It never returns an OAuth client ID or credential.

- The controlled revoke RPC requires an active current MCP bearer, the Personal
  Workspace capability, a target authorization owned by the same user and
  Workspace, and explicit tool-layer confirmation. It invalidates future calls
  from the target connection and records an audit event without storing the raw
  client identifier in the event.
- A guessed connection handle from another Workspace is treated as absent and
  cannot reveal or alter that connection. The current-assistant self-disconnect
  remains available for the fast “remove this assistant now” path.
- This closes the remaining native write/control mismatch found in the parity
  review. External-provider credentials and actions remain intentionally
  unreleased until each provider has its own adapter, consent scope, action
  contract, and written production gate.

## Partner workspace boundary correction — 2026-08-28

Status: **No hosted project has been resumed, linked, migrated, configured, or
deployed. The previously considered paused projects are explicitly out of
scope.**

The partner workspace shown by the user contains the intended active sandboxes:
`lead-emergence-entry-dev` (`vnjdubrnmxvmsccxmhst`) and
`lead-emergence-consulting-dev` (`eudlnlizoioqwqjuxgro`).

- Lewis Workspace uses `lead-emergence-entry-dev` as the shared identity and
  production-foundation candidate. `lead-emergence-consulting-dev` remains out
  of scope for this private Workspace product.
- `lead-emergence-personal-sandbox` and `lead-emergence-meridian-sandbox` are
  paused projects in a different workspace. They must remain untouched and are
  not production candidates.
- Read-only Entry inventory found no deployed Edge Functions and no configured
  project secrets. The accessible Vercel team likewise has no project. There is
  therefore no existing owned Workspace runtime to repair or cut over; the
  shared foundation must be deliberately established on Entry before Lewis can
  be deployed.
- Read-only project inspection now confirms the Entry baseline: its migration
  ledger contains the identity foundation, Workspace foundation through Phase 0
  task actions, and it has the canonical MCP resource URI plus the task-create
  RPC. Workspace and private tables contain no user records. The integration
  vault tables and the new capture/assistant-parity RPCs are absent, which is
  the expected incremental-release baseline.
- Before any hosted change, the written gate must still record the Entry project
  identity inventory and retention decision, session/secret rotation plan, Auth
  and OAuth configuration, Workspace migration authority, Vercel runtime
  environment, and a reversible acceptance test plan.

## Lewis Entry incremental release package — 2026-08-28

Status: **Source packaging in progress; no hosted migration or runtime change.**

Read-only inspection of `lead-emergence-entry-dev`
(`vnjdubrnmxvmsccxmhst`) confirms it is the intended incremental target. It
has a zero-record Workspace foundation through the Phase 0 task actions and
the canonical MCP resource URI. It lacks only the integration-vault tables and
the five new Lewis parity/control migrations.

The deterministic package therefore contains, in order:
`20260825000000_workspace_integration_vault.sql`, followed by
`20260828000252_lewis_workspace_parity_actions.sql`,
`20260828002432_lewis_connector_capability_gates.sql`,
`20260828004945_lewis_workspace_preference_parity.sql`,
`20260828011121_lewis_connector_release_registry.sql`, and
`20260828100646_lewis_assistant_connection_parity.sql`. It excludes the older
Gate-A bootstrap package and the resource-URI migration because the Entry
baseline already has those objects and URI.

Before any execution, the generated read-only preflight must still match this
baseline and the remaining identity, OAuth, Vercel, and acceptance gates must
be recorded. Every external provider remains default-off in the package.
