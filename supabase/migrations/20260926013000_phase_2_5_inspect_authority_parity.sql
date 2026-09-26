create or replace function workspace_private.require_mcp_capability(target_capability text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  if target_capability not in ('core_workspace', 'tasks', 'quick_capture', 'memory', 'career', 'workspace_mcp') then
    raise exception 'The requested Workspace capability is not supported.' using errcode = '22023';
  end if;
  if not workspace_private.has_personal_capability(target_workspace_id, target_capability) then
    raise exception 'This Workspace capability is not included for the current Personal plan.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

revoke all on function workspace_private.require_mcp_capability(text) from public, anon, authenticated;

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
        'granted_scopes', assistant_connection.granted_scopes,
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
