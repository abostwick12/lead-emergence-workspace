-- DOMAIN OWNER: Lead Emergence Workspace
-- Local source only. Hosted migration application needs separate Ministry-owned approval.
-- Owner declaration classifies one existing connection; it is not host attestation.
create or replace function workspace.confirm_personal_assistant_connection_host(
  target_connection_id uuid,
  target_assistant text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  connection workspace.mcp_authorizations%rowtype;
  previous_provider text;
  latest_declaration workspace.audit_events%rowtype;
begin
  if caller_id is null or auth.jwt() ->> 'role' is distinct from 'authenticated'
    or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace owner session is required.' using errcode = '42501';
  end if;
  if target_connection_id is distinct from 'ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3'::uuid
    or target_assistant is null or target_assistant not in ('chatgpt', 'other') then
    raise exception 'This action is limited to the approved ChatGPT connection.' using errcode = '22023';
  end if;

  -- Resolve identity on the server and serialize against disconnect/registration.
  select assistant_connection.* into connection
  from workspace.mcp_authorizations as assistant_connection
  where assistant_connection.id = target_connection_id
    and assistant_connection.workspace_id = 'ef17ae83-747b-4470-8dc5-08eeec86989f'::uuid
    and assistant_connection.client_id = '61940a73-fafe-4b96-ab8e-1de7d4cafbac'
    and assistant_connection.created_by = caller_id
  for update;
  if not found or connection.status <> 'connected'
    or not exists (
      select 1 from workspace.workspaces as owned_workspace
      where owned_workspace.id = connection.workspace_id
        and owned_workspace.workspace_type = 'personal'
        and owned_workspace.owner_user_id = caller_id
    ) or not workspace_private.is_workspace_owner(connection.workspace_id)
    or not workspace_private.has_personal_capability(connection.workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(connection.workspace_id, 'workspace_mcp') then
    raise exception 'An active owner connection with Workspace capabilities is required.' using errcode = '42501';
  end if;

  -- Existing authority is a prerequisite. Never create, activate or repair it.
  perform 1 from auth.oauth_clients as client
  where client.id = connection.client_id::uuid and client.deleted_at is null
  for share;
  if not found then
    raise exception 'The existing assistant authorization is unavailable.' using errcode = '42501';
  end if;
  perform 1 from workspace_private.mcp_oauth_resource_grants as resource_grant
  where resource_grant.user_id = caller_id
    and resource_grant.client_id = connection.client_id::uuid
    and resource_grant.resource_uri = 'https://workspace.leademergence.com/api/mcp'
    and resource_grant.status = 'active' and resource_grant.revoked_at is null
  for share;
  if not found then
    raise exception 'The existing assistant authorization is unavailable.' using errcode = '42501';
  end if;
  -- This shared Auth contract is read only. It is not a host-attestation source.
  perform 1 from private.oauth_product_client_bindings as binding
  where binding.client_id = connection.client_id::uuid
    and binding.bound_by_user_id = caller_id
    and binding.contract_key = 'workspace' and binding.product_key = 'workspace'
    and binding.resource_uri = 'https://workspace.leademergence.com/api/mcp'
    and binding.audience_uri = 'https://workspace.leademergence.com/api/mcp'
    and binding.status = 'ACTIVE' and binding.revoked_at is null
  for share;
  if not found then
    raise exception 'The existing assistant authorization is unavailable.' using errcode = '42501';
  end if;

  previous_provider := connection.assistant_provider;
  if target_assistant = 'chatgpt' and previous_provider = 'chatgpt' then
    return jsonb_build_object('connection_id', connection.id, 'workspace_id', connection.workspace_id,
      'client_id', connection.client_id, 'previous_provider', previous_provider,
      'assistant_provider', previous_provider, 'changed', false);
  end if;
  if target_assistant = 'chatgpt' and previous_provider <> 'other' then
    raise exception 'Only an unclassified connection can be confirmed as ChatGPT.' using errcode = '22023';
  end if;
  if target_assistant = 'other' then
    select declaration.* into latest_declaration
    from workspace.audit_events as declaration
    where declaration.workspace_id = connection.workspace_id
      and declaration.actor_user_id = caller_id
      and declaration.entity_type = 'mcp_authorizations'
      and declaration.entity_id = connection.id
      and declaration.event_type in ('assistant_host_confirmed', 'assistant_host_confirmation_withdrawn')
      and declaration.metadata ->> 'source' = 'confirm_personal_assistant_connection_host'
      and declaration.metadata ->> 'client_id' = connection.client_id
    order by declaration.created_at desc, declaration.id desc limit 1;
    if previous_provider <> 'chatgpt' or not found
      or latest_declaration.event_type <> 'assistant_host_confirmed'
      or latest_declaration.metadata ->> 'previous_provider' is distinct from 'other'
      or latest_declaration.metadata ->> 'assistant_provider' is distinct from 'chatgpt'
      or latest_declaration.metadata -> 'connection_boundary' is distinct from jsonb_build_object(
        'connected_at', connection.connected_at, 'disconnected_at', connection.disconnected_at,
        'authorization_valid_after', connection.authorization_valid_after) then
      raise exception 'Only this action''s unchanged ChatGPT confirmation can be withdrawn.' using errcode = '42501';
    end if;
  end if;

  -- The existing updated_at/audit triggers still run; all lifecycle fields stay intact.
  update workspace.mcp_authorizations
  set assistant_provider = target_assistant
  where id = connection.id;
  -- product_events permits owner INSERT and cannot prove RPC provenance.
  -- audit_events has no owner write privilege; generic audit triggers use other types.
  insert into workspace.audit_events (workspace_id, actor_user_id, event_type, entity_type, entity_id, metadata, created_at)
  values (connection.workspace_id, caller_id,
    case when target_assistant = 'chatgpt' then 'assistant_host_confirmed' else 'assistant_host_confirmation_withdrawn' end,
    'mcp_authorizations', connection.id,
    jsonb_build_object('source', 'confirm_personal_assistant_connection_host',
      'client_id', connection.client_id, 'previous_provider', previous_provider,
      'assistant_provider', target_assistant, 'connection_boundary', jsonb_build_object('connected_at', connection.connected_at, 'disconnected_at', connection.disconnected_at, 'authorization_valid_after', connection.authorization_valid_after)), clock_timestamp());
  return jsonb_build_object('connection_id', connection.id, 'workspace_id', connection.workspace_id,
    'client_id', connection.client_id, 'previous_provider', previous_provider,
    'assistant_provider', target_assistant, 'changed', true);
end;
$$;

revoke all on function workspace.confirm_personal_assistant_connection_host(uuid, text) from public, anon, authenticated;
grant execute on function workspace.confirm_personal_assistant_connection_host(uuid, text) to authenticated;
comment on function workspace.confirm_personal_assistant_connection_host(uuid, text) is
  'Explicit owner declaration for the approved existing ChatGPT connection, with protected audit provenance for withdrawal. No host attestation or new OAuth authority.';
