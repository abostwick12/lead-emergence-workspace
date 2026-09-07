# SOTF invited-pilot release and acceptance plan

## Configuration inventory

No secret values are recorded here. “Existing” means present in source contracts or prior status evidence; production values still require owner verification immediately before release.

| Configuration | Class | Current evidence | Production owner action |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required Workspace | Existing application contract; production target alignment is not re-verified by this local goal. | Confirm both point to the approved Workspace database/auth target. |
| `NEXT_PUBLIC_WORKSPACE_SCHEMA=workspace` | Required Workspace | Existing default and sample. | Confirm exact value. |
| `NEXT_PUBLIC_APP_URL=https://workspace.leademergence.com` | Required Workspace | Existing production contract. | Confirm exact immutable deployment environment. |
| `ENTRY_OIDC_PROVIDER` | Required Workspace shared login | Existing integration contract; exact production provider readiness remains unverified. | Confirm the provider ID matches the Entry-owned Personal OAuth client and callback. |
| `WORKSPACE_MCP_RESOURCE_URI=https://workspace.leademergence.com/api/mcp` | Required Workspace MCP | Existing canonical contract. | Confirm exact HTTPS resource on the release deployment and Auth resource registration. |
| `SOTF_PILOT_ENABLED=true` | Required for invited pilot | New default is safely `false`. | Set to `true` only after both migrations, identity/config checks, and approved release gate. Disable first during rollback. |
| `BUNDLE_INVITE_TOKEN_SECRET` | Required to issue invites | Server-only contract; intentionally absent from source. Minimum 32 random characters. | Generate/store in the approved secret manager, expose only to the Workspace server runtime, and rotate under incident procedure. |
| Bundle key `sotf_transition` | Required entitlement ID | Defined by foundation migration. | Do not rename or create an alias. Verify catalog row is active after migration. |
| Capability rows `career`, `daily_brief`, `memory`, `workspace_mcp`, `agentic_workflows` | Required bundle mappings | Defined by foundation migration; PC is deliberately absent. | Verify exactly these five enabled rows and no `professional_context` mapping. |
| Auth app metadata `workspace_bundle_operator: true` | Required only for invite/grant operator | Existing immutable-Auth operator contract. | Assign to the minimum approved operator through the identity owner; remove it when no longer needed. Do not trust user metadata. |
| Workspace provider OAuth/client origins and callback allowlists | Required shared login | Existing Workspace auth owner; unchanged by RC. | Verify Entry provider, exact Entry origin, Workspace Auth callback, and environment-specific redirect allowlist. Do not add a SOTF callback. |
| Entry `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY` | Required Entry identity/entitlements | Source contract exists. Prior status says production Supabase credentials are missing from the paused Entry deployment. | Provision/approve the dedicated production identity backend, then configure exact credentials without copying them into evidence. |
| Entry `APP_ORIGIN`, `ENTRY_ISSUER`, product URLs | Required Entry routing/handoff | Source contract exists. Prior status records production origins and product URLs, but live verification is pending. | Verify `APP_ORIGIN`/issuer and `PERSONAL_PRODUCT_URL`; verify other enabled product URLs before unpausing. |
| Entry handoff private/public key, key ID, redemption secret | Required Entry handoff | Prior status records environment-specific values in Vercel; current live behavior is not verified. | Confirm keypair agreement, server-only private material, redemption secret, and known rollback deployment. |
| `ENTRY_PERSONAL_OAUTH_CLIENT_ID` and `ENTRY_PERSONAL_OAUTH_REDIRECT_ORIGIN` | Required Entry-to-Workspace OAuth | Source contract exists; prior status says production client ID/backend configuration is missing. | Configure the exact production Personal client and exact Workspace Supabase Auth callback origin. |
| Consulting/Ministry product and OAuth settings | Optional for this SOTF pilot; required only if shown as active destinations | Existing platform contracts. | Validate any destination left enabled; otherwise keep its entitlement absent. Do not make SOTF the platform identity. |
| External connector credentials and provider-release flags | Optional and out of pilot scope | Default-off existing contracts. | Leave off unless separately approved. No live message or calendar send is required. |
| Protected Professional Context | Out of scope/off | No implementation or grant exists in RC. | Keep unavailable until its separately approved security boundary is released. |
| General P2 | Out of scope/off | No RC runtime or migration. | Keep disabled. |

## Intended fellow state

The invited fellow must have all of these conditions at the same time:

1. One canonical Entry identity with an active `PERSONAL` Entry entitlement.
2. One active Personal Workspace owner membership and active plan/core access.
3. One active, unrevoked, unexpired `sotf_transition` entitlement for that exact Workspace and beneficiary.
4. For invite onboarding, one unexpired/unrevoked single-use invite bound to the normalized intended email before claim; the token is stored only as a hash.
5. `SOTF_PILOT_ENABLED=true` in the approved Workspace deployment.

Revoking only the SOTF entitlement removes SOTF navigation, direct-route availability, MCP catalog entries, and mutations while preserving ordinary Workspace membership, plan, and non-SOTF capabilities.

## Deep-link chooser exceptions

| Existing continuation | Classification | Reason and release disposition |
| --- | --- | --- |
| Entry `/login` with no `next` | Canonical path | Defaults to `/workspaces`; every public landing sign-in CTA uses this path. |
| `/login?next=/handoff/personal`, `/handoff/ministry`, or `/handoff/consulting` | Intentional | Resumes an already-selected, allowlisted handoff after canonical sign-in. No query string or fragment is accepted on the handoff target. Preserve. |
| `/login?next=/oauth/consent?authorization_id=…` | Intentional | Resumes an in-progress OAuth authorization after canonical sign-in. Only the single bounded authorization ID parameter is accepted. Preserve. |
| `/login?next=/account` | Intentional | Resumes canonical account administration, not a competing product destination. Preserve. |
| `/login?next=/update-password` plus invite/recovery confirmations | Intentional | Completes password setup/recovery inside the Entry identity owner. Preserve. |
| Direct Workspace `/auth/entry?next=/workspace[/allowed-path]` | Intentional established product-local SSO | An explicit Workspace deep link starts the existing Entry provider and returns to an allowlisted Workspace path after Entry authorization. It is not used by the public landing and does not create another identity. Preserve. |
| Workspace legacy credential fallback on its existing `/login` | Legacy but harmless for this RC | Existing rollback/session-establishment behavior; the RC neither expands nor removes it. Production acceptance must show the public path uses Entry and one credential prompt. |
| External, scheme-relative, backslash, callback-code, unknown handoff, extra OAuth parameter, or fragment continuation | Rejected, not an exception | Existing allowlist sends these to `/workspaces` or fails closed. |

No discovered exception is a source-level blocker for this RC. The live Entry identity/backend configuration gap remains a production blocker.

## Local acceptance map

| Requirement | Local evidence |
| --- | --- |
| Bundle invite claim and entitlement lifecycle | `npm run test:bundle:local` plus bundle pgTAP: founder assignment, email-bound single-use invite, retry safety, ordinary-user denial, invalid claim, revocation, and canonical resolution. |
| Entitled/not-entitled/revoked/expired/wrong-workspace/malformed state | SOTF pgTAP and `tests/sotf-entitlement-gating.test.ts`; all discovery and operation paths fail closed. |
| Native/MCP catalog and continuity | `tests/sotf-channel-continuity.test.ts`: flag-off catalog exclusion, native-to-fresh-MCP resume, MCP-to-native resume, canonical new-conversation recovery, duplicate/replay control, and uncertain-save operation identity. |
| First-fellow golden path | Bundle lifecycle covers step 1; the sequential test in `tests/sotf-workflows.test.ts` covers steps 2–13 and 15; fresh MCP continuity covers step 14. All identities, employers, contacts, meetings, addresses, and provider records are synthetic or stable fixtures. |
| Desktop/mobile product behavior | SOTF preview and connected harness browser tests cover decision change, evidence, scheduling/invitation draft, debrief/follow-up, reload, and interrupted-save recovery. External sends remain manual/simulated. |
| Shared landing/login routing | Separate Entry branch browser suite proves all public CTAs use `/login`, the canonical page has one credential form, and its hidden continuation defaults to `/workspaces`; Entry navigation units prove the allowlist. |

## Production acceptance gate

Run this only after an approved written production gate and configuration preflight. Use a synthetic production acceptance identity first, then the authorized fellow. Record timestamps, immutable deployment IDs, and content-free pass/fail evidence.

1. Open the public Lead Emergence landing in a clean browser and select **Sign In**.
2. Confirm the URL is Entry `/login`, exactly one credential prompt appears, and no SOTF or Workspace credential form competes with it.
3. Sign in once with the synthetic identity and confirm the same identity reaches `/workspaces`.
4. Confirm only active entitled destinations are shown and the chooser remains authoritative.
5. Select Individual Workspace and complete the established handoff/OAuth flow without another credential prompt, callback-owner change, loop, or identity mismatch.
6. Confirm ordinary Workspace loads. Before SOTF grant, confirm SOTF nav, route, MCP tools, and operations are absent/denied while ordinary Workspace remains usable.
7. Issue and claim one synthetic email-bound SOTF invite, confirm the exact entitlement state, then confirm nav, route, native workflow, and SOTF MCP tools appear.
8. Run the synthetic native/MCP continuity and first-fellow path without sending a real message or calendar invite.
9. Revoke the SOTF entitlement. Confirm SOTF disappears/fails closed immediately while ordinary Workspace access persists.
10. Inspect Entry, Workspace, and Auth logs for redirect loops, callback errors, unexpected identity links, 5xx responses, or content-bearing telemetry. Remove the synthetic acceptance identity and records under the approved cleanup procedure.

## Exact production release sequence

1. Record the approved written production gate, exact immutable Workspace and Entry candidates, owners, target identity/database, acceptance identity, and rollback deployments.
2. Record the approved Ministry-repository migration-authority gate after exact target preflight and backup evidence.
3. Apply `20260902162536_bundle_entitlement_foundation.sql` through that authority and verify its catalog, grants, RLS, and absence of PC mapping.
4. Apply `20260906120000_sotf_operational_workflows.sql` through that authority and verify event persistence plus SOTF discovery/operation guards.
5. Validate every required environment/configuration item above while leaving external connectors, protected PC, and General P2 off.
6. Deploy the immutable Workspace RC with `SOTF_PILOT_ENABLED=true`; do not issue fellow access yet.
7. Run synthetic and then authorized live shared-login → chooser → Workspace, MCP, revocation, and first-fellow acceptance; stop on any identity/session/chooser/callback discrepancy.
8. Issue the email-bound pilot invite/entitlement only after acceptance passes.

Deploy the separate Entry landing candidate only after Workspace acceptance. Before Entry deploy, verify the production identity backend/config, shared login, chooser, each enabled handoff, exact callback allowlists, clean deployed-preview/physical-phone performance, and a known trusted Entry rollback target.

## Exact rollback sequence

1. Set `SOTF_PILOT_ENABLED=false` and promote that configuration.
2. Revoke SOTF pilot entitlements and any unclaimed invites through the bounded operator controls.
3. Restore/promote the prior immutable Workspace deployment.
4. Restore/promote the prior trusted Entry deployment, or pause Entry if no trusted production target exists.
5. Leave additive database structures and retained data locked in place.
6. Correct any schema defect only with a separately reviewed forward migration.
7. Never use a destructive down-migration merely to roll back the application release.

## Production blockers

- Written production deployment, hosted migration, live entitlement, and real invite authorization have not been granted.
- Production Entry remains paused/not ready until a dedicated identity backend and exact Supabase/OAuth client configuration are approved and verified.
- A clean deployed-preview and physical-phone performance check is still required; current landing measurements are synthetic local evidence.
- The live one-sign-in → chooser → Workspace handoff and real ChatGPT/Claude client acceptance require approved production configuration and an authorized acceptance identity. They are release-sequence gates, not local source defects.

## Merge recommendation

- Workspace `release/sotf-pilot-rc`: suitable for review as the only SOTF pilot release unit after all recorded local gates pass. Do not merge the historical `astra/sotf-indispensable` branch.
- Entry `astra/lead-emergence-front-door`: suitable for review as a separate landing candidate after its final local gates pass. Merge/deploy it only after Workspace acceptance and Entry production identity readiness.
