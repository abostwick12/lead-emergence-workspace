-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Give an already authorized assistant the same confirmed ability the
-- native Workspace has to revoke another Workspace assistant connection,
-- without disclosing OAuth client identifiers.

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

create or replace function workspace.mcp_disconnect_assistant_connection(
  target_connection_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('workspace_mcp');
  target_provider text;
  was_disconnected boolean := false;
  updated_connection_count integer := 0;
begin
  if target_connection_id is null then
    raise exception 'An assistant connection identifier is required.' using errcode = '22023';
  end if;

  select assistant_provider into target_provider
  from workspace.mcp_authorizations
  where id = target_connection_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  for update;

  if not found then
    return pg_catalog.jsonb_build_object(
      'connection_id', target_connection_id,
      'disconnected', false,
      'already_absent', true
    );
  end if;

  update workspace.mcp_authorizations
    set status = 'disconnected',
        disconnected_at = now(),
        authorization_valid_after = now(),
        updated_at = now()
    where id = target_connection_id
      and workspace_id = target_workspace_id
      and created_by = auth.uid()
      and status <> 'disconnected';

  get diagnostics updated_connection_count = row_count;
  was_disconnected := updated_connection_count > 0;

  if was_disconnected then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (
      target_workspace_id,
      'mcp_disconnected',
      pg_catalog.jsonb_build_object(
        'interface', 'mcp',
        'self_service', false,
        'assistant_provider', target_provider
      ),
      auth.uid()
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'connection_id', target_connection_id,
    'assistant_provider', target_provider,
    'disconnected', true,
    'already_disconnected', not was_disconnected
  );
end;
$$;

revoke all on function workspace.mcp_list_assistant_connections() from public, anon, authenticated;
revoke all on function workspace.mcp_disconnect_assistant_connection(uuid) from public, anon, authenticated;
grant execute on function workspace.mcp_list_assistant_connections() to authenticated;
grant execute on function workspace.mcp_disconnect_assistant_connection(uuid) to authenticated;
