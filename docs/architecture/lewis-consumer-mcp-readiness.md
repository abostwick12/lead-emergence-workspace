# Lewis consumer MCP readiness

## Product promise

Lewis should give a user the same **policy-controlled Workspace control**
available in the native product. It must not expose a general database, a
service-role client, OAuth credentials, or unbounded external side effects to
ChatGPT or Claude.

The distinction matters: native Workspace parity means an assistant can use a
small, reviewed action contract for the user's own Workspace records. It does
not mean an assistant receives unrestricted access to every table, every
provider token, or every third-party account.

## Source capability inventory

The source candidate currently supports these Workspace-scoped Lewis actions:

| Surface | Read | Controlled change |
| --- | --- | --- |
| Onboarding and configuration | Onboarding state and configuration | Save reported setup, propose/confirm configuration, complete onboarding, replace confirmed configuration |
| Tasks | List tasks and leadership state | Create, update, delete tasks |
| Quick Capture | List captures | Capture a signal, resolve a capture into a task, discard a capture |
| Personal memory | List memory | Create and delete memory |
| Career pipeline | List opportunities | Create opportunities and change status |
| Display clocks | Read the three display-clock zones | Replace three valid, distinct IANA display-clock zones |
| Assistant access | List connection state with opaque connection handles, never client identifiers | Disconnect the current assistant or a separately listed assistant after confirmation |
| Integration state | Read connection metadata and scopes only | Native Workspace can connect or disconnect an approved provider; Lewis cannot activate or operate external providers |

Every write requires an explicit tool-level confirmation. Create and replace
operations use a private idempotency receipt. Delete, discard, replacement,
and assistant-access revocation are marked destructive so clients can require an extra
approval step.

## Current connector boundary

External connectors are deliberately **off by default**. A new external
connection requires all of the following:

1. The user is in a direct, owner-authenticated Workspace session.
2. `external_connectors` is enabled for the active Personal plan.
3. The plan has a positive `integration_limit`.
4. The provider and credential family match the reviewed allowlist.
5. The slot is available after accounting for active credentials and OAuth
   attempts.

The private credential and OAuth-attempt tables use RLS as defense in depth
and have no direct client-table access. Disconnecting removes the private
Workspace credential, clears every linked connection record, and invalidates
an in-flight OAuth completion before it can recreate the credential. A provider
grant may still need revocation at the provider until a provider-specific
remote-revocation adapter is approved.

ChatGPT and Claude are Workspace OAuth interfaces, not API-key integrations.
Their catalog entries use `mcp_oauth`; the generic provider credential endpoint
rejects them.

### Provider-release control

An external provider catalog card is not an entitlement to collect its
credential. Every external provider begins in a private `catalog_only` release
state, and the application has a matching `consumerConnectionReady: false`
gate. Both the UI/API route and the database RPC must be explicitly enabled in
a reviewed provider release before OAuth can begin or a credential can be
saved. A valid Personal plan by itself is deliberately insufficient.

The current catalog is therefore honest about what works: it can describe
planned providers, but it cannot ask a consumer for Gmail, Slack, Calendar,
Drive, GitHub, Microsoft 365, Canva, LinkedIn, YouVersion, Monday, or
Firecrawl credentials yet. This avoids collecting broad third-party access
that has no tested user value. The retained scope definitions are read-only
where a future read path is envisioned; send, event-write, and file-write
scopes are absent until their individual action release.

## Consumer-production risks and release gates

| Gate | Why it is a consumer risk | Required evidence before release |
| --- | --- | --- |
| Production identity authority | Promoting an identity-bearing development project can carry stale users, sessions, grants, and provider configuration into consumer production. | A dedicated clean Entry production project is preferred. Any promotion requires an approved identity inventory, retention/deletion decision, session and OAuth-key rotation plan, and rollback proof. |
| Shared Auth and canonical domains | A mismatched Site URL, OAuth consent origin, custom provider, or access-token hook causes broken or misbound assistant authorization. | Correct canonical Workspace domain, Entry provider, hook, redirect allowlist, OAuth metadata, and verified JWT audience/client binding. |
| Workspace runtime ownership | A production MCP endpoint can only be secure if the Workspace-owned deployment has the matching environment and public metadata. | Workspace-owned Vercel project access, production environment review, protected-resource metadata check, headers/CORS check, and rollback deployment. |
| ChatGPT and Claude acceptance | OAuth metadata passing a protocol check does not prove the client can connect, refresh, reauthorize, and enforce revocation. | Real interactive acceptance for both clients: connect, read, confirmed write, natural refresh, disconnect, old-token denial, reconnect, and client-side revocation. |
| Client-market fit | ChatGPT does not currently offer the same custom-MCP write path to every consumer tier, and client features can change independently of Workspace. | Publish a truthful availability matrix by client and plan; retain native Workspace as the universal write path. Do not claim ChatGPT write parity where the client itself cannot invoke custom write tools. |
| Provider connectors | OAuth consent alone does not make an external integration safe to use. Current source has no approved provider action adapters, refresh workers, remote revocation, or side-effect audit trail. | Per-provider scope review, action allowlist, user-confirmation UX, idempotency model, outbound audit log, retries, token refresh/revocation, incident playbook, and provider acceptance test. |
| Calendar, mail, and messaging writes | A broad scope or automatic action could create appointments, send mail, or post messages without a sufficiently clear human decision. | Separate, narrowly scoped action tools. For example, Google Calendar event creation needs a write scope and an explicit create-event confirmation; it must not be inferred from the current read-only calendar connection. |
| Abuse and operability | A public MCP endpoint is exposed to retries, malformed client behavior, token churn, and future client capability changes. | Per-user/client rate limits, tool/action audit events, anomaly alerts, cost limits, durable logs without private content, tested incident response, backups, and a kill switch. |

## Client-specific posture

- ChatGPT: use the documented custom-app/MCP flow only where the user's
  ChatGPT tier and mode can invoke write tools. Keep a clear native Workspace
  path for everyone else; do not weaken confirmation or OAuth controls to work
  around a client limitation.
- Claude: use a remote custom connector with explicit user or organization
  approval. Write tools must remain confirmation-gated and should be excluded
  from research-style flows that may invoke connectors automatically.
- Both: the public consent screen must accurately describe the internal
  Workspace action set and must not imply that approval connects an external
  provider or authorizes calendar, email, or messaging actions.

## Cutover order

1. Establish the clean, shared production identity and Workspace runtime
   foundation on the partner account's `lead-emergence-entry-dev` project.
2. Apply reviewed Workspace source migrations through the designated shared
   migration authority, with preflight, postflight, and rollback evidence.
3. Configure Auth, canonical domains, public metadata, and runtime environment
   together; do not split the audience/consent change across unrelated hosts.
4. Run the real-client lifecycle matrix for ChatGPT and Claude.
5. Release the internal Workspace action contract behind monitoring and a kill
   switch.
6. Add external providers one at a time, starting with read-only or draft-only
   actions. Treat each provider write action as a separate product and security
   release.

## Current status

This repository has source and local-test evidence only. The selected Entry
project currently has no deployed Edge Functions or project secrets, and the
accessible Vercel team has no Workspace project. It is not authorization to
apply these migrations to a hosted project, change Auth configuration, deploy a
public runtime, activate external connectors, or represent any task as saved by
ChatGPT or Claude.

For the current platform behavior and acceptance requirements, see the
[OpenAI developer-mode and MCP guidance](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt),
[Claude remote connector guidance](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
and [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).
