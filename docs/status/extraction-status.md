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

Status: **Approved for Ministry-authority application and Workspace deployment; not yet applied.**

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
migration. Its operator must package and compare the exact migration against
current Ministry `main`, verify the production target and normal backup/
preflight evidence, apply and postflight the task RPC/grant/RLS contract, and
only then deploy the matching Workspace application. The app release must not
precede the migration. Record the deployment, postflight, and real-client
acceptance separately; until then, no task is represented as saved through
ChatGPT or Claude.
