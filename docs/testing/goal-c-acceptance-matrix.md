# Goal C candidate acceptance matrix

Evidence date: 2026-08-22

This is the requirement-by-requirement candidate audit. It does not authorize a hosted migration, OAuth client/provider creation, paid Supabase change, PR merge, Production deployment, real-user activation, billing, or cutover. `PASS` means the named scope was executed. `BLOCKED` means the required hosted evidence cannot exist until the recorded external gate is resolved.

## Product lifecycle

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| AI-first setup choice | PASS local | Productized setup-method screen and desktop/mobile Playwright lifecycle. |
| ChatGPT path | PASS UI/contract; BLOCKED interactive OAuth | Hosted mobile/desktop setup and fallback instructions pass; live consent awaits the Personal provider. |
| Claude path | PASS UI/contract; BLOCKED interactive OAuth | Hosted mobile/desktop setup and fallback instructions pass; live consent awaits the Personal provider. |
| Native non-AI setup | PASS local/hosted | Save/resume/completion and first value pass on desktop/mobile Preview. |
| Onboarding resume | PASS local/hosted | Hosted reload resumed step 2 with the previously confirmed areas intact. |
| AI to native switch | PASS local/hosted | Hosted AI fallback returned to the saved native step without clearing context. |
| Native to AI switch | PASS local/hosted | Hosted native progress switched to ChatGPT and resumed natively without restart. |
| Returning ready user | PASS local/hosted | Hosted sign-out/sign-in bypassed setup and returned directly to Home. |
| First value | PASS local/hosted | Confirmed priority produced leadership-focus Home; first Capture persisted and its content-free event was repaired/proven. |
| No connectors | PASS local/hosted | Home, Tasks, Capture, Memory, Career, Daily Brief preferences, plan, and configuration remain useful with zero connections. |
| Hosted new/returning lifecycle | PASS native with synthetic identity; OIDC BLOCKED | Isolated sandbox and protected Preview prove product lifecycle; actual one-login remains the identity gate. |

## Plan and capability architecture

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Entry entitlement separated from Personal authorization | PASS | Schema contract, Entry provisioning RPC, 93 local pgTAP assertions, and 88 hosted assertions. |
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
| ChatGPT/Claude interactive use | BLOCKED hosted | OAuth client/provider and explicit product consent are not configured. |
| External connectors | DEFERRED TRUTHFULLY | Catalog/metadata only, connection limit zero, no approved runtime adapter or token reuse. |
| Connector cross-user credential access | NOT APPLICABLE TO THIS RELEASE | No credential adapter/store exists; base integration metadata remains owner-RLS protected. |

## Security and privacy

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Workspace RLS | PASS local/hosted | 93/93 local pgTAP and 88/88 hosted transactional assertions; private-table defense-in-depth remains pending hosted authorization. |
| `workspace_private` isolation | PASS local/hosted | Unexposed schema, revoked grants, pinned search paths, and hostile assertions pass; optional table RLS remains an explicit advisor decision. |
| Storage ownership | PASS local/hosted | Owner/non-owner/private-prefix assertions pass; uploads remain disabled. |
| Service-role exposure | PASS | Boundary scan finds no runtime client/key; ordinary access uses authenticated RLS. |
| Minimum/private analytics | PASS local/hosted | Exactly-once first-capture event is server-side and excludes capture text; no new vendor. |
| Secret scan | PASS | Repository/history scanner and full diff scan found no credential or Personal-data pattern. |
| Shared hosted advisors before Goal C | PASS for current Workspace scope | No current finding targets Workspace schemas/Storage; one project-level Auth warning and unrelated shared-schema warnings remain documented. |
| Hosted post-migration advisors | PARTIAL/PENDING APPROVAL | Security has no exposed Workspace/Storage finding. Private-table RLS and 91 actionable performance notices have locally proven forward migrations; hosted application requires fresh written gate approval. Eight unused-index notices are retained pending real workload evidence. |

## Domain, identity, and deployment

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| `workspace.leademergence.com` DNS/TLS/application | PASS baseline | Healthy Vercel CNAME, TLS 1.3 certificate, correct existing Workspace, security headers, no console error. |
| Rollback Vercel URL | AVAILABLE/PASS | Existing URL remains healthy and was not removed or repointed. |
| Canonical Workspace Production origins | PASS configuration | Production app and MCP resource values use the custom domain; no deployment was triggered. |
| Workspace branch Preview | PASS authenticated/runtime | Protected Preview proves native lifecycle and mobile/desktop flows; exact MCP metadata and zero error/5xx runtime events. |
| Entry branch Preview | PASS public/runtime | Green build/CI, login, JWKS, exact Preview app/product origins, corrected Personal Supabase Auth callback, zero error/5xx events. |
| Entry to Workspace SSO source | IMPLEMENTED | Entry PR and Workspace PR reuse the proven OAuth/OIDC contract and fail closed. |
| Entry to Workspace hosted SSO | BLOCKED | Workspace schema and Entry OAuth client are active; Personal custom provider/Auth hook and consent remain. |
| Live Entry production authority | PARTIAL/PAUSED | Dedicated Vercel project, verified `entry.leademergence.com` DNS/TLS, Git connection, Next.js/Node 24 configuration, public origins, and unique signing credentials are ready. Vercel automatically classified the first Git build as Production; the credential-incomplete project was immediately paused and the domain returns `503 DEPLOYMENT_PAUSED`. A distinct production Entry Supabase backend and OAuth clients are absent; `www.leademergence.com` remains Ministry. |
| Second credential prompt | FALSE locally; NOT PROVEN hosted | Source/session contract avoids a second login; hosted interactive acceptance cannot run yet. |

## UI, mobile, and accessibility

| Requirement | Candidate result | Authoritative evidence |
| --- | --- | --- |
| Full redesign performed | NO | Workflow additions preserve the approved shell, navigation, colors, typography, cards, spacing, and modules. |
| Desktop/mobile product lifecycle | PASS local/hosted | Eight local cases plus hosted native first-run, Home, Settings, Connections, and ChatGPT/Claude setup at desktop/mobile. |
| Keyboard/labels/focus/semantics | PASS focused | Role/label-driven Playwright interaction and explicit first-entry focus/alert assertions. |
| Touch targets | PASS focused | Primary/rollback targets measured at 44px or larger; compact workflow controls raised to the same baseline. |
| Contrast | PASS focused | Measured 4.5:1+ first-entry action/support copy; low-emphasis shell labels corrected to `--muted`. |
| Hosted authenticated desktop/mobile | PASS native; OIDC BLOCKED | Synthetic verified-provider users proved the product surfaces; actual Entry SSO remains. |

## PR and regression state

| Artifact | Candidate result |
| --- | --- |
| Workspace PR #4 | Open, green, mergeable; production merge not authorized. |
| Entry PR #2 | Open, green, mergeable; production merge not authorized. |
| Workspace required application checks | PASS. |
| Fresh local database rebuild | PASS. |
| Workspace pgTAP | 93/93 local PASS; 88/88 hosted transactional PASS. |
| Entry pgTAP | 44/44 PASS. |
| Workspace unit tests | 38/38 PASS. |
| Entry unit tests | 15/15 PASS. |
| Full dependency audits | 0 findings in both repositories. |
| Public accessibility browser cases | 4/4 PASS. |

## Concrete remaining gates

1. Provide a logged-in Personal Supabase dashboard session so the already-generated Entry Preview secret can be entered directly into the custom provider without disclosure.
2. Explicitly authorize the two locally proven hosted advisor migrations: defense-in-depth RLS for three unexposed/revoked `workspace_private` tables and policy/index performance hardening. The repository gate rejected hosted application without fresh written approval.
3. Select an available organization/slot for the distinct Entry production Supabase project. `Lead emergence sandbox` is full with Consulting dev and Entry dev; pausing/repurposing Consulting or paying for capacity is not authorized.
4. Configure Personal Auth URLs, custom provider, OAuth server/dynamic registration, access-token hook/signing key, then prove real Entry one-login and ChatGPT/Claude connect/use/disconnect/reconnect/revocation.
5. Remove the two synthetic `.invalid` acceptance users, refresh advisors/logs/secret scan/PR checks, and stop at green Preview readiness without merging Production.

Candidate state: **NOT YET READY FOR WORKSPACE PRODUCTION CUTOVER**.
