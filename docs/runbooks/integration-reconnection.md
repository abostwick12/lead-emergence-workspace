# Integration reconnection

Do not copy legacy Google, Slack, Firecrawl, Monday, LinkedIn, or AI secrets.
After cutover, Andrew reconnects each approved provider in Workspace. Record
provider, account label, scopes, secret reference, and verification timestamp.
Revoke the old token only after the new connection succeeds. Keep Slack channel
selection explicit and do not use ministry defaults.

The current productization release does not authorize any external provider
adapter. Catalog presence and migrated metadata are not connection success.
ChatGPT and Claude connect only to the Workspace-native MCP through Supabase
OAuth; they do not receive or reuse Google, Slack, GitHub, or other provider
tokens. Each future connector needs a separate reviewed implementation and plan
capability before this reconnection procedure may be used.
