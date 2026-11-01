# Legacy Workspace provider OAuth and secret-handling reference

> **Historical / legacy technical reference only.** This describes the former
> Workspace-managed provider-credential architecture, not the default client
> connection flow.
> The superseded original at [base SHA `90b2ff5e6ede529c544361ad5dd54b6338832673`](https://github.com/abostwick12/lead-emergence-workspace/blob/90b2ff5e6ede529c544361ad5dd54b6338832673/docs/security/oauth-secret-handling.md)
> is preserved for historical reference and is not setup guidance.

The intended client flow is for the client to connect and manage supported
third-party services in their own ChatGPT account. The Workspace repository
retains provider OAuth and credential-storage implementation; this file does
not establish that the paths are deployed or active. Do not use this reference
to configure or collect a client's Gmail, Slack, Calendar, or other ChatGPT
service credentials.

For Workspace source-level security review only: the legacy design keeps
provider tokens out of exposed tables and browser state and uses private
server-side credential handling. Any separately approved Lead Emergence-owned
provider integration must have its own reviewed exception and current
provider-specific security contract; this note is not an enablement procedure.
Never place tokens, raw OAuth responses, API keys, or client secrets in the
Workspace schema, browser storage, logs, or issue attachments. Normal Workspace
runtime must not use a service-role key.

The Workspace's own Entry sign-in and OAuth/MCP authorization are first-party
identity/access flows and remain separate from third-party service OAuth. For
current ownership and evidence boundaries, see the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).
