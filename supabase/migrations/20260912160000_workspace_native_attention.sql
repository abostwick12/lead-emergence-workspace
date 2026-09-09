-- P12: native-user attention, distinct from Executive assistant sharing.
-- Existing Executive/MCP functions and permissions are unchanged.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description)
values('workspace_attention','Shared attention','See source-linked saved work that deserves a next move.') on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
values('workspace_experience','workspace_attention') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
('workspace_experience','workspace_attention','workspace.attention') on conflict do nothing;

create function workspace_private.require_native_attention_workspace() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Use native Workspace attention.' using errcode='42501';
 end if;
 target:=workspace_private.require_bundle_workspace();
 if not workspace_private.bundle_capability_active(target,'workspace_experience','workspace.attention') then
  raise exception 'Workspace attention access is required.' using errcode='42501';
 end if;
 return target;
end; $$;

-- Reuse only immutable domain-kind definitions, never Executive source grants.
create function workspace_private.native_attention_scopes(target uuid)
returns table(cap text,bundle_key text,level text)
language sql stable security definer set search_path='' as $$
 with scopes as (
 select c,'record'::text as l from unnest(array['executive.coordination','executive.brief','executive.review','writer.resource.library',
 'ministry.research','ministry.archive','nonprofit.roadmap','nonprofit.partners','nonprofit.meetings',
 'nonprofit.regulatory_research','investor.company_research','investor.thesis','investor.filings']) c
 union all select c,'task' from unnest(array['executive.coordination','executive.brief','executive.review',
 'nonprofit.roadmap','nonprofit.partners','nonprofit.meetings','investor.company_research','investor.thesis','investor.filings']) c
 ), named as (select c,coalesce(workspace_private.executive_source_definition(c)->>'bundleKey','executive') as b,l from scopes)
 select c,b,l from named where workspace_private.bundle_capability_active(target,b,c);
$$;

create function workspace_private.native_attention_metadata(p_capability text)
returns table(capability_id text, document_id uuid, source_kind text, title text, state text,
 review_state text, revision integer, due_date date, source_updated_at timestamptz, priority text)
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_native_attention_workspace();
 definition jsonb:=workspace_private.executive_source_definition(p_capability);
begin
 if p_capability in ('executive.coordination','executive.brief','executive.review') then
  if not workspace_private.bundle_capability_active(target,'executive',p_capability) then return; end if;
  return query select p_capability,x.id,x.kind,x.data->>'title',x.data->>'state',x.data->>'reviewState',x.revision,
   case when x.kind='meeting' and x.data->>'startsAt' is not null
    then ((x.data->>'startsAt')::timestamptz at time zone (x.data->>'timeZone'))::date
    else least((x.data->>'dueDate')::date,(x.data->>'followupDate')::date,(x.data->>'reviewDate')::date) end,
   x.updated_at,x.data->>'priority'
   from workspace_private.executive_documents x where x.workspace_id=target
    and workspace_private.executive_capability(x.kind)=p_capability;
 elsif definition is null or not workspace_private.bundle_capability_active(target,definition->>'bundleKey',p_capability) then return;
 elsif definition->>'bundleKey'='writer_editor' then
  return query select p_capability,x.id,'resource'::text,x.title,x.publication_state,null::text,x.revision,
   null::date,x.updated_at,'normal'::text from workspace_private.writing_resources x where x.workspace_id=target;
 elsif definition->>'bundleKey'='ministry' then
  return query select p_capability,x.id,x.kind,x.data->>'title',x.data->>'status',null::text,x.revision,
   case when x.kind='research' then (x.data->>'dueDate')::date else null::date end,x.updated_at,'normal'::text
   from workspace_private.ministry_documents x where x.workspace_id=target and definition->'kinds' ? x.kind;
 elsif definition->>'bundleKey'='nonprofit_founder' then
  return query select p_capability,x.id,x.kind,x.data->>'title',coalesce(x.data->>'status',x.data->>'stage'),null::text,x.revision,
   (case x.kind when 'plan' then x.data->>'targetDate' when 'partner' then x.data->>'followupDate'
     when 'meeting' then x.data->>'scheduledDate' else x.data->>'reviewDate' end)::date,x.updated_at,'normal'::text
   from workspace_private.nonprofit_documents x where x.workspace_id=target and definition->'kinds' ? x.kind;
 elsif definition->>'bundleKey'='investor' then
  return query select p_capability,x.id,x.kind,x.data->>'title',x.data->>'status',null::text,x.revision,
   (x.data->>'reviewDate')::date,x.updated_at,'normal'::text
   from workspace_private.investor_documents x where x.workspace_id=target and definition->'kinds' ? x.kind;
 end if;
end; $$;


create function workspace_private.native_attention_task_metadata(p_capability text,p_document_id uuid default null)
returns table(capability_id text,document_id uuid,source_kind text,item_kind text,item_id uuid,title text,
 state text,review_state text,revision integer,due_date date,source_updated_at timestamptz,priority text,
 parent_title text,owner text,next_action text,date_state text,open_prerequisites integer,parent_state text)
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_native_attention_workspace(); definition jsonb:=workspace_private.executive_task_definition(p_capability);
begin
 if definition is null then return; end if;
 if p_capability like 'executive.%' then
  if not workspace_private.bundle_capability_active(target,'executive',p_capability) then return; end if;
  return query select p_capability,x.id,x.kind,'action'::text,(a->>'id')::uuid,a->>'title',a->>'state',a->>'reviewState',
   x.revision,(a->>'dueDate')::date,x.updated_at,x.data->>'priority',x.data->>'title',a->>'owner',a->>'nextAction',
   null::text,0,x.data->>'state'
  from workspace_private.executive_documents x cross join lateral jsonb_array_elements(coalesce(x.data->'actions','[]')) a
  where x.workspace_id=target and definition ? x.kind and (p_document_id is null or x.id=p_document_id);
 elsif not exists(select 1 from workspace_private.native_attention_scopes(target) s where s.cap=p_capability and s.level='task') then return;
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

create function workspace.native_attention_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_native_attention_workspace();
begin
 return jsonb_build_object('workspaceId',target,'authorityRevision',workspace.get_bundle_experience()->>'revision',
 'scopes',coalesce((select jsonb_agg(jsonb_build_object('capabilityId',s.cap,'level',s.level) order by s.cap,s.level)
 from workspace_private.native_attention_scopes(target) s),'[]'::jsonb));
end; $$;

create function workspace.native_attention(p_as_of_date date,p_authority_revision text,p_bundle_key text default null,
 p_priority text default null,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_native_attention_workspace(); current_revision text:=workspace.get_bundle_experience()->>'revision';
begin
 if p_as_of_date is null or p_as_of_date not between date '0001-01-01' and date '9999-12-24'
 or p_authority_revision is null or char_length(p_authority_revision) not between 1 and 200
 or p_offset is null or p_offset not between 0 and 2147483000 or p_offset%25<>0
 or (p_bundle_key is not null and p_bundle_key not in ('writer_editor','ministry','nonprofit_founder','investor','executive'))
 or (p_priority is not null and p_priority not in ('high','normal','low')) then
  raise exception 'Choose a valid attention date, filter and page.' using errcode='22023';
 end if;
 if p_authority_revision is distinct from current_revision then
  raise exception 'Attention access changed. Refresh scopes.' using errcode='40001';
 end if;
 if p_bundle_key is not null and not exists(select 1 from workspace_private.native_attention_scopes(target) where bundle_key=p_bundle_key) then
  raise exception 'Attention source unavailable.' using errcode='42501';
 end if;
 return (with sources as materialized (
  select * from workspace_private.native_attention_scopes(target)
 ), records as materialized (
  select m.* from sources s cross join lateral workspace_private.native_attention_metadata(s.cap) m
   where s.level='record'
 ), tasks as materialized (
  select m.* from sources s cross join lateral workspace_private.native_attention_task_metadata(s.cap) m
   where s.level='task'
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
 ), raw_signals as materialized (
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

 ), signals as materialized (
 select m.*,s.bundle_key from raw_signals m join sources s on s.cap=m.capability_id and s.level=m.level
 ), filtered as (
 select * from signals where (p_bundle_key is null or bundle_key=p_bundle_key) and (p_priority is null or signal_priority=p_priority)
 ), page as (
 select * from filtered order by case signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,
 due_date nulls last,signal_id collate "C" limit 25 offset p_offset
 )
 select jsonb_build_object('schemaVersion','1.0','workspaceId',target,'authorityRevision',current_revision,
 'asOfDate',p_as_of_date,'retrievedAt',now(),'bundleKey',p_bundle_key,'priority',p_priority,'offset',p_offset,
 'total',(select count(*) from filtered),'overallTotal',(select count(*) from signals),
 'coverage',coalesce((select jsonb_agg(jsonb_build_object('capabilityId',s.cap,'level',s.level,
 'total',(select count(*) from signals m where m.capability_id=s.cap and m.level=s.level)) order by s.cap,s.level) from sources s),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('bundleKey',g.bundle_key,'priority',g.signal_priority,'total',g.n)
 order by g.bundle_key,g.signal_priority) from (select bundle_key,signal_priority,count(*) n from signals group by bundle_key,signal_priority) g),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(value||jsonb_build_object('id',signal_id)
 order by case signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,due_date nulls last,signal_id collate "C") from page),'[]'::jsonb)));
end; $$;

revoke all on function workspace_private.require_native_attention_workspace(),workspace_private.native_attention_scopes(uuid),
 workspace_private.native_attention_metadata(text),workspace_private.native_attention_task_metadata(text,uuid),
 workspace.native_attention_catalog(),workspace.native_attention(date,text,text,text,integer) from public,anon,authenticated;
grant execute on function workspace.native_attention_catalog(),workspace.native_attention(date,text,text,text,integer) to authenticated;
notify pgrst,'reload schema';
