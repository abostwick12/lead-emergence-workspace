-- PURPOSE: Extend the Personal Workspace MCP contract to the same private
-- task, capture-review, career, memory, and clock-preference actions exposed
-- by the native Workspace UI. Every mutation requires an explicit
-- confirmation flag and is scoped to the authenticated MCP workspace.

create or replace function workspace_private.require_mcp_capability(required_capability text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  if not workspace_private.has_personal_capability(target_workspace_id, required_capability) then
    raise exception 'This Workspace capability is not included for the current plan.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.mcp_list_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('tasks');
begin
  return pg_catalog.jsonb_build_object('tasks', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', task.id, 'domain', task.domain, 'title', task.title,
      'description', task.description, 'status', task.status,
      'priority', task.priority, 'due_date', task.due_date,
      'tags', task.tags, 'created_at', task.created_at, 'updated_at', task.updated_at
    ) order by task.created_at desc)
    from workspace.tasks as task
    where task.workspace_id = target_workspace_id and task.created_by = auth.uid()
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_create_task(
  task_title text,
  task_domain text,
  task_priority text,
  task_description text,
  task_due_date date,
  user_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('tasks');
  created_task workspace.tasks%rowtype;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before creating a task.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(task_title, ''))) not between 1 and 240
    or task_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership')
    or task_priority not in ('critical', 'high', 'medium', 'low')
    or (task_description is not null and char_length(trim(task_description)) > 10000) then
    raise exception 'The task title, domain, priority, or description is invalid.' using errcode = '22023';
  end if;
  insert into workspace.tasks (workspace_id, title, domain, priority, description, due_date, created_by)
  values (target_workspace_id, trim(task_title), task_domain, task_priority, nullif(trim(task_description), ''), task_due_date, auth.uid())
  returning * into created_task;
  return pg_catalog.jsonb_build_object('task', pg_catalog.jsonb_build_object(
    'id', created_task.id, 'domain', created_task.domain, 'title', created_task.title,
    'description', created_task.description, 'status', created_task.status,
    'priority', created_task.priority, 'due_date', created_task.due_date,
    'tags', created_task.tags, 'created_at', created_task.created_at, 'updated_at', created_task.updated_at
  ));
end;
$$;

create or replace function workspace.mcp_update_task(task_id uuid, task_patch jsonb, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('tasks');
  updated_task workspace.tasks%rowtype;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before updating a task.' using errcode = '22023';
  end if;
  if task_patch is null or pg_catalog.jsonb_typeof(task_patch) <> 'object'
    or task_patch - array['status', 'priority', 'due_date'] <> '{}'::jsonb
    or not (task_patch ?| array['status', 'priority', 'due_date'])
    or (task_patch ? 'status' and task_patch ->> 'status' not in ('todo', 'in_progress', 'blocked', 'done'))
    or (task_patch ? 'priority' and task_patch ->> 'priority' not in ('critical', 'high', 'medium', 'low'))
    or (task_patch ? 'due_date' and task_patch -> 'due_date' <> 'null'::jsonb and task_patch ->> 'due_date' !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'Provide a supported task status, priority, or due date.' using errcode = '22023';
  end if;
  update workspace.tasks set
    status = case when task_patch ? 'status' then task_patch ->> 'status' else status end,
    priority = case when task_patch ? 'priority' then task_patch ->> 'priority' else priority end,
    due_date = case when task_patch ? 'due_date' then (task_patch ->> 'due_date')::date else due_date end,
    updated_at = now()
  where id = task_id and workspace_id = target_workspace_id and created_by = auth.uid()
  returning * into updated_task;
  if not found then
    raise exception 'That task is not available in this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('task', pg_catalog.jsonb_build_object(
    'id', updated_task.id, 'domain', updated_task.domain, 'title', updated_task.title,
    'description', updated_task.description, 'status', updated_task.status,
    'priority', updated_task.priority, 'due_date', updated_task.due_date,
    'tags', updated_task.tags, 'created_at', updated_task.created_at, 'updated_at', updated_task.updated_at
  ));
end;
$$;

create or replace function workspace.mcp_delete_task(task_id uuid, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('tasks');
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before deleting a task.' using errcode = '22023';
  end if;
  delete from workspace.tasks
  where id = task_id and workspace_id = target_workspace_id and created_by = auth.uid();
  if not found then
    raise exception 'That task is not available in this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('id', task_id, 'deleted', true);
end;
$$;

create or replace function workspace.mcp_list_captures()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
begin
  return pg_catalog.jsonb_build_object('captures', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', capture.id, 'raw_text', capture.raw_text, 'status', capture.status,
      'routed_task_id', capture.routed_task_id, 'created_at', capture.created_at
    ) order by capture.created_at desc)
    from workspace.capture_inbox as capture
    where capture.workspace_id = target_workspace_id and capture.created_by = auth.uid()
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_resolve_capture_to_task(capture_id uuid, task_domain text, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
  capture_text text;
  created_task workspace.tasks%rowtype;
begin
  if not workspace_private.has_personal_capability(target_workspace_id, 'tasks') then
    raise exception 'Task management is not included for this Workspace.' using errcode = '42501';
  end if;
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before turning a capture into a task.' using errcode = '22023';
  end if;
  if task_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'A supported task domain is required.' using errcode = '22023';
  end if;
  select raw_text into capture_text
  from workspace.capture_inbox
  where id = capture_id and workspace_id = target_workspace_id and created_by = auth.uid() and status = 'unprocessed'
  for update;
  if not found then
    raise exception 'That unprocessed capture is not available in this Workspace.' using errcode = '22023';
  end if;
  insert into workspace.tasks (workspace_id, title, domain, created_by)
  values (target_workspace_id, capture_text, task_domain, auth.uid())
  returning * into created_task;
  update workspace.capture_inbox set status = 'processed', routed_task_id = created_task.id, updated_at = now()
  where id = capture_id and workspace_id = target_workspace_id;
  return pg_catalog.jsonb_build_object('capture_id', capture_id, 'status', 'processed', 'task', pg_catalog.jsonb_build_object(
    'id', created_task.id, 'title', created_task.title, 'domain', created_task.domain,
    'status', created_task.status, 'priority', created_task.priority, 'due_date', created_task.due_date
  ));
end;
$$;

create or replace function workspace.mcp_discard_capture(capture_id uuid, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before discarding a capture.' using errcode = '22023';
  end if;
  update workspace.capture_inbox set status = 'discarded', updated_at = now()
  where id = capture_id and workspace_id = target_workspace_id and created_by = auth.uid() and status = 'unprocessed';
  if not found then
    raise exception 'That unprocessed capture is not available in this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('id', capture_id, 'status', 'discarded');
end;
$$;

create or replace function workspace.mcp_list_job_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
begin
  return pg_catalog.jsonb_build_object('job_applications', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', application.id, 'company', application.company, 'role', application.role,
      'status', application.status, 'applied_date', application.applied_date,
      'contact_name', application.contact_name, 'contact_notes', application.contact_notes,
      'next_follow_up_date', application.next_follow_up_date,
      'compensation_notes', application.compensation_notes, 'job_url', application.job_url,
      'created_at', application.created_at, 'updated_at', application.updated_at
    ) order by application.created_at desc)
    from workspace.job_applications as application
    where application.workspace_id = target_workspace_id and application.created_by = auth.uid()
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_create_job_application(
  company text,
  role text,
  application_status text,
  next_follow_up_date date,
  user_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
  created_application workspace.job_applications%rowtype;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before creating a career opportunity.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(company, ''))) not between 1 and 240
    or char_length(trim(coalesce(role, ''))) not between 1 and 240
    or application_status not in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn') then
    raise exception 'The company, role, or opportunity status is invalid.' using errcode = '22023';
  end if;
  insert into workspace.job_applications (workspace_id, company, role, status, next_follow_up_date, created_by)
  values (target_workspace_id, trim(company), trim(role), application_status, next_follow_up_date, auth.uid())
  returning * into created_application;
  return pg_catalog.jsonb_build_object('job_application', pg_catalog.jsonb_build_object(
    'id', created_application.id, 'company', created_application.company, 'role', created_application.role,
    'status', created_application.status, 'next_follow_up_date', created_application.next_follow_up_date,
    'created_at', created_application.created_at, 'updated_at', created_application.updated_at
  ));
end;
$$;

create or replace function workspace.mcp_update_job_application(application_id uuid, application_status text, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
  updated_application workspace.job_applications%rowtype;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before updating a career opportunity.' using errcode = '22023';
  end if;
  if application_status not in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn') then
    raise exception 'A supported opportunity status is required.' using errcode = '22023';
  end if;
  update workspace.job_applications set status = application_status, updated_at = now()
  where id = application_id and workspace_id = target_workspace_id and created_by = auth.uid()
  returning * into updated_application;
  if not found then
    raise exception 'That career opportunity is not available in this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('job_application', pg_catalog.jsonb_build_object(
    'id', updated_application.id, 'company', updated_application.company, 'role', updated_application.role,
    'status', updated_application.status, 'next_follow_up_date', updated_application.next_follow_up_date,
    'created_at', updated_application.created_at, 'updated_at', updated_application.updated_at
  ));
end;
$$;

create or replace function workspace.mcp_list_memory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
begin
  return pg_catalog.jsonb_build_object('memory_entries', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', entry.id, 'memory_type', entry.memory_type, 'content', entry.content,
      'domain', entry.domain, 'created_at', entry.created_at
    ) order by entry.created_at desc)
    from workspace.memory_entries as entry
    where entry.workspace_id = target_workspace_id and entry.created_by = auth.uid()
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_create_memory(entry_type text, entry_content text, entry_domain text, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
  created_entry workspace.memory_entries%rowtype;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before saving memory.' using errcode = '22023';
  end if;
  if entry_type not in ('fact', 'preference', 'context', 'relationship')
    or char_length(trim(coalesce(entry_content, ''))) not between 1 and 10000
    or (entry_domain is not null and entry_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership')) then
    raise exception 'The memory type, content, or domain is invalid.' using errcode = '22023';
  end if;
  insert into workspace.memory_entries (workspace_id, memory_type, content, domain, created_by)
  values (target_workspace_id, entry_type, trim(entry_content), entry_domain, auth.uid())
  returning * into created_entry;
  return pg_catalog.jsonb_build_object('memory_entry', pg_catalog.jsonb_build_object(
    'id', created_entry.id, 'memory_type', created_entry.memory_type,
    'content', created_entry.content, 'domain', created_entry.domain, 'created_at', created_entry.created_at
  ));
end;
$$;

create or replace function workspace.mcp_delete_memory(memory_id uuid, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before deleting memory.' using errcode = '22023';
  end if;
  delete from workspace.memory_entries
  where id = memory_id and workspace_id = target_workspace_id and created_by = auth.uid();
  if not found then
    raise exception 'That memory entry is not available in this Workspace.' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('id', memory_id, 'deleted', true);
end;
$$;

create or replace function workspace.mcp_get_clock_timezones()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  selected_timezones text[];
begin
  select profile.clock_timezones into selected_timezones
  from workspace.user_profiles as profile
  where profile.user_id = auth.uid();
  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'clock_timezones', coalesce(selected_timezones, array['America/New_York', 'America/Chicago', 'America/Los_Angeles']::text[])
  );
end;
$$;

create or replace function workspace.mcp_update_clock_timezones(requested_timezones text[], user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before updating clock preferences.' using errcode = '22023';
  end if;
  if cardinality(requested_timezones) <> 3
    or array_position(requested_timezones, null) is not null
    or array_position(requested_timezones, '') is not null
    or exists (
      select 1 from unnest(requested_timezones) as zone(name)
      where not exists (select 1 from pg_catalog.pg_timezone_names as known where known.name = zone.name)
    ) then
    raise exception 'Provide exactly three valid IANA time zone names.' using errcode = '22023';
  end if;
  insert into workspace.user_profiles (user_id, clock_timezones)
  values (auth.uid(), requested_timezones)
  on conflict (user_id) do update set clock_timezones = excluded.clock_timezones, updated_at = now();
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'clock_timezones', requested_timezones);
end;
$$;

create or replace function workspace.mcp_list_external_connectors()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('external_connectors');
begin
  return pg_catalog.jsonb_build_object('connectors', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'provider', provider.name,
      'status', coalesce(connection.status, 'available'),
      'connected_account_label', connection.connected_account_label,
      'scopes', coalesce(connection.scopes, '{}'::text[]),
      'last_success_at', connection.last_success_at,
      'last_error_code', connection.last_error_code
    ) order by provider.name)
    from unnest(array['gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin', 'google_drive', 'firecrawl', 'canva', 'powerpoint', 'youversion']::text[]) as provider(name)
    left join workspace.integration_connections as connection
      on connection.workspace_id = target_workspace_id and connection.provider = provider.name
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_begin_external_connector(target_provider text, user_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('external_connectors');
  existing_status text;
begin
  if user_confirmed is not true then
    raise exception 'Explicit user confirmation is required before opening external connector consent.' using errcode = '22023';
  end if;
  if target_provider not in ('gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin', 'google_drive', 'firecrawl', 'canva', 'powerpoint', 'youversion') then
    raise exception 'That external connector is not supported by the Workspace consent handoff.' using errcode = '22023';
  end if;
  select status into existing_status
  from workspace.integration_connections
  where workspace_id = target_workspace_id and provider = target_provider;
  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'provider', target_provider,
    'status', coalesce(existing_status, 'available'),
    'handoff_required', true,
    'token_boundary', 'Provider credentials and OAuth tokens remain in the Workspace consent flow and are never returned through MCP.'
  );
end;
$$;

revoke all on function workspace_private.require_mcp_capability(text) from public, anon, authenticated;
revoke all on function workspace.mcp_list_tasks() from public, anon;
revoke all on function workspace.mcp_create_task(text, text, text, text, date, boolean) from public, anon;
revoke all on function workspace.mcp_update_task(uuid, jsonb, boolean) from public, anon;
revoke all on function workspace.mcp_delete_task(uuid, boolean) from public, anon;
revoke all on function workspace.mcp_list_captures() from public, anon;
revoke all on function workspace.mcp_resolve_capture_to_task(uuid, text, boolean) from public, anon;
revoke all on function workspace.mcp_discard_capture(uuid, boolean) from public, anon;
revoke all on function workspace.mcp_list_job_applications() from public, anon;
revoke all on function workspace.mcp_create_job_application(text, text, text, date, boolean) from public, anon;
revoke all on function workspace.mcp_update_job_application(uuid, text, boolean) from public, anon;
revoke all on function workspace.mcp_list_memory() from public, anon;
revoke all on function workspace.mcp_create_memory(text, text, text, boolean) from public, anon;
revoke all on function workspace.mcp_delete_memory(uuid, boolean) from public, anon;
revoke all on function workspace.mcp_get_clock_timezones() from public, anon;
revoke all on function workspace.mcp_update_clock_timezones(text[], boolean) from public, anon;
revoke all on function workspace.mcp_list_external_connectors() from public, anon;
revoke all on function workspace.mcp_begin_external_connector(text, boolean) from public, anon;

grant execute on function workspace.mcp_list_tasks() to authenticated;
grant execute on function workspace.mcp_create_task(text, text, text, text, date, boolean) to authenticated;
grant execute on function workspace.mcp_update_task(uuid, jsonb, boolean) to authenticated;
grant execute on function workspace.mcp_delete_task(uuid, boolean) to authenticated;
grant execute on function workspace.mcp_list_captures() to authenticated;
grant execute on function workspace.mcp_resolve_capture_to_task(uuid, text, boolean) to authenticated;
grant execute on function workspace.mcp_discard_capture(uuid, boolean) to authenticated;
grant execute on function workspace.mcp_list_job_applications() to authenticated;
grant execute on function workspace.mcp_create_job_application(text, text, text, date, boolean) to authenticated;
grant execute on function workspace.mcp_update_job_application(uuid, text, boolean) to authenticated;
grant execute on function workspace.mcp_list_memory() to authenticated;
grant execute on function workspace.mcp_create_memory(text, text, text, boolean) to authenticated;
grant execute on function workspace.mcp_delete_memory(uuid, boolean) to authenticated;
grant execute on function workspace.mcp_get_clock_timezones() to authenticated;
grant execute on function workspace.mcp_update_clock_timezones(text[], boolean) to authenticated;
grant execute on function workspace.mcp_list_external_connectors() to authenticated;
grant execute on function workspace.mcp_begin_external_connector(text, boolean) to authenticated;

notify pgrst, 'reload schema';
