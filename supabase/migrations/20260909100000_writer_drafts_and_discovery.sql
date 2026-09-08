-- Private working drafts and evidence-led discovery. No catalog grants or external calls.
create table workspace_private.writing_working_drafts (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 slot text not null,
 resource_id uuid references workspace_private.writing_resources(id) on delete cascade,
 version integer not null check(version>0),
 base_revision integer,
 request_id uuid not null,
 values_json jsonb,
 saved_at timestamptz not null default now(),
 primary key(workspace_id,slot)
);
alter table workspace_private.writing_working_drafts enable row level security;
revoke all on workspace_private.writing_working_drafts from public,anon,authenticated;

create function workspace_private.require_writing_draft(resource_id uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability(case when resource_id is null then 'writer.resource.manage' else 'writer.resource.metadata' end);
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then raise exception 'Working drafts are private to the native editor.' using errcode='42501'; end if;
 if resource_id is not null then
  perform workspace_private.require_writing_capability('writer.resource.review');
  if not exists(select 1 from workspace_private.writing_resources r where r.id=resource_id and r.workspace_id=target) then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 end if;
 return target;
end; $$;

create function workspace_private.writing_draft_result(d workspace_private.writing_working_drafts) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('version',coalesce(d.version,0),'baseRevision',d.base_revision,'requestId',d.request_id,'values',d.values_json,'savedAt',d.saved_at);
$$;
create function workspace.writer_get_working_draft(resource_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_draft(resource_id); d workspace_private.writing_working_drafts;
begin
 select * into d from workspace_private.writing_working_drafts x where x.workspace_id=target and x.slot=coalesce(writer_get_working_draft.resource_id::text,'import');
 return workspace_private.writing_draft_result(d);
end; $$;

create function workspace.writer_save_working_draft(resource_id uuid,expected_version integer,base_revision integer,request_id uuid,draft_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_draft(resource_id); d workspace_private.writing_working_drafts; item record; lim integer;
begin
 if expected_version is null or expected_version<0 or request_id is null or draft_values is null or jsonb_typeof(draft_values)<>'object' or octet_length(draft_values::text)>650000 then
  raise exception 'Invalid working draft.' using errcode='22023';
 end if;
 if (resource_id is null and base_revision is not null) or (resource_id is not null and (base_revision is null or base_revision<1 or base_revision>(select r.revision from workspace_private.writing_resources r where r.id=resource_id and r.workspace_id=target))) then
  raise exception 'Invalid draft base revision.' using errcode='22023';
 end if;
 for item in select * from jsonb_each(draft_values) loop
  lim:=case item.key when 'title' then 240 when 'author' then 240 when 'resource_type' then 30 when 'audience' then 300 when 'topics' then 3630
    when 'abstract' then 3000 when 'body_text' then 100000 when 'website_summary' then 3000 when 'seo_description' then 320
    when 'publication_state' then 30 when 'reason' then 2000 when 'evidence' then 4000 when 'source_label' then 240
    when 'source_url' then 2000 when 'source_date' then 10 when 'source_file' then 500 else null end;
  if lim is null or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>lim then raise exception 'Invalid working draft.' using errcode='22023'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into d from workspace_private.writing_working_drafts x where x.workspace_id=target and x.slot=coalesce(writer_save_working_draft.resource_id::text,'import') for update;
 if d.request_id=request_id then
  if d.values_json is distinct from draft_values or d.base_revision is distinct from base_revision then raise exception 'Draft request already used.' using errcode='40001'; end if;
  return workspace_private.writing_draft_result(d);
 end if;
 if coalesce(d.version,0)<>expected_version then raise exception 'A newer working draft exists. Your edits have not overwritten it.' using errcode='40001'; end if;
 insert into workspace_private.writing_working_drafts(workspace_id,slot,resource_id,version,base_revision,request_id,values_json)
 values(target,coalesce(resource_id::text,'import'),resource_id,expected_version+1,base_revision,request_id,draft_values)
 on conflict(workspace_id,slot) do update set version=excluded.version,base_revision=excluded.base_revision,request_id=excluded.request_id,values_json=excluded.values_json,saved_at=now()
 returning * into d;
 return workspace_private.writing_draft_result(d);
end; $$;

create function workspace.writer_clear_working_draft(resource_id uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_draft(resource_id); d workspace_private.writing_working_drafts;
begin
 if expected_version is null or expected_version<0 then raise exception 'Invalid working draft version.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into d from workspace_private.writing_working_drafts x where x.workspace_id=target and x.slot=coalesce(writer_clear_working_draft.resource_id::text,'import') for update;
 if d.version is null and expected_version=0 then return workspace_private.writing_draft_result(d); end if;
 if d.values_json is null and d.version=expected_version+1 then return workspace_private.writing_draft_result(d); end if;
 if d.version is distinct from expected_version then raise exception 'A newer working draft exists. It was not discarded.' using errcode='40001'; end if;
 -- A content-free tombstone prevents an old tab recreating a discarded draft.
 update workspace_private.writing_working_drafts set values_json=null,base_revision=null,version=version+1,request_id=gen_random_uuid(),saved_at=now()
 where workspace_id=target and slot=d.slot returning * into d;
 return workspace_private.writing_draft_result(d);
end; $$;

create function workspace_private.writing_normalized_labels(labels text[]) returns text[]
language sql immutable security definer set search_path='' as $$
 select coalesce(array_agg(distinct lower(trim(v)) order by lower(trim(v))) filter(where trim(v)<>''),'{}') from unnest(labels) v;
$$;
create function workspace_private.writing_normalized_text(value text) returns text
language sql immutable security definer set search_path='' as $$
 select trim(regexp_replace(value,'[[:space:]]+',' ','g'));
$$;
create table workspace_private.writing_search_index (
 resource_id uuid primary key references workspace_private.writing_resources(id) on delete cascade,
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 title_key text not null, body_hash text, topics text[] not null, scripture text[] not null,
 metadata_vector tsvector not null, body_vector tsvector not null
);
alter table workspace_private.writing_search_index enable row level security;
revoke all on workspace_private.writing_search_index from public,anon,authenticated;
create index writing_search_workspace_idx on workspace_private.writing_search_index(workspace_id);
create index writing_search_body_hash_idx on workspace_private.writing_search_index(workspace_id,body_hash);
create index writing_search_title_idx on workspace_private.writing_search_index(workspace_id,title_key);
create index writing_search_topics_idx on workspace_private.writing_search_index using gin(topics);
create index writing_search_scripture_idx on workspace_private.writing_search_index using gin(scripture);
create index writing_search_metadata_idx on workspace_private.writing_search_index using gin(metadata_vector);
create index writing_search_body_idx on workspace_private.writing_search_index using gin(body_vector);
create function workspace_private.refresh_writing_search() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized text:=workspace_private.writing_normalized_text(new.body_text);
begin
 insert into workspace_private.writing_search_index values(new.id,new.workspace_id,lower(workspace_private.writing_normalized_text(new.title)),
  case when normalized<>'' then md5(normalized) else null end,
  workspace_private.writing_normalized_labels(new.topics),
  workspace_private.writing_normalized_labels(array(select jsonb_array_elements_text(coalesce(new.metadata->'scripture_references','[]')))),
  to_tsvector('simple',new.title||' '||coalesce(new.author,'')||' '||coalesce(new.audience,'')||' '||coalesce(new.abstract,'')||' '||array_to_string(new.topics,' ')||' '||
    coalesce(new.metadata->>'series','')||' '||coalesce(new.metadata->>'website_summary','')||' '||coalesce(new.metadata->>'keywords','')||' '||coalesce(new.metadata->>'themes','')||' '||coalesce(new.metadata->>'scripture_references','')),
  to_tsvector('simple',new.body_text))
 on conflict(resource_id) do update set workspace_id=excluded.workspace_id,title_key=excluded.title_key,body_hash=excluded.body_hash,topics=excluded.topics,
 scripture=excluded.scripture,metadata_vector=excluded.metadata_vector,body_vector=excluded.body_vector;
 return new;
end; $$;
create trigger writing_search_sync after insert or update of title,author,audience,abstract,topics,metadata,body_text on workspace_private.writing_resources
 for each row execute function workspace_private.refresh_writing_search();
-- Trigger backfill changes no canonical value, revision, timestamp or provenance.
update workspace_private.writing_resources set title=title;

create or replace function workspace.writer_list_resources(search_text text default '',publication_filter text default null,page_offset integer default 0,page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.resource.library');
 can_read_body boolean:=workspace_private.bundle_capability_active(target,'writer_editor','writer.resource.review');
 query tsquery;
begin
 if search_text is null or char_length(search_text)>200 or page_offset is null or page_offset not between 0 and 10000 or page_size is null or page_size not between 1 and 50
  or (publication_filter is not null and publication_filter not in ('draft','in_review','ready','published','archived')) then raise exception 'Invalid resource search.' using errcode='22023'; end if;
 query:=websearch_to_tsquery('simple',search_text);
 return (with matches as materialized (
  select r.* from workspace_private.writing_resources r join workspace_private.writing_search_index i on i.resource_id=r.id and i.workspace_id=r.workspace_id
  where r.workspace_id=target and (publication_filter is null or r.publication_state=publication_filter)
  and (trim(search_text)='' or strpos(lower(r.title||' '||coalesce(r.author,'')||' '||array_to_string(r.topics,' ')),lower(trim(search_text)))>0
    or i.metadata_vector@@query or (can_read_body and i.body_vector@@query))
 ) select jsonb_build_object('workspaceId',target,'retrievedAt',now(),
  'total',(select count(*) from workspace_private.writing_resources r where r.workspace_id=target),
  'awaitingPublication',(select count(*) from workspace_private.writing_resources r where r.workspace_id=target and r.publication_state in ('in_review','ready')),
  'matchingCount',(select count(*) from matches),
  'resources',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id) from
   (select id,title,author,resource_type,audience,topics,abstract,source_url,source_label,source_date,retrieved_at,epistemic_state,publication_state,updated_at from matches order by updated_at desc,id limit page_size offset page_offset) p),'[]')));
end; $$;

create function workspace.writer_find_connections(resource_id uuid,result_limit integer default 12) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.resource.library');
 base workspace_private.writing_resources; idx workspace_private.writing_search_index;
begin
 perform workspace_private.require_writing_capability('writer.resource.review');
 if result_limit is null or result_limit not between 1 and 20 then raise exception 'Choose up to 20 connections.' using errcode='22023'; end if;
 select * into base from workspace_private.writing_resources r where r.id=resource_id and r.workspace_id=target;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 select * into idx from workspace_private.writing_search_index i where i.resource_id=base.id and i.workspace_id=target;
 return (with candidates as materialized (
  select r.id,r.title,r.author,r.abstract,r.source_label,r.source_url,r.revision,r.updated_at,
   array_remove(array[
    case when i.body_hash=idx.body_hash and workspace_private.writing_normalized_text(r.body_text)=workspace_private.writing_normalized_text(base.body_text) then 'same_text_ignoring_whitespace' end,
    case when i.title_key=idx.title_key then 'same_title_ignoring_case_and_whitespace' end,
    case when r.source_url=base.source_url then 'same_recorded_url' end
   ],null) as duplicate_signals,
   array(select unnest(i.topics) intersect select unnest(idx.topics) order by 1) as shared_topics,
   array(select unnest(i.scripture) intersect select unnest(idx.scripture) order by 1) as shared_scripture
  from workspace_private.writing_search_index i join workspace_private.writing_resources r on r.id=i.resource_id and r.workspace_id=i.workspace_id
  where i.workspace_id=target and r.id<>base.id and
   (i.body_hash=idx.body_hash or i.title_key=idx.title_key or (base.source_url is not null and r.source_url=base.source_url) or i.topics&&idx.topics or i.scripture&&idx.scripture)
 ) select jsonb_build_object('resourceId',base.id,'baseRevision',base.revision,'retrievedAt',now(),'matchingCount',(select count(*) from candidates),
  'method','Recorded text, title, URL, topic and scripture-label comparisons. Candidates need human review; no semantic matching, link verification, merging or deletion.',
  'candidates',coalesce((select jsonb_agg(to_jsonb(c) order by cardinality(c.duplicate_signals) desc,(cardinality(c.shared_topics)+cardinality(c.shared_scripture)) desc,c.updated_at desc,c.id) from
   (select * from candidates order by cardinality(duplicate_signals) desc,(cardinality(shared_topics)+cardinality(shared_scripture)) desc,updated_at desc,id limit result_limit) c),'[]')));
end; $$;

revoke all on function workspace_private.require_writing_draft(uuid),workspace_private.writing_draft_result(workspace_private.writing_working_drafts),
 workspace_private.writing_normalized_labels(text[]),workspace_private.writing_normalized_text(text),workspace_private.refresh_writing_search() from public,anon,authenticated;
revoke all on function workspace.writer_get_working_draft(uuid),workspace.writer_save_working_draft(uuid,integer,integer,uuid,jsonb),
 workspace.writer_clear_working_draft(uuid,integer),workspace.writer_find_connections(uuid,integer) from public,anon,authenticated;
grant execute on function workspace.writer_get_working_draft(uuid),workspace.writer_save_working_draft(uuid,integer,integer,uuid,jsonb),
 workspace.writer_clear_working_draft(uuid,integer),workspace.writer_find_connections(uuid,integer) to authenticated;
notify pgrst,'reload schema';
