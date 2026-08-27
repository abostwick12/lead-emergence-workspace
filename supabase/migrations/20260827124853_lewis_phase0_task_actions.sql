-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Add a durable, capability-gated Lewis task contract without
-- exposing Workspace tables directly to MCP OAuth tokens.

create table if not exists workspace_private.mcp_action_receipts (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 500),
  operation_name text not null check (operation_name in ('create_task')),
  idempotency_key uuid not null,
  request_payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (workspace_id, client_id, operation_name, idempotency_key)
);

alter table workspace_private.mcp_action_receipts enable row level security;
revoke all on table workspace_private.mcp_action_receipts from public, anon, authenticated;

create or replace function workspace_private.require_mcp_tasks_workspace()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  if not workspace_private.has_personal_capability(target_workspace_id, 'tasks') then
    raise exception 'Task actions are not included for this Workspace.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.mcp_list_tasks(
  target_status text default null,
  target_domain text default null,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_tasks_workspace();
begin
  if page_size is null or page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if target_status is not null and target_status not in ('todo', 'in_progress', 'blocked', 'done') then
    raise exception 'Task status is not supported.' using errcode = '22023';
  end if;
  if target_domain is not null and target_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Task domain is not supported.' using errcode = '22023';
  end if;
  if (cursor_created_at is null) <> (cursor_id is null) then
    raise exception 'A task cursor must include both created_at and id.' using errcode = '22023';
  end if;

  return (
    with selected as (
      select task.*
      from workspace.tasks as task
      where task.workspace_id = target_workspace_id
        and (target_status is null or task.status = target_status)
        and (target_domain is null or task.domain = target_domain)
        and (
          cursor_created_at is null
          or (task.created_at, task.id) < (cursor_created_at, cursor_id)
        )
      order by task.created_at desc, task.id desc
      limit page_size + 1
    ), page as (
      select * from selected
      order by created_at desc, id desc
      limit page_size
    )
    select pg_catalog.jsonb_build_object(
      'tasks', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', task.id,
          'domain', task.domain,
          'title', task.title,
          'description', task.description,
          'status', task.status,
          'priority', task.priority,
          'due_date', task.due_date,
          'tags', task.tags,
          'created_at', task.created_at,
          'updated_at', task.updated_at
        ) order by task.created_at desc, task.id desc)
        from page as task
      ), '[]'::jsonb),
      'next_cursor', (
        select pg_catalog.jsonb_build_object('created_at', task.created_at, 'id', task.id)
        from selected as task
        order by task.created_at desc, task.id desc
        offset page_size
        limit 1
      )
    )
  );
end;
$$;

create or replace function workspace.mcp_create_task(
  task_title text,
  request_id uuid,
  task_domain text default 'general',
  task_priority text default 'medium',
  task_due_date date default null,
  task_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_tasks_workspace();
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_title text := nullif(trim(task_title), '');
  effective_domain text := coalesce(nullif(trim(task_domain), ''), 'general');
  effective_priority text := coalesce(nullif(trim(task_priority), ''), 'medium');
  effective_description text := nullif(trim(task_description), '');
  expected_payload jsonb;
  existing_payload jsonb;
  existing_result jsonb;
  created_task workspace.tasks%rowtype;
  created_result jsonb;
begin
  if request_id is null then
    raise exception 'A request identifier is required for task creation.' using errcode = '22023';
  end if;
  if effective_title is null or char_length(effective_title) not between 1 and 240 then
    raise exception 'Task title must be between 1 and 240 characters.' using errcode = '22023';
  end if;
  if effective_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Task domain is not supported.' using errcode = '22023';
  end if;
  if effective_priority not in ('critical', 'high', 'medium', 'low') then
    raise exception 'Task priority is not supported.' using errcode = '22023';
  end if;
  if effective_description is not null and char_length(effective_description) > 10000 then
    raise exception 'Task description must not exceed 10000 characters.' using errcode = '22023';
  end if;

  expected_payload := pg_catalog.jsonb_build_object(
    'title', effective_title,
    'domain', effective_domain,
    'priority', effective_priority,
    'due_date', task_due_date,
    'description', effective_description
  );

  insert into workspace_private.mcp_action_receipts (
    workspace_id, client_id, operation_name, idempotency_key, request_payload
  ) values (
    target_workspace_id, token_client_id, 'create_task', request_id, expected_payload
  ) on conflict do nothing;

  if not found then
    select request_payload, result
      into existing_payload, existing_result
    from workspace_private.mcp_action_receipts
    where workspace_id = target_workspace_id
      and client_id = token_client_id
      and operation_name = 'create_task'
      and idempotency_key = request_id;
    if existing_payload is distinct from expected_payload then
      raise exception 'Reuse a task request identifier only with the same task details.' using errcode = '22023';
    end if;
    return coalesce(existing_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  insert into workspace.tasks (
    workspace_id, domain, title, description, priority, due_date, created_by
  ) values (
    target_workspace_id, effective_domain, effective_title, effective_description,
    effective_priority, task_due_date, auth.uid()
  ) returning * into created_task;

  created_result := pg_catalog.jsonb_build_object(
    'task', pg_catalog.jsonb_build_object(
      'id', created_task.id,
      'domain', created_task.domain,
      'title', created_task.title,
      'description', created_task.description,
      'status', created_task.status,
      'priority', created_task.priority,
      'due_date', created_task.due_date,
      'tags', created_task.tags,
      'created_at', created_task.created_at,
      'updated_at', created_task.updated_at
    ),
    'created', true,
    'idempotent_replay', false
  );

  update workspace_private.mcp_action_receipts set result = created_result
  where workspace_id = target_workspace_id
    and client_id = token_client_id
    and operation_name = 'create_task'
    and idempotency_key = request_id;

  return created_result;
end;
$$;

create or replace function workspace.mcp_update_task(
  target_task_id uuid,
  target_status text default null,
  target_priority text default null,
  target_due_date date default null,
  set_due_date boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_tasks_workspace();
  updated_task workspace.tasks%rowtype;
begin
  if target_task_id is null then
    raise exception 'A task identifier is required.' using errcode = '22023';
  end if;
  if target_status is null and target_priority is null and not set_due_date then
    raise exception 'Provide at least one task field to update.' using errcode = '22023';
  end if;
  if target_status is not null and target_status not in ('todo', 'in_progress', 'blocked', 'done') then
    raise exception 'Task status is not supported.' using errcode = '22023';
  end if;
  if target_priority is not null and target_priority not in ('critical', 'high', 'medium', 'low') then
    raise exception 'Task priority is not supported.' using errcode = '22023';
  end if;

  update workspace.tasks set
    status = coalesce(target_status, status),
    priority = coalesce(target_priority, priority),
    due_date = case when set_due_date then target_due_date else due_date end
  where id = target_task_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  returning * into updated_task;

  if not found then
    raise exception 'Task not found for this Workspace.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'task', pg_catalog.jsonb_build_object(
      'id', updated_task.id,
      'domain', updated_task.domain,
      'title', updated_task.title,
      'description', updated_task.description,
      'status', updated_task.status,
      'priority', updated_task.priority,
      'due_date', updated_task.due_date,
      'tags', updated_task.tags,
      'created_at', updated_task.created_at,
      'updated_at', updated_task.updated_at
    ),
    'updated', true
  );
end;
$$;

create or replace function workspace.mcp_delete_task(target_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_tasks_workspace();
  deleted_task_id uuid;
begin
  if target_task_id is null then
    raise exception 'A task identifier is required.' using errcode = '22023';
  end if;

  delete from workspace.tasks
  where id = target_task_id
    and workspace_id = target_workspace_id
    and created_by = auth.uid()
  returning id into deleted_task_id;

  return pg_catalog.jsonb_build_object(
    'id', target_task_id,
    'deleted', deleted_task_id is not null,
    'already_absent', deleted_task_id is null
  );
end;
$$;

revoke all on function workspace_private.require_mcp_tasks_workspace() from public, anon, authenticated;
revoke all on function workspace.mcp_list_tasks(text, text, timestamptz, uuid, integer) from public, anon;
revoke all on function workspace.mcp_create_task(text, uuid, text, text, date, text) from public, anon;
revoke all on function workspace.mcp_update_task(uuid, text, text, date, boolean) from public, anon;
revoke all on function workspace.mcp_delete_task(uuid) from public, anon;

grant execute on function workspace.mcp_list_tasks(text, text, timestamptz, uuid, integer) to authenticated;
grant execute on function workspace.mcp_create_task(text, uuid, text, text, date, text) to authenticated;
grant execute on function workspace.mcp_update_task(uuid, text, text, date, boolean) to authenticated;
grant execute on function workspace.mcp_delete_task(uuid) to authenticated;
