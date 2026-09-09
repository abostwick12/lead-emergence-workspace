-- Separately consented task metadata and exact task references. Legacy grants
-- and legacy record-only API shapes remain unchanged. No external providers.
begin;
alter table workspace_private.executive_source_permissions add column task_capabilities text[] not null default '{}';
alter table workspace_private.executive_source_permission_versions add column task_capabilities text[] not null default '{}';
alter table workspace_private.executive_source_permission_versions add column permission_contract text not null default 'record-metadata-v1';
alter table workspace_private.executive_source_permissions add constraint executive_task_subset check(task_capabilities <@ source_capabilities);
alter table workspace_private.executive_source_permission_versions add constraint executive_task_version_subset check(task_capabilities <@ source_capabilities);

create function workspace_private.executive_task_definition(p_capability text) returns jsonb
language sql immutable set search_path='' as $$
 select $tasks$
{"executive.coordination":{"meeting":"action"},"executive.brief":{"daily_brief":"action"},"executive.review":{"weekly_review":"action"},"nonprofit.roadmap":{"plan":"milestone"},"nonprofit.partners":{"partner":"followup"},"nonprofit.meetings":{"meeting":"action"},"investor.company_research":{"watchlist":"watch_item","brief":"catalyst"},"investor.thesis":{"thesis":"catalyst"},"investor.filings":{"filing":"catalyst"}}$tasks$::jsonb->p_capability;
$$;
alter function workspace_private.executive_schema(text) rename to executive_schema_v1;
create function workspace_private.executive_schema(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_set(workspace_private.executive_schema_v1(p_kind),
 '{properties,references,items,properties,item}',
 $item$
{"type":"object","properties":{"kind":{"type":"string","enum":["action","milestone","followup","watch_item","catalyst"]},"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["kind","id"],"additionalProperties":false}$item$::jsonb);
$$;
create or replace function workspace_private.executive_reference_matches(p_ref jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when p_ref ? 'item' then
  coalesce(workspace_private.executive_task_definition(p_ref->>'capabilityId')->>(p_ref->>'kind')=p_ref->'item'->>'kind',false)
  and (p_ref->'item'->>'kind'<>'followup' or lower(p_ref->'item'->>'id')=lower(p_ref->>'documentId'))
 else coalesce(workspace_private.executive_capability(p_ref->>'kind')=p_ref->>'capabilityId',false)
  or coalesce(workspace_private.executive_source_definition(p_ref->>'capabilityId')->'kinds' ? (p_ref->>'kind'),false) end;
$$;
create function workspace_private.executive_reference_key(p_ref jsonb) returns text
language sql immutable set search_path='' as $$
 select (p_ref->>'capabilityId')||':'||(p_ref->>'kind')||':'||lower(p_ref->>'documentId')
  ||case when p_ref ? 'item' then ':'||(p_ref->'item'->>'kind')||':'||lower(p_ref->'item'->>'id') else '' end;
$$;
alter function workspace_private.validate_executive(text,jsonb) rename to validate_executive_v1;
create function workspace_private.validate_executive(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare ref jsonb;
begin
 if p_data is null or octet_length(p_data::text)>400000 then raise exception 'Executive record is empty or too large.' using errcode='22023'; end if;
 -- Reuse all existing field/cross-field rules; only reference identity changes.
 perform workspace_private.validate_executive_v1(p_kind,jsonb_set(p_data,'{references}','[]'));
 perform workspace_private.executive_validate_node(p_data,workspace_private.executive_schema(p_kind));
 if (select count(distinct workspace_private.executive_reference_key(x)) from jsonb_array_elements(p_data->'references') x)
  <>jsonb_array_length(p_data->'references') then raise exception 'Link each source record or task once.' using errcode='22023'; end if;
 for ref in select * from jsonb_array_elements(p_data->'references') loop
  if not workspace_private.executive_reference_matches(ref) then raise exception 'Source item, kind and capability do not match.' using errcode='22023'; end if;
 end loop;
end; $$;

create function workspace_private.executive_task_allowed(p_target uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select workspace_private.executive_task_definition(p_capability) is not null
 and workspace_private.executive_source_allowed(p_target,p_capability)
 and exists(select 1 from workspace_private.executive_source_permissions s where s.workspace_id=p_target and p_capability=any(s.task_capabilities));
$$;
create function workspace.executive_get_source_permissions_v2() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive('commitment'); s workspace_private.executive_source_permissions;
begin
 select * into s from workspace_private.executive_source_permissions x where x.workspace_id=target;
 return workspace.executive_get_source_permissions()||jsonb_build_object('taskCapabilities',coalesce(to_jsonb(s.task_capabilities),'[]'),
  'taskMetadataVersion','task-metadata-v1');
end; $$;
create function workspace_private.executive_change_source_permissions(
 p_capabilities jsonb,p_tasks jsonb,p_expected_revision integer,p_request_id uuid,
 p_confirm_record boolean,p_confirm_tasks boolean,p_contract text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive('commitment'); s workspace_private.executive_source_permissions;
 v workspace_private.executive_source_permission_versions; selected text[]; selected_tasks text[]; capability text;
begin
 perform workspace_private.executive_direct_user();
 if p_confirm_record is distinct from true or p_expected_revision is null or p_expected_revision<0 or p_request_id is null
  or p_capabilities is null or jsonb_typeof(p_capabilities)<>'array'
  or p_contract is null or p_contract not in ('record-metadata-v1','task-metadata-v1')
  then raise exception 'Confirm the exact metadata sources and current revision.' using errcode='22023'; end if;
 if jsonb_array_length(p_capabilities)>10 or exists(select 1 from jsonb_array_elements(p_capabilities) c where jsonb_typeof(c)<>'string')
  then raise exception 'Choose only supported record metadata sources.' using errcode='22023'; end if;
 select coalesce(array_agg(c order by c),'{}') into selected from jsonb_array_elements_text(p_capabilities) c;
 if cardinality(selected)<>(select count(distinct c) from unnest(selected) c) then raise exception 'Choose each source once.' using errcode='22023'; end if;
 foreach capability in array selected loop
  if workspace_private.executive_source_definition(capability) is null then raise exception 'Unsupported metadata source.' using errcode='22023'; end if;
  if not workspace_private.bundle_capability_active(target,workspace_private.executive_source_definition(capability)->>'bundleKey',capability)
   then raise exception 'The source capability is not currently available.' using errcode='42501'; end if;
 end loop;
 if p_contract='task-metadata-v1' then
  if p_tasks is null or jsonb_typeof(p_tasks)<>'array' then raise exception 'Choose explicit task metadata sources.' using errcode='22023'; end if;
  if jsonb_array_length(p_tasks)>6 or exists(select 1 from jsonb_array_elements(p_tasks) c where jsonb_typeof(c)<>'string')
   then raise exception 'Choose only supported task sources.' using errcode='22023'; end if;
  select coalesce(array_agg(c order by c),'{}') into selected_tasks from jsonb_array_elements_text(p_tasks) c;
  if cardinality(selected_tasks)<>(select count(distinct c) from unnest(selected_tasks) c) or not selected_tasks <@ selected
   or exists(select 1 from unnest(selected_tasks) c where workspace_private.executive_task_definition(c) is null)
   or (cardinality(selected_tasks)>0 and p_confirm_tasks is distinct from true)
   then raise exception 'Confirm each expanded task source and its parent record scope.' using errcode='22023'; end if;
 elsif p_tasks is not null then raise exception 'Legacy permissions cannot add task scopes.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':executive',0));
 select * into s from workspace_private.executive_source_permissions x where x.workspace_id=target for update;
 -- Legacy updates may retain existing task grants, but removing their record
 -- source clears them permanently. Re-adding a record never grants tasks.
 if p_contract='record-metadata-v1' then
  select coalesce(array_agg(c order by c),'{}') into selected_tasks
   from unnest(coalesce(s.task_capabilities,'{}')) c where c=any(selected);
 end if;
 select * into v from workspace_private.executive_source_permission_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if v.base_revision<>p_expected_revision or v.source_capabilities<>selected or s.revision<>v.revision
   or v.task_capabilities<>selected_tasks or v.permission_contract<>p_contract
   then raise exception 'This source permission request changed or was superseded.' using errcode='40001'; end if;
  return;
 end if;
 if coalesce(s.revision,0)<>p_expected_revision then raise exception 'Source permissions changed. Review the latest selection.' using errcode='40001'; end if;
 insert into workspace_private.executive_source_permissions(workspace_id,revision,source_capabilities,task_capabilities)
 values(target,p_expected_revision+1,selected,selected_tasks)
 on conflict(workspace_id) do update set revision=excluded.revision,source_capabilities=excluded.source_capabilities,
  task_capabilities=excluded.task_capabilities,updated_at=now() returning * into s;
 insert into workspace_private.executive_source_permission_versions(workspace_id,revision,base_revision,request_id,source_capabilities,task_capabilities,permission_contract,changed_by)
 values(target,s.revision,p_expected_revision,p_request_id,selected,selected_tasks,p_contract,auth.uid());
end; $$;
create or replace function workspace.executive_set_source_permissions(p_capabilities jsonb,p_expected_revision integer,p_request_id uuid,p_confirm_task_metadata_only boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform workspace_private.executive_change_source_permissions(p_capabilities,null,p_expected_revision,p_request_id,p_confirm_task_metadata_only,false,'record-metadata-v1');
 return workspace.executive_get_source_permissions();
end; $$;
create function workspace.executive_set_source_permissions_v2(p_capabilities jsonb,p_task_capabilities jsonb,p_expected_revision integer,
 p_request_id uuid,p_confirm_task_metadata_only boolean,p_confirm_expanded_task_metadata boolean,p_task_metadata_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_task_metadata_version is distinct from 'task-metadata-v1' then raise exception 'Review the supported task metadata permission version.' using errcode='22023'; end if;
 perform workspace_private.executive_change_source_permissions(p_capabilities,p_task_capabilities,p_expected_revision,p_request_id,
  p_confirm_task_metadata_only,p_confirm_expanded_task_metadata,p_task_metadata_version);
 return workspace.executive_get_source_permissions_v2();
end; $$;
-- Project only named scalar fields from the named task arrays. Parent status is
-- internal selection context; it is not an additional published metadata field.
create function workspace_private.executive_task_metadata(p_capability text,p_document_id uuid default null)
returns table(capability_id text,document_id uuid,source_kind text,item_kind text,item_id uuid,title text,
 state text,review_state text,revision integer,due_date date,source_updated_at timestamptz,priority text,
 parent_title text,owner text,next_action text,date_state text,open_prerequisites integer,parent_state text)
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); definition jsonb:=workspace_private.executive_task_definition(p_capability);
begin
 if definition is null then return; end if;
 if p_capability like 'executive.%' then
  if not workspace_private.bundle_capability_active(target,'executive',p_capability) then return; end if;
  return query select p_capability,x.id,x.kind,'action'::text,(a->>'id')::uuid,a->>'title',a->>'state',a->>'reviewState',
   x.revision,(a->>'dueDate')::date,x.updated_at,x.data->>'priority',x.data->>'title',a->>'owner',a->>'nextAction',
   null::text,0,x.data->>'state'
  from workspace_private.executive_documents x cross join lateral jsonb_array_elements(coalesce(x.data->'actions','[]')) a
  where x.workspace_id=target and definition ? x.kind and (p_document_id is null or x.id=p_document_id);
 elsif not workspace_private.executive_task_allowed(target,p_capability) then return;
 elsif p_capability in ('nonprofit.roadmap','nonprofit.meetings') then
  return query select p_capability,x.id,x.kind,definition->>x.kind,(a->>'id')::uuid,a->>'title',a->>'status',null::text,
   x.revision,(a->>'dueDate')::date,x.updated_at,a->>'priority',x.data->>'title',a->>'owner',a->>'nextAction',null::text,
   case when x.kind='plan' then (select count(*)::integer from jsonb_array_elements(x.data->'milestones') d
    where (a->'dependsOn') ? (d->>'id') and d->>'status' not in ('done','skipped')) else 0 end,x.data->>'status'
  from workspace_private.nonprofit_documents x cross join lateral
   jsonb_array_elements(case when x.kind='plan' then x.data->'milestones' else coalesce(x.data->'actions','[]') end) a
  where x.workspace_id=target and definition ? x.kind and (p_document_id is null or x.id=p_document_id);
 elsif p_capability='nonprofit.partners' then
  return query select p_capability,x.id,x.kind,'followup'::text,x.id,x.data->>'title',x.data->>'stage',null::text,x.revision,
   (x.data->>'followupDate')::date,x.updated_at,'normal'::text,x.data->>'title',x.data->>'owner',x.data->>'nextAction',
   null::text,0,x.data->>'stage'
  from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind='partner' and (p_document_id is null or x.id=p_document_id);
 elsif p_capability like 'investor.%' then
  return query select p_capability,x.id,x.kind,definition->>x.kind,(a->>'id')::uuid,
   case when x.kind='watchlist' then a->'instrument'->>'name' else a->>'title' end,a->>'status',null::text,x.revision,
   (case when x.kind='watchlist' then a->>'reviewDate' else a->>'eventDate' end)::date,x.updated_at,'normal'::text,x.data->>'title',''::text,
   case when x.kind='watchlist' then a->>'nextQuestion' else a->>'nextCheck' end,
   case when x.kind='watchlist' then null::text else a->>'dateState' end,0,x.data->>'status'
  from workspace_private.investor_documents x cross join lateral
   jsonb_array_elements(case when x.kind='watchlist' then x.data->'entries' else coalesce(x.data->'catalysts','[]') end) a
  where x.workspace_id=target and definition ? x.kind and (p_document_id is null or x.id=p_document_id);
 end if;
end; $$;
create function workspace_private.executive_task_source_records(p_capability text,p_document_id uuid default null)
returns table(reference jsonb,metadata jsonb,parent_state text)
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('capabilityId',m.capability_id,'kind',m.source_kind,'documentId',m.document_id,'revision',m.revision,
  'item',jsonb_build_object('kind',m.item_kind,'id',m.item_id)),
 jsonb_build_object('title',m.title,'state',m.state,'reviewState',m.review_state,'revision',m.revision,'dueDate',m.due_date,
  'sourceUpdatedAt',m.source_updated_at,'parentTitle',m.parent_title,'owner',m.owner,'nextAction',m.next_action,
  'priority',m.priority,'dateState',m.date_state,'openPrerequisites',m.open_prerequisites),m.parent_state
 from workspace_private.executive_task_metadata(p_capability,p_document_id) m;
$$;
alter function workspace_private.executive_source_record(jsonb) rename to executive_source_record_v1;
create function workspace_private.executive_source_record(p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); result jsonb; doc uuid; task_id uuid;
begin
 if not workspace_private.executive_reference_matches(p_ref) then return null; end if;
 if not p_ref ? 'item' then return workspace_private.executive_source_record_v1(p_ref); end if;
 begin doc:=(p_ref->>'documentId')::uuid; task_id:=(p_ref->'item'->>'id')::uuid;
 exception when invalid_text_representation then return null; end;
 select m.metadata into result from workspace_private.executive_task_source_records(p_ref->>'capabilityId',doc) m
  where m.reference->>'kind'=p_ref->>'kind' and m.reference->'item'->>'kind'=p_ref->'item'->>'kind'
   and (m.reference->'item'->>'id')::uuid=task_id;
 return result;
end; $$;
create function workspace_private.executive_scope_state(p_target uuid,p_capability text,p_level text) returns text
language sql stable security definer set search_path='' as $$
 select case when p_capability in ('executive.coordination','executive.brief','executive.review') then
  case when workspace_private.bundle_capability_active(p_target,'executive',p_capability) then 'current' else 'unavailable' end
 when (p_level='record' and workspace_private.executive_source_allowed(p_target,p_capability))
   or (p_level='task' and workspace_private.executive_task_allowed(p_target,p_capability)) then 'current'
 when exists(select 1 from workspace_private.executive_source_permissions s where s.workspace_id=p_target
   and p_capability=any(case when p_level='task' then s.task_capabilities else s.source_capabilities end)) then 'unavailable'
 else 'not_shared' end;
$$;
create function workspace_private.executive_source_cursor(p_ref jsonb) returns text
language sql immutable set search_path='' as $$
 select (p_ref->>'kind')||':'||lower(p_ref->>'documentId')
 ||case when p_ref ? 'item' then ':'||(p_ref->'item'->>'kind')||':'||lower(p_ref->'item'->>'id') else '' end;
$$;
create function workspace.executive_find_sources(p_capability text,p_level text default 'record',p_search text default '',
 p_after text default null,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); scope_state text; result jsonb;
begin
 if p_capability is null or (p_capability not in ('executive.coordination','executive.brief','executive.review')
  and workspace_private.executive_source_definition(p_capability) is null)
  or p_level is null or p_level not in ('record','task')
  or (p_level='task' and workspace_private.executive_task_definition(p_capability) is null)
  or p_search is null or length(btrim(p_search))>200 or p_limit is null or p_limit not between 1 and 50
  then raise exception 'Choose one supported source and a bounded result page.' using errcode='22023'; end if;
 if p_after is not null and (length(p_after)>180 or p_after !~ '^[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:((action|milestone|followup|watch_item|catalyst):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?$')
  then raise exception 'Use the returned source page cursor.' using errcode='22023'; end if;
 scope_state:=workspace_private.executive_scope_state(target,p_capability,p_level);
 if scope_state<>'current' then return jsonb_build_object('scope',jsonb_build_object('capabilityId',p_capability,'level',p_level),
  'state',scope_state,'total',null,'items','[]'::jsonb,'nextCursor',null,'retrievedAt',now()); end if;
 -- Scan only projected title/identity fields, then resolve the bounded page.
 -- Searching never examines manuscript, research, notes or other private text.
 return (with catalog as materialized (
  select jsonb_build_object('capabilityId',m.capability_id,'kind',m.source_kind,'documentId',m.document_id,'revision',m.revision) as ref,m.title
   from workspace_private.executive_attention_metadata(p_capability) m where p_level='record'
  union all
  select m.reference,m.metadata->>'title' from workspace_private.executive_task_source_records(p_capability) m where p_level='task'
 ), matches as materialized (
  select ref,workspace_private.executive_source_cursor(ref) as cursor_key from catalog
   where strpos(lower(title),lower(btrim(p_search)))>0
 ), page as materialized (
  select * from matches where p_after is null or cursor_key collate "C">p_after collate "C"
   order by cursor_key collate "C" limit p_limit+1
 ), visible as materialized (select * from page order by cursor_key collate "C" limit p_limit)
 select jsonb_build_object('scope',jsonb_build_object('capabilityId',p_capability,'level',p_level),'state',scope_state,
  'total',(select count(*) from matches),'items',coalesce((select jsonb_agg(jsonb_build_object('reference',ref,
   'metadata',workspace_private.executive_source_record(ref)) order by cursor_key collate "C") from visible),'[]'::jsonb),
  'nextCursor',case when (select count(*) from page)>p_limit then (select cursor_key from visible order by cursor_key collate "C" desc limit 1) else null end,
  'retrievedAt',now()));
end; $$;
create function workspace.executive_review_attention(p_as_of_date date default current_date,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any();
begin
 if p_as_of_date is null or p_as_of_date not between date '0001-01-01' and date '9999-12-24'
  or p_offset is null or p_offset not between 0 and 2147483000 or p_limit is null or p_limit not between 1 and 50
  then raise exception 'Use a valid attention date and bounded page.' using errcode='22023'; end if;
 return (with scopes as materialized (
  select cap,'record'::text as level from unnest(array['executive.coordination','executive.brief','executive.review','writer.resource.library',
   'ministry.research','ministry.archive','nonprofit.roadmap','nonprofit.partners','nonprofit.meetings',
   'nonprofit.regulatory_research','investor.company_research','investor.thesis','investor.filings']) cap
  union all select cap,'task' from unnest(array['executive.coordination','executive.brief','executive.review',
   'nonprofit.roadmap','nonprofit.partners','nonprofit.meetings','investor.company_research','investor.thesis','investor.filings']) cap
 ), sources as materialized (
  select cap,level,workspace_private.executive_scope_state(target,cap,level) as coverage_state from scopes
 ), records as materialized (
  select m.* from sources s cross join lateral workspace_private.executive_attention_metadata(s.cap) m
   where s.level='record' and s.coverage_state='current'
 ), tasks as materialized (
  select m.* from sources s cross join lateral workspace_private.executive_task_metadata(s.cap) m
   where s.level='task' and s.coverage_state='current'
 ), record_matches as materialized (
  select m.*,case when m.state='blocked' or m.due_date<p_as_of_date then 'high' else m.priority end as signal_priority,
   case when m.state='blocked' then 'The saved commitment is blocked.'
    when m.due_date<p_as_of_date then 'The recorded due, follow-up or review date has passed.'
    when m.due_date<=p_as_of_date+7 then 'A recorded due, follow-up, meeting or review date is within seven days.'
    when m.review_state='stale' then 'This saved record is marked stale and needs review.'
    when m.source_kind='commitment' then 'An open commitment needs a next move.'
    when m.source_kind='decision' then 'A saved decision is still open or deferred.'
    when m.source_kind='meeting' then 'A planned meeting has no recorded time.'
    when m.source_kind in ('daily_brief','weekly_review') then 'A saved brief is still a draft.'
    else 'The saved source status calls for review.' end as reason
  from records m where
   m.state not in ('archived','cancelled','completed','held','closed','paused','published','decided','reversed')
   and (
    (m.capability_id='executive.coordination' and
      (m.source_kind in ('commitment','decision') or m.due_date is null or m.due_date<=p_as_of_date+7))
    or (m.capability_id in ('executive.brief','executive.review') and (m.state='draft' or m.review_state='stale' or m.due_date<=p_as_of_date))
    or (m.capability_id='writer.resource.library' and m.state in ('draft','in_review','ready'))
    or (m.capability_id='ministry.research' and (m.state in ('draft','researching') or m.due_date<=p_as_of_date+7))
    or (m.capability_id in ('nonprofit.roadmap','nonprofit.partners','nonprofit.meetings') and m.due_date<=p_as_of_date+7)
    or (m.capability_id='nonprofit.regulatory_research' and (m.state in ('open','researching','review_required') or m.due_date<=p_as_of_date+7))
    or (m.capability_id like 'investor.%' and (m.state in ('draft','review_required') or m.due_date<=p_as_of_date+7))
   )
 ), task_matches as materialized (
  select m.*,case when m.state='blocked' or m.due_date<p_as_of_date then 'high' else m.priority end as signal_priority,
   case when m.state='blocked' then 'This saved task is marked blocked.'
    when m.open_prerequisites>0 then m.open_prerequisites::text||' prerequisite milestones are not marked done or skipped.'
    when m.item_kind='catalyst' then 'Review the saved catalyst and its next check. Date certainty is '||m.date_state||'; no event or live source was verified here.'
    when m.due_date<p_as_of_date then 'This task has a recorded due, follow-up or review date in the past.'
    when m.due_date<=p_as_of_date+7 then 'This task has a recorded due, follow-up or review date within seven days.'
    when m.review_state='stale' then 'This saved action is marked stale and needs review.'
    when m.priority='high' then 'This saved task is marked high priority.'
    else 'This open task has no recorded date. Review its next move.' end as reason
  from tasks m where m.parent_state not in ('archived','paused','cancelled','closed')
   and m.state not in ('archived','paused','cancelled','closed','completed','done','skipped','reviewed')
   and (m.due_date is null or m.due_date<=p_as_of_date+7 or m.state='blocked' or m.open_prerequisites>0 or m.priority='high' or m.review_state='stale')
 ), signals as materialized (
  select r.capability_id,'record'::text as level,r.due_date,r.signal_priority,
   r.capability_id||':'||r.source_kind||':'||r.document_id::text as signal_id,
   jsonb_build_object('source',jsonb_build_object('capabilityId',r.capability_id,'kind',r.source_kind,'documentId',r.document_id,'revision',r.revision),
    'title',r.title,'priority',r.signal_priority,'dueDate',r.due_date,'reason',r.reason,'state',r.state,
    'evidence','Saved status: '||r.state||'; revision '||r.revision::text||'. Metadata only; no underlying content reviewed.',
    'action','Open the source workspace to review the full context','sourceUpdatedAt',r.source_updated_at,'sourceReviewState',r.review_state,
    'parentTitle',null,'owner',null,'nextAction',null,'dateState',null,'openPrerequisites',0) as value from record_matches r
  union all
  select t.capability_id,'task',t.due_date,t.signal_priority,
   t.capability_id||':'||t.source_kind||':'||t.document_id::text||':'||t.item_kind||':'||t.item_id::text,
   jsonb_build_object('source',jsonb_build_object('capabilityId',t.capability_id,'kind',t.source_kind,'documentId',t.document_id,'revision',t.revision,
     'item',jsonb_build_object('kind',t.item_kind,'id',t.item_id)),
    'title',t.title,'priority',t.signal_priority,'dueDate',t.due_date,'reason',t.reason,'state',t.state,
    'evidence','Saved task status: '||t.state||'; parent revision '||t.revision::text||'. Scoped task metadata; no full content reviewed.',
    'action','Review this task in its source workspace','sourceUpdatedAt',t.source_updated_at,'sourceReviewState',t.review_state,
    'parentTitle',t.parent_title,'owner',t.owner,'nextAction',t.next_action,'dateState',t.date_state,'openPrerequisites',t.open_prerequisites)
   from task_matches t
 ), page as (
  select * from signals order by case signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,
   due_date nulls last,signal_id collate "C" offset p_offset limit p_limit
 )
 select jsonb_build_object('schemaVersion','2.0','asOfDate',p_as_of_date,'retrievedAt',now(),
  'total',(select count(*) from signals),'offset',p_offset,'limit',p_limit,
  'coverage',(select jsonb_agg(jsonb_build_object('capabilityId',s.cap,'level',s.level,'state',s.coverage_state,
   'total',case when s.coverage_state='current' then (select count(*) from signals m where m.capability_id=s.cap and m.level=s.level) else null end)
   order by s.cap,s.level) from sources s),
  'items',coalesce((select jsonb_agg(value||jsonb_build_object('id',signal_id)
   order by case signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,due_date nulls last,signal_id collate "C") from page),'[]'::jsonb)));
end; $$;

revoke all on function workspace_private.executive_task_definition(text),workspace_private.executive_schema_v1(text),
 workspace_private.executive_schema(text),workspace_private.executive_reference_key(jsonb),workspace_private.validate_executive_v1(text,jsonb),
 workspace_private.validate_executive(text,jsonb),workspace_private.executive_task_allowed(uuid,text),
 workspace_private.executive_change_source_permissions(jsonb,jsonb,integer,uuid,boolean,boolean,text),
 workspace_private.executive_task_metadata(text,uuid),workspace_private.executive_task_source_records(text,uuid),
 workspace_private.executive_source_record_v1(jsonb),workspace_private.executive_source_record(jsonb),
 workspace_private.executive_scope_state(uuid,text,text),workspace_private.executive_source_cursor(jsonb)
 from public,anon,authenticated;
revoke all on function workspace.executive_get_source_permissions_v2(),
 workspace.executive_set_source_permissions_v2(jsonb,jsonb,integer,uuid,boolean,boolean,text),
 workspace.executive_find_sources(text,text,text,text,integer),workspace.executive_review_attention(date,integer,integer) from public,anon;
grant execute on function workspace.executive_get_source_permissions_v2(),
 workspace.executive_set_source_permissions_v2(jsonb,jsonb,integer,uuid,boolean,boolean,text),
 workspace.executive_find_sources(text,text,text,text,integer),workspace.executive_review_attention(date,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
