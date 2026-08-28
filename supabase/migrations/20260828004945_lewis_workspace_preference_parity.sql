-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Complete narrow Lewis parity for native Workspace preferences and
-- assistant connection controls without exposing profile or authorization tables.
--
-- This is source-only until the recorded production Workspace/MCP cutover gate
-- is approved and applied through the shared-project authority.

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

create or replace function workspace.mcp_get_clock_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('core_workspace');
  saved_clock_timezones text[];
begin
  select profile.clock_timezones into saved_clock_timezones
  from workspace.user_profiles as profile
  where profile.user_id = auth.uid();

  if saved_clock_timezones is null then
    raise exception 'Personal clock preferences are not available.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'clock_timezones', saved_clock_timezones
  );
end;
$$;

create or replace function workspace.mcp_save_clock_preferences(target_clock_timezones text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('core_workspace');
  normalized_clock_timezones text[];
  saved_clock_timezones text[];
begin
  if cardinality(target_clock_timezones) is distinct from 3
    or array_position(target_clock_timezones, null) is not null then
    raise exception 'Choose exactly three supported IANA time zones.' using errcode = '22023';
  end if;

  select array_agg(trim(requested.time_zone) order by requested.ordinal)
    into normalized_clock_timezones
  from unnest(target_clock_timezones) with ordinality as requested(time_zone, ordinal);

  if (select count(distinct time_zone) from unnest(normalized_clock_timezones) as requested(time_zone)) <> 3
    or exists (
      select 1
      from unnest(normalized_clock_timezones) as requested(time_zone)
      where requested.time_zone = ''
        or not exists (
          select 1
          from pg_catalog.pg_timezone_names as supported_time_zone
          where supported_time_zone.name = requested.time_zone
        )
    ) then
    raise exception 'Choose exactly three supported IANA time zones.' using errcode = '22023';
  end if;

  update workspace.user_profiles
    set clock_timezones = normalized_clock_timezones,
        updated_at = now()
    where user_id = auth.uid()
    returning clock_timezones into saved_clock_timezones;

  if not found then
    raise exception 'Personal clock preferences are not available.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'clock_timezones', saved_clock_timezones
  );
end;
$$;

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

create or replace function workspace.mcp_disconnect_current_assistant()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('workspace_mcp');
  current_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  was_disconnected boolean := false;
  updated_connection_count integer := 0;
begin
  if current_client_id is null then
    raise exception 'This assistant connection is missing its registered client identity.' using errcode = '42501';
  end if;

  update workspace.mcp_authorizations
    set status = 'disconnected',
        disconnected_at = now(),
        authorization_valid_after = now(),
        updated_at = now()
    where workspace_id = target_workspace_id
      and created_by = auth.uid()
      and client_id = current_client_id
      and status <> 'disconnected';

  get diagnostics updated_connection_count = row_count;
  was_disconnected := updated_connection_count > 0;

  if was_disconnected then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (
      target_workspace_id,
      'mcp_disconnected',
      pg_catalog.jsonb_build_object('interface', 'mcp', 'self_service', true),
      auth.uid()
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'disconnected', true,
    'already_disconnected', not was_disconnected
  );
end;
$$;

revoke all on function workspace.mcp_get_clock_preferences() from public, anon, authenticated;
revoke all on function workspace.mcp_save_clock_preferences(text[]) from public, anon, authenticated;
revoke all on function workspace.mcp_list_assistant_connections() from public, anon, authenticated;
revoke all on function workspace.mcp_disconnect_current_assistant() from public, anon, authenticated;
grant execute on function workspace.mcp_get_clock_preferences() to authenticated;
grant execute on function workspace.mcp_save_clock_preferences(text[]) to authenticated;
grant execute on function workspace.mcp_list_assistant_connections() to authenticated;
grant execute on function workspace.mcp_disconnect_current_assistant() to authenticated;
