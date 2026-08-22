# Goal C candidate acceptance matrix

Evidence date: 2026-08-22

This is the requirement-by-requirement candidate audit. The two exact Personal-sandbox advisor migrations recorded in the status log were separately authorized, applied, and verified on 2026-08-22. This document does not authorize any additional hosted migration, OAuth client/provider creation, paid Supabase change, PR merge, Production deployment, real-user activation, billing, or cutover. `PASS` means the named scope was executed. `BLOCKED` means the required hosted evidence cannot exist until the recorded external gate is resolved.

## Product lifecycle

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| AI-first setup choice | PASS local/hosted | Productized setup-method screen follows successful one-login SSO; desktop/mobile Playwright lifecycle passes. |
| ChatGPT path | PASS UI/contract/fallback; real-client acceptance pending | Hosted selection, controlled connection instructions, consent language, connection verification, and native fallback pass. A real ChatGPT client connect/use/revoke cycle remains interactive. |
| Claude path | PASS UI/contract/fallback; real-client acceptance pending | Hosted selection, controlled connection instructions, consent language, connection verification, and native fallback pass. A real Claude client connect/use/revoke cycle remains interactive. |
| Native non-AI setup | PASS local/hosted | Save/resume/completion and first value pass on desktop/mobile Preview. |
| Onboarding resume | PASS local/hosted | Hosted reload resumed step 2 with the previously confirmed areas intact. |
| AI to native switch | PASS local/hosted | Hosted AI fallback returned to the saved native step without clearing context. |
| Native to AI switch | PASS local/hosted | Hosted native progress switched to ChatGPT and resumed natively without restart. |
| Returning ready user | PASS local/hosted | Hosted sign-out/sign-in bypassed setup and returned directly to Home. |
| First value | PASS local/hosted | Confirmed priority produced leadership-focus Home; first Capture persisted and its content-free event was repaired/proven. |
| No connectors | PASS local/hosted | Home, Tasks, Capture, Memory, Career, Daily Brief preferences, plan, and configuration remain useful with zero connections. |
| Hosted new/returning lifecycle | PASS | An ACTIVE synthetic Entry entitlement completed one-login SSO, first entry, resumable native setup, first value, returning Home, and plan/no-connector surfaces. |

## Plan and capability architecture

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Entry entitlement separated from Personal authorization | PASS | Schema contract, Entry provisioning RPC, 93 local pgTAP assertions, and 91 post-migration hosted assertions. |
| Personal plan and typed capabilities | PASS | Central resolver, plan/capability catalog, UI presentation, and unit tests. |
| Current plan/included/available/limits | PASS local/hosted | Hosted Settings shows current Personal plan, included benefits, unavailable capabilities, and neutral upgrade language. |
| Graceful locked states | PASS local | Suspended-plan desktop/mobile browser case. |
| Direct API/MCP bypass | DENIED local/hosted | Capability, direct-table, audience, disconnected bearer, and cross-user MCP assertions pass transactionally. |
| Downgrade data retention | PASS local | Suspended/excluded capability assertions retain records/configuration. |
| Cross-user plan inheritance | DENIED local | Cross-user plan/config isolation assertions. |
| Trial readiness | PREPARED | Nullable trial/conversion fields; no terms active. |
| Billing | NOT ACTIVATED | Unpriced Personal plan; no checkout, subscription, payment link, or provider. |

## MCP and connectors

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Controlled onboarding tools | PASS local/hosted SQL | Six onboarding tools, epistemic states, completion guard, and hosted transactional execution pass. |
| Exact MCP resource audience | PASS local/hosted metadata | Preview DB setting, protected-resource metadata, hook claim, and wrong-audience denial use the same stable branch resource. |
| Connected/disconnected/revoked behavior | PASS local/hosted SQL | Authorization epoch, disconnect, reconnect, and older-bearer denial assertions pass. |
| MCP cross-user isolation | DENIED local/hosted SQL | User A/User B setup, capability, client, and tool isolation assertions pass. |
| ChatGPT/Claude interactive use | PARTIAL hosted | Personal OAuth server/provider and explicit Workspace consent are configured; a synthetic public client reached and approved the controlled consent screen. Real ChatGPT/Claude connect/use/refresh/disconnect/reconnect/revocation is still user-interactive and not claimed. |
| External connectors | DEFERRED TRUTHFULLY | Catalog/metadata only, connection limit zero, no approved runtime adapter or token reuse. |
| Connector cross-user credential access | NOT APPLICABLE TO THIS RELEASE | No credential adapter/store exists; base integration metadata remains owner-RLS protected. |

## Security and privacy

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Workspace RLS | PASS local/hosted | 93/93 local pgTAP and 91/91 post-migration hosted transactional assertions; all three server-owned private configuration tables now have defense-in-depth RLS. |
| `workspace_private` isolation | PASS local/hosted | Unexposed schema, revoked grants, pinned search paths, policy-free table RLS, and hostile assertions pass. |
| Storage ownership | PASS local/hosted | Owner/non-owner/private-prefix assertions pass; uploads remain disabled. |
| Service-role exposure | PASS | Boundary scan finds no runtime client/key; ordinary access uses authenticated RLS. |
| Minimum/private analytics | PASS local/hosted | Exactly-once first-capture event is server-side and excludes capture text; no new vendor. |
| Secret scan | PASS | Repository/history scanner and full diff scan found no credential or Personal-data pattern. |
| Shared hosted advisors before Goal C | PASS for current Workspace scope | No current finding targets Workspace schemas/Storage; one project-level Auth warning and unrelated shared-schema warnings remain documented. |
| Hosted post-migration advisors | PASS for Workspace actionable scope | Authorized migrations are in the Personal sandbox ledger. Workspace Auth init-plan findings are 0, uncovered Workspace/private foreign keys are 0, and private RLS/grants pass. The 48 Workspace/private unused-index INFO notices are retained because a fresh sandbox has no representative workload history. |

## Domain, identity, and deployment

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| `workspace.leademergence.com` DNS/TLS/application | PASS baseline | Healthy Vercel CNAME, TLS 1.3 certificate, correct existing Workspace, security headers, no console error. |
| Rollback Vercel URL | AVAILABLE/PASS | Existing URL remains healthy and was not removed or repointed. |
| Canonical Workspace Production origins | PASS configuration | Production app and MCP resource values use the custom domain; no deployment was triggered. |
| Workspace branch Preview | PASS authenticated/runtime | Protected Preview proves native lifecycle and mobile/desktop flows; exact MCP metadata and zero error/5xx runtime events. |
| Entry branch Preview | PASS public/runtime | Green build/CI, login, JWKS, exact Preview app/product origins, corrected Personal Supabase Auth callback, zero error/5xx events. |
| Entry to Workspace SSO source | IMPLEMENTED | Entry PR and Workspace PR reuse the proven OAuth/OIDC contract and fail closed. |
| Entry to Workspace hosted SSO | PASS | Personal custom provider/Auth hook and Entry OAuth client are active; the synthetic entitled Entry user reached Workspace first run without a second login. |
| Live Entry production authority | PARTIAL/PAUSED | Dedicated Vercel project, verified `entry.leademergence.com` DNS/TLS, Git connection, Next.js/Node 24 configuration, public origins, and unique signing credentials are ready. Vercel automatically classified the first Git build as Production; the credential-incomplete project was immediately paused and the domain returns `503 DEPLOYMENT_PAUSED`. A distinct production Entry Supabase backend and OAuth clients are absent; `www.leademergence.com` remains Ministry. |
| Second credential prompt | FALSE | Hosted Entry → Workspace acceptance completed with the Entry credential only. |

## UI, mobile, and accessibility

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Full redesign performed | NO | Workflow additions preserve the approved shell, navigation, colors, typography, cards, spacing, and modules. |
| Desktop/mobile product lifecycle | PASS local/hosted | Ten local cases plus hosted native first-run, Home, Settings, Connections, and ChatGPT/Claude setup at desktop/mobile. |
| Keyboard/labels/focus/semantics | PASS focused | Role/label-driven Playwright interaction and explicit first-entry focus/alert assertions. |
| Touch targets | PASS focused | Primary/rollback targets measured at 44px or larger; compact workflow controls raised to the same baseline. |
| Contrast | PASS focused | Measured 4.5:1+ first-entry action/support copy; low-emphasis shell labels corrected to `--muted`. |
| Hosted authenticated desktop/mobile | PASS native; real-client MCP pending | Hosted one-login and desktop lifecycle pass; responsive mobile product surfaces and the matching full local authenticated mobile lifecycle pass. |

## PR and regression state

| Artifact | Candidate result |
| --- | --- |
| Workspace PR #4 | Open, green, mergeable; production merge not authorized. |
| Entry PR #2 | Open, green, mergeable; production merge not authorized. |
| Workspace required application checks | PASS. |
| Fresh local database rebuild | PASS. |
| Workspace pgTAP | 93/93 local PASS; 91/91 post-migration hosted transactional PASS. |
| Entry pgTAP | 44/44 PASS. |
| Workspace unit tests | 40/40 PASS. |
| Entry unit tests | 15/15 PASS. |
| Full dependency audits | 0 findings in both repositories. |
| Full Workspace browser lifecycle | 10/10 PASS (desktop and Pixel-class mobile). |
| Hosted public accessibility browser cases | 4/4 PASS. |

## Concrete remaining gates

1. Complete real ChatGPT and Claude client connect/use/refresh/disconnect/reconnect/revocation acceptance through their interactive OAuth UI, or explicitly approve a documented deferral for a client that cannot be automated safely.
2. Select an available organization/slot for the distinct Entry production Supabase project. `Lead emergence sandbox` is full with Consulting dev and Entry dev; pausing/repurposing Consulting or paying for capacity is not authorized.
3. Validate the final optional-field fix on the immutable Workspace Preview deployment after adding its exact temporary redirect to the isolated Personal allowlist; then remove that temporary redirect.
4. Remove retained synthetic hosted acceptance identities and the synthetic OAuth client/grant, refresh advisors/logs/secret scan/final checks, and stop at green Preview readiness without merging Production.

Candidate state: **NOT YET READY FOR WORKSPACE PRODUCTION CUTOVER**.
