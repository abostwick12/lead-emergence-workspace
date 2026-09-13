-- PostgreSQL is the sole SOTF v1 authority for civil-time interpretation.
-- JavaScript consumes these boundaries and never supplies a boundary for the
-- database to trust. The token is an optimistic consistency fingerprint over
-- the database's current authority result, not an authorization credential.
create function workspace_private.sotf_v1_daily_brief_utc_window(
  target_brief_date date,
  target_time_zone text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  window_start timestamptz;
  window_end timestamptz;
begin
  if target_brief_date is null
    or target_time_zone is null
    or not workspace_private.sotf_v1_time_zone_is_canonical(target_time_zone)
  then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;
  window_start := target_brief_date::timestamp at time zone target_time_zone;
  window_end := (target_brief_date + 2)::timestamp at time zone target_time_zone;
  return jsonb_build_object(
    'window_start', to_char(window_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'window_end', to_char(window_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end; $$;

revoke all on function workspace_private.sotf_v1_daily_brief_utc_window(date,text)
  from public, anon, authenticated;

create function workspace_private.sotf_v1_daily_brief_boundary_authority(
  target_workspace uuid,
  target_brief_date date,
  target_time_zone text
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  semantics jsonb;
  current_revision integer;
  local_today date;
  boundaries jsonb;
  window_start timestamptz;
  window_end timestamptz;
  authority_material jsonb;
  authority_token text;
begin
  if target_workspace is null
    or target_brief_date is null
    or target_time_zone is null
    or not workspace_private.sotf_v1_time_zone_is_canonical(target_time_zone)
  then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  select revision into current_revision
  from workspace_private.sotf_operation_heads
  where workspace_id = target_workspace;
  if current_revision is null then
    raise exception 'sotf_v1:transition_not_started' using errcode = '22023';
  end if;

  local_today := (clock_timestamp() at time zone target_time_zone)::date;
  if target_brief_date not in (local_today, local_today - 1) then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  boundaries := workspace_private.sotf_v1_daily_brief_utc_window(target_brief_date,target_time_zone);
  window_start := (boundaries ->> 'window_start')::timestamptz;
  window_end := (boundaries ->> 'window_end')::timestamptz;
  semantics := workspace_private.sotf_v1_daily_brief_projection_semantics(
    target_workspace,
    target_brief_date,
    target_time_zone
  );

  authority_material := jsonb_build_object(
    'authority_version', '1',
    'workspace_id', target_workspace,
    'workflow_id', 'transition.daily_brief',
    'workflow_version', '1.0.0',
    'state_revision', current_revision,
    'authority_local_day', to_char(local_today, 'YYYY-MM-DD'),
    'brief_date', to_char(target_brief_date, 'YYYY-MM-DD'),
    'time_zone', target_time_zone,
    'window_start', to_char(window_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'window_end', to_char(window_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'eligible_refs', semantics -> 'eligible_refs',
    'truncated_sections', semantics -> 'truncated_sections'
  );
  authority_token := 'sha256:' || pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(authority_material::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return authority_material || jsonb_build_object(
    'authority_token', authority_token,
    'as_of', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end; $$;

revoke all on function workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text)
  from public, anon, authenticated;

create function workspace.sotf_v1_get_daily_brief_authority(
  p_workflow_id text,
  p_workflow_version text,
  p_brief_date text,
  p_time_zone text
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_v1_access();
  target_date date;
begin
  if p_workflow_id is distinct from 'transition.daily_brief' then
    raise exception 'sotf_v1:not_available' using errcode = '22023';
  end if;
  if p_workflow_version is distinct from '1.0.0' then
    raise exception 'sotf_v1:version_not_available' using errcode = '22023';
  end if;
  if p_brief_date is null or p_brief_date !~ '^\d{4}-\d{2}-\d{2}$'
    or p_time_zone is null
    or not workspace_private.sotf_v1_time_zone_is_canonical(p_time_zone)
  then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;
  begin
    target_date := p_brief_date::date;
  exception when others then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end;
  return workspace_private.sotf_v1_daily_brief_boundary_authority(
    target_workspace,
    target_date,
    p_time_zone
  );
end; $$;

revoke all on function workspace.sotf_v1_get_daily_brief_authority(text,text,text,text)
  from public, anon, authenticated;
grant execute on function workspace.sotf_v1_get_daily_brief_authority(text,text,text,text)
  to authenticated;

-- The original one-argument write bridge cannot bind a database authority
-- snapshot. Keep it unavailable and require the two-argument overload below.
revoke execute on function workspace.sotf_v1_record_daily_brief_outcome(jsonb)
  from authenticated;

create function workspace.sotf_v1_record_daily_brief_outcome(
  outcome jsonb,
  p_expected_authority_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid;
  head workspace_private.sotf_operation_heads%rowtype;
  existing workspace_private.sotf_daily_brief_outcomes%rowtype;
  inserted workspace_private.sotf_daily_brief_outcomes%rowtype;
  match_count integer;
  authority jsonb;
begin
  target_workspace := workspace_private.require_sotf_v1_access();
  perform workspace_private.lock_sotf_v1_authority(target_workspace);
  perform workspace_private.validate_sotf_v1_daily_brief_outcome(outcome);
  if p_expected_authority_token is null
    or p_expected_authority_token !~ '^sha256:[0-9a-f]{64}$'
  then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  select * into head
  from workspace_private.sotf_operation_heads
  where workspace_id = target_workspace
  for update;
  if head.workspace_id is null then
    raise exception 'sotf_v1:transition_not_started' using errcode = '22023';
  end if;

  select count(*) into match_count
  from workspace_private.sotf_daily_brief_outcomes
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and workflow_id = 'transition.daily_brief'
    and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid);
  if match_count > 1 then
    raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023';
  end if;
  if match_count = 1 then
    select * into existing
    from workspace_private.sotf_daily_brief_outcomes
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and workflow_id = 'transition.daily_brief'
      and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid)
    limit 1;
    if existing.payload <> outcome then
      raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'saved', true,
      'replayed', true,
      'receipt', workspace_private.sotf_v1_outcome_receipt(existing)
    );
  end if;

  if head.revision <> (outcome ->> 'expected_state_revision')::integer then
    raise exception 'sotf_v1:state_changed' using errcode = '40001';
  end if;
  authority := workspace_private.sotf_v1_daily_brief_boundary_authority(
    target_workspace,
    (outcome ->> 'brief_date')::date,
    outcome ->> 'time_zone'
  );
  if authority ->> 'authority_token' is distinct from p_expected_authority_token then
    raise exception 'sotf_v1:state_changed' using errcode = '40001';
  end if;
  perform workspace_private.validate_sotf_v1_daily_brief_projection_semantics(outcome, target_workspace);

  if (select count(*) from workspace_private.sotf_daily_brief_outcomes
      where workspace_id = target_workspace and user_id = auth.uid()
        and workflow_id = 'transition.daily_brief') >= 100
  then
    raise exception 'sotf_v1:capacity_reached' using errcode = '54000';
  end if;

  insert into workspace_private.sotf_daily_brief_outcomes(
    workspace_id,user_id,client_id,request_id,run_id,workflow_id,workflow_version,state_revision,
    brief_date,time_zone,status,connector_results,degradation_reasons,selected_le_refs,priority_count,usefulness,provenance,payload
  ) values (
    target_workspace,auth.uid(),auth.jwt() ->> 'client_id',(outcome ->> 'request_id')::uuid,(outcome ->> 'run_id')::uuid,
    outcome ->> 'workflow_id',outcome ->> 'workflow_version',(outcome ->> 'expected_state_revision')::integer,
    (outcome ->> 'brief_date')::date,outcome ->> 'time_zone',outcome ->> 'status',outcome -> 'connector_results',
    array(select jsonb_array_elements_text(outcome -> 'degradation_reasons')),outcome -> 'selected_le_refs',
    (outcome ->> 'priority_count')::smallint,outcome ->> 'usefulness',outcome -> 'provenance',outcome
  ) returning * into inserted;
  select * into inserted
  from workspace_private.sotf_daily_brief_outcomes
  where id = inserted.id;
  if inserted.id is null then
    raise exception 'sotf_v1:result_unknown' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'saved', true,
    'replayed', false,
    'receipt', workspace_private.sotf_v1_outcome_receipt(inserted)
  );
exception when unique_violation then
  raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023';
end; $$;

revoke all on function workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)
  from public, anon, authenticated;
grant execute on function workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)
  to authenticated;

comment on function workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text) is
  'Database-owned SOTF v1 civil-time boundaries, projection membership, truncation state, revision, local day, and drift token.';
comment on function workspace_private.sotf_v1_daily_brief_utc_window(date,text) is
  'Pure PostgreSQL SOTF v1 local-date and canonical-zone to UTC daily-brief window conversion.';
comment on function workspace.sotf_v1_get_daily_brief_authority(text,text,text,text) is
  'Returns current database-owned SOTF v1 projection authority after current access and local-day validation.';
comment on function workspace.sotf_v1_record_daily_brief_outcome(jsonb,text) is
  'Writes a reviewed SOTF v1 outcome only when the supplied optimistic authority token matches a freshly recomputed database authority result.';
