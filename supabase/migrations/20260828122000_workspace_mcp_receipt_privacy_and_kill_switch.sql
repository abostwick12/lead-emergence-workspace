-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Remove content copies from idempotency receipts and provide a
-- fail-closed operational MCP switch. Neither control deletes tenant data,
-- OAuth grants, users, Workspaces, or integrations.

insert into workspace_private.product_settings (setting_key, setting_value)
values ('mcp_execution_enabled', 'true')
on conflict (setting_key) do nothing;

create or replace function workspace_private.is_mcp_execution_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select setting_value = 'true'
    from workspace_private.product_settings
    where setting_key = 'mcp_execution_enabled'
  ), false);
$$;

create or replace function workspace_private.require_mcp_execution_enabled()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not workspace_private.is_mcp_execution_enabled() then
    raise exception 'Workspace MCP is temporarily disabled by the operator.' using errcode = '42501';
  end if;
end;
$$;

create or replace function workspace_private.set_mcp_execution_enabled(
  enabled boolean,
  reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted server identity is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) not between 5 and 500 then
    raise exception 'A concise operational reason is required.' using errcode = '22023';
  end if;
  update workspace_private.product_settings
  set setting_value = case when enabled then 'true' else 'false' end,
      updated_at = now()
  where setting_key = 'mcp_execution_enabled';
end;
$$;

alter table workspace_private.mcp_action_receipts
  add column if not exists request_hash text,
  add column if not exists affected_record_id uuid,
  add column if not exists result_kind text;

alter table workspace_private.mcp_action_receipts
  add constraint mcp_action_receipts_request_hash_format
  check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$') not valid;

-- Old receipt rows can expire naturally. New writers use hashes and canonical
-- record references, so private action bodies and result bodies are not copied.
alter table workspace_private.mcp_action_receipts
  alter column request_payload drop not null;

comment on column workspace_private.mcp_action_receipts.request_hash is
  'SHA-256 of normalized action inputs. Used for idempotency conflict detection; never stores action content.';
comment on column workspace_private.mcp_action_receipts.affected_record_id is
  'Canonical tenant record affected by a successful idempotent operation.';
comment on column workspace_private.mcp_action_receipts.result_kind is
  'Safe normalized outcome category, not a serialized tool result.';

create or replace function workspace_private.begin_mcp_action_receipt(
  p_workspace_id uuid,
  p_client_id text,
  p_operation_name text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_hash text;
  existing_outcome text;
  existing_record_id uuid;
begin
  if p_client_id is null or char_length(p_client_id) not between 1 and 500
    or p_operation_name is null or p_idempotency_key is null
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid MCP action receipt identity is required.' using errcode = '22023';
  end if;

  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_hash, outcome, expires_at
  ) values (
    p_workspace_id, p_client_id, p_operation_name, p_idempotency_key, p_request_hash, 'pending', now() + interval '30 days'
  ) on conflict do nothing;

  if found then return pg_catalog.jsonb_build_object('replay', false); end if;

  select request_hash, outcome, affected_record_id
    into existing_hash, existing_outcome, existing_record_id
  from workspace_private.mcp_action_receipts
  where workspace_id = p_workspace_id
    and client_id = p_client_id
    and operation_name = p_operation_name
    and idempotency_key = p_idempotency_key;

  if existing_hash is distinct from p_request_hash then
    raise exception 'Reuse an MCP request identifier only with the same action details.' using errcode = '22023';
  end if;
  if existing_outcome <> 'succeeded' or existing_record_id is null then
    raise exception 'The earlier MCP action did not complete safely. Use a new request identifier.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('replay', true, 'affected_record_id', existing_record_id);
end;
$$;

create or replace function workspace_private.complete_mcp_action_receipt(
  p_workspace_id uuid,
  p_client_id text,
  p_operation_name text,
  p_idempotency_key uuid,
  p_affected_record_id uuid,
  p_result_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_affected_record_id is null or p_result_kind !~ '^[a-z_]{3,80}$' then
    raise exception 'A safe MCP action result reference is required.' using errcode = '22023';
  end if;
  update workspace_private.mcp_action_receipts
  set request_payload = null,
      result = null,
      affected_record_id = p_affected_record_id,
      result_kind = p_result_kind,
      outcome = 'succeeded',
      completed_at = now()
  where workspace_id = p_workspace_id
    and client_id = p_client_id
    and operation_name = p_operation_name
    and idempotency_key = p_idempotency_key;
  if not found then
    raise exception 'MCP action receipt was not found.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function workspace_private.is_mcp_execution_enabled() from public, anon, authenticated;
revoke all on function workspace_private.require_mcp_execution_enabled() from public, anon, authenticated;
revoke all on function workspace_private.set_mcp_execution_enabled(boolean, text) from public, anon, authenticated;
revoke all on function workspace_private.begin_mcp_action_receipt(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function workspace_private.complete_mcp_action_receipt(uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function workspace_private.is_mcp_execution_enabled() to authenticated;
grant execute on function workspace_private.require_mcp_execution_enabled() to authenticated;
grant execute on function workspace_private.begin_mcp_action_receipt(uuid, text, text, uuid, text) to authenticated;
grant execute on function workspace_private.complete_mcp_action_receipt(uuid, text, text, uuid, uuid, text) to authenticated;
grant execute on function workspace_private.set_mcp_execution_enabled(boolean, text) to service_role;

-- Recreate the admission helpers to make every controlled MCP RPC fail closed
-- when the switch is disabled. Product data and OAuth rows remain intact.
create or replace function workspace_private.is_valid_mcp_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.is_mcp_execution_enabled()
    and auth.uid() is not null
    and nullif(auth.jwt() ->> 'client_id', '') is not null
    and coalesce(auth.jwt() ->> 'workspace_mcp', 'false') = 'true'
    and auth.jwt() ->> 'aud' = (
      select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'
    );
$$;

create or replace function workspace_private.require_mcp_workspace()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  token_client_id text := auth.jwt() ->> 'client_id';
  token_issued_at timestamptz := pg_catalog.to_timestamp((auth.jwt() ->> 'iat')::double precision);
  connection_status text;
  valid_after timestamptz;
begin
  perform workspace_private.require_mcp_execution_enabled();
  if not workspace_private.is_valid_mcp_request() then
    raise exception 'The MCP authorization is invalid or has the wrong audience.' using errcode = '42501';
  end if;
  select workspace_record.id into target_workspace_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.workspace_type = 'personal'
    and workspace_record.owner_user_id = auth.uid()
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if target_workspace_id is null
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp') then
    raise exception 'The AI assistant connection is not included for this Workspace.' using errcode = '42501';
  end if;
  select status, authorization_valid_after into connection_status, valid_after
  from workspace.mcp_authorizations
  where workspace_id = target_workspace_id and client_id = token_client_id;
  if connection_status is distinct from 'connected'
    or token_issued_at is null
    or (valid_after is not null and token_issued_at < valid_after) then
    raise exception 'This AI assistant connection is disconnected or requires authorization.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.mcp_register_connection()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  token_client_id text := auth.jwt() ->> 'client_id';
  token_issued_at timestamptz := pg_catalog.to_timestamp((auth.jwt() ->> 'iat')::double precision);
  selected_provider text;
  existing_status text;
  previous_disconnected_at timestamptz;
  previous_valid_after timestamptz;
begin
  perform workspace_private.require_mcp_execution_enabled();
  if not workspace_private.is_valid_mcp_request() then
    raise exception 'The MCP authorization is invalid or has the wrong audience.' using errcode = '42501';
  end if;
  select workspace_record.id, coalesce(onboarding.selected_assistant, 'other')
    into target_workspace_id, selected_provider
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  left join workspace.personal_onboarding as onboarding on onboarding.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if target_workspace_id is null
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp') then
    raise exception 'The AI assistant connection is not included for this Workspace.' using errcode = '42501';
  end if;
  if token_issued_at is null then
    raise exception 'The MCP authorization is missing its issuance time.' using errcode = '42501';
  end if;
  select status, disconnected_at, authorization_valid_after
    into existing_status, previous_disconnected_at, previous_valid_after
  from workspace.mcp_authorizations
  where workspace_id = target_workspace_id and client_id = token_client_id;
  if existing_status in ('disabled', 'not_included')
    or (existing_status = 'disconnected' and (previous_disconnected_at is null or token_issued_at <= previous_disconnected_at))
    or (existing_status = 'connected' and previous_valid_after is not null and token_issued_at < previous_valid_after) then
    raise exception 'This AI assistant connection was disconnected.' using errcode = '42501';
  end if;
  insert into workspace.mcp_authorizations (
    workspace_id, client_id, assistant_provider, status, connected_at, authorization_valid_after, last_verified_at, created_by
  ) values (
    target_workspace_id, token_client_id, selected_provider, 'connected', now(), token_issued_at, now(), auth.uid()
  ) on conflict (workspace_id, client_id) do update set
    status = 'connected', connected_at = now(), disconnected_at = null,
    authorization_valid_after = token_issued_at,
    last_verified_at = now(), last_error_code = null, updated_at = now();
  update workspace.personal_onboarding set
    state = case when state in ('onboarding_complete', 'workspace_ready') then state else 'mcp_connected' end,
    setup_method = coalesce(setup_method, 'ai'),
    started_at = coalesce(started_at, now()),
    last_resumed_at = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();
  if existing_status is null then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (target_workspace_id, 'mcp_connected', pg_catalog.jsonb_build_object('assistant', selected_provider), auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'status', 'connected', 'assistant', selected_provider);
end;
$$;