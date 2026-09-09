-- P9e: bounded, live-authorized Executive outcome history. No private history RPC is widened.
begin;
-- Optional for compatibility with earlier reviews; new history-based reviews save their zone.
alter function workspace_private.executive_schema(text) rename to executive_schema_v2;
create function workspace_private.executive_schema(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='weekly_review' then jsonb_set(workspace_private.executive_schema_v2(p_kind),
  '{properties,timeZone}',$zone${"type":"string","minLength":1,"maxLength":100}$zone$::jsonb)
  else workspace_private.executive_schema_v2(p_kind) end;
$$;
alter function workspace_private.validate_executive(text,jsonb) rename to validate_executive_v2;
create function workspace_private.validate_executive(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
begin
 perform workspace_private.validate_executive_v2(p_kind,p_data);
 if p_kind='weekly_review' and p_data ? 'timeZone'
  and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timeZone')
 then raise exception 'Use a supported weekly-review time zone.' using errcode='22023'; end if;
end; $$;
revoke all on function workspace_private.executive_schema(text),workspace_private.validate_executive(text,jsonb) from public,anon,authenticated;
create index executive_versions_recorded_window on workspace_private.executive_versions(workspace_id,updated_at desc,document_id,revision);

create function workspace_private.executive_outcome_rules() returns jsonb
language sql immutable set search_path='' as $$
 select $rules${"commitment":{"outcomes":["completed"],"corrections":["completedOn","outcome"],"retainOn":[]},"decision":{"outcomes":["decided","reversed"],"corrections":["decidedOn","selectedOptionId","rationale"],"retainOn":[]},"meeting":{"outcomes":["held"],"corrections":["startsAt","outcome"],"retainOn":[]},"daily_brief":{"outcomes":["reviewed"],"corrections":["summary","reflection","observations"],"retainOn":["archived"]},"weekly_review":{"outcomes":["reviewed"],"corrections":["summary","reflection","observations"],"retainOn":["archived"]},"action":{"outcomes":["completed"],"corrections":["title","evidence"],"retainOn":[]}}$rules$::jsonb;
$$;
create function workspace_private.executive_outcome_change(p_kind text,p_before jsonb,p_after jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare rule jsonb:=workspace_private.executive_outcome_rules()->p_kind;
 old_state text:=p_before->>'state'; new_state text:=p_after->>'state'; change_kind text; outcome text;
begin
 if rule is null then return null; end if;
 if coalesce(rule->'outcomes' ? new_state,false) and new_state is distinct from old_state then
  change_kind:='recorded'; outcome:=new_state;
 elsif coalesce(rule->'outcomes' ? old_state,false) and not coalesce(rule->'outcomes' ? new_state,false)
   and not coalesce(rule->'retainOn' ? new_state,false) then
  change_kind:='withdrawn'; outcome:=old_state;
 elsif coalesce(rule->'outcomes' ? new_state,false) and exists(
  select 1 from jsonb_array_elements_text(rule->'corrections') k
  where coalesce(p_before->k,'null'::jsonb) is distinct from coalesce(p_after->k,'null'::jsonb)
 ) then change_kind:='corrected'; outcome:=new_state;
 else return null;
 end if;
 return jsonb_build_object('change',change_kind,'outcome',outcome,'previousState',old_state,'state',new_state,
  'reportedDate',case p_kind when 'commitment' then p_after->'completedOn' when 'decision' then p_after->'decidedOn' else null end,
  'previousReportedDate',case p_kind when 'commitment' then p_before->'completedOn' when 'decision' then p_before->'decidedOn' else null end);
end; $$;

-- This private helper returns only a fixed projection, never full revision bodies.
create function workspace_private.executive_weekly_events(p_target uuid,p_start timestamptz,p_end timestamptz,p_through timestamptz)
returns table(event_id text,capability_id text,recorded_at timestamptz,event jsonb)
language sql stable security definer set search_path='' as $$
 with versions as materialized (
  select v.*,b.data before_data,d.data current_data,d.revision current_revision
  from workspace_private.executive_versions v
  join workspace_private.executive_documents d on d.workspace_id=v.workspace_id and d.id=v.document_id and d.kind=v.kind
  left join workspace_private.executive_versions b on b.workspace_id=v.workspace_id and b.document_id=v.document_id and b.revision=v.revision-1
  where v.workspace_id=p_target and v.updated_at>=p_start and v.updated_at<p_end and v.updated_at<=p_through
   and workspace_private.bundle_capability_active(p_target,'executive',workspace_private.executive_capability(v.kind))
 ), subjects as (
  select v.document_id,v.revision,v.kind,v.updated_at,v.origin,v.data->>'title' parent_title,
   v.current_revision,null::uuid item_id,v.before_data before_value,v.data after_value,v.current_data current_value,v.kind subject_kind
  from versions v
  union all
  select v.document_id,v.revision,v.kind,v.updated_at,v.origin,v.data->>'title',
   v.current_revision,i.id,b.value,a.value,c.value,'action'
  from versions v
  cross join lateral (
   select (x->>'id')::uuid id from jsonb_array_elements(coalesce(v.before_data->'actions','[]'::jsonb)) x
   union select (x->>'id')::uuid from jsonb_array_elements(coalesce(v.data->'actions','[]'::jsonb)) x
  ) i
  left join lateral (select x value from jsonb_array_elements(coalesce(v.before_data->'actions','[]'::jsonb)) x where (x->>'id')::uuid=i.id) b on true
  left join lateral (select x value from jsonb_array_elements(coalesce(v.data->'actions','[]'::jsonb)) x where (x->>'id')::uuid=i.id) a on true
  left join lateral (select x value from jsonb_array_elements(coalesce(v.current_data->'actions','[]'::jsonb)) x where (x->>'id')::uuid=i.id) c on true
 ), changes as (
  select s.*,workspace_private.executive_outcome_change(subject_kind,before_value,after_value) change_value,
   document_id::text||':'||lpad(revision::text,10,'0')||':'||coalesce(item_id::text,'record') id_value,
   workspace_private.executive_capability(kind) capability
  from subjects s
 )
 select id_value,capability,updated_at,change_value||jsonb_build_object(
  'id',id_value,'source',jsonb_build_object('capabilityId',capability,'kind',kind,'documentId',document_id,'revision',revision)
    ||case when item_id is null then '{}'::jsonb else jsonb_build_object('item',jsonb_build_object('kind','action','id',item_id)) end,
  'title',coalesce(after_value->>'title',before_value->>'title'),'parentTitle',parent_title,
  'recordedAt',updated_at,'origin',origin,'reviewState',coalesce(after_value->>'reviewState',before_value->>'reviewState'),
  'currentRevision',current_revision,'currentState',current_value->>'state','currentTargetPresent',current_value is not null
 )
 from changes where change_value is not null;
$$;

create function workspace.executive_weekly_outcomes(
 p_period_start date,p_period_end date,p_time_zone text,
 p_recorded_through timestamptz default null,p_offset integer default 0,p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive('weekly_review');
 checked_at timestamptz:=statement_timestamp(); cutoff timestamptz:=coalesce(p_recorded_through,checked_at);
 start_at timestamptz; end_at timestamptz;
begin
 if p_period_start is null or p_period_end is null or p_period_end-p_period_start not between 0 and 6
  or p_offset is null or p_offset not between 0 and 2147483000 or p_limit is null or p_limit not between 1 and 50
  or p_time_zone is null or length(p_time_zone)>100 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone)
  or cutoff>checked_at or not isfinite(cutoff) or not isfinite(p_period_start) or not isfinite(p_period_end)
 then raise exception 'Choose a valid weekly recorded-time window and page.' using errcode='22023'; end if;
 start_at:=p_period_start::timestamp at time zone p_time_zone;
 end_at:=(p_period_end+1)::timestamp at time zone p_time_zone;
 if start_at>=end_at then raise exception 'This local date window does not exist.' using errcode='22023'; end if;
 return (
  with events as materialized (select * from workspace_private.executive_weekly_events(target,start_at,end_at,cutoff)),
  coverage as (
   select cap,workspace_private.bundle_capability_active(target,'executive',cap) active from
    unnest(array['executive.coordination','executive.brief','executive.review']) cap
  ), page as (
   select * from events order by recorded_at desc,event_id collate "C" desc limit p_limit offset p_offset
  )
  select jsonb_build_object('schemaVersion','1.0','periodStart',p_period_start,'periodEnd',p_period_end,'timeZone',p_time_zone,
   'windowStart',start_at,'windowEndExclusive',end_at,'recordedThrough',cutoff,'retrievedAt',checked_at,
   'consistency','recorded_time_cutoff_live_access','offset',p_offset,'limit',p_limit,
   'total',(select count(*) from events),
   'events',coalesce((select jsonb_agg(event order by recorded_at desc,event_id collate "C" desc) from page),'[]'::jsonb),
   'coverage',(select jsonb_agg(jsonb_build_object('capabilityId',cap,'state',case when active then 'current' else 'unavailable' end,
    'total',case when active then (select count(*) from events e where e.capability_id=cap) else null end) order by cap) from coverage)
  )
 );
end; $$;
revoke all on function workspace_private.executive_outcome_rules(),
 workspace_private.executive_outcome_change(text,jsonb,jsonb),
 workspace_private.executive_weekly_events(uuid,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
