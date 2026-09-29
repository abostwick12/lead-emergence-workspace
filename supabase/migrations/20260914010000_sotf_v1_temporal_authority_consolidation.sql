-- PostgreSQL owns the temporal meaning of persisted SOTF operations and the
-- complete governed daily-brief projection. JavaScript transports exact
-- timestamp strings and validates closed response structure only.

create function workspace_private.sotf_exact_timestamp(value jsonb)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare parsed timestamptz;
declare raw text;
begin
  if jsonb_typeof(value) is distinct from 'string' then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end if;
  raw := value #>> '{}';
  if raw !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end if;
  begin
    parsed := raw::timestamptz;
  exception when others then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end;
  return parsed;
end; $$;

create function workspace_private.sotf_exact_date(value jsonb)
returns date language plpgsql immutable set search_path = '' as $$
declare parsed date;
declare raw text;
begin
  if value is null then return null; end if;
  if jsonb_typeof(value) is distinct from 'string' then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end if;
  raw := value #>> '{}';
  if raw !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end if;
  begin
    parsed := raw::date;
  exception when others then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end;
  if to_char(parsed,'YYYY-MM-DD') is distinct from raw then
    raise exception 'sotf:invalid_temporal_operation' using errcode = '22023';
  end if;
  return parsed;
end; $$;

create function workspace_private.validate_sotf_temporal_operation_event()
returns trigger language plpgsql set search_path = '' as $$
declare
  command jsonb := new.envelope -> 'command';
  command_type text := command ->> 'type';
  start_at timestamptz;
  end_at timestamptz;
  submitted_at timestamptz;
  item jsonb;
  observed_on date;
begin
  if command_type = 'record_meeting' then
    start_at := workspace_private.sotf_exact_timestamp(command #> '{meeting,startsAt}');
    end_at := workspace_private.sotf_exact_timestamp(command #> '{meeting,endsAt}');
    if end_at <= start_at then
      raise exception 'sotf:non_positive_meeting_interval' using errcode = '22023';
    end if;
  elsif command_type = 'record_submission' then
    submitted_at := workspace_private.sotf_exact_timestamp(command -> 'submittedAt');
    if submitted_at > new.recorded_at then
      raise exception 'sotf:future_submission' using errcode = '22023';
    end if;
  end if;

  if command_type = 'record_evidence' then
    for item in select value from jsonb_array_elements(jsonb_build_array(command -> 'evidence')) loop
      observed_on := workspace_private.sotf_exact_date(item #> '{source,observedAt}');
      if observed_on > (new.recorded_at at time zone 'UTC')::date then
        raise exception 'sotf:future_evidence' using errcode = '22023';
      end if;
    end loop;
  elsif command_type = 'debrief_meeting' then
    for item in select value from jsonb_array_elements(command -> 'evidence') loop
      observed_on := workspace_private.sotf_exact_date(item #> '{source,observedAt}');
      if observed_on > (new.recorded_at at time zone 'UTC')::date then
        raise exception 'sotf:future_evidence' using errcode = '22023';
      end if;
    end loop;
  elsif command_type = 'record_interview' then
    for item in select value from jsonb_array_elements(command #> '{interview,evidence}') loop
      observed_on := workspace_private.sotf_exact_date(item #> '{source,observedAt}');
      if observed_on > (new.recorded_at at time zone 'UTC')::date then
        raise exception 'sotf:future_evidence' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Validate every optional date later cast by the database projection.
  if command_type = 'record_opportunity' then
    perform workspace_private.sotf_exact_date(command #> '{opportunity,deadline}');
  elsif command_type = 'save_person' then
    perform workspace_private.sotf_exact_date(command #> '{person,nextTouch}');
  elsif command_type = 'decide_opportunity' then
    perform workspace_private.sotf_exact_date(command -> 'due');
  elsif command_type = 'save_commitment' then
    perform workspace_private.sotf_exact_date(command #> '{commitment,due}');
  elsif command_type = 'debrief_meeting' then
    perform workspace_private.sotf_exact_date(command -> 'nextTouch');
    for item in select value from jsonb_array_elements(command -> 'commitments') loop
      perform workspace_private.sotf_exact_date(item -> 'due');
    end loop;
  elsif command_type = 'review_week' then
    for item in select value from jsonb_array_elements(command -> 'commitments') loop
      perform workspace_private.sotf_exact_date(item -> 'due');
    end loop;
  elsif command_type = 'record_offer' then
    perform workspace_private.sotf_exact_date(command #> '{offer,deadline}');
  elsif command_type = 'accept_offer' then
    perform workspace_private.sotf_exact_date(command -> 'startDate');
  end if;
  return new;
end; $$;

create trigger sotf_operation_events_temporal_authority
before insert or update of envelope, recorded_at
on workspace_private.sotf_operation_events
for each row execute function workspace_private.validate_sotf_temporal_operation_event();

revoke all on function workspace_private.sotf_exact_timestamp(jsonb) from public,anon,authenticated;
revoke all on function workspace_private.sotf_exact_date(jsonb) from public,anon,authenticated;
revoke all on function workspace_private.validate_sotf_temporal_operation_event() from public,anon,authenticated;

-- The prior function already builds and byte-bounds the complete projection.
-- Its original return intentionally exposed only semantics. Promote that
-- already-computed value without duplicating the reconstruction algorithm.
do $migration$
declare
  body text;
  old_return text := $old$  return jsonb_build_object(
    'truncated_sections',to_jsonb((select coalesce(array_agg(name order by workspace_private.sotf_v1_order_key(name)),'{}'::text[]) from (select distinct name from unnest(truncated) name) names)),
    'eligible_refs',eligible_refs
  );$old$;
  new_return text := $new$  return projection || jsonb_build_object('eligible_refs',eligible_refs);$new$;
begin
  select prosrc into body
  from pg_catalog.pg_proc
  where oid = 'workspace_private.sotf_v1_daily_brief_projection_semantics(uuid,date,text)'::regprocedure;
  body := replace(body,E'\r\n',E'\n');
  old_return := replace(old_return,E'\r\n',E'\n');
  new_return := replace(new_return,E'\r\n',E'\n');
  if body is null or position(old_return in body) = 0
  then
    raise exception 'sotf_v1:unexpected_projection_authority_source' using errcode = '55000';
  end if;
  body := replace(body,old_return,new_return);
  if position(old_return in body) <> 0 or position(new_return in body) = 0 then
    raise exception 'sotf_v1:unexpected_projection_authority_rewrite' using errcode = '55000';
  end if;
  execute format(
    'create or replace function workspace_private.sotf_v1_daily_brief_projection_semantics(target_workspace uuid,target_brief_date date,target_time_zone text) returns jsonb language plpgsql stable security definer set search_path='''' as %L',
    body
  );
end;
$migration$;

create or replace function workspace_private.sotf_v1_daily_brief_boundary_authority(
  target_workspace uuid,
  target_brief_date date,
  target_time_zone text
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  semantics jsonb;
  projection jsonb;
  current_revision integer;
  local_today date;
  boundaries jsonb;
  window_start timestamptz;
  window_end timestamptz;
  projection_fingerprint text;
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
  projection := semantics - 'eligible_refs';
  projection_fingerprint := 'sha256:' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(workspace_private.sotf_v1_compact_json(projection - 'as_of'),'UTF8'),
      'sha256'
    ),
    'hex'
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
    'truncated_sections', projection -> 'truncated_sections',
    'projection_fingerprint', projection_fingerprint
  );
  authority_token := 'sha256:' || pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(authority_material::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return authority_material || jsonb_build_object(
    'authority_token', authority_token,
    'as_of', projection ->> 'as_of',
    'projection', projection
  );
end; $$;

comment on function workspace_private.validate_sotf_temporal_operation_event() is
  'Database authority for exact SOTF event timestamps, interval ordering, and persisted temporal validity.';
comment on function workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text) is
  'Returns the complete database-built projection and an independent current-authority fingerprint; callers do not recreate temporal eligibility.';
