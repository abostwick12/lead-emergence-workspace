-- P14: native current-condition inbox, not a delivery queue or historical event log.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description)
values('workspace_notifications','Workspace notifications','Review source-linked current conditions and control their visibility.') on conflict do nothing;
insert into workspace.bundle_capabilities values('workspace_experience','workspace_notifications') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
('workspace_experience','workspace_notifications','workspace.notifications') on conflict do nothing;

create table workspace_private.notification_settings(
 workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
 version bigint not null default 0 check(version between 0 and 9007199254740991)
);
create table workspace_private.notification_preferences(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,type_id text not null,enabled boolean not null,
 primary key(workspace_id,type_id)
);
create table workspace_private.notification_states(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,signal_id text not null,
 signal_revision text not null,disposition text not null check(disposition in ('read','unread','dismiss','snooze')),
 snoozed_until timestamptz,primary key(workspace_id,signal_id)
);
create table workspace_private.notification_receipts(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,request_id uuid not null,
 input jsonb not null,result jsonb not null,primary key(workspace_id,request_id)
);
alter table workspace_private.notification_settings enable row level security;
alter table workspace_private.notification_preferences enable row level security;
alter table workspace_private.notification_states enable row level security;
alter table workspace_private.notification_receipts enable row level security;
revoke all on workspace_private.notification_settings,workspace_private.notification_preferences,
 workspace_private.notification_states,workspace_private.notification_receipts from public,anon,authenticated;

create function workspace_private.require_notification_owner() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 target:=workspace_private.require_connection_center_owner();
 if target is distinct from workspace_private.require_bundle_workspace()
 or not workspace_private.bundle_capability_active(target,'workspace_experience','workspace.notifications') then
  raise exception 'Native notifications are unavailable.' using errcode='42501';
 end if;
 return target;
end; $$;

create function workspace_private.notification_types(target uuid)
returns table(type_id text,bundle_key text,capability_id text)
language sql stable security definer set search_path='' as $$
 select t.* from (values
 ('writer.notification.publication_ready','writer_editor','writer.resource.library'),
 ('ministry.notification.teaching_due','ministry','ministry.research'),
 ('nonprofit.notification.followup_due','nonprofit_founder','nonprofit.partners'),
 ('investor.notification.thesis_change','investor','investor.thesis'),
 ('executive.notification.coordination_due','executive','executive.coordination'),
 ('executive.notification.brief_action_due','executive','executive.brief'),
 ('executive.notification.review_action_due','executive','executive.review'),
 ('workspace.notification.connection_required','workspace_experience','workspace.notifications')
 ) t(type_id,bundle_key,capability_id)
 where workspace_private.bundle_capability_active(target,t.bundle_key,t.capability_id);
$$;
create function workspace_private.notification_timezone() returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select p.timezone from workspace.user_profiles p join pg_catalog.pg_timezone_names z on z.name=p.timezone
 where p.user_id=auth.uid()),'UTC');
$$;

-- Only bounded metadata is returned; source content and credentials remain private.
-- Hashes track the actionable condition, not title spelling or request activity.
create index writing_notifications_ready_idx on workspace_private.writing_resources(workspace_id,id) where publication_state='ready';
create function workspace_private.notification_rows(target uuid)
returns table(signal_id text,signal_revision text,type_id text,title text,reason text,source_href text,source_label text,due_date date,priority text)
language sql security definer set search_path='' as $$
 with clock as (select (now() at time zone workspace_private.notification_timezone())::date today),
 types as materialized (select * from workspace_private.notification_types(target)),
 raw as (
 select 'writer.notification.publication_ready'::text typ,x.id::text ref,x.title,
 'This resource is marked ready. Review the saved work before publishing; no publication happened here.'::text reason,
 '/workspace/writing/'||x.id::text href,'Writing resource'::text label,null::date due,'ready'::text condition
 from workspace_private.writing_resources x where x.workspace_id=target and x.publication_state='ready'
 union all
 select 'ministry.notification.teaching_due',x.id::text,x.data->>'title',
 'The research project has a recorded date within seven days or in the past. Review its readiness.',
 '/workspace/ministry/research/'||x.id::text,'Ministry research',(x.data->>'dueDate')::date,'date'
 from workspace_private.ministry_documents x cross join clock c where x.workspace_id=target and x.kind='research'
 and x.data->>'status'<>'archived' and (x.data->>'dueDate')::date<=c.today+7
 union all
 select 'nonprofit.notification.followup_due',x.id::text,x.data->>'title',
 'The partner record has a follow-up date today or earlier. Review the next contact; no outreach was sent.',
 '/workspace/nonprofit/partner/'||x.id::text,'Nonprofit partner',(x.data->>'followupDate')::date,'date'
 from workspace_private.nonprofit_documents x cross join clock c where x.workspace_id=target and x.kind='partner'
 and x.data->>'stage'<>'closed' and (x.data->>'followupDate')::date<=c.today
 union all
 select 'investor.notification.thesis_change',x.id::text,x.data->>'title',
 'The saved thesis records a challenged or invalidated assessment, or a triggered condition. This is a recorded concern, not a verified market alert.',
 '/workspace/investing/thesis/'||x.id::text,'Saved investor thesis',null::date,
 jsonb_build_array(x.data->>'changeAssessment',(select jsonb_agg(i->>'id' order by i->>'id')
 from jsonb_array_elements(coalesce(x.data->'invalidations','[]')) i where i->>'status'='triggered'))::text
 from workspace_private.investor_documents x where x.workspace_id=target and x.kind='thesis' and x.data->>'status'<>'archived'
 and (x.data->>'changeAssessment' in ('challenged','invalidated') or exists(
 select 1 from jsonb_array_elements(coalesce(x.data->'invalidations','[]')) i where i->>'status'='triggered'))
 union all
 select 'executive.notification.coordination_due',x.id::text,x.data->>'title',
 case when x.data->>'state'='blocked' then 'This saved commitment is marked blocked. Review the next move.'
 else 'This open commitment or decision has a recorded date today or earlier.' end,
 '/workspace/executive/'||x.kind||'/'||x.id::text,'Executive '||x.kind,
 least((x.data->>'dueDate')::date,(x.data->>'followupDate')::date),
 case when x.data->>'state'='blocked' then 'blocked' else 'date' end
 from workspace_private.executive_documents x cross join clock c
 where x.workspace_id=target and x.kind in ('commitment','decision') and x.data->>'state' in ('open','waiting','blocked','deferred')
 and (x.data->>'state'='blocked' or least((x.data->>'dueDate')::date,(x.data->>'followupDate')::date)<=c.today)
 union all
 select case x.kind when 'meeting' then 'executive.notification.coordination_due'
 when 'daily_brief' then 'executive.notification.brief_action_due' else 'executive.notification.review_action_due' end,
 x.id::text||':'||(a->>'id'),a->>'title',
 case when a->>'state'='blocked' then 'This saved action is marked blocked.' else 'This saved action has a recorded due date today or earlier.' end,
 '/workspace/executive/'||x.kind||'/'||x.id::text||'#task-action-'||(a->>'id'),
 'Action in '||left(x.data->>'title',175),(a->>'dueDate')::date,case when a->>'state'='blocked' then 'blocked' else 'date' end
 from workspace_private.executive_documents x cross join clock c cross join lateral jsonb_array_elements(coalesce(x.data->'actions','[]')) a
 where x.workspace_id=target and x.kind in ('meeting','daily_brief','weekly_review') and x.data->>'state' not in ('archived','cancelled')
 and a->>'state' in ('open','waiting','blocked') and (a->>'state'='blocked' or (a->>'dueDate')::date<=c.today)
 union all
 select 'workspace.notification.connection_required',x.connection_id,
 case when x.kind='assistant' then 'Assistant access · '||left(x.connection_id,8) else initcap(x.item->>'family')||' saved access' end,
 case when x.kind='assistant' then 'An active Workspace grant is unfinished or blocked. Review this saved access; no live assistant test was performed.'
 else 'The stored credential has expired. Review or remove this saved access; no provider check or refresh was attempted.' end,
 '/workspace/integrations','Connection reference '||left(x.connection_id,8),null::date,
 x.revision||':'||coalesce(x.item->>'state',x.item->>'credentialState')
 from workspace_private.connection_center_rows(target) x
 where (x.kind='assistant' and x.item->>'grantActive'='true' and x.item->>'state' in ('setup_required','blocked'))
 or (x.kind='external' and x.item->>'credentialState'='expired')
 )
 select encode(extensions.digest(target::text||':'||r.typ||':'||r.ref,'sha256'),'hex'),
 encode(extensions.digest(jsonb_build_array(r.condition,r.due,
 case when r.due<c.today then 'overdue' when r.due=c.today then 'today' when r.due is not null then 'upcoming' else 'undated' end)::text,'sha256'),'hex'),
 r.typ,left(r.title,300),r.reason,r.href,r.label,r.due,
 case when r.due<c.today or r.condition='blocked' or r.typ='investor.notification.thesis_change' then 'high' else 'normal' end
 from raw r join types t on t.type_id=r.typ cross join clock c;
$$;

create function workspace.native_notifications(p_view text default 'inbox',p_type_id text default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_notification_owner(); zone text:=workspace_private.notification_timezone();
begin
 if p_view is null or p_view not in ('inbox','unread','later','dismissed','muted') or p_offset is null
 or p_offset not between 0 and 2147483000 or p_offset%25<>0 then
  raise exception 'Choose a valid notification view and page.' using errcode='22023';
 end if;
 if p_type_id is not null and not exists(select 1 from workspace_private.notification_types(target) where type_id=p_type_id) then
  raise exception 'Notification type unavailable.' using errcode='42501';
 end if;
 return (with types as materialized (
 select t.type_id,coalesce(p.enabled,true) enabled from workspace_private.notification_types(target) t
 left join workspace_private.notification_preferences p on p.workspace_id=target and p.type_id=t.type_id
 ), rows as materialized (
 select n.*,s.snoozed_until,case when not t.enabled then 'muted' when s.disposition='dismiss' then 'dismissed'
 when s.disposition='snooze' and s.snoozed_until>now() then 'later' when s.disposition='read' then 'read' else 'unread' end status
 from workspace_private.notification_rows(target) n join types t on t.type_id=n.type_id
 left join workspace_private.notification_states s on s.workspace_id=target and s.signal_id=n.signal_id and s.signal_revision=n.signal_revision
 ), filtered as materialized (
 select * from rows where (p_type_id is null or type_id=p_type_id) and
 (case p_view when 'inbox' then status in ('read','unread') else status=p_view end)
 ), page as (select * from filtered order by case priority when 'high' then 0 else 1 end,due_date nulls last,signal_id offset p_offset limit 25)
 select jsonb_build_object('workspaceId',target,'authorityRevision',workspace.get_bundle_experience()->>'revision',
 'retrievedAt',now(),'timeZone',zone,'asOfDate',(now() at time zone zone)::date,
 'version',coalesce((select version from workspace_private.notification_settings where workspace_id=target),0),
 'view',p_view,'typeId',p_type_id,'offset',p_offset,'pageSize',25,'total',(select count(*) from filtered),
 'counts',jsonb_build_object('inbox',(select count(*) from rows where status in ('read','unread')),
 'unread',(select count(*) from rows where status='unread'),'later',(select count(*) from rows where status='later'),
 'dismissed',(select count(*) from rows where status='dismissed'),'muted',(select count(*) from rows where status='muted')),
 'types',coalesce((select jsonb_agg(jsonb_build_object('id',type_id,'enabled',enabled) order by type_id) from types),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',signal_id,'revision',signal_revision,'typeId',type_id,'title',title,
 'reason',reason,'sourceHref',source_href,'sourceLabel',source_label,'dueDate',due_date,'priority',priority,'status',status,
 'snoozedUntil',case when status='later' then snoozed_until else null end)
 order by case priority when 'high' then 0 else 1 end,due_date nulls last,signal_id) from page),'[]'::jsonb)));
end; $$;

create function workspace.native_change_notifications(p_change jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_notification_owner(); v_request_id uuid; expected bigint; current_version bigint;
 saved workspace_private.notification_receipts%rowtype; r jsonb; current_signals jsonb; result jsonb; changed integer:=0;
begin
 if p_change is null or jsonb_typeof(p_change)<>'object' or
 coalesce(p_change->>'kind','') not in ('items','preference') or
 coalesce(p_change->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or jsonb_typeof(p_change->'expectedVersion') is distinct from 'number'
 or coalesce(p_change->>'expectedVersion','') !~ '^(0|[1-9][0-9]{0,15})$'
 or (p_change->>'expectedVersion')::numeric>9007199254740991 then
  raise exception 'Review a valid notification change.' using errcode='22023';
 end if;
 if (p_change->>'kind'='preference' and (p_change-array['kind','requestId','expectedVersion','typeId','enabled']<>'{}'::jsonb
 or jsonb_typeof(p_change->'enabled') is distinct from 'boolean' or jsonb_typeof(p_change->'typeId') is distinct from 'string'))
 or (p_change->>'kind'='items' and (p_change-array['kind','requestId','expectedVersion','action','items']<>'{}'::jsonb
 or coalesce(p_change->>'action','') not in ('read','unread','dismiss','snooze') or jsonb_typeof(p_change->'items') is distinct from 'array')) then
  raise exception 'Review a valid notification change.' using errcode='22023';
 end if;
 if p_change->>'kind'='items' then
  if jsonb_array_length(p_change->'items') not between 1 and 25
  or exists(select 1 from jsonb_array_elements(p_change->'items') i where jsonb_typeof(i)<>'object'
   or i-array['id','revision']<>'{}'::jsonb or coalesce(i->>'id','') !~ '^[0-9a-f]{64}$' or coalesce(i->>'revision','') !~ '^[0-9a-f]{64}$')
  or (select count(distinct i->>'id') from jsonb_array_elements(p_change->'items') i)<>jsonb_array_length(p_change->'items') then
   raise exception 'Review one to twenty-five distinct current notifications.' using errcode='22023';
  end if;
 end if;
 v_request_id:=(p_change->>'requestId')::uuid;expected:=(p_change->>'expectedVersion')::bigint;
 perform pg_advisory_xact_lock(hashtextextended('workspace-notifications:'||target::text,0));
 -- Entitlements are rechecked before returning a receipt. A retry never grants revoked source access.
 if p_change->>'kind'='preference' then
  if not exists(select 1 from workspace_private.notification_types(target) where type_id=p_change->>'typeId') then
   raise exception 'Notification type unavailable.' using errcode='42501';
  end if;
 else
  select coalesce(jsonb_object_agg(n.signal_id,n.signal_revision),'{}'::jsonb) into current_signals
  from workspace_private.notification_rows(target) n where n.signal_id in (select i->>'id' from jsonb_array_elements(p_change->'items')i);
  for r in select value from jsonb_array_elements(p_change->'items') loop
   if not current_signals ? (r->>'id') then raise exception 'Notification source unavailable. Refresh.' using errcode='42501'; end if;
   if current_signals->>(r->>'id') is distinct from r->>'revision' then
    raise exception 'Notification changed. Refresh and review again.' using errcode='40001';
   end if;
  end loop;
 end if;
 select * into saved from workspace_private.notification_receipts s where s.workspace_id=target and s.request_id=v_request_id;
 if found then
  if saved.input is distinct from p_change then raise exception 'This request was already used.' using errcode='40001'; end if;
  return saved.result;
 end if;
 insert into workspace_private.notification_settings(workspace_id) values(target) on conflict do nothing;
 select version into current_version from workspace_private.notification_settings where workspace_id=target for update;
 if current_version<>expected then raise exception 'Notification choices changed. Refresh and review again.' using errcode='40001'; end if;
 if p_change->>'kind'='preference' then
  insert into workspace_private.notification_preferences values(target,p_change->>'typeId',(p_change->>'enabled')::boolean)
  on conflict(workspace_id,type_id) do update set enabled=excluded.enabled;changed:=1;
 else
  for r in select value from jsonb_array_elements(p_change->'items') loop
   insert into workspace_private.notification_states values(target,r->>'id',r->>'revision',p_change->>'action',
    case when p_change->>'action'='snooze' then now()+interval '24 hours' else null end)
   on conflict(workspace_id,signal_id) do update set signal_revision=excluded.signal_revision,
    disposition=excluded.disposition,snoozed_until=excluded.snoozed_until;
   changed:=changed+1;
  end loop;
 end if;
 update workspace_private.notification_settings set version=version+1 where workspace_id=target returning version into current_version;
 result:=jsonb_build_object('requestId',v_request_id,'version',current_version,'changed',changed);
 insert into workspace_private.notification_receipts values(target,v_request_id,p_change,result);
 return result;
end; $$;

revoke all on function workspace_private.require_notification_owner(),workspace_private.notification_types(uuid),
 workspace_private.notification_timezone(),workspace_private.notification_rows(uuid) from public,anon,authenticated;
revoke all on function workspace.native_notifications(text,text,integer),workspace.native_change_notifications(jsonb) from public,anon;
grant execute on function workspace.native_notifications(text,text,integer),workspace.native_change_notifications(jsonb) to authenticated;
