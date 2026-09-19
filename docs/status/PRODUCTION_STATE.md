# Lead Emergence Production State

**Canonical cached summary of current production state. Live production wins whenever it disagrees with this file.**

This file contains observables and explicitly labeled unknowns only. Diagnosis, opinions, risk analysis, and proposed work belong in session output, `docs/BACKLOG.md`, or `docs/DECISIONS.md`.

## Current management status — 2026-09-19

- **Phase 1:** `ACCEPTED`.
- **Accepted production observable:** ChatGPT → Developer Mode Lewis → Workspace MCP → `get_onboarding_state` returned a real Workspace result: `state=workspace_ready`, `setup_method=native`, `completed_areas=[]`, `next_useful_area=responsibilities`, `selected_assistant=chatgpt`, and `onboarding_complete=true`.
- **Phase 2.1 Account provisioning:** `ACCEPTED / CLOSED`.
- **Phase 2 current step:** `2.2 Billing & entitlement` (`CURRENT / NEXT`; not started).
- **Phase 2.1 accepted production observable:** a clean non-Andrew production identity completed signup, Entry verification, automatic PERSONAL access, Workspace OAuth handoff, Personal Workspace ownership, and reached the functional first-use onboarding screen with no manual operator provisioning.

## Evidence hygiene

Do not record tokens, authorization codes, PKCE material, cookies, passwords, API keys, customer payloads, or unnecessary PII here. Use sanitized IDs, timestamps, row counts, SHAs, and non-secret configuration only.

---

## 1. Database / Auth state

- **Verified at:** 2026-09-17T20:16:14Z (2026-09-17 15:16:14 CDT)
- **Source:** Supabase Dashboard project `cirqqhuvzekbvysiyedg` (healthy Production project), read-only SQL Editor refresh, and Auth Hooks control plane

### Recent migrations applied

| Version | Name | Observable note |
|---|---|---|
| 20260917004047 | oauth_completion_authority | Applied 2026-09-17 00:40 UTC |
| 20260916014819 | oauth_preconsent_routing_only | NULL-user pre-consent routing allowance is live |
| 20260915100000 | oauth_consent_continuation_authority | Consent classifier/continuation authority |
| 20260914010000 | sotf_v1_temporal_authority_consolidation | Last SOTF migration before OAuth work |

### Live resolver body — relevant predicate

`workspace.resolve_oauth_consent_product(text)` currently permits:

```sql
user_id = auth.uid()
OR (user_id IS NULL AND status = 'pending')
```

The function returns `deny` when the caller has no authenticated `auth.uid()`.

The function also contains an exception handler that returns `deny` for caught exceptions. This statement is recorded here only as source behavior; diagnostic implications belong elsewhere.

### Completion function

`workspace.complete_mcp_oauth_authorization(text)` exists.

Observed properties:

- SECURITY DEFINER;
- owner: `workspace_oauth_completion_owner`;
- EXECUTE granted to `authenticated`;
- calls the current resolver, Workspace grant activation, and product binding activation in sequence;
- raises when required completion work fails.

### Current row counts

| Object | Current count | Verified at |
|---|---:|---|
| `workspace_private.mcp_oauth_resource_grants` | 0 | 2026-09-17 audit |
| `private.oauth_product_client_bindings` | 0 | 2026-09-17 audit |
| `private.oauth_product_binding_audit` | 0 | 2026-09-17 audit |
| `workspace_private.mcp_oauth_admission_audit` | 1 | 2026-09-17 audit |
| `private.oauth_product_contracts` | 4 | 2026-09-17 audit |

### Feature/control state

- `workspace_private.mcp_dynamic_admission_enabled()` = `true`
  - changed at 2026-09-17 01:53:29 UTC
- `private.oauth_product_binding_control.enabled` = `true`

### Account provisioning observation — 2026-09-18T16:32:07Z

- **Source:** Supabase Dashboard project `cirqqhuvzekbvysiyedg` → SQL Editor, aggregate-only read-only queries; live Workspace login screen at `https://workspace.leademergence.com/login`.
- The production login screen exposes the normal entry path `Continue with Lead Emergence` → `/auth/entry?next=/workspace`.
- Aggregate query result: `13` non-Andrew Auth users; `2` non-Andrew Personal Workspaces have a matching active `owner` membership and owner-bound default plan; `1` of those has an owner-bound onboarding row in `setup_method_required`.
- The queries did not expose emails, user IDs beyond the pre-existing Andrew exclusion, or customer payloads. They establish present-row shape only, not that any particular account traversed the normal signup path without operator intervention.
- No explicitly approved non-Andrew test identity was available in the task context. No account was created, modified, or signed into during this observation.

### Entry signup error-recovery observation — 2026-09-18T19:23:36Z

- **Source:** authenticated Supabase CLI project listing and read-only GitHub source retrieval for `abostwick12/lead-emergence-entry` `app/signup/actions.ts`; the live Entry project `neabiaimygdviwobpicj` is listed as `ACTIVE_HEALTHY`.
- The retrieved action redirects a returned `supabase.auth.signUp()` error to the generic customer-visible `unable_to_create` state and contains no error logging. The retrieved repository path is source evidence only; its deployed SHA was not resolved in this observation.
- The documented read-only Supabase Management API log request could not be made from this host because no local CLI access-token file is available to authenticate that endpoint; the browser-control surface also failed before it could read the dashboard Logs Explorer. Entry runtime logs and Supabase Auth logs for `2026-09-18T18:14:35Z`–`18:15:00Z` therefore remain unobserved.
- No underlying Auth/runtime error, status, emitter, email-delivery outcome, or Auth-hook outcome is verified. No production mutation, signup retry, user action, configuration action, or repair was performed.

### Entry confirmation-path observation — 2026-09-18T19:52:57Z

- **Source:** authenticated Supabase CLI project/key metadata, a read-only public Auth settings request, a non-following public GET of `https://entry.leademergence.com/auth/callback`, retrieved Entry callback source, and current Supabase Auth documentation.
- The live public Auth settings response reports `disable_signup=false` and `mailer_autoconfirm=false`; it does not expose the confirmation template, Site URL, or redirect allow-list, so absence from that response is not configuration evidence. The documented management configuration endpoint requires a Management API token that is unavailable on this host.
- The public no-code callback request returned a `307` to `https://entry.leademergence.com/login?error=invalid_callback`, verifying the deployed callback's effective origin is `https://entry.leademergence.com`. The retrieved repository callback source expects `code` and exchanges it with `exchangeCodeForSession`; its deployed SHA remains unverified.
- Supabase documents `ConfirmationURL` as an Auth `/verify` URL carrying `token`, `type`, and `redirect_to`; after successful PKCE verification, the redirect to the application carries `code`. Thus the standard configured flow is compatible with the retrieved callback contract. No live template, redirect allow-list, click request, PKCE cookie state, or retained confirmation-attempt log was observable, so no format/configuration mismatch or underlying Auth error is verified.
- No production mutation, confirmation-link click, signup/login retry, user action, configuration action, or repair was performed.

### Entry signup diagnostic deployment — 2026-09-18T20:35:20Z

- **Source:** Entry repository checkout `abostwick12/lead-emergence-entry`, Vercel project `lead-emergence-entry` (`prj_Sjv0ZfqFzf7dOOime4bEWZukmaCD`), deployment inspection, build logs, and non-mutating HTTP health checks.
- Existing production/runtime/Auth evidence did not expose the exact `supabase.auth.signUp()` error. `app/signup/actions.ts` now logs only the returned error's `name`, `code`, `status`, and `message` to server runtime logs before preserving the existing generic `unable_to_create` customer redirect. It does not log email, password, confirmation material, or tokens.
- File-scoped ESLint, repository TypeScript checking, and a local production build passed. Vercel deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF` completed `READY`; its project production alias serves `/signup` with HTTP `200`.
- Vercel promotion completed at `2026-09-18T20:37:48Z`. `https://entry.leademergence.com` now resolves to deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF`; its `/signup` route returned HTTP `200`. A bounded deployment-specific error-level log scan over the preceding 20 minutes returned no records.
- No signup, login, email resend, user mutation, Auth configuration change, database change, or Workspace action was performed.

### Entry approved manual-signup diagnostic observation — 2026-09-18T21:30:33Z

- **Source:** Vercel production inspection and deployment-specific error-log query for `lead-emergence-entry`; PM report of one authorized manual submission using the approved fresh test identity.
- `entry.leademergence.com` remained promoted to `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF`, status `READY`. The PM reported that the manual submission navigated to the landing page. The deployed success branch instead redirects a non-error `signUp()` result to `/login?message=check_email`; the exact browser URL and page contents were not captured, so this report alone does not establish the outcome.
- A deployment-specific Vercel error-level query covering the preceding 15 minutes returned `No logs found`. Therefore no emitted `Entry signup request rejected` record—and no Auth error name, code, status, or message—was recovered for the submission window.
- The supported Supabase Auth admin listing is paginated only and has no email filter. A lookup through it would read unrelated users, so it was not used. The post-submission Auth user, identity, and confirmation state for the approved identity remain unobserved through an authorized single-identity read path.
- No browser automation, signup submission, Auth/database/configuration mutation, email action, Workspace action, or repair was performed by the agent.

### Entry automatic PERSONAL entitlement repair preflight — 2026-09-18T22:43:38Z

- **Source:** live Supabase SQL against Entry project `neabiaimygdviwobpicj`; Vercel production deployment and environment-variable metadata; current Entry source at local HEAD `74c8e595d231a8d99c5bc93de8eba74134a4aa9b` plus the pre-existing signup diagnostic working-tree change.
- Phase 2.1 remains current. PM authorized one bounded repair to grant a newly verified Entry customer the minimum `PERSONAL` / `ACTIVE` entitlement automatically through the normal authenticated customer path.
- Production `public.get_my_active_entry_products()` remains an authenticated self-only read of `ACTIVE` rows for `auth.uid()`. Production `public.set_entry_product_entitlement(...)` remains the existing audited, idempotent command; it is executable by `service_role`, not by `authenticated` or `anon`, and rejects callers whose database `current_user` is not `service_role` or `postgres`.
- Entry production still serves READY deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF`. Its configured production environment-variable list does **not** contain `SUPABASE_SECRET_KEY`. The existing server-only helper pattern in `lib/handoff/redemption.ts` expects that variable, but the deployed application currently has no configured trusted Supabase credential with authority to invoke `set_entry_product_entitlement(...)`.
- This disproves the required precondition that trusted server-side write authority is already available at the selected authenticated Entry integration point. Supplying the production Supabase secret to Entry would be an additional sensitive production-configuration mutation and privilege-bearing capability beyond the explicitly authorized code change and Entry deployment.
- Implementation stopped before changing Entry source, tests, production configuration, deployment, user entitlements, or database state. No manual grant was made, and the next clean acceptance identity was not used.

### Entry trusted-authority configuration and entitlement-contract stop — 2026-09-19T01:06:34Z

- **Source:** authenticated Supabase CLI key metadata and secure in-memory key transfer; Vercel production environment metadata; live Entry Data API response; current Entry migrations/source.
- PM approved configuring the existing Entry production Supabase secret for the Entry Vercel project. The existing modern secret for project `neabiaimygdviwobpicj` was transferred directly from authenticated Supabase tooling to Vercel through process memory/stdin. Its value was not printed, written to source or documentation, persisted to a local file, rotated, or regenerated.
- Vercel now lists `SUPABASE_SECRET_KEY` as a hidden `Secret` scoped only to `Production` for `emergence-projects/lead-emergence-entry`.
- The proposed explicit integration point was the server-rendered OAuth consent route after `requireOAuthEntryUser()` and trusted request classification resolve an actual `PERSONAL` request, immediately before the existing `canAuthorizeProduct()` read decision. `canAuthorizeProduct()` would remain read-only.
- A focused local prototype and four tests proved the intended behavior in isolation, but the live runtime-contract check failed: the Entry Data API rejects the `entry_identity` schema as invalid. This matches the migration contract that intentionally keeps `entry_identity` out of the Data API allow-list.
- No existing public/service RPC exposes whether a specific canonical user has no PERSONAL row versus a `PENDING`, `SUSPENDED`, or `REVOKED` PERSONAL row. `get_my_active_entry_products()` exposes only ACTIVE rows, while `set_entry_product_entitlement(...)` upserts and would reactivate a non-ACTIVE row. Therefore the approved code-only repair cannot satisfy the explicit requirement to preserve existing non-ACTIVE state.
- The prototype code/test were removed. Entry was not redeployed, no database object or permission changed, no entitlement was mutated, and the clean acceptance identity was not used. Production remains on `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF` pending separate approval for a narrowly scoped database-contract change.

### Entry Phase 2.1 automatic PERSONAL provisioning and circular-handoff repair — 2026-09-19T16:12:12Z

- **Source:** PM clean-acceptance report; Entry source and focused validation; Vercel deployment build, promotion, inspection, public HTTP health checks, and bounded error-log scan.
- The separately approved service-only entitlement-status RPC is live, and the Entry server-only provisioning helper uses it to distinguish an absent PERSONAL entitlement from ACTIVE and non-ACTIVE state before invoking the existing entitlement setter. The helper fixes product `PERSONAL`, status `ACTIVE`, and source `phase_2_1_prebilling_automatic_personal` server-side and uses only the canonical user ID returned by server-side Auth.
- The first clean acceptance exposed a circular gate: a confirmed Entry user with no entitlement saw no PERSONAL action in `/workspaces`, while `/handoff/personal` checked active entitlement before the automatic provisioning helper could run in the later OAuth consent flow.
- The repaired empty `/workspaces` state now exposes the normal `/handoff/personal` action without granting on page view. The authenticated PERSONAL handoff obtains the user through `auth.getUser()`, invokes the existing automatic provisioning helper, and only then performs the existing active-entitlement authorization check. CONSULTING remains unchanged and never invokes the helper.
- Focused unit validation passed `15/15`; repository TypeScript checking, full lint, local production build, Vercel production build, and a browser-static scan for the secret-key name, privileged entitlement RPC names, and provisioning source marker all passed. Local pgTAP remained `BLOCKED BY UNAVAILABLE LOCAL POSTGRESQL — NOT RETRIED` under the approved validation boundary.
- Entry-only deployment `dpl_3i1bV87wV1ECGcwhWuZTcDDBCgLh` is `READY` and promoted to `entry.leademergence.com`. The production home and `/signup` returned HTTP `200`; the bounded deployment-specific error-level log scan returned no records.
- No signup, OAuth handoff, manual entitlement mutation, Workspace action, schema change, permission change, or clean acceptance test was performed by the agent. Phase 2.1 remains current pending the PM-run clean acceptance test; Phase 2.2 has not begun.

### Phase 2.1 clean production acceptance — 2026-09-19T16:34:33Z

- **VERIFIED — acceptance identity:** `andrew+entrytest3@leademergence.com` was unused before the PM-run production journey.
- **VERIFIED — PM manual customer journey:** fresh Entry signup → email verification → Entry sign-in → `/workspaces` → `Open Workspace` → PERSONAL handoff → Workspace → first-use onboarding screen. No browser automation, manual entitlement grant, manual Workspace record, or operator provisioning was used.
- **VERIFIED — current exact-identity read-only API confirmation:** Entry Auth user exists and has a confirmed email; its PERSONAL entitlement is `ACTIVE`; the matching Workspace Auth user exists. The status RPC does not expose the entitlement source, and the private entitlement schema remains unavailable through the Data API, so no fresh row-level source read was performed. The deployed automatic path recorded above fixes its source to `phase_2_1_prebilling_automatic_personal`.
- **VERIFIED — PM direct Workspace production observation:** the Workspace user owns one Personal Workspace (`workspace_type=personal`) with an active `owner` membership. Its onboarding record is `mcp_connection_required`, `setup_method=ai`, and `selected_assistant=chatgpt`; it has `0` connected MCP authorizations.
- The absent MCP authorization is not a Phase 2.1 blocker: connection lifecycle remains later Phase 2 work. The functional first-use onboarding screen supplied the customer-facing ChatGPT connection instructions and Workspace MCP endpoint.
- The relevant Entry repair remains deployment `dpl_3i1bV87wV1ECGcwhWuZTcDDBCgLh`, built from commit `96fdd06f5639726948855f9dad4b612a6d9ded70` and promoted to `entry.leademergence.com`.
- **Phase 2.1 is ACCEPTED / CLOSED.** No production mutation, deployment, or product-code change occurred during this closure pass.

---

## 2. Lewis / ChatGPT OAuth state

- **Verified at:** 2026-09-17T20:16:14Z (2026-09-17 15:16:14 CDT)
- **Source:** Supabase Dashboard SQL Editor read-only queries against project `cirqqhuvzekbvysiyedg`; Auth authorizations and sessions

### Current canonical replacement OAuth client

- OAuth client UUID: `8908229b-df10-4842-86b2-0b2f9f76ab3a`
- Resource: `https://workspace.leademergence.com/api/mcp`
- Created: 2026-09-15 17:52 UTC
- Redirect: ChatGPT connector callback registered for this client

### Authorization history observed

- 12 authorization rows existed at audit time.
- Rows through 2026-09-16 12:32 were pending with `user_id IS NULL`.
- One row at 2026-09-16 16:43 had an assigned user and expired.
- Two rows at 2026-09-16 17:05 and 17:15 were approved and had authorization codes issued.
- OAuth sessions for this client: `0` at audit time.
- Latest observed attempt: 2026-09-16 17:15 UTC.
- Current authorization count for this client: `12`.
- No authorization occurred after `oauth_completion_authority` became live at 2026-09-17 00:40:47 UTC (`0` rows), or after dynamic admission was enabled at 2026-09-17 01:53:29.302495 UTC (`0` rows).
- **Retry since latest relevant production changes:** `NO`. The latest real Lewis authorization attempt remains 2026-09-16 17:15:31.038139 UTC; no current canonical-client session exists.

### Phase 1 post-connection verification

- **Verified at:** 2026-09-17T21:26:12Z (2026-09-17 16:26:12 CDT)
- The latest canonical-client authorization is `approved`, assigned to a user, for the exact Workspace MCP resource, created at `2026-09-17T21:18:24.812766Z`, expiring at `2026-09-17T21:28:24.812766Z`.
- `workspace_private.mcp_oauth_resource_grants`: `1` row, `active`, exact resource, four granted scopes.
- `private.oauth_product_client_bindings`: `1` row, `ACTIVE`, product `workspace`, exact resource and audience.
- `private.oauth_product_binding_audit`: one `bound` event at `2026-09-17T21:17:23.236448Z`.
- `auth.sessions`: `1` session for the canonical client, created at `2026-09-17T21:17:24.637348Z` and updated at `2026-09-17T21:17:28.462564Z`.
- **First failing boundary:** `workspace.mcp_authorizations` has `0` rows for the canonical client with `status = 'connected'` (and no rows at all for that client). The Workspace Settings UI consequently reports `No AI assistant connected`.
- The canonical Lewis app details page does not show a connected state; it presents `Try in chat` and the chat opens with Lewis selected. No `Connect` action was initiated in this verification.
- No Lewis status/tool call or SOTF retrieval was performed because the first verified production boundary failed before those gates.

### Phase 1 assumption-challenge refresh

- **Verified at:** 2026-09-17T22:00:23Z (2026-09-17 17:00:23 CDT)
- **Deployed Workspace source:** production SHA `624792468d712fb6285c9fab7172a146c205a1c3`; `app/api/mcp/route.ts` authenticates the bearer, then calls `workspace.mcp_register_connection()` before constructing the MCP server.
- **Live admission predicate:** `workspace_private.is_valid_mcp_request()` requires authenticated `auth.uid()`, dynamic admission enabled, nonempty JWT `client_id`, `workspace_mcp = true`, JWT `aud` equal to the configured MCP resource, and an active matching `workspace_private.mcp_oauth_resource_grants` row. It does not query `workspace.mcp_authorizations`.
- **Registration boundary:** live `workspace.mcp_register_connection()` calls that predicate, checks the Personal owner/membership and `core_workspace`/`workspace_mcp` capabilities, rejects disabled/disconnected/stale-token states, then upserts `workspace.mcp_authorizations` as `connected`.
- **Falsifier attempt:** no Lewis MCP request was submitted. The authenticated Chrome tab/control surface was unavailable while preserving the one-call limit; the live admission audit has no events since `2026-09-17T21:26:00Z`, and the canonical projection remains `0` rows. This is an execution-harness limitation, not evidence of an upstream connector failure or a Workspace rejection.

### Phase 1 token-claims assumption challenge

- **Verified at:** 2026-09-17T22:19:27Z (2026-09-17 17:19:27 CDT)
- **Claim tested:** the current Lewis access token lacks one or more claims required by Workspace MCP admission.
- **Cheapest read-only checks:** the live `auth.sessions` schema contains session metadata only (`oauth_client_id`, timestamps, refresh/session fields, and scopes), not decoded JWT claims. The canonical session row remains present for client `8908229b-df10-4842-86b2-0b2f9f76ab3a`, with `not_after = NULL`, and no token material was selected or exposed.
- **Authenticated browser surface:** the existing ChatGPT Lewis chat is visible and selected, but it exposes no bearer token or sanitized token-claim view. No message or Lewis connector request was sent.
- **Sanitized claim result:** `sub` unknown; `client_id` unknown; `workspace_mcp` unknown; `aud` unknown; `exp`/`iat` not inspected. Therefore the requested falsifier was not observable without connector execution.
- **Classification:** `TOKEN CLAIMS UNVERIFIABLE WITHOUT CONNECTOR EXECUTION`. No mutation, reconnect, token mint, hook registration, deployment, or broad test was performed.

### Phase 1 Lewis empty-action-surface diagnostic

- **Verified at:** 2026-09-17T23:30:46Z (2026-09-17 18:30:46 CDT)
- A no-bearer JSON-RPC `tools/list` POST to `https://workspace.leademergence.com/api/mcp`, with `Origin: https://chatgpt.com` and MCP protocol version `2025-11-25`, returned a valid result containing `34` tools. The result includes `list_assistant_connections`.
- At deployed Workspace SHA `624792468d712fb6285c9fab7172a146c205a1c3`, `app/api/mcp/route.ts` routes unauthenticated `initialize`, `notifications/initialized`, `ping`, and `tools/list` to `handleMcpDiscoveryRequest`; that handler constructs the server without a database client and no tool handler runs. `lib/workspace/mcp-server.ts` registers `list_assistant_connections` unconditionally before optional SOTF registration.
- The current selected Lewis app's ChatGPT management surface reports OAuth authorization in use, an Andrew Lewis connected account, and endpoint `https://workspace.leademergence.com/api/mcp`; its Actions surface remains empty. The UI supplied no tool-catalog error or request/correlation ID.
- No Lewis operation was invoked, and no OAuth, token, connection, configuration, deployment, or production state was changed.

### Phase 1 Lewis discovery-canary stopping boundary

- **Verified at:** 2026-09-17T23:44:37Z (2026-09-17 18:44:37 CDT)
- ChatGPT's New Plugin form accepted `Lewis Discovery Canary`, the exact Workspace MCP endpoint, OAuth, and its automatically discovered OAuth metadata. The visible selected registration method was Dynamic Client Registration; no client identifier was entered or copied.
- Selecting `Create` navigated directly to the Workspace `Allow access to Workspace?` OAuth-consent screen before ChatGPT displayed a canary Actions surface. No consent-control action was taken: neither `Allow access` nor `Cancel` was selected.
- Consequently, canary action count, `list_assistant_connections` presence, catalog error, and correlation ID are not observable before OAuth consent in this UI flow. The existing Lewis app was not modified, disconnected, or reauthorized.

### Bounded production recovery refresh — 2026-09-18T01:09Z

- Sources: Supabase MCP read-only SQL scoped to existing Lewis client `8908229b-df10-4842-86b2-0b2f9f76ab3a`; authenticated Supabase production Auth Hooks page; `pg_get_functiondef` for the existing admission, registration, and token-hook functions.
- Existing client redirect: `https://chatgpt.com/connector/oauth/itauo59B5DNT`. Its existing session belongs to user `6f2f63f4-9ce2-4cda-85fe-4d808e3e11a0`.
- That user has one Personal Workspace: `0ba1358c-22ce-4c6b-b74a-d1ed0ac8470b`. The client's resource grant remains active and its product binding remains ACTIVE for `workspace`, with resource and audience `https://workspace.leademergence.com/api/mcp` and the same binding user.
- Live `workspace_private.is_valid_mcp_request()` requires `workspace_mcp=true`, exact resource audience, authenticated user, client ID, enabled admission, and matching active grant. Live `workspace.mcp_register_connection()` additionally resolves an owned Personal Workspace through active owner membership and capability checks.
- Production Auth Hooks page still shows an empty Hooks list. Existing `private.custom_access_token_hook(event jsonb)` resolves the product binding and sets the bound audience/resource and `workspace_mcp=true` for Workspace. The separate `workspace_private.custom_access_token_hook` also exists; neither is registered. No hook configuration was changed.
- No bearer claims were inspected and no real Lewis call was made. The missing hook is verified configuration evidence, not a captured Lewis request rejection or proof of the sole end-to-end failure.
- Current deployment was not reverified: Vercel connector returned deployment-not-found for the domain and forbidden for deployment listing. Previously recorded SHA remains historical evidence for this refresh. A direct metadata GET was blocked by local socket permissions.
- Recovery stopped at the shared Auth issuer hook-configuration dependency, outside the bounded Workspace repository/deployment action. No production mutation, deployment, consent, reconnect, canary attempt, or new client occurred.

### Phase 1 single real Lewis validation attempt — 2026-09-18T02:26:45Z

- **Scope:** exactly one read-only ChatGPT Work request with the existing installed `Lewis` plugin selected. The request instructed Lewis to call `list_assistant_connections` exactly once and prohibited any other tool, reconnect, authorization, refresh, or retry.
- **ChatGPT result:** `Tool unavailable in this session; list_assistant_connections was not invoked.` Conversation: `6aaca0fb-de08-83ea-8eae-0961fb07bf72`.
- **First verified failure boundary:** ChatGPT session tool availability/action exposure, before request dispatch to `https://workspace.leademergence.com/api/mcp`.
- **Production confirmation after the attempt:** the canonical client still has one active Workspace resource grant, one active Workspace product binding, and one Auth session. `workspace.mcp_authorizations` remains at zero connected rows for the client; the latest admission-audit timestamp remains `2026-09-17T21:17:23.236448Z`; the session's latest update remains `2026-09-17T21:17:28.462564Z`.
- **Request/correlation ID:** none was exposed. The ChatGPT conversation ID is not an application request ID.
- **Outcome at that time:** Phase 1 was open pending a supported tool result. This historical snapshot was superseded by the successful Developer Mode validation recorded in the newest change-log entry below; the current Phase 1 status is `ACCEPTED`. No retry, reconnect, token issuance/refresh, OAuth change, Auth-hook change, code change, migration, or other production mutation was performed.

### Other OAuth clients — do not mutate during Lewis diagnosis without explicit reason

- ChatGPT legacy client `f8c7a89d-bd3d-4395-97f0-0f9ac690f7a7`: live session observed during audit.
- Codex client `6a523311-60bb-475c-92e7-2e063820d732`: live session observed refreshing successfully during audit.

---

## 3. Application deployment state

### Ministry / www

- **Verified at:** 2026-09-17T20:16:14Z (2026-09-17 15:16:14 CDT)
- **Source:** Vercel project `emergence-ministry-platform` Production deployment details; repository source at the deployment’s displayed commit
- **Current deployment:** READY, current for `www.leademergence.com`, deployment `dpl_xCXyykmeAdatBynapfFZDbFwCE7X`
- **Deployed source SHA:** `33421427c1e33f254ac745d60391f453a1352119`
- **Deployment created:** 2026-09-15 21:27:36 UTC (2026-09-15 16:27:36 CDT)

### Workspace

- **Verified at:** 2026-09-17T20:16:14Z (2026-09-17 15:16:14 CDT)
- **Source:** Vercel project `lead-emergence-workspace` Production deployment details plus the immutable repository checkout for the Vercel-reported deployment branch
- **Current deployment:** READY, current for `workspace.leademergence.com`, deployment `dpl_5ygudAwGDmCcReWr79xh9Axxo2LB`
- **Deployed source SHA:** `624792468d712fb6285c9fab7172a146c205a1c3`
- **Deployment created:** 2026-09-15 19:21:31 UTC (2026-09-15 14:21:31 CDT)
- **Source note:** Vercel identifies this as a `vercel deploy` from branch `codex/sotf-v1-oauth-continuation-hotfix` and does not render a commit hash in the deployment detail. The matching immutable checkout has that branch at exactly `624792468d712fb6285c9fab7172a146c205a1c3`; no later commit is on that branch.

Do not infer current route behavior from a local branch. Resolve deployed SHA first, then inspect repository source at that SHA.

---

## 4. Auth hook state

- **Verified at:** 2026-09-18T01:35:38Z (2026-09-17 20:35:38 CDT)
- **Source:** Supabase Dashboard project `cirqqhuvzekbvysiyedg` → Authentication → Auth Hooks; scoped read-only SQL permission and Lewis-state checks; current Supabase Auth Hooks documentation.
- **Pre-change remote state:** no registered Auth hooks.
- **Registered custom access-token hook:** `ENABLED`, type `Postgres function`, schema `private`, function `custom_access_token_hook`.
- **Exact registered URI:** `pg-functions://postgres/private/custom_access_token_hook`. The Dashboard's persisted type/schema/function fields map to this URI using Supabase's documented `pg-functions://postgres/<schema>/<function_name>` format.
- **Permission check before and after registration:** `supabase_auth_admin` retained `EXECUTE` on the function and `USAGE` on schema `private`; `authenticated`, `anon`, and `public` retained no function `EXECUTE`. The Dashboard's grant/revoke statements were idempotent against the existing permissions.
- **Unrelated-state check:** the existing Lewis redirect URI, one Lewis Auth session, one active Workspace resource grant, and one active Workspace product binding remained present after registration. No OAuth client, session, grant, binding, tenant row, function body, RLS policy, or deployment was changed by this recovery.
- **Exact rollback:** Supabase Dashboard → Authentication → Auth Hooks → actions for `Customize Access Token (JWT) Claims hook` → `Delete hook`. This returns the remote hook state to no registration while leaving `private.custom_access_token_hook` and its existing permissions intact. Configuration equivalent: disable `auth.hook.custom_access_token` and remove its URI.
- **Deferred:** `P1 — Review and remove SECURITY DEFINER from private.custom_access_token_hook if explicit least-privilege execution can replace it safely.` This remains in `docs/BACKLOG.md` until resolved or formally dispositioned.
- **Other existing function:** `workspace_private.custom_access_token_hook(event jsonb)` remains unregistered and unchanged.
- **Local configuration note:** `supabase/config.toml` points at `workspace_private.custom_access_token_hook`, but local configuration is not production registration evidence.

Do not infer the active hook from function existence or local configuration.

---

## 5. Deployed consent-route state

- **Verified at:** 2026-09-17T20:16:14Z (2026-09-17 15:16:14 CDT)
- **Source:** current Vercel Workspace deployment `dpl_5ygudAwGDmCcReWr79xh9Axxo2LB` and source at SHA `624792468d712fb6285c9fab7172a146c205a1c3`
- **Verified behavior:** `app/oauth/consent/page.tsx:64-72` approves with `skipBrowserRedirect: true`, then calls `completeWorkspaceOAuthConsent(supabase, details.authorization_id)` at line 65, and only then calls `window.location.assign(result.data.redirect_url)` at line 72.
- **RPC target:** `lib/workspace/oauth-consent.ts:13-20` invokes Supabase RPC `complete_mcp_oauth_authorization` with `p_authorization_id`, which is the live `workspace.complete_mcp_oauth_authorization(text)` function confirmed by the SQL refresh.
- **Answer:** `YES` — the deployed Workspace consent route calls the completion function after approval and before returning to ChatGPT.

---

## 6. Refresh procedure

Run the relevant checks before live-state diagnosis. Add/adjust targeted queries as the architecture evolves, but keep this section read-only.

```sql
-- 6.1 Applied migrations
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 15;

-- 6.2 Current consent resolver definition
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'workspace'
  and p.proname = 'resolve_oauth_consent_product';

-- 6.3 Current completion function definition
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'workspace'
  and p.proname = 'complete_mcp_oauth_authorization';

-- 6.4 Completion observables
select
  (select count(*) from workspace_private.mcp_oauth_resource_grants) as grants,
  (select count(*) from private.oauth_product_client_bindings) as bindings,
  (select count(*) from private.oauth_product_binding_audit) as binding_events;

-- 6.5 Current admission/binding controls
select
  workspace_private.mcp_dynamic_admission_enabled() as admission_enabled,
  (select enabled from private.oauth_product_binding_control where singleton) as binding_enabled;

-- 6.6 Recent OAuth attempts and resulting sessions
select
  a.created_at,
  a.status::text,
  (a.user_id is null) as unassigned,
  a.resource,
  c.client_name,
  c.id as oauth_client_id,
  (select count(*) from auth.sessions s where s.oauth_client_id = c.id) as sessions
from auth.oauth_authorizations a
join auth.oauth_clients c on c.id = a.client_id
order by a.created_at desc
limit 10;

-- 6.7 Admission/grant audit trail
select event_type, reason_code, created_at
from workspace_private.mcp_oauth_admission_audit
order by created_at desc
limit 10;
```

Also verify when relevant:

- active GoTrue Auth hook registration;
- current Ministry production deployment SHA;
- current Workspace production deployment SHA;
- current ChatGPT canonical Lewis connection state;
- whether a fresh attempt has occurred since the last relevant hosted change.

---

## 7. Change log

Newest first.

| Date | Production observation/change | Source |
|---|---|---|
| 2026-09-19T16:34:33Z | Phase 2.1 accepted and closed: the clean non-Andrew identity `andrew+entrytest3@leademergence.com` completed normal signup, email verification, automatic PERSONAL access, Workspace handoff, and the functional first-use onboarding screen with no manual entitlement or operator provisioning. Current exact-identity reads confirm confirmed Entry Auth, ACTIVE PERSONAL entitlement, and Workspace Auth identity. PM direct Workspace inspection confirms a Personal Workspace, active owner membership, and `mcp_connection_required` AI/ChatGPT onboarding; zero connected MCP authorizations is deferred connection-lifecycle work, not an account-provisioning failure. | PM manual acceptance and direct Workspace production observation; current exact-identity read-only Entry/Workspace Auth and Entry entitlement-status API checks; prior Entry repair deployment evidence |
| 2026-09-19T16:12:12Z | Phase 2.1 circular-handoff repair: the zero-entitlement `/workspaces` state now exposes `/handoff/personal`, and the authenticated PERSONAL handoff invokes the existing automatic provisioning helper before the active-entitlement gate; CONSULTING remains isolated. Focused tests passed `15/15`, TypeScript/lint/build/static-client gates passed, and Entry-only deployment `dpl_3i1bV87wV1ECGcwhWuZTcDDBCgLh` is READY and promoted. Production `/` and `/signup` returned HTTP 200 and a bounded error-log scan found no records. No clean signup, handoff, entitlement mutation, Workspace action, schema/permission change, or Phase 2.2 work occurred. | PM clean-acceptance report; Entry source and narrow gates; Vercel deployment/build/promotion inspection, public health checks, and bounded logs |
| 2026-09-19T01:06:34Z | Phase 2.1 trusted authority configured: the existing Entry modern Supabase secret was transferred securely into Vercel as production-only hidden `SUPABASE_SECRET_KEY`; its value was not exposed or persisted locally. The next runtime check proved `entry_identity` is intentionally unavailable through the Data API, and no existing RPC distinguishes an absent PERSONAL row from a non-ACTIVE row. Because the existing setter upserts, the approved code-only repair could silently reactivate revoked/suspended access. Prototype code was removed; no deployment, database change, entitlement mutation, or clean acceptance test occurred. | authenticated Supabase CLI and Vercel environment metadata; live Entry Data API response; current migrations/source |
| 2026-09-18T22:43:38Z | Phase 2.1 automatic PERSONAL entitlement repair preflight: live SQL confirmed the existing setter is audited/idempotent but restricted to `service_role`/`postgres`; authenticated and anonymous callers cannot execute it. Entry production remains on READY deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF`, but its production environment lacks `SUPABASE_SECRET_KEY`, which the existing server-only trusted-client pattern requires. The approved code repair therefore lacks its required trusted authority. Stopped before source changes, deployment, configuration changes, entitlement mutation, or use of the next clean identity. | Supabase live function definitions/privileges; Vercel deployment inspection and production environment-variable metadata; Entry source inspection |
| 2026-09-18T21:30:33Z | Phase 2.1 approved manual-signup diagnostic: `entry.leademergence.com` still resolved to READY diagnostic deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF`. PM reported one authorized manual submission reached the landing page, but did not provide an exact URL or page content; deployed source would normally redirect a non-error signup to `/login?message=check_email`. The deployment-specific error-level Vercel scan for the preceding 15 minutes returned no records, so no safe diagnostic error fields were recovered. Auth admin supports pagination only, not an email filter; it was not invoked because that would read unrelated users. No browser automation or production mutation occurred. | Vercel production deployment inspection and log query; deployed Entry source; PM report; Supabase Auth admin documentation |
| 2026-09-18T20:37:48Z | Phase 2.1 Entry signup instrumentation: the server action now logs only Supabase Auth error `name`, `code`, `status`, and `message` before preserving the existing generic customer redirect. File-scoped lint, typecheck, local production build, and Vercel remote build passed. Deployment `dpl_6hR1dmbvWgRVubzQ62M6Mo1xq9NF` is `READY`, promoted to `entry.leademergence.com`, and its customer `/signup` route returns HTTP 200. A bounded deployment-specific error-level scan found no records. No signup or Auth/database/Workspace mutation occurred. | Entry source and narrow gates; Vercel deployment/build/promotion inspection; production-hostname HTTP health check and bounded log scan |
| 2026-09-18T19:52:57Z | Phase 2.1 Entry confirmation-path inspection: public Auth settings confirm signups are enabled and email confirmation is required. The deployed no-code callback redirects under `https://entry.leademergence.com`; retrieved callback source expects a PKCE `code`. Supabase documents the standard confirmation flow as Auth `/verify` followed by a redirect with `code`, which is compatible with that callback. The live template, Site URL, redirect allow-list, click event, PKCE cookie state, and Auth/runtime logs were not observable; no confirmation mismatch or underlying Auth error was verified. No retry or production mutation occurred. | authenticated Supabase CLI/public Auth settings; non-following public callback request; retrieved Entry source; Supabase Auth documentation |
| 2026-09-18T19:23:36Z | Phase 2.1 Entry signup error-recovery pass: authenticated Supabase CLI confirms Entry project `neabiaimygdviwobpicj` is `ACTIVE_HEALTHY`; retrieved Entry source converts a returned `signUp()` error into generic `unable_to_create` without logging it. The host could not authenticate the documented Management API logs endpoint from a local CLI token file and browser control failed before dashboard Logs Explorer access. The exact underlying error and emitting component remain unobserved. No signup retry, user action, configuration action, or other production mutation occurred. | authenticated Supabase CLI project list; read-only GitHub source retrieval; documented Management API endpoint attempt |
| 2026-09-18T16:32:07Z | Phase 2.1 account-provisioning refresh: the live Workspace login screen exposed the normal Lead Emergence entry path. Aggregate-only production SQL found 13 non-Andrew Auth users, 2 non-Andrew Personal Workspaces with matching active owner memberships and owner-bound default plans, and 1 owner-bound onboarding record at `setup_method_required`. This verifies stored state shape only; no approved non-Andrew test identity or normal signup traversal was available to prove automatic provisioning, functional first use, or zero manual intervention. No account, auth state, Workspace row, or production configuration was changed. | authenticated Supabase production SQL Editor; live Workspace login screen |
| 2026-09-18T13:46:04Z | One authorized read-only call through Lewis Developer Draft `asdk_app_6aad395b65548191bdcbea7c77f59966` invoked `get_onboarding_state` exactly once and returned a real Workspace result: `state=workspace_ready`, `setup_method=native`, `completed_areas=[]`, `next_useful_area=responsibilities`, `selected_assistant=chatgpt`, `onboarding_complete=true` (workspace UUID redacted in this record). This confirms the ChatGPT → Lewis → Workspace MCP boundary was crossed. No request/correlation ID was exposed; no other Lewis call or retry was made. | authenticated ChatGPT Work chat with Lewis Developer Draft; one user message and one resulting assistant response |
| 2026-09-18T13:29:04Z | One newly authorized read-only invocation through Lewis Developer Draft `asdk_app_6aad395b65548191bdcbea7c77f59966` requested `list_assistant_connections` exactly once. ChatGPT displayed `Listing Assistant Connections`, then returned `Workspace could not complete this tool call safely. No private data was returned.` No request or correlation ID was exposed, no Workspace result was returned, and no retry or other Lewis call was made in this run. Workspace request observation remains unavailable; the first verified boundary is the ChatGPT tool-execution safety response. | authenticated ChatGPT Work chat with Lewis Developer Draft; one user message and one resulting assistant response |
| 2026-09-18T13:25:56Z | Exactly one authorized read-only invocation was sent through the new Lewis Developer Mode draft `asdk_app_6aad395b65548191bdcbea7c77f59966` for `list_assistant_connections`. ChatGPT returned: `Workspace could not complete this tool call safely. No private data was returned.` No request or correlation ID was exposed, no Workspace result was returned, and no second call or retry was made. The first verified failure boundary is the ChatGPT tool-execution safety response; Workspace application reachability is unverified from this run. | authenticated ChatGPT Work chat with Lewis Developer Draft; one user message and one resulting assistant response |
| 2026-09-18T13:18:16Z | Authorized exactly one new ChatGPT Developer Mode draft for the existing Lewis MCP endpoint. Draft `asdk_app_6aad395b65548191bdcbea7c77f59966`, version `asdk_app_v_6aad395b66148191bf6e3daec2742513`, status `development`, uses `https://workspace.leademergence.com/api/mcp`, and completed existing OAuth consent without a new client, redirect URI, static credential, or production configuration change. Its management Actions view exposes 37 tools, including `list_assistant_connections`; no per-tool toggle controls are present; a `Refresh` control is present. No tool was invoked and no chat validation was started. | authenticated ChatGPT Developer Mode draft management; existing Workspace OAuth consent |
| 2026-09-18T12:50:49Z | Authorized one-draft Developer Mode path stopped before creation. In the authenticated ChatGPT Plus web account, Settings → Security and login contains Password, Security keys & passkeys, Active sessions, Apps and sites, and Advanced account security, but no Developer Mode control or enabled state. Because Developer Mode cannot be verified on, no draft, endpoint submission, tool discovery, OAuth action, or other state change occurred. | authenticated ChatGPT Settings → Security and login |
| 2026-09-18T12:30:22Z | Read-only Plugin-path inspection: Plugins → Personal lists the existing Lewis app under Created by me, with no separate Lewis Plugin submission, draft, or migrated object visible. `Create app` opens a separate `New Plugin` form that has Name, optional Description, Server URL/Tunnel, OAuth/No Auth/Mixed selection, discovered Advanced OAuth settings after a valid URL, trust acknowledgment, and disabled Create. The form has no reuse-existing-app or reuse-existing-OAuth-client control, and no Scan Tools control before draft creation. Current account surface shows ChatGPT Plus on the web. No URL was entered, discovery or scan initiated, draft created, or state changed. | authenticated ChatGPT Plugins Personal portal; New Plugin form |
| 2026-09-18T11:44:37Z | Read-only developer-surface inspection: ChatGPT Plugins → Personal → Created by me lists the existing Lewis app. Its creator menu exposes only `Chat`, `Manage`, and `Uninstall`; the existing-app management view exposes no Create draft, New version, Update version, Submit update, or catalog-ingestion control. App identity remains `asdk_app_6aa985ed182c8191898f4a1ffcb2f588`; current version remains `asdk_app_v_6aa985ed18308191a3a1db339d7acd7f`, development review. No mutation, OAuth flow, or new identity was initiated. | authenticated ChatGPT Plugins Personal creator-management surface |
| 2026-09-18T11:36:04Z | Approved Phase 1.7 catalog-refresh attempt stopped without mutation. In the existing Lewis registration’s only supported action menu, the available controls are `View plugin detail`, `Edit name`, `Edit description`, `Reconnect`, `Disconnect`, and `Delete`; no refresh, scan-tools, or catalog-resync control is present. Its Actions panel remains `No app actions available yet.` No app/version, account, OAuth, MCP, backend, or deployment state changed. | authenticated ChatGPT Lewis settings, existing app `asdk_app_6aa985ed182c8191898f4a1ffcb2f588` |
| 2026-09-18T03:07:35Z | Phase 1.7 read-only exposure inspection: source at the recorded Workspace SHA and the live no-bearer `tools/list` catalog both contain `list_assistant_connections`; the existing Lewis app registration points to `https://workspace.leademergence.com/api/mcp`, has OAuth authorized, and has Andrew's connected Lewis account, but its ChatGPT Actions panel states `No app actions available yet.` This is the first verified mismatch: ChatGPT registration/session exposure has no published actions despite the deployed catalog. No production, app, OAuth, or backend mutation occurred. | recorded Workspace SHA `624792468d712fb6285c9fab7172a146c205a1c3`; direct no-bearer JSON-RPC `tools/list`; authenticated ChatGPT Lewis settings |
| 2026-09-18T02:26:45Z | Exactly one read-only Lewis validation was attempted from ChatGPT Work. ChatGPT reported the requested tool unavailable and explicitly stated it was not invoked. Post-attempt production observables show no request reached Workspace: zero connected authorization rows and no new admission event. Phase 1 remains open; no retry or production mutation occurred. | authenticated ChatGPT Lewis conversation `6aaca0fb-de08-83ea-8eae-0961fb07bf72`; scoped read-only Supabase SQL |
| 2026-09-18T01:35:38Z | P0 recovery registered and enabled the existing Custom Access Token Hook at `pg-functions://postgres/private/custom_access_token_hook`. Pre-state had no hooks; post-state shows the one expected hook enabled. Existing function permissions and scoped Lewis client/session/grant/binding state remained unchanged. | Supabase production Auth Hooks control plane; scoped read-only SQL; current Supabase Auth Hooks documentation |
| 2026-09-18T01:09Z | Bounded recovery confirmed existing Lewis session/grant/binding and Personal Workspace mapping, required admission claims, and absent shared issuer hook registration. Stopped at shared Auth configuration dependency; no production change or real Lewis validation. | scoped read-only Supabase SQL; production Auth Hooks page |
| 2026-09-17T23:44:37Z | Phase 1 discovery-canary: ChatGPT New Plugin registration redirected directly into Workspace OAuth consent before presenting an Actions surface. No consent action was taken, and the existing Lewis app was untouched. | authenticated ChatGPT Plugins UI; Workspace OAuth consent screen |
| 2026-09-17T23:30:46Z | Phase 1 empty-action-surface diagnostic: the production MCP discovery endpoint returned 34 tools, including `list_assistant_connections`, without a bearer and with the ChatGPT origin. The selected Lewis app still showed no Actions, with no catalog error or request ID. No production mutation performed. | direct no-bearer JSON-RPC `tools/list` request; selected ChatGPT Lewis management surface; source at recorded Workspace SHA |
| 2026-09-17T22:19:27Z | Phase 1 token-claims assumption challenge: `auth.sessions` exposes no decoded JWT claims; the existing authenticated Lewis chat exposed no bearer token or sanitized claim view; no connector request was sent. Claims remain unverifiable without connector execution. No production mutation performed. | Supabase read-only information-schema/session queries; authenticated ChatGPT Lewis chat surface |
| 2026-09-17T21:26:12Z | Phase 1 post-connection verification: canonical authorization, resource grant, product binding, binding audit, and auth session are present; Workspace authorization projection is absent (`0` connected rows), and Workspace UI reports `No AI assistant connected`. No production mutation, Lewis status/tool call, or SOTF retrieval performed. | Supabase Dashboard SQL Editor read-only query; Workspace Settings UI; ChatGPT canonical Lewis app page |
| 2026-09-17T20:16:14Z | Phase 0 live refresh completed. Confirmed no GoTrue custom access-token hook is registered; recorded current Workspace/www deployments and source SHAs; confirmed deployed Workspace consent completion ordering; latest canonical Lewis attempt remains 2026-09-16 17:15:31 UTC with no retry after either relevant production change. No production mutation performed. | Supabase Dashboard SQL Editor/Auth Hooks; Vercel Production deployment details; source at deployed SHAs `624792468d712fb6285c9fab7172a146c205a1c3` and `33421427c1e33f254ac745d60391f453a1352119` |
| 2026-09-17 | Baseline production snapshot established. No production mutation performed by the audit. | direct SQL/Auth/edge-log audit against `cirqqhuvzekbvysiyedg` |
