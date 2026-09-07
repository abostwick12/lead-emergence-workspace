-- Ordinary SOTF transition operations only. No Professional Context table,
-- authority, grant, capability mapping, or release flag is changed here.
-- Source migration only: hosted application requires its own written gate.

create table workspace_private.sotf_operation_heads (
  workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
  revision integer not null default 0 check (revision between 0 and 2000),
  payload_bytes integer not null default 0 check (payload_bytes between 0 and 2000000)
);
create table workspace_private.sotf_operation_events (
  workspace_id uuid not null references workspace_private.sotf_operation_heads(workspace_id) on delete cascade,
  revision integer not null check (revision > 0),
  request_id uuid not null,
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, revision),
  unique (workspace_id, request_id)
);
alter table workspace_private.sotf_operation_heads enable row level security;
alter table workspace_private.sotf_operation_events enable row level security;
revoke all on workspace_private.sotf_operation_heads, workspace_private.sotf_operation_events from public, anon, authenticated;

create function workspace_private.resolve_sotf_workspace()
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid;
begin
  if auth.uid() is null then return null; end if;
  if auth.jwt() ->> 'client_id' is not null then
    begin
      target_workspace := workspace_private.require_mcp_workspace();
    exception when others then
      return null;
    end;
  else
    if not workspace_private.is_direct_session() then return null; end if;
    select item.id into target_workspace from workspace.workspaces as item
      where item.owner_user_id = auth.uid() and item.workspace_type = 'personal'
      and workspace_private.is_workspace_owner(item.id)
      order by item.created_at limit 1;
  end if;
  if target_workspace is null
    or not workspace_private.has_personal_capability(target_workspace, 'core_workspace')
    or not exists (
      select 1 from workspace.bundle_entitlements as entitlement
      join workspace.bundle_definitions as definition using (bundle_key)
      where entitlement.workspace_id = target_workspace
        and entitlement.beneficiary_user_id = auth.uid()
        and entitlement.bundle_key = 'sotf_transition'
        and definition.availability_status = 'active'
        and entitlement.starts_at <= now()
        and (entitlement.expires_at is null or entitlement.expires_at > now())
        and entitlement.revoked_at is null
    ) then return null; end if;
  return target_workspace;
end; $$;

create function workspace.sotf_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select workspace_private.resolve_sotf_workspace() is not null;
$$;

create function workspace_private.require_sotf_operations()
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.resolve_sotf_workspace();
begin
  if target_workspace is null then
    raise exception 'Active SOTF Bundle access is required.' using errcode = '42501';
  end if;
  return target_workspace;
end; $$;

create function workspace.sotf_read_operations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.require_sotf_operations();
begin
  -- One statement gives the revision and its complete log the same snapshot.
  return jsonb_build_object(
    'workspace_id', target_workspace,
    'revision', coalesce((select revision from workspace_private.sotf_operation_heads where workspace_id = target_workspace), 0),
    'events', coalesce((select jsonb_agg(jsonb_build_object('revision', revision, 'recorded_at', recorded_at, 'envelope', envelope) order by revision)
      from workspace_private.sotf_operation_events where workspace_id = target_workspace), '[]'::jsonb)
  );
end; $$;

create function workspace.sotf_append_operation(operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_operations();
  head workspace_private.sotf_operation_heads%rowtype;
  prior workspace_private.sotf_operation_events%rowtype;
  operation_id uuid;
  expected_revision integer;
  size_bytes integer;
begin
  if jsonb_typeof(operation) is distinct from 'object'
    or operation ->> 'dataClass' is distinct from 'ordinary_transition_operations'
    or operation -> 'userConfirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(operation -> 'command') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(operation)) <> 5
    or not operation ?& array['requestId', 'expectedRevision', 'userConfirmed', 'dataClass', 'command']
    then raise exception 'A confirmed ordinary operation is required.' using errcode = '22023'; end if;
  if operation -> 'command' ->> 'type' is null or not (operation -> 'command' ->> 'type' = any(array[
    'start_transition','confirm_criteria','save_hypothesis','record_opportunity','record_evidence','review_evidence',
    'resolve_requirement','decide_opportunity','save_person','prepare_outreach','record_meeting','debrief_meeting',
    'save_commitment','resolve_commitment','save_story','save_material','record_submission','record_application_outcome',
    'record_interview','record_offer','accept_offer','review_week','prepare_action','revise_action','approve_action',
    'record_action_result','retry_action','close_chapter'
  ])) then raise exception 'Unknown transition operation.' using errcode = '22023'; end if;
  operation_id := (operation ->> 'requestId')::uuid;
  expected_revision := (operation ->> 'expectedRevision')::integer;
  size_bytes := octet_length(operation::text);
  if operation_id is null or expected_revision is null or expected_revision < 0 or size_bytes > 64000 then
    raise exception 'Invalid or oversized transition operation.' using errcode = '22023'; end if;
  insert into workspace_private.sotf_operation_heads(workspace_id) values(target_workspace) on conflict do nothing;
  select * into head from workspace_private.sotf_operation_heads where workspace_id = target_workspace for update;
  select * into prior from workspace_private.sotf_operation_events where workspace_id = target_workspace and request_id = operation_id;
  if found then
    if prior.envelope <> operation then raise exception 'Request ID already belongs to a different operation.' using errcode = '22023'; end if;
    return jsonb_build_object('revision', prior.revision, 'replayed', true);
  end if;
  if head.revision <> expected_revision then raise exception 'Refresh before saving this operation.' using errcode = '40001'; end if;
  if head.revision >= 2000 or head.payload_bytes + size_bytes > 2000000 then raise exception 'Pilot chapter capacity reached; existing work is preserved.' using errcode = '54000'; end if;
  insert into workspace_private.sotf_operation_events(workspace_id, revision, request_id, envelope)
    values(target_workspace, head.revision + 1, operation_id, operation);
  update workspace_private.sotf_operation_heads set revision = head.revision + 1, payload_bytes = head.payload_bytes + size_bytes where workspace_id = target_workspace;
  return jsonb_build_object('revision', head.revision + 1, 'replayed', false);
end; $$;

revoke all on function workspace_private.resolve_sotf_workspace() from public, anon, authenticated;
revoke all on function workspace_private.require_sotf_operations() from public, anon, authenticated;
revoke all on function workspace.sotf_has_access() from public, anon, authenticated;
revoke all on function workspace.sotf_read_operations() from public, anon, authenticated;
revoke all on function workspace.sotf_append_operation(jsonb) from public, anon, authenticated;
grant execute on function workspace.sotf_has_access() to authenticated;
grant execute on function workspace.sotf_read_operations() to authenticated;
grant execute on function workspace.sotf_append_operation(jsonb) to authenticated;
comment on table workspace_private.sotf_operation_events is 'Ordinary transition workflow log. Protected Professional Context must use its separately approved authority; it is never copied here as a fallback.';
