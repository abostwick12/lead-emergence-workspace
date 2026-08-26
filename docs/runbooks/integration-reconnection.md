# Integration reconnection

Do not copy legacy Google, Slack, Firecrawl, Monday, LinkedIn, or AI secrets.
After cutover, each approved provider is reconnected through its Workspace
connection card. OAuth providers open provider consent with PKCE; GitHub opens
its repository-scoped App installation; API-key providers use one password
field and immediately encrypt the submitted value.

The application stores only connection metadata in `workspace.integration_connections`.
The encrypted credential ciphertext is private, not exposed through the Data API,
and is written only by the owner-scoped `workspace.save_integration_connection`
bridge. Never add tokens, raw OAuth responses, API keys, or client secrets to
the Workspace schema, browser storage, logs, or issue attachments.

Before enabling a provider in a hosted environment, register its redirect URI
`/api/integrations/<provider>/callback`, set the required server-only OAuth
client credentials plus the Workspace encryption/state secrets, and complete
the approved hosted migration gate. Revoke the old token only after the new
connection succeeds. Keep Slack channel selection explicit and do not use
ministry defaults.
