-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Extend Lewis with the same controlled internal Workspace actions
-- available in the native product. These narrow RPCs preserve tenant, plan,
-- OAuth-client, and audit boundaries instead of exposing Workspace tables.

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
  if target_capability not in ('core_workspace', 'tasks', 'quick_capture', 'memory', 'career') then
    raise exception 'The requested Workspace capability is not supported.' using errcode = '22023';
  end if;
  if not workspace_private.has_personal_capability(target_workspace_id, target_capability) then
    raise exception 'This Workspace capability is not included for the current Personal plan.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

alter table workspace_private.mcp_action_receipts
  drop constraint if exists mcp_action_receipts_operation_name_check;

alter table workspace_private.mcp_action_receipts
  add constraint mcp_action_receipts_operation_name_check
  check (operation_name in (
    'create_task',
    'resolve_capture',
    'create_memory',
    'create_career_opportunity',
    'replace_workspace_configuration'
  ));

create or replace function workspace.mcp_list_captures(
  target_status text default null,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
begin
  if page_size is null or page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if target_status is not null and target_status not in ('unprocessed', 'processed', 'discarded') then
    raise exception 'Capture status is not supported.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'captures', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', capture.id,
        'raw_text', capture.raw_text,
        'status', capture.status,
        'routed_task_id', capture.routed_task_id,
        'created_at', capture.created_at,
        'updated_at', capture.updated_at
      ) order by capture.created_at desc, capture.id desc)
      from (
        select *
        from workspace.capture_inbox
        where workspace_id = target_workspace_id
          and created_by = auth.uid()
          and (target_status is null or status = target_status)
        order by created_at desc, id desc
        limit page_size
      ) as capture
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_resolve_capture(
  target_capture_id uuid,
  request_id uuid,
  task_domain text default 'general'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_domain text := coalesce(nullif(trim(task_domain), ''), 'general');
  expected_payload jsonb;
  existing_payload jsonb;
  existing_result jsonb;
  selected_capture workspace.capture_inbox%rowtype;
  created_task workspace.tasks%rowtype;
  created_result jsonb;
begin
  if not workspace_private.has_personal_capability(target_workspace_id, 'tasks') then
    raise exception 'Task actions are not included for this Workspace.' using errcode = '42501';
  end if;
  if target_capture_id is null or request_id is null then
    raise exception 'A capture identifier and request identifier are required.' using errcode = '22023';
  end if;
  if effective_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Task domain is not supported.' using errcode = '22023';
  end if;

  expected_payload := pg_catalog.jsonb_build_object('capture_id', target_capture_id, 'domain', effective_domain);
  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_payload
  ) values (
    target_workspace_id, token_client_id, 'resolve_capture', request_id, expected_payload
  ) on conflict do nothing;

  if not found then
    select request_payload, result into existing_payload, existing_result
    from workspace_private.mcp_action_receipts
    where workspace_id = target_workspace_id
      and client_id = token_client_id
      and operation_name = 'resolve_capture'
      and idempotency_key = request_id;
    if existing_payload is distinct from expected_payload then
      raise exception 'Reuse a capture request identifier only with the same capture details.' using errcode = '22023';
    end if;
    return coalesce(existing_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  select * into selected_capture
  from workspace.capture_inbox
  where id = target_capture_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  for update;
  if not found then
    raise exception 'Capture not found for this Workspace.' using errcode = '22023';
  end if;
  if selected_capture.status <> 'unprocessed' then
    raise exception 'Capture is no longer available for task routing.' using errcode = '22023';
  end if;

  insert into workspace.tasks (
    workspace_id, domain, title, priority, created_by
  ) values (
    target_workspace_id, effective_domain, selected_capture.raw_text, 'medium', auth.uid()
  ) returning * into created_task;

  update workspace.capture_inbox
  set status = 'processed', routed_task_id = created_task.id, updated_at = now()
  where id = selected_capture.id and workspace_id = target_workspace_id;

  created_result := pg_catalog.jsonb_build_object(
    'capture', pg_catalog.jsonb_build_object(
      'id', selected_capture.id,
      'status', 'processed',
      'routed_task_id', created_task.id
    ),
    'task', pg_catalog.jsonb_build_object(
      'id', created_task.id,
      'domain', created_task.domain,
      'title', created_task.title,
      'status', created_task.status,
      'priority', created_task.priority,
      'due_date', created_task.due_date,
      'created_at', created_task.created_at,
      'updated_at', created_task.updated_at
    ),
    'created', true,
    'idempotent_replay', false
  );

  update workspace_private.mcp_action_receipts set result = created_result
  where workspace_id = target_workspace_id
    and client_id = token_client_id
    and operation_name = 'resolve_capture'
    and idempotency_key = request_id;

  return created_result;
end;
$$;

create or replace function workspace.mcp_dismiss_capture(target_capture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
  previous_status text;
begin
  if target_capture_id is null then
    raise exception 'A capture identifier is required.' using errcode = '22023';
  end if;

  select status into previous_status
  from workspace.capture_inbox
  where id = target_capture_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('id', target_capture_id, 'dismissed', false, 'already_absent', true);
  end if;
  if previous_status <> 'unprocessed' then
    return pg_catalog.jsonb_build_object('id', target_capture_id, 'dismissed', false, 'already_unavailable', true);
  end if;

  update workspace.capture_inbox
  set status = 'discarded', updated_at = now()
  where id = target_capture_id and workspace_id = target_workspace_id;
  return pg_catalog.jsonb_build_object('id', target_capture_id, 'dismissed', true, 'already_absent', false);
end;
$$;

create or replace function workspace.mcp_list_memory(
  target_domain text default null,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
begin
  if page_size is null or page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if target_domain is not null and target_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Memory domain is not supported.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'memory', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', memory.id,
        'memory_type', memory.memory_type,
        'content', memory.content,
        'domain', memory.domain,
        'created_at', memory.created_at,
        'updated_at', memory.updated_at
      ) order by memory.created_at desc, memory.id desc)
      from (
        select *
        from workspace.memory_entries
        where workspace_id = target_workspace_id
          and created_by = auth.uid()
          and (target_domain is null or domain = target_domain)
        order by created_at desc, id desc
        limit page_size
      ) as memory
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_create_memory(
  memory_content text,
  request_id uuid,
  target_memory_type text default 'context',
  target_domain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_content text := nullif(trim(memory_content), '');
  effective_memory_type text := coalesce(nullif(trim(target_memory_type), ''), 'context');
  effective_domain text := nullif(trim(target_domain), '');
  expected_payload jsonb;
  existing_payload jsonb;
  existing_result jsonb;
  created_memory workspace.memory_entries%rowtype;
  created_result jsonb;
begin
  if request_id is null then
    raise exception 'A request identifier is required for memory creation.' using errcode = '22023';
  end if;
  if effective_content is null or char_length(effective_content) not between 1 and 10000 then
    raise exception 'Memory content must be between 1 and 10000 characters.' using errcode = '22023';
  end if;
  if effective_memory_type not in ('fact', 'preference', 'context', 'relationship') then
    raise exception 'Memory type is not supported.' using errcode = '22023';
  end if;
  if effective_domain is not null and effective_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Memory domain is not supported.' using errcode = '22023';
  end if;

  expected_payload := pg_catalog.jsonb_build_object(
    'content', effective_content,
    'memory_type', effective_memory_type,
    'domain', effective_domain
  );
  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_payload
  ) values (
    target_workspace_id, token_client_id, 'create_memory', request_id, expected_payload
  ) on conflict do nothing;

  if not found then
    select request_payload, result into existing_payload, existing_result
    from workspace_private.mcp_action_receipts
    where workspace_id = target_workspace_id
      and client_id = token_client_id
      and operation_name = 'create_memory'
      and idempotency_key = request_id;
    if existing_payload is distinct from expected_payload then
      raise exception 'Reuse a memory request identifier only with the same memory details.' using errcode = '22023';
    end if;
    return coalesce(existing_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  insert into workspace.memory_entries (
    workspace_id, memory_type, content, domain, created_by
  ) values (
    target_workspace_id, effective_memory_type, effective_content, effective_domain, auth.uid()
  ) returning * into created_memory;

  created_result := pg_catalog.jsonb_build_object(
    'memory', pg_catalog.jsonb_build_object(
      'id', created_memory.id,
      'memory_type', created_memory.memory_type,
      'content', created_memory.content,
      'domain', created_memory.domain,
      'created_at', created_memory.created_at,
      'updated_at', created_memory.updated_at
    ),
    'created', true,
    'idempotent_replay', false
  );
  update workspace_private.mcp_action_receipts set result = created_result
  where workspace_id = target_workspace_id
    and client_id = token_client_id
    and operation_name = 'create_memory'
    and idempotency_key = request_id;
  return created_result;
end;
$$;

create or replace function workspace.mcp_delete_memory(target_memory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
  deleted_memory_id uuid;
begin
  if target_memory_id is null then
    raise exception 'A memory identifier is required.' using errcode = '22023';
  end if;
  delete from workspace.memory_entries
  where id = target_memory_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  returning id into deleted_memory_id;
  return pg_catalog.jsonb_build_object(
    'id', target_memory_id,
    'deleted', deleted_memory_id is not null,
    'already_absent', deleted_memory_id is null
  );
end;
$$;

create or replace function workspace.mcp_list_career_opportunities(
  target_status text default null,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
begin
  if page_size is null or page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if target_status is not null and target_status not in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn') then
    raise exception 'Career opportunity status is not supported.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'opportunities', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', opportunity.id,
        'company', opportunity.company,
        'role', opportunity.role,
        'status', opportunity.status,
        'applied_date', opportunity.applied_date,
        'contact_name', opportunity.contact_name,
        'contact_notes', opportunity.contact_notes,
        'next_follow_up_date', opportunity.next_follow_up_date,
        'compensation_notes', opportunity.compensation_notes,
        'job_url', opportunity.job_url,
        'created_at', opportunity.created_at,
        'updated_at', opportunity.updated_at
      ) order by opportunity.created_at desc, opportunity.id desc)
      from (
        select *
        from workspace.job_applications
        where workspace_id = target_workspace_id
          and created_by = auth.uid()
          and (target_status is null or status = target_status)
        order by created_at desc, id desc
        limit page_size
      ) as opportunity
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_create_career_opportunity(
  target_company text,
  target_role text,
  request_id uuid,
  target_next_follow_up_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_company text := nullif(trim(target_company), '');
  effective_role text := nullif(trim(target_role), '');
  expected_payload jsonb;
  existing_payload jsonb;
  existing_result jsonb;
  created_opportunity workspace.job_applications%rowtype;
  created_result jsonb;
begin
  if request_id is null then
    raise exception 'A request identifier is required for career opportunity creation.' using errcode = '22023';
  end if;
  if effective_company is null or char_length(effective_company) not between 1 and 240
    or effective_role is null or char_length(effective_role) not between 1 and 240 then
    raise exception 'Company and role must each be between 1 and 240 characters.' using errcode = '22023';
  end if;

  expected_payload := pg_catalog.jsonb_build_object(
    'company', effective_company,
    'role', effective_role,
    'next_follow_up_date', target_next_follow_up_date
  );
  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_payload
  ) values (
    target_workspace_id, token_client_id, 'create_career_opportunity', request_id, expected_payload
  ) on conflict do nothing;

  if not found then
    select request_payload, result into existing_payload, existing_result
    from workspace_private.mcp_action_receipts
    where workspace_id = target_workspace_id
      and client_id = token_client_id
      and operation_name = 'create_career_opportunity'
      and idempotency_key = request_id;
    if existing_payload is distinct from expected_payload then
      raise exception 'Reuse a career request identifier only with the same opportunity details.' using errcode = '22023';
    end if;
    return coalesce(existing_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  insert into workspace.job_applications (
    workspace_id, company, role, next_follow_up_date, created_by
  ) values (
    target_workspace_id, effective_company, effective_role, target_next_follow_up_date, auth.uid()
  ) returning * into created_opportunity;

  created_result := pg_catalog.jsonb_build_object(
    'opportunity', pg_catalog.jsonb_build_object(
      'id', created_opportunity.id,
      'company', created_opportunity.company,
      'role', created_opportunity.role,
      'status', created_opportunity.status,
      'next_follow_up_date', created_opportunity.next_follow_up_date,
      'created_at', created_opportunity.created_at,
      'updated_at', created_opportunity.updated_at
    ),
    'created', true,
    'idempotent_replay', false
  );
  update workspace_private.mcp_action_receipts set result = created_result
  where workspace_id = target_workspace_id
    and client_id = token_client_id
    and operation_name = 'create_career_opportunity'
    and idempotency_key = request_id;
  return created_result;
end;
$$;

create or replace function workspace.mcp_update_career_opportunity(
  target_opportunity_id uuid,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
  updated_opportunity workspace.job_applications%rowtype;
begin
  if target_opportunity_id is null then
    raise exception 'A career opportunity identifier is required.' using errcode = '22023';
  end if;
  if target_status not in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn') then
    raise exception 'Career opportunity status is not supported.' using errcode = '22023';
  end if;
  update workspace.job_applications set status = target_status, updated_at = now()
  where id = target_opportunity_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  returning * into updated_opportunity;
  if not found then
    raise exception 'Career opportunity not found for this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object(
    'opportunity', pg_catalog.jsonb_build_object(
      'id', updated_opportunity.id,
      'company', updated_opportunity.company,
      'role', updated_opportunity.role,
      'status', updated_opportunity.status,
      'next_follow_up_date', updated_opportunity.next_follow_up_date,
      'created_at', updated_opportunity.created_at,
      'updated_at', updated_opportunity.updated_at
    ),
    'updated', true
  );
end;
$$;

create or replace function workspace.mcp_replace_confirmed_workspace_configuration(
  target_area text,
  confirmed_text text,
  request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('core_workspace');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_area text := nullif(trim(target_area), '');
  effective_text text := nullif(trim(confirmed_text), '');
  assistant text;
  expected_payload jsonb;
  existing_payload jsonb;
  existing_result jsonb;
  saved_item workspace.personal_configuration_items%rowtype;
  created_result jsonb;
begin
  if request_id is null then
    raise exception 'A request identifier is required for confirmed configuration.' using errcode = '22023';
  end if;
  if effective_area not in (
    'responsibilities', 'areas_of_attention', 'priorities', 'commitments', 'value_focus',
    'existing_systems', 'assistant_posture', 'review_rhythm', 'starting_capabilities',
    'daily_brief', 'integration_recommendations'
  ) or effective_text is null or char_length(effective_text) not between 1 and 5000 then
    raise exception 'A supported setup area and concise confirmed text are required.' using errcode = '22023';
  end if;

  expected_payload := pg_catalog.jsonb_build_object('area', effective_area, 'text', effective_text);
  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_payload
  ) values (
    target_workspace_id, token_client_id, 'replace_workspace_configuration', request_id, expected_payload
  ) on conflict do nothing;

  if not found then
    select request_payload, result into existing_payload, existing_result
    from workspace_private.mcp_action_receipts
    where workspace_id = target_workspace_id
      and client_id = token_client_id
      and operation_name = 'replace_workspace_configuration'
      and idempotency_key = request_id;
    if existing_payload is distinct from expected_payload then
      raise exception 'Reuse a configuration request identifier only with the same confirmed content.' using errcode = '22023';
    end if;
    return coalesce(existing_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  select coalesce(selected_assistant, 'chatgpt') into assistant
  from workspace.personal_onboarding
  where workspace_id = target_workspace_id and user_id = auth.uid();
  update workspace.personal_configuration_items set active = false, updated_at = now()
  where workspace_id = target_workspace_id and area = effective_area and active;
  insert into workspace.personal_configuration_items (
    workspace_id, area, content, epistemic_status, source_interface, active, confirmed_at, created_by
  ) values (
    target_workspace_id, effective_area, pg_catalog.jsonb_build_object('text', effective_text),
    'user_confirmed', assistant, true, now(), auth.uid()
  ) returning * into saved_item;
  update workspace.personal_onboarding set
    state = case when state in ('onboarding_complete', 'workspace_ready') then state else 'onboarding_in_progress' end,
    completed_areas = array(select distinct unnest(completed_areas || array[effective_area])),
    last_resumed_at = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();

  created_result := pg_catalog.jsonb_build_object(
    'item', pg_catalog.jsonb_build_object(
      'id', saved_item.id,
      'area', saved_item.area,
      'content', saved_item.content,
      'epistemic_status', saved_item.epistemic_status,
      'confirmed_at', saved_item.confirmed_at,
      'updated_at', saved_item.updated_at
    ),
    'replaced', true,
    'idempotent_replay', false
  );
  update workspace_private.mcp_action_receipts set result = created_result
  where workspace_id = target_workspace_id
    and client_id = token_client_id
    and operation_name = 'replace_workspace_configuration'
    and idempotency_key = request_id;
  return created_result;
end;
$$;

create or replace function workspace.mcp_list_integration_connections()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('core_workspace');
begin
  return pg_catalog.jsonb_build_object(
    'connections', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', connection.id,
        'provider', connection.provider,
        'status', connection.status,
        'connected_account_label', connection.connected_account_label,
        'scopes', connection.scopes,
        'last_success_at', connection.last_success_at,
        'last_error_code', connection.last_error_code,
        'updated_at', connection.updated_at
      ) order by connection.provider)
      from workspace.integration_connections as connection
      where connection.workspace_id = target_workspace_id
        and connection.created_by = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function workspace_private.require_mcp_capability(text) from public, anon, authenticated;
revoke all on function workspace.mcp_list_captures(text, integer) from public, anon;
revoke all on function workspace.mcp_resolve_capture(uuid, uuid, text) from public, anon;
revoke all on function workspace.mcp_dismiss_capture(uuid) from public, anon;
revoke all on function workspace.mcp_list_memory(text, integer) from public, anon;
revoke all on function workspace.mcp_create_memory(text, uuid, text, text) from public, anon;
revoke all on function workspace.mcp_delete_memory(uuid) from public, anon;
revoke all on function workspace.mcp_list_career_opportunities(text, integer) from public, anon;
revoke all on function workspace.mcp_create_career_opportunity(text, text, uuid, date) from public, anon;
revoke all on function workspace.mcp_update_career_opportunity(uuid, text) from public, anon;
revoke all on function workspace.mcp_replace_confirmed_workspace_configuration(text, text, uuid) from public, anon;
revoke all on function workspace.mcp_list_integration_connections() from public, anon;

grant execute on function workspace.mcp_list_captures(text, integer) to authenticated;
grant execute on function workspace.mcp_resolve_capture(uuid, uuid, text) to authenticated;
grant execute on function workspace.mcp_dismiss_capture(uuid) to authenticated;
grant execute on function workspace.mcp_list_memory(text, integer) to authenticated;
grant execute on function workspace.mcp_create_memory(text, uuid, text, text) to authenticated;
grant execute on function workspace.mcp_delete_memory(uuid) to authenticated;
grant execute on function workspace.mcp_list_career_opportunities(text, integer) to authenticated;
grant execute on function workspace.mcp_create_career_opportunity(text, text, uuid, date) to authenticated;
grant execute on function workspace.mcp_update_career_opportunity(uuid, text) to authenticated;
grant execute on function workspace.mcp_replace_confirmed_workspace_configuration(text, text, uuid) to authenticated;
grant execute on function workspace.mcp_list_integration_connections() to authenticated;
