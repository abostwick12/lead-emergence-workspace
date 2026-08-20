# OAuth and secret handling

The source command center stores Google access/refresh tokens in exposed JSONB.
That is not carried forward. `workspace.integration_connections` contains only
provider metadata, connection status, scopes, timestamps, and an opaque secret
reference. It cannot hold access tokens, refresh tokens, client secrets, or raw
OAuth responses.

Default migration is metadata plus `reconnect_required`. A later approved
implementation must use Supabase Vault or Workspace-specific server encryption
outside exposed tables, with no service-role key in normal runtime.
