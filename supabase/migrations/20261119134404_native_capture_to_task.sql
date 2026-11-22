-- Native conversion uses the capture row as its durable operation identity.
-- Existing direct-session predicates, table grants and RLS remain authoritative.
create function workspace.resolve_capture_to_task(
  target_workspace_id uuid,
  target_capture_id uuid,
  task_domain text default 'general'
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  capture_row workspace.capture_inbox%rowtype;
  task_row workspace.tasks%rowtype;
  task_title text;
  updated_count bigint;
  was_processed boolean;
begin
  if target_workspace_id is null or target_capture_id is null then
    raise exception 'Workspace and capture IDs are required.' using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'Capture is unavailable or access is not permitted.' using errcode = '42501';
  end if;

  -- SELECT FOR UPDATE applies both SELECT and UPDATE USING policies. The
  -- existing capture UPDATE policy requires owner + quick_capture, including
  -- direct-session/effective-access checks. Do not grant private-schema USAGE
  -- merely to call those same pre-bound policy predicates explicitly here.
  select capture.* into capture_row
  from workspace.capture_inbox as capture
  where capture.id = target_capture_id
    and capture.workspace_id = target_workspace_id
    and capture.created_by = auth.uid()
  for update;

  if not found then
    raise exception 'Capture is unavailable or access is not permitted.' using errcode = '42501';
  end if;

  was_processed := capture_row.status = 'processed';
  if was_processed then
    -- A committed conversion wins even when a retry supplies a different domain.
    -- Never manufacture a replacement for a deleted or unreadable linked task.
    select task.* into task_row
    from workspace.tasks as task
    where task.id = capture_row.routed_task_id
      and task.workspace_id = target_workspace_id
    for update;
    if not found then
      raise exception 'This capture was processed, but its linked task is unavailable or access is not permitted.' using errcode = 'P0001';
    end if;
  elsif capture_row.status = 'discarded' then
    raise exception 'Discarded captures cannot become tasks.' using errcode = 'P0001';
  else
    if task_domain is null or task_domain not in (
      'general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership'
    ) then
      raise exception 'Choose a valid task domain.' using errcode = '22023';
    end if;

    -- Match String.prototype.trim() used by the native createTask path, including
    -- tabs, line terminators and ECMAScript Unicode whitespace. Keep raw_text intact.
    task_title := pg_catalog.btrim(capture_row.raw_text,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if pg_catalog.char_length(task_title) not between 1 and 240 then
      raise exception 'Task title must be between 1 and 240 characters. The capture has not changed.' using errcode = '22023';
    end if;

    -- New conversion requires owner + tasks through INSERT WITH CHECK.
    -- Replay above requires the same authority through task UPDATE USING,
    -- applied by its row lock; ordinary task SELECT alone is insufficient.
    insert into workspace.tasks (workspace_id, created_by, title, domain, priority, due_date, description)
    values (target_workspace_id, auth.uid(), task_title, task_domain, 'medium', null, null)
    returning * into task_row;
    if not found then
      raise exception 'Task creation could not be confirmed. The capture has not changed.' using errcode = 'P0001';
    end if;

    update workspace.capture_inbox as capture
    set status = 'processed', routed_task_id = task_row.id
    where capture.id = target_capture_id
      and capture.workspace_id = target_workspace_id
      and capture.created_by = auth.uid()
      and capture.status = 'unprocessed';
    get diagnostics updated_count = row_count;
    if updated_count <> 1 then
      raise exception 'Capture linkage could not be confirmed. No task was created.' using errcode = 'P0001';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'already_processed', was_processed,
    'task', pg_catalog.jsonb_build_object(
      'id', task_row.id, 'workspace_id', task_row.workspace_id,
      'domain', task_row.domain, 'title', task_row.title,
      'description', task_row.description, 'status', task_row.status,
      'priority', task_row.priority, 'due_date', task_row.due_date,
      'tags', task_row.tags, 'created_at', task_row.created_at, 'updated_at', task_row.updated_at
    )
  );
end;
$$;

revoke all on function workspace.resolve_capture_to_task(uuid, uuid, text) from public, anon, service_role;
grant execute on function workspace.resolve_capture_to_task(uuid, uuid, text) to authenticated;
