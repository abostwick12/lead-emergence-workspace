# Shared-production bounded-hardening plan

Date: 2026-09-13  
Workstream: Supa  
Scope: implementation plan only; no code, migration, Auth, OAuth, secret,
infrastructure, deployment, or production change  
Depends on: `docs/architecture/shared-production-supabase-pilot-proof.md`  
Workspace evidence ref: `cbdb066931799d8f5b631021ce14621099221693`  
Ministry evidence ref: `origin/main@c96537b49a46bab50efeded1ae5c4aa2ad5632a4`  
Consulting evidence ref: `origin/main@0dfa14d9a339897f6a1ada83a3faf3240f519223`

## Decision

**A — BOUNDED HARDENING PLAN READY**

The four Supa blockers can be closed without reopening the accepted pilot
topology and without purchasing or creating another Supabase project. The work
is bounded to:

1. one shared, exclusive OAuth client-to-product binding contract and a
   fail-closed project-wide access-token hook;
2. exact product binding at all three MCP endpoint families;
3. removal of Consulting's general runtime secret-key client; and
4. one Ministry-owned canonical production migration manifest and verifier.

The plan does not include OG/SOTF implementation repairs, Entry changes, hosted
migrations, production Auth changes, OAuth-client creation, deployments, secret
changes, infrastructure changes, capacity purchases, commits, pushes, or merges.

## Planning constraints and source facts

- Supabase Auth, JWT signing, OAuth client catalog, and the custom access-token
  hook are project-wide in the shared project.
- Current Supabase OAuth access tokens provide `client_id`, but the standard
  token payload does not provide the authorization request's `resource`. The
  hook therefore cannot prove resource ownership from token claims alone. See
  [Supabase OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security)
  and [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).
- The Workspace consent resolver already checks the selected authorization row,
  exact Workspace resource, live OAuth client, redirect URI, PKCE, and approval
  state. The weakness is the later token-issuance mapping, not the consent
  resolver's basic resource check.
- A Supabase secret key authorizes the `service_role` database role and bypasses
  RLS. Renaming or rotating the key does not change that property. See
  [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- The 631/631 transactional isolation result is retained as the regression
  baseline. It is not production proof and must be rerun after hardening.
- Ministry remains the only authority that may package or apply migrations to
  the shared hosted production project.

## 1. Blocker-by-blocker root cause

| Blocker | Root cause | Demonstrated consequence | Boundary of this plan |
|---|---|---|---|
| Workspace OAuth resource/audience binding | `workspace_private.custom_access_token_hook` authorizes from user + `client_id` + an active Workspace resource grant, but it does not have a durable project-wide assertion that the client belongs exclusively to Workspace. It rewrites `aud` and does not require or emit an exact `resource` claim. | A token-shaped hook event carrying a Consulting resource/audience was converted to Workspace `aud` + `workspace_mcp=true` when the user/client had an active Workspace grant. A live-client check was absent at token time. | Shared OAuth client binding, hook, Workspace endpoint/DB guard, consent activation, and tests only. |
| Ministry/Consulting MCP product binding | Ministry accepts any valid non-guest account token; `client_id` and resource may be absent. Consulting requires `client_id` but accepts missing resource and does not require exact audience or a current approved product client. | Browser or another product's OAuth token can satisfy too much of an MCP verifier before product-local RLS/capability checks. A dual-authorized user creates a replay ambiguity. | MCP authentication/verifier/session-class changes and central product authority checks only; no tool behavior changes. |
| Consulting runtime secret-key authority | `lib/supabase/admin.ts` creates a general data/Auth client with `SUPABASE_SECRET_KEY`; six runtime modules import it. | Compromise or incorrect authorization in any caller can bypass all RLS in the physical project, including other product schemas. | Replace those six call paths with user-bound RLS, narrow self-authorizing RPCs, or ordinary public Auth flows; delete the general admin client. |
| Canonical combined production manifest | Current packages are fragmented and target-specific; historical Workspace packages are not all ancestors of current Ministry `origin/main`; Consulting is not represented there as one imported package sequence; Ministry source contains duplicate version prefixes and lacks its original baseline migration. | Current committed repositories cannot independently prove one complete, ordered, checksum-locked shared-production replay. | Manifest schema, verifier, canonical source/package ledger, collision checks, rehearsal and recovery references only. No unfinished SOTF package. |

None of these root causes is removed merely by adding a Personal project. Token
verifiers and Consulting runtime elevation would remain wrong in their own
projects, while the Ministry/Consulting shared migration and Auth controls would
still need governance.

## 2. Exact security properties required

### OAuth issuance property

For every token issuance or refresh:

```text
Workspace MCP authority
= valid shared issuer and subject
AND OAuth session with client_id
AND client exists and is not deleted
AND client has exactly one ACTIVE project-wide binding
AND binding.product = workspace
AND binding.resource = canonical Workspace MCP resource
AND binding.audience = canonical Workspace MCP audience
AND user/client/resource Workspace grant is ACTIVE
AND any incoming resource is absent or exactly canonical
AND incoming audience is the normal Supabase base audience or exactly canonical
```

If any term is false, the hook must remove all claims reserved for Lead Emergence
MCP classification and must not rewrite the audience.

### Cross-product property

One `client_id` may be bound to exactly one Lead Emergence product and one
canonical protected resource. A client cannot be Workspace and Ministry,
Workspace and Consulting, or Consulting and Ministry at the same time. Changing
product/resource is revoke-and-reauthorize, never an update in place.

### Endpoint property

Every MCP endpoint must independently require:

```text
valid signature/getUser + exact issuer + unexpired token + exact subject
+ client_id
+ le_session_class = mcp_oauth
+ le_product = expected product
+ exact aud
+ exact resource
+ ACTIVE matching project-wide client binding
+ product-local membership/entitlement/capability
+ endpoint-specific RPC/tool allowlist
```

The hook classifies a token; it does not grant product data by itself.

### Browser noninterference property

Tokens without an OAuth `client_id` retain their ordinary required claims and
audience exactly. They receive no `le_product`, `le_session_class`, `resource`,
or `workspace_mcp` claim. Ministry, Consulting, and Workspace browser membership
and RLS semantics remain unchanged.

### Runtime privilege property

No Workspace or Consulting application request may present a Supabase secret key,
legacy `service_role` JWT, database-owner credential, or equivalent bypass role.
Migration/deployment tooling may use separately controlled authority only after
an explicit gate.

### Migration property

The exact target, complete ordered source set, immutable bytes, predecessor
graph, current ledger state, object effects, and recovery evidence must be
machine-verifiable before a hosted write is possible.

## 3. Smallest implementation changes

### 3.1 Add one exclusive shared OAuth client registry

Create one Ministry-owned private control-plane table in the shared project,
provisionally named `private.oauth_product_client_bindings`:

| Column | Constraint/purpose |
|---|---|
| `client_id uuid` | primary key; foreign-key behavior must fail closed if the Auth catalog shape cannot support a stable FK |
| `product_key text` | allowlist: `ministry`, `consulting`, `workspace` |
| `resource_uri text` | canonical, normalized, credential-free HTTPS resource |
| `audience_uri text` | exact audience; initially equal to `resource_uri` |
| `status text` | `ACTIVE` or `REVOKED`; default non-active during installation |
| `source_authorization_id uuid/text` | authorization that was inspected before the first binding; never accepted from caller without lookup |
| `bound_by_user_id uuid` | subject who explicitly approved the product authorization |
| `bound_at`, `revoked_at`, `updated_at` | lifecycle evidence |
| `binding_version integer` | allows a fail-closed claim-contract upgrade |

Requirements:

- RLS enabled; no `anon` or `authenticated` table grants;
- primary key on `client_id` creates the cross-product exclusivity invariant;
- product/resource/audience tuples are validated against a fixed server-side
  catalog, not caller-provided URLs;
- activation occurs only inside a narrow security-definer function that loads
  the current user's `auth.oauth_authorizations` and live `auth.oauth_clients`
  rows, verifies exact resource, approved status, PKCE/client properties, and
  rejects an existing different binding;
- revocation is append-audited and never reassigns the same client to a different
  product; and
- installation leaves all new product bindings and any dynamic rollout switch
  inactive.

This registry is the minimum project-wide fact that the current per-user
Workspace grant cannot express.

### 3.2 Replace the project-wide hook with a product classifier

Move the authoritative hook to a Ministry-owned private function, provisionally
`private.custom_access_token_hook(jsonb)`. The function:

1. validates `sub`, `session_id`, and `client_id` shapes;
2. treats no `client_id` as an ordinary browser session and returns all ordinary
   claims unchanged after removing stale reserved MCP claims;
3. loads the current OAuth client and requires `deleted_at is null`;
4. requires one active exclusive binding for the client;
5. treats an incoming `resource` as optional because Supabase does not normally
   issue one; if present, it must match the binding exactly;
6. accepts only the base Supabase audience (`authenticated`) or the already
   canonical audience on refresh; any other incoming audience is denied without
   rewriting;
7. for Workspace additionally requires the existing active
   `workspace_private.mcp_oauth_resource_grants` row for the subject/client/exact
   resource;
8. sets `le_session_class=mcp_oauth`, `le_product`, exact `aud`, exact `resource`,
   and `le_binding_version` from the active binding;
9. sets `workspace_mcp=true` only for the Workspace product; and
10. on every unknown, deleted, revoked, conflicting, malformed, or inactive case
    removes all reserved claims and preserves the ordinary base audience.

Reserved claims are owned only by this hook:

```text
le_session_class
le_product
le_binding_version
resource
workspace_mcp
```

The hook must not invent Ministry or Consulting membership/capability claims.
Those remain current database decisions.

### 3.3 Make all MCP verifiers use the same decision order

Each application continues to verify tokens with the shared Supabase issuer and
its user lookup. Add an authenticated, narrow database assertion such as
`private.assert_product_mcp_client(expected_product, expected_resource)` that
derives user/client/claims from `auth.jwt()`, checks the active registry row, and
returns only a boolean or a content-free binding result. It must not return the
registry or cross-product data.

Endpoint verifiers reject before tool construction when any exact claim or
registry assertion fails. Product-local membership/capability checks remain
inside the existing RLS/RPC/service layers.

### 3.4 Remove the Consulting general admin client

Replace the six runtime callers described in section 9. Do not introduce an Edge
Function or another server secret with equivalent bypass authority. When a
public capability token is necessary, expose only a hash-based, rate-limited,
single-purpose security-definer RPC whose body performs the full authorization.

### 3.5 Add one canonical manifest and verifier

Add the Ministry-owned artifacts specified in section 10. The verifier is
read-only by default and has a separate, approval-gated apply entry point. No
script may infer a target from a linked-project default.

## 4. Exact repositories and files expected to change

Filenames for new migrations are intentionally left without timestamps until
implementation begins from current repository heads. Existing migrations remain
immutable.

### Workspace repository

| Expected file | Planned change |
|---|---|
| new `supabase/migrations/<timestamp>_workspace_shared_oauth_binding.sql` | Replace the Workspace-local hook definition only as needed to delegate to/align with the Ministry-owned classifier; harden `is_valid_mcp_request`; require exact product/session/resource/audience/binding; extend grant revocation. Do not create the cross-product registry here. |
| `lib/workspace/mcp-auth.ts` | Require exact issuer, subject, expiration, `client_id`, `le_product=workspace`, `le_session_class=mcp_oauth`, exact `aud`, exact `resource`, binding version, and active database binding. |
| `app/api/mcp/route.ts` | Keep canonical-host and discovery behavior; ensure no server/tool instance is created before exact binding succeeds. |
| `supabase/tests/database/workspace_productization.sql` | Replace the misleading “only OAuth client tokens” assertion; add browser, unknown, revoked, wrong-resource, wrong-audience, cross-product, and orphan-client tests. |
| `supabase/tests/database/lewis_workspace_parity.sql` and other MCP suites | Add exact product/session/resource claims to legitimate fixtures and retain entitlement/capability/cross-tenant denials. |
| `tests/schema-policy-contract.test.mjs` | Assert current-client lookup, exact binding contract, claim preservation, and private grants. |
| new `lib/workspace/mcp-auth.test.ts` or existing nearest verifier test | Unit-test the full token matrix without accepting claim-only authority. |

### Ministry repository

| Expected file | Planned change |
|---|---|
| new `supabase/migrations/<timestamp>_shared_oauth_product_binding.sql` | Create private registry, activation/revocation/assertion functions, audit, fixed product catalog, and the authoritative project-wide hook. |
| new target-locked hosted package under `supabase/hosted-packages/` | Package the reviewed shared-control-plane migration only after source freeze; default all switches/bindings off. |
| `lib/meridian/mcp/auth.ts` | Require exact issuer/subject/expiry/client/product/session/resource/audience and active registry assertion; stop accepting browser tokens and defaulting missing OAuth identity. |
| `lib/meridian/mcp/oauth.ts` | Preserve canonical resource generation; expose one exact production resource constant to tests/verifier. Current source value is `https://www.leademergence.com/mcp`; any domain change requires separate authority and is not inferred here. |
| `lib/meridian/mcp/oauth.test.ts` and new/nearest auth tests | Add browser, Workspace, Consulting, unknown, revoked, wrong-resource/audience, and missing-claim denials. |
| central Ministry identity helper migration or nearest authorization function | Make Workspace/Consulting MCP session classes return no Ministry tenant unless the token is explicitly Ministry MCP and the called surface is the Ministry MCP path. Ordinary Ministry browser behavior must remain unchanged. |
| `supabase/production-manifests/cirqqhuvzekbvysiyedg.json` | Canonical shared-production sequence and state. |
| `supabase/production-manifests/schema.json` | Manifest JSON Schema. |
| `scripts/verify-production-migration-manifest.mjs` | Source/hash/order/dependency/target/collision/ledger verifier. |
| new manifest fixtures under `scripts/fixtures/production-manifest/` | Negative duplicate, checksum, target, predecessor, ordering, and collision cases. |
| new `supabase/hosted-packages/shared-production-pilot-cir/` | Read-only preflight/postflight, locked manifest copy, recovery references, and eventually approved package migrations. |

### Consulting repository

| Expected file | Planned change |
|---|---|
| `lib/mcp/auth.ts` | Require exact Consulting product/session/resource/audience, active registered client, exact issuer/subject/expiry, and endpoint-specific resource (`/mcp` versus `/mcp/client`). Missing resource is denied. |
| `lib/mcp/auth.test.ts` | Expand from one fixture test to the complete cross-product token matrix. |
| `app/mcp/route.ts`, `app/mcp/client/route.ts` | Preserve canonical-origin checks; ensure binding completes before token context/tool server construction. |
| `lib/mcp/session.ts` and nearest tests | Retain consultant/client membership checks; reject non-Consulting token class before organization resolution. |
| new `supabase/migrations/<timestamp>_consulting_runtime_secret_removal.sql` | Add/replace narrow authenticated and capability-token RPCs; revoke unsafe public execution; preserve RLS and fixed search paths. |
| `lib/supabase/admin.ts` | Delete after all imports are removed. |
| `lib/supabase/config.ts`, `lib/supabase/config.test.ts`, `.env.example` | Remove runtime `SUPABASE_SECRET_KEY` configuration and tests. |
| six callers in section 9 | Convert to user-bound server client, normal Auth flow, or narrow RPC. |
| database and application tests nearest each caller | Prove caller identity, tenant, token expiry/revocation, replay denial, and absence of secret-key fallback. |

No Entry or OG/SOTF implementation file is expected to change.

## 5. Workstream ownership

| Deliverable | Owning workstream/repository | Review dependency |
|---|---|---|
| Shared OAuth registry, classifier hook, product catalog, manifest/verifier | Supa hardening / Ministry | Ministry security and migration-authority review |
| Workspace consent/grant, endpoint, database guard, claims tests | Supa hardening / Workspace | Shared registry contract frozen first |
| Ministry MCP verifier and central session-class denial | Supa hardening / Ministry | Shared claims contract frozen first |
| Consulting MCP verifier and runtime secret removal | Supa hardening / Consulting | Shared claims contract frozen first |
| SOTF migrations and product acceptance | OG/SOTF | Independent; no changes from Supa |
| Entry identity/eligibility authority | Entry | No change; interface assumptions only |
| Hosted application/migration/deployment | Ministry release authority + explicit owner gate | Not authorized by this plan |

## 6. Cross-workstream dependencies

### OG/SOTF

- Supa must not edit, rebase, cherry-pick, package, or test-as-final the active
  OG/SOTF repair lineage.
- The shared claims and MCP guard contract may affect how future SOTF MCP calls
  construct synthetic JWT fixtures. Record that as an OG follow-up after Supa
  freezes the contract; do not modify those tests here.
- A future SOTF manifest entry requires OG's immutable accepted commit, complete
  ordered migrations, acceptance evidence, and rollback/recovery note.
- Failure of OG product acceptance blocks SOTF packaging/deployment, but does not
  reopen the shared topology.

### Entry

- Entry remains separate identity/eligibility authority.
- No Entry code, provider, client, secret, or production configuration changes
  are needed for these four blockers.
- Consulting's current Entry handoff/identity-link runtime elevation must be
  replaced without changing Entry: require an authenticated shared-project
  session and self-linking RPC, or retire the redundant handoff lookup.

### Existing production state

The canonical manifest cannot be frozen until a separately authorized read-only
production inventory resolves the actual migration ledger, schema fingerprint,
OAuth client catalog shape, active Auth hook, and resource configuration. That
inventory must not mutate or link the project.

## 7. OAuth/client/resource target contract

### Canonical products

| Product | Product claim | Session claim | Audience/resource | Client binding | User authority |
|---|---|---|---|---|---|
| Workspace ChatGPT/Claude MCP | `le_product=workspace` plus `workspace_mcp=true` | `le_session_class=mcp_oauth` | `https://workspace.leademergence.com/api/mcp` | one active exclusive registry row; current live Auth client; exact Workspace grant | active Workspace membership + Entry eligibility + plan + `workspace_mcp` capability; SOTF additionally requires its own entitlement/capability/release gate |
| Ministry Meridian MCP | `le_product=ministry` | `le_session_class=mcp_oauth` | current source: `https://www.leademergence.com/mcp` | one active exclusive registry row; current live Auth client | Ministry profile + current Ministry ID + existing explicit Meridian grants/pilot capability |
| Consulting consultant MCP | `le_product=consulting` | `le_session_class=mcp_oauth` | configured Consulting origin + `/mcp` | one active exclusive registry row; current live Auth client | active consultant person/assignment + organization/engagement selection |
| Consulting client MCP | `le_product=consulting` | `le_session_class=mcp_oauth` | configured Consulting origin + `/mcp/client` | a distinct active exclusive registry row from consultant MCP | active client organization and engagement memberships |

Resource normalization removes fragments, credentials, query strings,
noncanonical trailing forms, and non-HTTPS production URLs. Exact strings are
stored after normalization; prefix, origin-only, host-only, and substring
matches are prohibited.

### Hook behavior matrix

| Input | Binding/grant state | Hook output |
|---|---|---|
| Ordinary Ministry, Consulting, or Workspace browser | no `client_id` | ordinary claims/audience unchanged; reserved MCP claims absent |
| Workspace ChatGPT OAuth | live exclusive Workspace binding + active user/resource grant | exact Workspace product/session/audience/resource claims; `workspace_mcp=true` |
| Unknown OAuth client | no binding | base OAuth claims preserved; no product/session/resource/Workspace authority |
| Ministry client | active Ministry binding | Ministry product claims only; never `workspace_mcp` |
| Consulting client | active endpoint-specific Consulting binding | Consulting product claims only; never `workspace_mcp` |
| Wrong resource on authorization | resource differs from product catalog | consent resolver denies; no binding/grant/authorization activation |
| Wrong resource injected into hook event | present and mismatched | no product authority; do not rewrite mismatch into success |
| Wrong audience | neither base `authenticated` nor binding audience | no product authority; do not rewrite mismatch into success |
| Deleted/revoked client | Auth client missing/deleted or registry/grant revoked | reserved claims removed; base audience; endpoints/RPCs deny |
| Client already bound to another product/resource | primary-key conflict | activation denies; no second product grant or claims |

The binding row, not `client_id` presence, is the explicit Workspace-owned
identity. Dynamic clients remain supported because the binding is created from
the inspected authorization at consent, not from a hard-coded vendor ID.

## 8. MCP product-binding target contract

### Cross-product matrix

| Token presented to endpoint | Workspace MCP | Ministry MCP | Consulting MCP |
|---|---|---|---|
| Workspace-bound token | ALLOW only after Workspace membership/plan/capability/grant | DENY before Ministry repository/tool construction | DENY before Consulting session resolution |
| Ministry-bound token | DENY before Workspace RPC/client construction | ALLOW only after Ministry profile/grant/pilot checks | DENY before Consulting session resolution |
| Consulting consultant-bound token | DENY | DENY | ALLOW consultant endpoint only after assignment/tenant checks |
| Consulting client-bound token | DENY | DENY | ALLOW client endpoint only after membership/engagement checks |
| Unknown client/resource | DENY | DENY | DENY |

### Endpoint-specific checks

| Layer | Workspace | Ministry | Consulting |
|---|---|---|---|
| Canonical HTTP target | production host + `/api/mcp` | source-owned production origin + `/mcp` | configured production origin + exact `/mcp` or `/mcp/client` |
| Token identity | `getUser`, issuer, subject, expiry | `getUser`, issuer, subject, expiry | `getUser`, issuer, subject, expiry |
| Product classification | exact Workspace claims | exact Ministry claims | exact Consulting claims plus endpoint-specific resource |
| Current client | active exclusive registry + Auth catalog | same | same |
| Local authority | Workspace membership, eligibility, plan, capability, active grant | Ministry profile/current ministry + explicit Meridian grant/pilot gate | consultant assignment or client memberships/engagements |
| Data surface | controlled `workspace.mcp_*` RPC allowlist; no base/private tables | current repository/service grants and RLS; no Workspace/Consulting schema | current Consulting RLS/RPC surface; no Ministry/Workspace schema |
| Failure | content-free 401/403; no server/tool/data client | content-free 401/403; no client-name fallback for auth | content-free invalid-token/authorization error; no session resolution |

Central Ministry and Consulting data helpers must explicitly return no product
tenant for a different MCP product class. This provides database defense in
depth for a correctly signed shared-project token belonging to a dual-product
user.

## 9. Consulting runtime secret-key removal plan

### Complete current runtime inventory

| Current source | Current use | Classification | Smallest replacement |
|---|---|---|---|
| `lib/supabase/config.ts::requireSupabaseSecretKey` | Reads `SUPABASE_SECRET_KEY` for application runtime | runtime-required by current elevated client; replaceable | Delete after callers migrate; no replacement secret. |
| `lib/supabase/admin.ts::createSupabaseAdminClient` | General Consulting/private data client plus Auth Admin client | runtime-required by current callers; architecture-prohibited | Delete; split callers by actual authority and use user-bound client/normal Auth/narrow RPC. |
| `app/auth/handoff/route.ts` | Reads canonical identity links and memberships after verifying/redeeming Entry handoff | runtime-required current; replaceable with authenticated/RLS path | Require/establish the shared-project user session first, then query through RLS or a self-only RPC deriving `auth.uid()`. If the handoff route cannot obtain user authority, retire its data lookup rather than keep a bypass client. |
| `lib/auth/entry-sso.ts` | Calls `link_entry_oidc_identity` while a Supabase user is already known | runtime-required current; replaceable with tightly bounded authenticated RPC | Use user-bound server client; RPC derives `auth.uid()` and verified provider identity, accepts no arbitrary target user, and permits only self-linking. |
| `lib/access/repository.ts` invitation flow | Auth Admin invite/list-users/OTP plus RLS data writes | runtime-required current; replaceable with ordinary Auth + authenticated/RLS | Keep invitation record under consultant session/RLS. Send an opaque app invitation; recipient signs up/signs in through ordinary public Auth and accepts through a self-authorizing RPC. Never enumerate Auth users. |
| `lib/access/repository.ts` participant-link issue | Calls service-role-only `issue_assessment_participant_link` | runtime-required current; replaceable with tightly bounded RPC | Grant an authenticated wrapper that derives actor/org/engagement, rechecks consultant authority and administration scope, accepts only hash/expiry/recipient metadata, and returns no private row. |
| `lib/operational-ai/assessment-administration.ts` | Same participant-link issuance after authenticated administration creation | runtime-required current; replaceable with same bounded RPC | Reuse the authenticated wrapper; keep creation and issuance in one authorized transaction where practical. |
| `lib/access/assessment.ts` resolve/submit | Anonymous bearer-capability assessment access through service-role-only functions | runtime-required current; replaceable with tightly bounded capability RPC | Allow `anon` execute only on hash-based resolve/submit wrappers that validate token hash, expiry, status, administration/item relationship, single-tenant scope, payload bounds, revocation, and replay semantics internally. No table grants. |
| `lib/mcp/audit.ts` | Direct privileged insert to `mcp_tool_audit` | runtime-required current; replaceable with authenticated RPC | User-bearer call to an allowlisted audit RPC deriving person/organization/client from JWT and current membership; content-free fields only; audit failure remains non-authorizing. |
| `lib/supabase/config.test.ts` | Tests the secret accessor | local-test-only after removal | Replace with a static/runtime test that production config has no secret-key dependency. |
| `.env.example` | Advertises `SUPABASE_SECRET_KEY` | dead/legacy after removal | Delete the variable and document migration tooling outside app runtime separately. |

### Related `SECURITY DEFINER` functions

Consulting current migrations contain 86 static `SECURITY DEFINER` definitions.
That count does not mean 86 runtime bypasses: many are authenticated product
functions with internal tenant checks. The secret-removal slice must generate a
machine-readable inventory of function signature, owner, volatility, search
path, execute grantees, referenced schemas/tables, and internal authority
predicate.

The functions directly compensating for current elevated runtime access are:

- `consulting_os.issue_assessment_participant_link(...)`;
- `consulting_os.resolve_assessment_participant_link(text)`;
- `consulting_os.submit_assessment_participant_response(text, uuid, jsonb)`; and
- `consulting_os.link_entry_oidc_identity(...)`.

`mcp_tool_audit`, identity-link, and membership reads are direct elevated table
operations rather than compensating RPCs. Historical `grant ... to service_role`
statements are migration/deployment role configuration; they are not proof of a
runtime credential by themselves and need not be rewritten. The application
must simply stop possessing that role.

### Target state

- ordinary Consulting pages, routes, and MCP tools use the caller's access token;
- RLS resolves the person, role, organization, engagement, and row scope;
- public assessment links are narrow bearer capabilities, not general database
  authority;
- Auth invitations use supported public sign-in/signup flows rather than Auth
  Admin enumeration;
- narrow security-definer functions derive authority from JWT or validate the
  complete capability internally, use `search_path=''`, schema-qualified names,
  revoked defaults, and minimum execute grants; and
- the deployed Consulting application has no Supabase secret/service-role key.

Stop the secret-removal implementation if any caller cannot be made user-bound
or capability-bound without a new general server credential. That would require
a separate architecture review, not an exception hidden in this slice.

## 10. Canonical combined migration-manifest design

### Ministry-owned artifacts

```text
supabase/production-manifests/
├── schema.json
└── cirqqhuvzekbvysiyedg.json

supabase/hosted-packages/shared-production-pilot-cir/
├── manifest.lock.json
├── README.md
├── preflight.sql
├── postflight.sql
├── recovery.md
└── migrations/              # immutable approved package bytes only

scripts/
├── verify-production-migration-manifest.mjs
└── fixtures/production-manifest/
```

### Manifest header

| Field | Rule |
|---|---|
| `format_version` | fixed schema version; unknown version denied |
| `target.project_ref` | exactly `cirqqhuvzekbvysiyedg`; supplied explicitly to commands, never inferred from a link |
| `target.expected_host` | exact Supabase database/API host pattern without credentials |
| `manifest_id` | content-derived digest of canonical JSON |
| `generated_from` | Ministry commit and clean-worktree assertion |
| `baseline_schema_fingerprint` | deterministic pre-apply product object/grant/policy/extension fingerprint |
| `expected_ledger_fingerprint` | ordered hash of the expected pre-apply migration ledger |
| `release_gates` | Supa freeze, OG freeze, product regressions, backup/recovery, explicit owner authorization; false by default |

### One entry per migration/package unit

| Field | Purpose |
|---|---|
| `ordinal` | contiguous integer; the only legal execution order |
| `version`, `name` | exact Supabase ledger identity; duplicate version forbidden |
| `product` | `ministry`, `consulting`, `workspace`, or `sotf` |
| `state` | `required_applied` or `approved_pending`; observed state is never written into source automatically |
| `source_repository`, `source_commit`, `source_path` | immutable provenance |
| `package_path` | Ministry-owned copied artifact |
| `sha256` | byte hash required to match source and package |
| `predecessors` | explicit versions/manifest entry IDs; all must precede ordinal |
| `objects` | normalized creates/alters/replaces/drops, function signatures, grants/policies, schemas, extensions, Auth/config effects |
| `transaction_mode` | transactional requirement or reviewed reason it cannot be transactional |
| `acceptance_evidence` | exact product test/freeze reference |
| `rollback_recovery` | application rollback, forward database recovery, backup dependency |

### Legacy Ministry/Consulting baseline rule

The manifest must not pretend the current Ministry migration directory is a
complete replay. Before freezing it:

1. map every expected production ledger entry to immutable source bytes;
2. recover or authoritatively snapshot the missing original Ministry baseline;
3. determine which files with duplicate prefixes `023`, `030`, and `031` are
   actually represented in the ledger/schema;
4. never rename an already-applied ledger entry;
5. if a duplicate source file was never applied, represent any still-required
   effect as a new forward migration with a new unique version; and
6. fail the manifest until every required-applied entry has source checksum plus
   a matching schema/catalog effect.

### SOTF insertion gate

The initial manifest contains no unfinished OG/SOTF migration entry. It contains
only a closed release gate:

```text
release_gates.sotf_package.status = BLOCKED_PENDING_OG_ACCEPTANCE
```

The verifier permits an SOTF entry only when it includes an immutable OG commit,
unique migration versions, source/package hashes, explicit Workspace predecessor,
OG acceptance evidence, and recovery reference. The manifest digest changes and
requires a new review; insertion is never an in-place operator edit.

### Fail-closed verifier rules

The verifier exits nonzero before any database connection when it finds:

- duplicate version or ordinal;
- source/package byte difference or altered checksum;
- target other than the explicit CLI project ref;
- missing, later, or cyclic predecessor;
- a package listed out of ordinal order;
- dirty source/package worktree for a freeze operation;
- missing commit/path/evidence/recovery reference;
- unfinished SOTF entry; or
- unrecognized product, state, object action, or manifest schema version.

Read-only database preflight then exits nonzero for:

- unexpected project/host or ledger fingerprint;
- required-applied migration absent;
- approved-pending migration already present;
- baseline schema fingerprint mismatch;
- object already owned by another product;
- incompatible function signature/owner/body hash;
- grant/policy widening outside the declared object effects;
- schema or extension version collision; or
- missing backup/recovery and product gate evidence.

Collision extraction must use a SQL parser/catalog comparison, not regex alone.
The clean replay is the authoritative dynamic collision test.

## 11. Post-hardening coexistence test matrix

| Case | Before hook | After hook | Endpoint outcome | Database/RPC outcome |
|---|---|---|---|---|
| Ministry normal login | ordinary Ministry claims, no client | byte-equivalent ordinary claims | browser unchanged; all MCP endpoints deny browser token | existing Ministry RLS unchanged; other products require separate membership |
| Consulting normal login | ordinary Consulting claims, no client | byte-equivalent ordinary claims | browser unchanged; all MCP endpoints deny browser token | Consulting RLS unchanged |
| Workspace normal login | ordinary Workspace claims, no client | byte-equivalent ordinary claims | browser unchanged; all MCP endpoints deny browser token | Workspace direct-session RLS unchanged |
| Workspace ChatGPT OAuth | live exclusive binding + active grant | Workspace-only product/session/resource/audience claims | Workspace accepts; Ministry/Consulting deny before tool creation | controlled Workspace RPCs only; base/private tables denied |
| Ministry MCP OAuth | live Ministry binding | Ministry-only claims | Ministry accepts; Workspace/Consulting deny | current Ministry profile/grant/capability checks |
| Consulting consultant OAuth | live exact consultant binding | Consulting claims for `/mcp` | consultant endpoint accepts; client/Workspace/Ministry endpoints deny | consultant assignment and tenant checks |
| Consulting client OAuth | live exact client binding | Consulting claims for `/mcp/client` | client endpoint accepts; consultant/Workspace/Ministry endpoints deny | client membership and engagement checks |
| Unknown OAuth client | no binding | no product/session/resource claim; base audience preserved | all MCP endpoints deny | no product MCP RPC authority |
| Wrong resource authorization | exact mismatch | no binding/grant/claims | all endpoints deny | no authorization state created |
| Wrong resource token | injected mismatch | authority stripped/not added | all endpoints deny | all MCP RPC guards deny |
| Wrong audience | non-base mismatch | authority stripped/not added; mismatch not rewritten | all endpoints deny | all MCP RPC guards deny |
| Revoked/deleted client | stale grant or stale token | no fresh authority; refresh strips reserved claims | existing and refreshed tokens denied by registry check | grants/capabilities cannot revive it |
| Cross-product/multi-resource bind | client already owned by another tuple | activation fails | existing owner only, subject to its own gates | no second product authority |
| Malformed OAuth session | invalid subject/session/client/claim types | no product authority or issuance failure | all deny | no RPC/schema reachability |

Claim comparisons must assert the complete required claim set, absence of every
reserved claim, and preservation of unrelated standard claims—not merely one
audience field.

## 12. New negative-isolation assertions

Add independent assertions for:

1. browser sessions for all three products remain byte-equivalent through the
   hook;
2. any `client_id` without an active exclusive binding receives no Lead Emergence
   product authority;
3. active Workspace grant plus wrong incoming resource does not cause audience
   rewrite or Workspace authority;
4. active Workspace grant plus deleted/revoked client is denied at hook, endpoint,
   and RPC;
5. the same client cannot bind to two products or two endpoint resources;
6. Workspace token is rejected by Ministry and both Consulting endpoints;
7. Ministry token is rejected by Workspace and both Consulting endpoints;
8. each Consulting endpoint token is rejected by Workspace, Ministry, and the
   other Consulting endpoint;
9. a dual-role synthetic user cannot use a Workspace MCP token through Ministry
   or Consulting REST/RPC policies;
10. Workspace MCP can execute only the approved `workspace.mcp_*` allowlist and
    cannot select base tables or any private/cross-product schema;
11. missing membership, entitlement, capability, active grant, or release gate
    denies independently;
12. revoked entitlement and cross-tenant IDs remain denied;
13. secret-key/service-role environment variables are absent from Consulting
    application configuration and no application module constructs an elevated
    Supabase client;
14. each replacement capability RPC denies wrong role, tenant, expired/revoked
    token, altered token hash, replay where single-use applies, oversized payload,
    and direct table access;
15. every security-definer function has fixed empty search path, schema-qualified
    references, deliberate execute grants, and an internal authority predicate;
16. manifest negative fixtures fail for each specified failure mode; and
17. clean replay object/grant/policy fingerprints match the manifest exactly.

The assertion oracle must be independent of the implementation's helper
functions: expected product/session/resource decisions are table-driven in test
code/SQL and compared to actual hook, endpoint, RLS, and RPC results.

## 13. Migration rehearsal sequence

This defines the future sequence; it does not authorize execution now.

1. Freeze the four Supa implementation slices in their owning repositories.
2. Verify clean worktrees and immutable commits; stop on unrelated or OG/SOTF
   changes in the selected diff.
3. Run each repository's required static, unit, database, security, and build
   gates.
4. Rerun all 631 baseline assertions unchanged. A changed expected result requires
   explicit security review; do not normalize the failure into the suite.
5. Run the new token, endpoint, dual-role, private-schema, capability-RPC, secret
   absence, and manifest negative suites.
6. Freeze Supa evidence and leave every new production switch/binding OFF.
7. Separately wait for OG/SOTF to freeze its implementation, migration order, and
   acceptance evidence.
8. Build the Ministry canonical manifest from both frozen inputs. Do not include
   SOTF before step 7.
9. Reconstruct a clean shared-project-shaped Supabase stack from the canonical
   Ministry+Consulting baseline and apply only manifest order.
10. Compare schema, function, owner, grant, RLS/policy, extension, hook, and ledger
    fingerprints before/after each package.
11. Run Ministry, Consulting, Workspace, cross-product, OAuth noninterference, MCP,
    and accepted SOTF regressions in the clean combined stack.
12. Destroy the isolated rehearsal stack after evidence capture; do not reuse its
    mutable state as proof.
13. Perform separately authorized production read-only preflight using an explicit
    target ref; stop on any fingerprint/ledger/catalog drift.
14. Create and verify a backup/recovery point under Ministry authority.
15. Obtain exact written owner authorization naming manifest digest, target,
    package, migration set, and application releases.
16. Apply only through the Ministry authority, then run read-only postflight and
    negative probes with release gates still OFF.
17. Deploy the independently approved Workspace application.
18. Enable only the specifically approved pilot binding/gate.
19. Complete real ChatGPT connect, resource/audience, tool allowlist, refresh,
    revoke, stale-token denial, and reconnect acceptance.

## 14. Rollback and recovery considerations

### OAuth/control-plane

- Install schema/functions inactive first; the current hook remains until the
  exact config-change gate.
- Capture the prior hook function/configuration and a tested forward restoration
  migration. Do not rely on editing a historical migration.
- The immediate kill switch revokes/ignores all new bindings and returns browser
  tokens unchanged; it must fail closed for MCP without breaking normal login.
- Existing issued tokens remain subject to endpoint/database live binding checks,
  so registry revocation denies them without waiting for expiry.
- If normal login or refresh changes unexpectedly, stop rollout and restore the
  prior hook configuration before enabling any MCP binding.

### Consulting secret removal

- Migrate one caller family at a time behind tests, but do not deploy a mixed
  production state that silently falls back to the secret key.
- Capability-token schema changes are additive first; old service-role-only
  function signatures remain until new call paths pass, then a forward migration
  revokes obsolete execute paths.
- Invitation and assessment token failures must deny access without losing the
  underlying administration/invitation record.
- Do not reintroduce the secret as an emergency fallback. Recovery is application
  rollback to the last reviewed version only if that rollback is explicitly
  accepted as temporarily restoring known risk; otherwise stop the feature.

### Database packages

- Prefer transactional forward migrations and additive installation.
- Database rollback is a reviewed forward recovery migration, not destructive
  history editing or `migration repair` on production.
- Back up and fingerprint before apply. Define which application version is
  compatible with pre- and post-migration schemas.
- Stop after a failed migration; do not skip, reorder, mark applied, or retry until
  the ledger and transaction state are independently reconciled.

## 15. Implementation order and stop conditions

| Stage | Work | Required exit evidence | Stop immediately when |
|---|---|---|---|
| 0 | Freeze this plan and exact repo refs | approved scope; clean isolated branches/worktrees | scope touches Entry, OG/SOTF repair, Cash, E2, P2, billing, infrastructure, or hosted state |
| 1 | Implement shared registry and classifier locally in Ministry | table/function/grant review; hook matrix; default OFF | Supabase hook inputs cannot support safe client classification, browser claims change, or one client can bind twice |
| 2 | Harden Workspace verifier/guard/consent activation | all Workspace positive/negative claims, endpoint, RPC, entitlement/capability tests | wrong/unknown/revoked client or resource reaches Workspace authority |
| 3 | Harden Ministry and Consulting MCP verifiers/helpers | all cross-product matrix cells fail closed except intended diagonal | browser/other-product token reaches a tool/session or existing authorized diagonal loses product-local checks |
| 4 | Remove Consulting elevated runtime paths | six callers migrated; no secret accessor/client/env; capability/RLS tests | any caller requires a general bypass credential or narrow RPC lacks complete internal authority |
| 5 | Rerun baseline + new combined oracle | 631/631 baseline plus every new assertion; no weakened RLS/grant/capability | any baseline regression, private grant, cross-tenant leak, or test oracle depends on implementation helper |
| 6 | Freeze Supa hardening | immutable commits/checksums/evidence; no production action | diff contains unrelated or OG/SOTF implementation work |
| 7 | Wait for independent OG freeze | accepted immutable SOTF lineage/evidence | OG acceptance is incomplete or migration sequence changes |
| 8 | Build canonical Ministry manifest/package | verifier green; unique versions; full baseline; exact target; recovery refs | duplicate/unmapped history, checksum drift, missing predecessor, object collision, unfinished SOTF, dirty source |
| 9 | Clean full local shared rehearsal | deterministic replay and all product/negative tests green | any nonreproducibility, platform-shell warning affects product objects, or schema fingerprint differs |
| 10 | Production read-only preflight | exact ledger/catalog/target match; backup/recovery ready | any drift, unexpected client/hook/config, missing capacity margin, or wrong target |
| 11 | Owner authorization | written manifest digest, target, migration and release approvals | authorization is absent, ambiguous, broader/narrower, or stale after a digest change |
| 12 | Ministry migration and postflight | exact ledger, fingerprints, regressions, gates OFF | any apply/postflight discrepancy; do not deploy application |
| 13 | Workspace deployment and real-client acceptance | exact release, canonical metadata, connect/refresh/revoke/reconnect results | wrong origin/resource/audience, cross-product access, stale token acceptance, or unapproved tool |

At every stage, a stop preserves the last verified state and produces evidence;
it never grants permission to alter another workstream.

## 16. Exact next implementation prompt

Use this as the next separately authorized Supa implementation request:

> Continue the isolated Supa workstream. Implement only Stage 1 of
> `docs/architecture/shared-production-bounded-hardening-plan.md`: the
> Ministry-owned private OAuth product-client binding registry, fixed product
> catalog, activation/revocation/assertion functions, and project-wide custom
> access-token classifier, all locally and default OFF. Use the current official
> Supabase OAuth and custom-access-token-hook contract. Do not change production
> Auth, create OAuth clients, apply or package a hosted migration, deploy, commit,
> push, or touch Entry, OG/SOTF, Cash, E2, P2, or billing. Work from an isolated
> Ministry branch/worktree, preserve unrelated changes, and add an independent
> table-driven hook oracle proving byte-equivalent ordinary Ministry,
> Consulting, and Workspace browser claims; exact single-product claims for each
> active bound client; and denial for unknown, malformed, revoked, deleted,
> conflicting, wrong-resource, and wrong-audience cases. Stop if the current
> Supabase hook event cannot support the contract without a broader architecture
> change. Return source/static/local evidence only.

Stage 1 deliberately does not alter the Workspace, Ministry MCP, Consulting MCP,
Consulting secret, canonical package, or production configuration. Those follow
only after the shared claim contract freezes.

## 17. Infrastructure confirmation

No new Supabase project or capacity purchase is required to implement or locally
prove this bounded hardening plan. The shared Ministry production project remains
the pilot target. A dedicated Personal project remains optional future
blast-radius hardening based on measured availability, compliance, recovery,
scale, or operational-separation needs.

The future authorized sequence remains:

```text
Supa hardening frozen
+ OG/SOTF acceptance frozen
→ canonical Ministry migration package
→ clean local full shared-project rehearsal
→ production read-only preflight
→ explicit owner authorization
→ Ministry-owned shared production migration
→ Workspace Vercel deployment
→ real ChatGPT acceptance
```

Every arrow is a stop gate, not implied authorization.

SUPA BOUNDED HARDENING PLAN READY — SHARED PRODUCTION REMAINS THE PILOT TARGET
