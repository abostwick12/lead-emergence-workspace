-- P11a: retain complete owner-authorized counts/ranking, but prepare text only
-- after selecting the current page. No new data, entitlement or model authority.
-- PostgreSQL 15 CTE materialization and text-search controls reviewed 2026-09-09:
-- https://www.postgresql.org/docs/15/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION
-- https://www.postgresql.org/docs/15/textsearch-controls.html
create or replace function workspace.search_saved_work(p_query text,p_provider_ids text[],p_authority_revision text,p_offset integer default 0)
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
  select p.id as provider_id,r.id,r.title,r.revision,r.updated_at,p.bundle_key,p.kind,
   i.metadata_vector||i.body_vector as vector
  from workspace_private.writing_resources r join workspace_private.writing_search_index i on i.resource_id=r.id and i.workspace_id=r.workspace_id
  join admitted p on p.bundle_key='writer_editor' and p.kind='resource'
  where r.workspace_id=target and (strpos(lower(r.title),lower(normalized))>0 or i.metadata_vector@@query or i.body_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,p.bundle_key,p.kind,r.search_vector
 from workspace_private.ministry_documents r join admitted p on p.bundle_key='ministry' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,p.bundle_key,p.kind,r.search_vector
 from workspace_private.nonprofit_documents r join admitted p on p.bundle_key='nonprofit_founder' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,p.bundle_key,p.kind,r.search_vector
 from workspace_private.investor_documents r join admitted p on p.bundle_key='investor' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 union all
 select p.id,r.id,r.data->>'title',r.revision,r.updated_at,p.bundle_key,p.kind,r.search_vector
 from workspace_private.executive_documents r join admitted p on p.bundle_key='executive' and p.kind=r.kind
 where r.workspace_id=target and (strpos(lower(r.data->>'title'),lower(normalized))>0 or r.search_vector@@query)

 ), matches as materialized (
  select provider_id,id,title,revision,updated_at,bundle_key,kind,case when lower(title)=lower(normalized) then 2 when strpos(lower(title),lower(normalized))>0 then 1 else 0 end as title_match,
   ts_rank_cd(vector,query,32) as rank from documents
 ), page as materialized (
  select * from matches order by title_match desc,rank desc,updated_at desc,provider_id,id limit 25 offset p_offset

 ), previews as (
  -- Correlated primary-key lookups occur only for the final 25 admitted rows.
  -- Do not carry bodies, JSON or tsvectors in the materialized match list.
  select p.*,case p.bundle_key
   when 'writer_editor' then (select r.title||' '||coalesce(r.abstract,'')||' '||r.body_text
    from workspace_private.writing_resources r where r.workspace_id=target and r.id=p.id)
   when 'ministry' then (select workspace_private.search_document_text(r.data)
    from workspace_private.ministry_documents r where r.workspace_id=target and r.id=p.id and r.kind=p.kind)
   when 'nonprofit_founder' then (select workspace_private.search_document_text(r.data)
    from workspace_private.nonprofit_documents r where r.workspace_id=target and r.id=p.id and r.kind=p.kind)
   when 'investor' then (select workspace_private.search_document_text(r.data)
    from workspace_private.investor_documents r where r.workspace_id=target and r.id=p.id and r.kind=p.kind)
   when 'executive' then (select workspace_private.search_document_text(r.data)
    from workspace_private.executive_documents r where r.workspace_id=target and r.id=p.id and r.kind=p.kind)
  end as plain_text from page p
 )
 select jsonb_build_object('workspaceId',target,'authorityRevision',current_revision,'retrievedAt',now(),
 'query',normalized,'offset',p_offset,'matchingCount',(select count(*) from matches),
 'coverage',(select jsonb_agg(jsonb_build_object('providerId',p.id,'matchingCount',(select count(*) from matches m where m.provider_id=p.id)) order by p.id) from admitted p),
 'results',coalesce((select jsonb_agg(jsonb_build_object('providerId',provider_id,'id',id,'title',title,'revision',revision,'updatedAt',updated_at,
 'matchReason',case title_match when 2 then 'exact_title' when 1 then 'title_contains' else 'saved_text' end,
 'snippet',left(ts_headline('simple',plain_text,query,'StartSel="",StopSel="",MaxWords=45,MinWords=12,MaxFragments=1'),360))
 order by title_match desc,rank desc,updated_at desc,provider_id,id) from previews),'[]'::jsonb)));
end; $$;

revoke all on function workspace.search_saved_work(text,text[],text,integer) from public,anon,authenticated;
grant execute on function workspace.search_saved_work(text,text[],text,integer) to authenticated;
notify pgrst,'reload schema';
