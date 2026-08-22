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

Status: **local candidate validated; Workspace and Entry PRs are open and green; the Workspace Preview build is green; hosted schema/Auth configuration and authenticated Preview acceptance remain; hosted migration and production cutover are not approved**.

The productization source adds one-login Personal SSO consumption, shared native and AI-assisted setup, Workspace MCP authorization, Personal plan/capability resolution, plan-safe Settings, first-value Home behavior, useful empty states, and production operations documentation. The custom Workspace domain was already healthy before this goal; the Vercel rollback URL remains available.

No Goal C migration has been applied to the shared hosted project. The ministry repository remains its sole migration authority. No Goal C PR has been merged, no real user has been migrated or activated, no external connector token has been copied, no billing/trial/pricing has been activated or invented, and no production-cutover gate approval is recorded here.

Workspace PR [#4](https://github.com/abostwick12/lead-emergence-workspace/pull/4) and Entry PR [#2](https://github.com/abostwick12/lead-emergence-entry/pull/2) are open and mergeable. Workspace Vercel Preview checks and the Entry quality workflow are green. The protected Workspace Preview renders the productized public sign-in and safe rollback state without console errors, but Entry OIDC correctly fails closed until the environment-specific provider/client and hosted schema are provisioned. Therefore authenticated Preview and productized custom-domain acceptance are not yet claimable.

Local and external acceptance evidence is recorded in `docs/testing/test-evidence.md`: all required application checks, a fresh database rebuild, 85 pgTAP assertions, 8 desktop/mobile browser cases, database lint, full dependency audit, boundary scan, sensitive-data scan, green PR checks, and custom-domain/TLS baseline checks pass. This evidence is not a hosted-migration or cutover approval.
