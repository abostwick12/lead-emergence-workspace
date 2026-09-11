-- P23: native Executive review schedules. Occurrences are evaluated only while a direct user opens Executive.
-- This is not a background runner, provider send, assistant capability, or canonical Executive record creation path.

alter function workspace.executive_review_attention(date,integer,integer) rename to executive_review_attention_ungrouped;
revoke all on function workspace.executive_review_attention_ungrouped(date,integer,integer) from public,anon,authenticated;

create function workspace.executive_review_attention(p_as_of_date date default current_date,p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; grouped jsonb;
begin
 result:=workspace.executive_review_attention_ungrouped(p_as_of_date,p_offset,p_limit);
 select coalesce(jsonb_agg(jsonb_build_object('groupKey',group_key,'total',total) order by group_order),'[]'::jsonb)
 into grouped from (
  select g.group_key,g.group_order,sum((c.value->>'total')::integer)::integer total
  from (values ('executive',1),('writer_editor',2),('ministry',3),('nonprofit_founder',4),('investor',5)) g(group_key,group_order)
  join jsonb_array_elements(result->'coverage') c on c.value->>'state'='current' and
   case g.group_key when 'executive' then c.value->>'capabilityId' like 'executive.%'
    when 'writer_editor' then c.value->>'capabilityId' like 'writer.%'
    when 'ministry' then c.value->>'capabilityId' like 'ministry.%'
    when 'nonprofit_founder' then c.value->>'capabilityId' like 'nonprofit.%'
    when 'investor' then c.value->>'capabilityId' like 'investor.%' end
  group by g.group_key,g.group_order having sum((c.value->>'total')::integer)>0
 ) groups;
 return result||jsonb_build_object('groups',grouped);
end; $$;

create function workspace_private.executive_delivery_weekdays_valid(p_days smallint[]) returns boolean
language sql immutable set search_path='' as $$
 select cardinality(p_days) between 1 and 7 and p_days<@array[1,2,3,4,5,6,7]::smallint[]
 and cardinality(p_days)=(select count(distinct d) from unnest(p_days)d);
$$;

create table workspace_private.executive_delivery_schedules(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 delivery_kind text not null check(delivery_kind in ('daily_brief','weekly_review')),
 label text not null check(char_length(btrim(label)) between 5 and 120),
 time_zone text not null,
 cadence_kind text not null check(cadence_kind in ('daily','weekly')),
 weekdays smallint[] not null default '{}',
 local_time time without time zone not null,
 change_policy text not null check(change_policy in ('always','when_attention_summary_changes')),
 status text not null default 'active' check(status in ('active','paused','cancelled')),
 next_occurrence timestamptz,
 last_attention_fingerprint text check(last_attention_fingerprint is null or last_attention_fingerprint~'^[0-9a-f]{64}$'),
 last_evaluated_at timestamptz,last_delivered_at timestamptz,
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((delivery_kind='daily_brief' and cadence_kind='daily' and cardinality(weekdays)=0)
  or (delivery_kind='weekly_review' and cadence_kind='weekly' and workspace_private.executive_delivery_weekdays_valid(weekdays))),
 check((status='active')=(next_occurrence is not null))
);
create unique index executive_delivery_current_kind on workspace_private.executive_delivery_schedules(workspace_id,delivery_kind)
 where status<>'cancelled';
create index executive_delivery_due on workspace_private.executive_delivery_schedules(workspace_id,next_occurrence)
 where status='active';

create table workspace_private.executive_delivery_events(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 schedule_id uuid not null references workspace_private.executive_delivery_schedules(id) on delete cascade,
 schedule_version bigint not null check(schedule_version between 1 and 9007199254740991),
 delivery_kind text not null check(delivery_kind in ('daily_brief','weekly_review')),
 label text not null check(char_length(btrim(label)) between 5 and 120),
 due_at timestamptz not null,evaluated_at timestamptz not null default now(),
 outcome text not null check(outcome in ('ready','skipped_unchanged')),
 reason text not null check(char_length(btrim(reason)) between 10 and 500),
 current_attention_count integer not null check(current_attention_count>=0),
 inspected_attention_count integer not null check(inspected_attention_count between 0 and 50),
 inspected_high_priority_count integer not null check(inspected_high_priority_count between 0 and 50),
 route text not null check(route in ('/workspace/executive/daily_brief/new','/workspace/executive/weekly_review/new')),
 attention_fingerprint text not null check(attention_fingerprint~'^[0-9a-f]{64}$'),
 unique(schedule_id,due_at),
 check(inspected_high_priority_count<=inspected_attention_count and inspected_attention_count<=current_attention_count),
 check((delivery_kind='daily_brief')=(route='/workspace/executive/daily_brief/new'))
);
create index executive_delivery_event_history on workspace_private.executive_delivery_events(workspace_id,evaluated_at desc,id desc);

create table workspace_private.executive_delivery_requests(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 request_id uuid not null,input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(workspace_id,request_id)
);

alter table workspace_private.executive_delivery_schedules enable row level security;
alter table workspace_private.executive_delivery_events enable row level security;
alter table workspace_private.executive_delivery_requests enable row level security;
revoke all on workspace_private.executive_delivery_schedules,workspace_private.executive_delivery_events,
 workspace_private.executive_delivery_requests from public,anon,authenticated;

create function workspace_private.executive_delivery_capability(p_kind text) returns text
language sql immutable set search_path='' as $$
 select case p_kind when 'daily_brief' then 'executive.brief' when 'weekly_review' then 'executive.review' end;
$$;

create function workspace_private.executive_delivery_object_length(p_value jsonb) returns integer
language sql immutable set search_path='' as $$select count(*)::integer from jsonb_object_keys(p_value)$$;

-- PostgreSQL resolves daylight-saving gaps and repeated local times deterministically for a named zone.
-- The first representable candidate strictly after p_after is returned, so a late page visit never floods missed periods.
create function workspace_private.executive_delivery_next(p_zone text,p_cadence text,p_weekdays smallint[],p_local_time time,p_after timestamptz)
returns timestamptz language plpgsql stable set search_path='' as $$
declare local_date date;candidate timestamptz;step integer;
begin
 if p_after is null or p_cadence not in ('daily','weekly') or p_local_time is null
  or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_zone)
  or (p_cadence='daily' and cardinality(p_weekdays)<>0)
  or (p_cadence='weekly' and not workspace_private.executive_delivery_weekdays_valid(p_weekdays)) then
  raise exception 'Use a supported named time zone and cadence.' using errcode='22023';
 end if;
 for step in 0..14 loop
  local_date:=(p_after at time zone p_zone)::date+step;
  if p_cadence='daily' or extract(isodow from local_date)::smallint=any(p_weekdays) then
   candidate:=(local_date+p_local_time) at time zone p_zone;
   if candidate>p_after then return candidate; end if;
  end if;
 end loop;
 raise exception 'The next scheduled occurrence could not be determined.' using errcode='22023';
end; $$;

create function workspace_private.validate_executive_delivery_definition(p_definition jsonb) returns void
language plpgsql stable set search_path='' as $$
declare cadence jsonb;kind text;cadence_kind text;label_value text;days smallint[];
begin
 if p_definition is null or jsonb_typeof(p_definition)<>'object'
  or workspace_private.executive_delivery_object_length(p_definition)<>7
  or p_definition-array['schemaVersion','deliveryKind','label','timeZone','cadence','changePolicy','deliveryTarget']<>'{}'::jsonb
  or p_definition->>'schemaVersion'<>'1.0' or p_definition->>'deliveryKind' not in ('daily_brief','weekly_review')
  or jsonb_typeof(p_definition->'label') is distinct from 'string'
  or jsonb_typeof(p_definition->'timeZone') is distinct from 'string'
  or jsonb_typeof(p_definition->'cadence') is distinct from 'object'
  or p_definition->>'changePolicy' not in ('always','when_attention_summary_changes')
  or p_definition->>'deliveryTarget'<>'native_executive_inbox' then
  raise exception 'Review a complete native Executive schedule.' using errcode='22023';
 end if;
 kind:=p_definition->>'deliveryKind';label_value:=btrim(p_definition->>'label');cadence:=p_definition->'cadence';cadence_kind:=cadence->>'kind';
 if char_length(label_value)<5 or char_length(label_value)+char_length(regexp_replace(label_value,U&'[\0001-\FFFF]','','g'))>120
  or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_definition->>'timeZone')
  or cadence->>'localTime' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  or (kind='daily_brief' and (cadence_kind<>'daily' or cadence-array['kind','localTime']<>'{}'::jsonb))
  or (kind='weekly_review' and (cadence_kind<>'weekly' or cadence-array['kind','localTime','weekdays']<>'{}'::jsonb
   or jsonb_typeof(cadence->'weekdays') is distinct from 'array')) then
  raise exception 'Review the schedule label, time zone and cadence.' using errcode='22023';
 end if;
 if (kind='daily_brief' and workspace_private.executive_delivery_object_length(cadence)<>2)
  or (kind='weekly_review' and workspace_private.executive_delivery_object_length(cadence)<>3) then
  raise exception 'Review a complete cadence without extra fields.' using errcode='22023';
 end if;
 if kind='weekly_review' then
  if jsonb_array_length(cadence->'weekdays') not between 1 and 7
   or exists(select 1 from jsonb_array_elements(cadence->'weekdays')d where jsonb_typeof(d)<>'number' or d#>>'{}' !~ '^[1-7]$') then
   raise exception 'Choose one to seven distinct weekdays.' using errcode='22023';
  end if;
  select array_agg((d#>>'{}')::smallint order by (d#>>'{}')::smallint) into days from jsonb_array_elements(cadence->'weekdays')d;
  if not workspace_private.executive_delivery_weekdays_valid(days) then raise exception 'Choose each weekday once.' using errcode='22023'; end if;
 end if;
end; $$;

create function workspace_private.executive_delivery_schedule_item(p_schedule workspace_private.executive_delivery_schedules,p_replayed boolean)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'scheduleId',p_schedule.id,'version',p_schedule.version,
  'definition',jsonb_build_object('schemaVersion','1.0','deliveryKind',p_schedule.delivery_kind,'label',p_schedule.label,
   'timeZone',p_schedule.time_zone,'cadence',case p_schedule.cadence_kind when 'daily' then
    jsonb_build_object('kind','daily','localTime',to_char(p_schedule.local_time,'HH24:MI')) else
    jsonb_build_object('kind','weekly','localTime',to_char(p_schedule.local_time,'HH24:MI'),'weekdays',to_jsonb(p_schedule.weekdays)) end,
   'changePolicy',p_schedule.change_policy,'deliveryTarget','native_executive_inbox'),
  'status',p_schedule.status,'capabilityAvailable',workspace_private.bundle_capability_active(p_schedule.workspace_id,'executive',
   workspace_private.executive_delivery_capability(p_schedule.delivery_kind)),
  'nextOccurrence',p_schedule.next_occurrence,'lastEvaluatedAt',p_schedule.last_evaluated_at,
  'lastDeliveredAt',p_schedule.last_delivered_at,'createdAt',p_schedule.created_at,'updatedAt',p_schedule.updated_at,'replayed',p_replayed);
$$;

create function workspace.executive_change_delivery(p_change jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any();request_id uuid;operation text;expected bigint;schedule_id uuid;
 definition jsonb;kind text;cadence jsonb;days smallint[]:='{}';saved workspace_private.executive_delivery_requests%rowtype;
 current_schedule workspace_private.executive_delivery_schedules%rowtype;result jsonb;next_at timestamptz;
begin
 perform workspace_private.executive_direct_user();
 if p_change is null or jsonb_typeof(p_change)<>'object'
  or workspace_private.executive_delivery_object_length(p_change)<>6
  or p_change-array['scheduleId','expectedVersion','requestId','operation','definition','confirmExactSchedule']<>'{}'::jsonb
  or p_change->>'operation' not in ('create','update','pause','resume','cancel')
  or jsonb_typeof(p_change->'expectedVersion') is distinct from 'number' or p_change->>'expectedVersion'!~'^(0|[1-9][0-9]{0,15})$'
  or (p_change->>'expectedVersion')::numeric>9007199254740991
  or coalesce(p_change->>'requestId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or p_change->'confirmExactSchedule' is distinct from 'true'::jsonb then
  raise exception 'Review and confirm an exact Executive schedule change.' using errcode='22023';
 end if;
 operation:=p_change->>'operation';expected:=(p_change->>'expectedVersion')::bigint;request_id:=(p_change->>'requestId')::uuid;definition:=p_change->'definition';
 if operation='create' then
  if p_change->'scheduleId'<>'null'::jsonb or expected<>0 or jsonb_typeof(definition)<>'object' then
   raise exception 'Schedule identity and version do not match creation.' using errcode='22023'; end if;
 else
  if jsonb_typeof(p_change->'scheduleId') is distinct from 'string' or coalesce(p_change->>'scheduleId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or expected<1 then raise exception 'Schedule identity and version do not match this change.' using errcode='22023'; end if;
  schedule_id:=(p_change->>'scheduleId')::uuid;
 end if;
 if operation in ('create','update') then perform workspace_private.validate_executive_delivery_definition(definition);
 elsif definition<>'null'::jsonb then raise exception 'Only creation and update carry a schedule definition.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('executive-delivery:'||target::text,0));
 if operation<>'create' then
  select * into current_schedule from workspace_private.executive_delivery_schedules s where s.workspace_id=target and s.id=schedule_id for update;
  if not found then raise exception 'Executive schedule unavailable.' using errcode='42501'; end if;
  kind:=current_schedule.delivery_kind;
  if operation='update' and definition->>'deliveryKind'<>kind then raise exception 'Cancel this schedule before changing its delivery type.' using errcode='22023'; end if;
 else kind:=definition->>'deliveryKind'; end if;
 if operation in ('create','update','resume') then perform workspace_private.require_executive(kind); end if;
 select * into saved from workspace_private.executive_delivery_requests r where r.workspace_id=target and r.request_id=request_id;
 if found then
  if saved.input is distinct from p_change then raise exception 'This request identifier was already used.' using errcode='40001'; end if;
  return jsonb_set(saved.result,'{replayed}','true');
 end if;
 if operation='create' then
  if exists(select 1 from workspace_private.executive_delivery_schedules s where s.workspace_id=target and s.delivery_kind=kind and s.status<>'cancelled')
   then raise exception 'A current schedule already exists for this review.' using errcode='40001'; end if;
  cadence:=definition->'cadence';
  if kind='weekly_review' then select array_agg((d#>>'{}')::smallint order by (d#>>'{}')::smallint) into days from jsonb_array_elements(cadence->'weekdays')d; end if;
  next_at:=workspace_private.executive_delivery_next(definition->>'timeZone',cadence->>'kind',days,(cadence->>'localTime')::time,now());
  insert into workspace_private.executive_delivery_schedules(workspace_id,delivery_kind,label,time_zone,cadence_kind,weekdays,local_time,change_policy,next_occurrence)
  values(target,kind,btrim(definition->>'label'),definition->>'timeZone',cadence->>'kind',days,(cadence->>'localTime')::time,definition->>'changePolicy',next_at)
  returning * into current_schedule;
 else
  if current_schedule.version<>expected then raise exception 'Executive schedule changed. Refresh and review again.' using errcode='40001'; end if;
  if current_schedule.status='cancelled' then raise exception 'A cancelled schedule cannot be changed.' using errcode='40001'; end if;
  if operation='update' then
   cadence:=definition->'cadence';days:='{}';
   if kind='weekly_review' then select array_agg((d#>>'{}')::smallint order by (d#>>'{}')::smallint) into days from jsonb_array_elements(cadence->'weekdays')d; end if;
   next_at:=case when current_schedule.status='active' then workspace_private.executive_delivery_next(definition->>'timeZone',cadence->>'kind',days,(cadence->>'localTime')::time,now()) end;
   update workspace_private.executive_delivery_schedules set label=btrim(definition->>'label'),time_zone=definition->>'timeZone',
    cadence_kind=cadence->>'kind',weekdays=days,local_time=(cadence->>'localTime')::time,change_policy=definition->>'changePolicy',
    next_occurrence=next_at,version=version+1,updated_at=now() where id=current_schedule.id returning * into current_schedule;
  elsif operation='pause' then
   if current_schedule.status<>'active' then raise exception 'Only an active schedule can be paused.' using errcode='40001'; end if;
   update workspace_private.executive_delivery_schedules set status='paused',next_occurrence=null,version=version+1,updated_at=now()
   where id=current_schedule.id returning * into current_schedule;
  elsif operation='resume' then
   if current_schedule.status<>'paused' then raise exception 'Only a paused schedule can be resumed.' using errcode='40001'; end if;
   next_at:=workspace_private.executive_delivery_next(current_schedule.time_zone,current_schedule.cadence_kind,current_schedule.weekdays,current_schedule.local_time,now());
   update workspace_private.executive_delivery_schedules set status='active',next_occurrence=next_at,version=version+1,updated_at=now()
   where id=current_schedule.id returning * into current_schedule;
  else
   update workspace_private.executive_delivery_schedules set status='cancelled',next_occurrence=null,version=version+1,updated_at=now()
   where id=current_schedule.id returning * into current_schedule;
  end if;
 end if;
 result:=workspace_private.executive_delivery_schedule_item(current_schedule,false);
 insert into workspace_private.executive_delivery_requests(workspace_id,request_id,input,result) values(target,request_id,p_change,result);
 return result;
end; $$;

create function workspace.executive_deliveries() returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any();schedule workspace_private.executive_delivery_schedules%rowtype;
 attention jsonb;fingerprint text;outcome text;reason text;inspected integer;high integer;listed_ids uuid[];
begin
 perform workspace_private.executive_direct_user();
 perform pg_advisory_xact_lock(hashtextextended('executive-delivery:'||target::text,0));
 for schedule in select s.* from workspace_private.executive_delivery_schedules s where s.workspace_id=target and s.status='active'
  and s.next_occurrence<=now() and workspace_private.bundle_capability_active(target,'executive',workspace_private.executive_delivery_capability(s.delivery_kind))
  order by s.next_occurrence,s.id for update loop
  attention:=workspace.executive_review_attention((now() at time zone schedule.time_zone)::date,0,50);
  fingerprint:=encode(extensions.digest((attention-array['retrievedAt','asOfDate','offset','limit'])::text,'sha256'),'hex');
  inspected:=jsonb_array_length(attention->'items');
  select count(*) into high from jsonb_array_elements(attention->'items')i where i->>'priority'='high';
  outcome:=case when schedule.change_policy='always' or schedule.last_attention_fingerprint is distinct from fingerprint then 'ready' else 'skipped_unchanged' end;
  reason:=case outcome when 'ready' then 'The scheduled native review is ready. Review current saved-work cues; no record was created or sent.'
   else 'The bounded attention summary was unchanged, so no new native review was prepared.' end;
  insert into workspace_private.executive_delivery_events(workspace_id,schedule_id,schedule_version,delivery_kind,label,due_at,
   outcome,reason,current_attention_count,inspected_attention_count,inspected_high_priority_count,route,attention_fingerprint)
  values(target,schedule.id,schedule.version,schedule.delivery_kind,schedule.label,schedule.next_occurrence,outcome,reason,
   (attention->>'total')::integer,inspected,high,'/workspace/executive/'||schedule.delivery_kind||'/new',fingerprint);
  update workspace_private.executive_delivery_schedules set last_attention_fingerprint=fingerprint,last_evaluated_at=now(),
   last_delivered_at=case when outcome='ready' then now() else last_delivered_at end,
   next_occurrence=workspace_private.executive_delivery_next(time_zone,cadence_kind,weekdays,local_time,greatest(now(),next_occurrence)),updated_at=now()
  where id=schedule.id;
 end loop;
 select coalesce(array_agg(id),'{}') into listed_ids from (select s.id from workspace_private.executive_delivery_schedules s
  where s.workspace_id=target order by s.created_at desc,s.id desc limit 20)x;
 return jsonb_build_object('schemaVersion','1.0','workspaceId',target,'authorityRevision',workspace.get_bundle_experience()->>'revision',
  'serverNow',now(),'backgroundDeliveryAvailable',false,
  'schedules',coalesce((select jsonb_agg(workspace_private.executive_delivery_schedule_item(s,false) order by s.created_at desc,s.id desc)
   from workspace_private.executive_delivery_schedules s where s.id=any(listed_ids)),'[]'::jsonb),
  'deliveries',coalesce((select jsonb_agg(jsonb_build_object('deliveryId',e.id,'scheduleId',e.schedule_id,'scheduleVersion',e.schedule_version,
   'deliveryKind',e.delivery_kind,'label',e.label,'dueAt',e.due_at,'evaluatedAt',e.evaluated_at,'outcome',e.outcome,'reason',e.reason,
   'currentAttentionCount',e.current_attention_count,'inspectedAttentionCount',e.inspected_attention_count,
   'inspectedHighPriorityCount',e.inspected_high_priority_count,'route',e.route,'requiresUserReview',true,
   'externalDelivery',false,'recordCreated',false) order by e.evaluated_at desc,e.id desc)
   from (select x.* from workspace_private.executive_delivery_events x where x.workspace_id=target and x.schedule_id=any(listed_ids)
    order by x.evaluated_at desc,x.id desc limit 50)e),'[]'::jsonb));
end; $$;

revoke all on function workspace.executive_review_attention_ungrouped(date,integer,integer),
 workspace_private.executive_delivery_weekdays_valid(smallint[]),workspace_private.executive_delivery_capability(text),
 workspace_private.executive_delivery_object_length(jsonb),
 workspace_private.executive_delivery_next(text,text,smallint[],time without time zone,timestamptz),
 workspace_private.validate_executive_delivery_definition(jsonb),
 workspace_private.executive_delivery_schedule_item(workspace_private.executive_delivery_schedules,boolean),
 workspace.executive_review_attention(date,integer,integer),workspace.executive_change_delivery(jsonb),workspace.executive_deliveries()
 from public,anon,authenticated;
grant execute on function workspace.executive_review_attention(date,integer,integer),workspace.executive_change_delivery(jsonb),workspace.executive_deliveries() to authenticated;
notify pgrst,'reload schema';
