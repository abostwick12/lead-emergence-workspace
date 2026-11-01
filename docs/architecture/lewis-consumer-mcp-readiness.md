# Lewis consumer MCP readiness

For current connection ownership, authorization, entitlement, and health
evidence, follow the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).

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
| Integration state | Read only explicitly recorded Workspace-owned legacy metadata | Lewis does not manage, reconnect, revoke, or report the health of third-party services connected in the client's ChatGPT account |

Every write requires an explicit tool-level confirmation. Create and replace
operations use a private idempotency receipt. Delete, discard, replacement,
and assistant-access revocation are marked destructive so clients can require an extra
approval step.

## Connection ownership

The client's ChatGPT account manages third-party Gmail, Slack, Calendar, and
other supported service connections. Lewis and the Workspace UI must not
collect those credentials or claim to know their live health from a Workspace
record. Lead Emergence separately authenticates the client to its own Workspace
resource through the Entry sign-in and Workspace OAuth/MCP flow. That grant
does not authorize a third-party service and is not subscription evidence.

ChatGPT and Claude are Workspace OAuth interfaces, not API-key integrations.
Their catalog entries use `mcp_oauth`; the generic provider credential endpoint
rejects them.

### Historical Workspace provider-release controls

The superseded provider catalog and readiness details at [base SHA `90b2ff5e6ede529c544361ad5dd54b6338832673`](https://github.com/abostwick12/lead-emergence-workspace/blob/90b2ff5e6ede529c544361ad5dd54b6338832673/docs/architecture/lewis-consumer-mcp-readiness.md)
are preserved for historical reference only, not as current ownership or setup
guidance.

The source contains a provider catalog, private credential/OAuth-attempt
storage, and `consumerConnectionReady` release gates. These are **historical /
legacy technical references**, not the default connection path for Individual
Workspace/SOTF clients. Keep unreleased native provider adapters disabled; do
not treat a `catalog_only` item, provider readiness flag, or Personal plan as
proof of a host connection or its health. A future direct-integration exception
requires its own reviewed architecture and implementation authorization.

The source's provider scopes and consumer-readiness flags describe this legacy
implementation only; they do not alter client-owned ChatGPT connection setup.

## Consumer-production risks and release gates

| Gate | Why it is a consumer risk | Required evidence before release |
| --- | --- | --- |
| Production identity authority | Promoting an identity-bearing development project can carry stale users, sessions, grants, and provider configuration into consumer production. | A dedicated clean Entry production project is preferred. Any promotion requires an approved identity inventory, retention/deletion decision, session and OAuth-key rotation plan, and rollback proof. |
| Shared Auth and canonical domains | A mismatched Site URL, OAuth consent origin, custom provider, or access-token hook causes broken or misbound assistant authorization. | Correct canonical Workspace domain, Entry provider, hook, redirect allowlist, OAuth metadata, and verified JWT audience/client binding. |
| Workspace runtime ownership | A production MCP endpoint can only be secure if the Workspace-owned deployment has the matching environment and public metadata. | Workspace-owned Vercel project access, production environment review, protected-resource metadata check, headers/CORS check, and rollback deployment. |
| ChatGPT and Claude acceptance | OAuth metadata passing a protocol check does not prove the client can connect, refresh, reauthorize, and enforce revocation. | Real interactive acceptance for both clients: connect, read, confirmed write, natural refresh, disconnect, old-token denial, reconnect, and client-side revocation. |
| Client-market fit | ChatGPT does not currently offer the same custom-MCP write path to every consumer tier, and client features can change independently of Workspace. | Publish a truthful availability matrix by client and plan; retain native Workspace as the universal write path. Do not claim ChatGPT write parity where the client itself cannot invoke custom write tools. |
| Host-owned provider connections | A workflow may depend on a service connected in the client's ChatGPT account; Workspace may not have an authoritative health API for it. | Verify only a supported, account-bound host observation or bounded authorized operation; otherwise show the service state as unknown and direct the client to ChatGPT connection settings. A future transfer of credential ownership requires a separate approved exception. |
| Calendar, mail, and messaging writes | A broad scope or automatic action could create appointments, send mail, or post messages without a sufficiently clear human decision. | Separate, narrowly scoped action tools. For example, Google Calendar event creation needs a write scope and an explicit create-event confirmation; it must not be inferred from the current read-only calendar connection. |
| Abuse and operability | A public MCP endpoint is exposed to retries, malformed client behavior, token churn, and future client capability changes. | Per-user/client rate limits, tool/action audit events, anomaly alerts, cost limits, durable logs without private content, tested incident response, backups, and a kill switch. |

## Client-specific posture

- ChatGPT: use the documented custom-app/MCP flow only where the user's
  ChatGPT tier and mode can invoke write tools. Keep a clear native Workspace
  path for everyone else; do not weaken confirmation or OAuth controls to work
  around a client limitation.
- Third-party apps such as Gmail, Slack, and Calendar: the client connects and
  manages them in their own ChatGPT account. This is separate from connecting
  that ChatGPT account to Lead Emergence Workspace.
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
6. Validate the host-owned third-party service connections required by each
   workflow through the supported client experience. A Lead Emergence-owned
   provider integration is outside the default release and requires a separate
   reviewed exception.

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
