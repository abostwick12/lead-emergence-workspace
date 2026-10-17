-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- SOURCE ONLY: Ministry owns review and application to the shared database.
-- No owner budget row is seeded: availability fails closed until reviewed setup.

create table workspace_private.calendar_availability_read_budget (
  workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
  max_per_minute integer not null check (max_per_minute > 0),
  window_started_at timestamptz not null default 'epoch'::timestamptz,
  accepted_count integer not null default 0 check (accepted_count >= 0),
  constraint calendar_availability_count_within_limit check (accepted_count <= max_per_minute)
);

alter table workspace_private.calendar_availability_read_budget enable row level security;
revoke all on table workspace_private.calendar_availability_read_budget
  from public, anon, authenticated, service_role;

-- One row per owner Workspace serializes claims from every server and region.
-- The restricted Calendar reader has no direct access to this private table.
create function workspace.claim_calendar_availability_read(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  budget workspace_private.calendar_availability_read_budget%rowtype;
  current_window timestamptz;
begin
  if p_workspace_id is null then
    return false;
  end if;

  select b.* into budget
    from workspace_private.calendar_availability_read_budget as b
    join workspace.workspaces as w on w.id = b.workspace_id
   where b.workspace_id = p_workspace_id and w.workspace_type = 'personal'
   for update of b;
  if not found then
    return false;
  end if;

  -- Take wall-clock time after the row lock, so a wait cannot reuse an old minute.
  current_window := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp(), 'UTC');
  if budget.window_started_at = current_window
     and budget.accepted_count >= budget.max_per_minute then
    return false;
  end if;

  update workspace_private.calendar_availability_read_budget as b
     set window_started_at = current_window,
         accepted_count = case
           when budget.window_started_at = current_window then budget.accepted_count + 1
           else 1
         end
   where b.workspace_id = p_workspace_id;
  return true;
end;
$$;

revoke all on function workspace.claim_calendar_availability_read(uuid)
  from public, anon, authenticated, service_role;
grant execute on function workspace.claim_calendar_availability_read(uuid)
  to workspace_calendar_reader;

comment on table workspace_private.calendar_availability_read_budget is
  'Owner-reviewed per-minute Calendar read limit and one shared counter; no row means no reads.';
