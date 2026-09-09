-- Native-user saved-work discovery. No shared corpus, assignments, model tool,
-- provider connection, query history or production configuration is created.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description)
values('workspace_search','Search saved work','Find source-labelled saved work across explicitly selected, currently assigned domains.') on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
values('workspace_experience','workspace_search') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
('workspace_experience','workspace_search','workspace.search') on conflict do nothing;

create table workspace_private.search_providers(
 id text primary key,bundle_key text not null references workspace.bundle_definitions(bundle_key),
 kind text not null,capability_ids text[] not null check(cardinality(capability_ids)>0),
 unique(bundle_key,kind)
);
insert into workspace_private.search_providers values
 ('writer.search.resources','writer_editor','resource',array['writer.resource.library','writer.resource.review']),
 ('ministry.search.research','ministry','research',array['ministry.research']),
 ('ministry.search.archive','ministry','archive',array['ministry.archive']),
 ('nonprofit.search.plan','nonprofit_founder','plan',array['nonprofit.roadmap']),
 ('nonprofit.search.partner','nonprofit_founder','partner',array['nonprofit.partners']),
 ('nonprofit.search.meeting','nonprofit_founder','meeting',array['nonprofit.meetings']),
 ('nonprofit.search.research','nonprofit_founder','research',array['nonprofit.regulatory_research']),
 ('investor.search.watchlist','investor','watchlist',array['investor.company_research']),
 ('investor.search.thesis','investor','thesis',array['investor.thesis']),
 ('investor.search.filing','investor','filing',array['investor.filings']),
 ('investor.search.brief','investor','brief',array['investor.company_research']),
 ('executive.search.commitment','executive','commitment',array['executive.coordination']),
 ('executive.search.decision','executive','decision',array['executive.coordination']),
 ('executive.search.meeting','executive','meeting',array['executive.coordination']),
 ('executive.search.daily_brief','executive','daily_brief',array['executive.brief']),
 ('executive.search.weekly_review','executive','weekly_review',array['executive.review']);
alter table workspace_private.search_providers enable row level security;
revoke all on workspace_private.search_providers from public,anon,authenticated;

create function workspace_private.require_search_workspace() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Use native Workspace search.' using errcode='42501';
 end if;
 target:=workspace_private.require_bundle_workspace();
 if not workspace_private.bundle_capability_active(target,'workspace_experience','workspace.search') then
  raise exception 'Workspace search access is required.' using errcode='42501';
 end if;
 return target;
end; $$;
create function workspace_private.admitted_search_providers(target uuid) returns setof workspace_private.search_providers
language sql stable security definer set search_path='' as $$
 select p.* from workspace_private.search_providers p where not exists(
  select 1 from unnest(p.capability_ids) cap where not workspace_private.bundle_capability_active(target,p.bundle_key,cap));
$$;
create function workspace.search_saved_work_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_search_workspace();
begin
 return jsonb_build_object('workspaceId',target,'authorityRevision',workspace.get_bundle_experience()->>'revision',
 'providerIds',coalesce((select jsonb_agg(p.id order by p.id) from workspace_private.admitted_search_providers(target) p),'[]'::jsonb));
end; $$;
create function workspace_private.search_document_text(data jsonb) returns text
language sql immutable set search_path='' as $$
 select coalesce(string_agg(value,' '),'') from jsonb_array_elements_text(
  jsonb_path_query_array(data,'strict $.** ? (@.type() == "string")'::jsonpath));
$$;

create function workspace.search_saved_work(p_query text,p_provider_ids text[],p_authority_revision text,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_search_workspace(); current_revision text:=workspace.get_bundle_experience()->>'revision';
 query tsquery; normalized text:=trim(p_query);
begin
 if p_query is null or char_length(normalized) not between 2 and 200 or p_offset is null
  or p_offset not between 0 and 10000 or p_offset%25<>0 or p_authority_revision is null
  or char_length(p_authority_revision) not between 1 and 200
  or p_provider_ids is null or cardinality(p_provider_ids) not between 1 and 16
  or array_ndims(p_provider_ids)<>1 or array_position(p_provider_ids,null) is not null
  or (select count(distinct x) from unnest(p_provider_ids) x)<>cardinality(p_provider_ids) then
  raise exception 'Choose a valid query and search scope.' using errcode='22023';
 end if;
 if p_authority_revision is distinct from current_revision then
  raise exception 'Search access changed. Review scope again.' using errcode='40001';
 end if;
 if exists(select 1 from unnest(p_provider_ids) requested where not exists(
  select 1 from workspace_private.admitted_search_providers(target) p where p.id=requested)) then
  raise exception 'Search scope unavailable.' using errcode='42501';
 end if;
 query:=websearch_to_tsquery('simple',normalized);
 return (with admitted as materialized (
  select * from workspace_private.admitted_search_providers(target) where id=any(p_provider_ids)
 ), documents as (
  select p.id as provider_id,r.id,r.title,r.revision,r.updated_at,
   r.title||' '||coalesce(r.abstract,'')||' '||r.body_text as plain_text,
   i.metadata_vector||i.body_vector as vector
  from workspace_private.writing_resources r join workspace_private.writing_search_index i on i.resource_id=r.id and i.workspace_id=r.workspace_id
  join admitted p on p.bundle_key='writer_editor' and p.kind='resource'
  where r.workspace_id=target and (strpos(lower(r.title),lower(normalized))>0 or i.metadata_vector@@query or i.body_vector@@query)
  
 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,workspace_private.search_document_text(r.data),r.search_vector
 from workspace_private.ministry_documents r join admitted p on p.bundle_key='ministry' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,workspace_private.search_document_text(r.data),r.search_vector
 from workspace_private.nonprofit_documents r join admitted p on p.bundle_key='nonprofit_founder' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,workspace_private.search_document_text(r.data),r.search_vector
 from workspace_private.investor_documents r join admitted p on p.bundle_key='investor' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,workspace_private.search_document_text(r.data),r.search_vector
 from workspace_private.executive_documents r join admitted p on p.bundle_key='executive' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 ), matches as materialized (
  select *,case when lower(title)=lower(normalized) then 2 when strpos(lower(title),lower(normalized))>0 then 1 else 0 end as title_match,
   ts_rank_cd(vector,query,32) as rank from documents
 ), page as (
  select * from matches order by title_match desc,rank desc,updated_at desc,provider_id,id limit 25 offset p_offset
 )
 select jsonb_build_object('workspaceId',target,'authorityRevision',current_revision,'retrievedAt',now(),
 'query',normalized,'offset',p_offset,'matchingCount',(select count(*) from matches),
 'coverage',(select jsonb_agg(jsonb_build_object('providerId',p.id,'matchingCount',(select count(*) from matches m where m.provider_id=p.id)) order by p.id) from admitted p),
 'results',coalesce((select jsonb_agg(jsonb_build_object('providerId',provider_id,'id',id,'title',title,'revision',revision,'updatedAt',updated_at,
 'matchReason',case title_match when 2 then 'exact_title' when 1 then 'title_contains' else 'saved_text' end,
 'snippet',left(ts_headline('simple',plain_text,query,'StartSel="",StopSel="",MaxWords=45,MinWords=12,MaxFragments=1'),360))
 order by title_match desc,rank desc,updated_at desc,provider_id,id) from page),'[]'::jsonb)));
end; $$;

revoke all on function workspace_private.require_search_workspace(),workspace_private.admitted_search_providers(uuid),
 workspace_private.search_document_text(jsonb),workspace.search_saved_work_catalog(),
 workspace.search_saved_work(text,text[],text,integer) from public,anon,authenticated;
grant execute on function workspace.search_saved_work_catalog(),workspace.search_saved_work(text,text[],text,integer) to authenticated;
notify pgrst,'reload schema';
