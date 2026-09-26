create or replace function workspace.mcp_list_assistant_connections()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('workspace_mcp');
  current_client_id text := nullif(auth.jwt() ->> 'client_id', '');
begin
  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'connections', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'connection_id', assistant_connection.id,
        'assistant_provider', assistant_connection.assistant_provider,
        'status', assistant_connection.status,
        'granted_scopes', case
          when assistant_connection.client_id = current_client_id then (
            select grant_record.granted_scopes
            from workspace_private.mcp_oauth_resource_grants as grant_record
            where grant_record.user_id = auth.uid()
              and grant_record.client_id::text = assistant_connection.client_id
              and grant_record.resource_uri = 'https://workspace.leademergence.com/api/mcp'
              and grant_record.status = 'active'
          )
          else assistant_connection.granted_scopes
        end,
        'connected_at', assistant_connection.connected_at,
        'disconnected_at', assistant_connection.disconnected_at,
        'last_verified_at', assistant_connection.last_verified_at,
        'last_error_code', assistant_connection.last_error_code,
        'is_current_connection', assistant_connection.client_id = current_client_id
      ) order by assistant_connection.updated_at desc)
      from workspace.mcp_authorizations as assistant_connection
      where assistant_connection.workspace_id = target_workspace_id
        and assistant_connection.created_by = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function workspace.mcp_list_assistant_connections() from public, anon, authenticated;
grant execute on function workspace.mcp_list_assistant_connections() to authenticated;
