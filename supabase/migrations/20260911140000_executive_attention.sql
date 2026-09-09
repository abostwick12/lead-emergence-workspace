-- Metadata-only Executive attention. No provider reads and no canonical writes.
-- Every entry is scoped by live server-derived identity, sharing and entitlement.
begin;
create function workspace_private.executive_attention_metadata(p_capability text)
returns table(capability_id text, document_id uuid, source_kind text, title text, state text,
 review_state text, revision integer, due_date date, source_updated_at timestamptz, priority text)
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any();
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
 elsif definition is null or not workspace_private.executive_source_allowed(target,p_capability) then return;
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

create function workspace.executive_attention(p_as_of_date date default current_date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); result jsonb;
begin
 if p_as_of_date is null or p_as_of_date not between date '0001-01-01' and date '9999-12-24'
  then raise exception 'Use an explicit valid attention date.' using errcode='22023'; end if;
 return (with sources as materialized (
  select cap,case when cap like 'executive.%' then
    case when workspace_private.bundle_capability_active(target,'executive',cap) then 'current' else 'unavailable' end
   when workspace_private.executive_source_allowed(target,cap) then 'current'
   when exists(select 1 from workspace_private.executive_source_permissions s where s.workspace_id=target and cap=any(s.source_capabilities))
     then 'unavailable' else 'not_shared' end as coverage_state
  from unnest(array['executive.coordination','executive.brief','executive.review','writer.resource.library',
   'ministry.research','ministry.archive','nonprofit.roadmap','nonprofit.partners','nonprofit.meetings',
   'nonprofit.regulatory_research','investor.company_research','investor.thesis','investor.filings']) cap
 ), metadata as materialized (
  select m.* from sources s cross join lateral workspace_private.executive_attention_metadata(s.cap) m where s.coverage_state='current'
 ), matches as materialized (
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
  from metadata m where
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
 ), page as (
  select * from matches order by case signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,
   due_date nulls last,capability_id||':'||source_kind||':'||document_id::text limit 50
 )
 select jsonb_build_object('asOfDate',p_as_of_date,'retrievedAt',now(),'total',(select count(*) from matches),
  'coverage',(select jsonb_agg(jsonb_build_object('capabilityId',s.cap,'state',s.coverage_state,
    'total',case when s.coverage_state='current' then (select count(*) from matches m where m.capability_id=s.cap) else null end) order by s.cap) from sources s),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',p.capability_id||':'||p.source_kind||':'||p.document_id::text,
   'source',jsonb_build_object('capabilityId',p.capability_id,'kind',p.source_kind,'documentId',p.document_id,'revision',p.revision),
   'title',p.title,'priority',p.signal_priority,'dueDate',p.due_date,'reason',p.reason,
   'evidence','Saved status: '||p.state||'; revision '||p.revision::text||'. Metadata only; no underlying content reviewed.',
   'action',case when p.capability_id like 'executive.%' then 'Review the saved record and choose the next move' else 'Open the source workspace to review the full context' end,
   'sourceUpdatedAt',p.source_updated_at,'sourceReviewState',p.review_state)
    order by case p.signal_priority when 'high' then 0 when 'normal' then 1 else 2 end,p.due_date nulls last,
     p.capability_id||':'||p.source_kind||':'||p.document_id::text) from page p),'[]'::jsonb)));
end; $$;
revoke all on function workspace_private.executive_attention_metadata(text) from public,anon,authenticated;
revoke all on function workspace.executive_attention(date) from public,anon;
grant execute on function workspace.executive_attention(date) to authenticated;
notify pgrst,'reload schema';
commit;
