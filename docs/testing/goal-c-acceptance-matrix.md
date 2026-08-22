# Goal C candidate acceptance matrix

Evidence date: 2026-08-22

This is the requirement-by-requirement candidate audit. It does not authorize a hosted migration, OAuth client/provider creation, paid Supabase change, PR merge, Production deployment, real-user activation, billing, or cutover. `PASS` means the named scope was executed. `BLOCKED` means the required hosted evidence cannot exist until the recorded external gate is resolved.

## Product lifecycle

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| AI-first setup choice | PASS local | Productized setup-method screen and desktop/mobile Playwright lifecycle. |
| ChatGPT path | PASS local; BLOCKED hosted | Shared setup state, controlled MCP tool contract, failure fallback, and manual connection UI pass locally. Hosted OAuth/client consent is not configured. |
| Claude path | PASS local; BLOCKED hosted | Same contract with independent provider metadata; hosted OAuth/client consent is not configured. |
| Native non-AI setup | PASS local | Save/resume/completion and first value pass on desktop/mobile. |
| Onboarding resume | PASS local | Reload resumes the first incomplete required area. |
| AI to native switch | PASS local | Confirmed information remains in the shared configuration model. |
| Native to AI switch | PASS local | Existing native progress remains visible and is not restarted. |
| Returning ready user | PASS local | Ready user bypasses setup and reaches Home. |
| First value | PASS local | Confirmed priority produces a leadership-focus Home state. |
| No connectors | PASS local | Tasks, Capture, Memory, Career, Daily Brief preferences, configuration, and Home remain useful with nothing connected. |
| Hosted new/returning lifecycle | BLOCKED | Dedicated Personal sandbox is inactive; Goal C schema and hosted OAuth are absent. |

## Plan and capability architecture

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Entry entitlement separated from Personal authorization | PASS | Schema contract, Entry provisioning RPC, and 85-case pgTAP suite. |
| Personal plan and typed capabilities | PASS | Central resolver, plan/capability catalog, UI presentation, and unit tests. |
| Current plan/included/available/limits | PASS local | Settings acceptance and capability catalog. |
| Graceful locked states | PASS local | Suspended-plan desktop/mobile browser case. |
| Direct API/MCP bypass | DENIED local | Capability and MCP denial assertions in pgTAP. |
| Downgrade data retention | PASS local | Suspended/excluded capability assertions retain records/configuration. |
| Cross-user plan inheritance | DENIED local | Cross-user plan/config isolation assertions. |
| Trial readiness | PREPARED | Nullable trial/conversion fields; no terms active. |
| Billing | NOT ACTIVATED | Unpriced Personal plan; no checkout, subscription, payment link, or provider. |

## MCP and connectors

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Controlled onboarding tools | PASS local | Six onboarding tools, explicit epistemic states, completion guard, and prompt posture. |
| Exact MCP resource audience | PASS local/Preview metadata | Wrong-audience pgTAP denial and exact branch protected-resource metadata. |
| Connected/disconnected/revoked behavior | PASS local | Authorization epoch and disconnected-bearer denial assertions. |
| MCP cross-user isolation | DENIED local | User A/User B setup, capability, and tool isolation assertions. |
| ChatGPT/Claude interactive use | BLOCKED hosted | OAuth client/provider and explicit product consent are not configured. |
| External connectors | DEFERRED TRUTHFULLY | Catalog/metadata only, connection limit zero, no approved runtime adapter or token reuse. |
| Connector cross-user credential access | NOT APPLICABLE TO THIS RELEASE | No credential adapter/store exists; base integration metadata remains owner-RLS protected. |

## Security and privacy

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Workspace RLS | PASS local | 85/85 pgTAP plus schema lint. |
| `workspace_private` isolation | PASS local | Grants, unexposed schema, pinned search paths, and hostile assertions. |
| Storage ownership | PASS local | Owner/non-owner/cross-product/private-bucket assertions; uploads remain disabled. |
| Service-role exposure | PASS | Boundary scan finds no runtime client/key; ordinary access uses authenticated RLS. |
| Minimum/private analytics | PASS | Fixed event names and non-content contexts; no new vendor. |
| Secret scan | PASS | Repository/history scanner and full diff scan found no credential or Personal-data pattern. |
| Shared hosted advisors before Goal C | PASS for current Workspace scope | No current finding targets Workspace schemas/Storage; one project-level Auth warning and unrelated shared-schema warnings remain documented. |
| Hosted post-migration advisors | BLOCKED | Goal C migration is not applied to an approved hosted backend. |

## Domain, identity, and deployment

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| `workspace.leademergence.com` DNS/TLS/application | PASS baseline | Healthy Vercel CNAME, TLS 1.3 certificate, correct existing Workspace, security headers, no console error. |
| Rollback Vercel URL | AVAILABLE/PASS | Existing URL remains healthy and was not removed or repointed. |
| Canonical Workspace Production origins | PASS configuration | Production app and MCP resource values use the custom domain; no deployment was triggered. |
| Workspace branch Preview | PASS public/runtime | Green Vercel build, exact MCP metadata, productized login, zero error/5xx runtime events. |
| Entry branch Preview | PASS public/runtime | Green build/CI, login, JWKS, exact Preview app/product origins, corrected Personal Supabase Auth callback, zero error/5xx events. |
| Entry to Workspace SSO source | IMPLEMENTED | Entry PR and Workspace PR reuse the proven OAuth/OIDC contract and fail closed. |
| Entry to Workspace hosted SSO | BLOCKED | Personal OAuth client/custom provider and active hosted Workspace schema are absent. |
| Live Entry production authority | PARTIAL/PAUSED | Dedicated Vercel project, verified `entry.leademergence.com` DNS/TLS, Git connection, Next.js/Node 24 configuration, public origins, and unique signing credentials are ready. Vercel automatically classified the first Git build as Production; the credential-incomplete project was immediately paused and the domain returns `503 DEPLOYMENT_PAUSED`. A distinct production Entry Supabase backend and OAuth clients are absent; `www.leademergence.com` remains Ministry. |
| Second credential prompt | FALSE locally; NOT PROVEN hosted | Source/session contract avoids a second login; hosted interactive acceptance cannot run yet. |

## UI, mobile, and accessibility

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Full redesign performed | NO | Workflow additions preserve the approved shell, navigation, colors, typography, cards, spacing, and modules. |
| Desktop/mobile product lifecycle | PASS local | Eight authenticated lifecycle cases across desktop and Pixel-class mobile. |
| Keyboard/labels/focus/semantics | PASS focused | Role/label-driven Playwright interaction and explicit first-entry focus/alert assertions. |
| Touch targets | PASS focused | Primary/rollback targets measured at 44px or larger; compact workflow controls raised to the same baseline. |
| Contrast | PASS focused | Measured 4.5:1+ first-entry action/support copy; low-emphasis shell labels corrected to `--muted`. |
| Hosted authenticated desktop/mobile | BLOCKED | Requires the active hosted schema and OAuth path. |

## PR and regression state

| Artifact | Candidate result |
| --- | --- |
| Workspace PR #4 | Open, green, mergeable; production merge not authorized. |
| Entry PR #2 | Open, green, mergeable; production merge not authorized. |
| Workspace required application checks | PASS. |
| Fresh local database rebuild | PASS. |
| Workspace pgTAP | 85/85 PASS. |
| Entry pgTAP | 44/44 PASS. |
| Workspace unit tests | 38/38 PASS. |
| Entry unit tests | 15/15 PASS. |
| Full dependency audits | 0 findings in both repositories. |
| Public accessibility browser cases | 4/4 PASS. |

## Concrete remaining gates

1. Confirm whether the active `lead-emergence-meridian-sandbox` project may be paused. The previously authorized path named a Consulting development sandbox, but current inventory proves Consulting uses the shared production project and the available active sandbox is Meridian.
2. Select the organization for a distinct Entry production Supabase project. The recommended `Lead emergence sandbox` organization has one active Entry development project and reports the additional project at `$0/month`; creation still requires explicit organization/cost confirmation.
3. Restore the Personal sandbox, record/apply the exact additive Goal C migration through the ministry authority, then create the authorized environment-specific Entry Personal OAuth client and Workspace custom provider in secret stores.
4. Configure the distinct Entry production backend/clients without reusing development credentials, deploy only the approved production candidate, and run authenticated hosted new/returning-user, AI/native switching, MCP consent/use/revoke, mobile/desktop, logs, Storage/RLS, and post-migration advisor acceptance.

Candidate state: **NOT YET READY FOR WORKSPACE PRODUCTION CUTOVER**.
