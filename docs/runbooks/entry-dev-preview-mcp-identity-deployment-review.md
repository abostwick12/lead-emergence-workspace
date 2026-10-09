# Entry-dev Preview MCP identity and deployment review

**Status:** review only, 2026-10-09. This document authorizes no Auth change, Vercel setting, deployment, database update, test identity, or ChatGPT connection. Keep Workspace [PR #61](https://github.com/abostwick12/lead-emergence-workspace/pull/61) and Ministry [PR #407](https://github.com/abostwick12/emergence-ministry-platform/pull/407) draft. PR #61's source and branch are frozen while this separate proposal is reviewed.

## Outcome and boundary

The desired observable is one **nonproduction** Workspace Preview deployment whose protected-resource metadata advertises its own exact HTTPS `/api/mcp` URI and Entry-dev Auth authority. An unauthenticated MCP request must challenge for that same metadata and return no Workspace data. A later, separately approved configuration can enable that exact URI in Entry-dev; a real ChatGPT authorization and tool lifecycle remains another acceptance gate. No production, billing, entitlement, or shared Auth Site URL change belongs to this proposal.

This matters because the Entry-dev migration is present but its Preview setting remains empty. Without an aligned host and identity path, attempting to connect ChatGPT would either fail or test a different authority.

## Reproduced state and falsifier

| Claim | Read-only evidence on 2026-10-09 | Cheapest falsifier before action |
| --- | --- | --- |
| The Preview resource is disabled | Entry-dev postflight after the one approved application returned `ready: true`, 32 migration rows including `20261009180000` once, and `preview_disabled: true`. | Read the exact setting again; stop if it is no longer empty. |
| There is no verified deployment of the reviewed source | Vercel project `prj_ANnBP1Pxceok4uezHzHPjOTs2cCb` returned 49 deployments; none had Workspace PR #61 head `3fca013398851671446d713aebb684b48b79eb29`. The latest listed build was `main` `4acc2cce59d0d3a8eea8a6626167258294150d0f`. | Re-list deployments and inspect Git SHA, target, aliases, and live metadata; stop if the intended head is already live. |
| The existing Preview client is for another callback | Entry-dev `auth.oauth_clients` has `Lead Emergence Personal Workspace (preview)` with callback `https://nhkugzifuapplwpnfpbt.supabase.co/auth/v1/callback`; its `Lead Emergence Workspace Production` client uses `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/callback`. | Re-read both client records by name and exact callback. Do not reuse a client that targets Personal Auth. |
| A dedicated Workspace Preview provider is absent | Entry-dev `auth.custom_oauth_providers` returned only enabled `custom:lead-emergence-entry-workspace-prod`, with issuer `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1`. Existing `workspace_private.trusted_identity_providers` has `custom:lead-emergence-entry-workspace-preview` disabled. | Re-read the provider and trusted-row inventories; stop if another owner has provisioned the Preview identity. |
| The Vercel Preview runtime is not pinned to Entry-dev | The project's environment-variable inventory lists Preview `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_WORKSPACE_SCHEMA`. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKSPACE_MCP_RESOURCE_URI`, and `ENTRY_OIDC_PROVIDER` are listed for Production, not Preview. Values were not copied into this record. | Re-read variable names, targets, and branch selectors, and verify the resolved runtime values through content-free metadata before deploying. |

The closest supported paths already exist: Supabase Auth has an OAuth client and a custom OIDC provider for Production; Workspace has a disabled trusted Preview provider row; Vercel supports [Preview variables limited to a Git branch](https://vercel.com/docs/environment-variables/manage-across-environments). Reusing the Production provider or the Personal Preview client would cross those exact boundaries. No new database table, function, role, schema, or application auth abstraction is proposed.

## Proposed execution packages — separate approvals

### A. Entry-dev identity, review before any hosted change

1. Pin the target to `vnjdubrnmxvmsccxmhst`. Confirm the dedicated identifier `custom:lead-emergence-entry-workspace-preview` is absent from Auth and disabled in the trusted table. Confirm there is no existing nondeleted Workspace Preview OAuth client with the Entry-dev callback. Record only counts, names, public client ID, callback, and nonsecret provider properties.
2. Prepare **one dedicated confidential OAuth client** named `Lead Emergence Workspace (Entry-dev Preview)` in the Entry-dev OAuth server, with the exact callback `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/callback`. Keep its client secret only in the supported Auth provider configuration path. Do not reuse or alter the Personal Preview or Production client.
3. Prepare one custom OIDC provider identified as `custom:lead-emergence-entry-workspace-preview`, using the Entry-dev issuer `https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1`, the dedicated client ID and secret, and PKCE. Supabase's [custom-provider guide](https://supabase.com/docs/guides/auth/custom-oauth-providers) describes the supported Auth management path; direct edits to `auth.*` catalog tables are not proposed. Verify the actual callback presented by that path before creation.
4. Only after the provider/client pair is read back and a separately approved nonproduction sign-in proves its exact identifier and subject, propose enabling the **existing** trusted Preview row. The live `ensure_personal_workspace` function joins `auth.identities` to enabled trusted providers; leaving this row disabled will deny new Preview identity provisioning. Do not change the Production row, existing users, or the shared Auth Site URL.

**Stop:** missing management support, changed catalog state, wrong callback/issuer, unexpected scope or consent, ambiguous identity/subject, or a need to modify shared auth functions. Do not create a client/provider or flip the trusted row under this review-only package.

### B. Branch-scoped Workspace Preview, review before deployment

1. Pin the source to PR #61 head `3fca013398851671446d713aebb684b48b79eb29` and migration SHA-256 `6cd9a21389f0b6a3a40416aa0ad02443ab354cca9c506be5b186957c113ad0d3`. Inspect the exact deployment project/team, branch alias, build settings, and any current deployment before requesting one Preview deployment. No merge or Production promotion.
2. Prepare branch-specific Vercel Preview values for `codex/entry-dev-preview-mcp-resource-review`: `NEXT_PUBLIC_SUPABASE_URL=https://vnjdubrnmxvmsccxmhst.supabase.co`, the matching Entry-dev **public** anon/publishable key, `NEXT_PUBLIC_WORKSPACE_SCHEMA=workspace`, and `ENTRY_OIDC_PROVIDER=custom:lead-emergence-entry-workspace-preview`. Pin `NEXT_PUBLIC_APP_URL` to the verified stable branch origin and `WORKSPACE_MCP_RESOURCE_URI` to that origin plus `/api/mcp`. The exact origin is **unresolved** until Vercel confirms the branch URL or a separately approved branch domain; do not guess its spelling. Scope values to this branch so other Preview and Production deployments retain their own authority.
3. Deploy only after all six resolved values and their targets are reviewed together. Confirm deployment `READY`, exact source SHA, no unexpected redirect, and no error-level runtime events. A green Vercel check alone is not MCP acceptance.
4. Read `/.well-known/oauth-protected-resource/api/mcp` and require exact resource and Entry-dev authorization server. An unauthenticated MCP `POST` must return `401`, `Cache-Control: no-store`, and a matching `WWW-Authenticate` metadata URL without instructions or user data. Verify only approved CORS origins. Stop if metadata refers to canonical Production, the Personal project, or an unverified host.

The application source in `lib/workspace/mcp-auth.ts` derives the resource from `WORKSPACE_MCP_RESOURCE_URI` (or `NEXT_PUBLIC_APP_URL`) and the authorization server from `NEXT_PUBLIC_SUPABASE_URL`; `lib/supabase/server.ts` requires the matching public key. The sign-in route requires `ENTRY_OIDC_PROVIDER`. These are runtime predicates, not evidence that any Preview deployment currently satisfies them.

### C. Later gates outside this review package

- Obtain a new exact-action decision before setting `workspace_private.product_settings.mcp_preview_resource_uri` to the verified deployed URI. Recheck the 32-row Entry-dev ledger, migration shape, protected counts/fingerprints, and empty setting immediately beforehand; require a read-only postflight afterward. No grant issuance or entitlement change is part of that setting operation.
- Obtain separate authorization for a disposable identity and real ChatGPT connection. Require exact-client discovery, consent, authorized tool response, denied wrong-resource/disabled requests, disconnect/revocation, and cleanup. The historical `real-client-mcp-acceptance.md` runbook points to the Personal Auth project and must not be reused as an Entry-dev instruction without reconciliation.

## Ownership and review

This document is a separate review-only task based on Workspace `main` `4acc2cce59d0d3a8eea8a6626167258294150d0f`. Andrew explicitly allowed a separate worktree despite feature overlap, with PR #61 frozen. The source PR and Ministry packet retain their own reviews and heads. This document does not settle the exact branch URL, create credentials, establish live metadata, or assert ChatGPT acceptance. Each proposed hosted action needs its own pinned target and approval after its unresolved inputs are known.
