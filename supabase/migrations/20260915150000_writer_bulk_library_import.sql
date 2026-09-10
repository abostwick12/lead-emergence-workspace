-- P20: resumable, native-only Writer library staging and atomic import.
-- Extracted text is private working state; original binaries are never stored.
create table workspace_private.writing_import_batches (
  workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  request_id uuid not null,
  items jsonb,
  saved_at timestamptz not null default now()
);
create table workspace_private.writing_batch_import_receipts (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  request_id uuid not null,
  batch_version integer not null check (batch_version > 0),
  review_token text not null check (review_token ~ '^[a-f0-9]{64}$'),
  resources jsonb not null,
  committed_at timestamptz not null default now(),
  primary key (workspace_id, request_id)
);
alter table workspace_private.writing_import_batches enable row level security;
alter table workspace_private.writing_batch_import_receipts enable row level security;
revoke all on workspace_private.writing_import_batches, workspace_private.writing_batch_import_receipts from public, anon, authenticated;

create function workspace_private.validate_writing_import_batch(items jsonb) returns void
language plpgsql immutable security definer set search_path = '' as $$
declare
  item jsonb; extraction jsonb; source_file jsonb; warning jsonb;
  item_id uuid; item_count integer; aggregate_characters bigint := 0;
begin
  if items is null or jsonb_typeof(items) <> 'array' or octet_length(items::text) > 650000 then
    raise exception 'Invalid library staging list.' using errcode = '22023';
  end if;
  item_count := jsonb_array_length(items);
  if item_count not between 1 and 20 then raise exception 'Stage between 1 and 20 resources.' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 6
      or not item ?& array['itemId','extraction','title','sourceLabel','resourceType','included'] then
      raise exception 'Invalid staged resource.' using errcode = '22023';
    end if;
    begin
      if jsonb_typeof(item->'itemId') <> 'string' or item->>'itemId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then raise exception 'invalid'; end if;
      item_id := (item->>'itemId')::uuid;
    exception when others then raise exception 'Invalid staged resource identity.' using errcode = '22023'; end;
    if item->>'itemId' <> item_id::text then raise exception 'Use a canonical staged resource identity.' using errcode = '22023'; end if;
    if (select count(*) from jsonb_array_elements(items) candidate where candidate->>'itemId' = item->>'itemId') <> 1 then
      raise exception 'Staged resource identities must be unique.' using errcode = '22023';
    end if;
    if jsonb_typeof(item->'title') <> 'string' or char_length(trim(item->>'title')) not between 1 and 240
      or item->>'title' <> trim(item->>'title')
      or jsonb_typeof(item->'sourceLabel') <> 'string' or char_length(trim(item->>'sourceLabel')) not between 1 and 240
      or item->>'sourceLabel' <> trim(item->>'sourceLabel')
      or jsonb_typeof(item->'resourceType') <> 'string' or item->>'resourceType' not in ('article','sermon','teaching','study_guide','other')
      or jsonb_typeof(item->'included') <> 'boolean' then
      raise exception 'Check each staged title, source, type, and inclusion choice.' using errcode = '22023';
    end if;
    extraction := item->'extraction';
    if jsonb_typeof(extraction) <> 'object' or (select count(*) from jsonb_object_keys(extraction)) <> 9
      or not extraction ?& array['schemaVersion','file','titleSuggestion','text','characterCount','wordCount','pageCount','warnings','originalRetained']
      or extraction->>'schemaVersion' <> '1.0' or extraction->'originalRetained' <> 'false'::jsonb then
      raise exception 'Invalid extraction receipt.' using errcode = '22023';
    end if;
    source_file := extraction->'file';
    if jsonb_typeof(source_file) <> 'object' or (select count(*) from jsonb_object_keys(source_file)) <> 5
      or not source_file ?& array['name','format','mediaType','byteSize','sha256']
      or jsonb_typeof(source_file->'name') <> 'string' or char_length(source_file->>'name') not between 1 and 255
      or source_file->>'name' <> trim(source_file->>'name') or source_file->>'name' ~ '[[:cntrl:]\\/]'
      or left(source_file->>'name',1) = '.' or strpos(source_file->>'name','..') > 0
      or jsonb_typeof(source_file->'format') <> 'string' or source_file->>'format' not in ('plain_text','markdown','word_docx','pdf')
      or jsonb_typeof(source_file->'mediaType') <> 'string' or char_length(source_file->>'mediaType') > 200
      or jsonb_typeof(source_file->'byteSize') <> 'number' or source_file->>'byteSize' !~ '^[0-9]+$' or char_length(source_file->>'byteSize') > 7
      or jsonb_typeof(source_file->'sha256') <> 'string' or source_file->>'sha256' !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid extracted source descriptor.' using errcode = '22023';
    end if;
    begin
      if (source_file->>'byteSize')::integer not between 1 and 4000000 then raise exception 'invalid'; end if;
    exception when others then raise exception 'Invalid extracted source descriptor.' using errcode = '22023'; end;
    if jsonb_typeof(extraction->'titleSuggestion') <> 'string' or char_length(trim(extraction->>'titleSuggestion')) not between 1 and 240 or extraction->>'titleSuggestion' <> trim(extraction->>'titleSuggestion')
      or jsonb_typeof(extraction->'text') <> 'string' or char_length(extraction->>'text') not between 1 and 100000
      or jsonb_typeof(extraction->'characterCount') <> 'number' or extraction->>'characterCount' !~ '^[0-9]+$' or char_length(extraction->>'characterCount') > 6
      or jsonb_typeof(extraction->'wordCount') <> 'number' or extraction->>'wordCount' !~ '^[0-9]+$' or char_length(extraction->>'wordCount') > 6
      then
      raise exception 'Invalid extracted text receipt.' using errcode = '22023';
    end if;
    begin
      if (extraction->>'characterCount')::integer not between 1 and 100000 or (extraction->>'wordCount')::integer not between 1 and 100000 then raise exception 'invalid'; end if;
    exception when others then raise exception 'Invalid extracted text receipt.' using errcode = '22023'; end;
    if (source_file->>'format' = 'pdf' and (jsonb_typeof(extraction->'pageCount') <> 'number' or extraction->>'pageCount' !~ '^[0-9]+$' or char_length(extraction->>'pageCount') > 3))
      or (source_file->>'format' <> 'pdf' and extraction->'pageCount' <> 'null'::jsonb) then
      raise exception 'Invalid extracted page receipt.' using errcode = '22023';
    end if;
    if source_file->>'format'='pdf' then
      begin
        if (extraction->>'pageCount')::integer not between 1 and 100 then raise exception 'invalid'; end if;
      exception when others then raise exception 'Invalid extracted page receipt.' using errcode = '22023'; end;
    end if;
    if jsonb_typeof(extraction->'warnings') <> 'array' or jsonb_array_length(extraction->'warnings') not between 1 and 4
      or (select count(*) from jsonb_array_elements(extraction->'warnings') w where jsonb_typeof(w) <> 'string' or w#>>'{}' not in
        ('formatting_not_preserved','images_not_imported','pdf_reading_order_may_differ','review_extracted_text')) > 0
      or (select count(*) from jsonb_array_elements(extraction->'warnings')) <>
        (select count(distinct w#>>'{}') from jsonb_array_elements(extraction->'warnings') w) then
      raise exception 'Invalid extraction warnings.' using errcode = '22023';
    end if;
    aggregate_characters := aggregate_characters + char_length(extraction->>'text');
  end loop;
  if aggregate_characters > 500000 then raise exception 'Staged source text exceeds the aggregate limit.' using errcode = '22023'; end if;
end; $$;

create function workspace_private.writing_import_batch_snapshot(batch workspace_private.writing_import_batches) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select jsonb_build_object(
    'schemaVersion','1.0','version',coalesce(batch.version,0),'requestId',batch.request_id,
    'items',batch.items,'savedAt',case when batch.items is null then null else batch.saved_at end
  );
$$;

create function workspace.writer_get_import_batch() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target uuid := workspace_private.require_writing_direct(); batch workspace_private.writing_import_batches;
begin
  perform workspace_private.require_writing_capability('writer.resource.review');
  select * into batch from workspace_private.writing_import_batches b where b.workspace_id = target;
  return workspace_private.writing_import_batch_snapshot(batch);
end; $$;

create function workspace.writer_save_import_batch(expected_version integer, request_id uuid, items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid := workspace_private.require_writing_direct(); batch workspace_private.writing_import_batches;
begin
  perform workspace_private.require_writing_capability('writer.resource.review');
  if expected_version is null or expected_version < 0 or request_id is null then raise exception 'Invalid library staging request.' using errcode = '22023'; end if;
  perform workspace_private.validate_writing_import_batch(items);
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into batch from workspace_private.writing_import_batches b where b.workspace_id = target for update;
  if batch.request_id = request_id then
    if batch.items is distinct from items then raise exception 'Staging request already used.' using errcode = '40001'; end if;
    return workspace_private.writing_import_batch_snapshot(batch);
  end if;
  if coalesce(batch.version,0) <> expected_version then raise exception 'A newer staging list exists. Your edits have not overwritten it.' using errcode = '40001'; end if;
  insert into workspace_private.writing_import_batches(workspace_id,version,request_id,items)
  values(target,expected_version+1,request_id,items)
  on conflict(workspace_id) do update set version=excluded.version,request_id=excluded.request_id,items=excluded.items,saved_at=now()
  returning * into batch;
  return workspace_private.writing_import_batch_snapshot(batch);
end; $$;

create function workspace.writer_clear_import_batch(expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid := workspace_private.require_writing_direct(); batch workspace_private.writing_import_batches;
begin
  perform workspace_private.require_writing_capability('writer.resource.review');
  if expected_version is null or expected_version < 0 then raise exception 'Invalid library staging version.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into batch from workspace_private.writing_import_batches b where b.workspace_id=target for update;
  if batch.version is null and expected_version=0 then return workspace_private.writing_import_batch_snapshot(batch); end if;
  if batch.items is null and batch.version=expected_version+1 then return workspace_private.writing_import_batch_snapshot(batch); end if;
  if batch.version is distinct from expected_version then raise exception 'A newer staging list exists. It was not discarded.' using errcode = '40001'; end if;
  update workspace_private.writing_import_batches set version=version+1,request_id=gen_random_uuid(),items=null,saved_at=now()
  where workspace_id=target returning * into batch;
  return workspace_private.writing_import_batch_snapshot(batch);
end; $$;

create function workspace_private.writing_import_batch_review_items(target uuid, items jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('itemId',staged.item->>'itemId','candidates',staged.candidates) order by staged.ordinality),'[]'::jsonb)
  from (
    select source.item,source.ordinality,coalesce((
      select jsonb_agg(jsonb_build_object('candidateType',candidate.candidate_type,'candidateId',candidate.candidate_id,
        'title',candidate.title,'signals',candidate.signals) order by candidate.signal_count desc,candidate.candidate_type,candidate.title,candidate.candidate_id)
      from (
        select * from (
          select 'existing_resource'::text candidate_type,r.id candidate_id,r.title,
            array_remove(array[
              case when workspace_private.writing_normalized_text(r.body_text)=workspace_private.writing_normalized_text(source.item->'extraction'->>'text') then 'same_text_ignoring_whitespace' end,
              case when lower(workspace_private.writing_normalized_text(r.title))=lower(workspace_private.writing_normalized_text(source.item->>'title')) then 'same_title_ignoring_case_and_whitespace' end
            ],null) signals,
            cardinality(array_remove(array[
              case when workspace_private.writing_normalized_text(r.body_text)=workspace_private.writing_normalized_text(source.item->'extraction'->>'text') then 'same_text_ignoring_whitespace' end,
              case when lower(workspace_private.writing_normalized_text(r.title))=lower(workspace_private.writing_normalized_text(source.item->>'title')) then 'same_title_ignoring_case_and_whitespace' end
            ],null)) signal_count
          from workspace_private.writing_resources r
          join workspace_private.writing_search_index idx on idx.resource_id=r.id and idx.workspace_id=r.workspace_id
          where r.workspace_id=target and (
            (idx.body_hash=md5(workspace_private.writing_normalized_text(source.item->'extraction'->>'text')) and workspace_private.writing_normalized_text(r.body_text)=workspace_private.writing_normalized_text(source.item->'extraction'->>'text'))
            or idx.title_key=lower(workspace_private.writing_normalized_text(source.item->>'title')))
          union all
          select 'staged_item', (other.item->>'itemId')::uuid, other.item->>'title',
            array_remove(array[
              case when workspace_private.writing_normalized_text(other.item->'extraction'->>'text')=workspace_private.writing_normalized_text(source.item->'extraction'->>'text') then 'same_text_ignoring_whitespace' end,
              case when lower(workspace_private.writing_normalized_text(other.item->>'title'))=lower(workspace_private.writing_normalized_text(source.item->>'title')) then 'same_title_ignoring_case_and_whitespace' end
            ],null),
            cardinality(array_remove(array[
              case when workspace_private.writing_normalized_text(other.item->'extraction'->>'text')=workspace_private.writing_normalized_text(source.item->'extraction'->>'text') then 'same_text_ignoring_whitespace' end,
              case when lower(workspace_private.writing_normalized_text(other.item->>'title'))=lower(workspace_private.writing_normalized_text(source.item->>'title')) then 'same_title_ignoring_case_and_whitespace' end
            ],null))
          from jsonb_array_elements(items) with ordinality other(item,ordinality)
          where other.item->>'itemId'<>source.item->>'itemId' and (
            workspace_private.writing_normalized_text(other.item->'extraction'->>'text')=workspace_private.writing_normalized_text(source.item->'extraction'->>'text')
            or lower(workspace_private.writing_normalized_text(other.item->>'title'))=lower(workspace_private.writing_normalized_text(source.item->>'title')))
        ) all_candidates order by signal_count desc,candidate_type,title,candidate_id limit 40
      ) candidate
    ),'[]'::jsonb) candidates
    from jsonb_array_elements(items) with ordinality source(item,ordinality)
  ) staged;
$$;

create function workspace.writer_review_import_batch(expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := workspace_private.require_writing_direct(); batch workspace_private.writing_import_batches;
  review_items jsonb; token text;
begin
  perform workspace_private.require_writing_capability('writer.resource.review');
  if expected_version is null or expected_version < 1 then raise exception 'Save the staging list before reviewing it.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into batch from workspace_private.writing_import_batches b where b.workspace_id=target for update;
  if batch.version is distinct from expected_version or batch.items is null then raise exception 'The staging list changed. Save it before reviewing duplicates.' using errcode = '40001'; end if;
  review_items := workspace_private.writing_import_batch_review_items(target,batch.items);
  token := encode(extensions.digest(jsonb_build_object('version',batch.version,'items',review_items)::text,'sha256'),'hex');
  return jsonb_build_object('schemaVersion','1.0','version',batch.version,'reviewedAt',now(),'reviewToken',token,'items',review_items);
end; $$;

create function workspace.writer_commit_import_batch(expected_version integer, request_id uuid, review_token text, confirmed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := workspace_private.require_writing_direct(); batch workspace_private.writing_import_batches;
  existing workspace_private.writing_batch_import_receipts; item jsonb; imported jsonb;
  review_items jsonb; computed_token text; resources jsonb := '[]'::jsonb;
begin
  perform workspace_private.require_writing_capability('writer.resource.review');
  if expected_version is null or expected_version < 1 or request_id is null or review_token is null or review_token !~ '^[a-f0-9]{64}$' or confirmed is distinct from true then
    raise exception 'Review duplicates and confirm the complete import.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into existing from workspace_private.writing_batch_import_receipts r where r.workspace_id=target and r.request_id=writer_commit_import_batch.request_id;
  if found then
    if existing.batch_version<>expected_version or existing.review_token<>review_token then raise exception 'Import request already used.' using errcode = '40001'; end if;
    return jsonb_build_object('schemaVersion','1.0','batchVersion',existing.batch_version,'replayed',true,'resources',existing.resources);
  end if;
  select * into batch from workspace_private.writing_import_batches b where b.workspace_id=target for update;
  if batch.version is distinct from expected_version or batch.items is null then raise exception 'The staging list changed. Review duplicates again.' using errcode = '40001'; end if;
  review_items := workspace_private.writing_import_batch_review_items(target,batch.items);
  computed_token := encode(extensions.digest(jsonb_build_object('version',batch.version,'items',review_items)::text,'sha256'),'hex');
  if computed_token<>review_token then raise exception 'The library changed. Review duplicates again before importing.' using errcode = '40001'; end if;
  for item in select value from jsonb_array_elements(batch.items) where value->>'included'='true' loop
    imported := workspace.writer_import_resource((item->>'itemId')::uuid,jsonb_build_object(
      'title',item->>'title','body_text',item->'extraction'->>'text','resource_type',item->>'resourceType',
      'source_label',item->>'sourceLabel','metadata',jsonb_build_object('source_file',item->'extraction'->'file'->>'name')));
    resources := resources || jsonb_build_array(jsonb_build_object(
      'itemId',item->>'itemId','resourceId',imported->>'resourceId','title',item->>'title'));
  end loop;
  if jsonb_array_length(resources)=0 then raise exception 'Include at least one resource.' using errcode = '22023'; end if;
  insert into workspace_private.writing_batch_import_receipts(workspace_id,request_id,batch_version,review_token,resources)
  values(target,request_id,batch.version,review_token,resources);
  update workspace_private.writing_import_batches set version=version+1,request_id=gen_random_uuid(),items=null,saved_at=now()
  where workspace_id=target;
  return jsonb_build_object('schemaVersion','1.0','batchVersion',batch.version,'replayed',false,'resources',resources);
end; $$;

revoke all on function workspace_private.validate_writing_import_batch(jsonb),
  workspace_private.writing_import_batch_snapshot(workspace_private.writing_import_batches),
  workspace_private.writing_import_batch_review_items(uuid,jsonb) from public,anon,authenticated;
revoke all on function workspace.writer_get_import_batch(),workspace.writer_save_import_batch(integer,uuid,jsonb),
  workspace.writer_clear_import_batch(integer),workspace.writer_review_import_batch(integer),
  workspace.writer_commit_import_batch(integer,uuid,text,boolean) from public,anon,authenticated;
grant execute on function workspace.writer_get_import_batch(),workspace.writer_save_import_batch(integer,uuid,jsonb),
  workspace.writer_clear_import_batch(integer),workspace.writer_review_import_batch(integer),
  workspace.writer_commit_import_batch(integer,uuid,text,boolean) to authenticated;
notify pgrst, 'reload schema';
