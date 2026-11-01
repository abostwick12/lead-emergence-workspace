# Legacy Workspace-managed provider connection reference

> **Historical / legacy technical reference only.** This is not the default
> connection setup or recovery procedure for Individual Workspace/SOTF clients.
> The superseded original at [base SHA `90b2ff5e6ede529c544361ad5dd54b6338832673`](https://github.com/abostwick12/lead-emergence-workspace/blob/90b2ff5e6ede529c544361ad5dd54b6338832673/docs/runbooks/integration-reconnection.md)
> is preserved for historical reference and is not setup guidance.

The intended client flow is for the client to connect and manage Gmail, Slack,
Google Calendar, and other supported third-party services in their own ChatGPT
account. This Workspace repository still contains provider catalog, OAuth,
credential-storage, and connection-card code; that source presence does not
establish deployment, activation, or customer use. Do not follow this document
to configure, collect, store, reconnect, or revoke a client's ChatGPT service
credentials.

Connecting ChatGPT to Lead Emergence Workspace is separate. Use the supported
Workspace MCP connection in ChatGPT, the existing Entry sign-in/identity flow,
and the explicit Lead Emergence Workspace OAuth consent. Workspace MCP
authorization does not connect Gmail/Slack/Calendar or establish their health.
See the [canonical connection model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md)
and the scoped [real-client MCP acceptance procedure](real-client-mcp-acceptance.md).

The prior Workspace provider implementation used provider callbacks under
`/api/integrations/<provider>/callback`, owner-scoped credential persistence,
and (for Gmail/Google Calendar) one shared Google OAuth client. Those details
are retained only to identify the legacy source path. Any future Lead
Emergence-owned provider connection requires a separately reviewed exception,
its own authorization, and a task-specific operating procedure.

Security hygiene remains required for all code: never place tokens, raw OAuth
responses, API keys, or client secrets in the Workspace schema, browser
storage, logs, or issue attachments. Normal Workspace runtime must not use a
service-role key.
