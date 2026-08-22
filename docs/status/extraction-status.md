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

Status: **local and isolated hosted native candidate validated; the two reviewed advisor migrations are approved for the Personal sandbox only; Workspace and Entry PRs remain open; real Entry OIDC/MCP consent, distinct production Entry backend capacity, and final PR checks remain; production cutover is not approved**.

The productization source adds one-login Personal SSO consumption, shared native and AI-assisted setup, Workspace MCP authorization, Personal plan/capability resolution, plan-safe Settings, first-value Home behavior, useful empty states, and production operations documentation. The custom Workspace domain was already healthy before this goal; the Vercel rollback URL remains available.

No Goal C migration has been applied to the shared hosted project. The ministry repository remains its sole migration authority. No Goal C PR has been merged, no real user has been migrated or activated, no external connector token has been copied, no billing/trial/pricing has been activated or invented, and no production-cutover gate approval is recorded here.

Workspace PR [#4](https://github.com/abostwick12/lead-emergence-workspace/pull/4) and Entry PR [#2](https://github.com/abostwick12/lead-emergence-entry/pull/2) are open and mergeable. Workspace Vercel Preview checks are green; Entry's final quality rerun is recorded in `docs/testing/test-evidence.md`. Authenticated Vercel inspection verified the final runtime-bearing Workspace and Entry branch deployments READY, both Next.js builds successful, zero error-level runtime events, zero 5xx error events, and environment-specific origins. Production `NEXT_PUBLIC_APP_URL` and `WORKSPACE_MCP_RESOURCE_URI` are canonical at `https://workspace.leademergence.com`; Preview uses its branch origin. Entry Preview routes Personal to the Workspace branch origin. The protected Workspace Preview renders the productized public sign-in and safe rollback state without console errors, but Entry OIDC correctly fails closed until the environment-specific provider/client, OAuth application, and hosted schema are provisioned. Therefore authenticated Preview and productized custom-domain acceptance are not yet claimable.

On 2026-08-22 the user explicitly authorized the recommended isolated path: temporarily pause the described Consulting development sandbox, restore the Personal sandbox, apply the exact additive Goal C migration through the designated authority, configure the environment-specific Entry OAuth client and Workspace provider, and provision a dedicated Entry origin. This approval excludes the shared production Supabase project, real users, billing, paid upgrades, PR merges, and production cutover.

On 2026-08-22 the user separately gave fresh written authorization to apply exactly `20260822132000_workspace_private_rls.sql` and `20260822133500_workspace_advisor_performance.sql` to the isolated Personal sandbox `nhkugzifuapplwpnfpbt`. This recorded gate applies only to those two reviewed forward migrations on that sandbox. It does not authorize any migration on shared production `cirqqhuvzekbvysiyedg`, any Ministry or Consulting mutation, a paid-plan change, a real-user migration, a PR merge, or production cutover.

After exact target confirmation, `lead-emergence-meridian-sandbox` (`lpqgjnuvfvuuashcmlxq`) was paused with its data preserved and Personal sandbox `nhkugzifuapplwpnfpbt` was restored to `ACTIVE_HEALTHY`. The isolated Personal sandbox received the Workspace foundation, clock, productization, Data API exposure, pgTAP acceptance support, and first-capture analytics migrations. The cross-product Gate A hardening migration was intentionally not applied because it targets an absent Ministry-owned `public` policy and the Supabase safety guard rejected that boundary-crossing mutation. Shared production remains unchanged.

Hosted evidence now includes 88/88 transactional assertions, first-run/native completion/resume/switching/first-value/returning-user browser acceptance, plan and no-connector states, mobile screenshots, exact Preview MCP metadata, zero browser console logs, and zero Vercel error-level or 5xx events. A hosted first-capture check exposed a missing analytics event; forward migration `20260822124500_workspace_first_capture_event.sql` now records it exactly once without capture content. The proposed private-table RLS hardening raises local pgTAP to 93/93; its exact hosted application is now authorized by the recorded sandbox-only gate above and awaits execution and verification.

The fresh-sandbox performance advisor also identifies 51 per-row Auth helper evaluations and 40 uncovered Workspace foreign keys. Forward migration `20260822133500_workspace_advisor_performance.sql` preserves policy semantics while making Auth evaluation init-plan safe and adds only missing covering indexes; fresh reset, 15/15 schema contracts, 93/93 pgTAP, and DB lint pass. A prior hosted application attempt was rejected before execution because the repository lacked the fresh written gate; that gate is now recorded above, with no partial application to recover. Eight unused-index notices are retained because a new sandbox has no representative usage history.

Entry Preview OAuth app `Lead Emergence Personal Workspace (preview)` now exists with callback `https://nhkugzifuapplwpnfpbt.supabase.co/auth/v1/callback`. Its public client ID is configured in Entry Preview, the one-time secret remains only in the authenticated browser session, and redeployment `dpl_EBcd6P3w62TyfKinQWr58FpLH7b6` is READY. The in-app Supabase session can administer Entry but cannot access the Personal organization, so custom-provider/Auth configuration requires a user-authenticated dashboard handoff. The intended Entry production Supabase organization is also full with `lead-emergence-consulting-dev` and `lead-emergence-entry-dev`; no project was created, no charge occurred, and Consulting was not paused or modified.

Entry SSO source and its isolated Preview remain green. The authorized dedicated Vercel project `lead-emergence-entry` owns the verified DNS-only custom domain `https://entry.leademergence.com` and is configured as Next.js on Node `24.x`. Exact public Production origins and a new environment-specific handoff signing keypair/redemption secret are stored in Vercel; Supabase credentials and OAuth client IDs remain absent. Vercel automatically classified the project's first Git build as Production and assigned the new aliases. The credential-incomplete project was immediately paused, and automatic Git deployment is now disconnected until cutover authorization; the non-production Preview project owns PR Vercel checks instead. The custom domain returns `503 DEPLOYMENT_PAUSED`; no Entry chooser route, real user, or approved traffic was cut over. The only current Entry database is the isolated development backend in a separate Free organization, so a distinct production Entry identity backend and its exact Auth/OAuth configuration remain required before unpausing or live one-login acceptance. `www.leademergence.com` remains the Ministry application and no Ministry route or alias changed.

Current shared-project security advisors report no finding against `workspace`, `workspace_private`, or Workspace Storage. One project-level Auth warning reports leaked-password protection disabled; the remaining existing warnings concern other shared-project schemas/products and are outside Goal C. Post-Goal-C hosted advisors cannot be claimed until the approved migration path exists.

Local and external acceptance evidence is recorded in `docs/testing/test-evidence.md`: all required application checks, a fresh database rebuild, 85 pgTAP assertions, 8 desktop/mobile browser cases, database lint, full dependency audit, boundary scan, sensitive-data scan, green PR checks, and custom-domain/TLS baseline checks pass. This evidence is not a hosted-migration or cutover approval.
