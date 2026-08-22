# Personal productization architecture

This document defines the production contract for Lead Emergence Workspace / Personal. It supplements the extraction history; it does not authorize a hosted migration, a production merge, billing, or real-user activation.

## Product lifecycle

```text
Lead Emergence identity
  -> active Entry PERSONAL entitlement
  -> Personal Workspace provisioning
  -> AI-assisted or native setup
  -> one shared confirmed configuration
  -> first useful leadership state
  -> ongoing Workspace use
```

Entry determines whether a canonical identity may enter Personal. Workspace independently owns the Personal plan, capabilities, membership, private data, setup, MCP authorization, and connector authorization. Neither an Entry entitlement nor a plan assignment grants access to a record.

The canonical production application origin is `https://workspace.leademergence.com`. `https://lead-emergence-workspace.vercel.app` remains a rollback and diagnostic address and must not be removed. Local, Preview, Production, test, and rollback origins remain separate configuration values.

## First entry and shared setup

`workspace.ensure_personal_workspace()` validates a trusted Entry OIDC identity, preserves an existing legacy owner when safe, and creates only the caller's private Personal Workspace, owner membership, profile, unpriced Personal plan assignment, and initial setup row. A direct password session may access an existing owner Workspace for rollback, but it cannot use this path to manufacture an unrelated canonical identity.

The setup states are:

| State | Meaning |
| --- | --- |
| `setup_method_required` | The user must choose an AI-assisted or native route. |
| `ai_setup_selected` | Reserved explicit selection state. |
| `mcp_connection_required` | ChatGPT or Claude was selected but has not made an authorized tool request. |
| `mcp_connected` | An authorized MCP client is present; setup is still incomplete. |
| `onboarding_in_progress` | At least one setup area is saved or confirmed. |
| `onboarding_complete` | Reserved completion transition. |
| `workspace_ready` | Minimum confirmed context exists and Home may be used. |

`mcp_connected` is deliberately not equivalent to `workspace_ready`. Returning incomplete users resume the first unfinished area. Returning ready users bypass setup. Either route may switch to the other without deleting confirmed information.

Both interfaces write `workspace.personal_configuration_items`. There is no AI-only or manual-only configuration. Supported areas include responsibilities, attention, priorities, commitments, value, existing systems, assistant posture, review rhythm, starting capabilities, Daily Brief, and integration recommendations.

Epistemic status is explicit:

```text
user_reported -> ai_suggested -> user_confirmed -> validated_configuration
```

An AI suggestion remains a suggestion until the user explicitly confirms the identified item. Native answers are saved as user-confirmed. Setup completion requires confirmed information in at least three meaningful areas. Home then uses confirmed priorities and areas of attention to provide a first leadership focus without claiming comprehensive understanding.

## Plan and capability layers

```text
Entry PERSONAL entitlement
  -> Personal plan assignment
  -> typed capability resolution
  -> Workspace membership and RLS
```

The initial `Personal` plan is intentionally `unpriced`. Included capabilities are Core Workspace, Daily Focus, Quick Capture, Personal Memory, Career Pipeline, Daily Brief, and the Workspace MCP. Leader Mode, external connectors, advanced MCP, agentic workflows, and advanced automation are defined but not included. The external-connection limit is zero.

The browser resolves display state from `workspace.plan_capabilities`. Server-side use is enforced by `workspace_private.has_personal_capability(...)` together with active membership and owner checks. MCP tools use the same resolver through private RPC guards. There is no plan-name authorization path.

Suspending a plan or removing a capability disables privileged use while retaining data and safe configuration. Plan assignment never reassigns ownership. Trial columns are schema preparation only; no trial terms are active. Billing, pricing, subscriptions, checkout, and payment links are not active.

Development or approved operations may assign a plan through `workspace_private.assign_personal_plan(workspace_id, plan_key, reason)`. It is granted only to `service_role`, records an audit row, and is not used by application runtime. Operators must execute it only through the migration authority's approved admin process.

## Workspace MCP

The Workspace exposes a stateless Streamable HTTP MCP endpoint at `/api/mcp`. Its protected-resource metadata is published at both standard well-known locations. Supabase Auth is the OAuth authorization server, using dynamic client registration, PKCE, explicit consent at `/oauth/consent`, and a custom access-token hook.

Every request must pass:

```text
canonical authenticated subject
  -> exact MCP resource audience
  -> workspace_mcp token claim
  -> active MCP client authorization epoch
  -> active Personal plan and workspace_mcp capability
  -> active Personal ownership
  -> controlled RPC/tool
```

The MCP bearer session cannot select Workspace base tables or private Storage objects directly. It receives only controlled RPC results. Disconnect increments the authorization-valid-after boundary and revokes the Supabase OAuth grant where available; an older bearer is denied even before its natural expiry.

Onboarding tools:

- `get_onboarding_state`
- `get_workspace_setup`
- `save_user_reported_setup`
- `suggest_workspace_configuration`
- `confirm_workspace_configuration`
- `complete_onboarding`

Ongoing tools, available only after setup is ready:

- `get_leadership_state`
- `capture_signal`

Workspace remains the system of record. ChatGPT and Claude are user-selected interfaces into the same controlled server. Their product UIs currently require the user to add the remote connection address manually; Workspace does not claim an unsupported deep-install flow.

### MCP inventory

| MCP | Classification | Plan | Authorization/isolation | Current result |
| --- | --- | --- | --- | --- |
| Workspace MCP through ChatGPT | Workspace-native | `workspace_mcp` | Supabase OAuth, exact audience, consent, owner/RLS, controlled RPCs | Implemented locally; hosted OAuth configuration and interactive acceptance remain gated. |
| Workspace MCP through Claude | Workspace-native | `workspace_mcp` | Same contract as ChatGPT with independent client/grant metadata | Implemented locally; hosted OAuth configuration and interactive acceptance remain gated. |
| Lead Emergence MCP | Not a separate server | N/A | Workspace itself is the Personal Lead Emergence MCP boundary | No duplicate connection is created. |
| Logos MCP | Optional placeholder | Future external capability | Separate adapter and approval required | Catalog only; not production-ready. |
| Consulting MCP | Cross-product, not appropriate by default | N/A | Consulting authorization must stay in Consulting | Not connected or exposed. |
| Ministry MCP | Cross-product, not appropriate | N/A | Ministry data and credentials are outside this product | Not connected or exposed. |

## Connector inventory

The connection catalog describes potential value and boundaries; it is not evidence of a working connector. Existing migrated connection rows are metadata only and default to `reconnect_required`. No legacy token is copied, and no durable credential is stored in browser state.

| Connector | Classification | Plan | Intended least privilege | Current result |
| --- | --- | --- | --- | --- |
| Google Calendar | Optional | `external_connectors` plus limit | Calendar context and user-triggered actions | Catalog/metadata only; not production-ready. |
| Gmail | Optional | `external_connectors` plus limit | Personal inbox triage and draft-only use | Catalog/metadata only; Ministry Gmail excluded. |
| Google Drive | Optional | `external_connectors` plus limit | Explicitly permitted Personal files | Catalog/metadata only; not production-ready. |
| Slack | Optional | `external_connectors` plus limit | Explicit workspace/channel delivery | Catalog/metadata only; not production-ready. |
| Monday.com | Optional | `external_connectors` plus limit | One-way import | Catalog/metadata only; not production-ready. |
| GitHub | Optional placeholder | Future external capability | Separately approved read scope | Catalog only; not production-ready. |
| LinkedIn | Optional | `external_connectors` plus limit | Drafting only; never automatic posting | Catalog/metadata only; not production-ready. |
| Firecrawl | Optional | `external_connectors` plus limit | User-triggered curated refresh | Catalog/metadata only; not production-ready. |
| Canva | Optional placeholder | Future external capability | Separately approved design adapter | Catalog only; not production-ready. |
| PowerPoint | Optional placeholder | Future external capability | Separately approved Microsoft adapter | Catalog only; not production-ready. |
| YouVersion | Optional placeholder | Future external capability | Read-only references | Catalog only; not production-ready. |

With no external connectors, Workspace remains useful through native setup, confirmed configuration, Tasks, Quick Capture, Memory, Career, Daily Brief preferences, and the optional Workspace MCP. No provider account is auto-connected.

## Identity and callback contract

Workspace reuses the proven Entry OAuth/OIDC protocol. The browser starts at `/auth/entry`; Supabase Auth redirects to Entry; the exact custom provider identity returns through Workspace `/auth/callback/sign-in`. The callback requires exactly one identity from the configured provider and a UUID provider subject equal to the Workspace Auth user ID. The provider identifier must be explicitly trusted for the environment.

Production configuration uses:

- application origin: `https://workspace.leademergence.com`;
- Entry product destination: `https://workspace.leademergence.com`;
- app sign-in callback: `https://workspace.leademergence.com/auth/callback/sign-in`;
- MCP resource: `https://workspace.leademergence.com/api/mcp`;
- OAuth consent path: `https://workspace.leademergence.com/oauth/consent`;
- Workspace Auth OAuth callback origin: the exact hosted Workspace Supabase Auth origin supplied to Entry.

Localhost and Preview callbacks remain separately allow-listed. Broad Production wildcards are prohibited. The migration enables only the Production Entry provider by default; the local seed switches to Development and loopback MCP values. Preview must explicitly enable only its own provider in its isolated backend. The Vercel rollback domain is not made canonical but remains available for an operator rollback.

## Privacy, events, and failure posture

Workspace collects only setup content a user enters or explicitly confirms. Product events use a fixed name list and small non-content context; private answers, tokens, authorization codes, and connector payloads must never be placed in event context or logs.

Safe user-facing states cover missing entitlement, session expiry, unavailable plan capability, MCP connection failure, reconnect, disconnection, and provider denial. MCP failure always offers native setup. External connections never imply success unless an authorization is valid and usable.

Operational visibility should combine privacy-safe `workspace.product_events`, Vercel request/runtime logs, and Supabase Auth/database logs. Alert categories include onboarding load/save/complete failure, Entry callback validation, MCP OAuth/registration/authorization failure, capability denial, connector refresh failure, Storage denial, and HTTP 5xx. Never log secrets or Personal setup content.

## UI scope audit

No full redesign was performed.

- New workflow UI: setup-method choice, ChatGPT/Claude connection instructions, native setup/resume, OAuth consent, Personal setup editing, plan/capability presentation, privacy explanation, and useful locked/failure states.
- Targeted refinement: leadership-oriented Home first value; truthful Connections status; useful empty states for Tasks, Capture, Memory, and Career; session-aware shell routing.
- Unchanged existing UI: navigation structure, page shell, colors, typography, core cards, spacing language, responsive shell, clocks, and existing domain modules.

Any broader visual modernization is a separate future workstream.
