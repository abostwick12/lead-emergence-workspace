-- Independent Ministry bundle data. No legacy ministry tables, provider
-- credentials, client defaults, or assignments are imported or created.
insert into workspace.bundle_definitions(bundle_key,display_name,description)
values('ministry','Ministry','Client-owned theological context, source-layered research and teaching archive.') on conflict do nothing;
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('ministry_profile','Theological preferences','Confirm your own context without inheriting another person''s beliefs.'),
 ('ministry_research','Ministry research','Find research projects and compare recorded source layers.'),
 ('ministry_teaching','Teaching preparation','Save research and explicitly approve proposed teaching changes.'),
 ('ministry_archive','Teaching archive','Recover prior sermons and teaching without treating them as current belief.')
on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
select 'ministry',x from unnest(array['ministry_profile','ministry_research','ministry_teaching','ministry_archive']) x on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('ministry','ministry_profile','ministry.profile'),('ministry','ministry_research','ministry.research'),
 ('ministry','ministry_teaching','ministry.teaching'),('ministry','ministry_archive','ministry.archive') on conflict do nothing;

create table workspace_private.ministry_documents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('profile','research','archive')),revision integer not null check(revision>0),data jsonb,
 origin text not null check(origin in ('user','assistant')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 search_vector tsvector generated always as (jsonb_to_tsvector('simple'::regconfig,coalesce(data,'{}'::jsonb),'["string"]'::jsonb)) stored,
 check(kind='profile' or data is not null),check(kind<>'profile' or origin='user'),unique(workspace_id,id)
);
create unique index ministry_one_profile on workspace_private.ministry_documents(workspace_id) where kind='profile';
create index ministry_document_search on workspace_private.ministry_documents using gin(search_vector);
create index ministry_document_list on workspace_private.ministry_documents(workspace_id,kind,updated_at desc,id);
create table workspace_private.ministry_document_versions(
 workspace_id uuid not null,document_id uuid not null,revision integer not null,kind text not null,data jsonb,
 origin text not null,created_at timestamptz not null,updated_at timestamptz not null,
 request_id uuid not null,recorded_by uuid not null references auth.users(id),
 primary key(document_id,revision),unique(workspace_id,request_id),
 foreign key(workspace_id,document_id) references workspace_private.ministry_documents(workspace_id,id) on delete cascade
);
create table workspace_private.ministry_proposals(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,document_id uuid not null,base_revision integer not null,
 patch jsonb not null,reason text not null,evidence text not null,origin text not null check(origin in ('user','assistant')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),
 request_id uuid not null,applied_revision integer,decided_by uuid references auth.users(id),decided_at timestamptz,
 unique(workspace_id,request_id),foreign key(workspace_id,document_id) references workspace_private.ministry_documents(workspace_id,id) on delete cascade
);
alter table workspace_private.ministry_documents enable row level security;
alter table workspace_private.ministry_document_versions enable row level security;
alter table workspace_private.ministry_proposals enable row level security;
revoke all on workspace_private.ministry_documents,workspace_private.ministry_document_versions,workspace_private.ministry_proposals from public,anon,authenticated;

create function workspace_private.require_ministry(p_kind text,p_write boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); capability text;
begin
 capability:=case p_kind when 'profile' then 'ministry.profile' when 'research' then 'ministry.research' when 'archive' then 'ministry.archive' else null end;
 if capability is null then raise exception 'Choose a Ministry record type.' using errcode='22023'; end if;
 if not workspace_private.bundle_capability_active(target,'ministry',capability)
 or (p_kind='research' and p_write and not workspace_private.bundle_capability_active(target,'ministry','ministry.teaching')) then
  raise exception 'Ministry access is unavailable.' using errcode='42501';
 end if;
 return target;
end; $$;
create function workspace_private.ministry_direct_user() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Confirm this change yourself in Workspace.' using errcode='42501';
 end if;
end; $$;

-- SQL validation is independent of the web/LLM schema. Unknown keys, wrong
-- types and citation substitution cannot reach canonical data via direct RPC.
create function workspace_private.ministry_object(p_value jsonb,p_text_limits jsonb,p_other_keys text[]) returns void
language plpgsql immutable set search_path='' as $$
declare item record;
begin
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Expected an object.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_value) k where not(p_text_limits ? k) and not(k=any(p_other_keys)))
 or exists(select 1 from jsonb_object_keys(p_text_limits) k where not(p_value ? k))
 or exists(select 1 from unnest(p_other_keys) k where not(p_value ? k)) then raise exception 'Invalid or missing Ministry field.' using errcode='22023'; end if;
 for item in select * from jsonb_each(p_text_limits) loop
  if jsonb_typeof(p_value->item.key)<>'string' or char_length(p_value->>item.key)>(item.value::text)::integer then raise exception 'Invalid Ministry text.' using errcode='22023'; end if;
 end loop;
end; $$;
create function workspace_private.ministry_array(p_value jsonb,p_count integer,p_chars integer default null) returns void
language plpgsql immutable set search_path='' as $$
declare v jsonb;
begin
 if p_value is null or jsonb_typeof(p_value)<>'array' then raise exception 'Expected a Ministry list.' using errcode='22023'; end if;
 if jsonb_array_length(p_value)>p_count then raise exception 'Ministry list is too long.' using errcode='22023'; end if;
 if p_chars is not null then
  for v in select * from jsonb_array_elements(p_value) loop
   if jsonb_typeof(v)<>'string' or char_length(trim(v#>>'{}')) not between 1 and p_chars then raise exception 'Invalid Ministry list entry.' using errcode='22023'; end if;
  end loop;
  if (select count(distinct lower(trim(x))) from jsonb_array_elements_text(p_value) x)<>jsonb_array_length(p_value) then raise exception 'Repeated Ministry list entry.' using errcode='22023'; end if;
 end if;
end; $$;
create function workspace_private.ministry_date(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare raw text:=p_value#>>'{}'; d date;
begin
 if p_value='null'::jsonb then return; end if;
 if jsonb_typeof(p_value) is distinct from 'string' or raw!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid Ministry date.' using errcode='22023'; end if;
 begin d:=raw::date; exception when others then raise exception 'Invalid Ministry date.' using errcode='22023'; end;
 if to_char(d,'YYYY-MM-DD')<>raw then raise exception 'Invalid Ministry date.' using errcode='22023'; end if;
end; $$;
create function workspace_private.ministry_url(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if p_value='null'::jsonb then return; end if;
 if jsonb_typeof(p_value) is distinct from 'string' or char_length(p_value#>>'{}')>2000
 or (p_value#>>'{}') !~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' then raise exception 'Invalid recorded source URL.' using errcode='22023'; end if;
end; $$;
create function workspace_private.ministry_uuid(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_value) is distinct from 'string' or (p_value#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid Ministry identifier.' using errcode='22023'; end if;
end; $$;
create function workspace_private.validate_ministry(p_kind text,p_data jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare v jsonb; n jsonb; sid jsonb; ids text[]:='{}'; note_ids text[]:='{}';
begin
 if p_kind='profile' and p_data is null then return; end if;
 if p_data is null or octet_length(p_data::text)>600000 then raise exception 'Ministry record is too large or empty.' using errcode='22023'; end if;
 if p_kind='profile' then
  perform workspace_private.ministry_object(p_data,'{"traditionContext":4000,"interpretiveNotes":6000,"dialoguePreferences":3000}',array['preferredTranslations','positions']);
  perform workspace_private.ministry_array(p_data->'preferredTranslations',20,120);
  perform workspace_private.ministry_array(p_data->'positions',30);
  for v in select * from jsonb_array_elements(p_data->'positions') loop
   perform workspace_private.ministry_object(v,'{"statement":2000,"epistemicState":20,"sourceReference":2000}',array['id']);
   perform workspace_private.ministry_uuid(v->'id');
   if trim(v->>'statement')='' or v->>'epistemicState' not in ('inferred','user_stated','confirmed','rejected') or (v->>'id')=any(ids) then raise exception 'Invalid theological position.' using errcode='22023'; end if;
   ids:=array_append(ids,v->>'id');
  end loop;
 elsif p_kind='research' then
  perform workspace_private.ministry_object(p_data,'{"title":240,"question":4000,"passage":500,"audience":300,"status":20,"teachingOutline":60000}',array['dueDate','sources','notes']);
  if trim(p_data->>'title')='' or trim(p_data->>'question')='' or p_data->>'status' not in ('draft','researching','ready','archived') then raise exception 'Invalid research details.' using errcode='22023'; end if;
  perform workspace_private.ministry_date(p_data->'dueDate');
  perform workspace_private.ministry_array(p_data->'sources',40);
  perform workspace_private.ministry_array(p_data->'notes',40);
  for v in select * from jsonb_array_elements(p_data->'sources') loop
   perform workspace_private.ministry_object(v,'{"title":500,"layer":40,"reference":2000,"author":300,"excerpt":8000,"comment":3000}',array['id','url','sourceDate','retrievedDate']);
   perform workspace_private.ministry_uuid(v->'id'); perform workspace_private.ministry_url(v->'url');
   perform workspace_private.ministry_date(v->'sourceDate'); perform workspace_private.ministry_date(v->'retrievedDate');
   if trim(v->>'title')='' or trim(v->>'reference')='' or (v->>'id')=any(ids) or v->>'layer' not in ('biblical_text','textual_language','academic_interpretation','historical_theology','reformed_presbyterian','pcusa','prior_writing','ai_synthesis') then raise exception 'Invalid Ministry source.' using errcode='22023'; end if;
   ids:=array_append(ids,v->>'id');
  end loop;
  for n in select * from jsonb_array_elements(p_data->'notes') loop
   perform workspace_private.ministry_object(n,'{"kind":20,"text":8000,"epistemicState":20}',array['id','sourceIds']);
   perform workspace_private.ministry_uuid(n->'id'); perform workspace_private.ministry_array(n->'sourceIds',40,36);
   if trim(n->>'text')='' or (n->>'id')=any(note_ids) or n->>'kind' not in ('observation','interpretation','question','application','ai_synthesis') or n->>'epistemicState' not in ('user_stated','inferred','rejected')
   or (n->>'kind'='ai_synthesis' and n->>'epistemicState'<>'inferred') then raise exception 'Invalid research note.' using errcode='22023'; end if;
   for sid in select * from jsonb_array_elements(n->'sourceIds') loop
    perform workspace_private.ministry_uuid(sid);
    if not((sid#>>'{}')=any(ids)) then raise exception 'A note cites a source outside its project.' using errcode='22023'; end if;
   end loop;
   note_ids:=array_append(note_ids,n->>'id');
  end loop;
 elsif p_kind='archive' then
  perform workspace_private.ministry_object(p_data,'{"title":240,"author":300,"resourceType":20,"audience":300,"summary":3000,"bodyText":100000,"sourceLabel":500,"status":20}',array['deliveredDate','scriptureReferences','topics','sourceUrl']);
  if trim(p_data->>'title')='' or trim(p_data->>'sourceLabel')='' or p_data->>'resourceType' not in ('sermon','teaching','study_guide','other') or p_data->>'status' not in ('active','archived') then raise exception 'Invalid teaching archive details.' using errcode='22023'; end if;
  perform workspace_private.ministry_date(p_data->'deliveredDate'); perform workspace_private.ministry_url(p_data->'sourceUrl');
  perform workspace_private.ministry_array(p_data->'scriptureReferences',40,240); perform workspace_private.ministry_array(p_data->'topics',40,120);
 else raise exception 'Unknown Ministry document.' using errcode='22023';
 end if;
end; $$;

create function workspace_private.ministry_document_result(p workspace_private.ministry_documents) returns jsonb
language sql immutable security definer set search_path='' as $$
 select case when p.id is null then null else jsonb_build_object('id',p.id,'kind',p.kind,'revision',p.revision,'data',p.data,'origin',p.origin,'createdAt',p.created_at,'updatedAt',p.updated_at) end;
$$;
create function workspace.ministry_get_document(p_kind text,p_document_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry(p_kind); d workspace_private.ministry_documents;
begin
 if p_kind='profile' and p_document_id is null then
  select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.kind='profile';
 else
  select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id;
  if not found then raise exception 'Ministry record unavailable.' using errcode='P0002'; end if;
 end if;
 return jsonb_build_object('document',workspace_private.ministry_document_result(d));
end; $$;
create function workspace.ministry_search_documents(p_kind text,p_search text default '',p_status text default null,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry(p_kind); query tsquery;
begin
 if p_kind='profile' or p_search is null or char_length(p_search)>200 or p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50
 or (p_status is not null and ((p_kind='research' and p_status not in ('draft','researching','ready','archived')) or (p_kind='archive' and p_status not in ('active','archived')))) then raise exception 'Invalid Ministry search.' using errcode='22023'; end if;
 query:=websearch_to_tsquery('simple',p_search);
 return (with matches as materialized (
  select x.* from workspace_private.ministry_documents x where x.workspace_id=target and x.kind=p_kind
   and (p_status is null or x.data->>'status'=p_status) and (trim(p_search)='' or x.search_vector@@query)
 ), page as (
  select jsonb_build_object('id',m.id,'kind',m.kind,'title',m.data->>'title','revision',m.revision,'status',m.data->>'status',
   'passage',coalesce(m.data->>'passage',''),'summary',coalesce(m.data->>'question',m.data->>'summary',''),'dueDate',m.data->'dueDate',
   'updatedAt',m.updated_at) item,m.updated_at,m.id from matches m order by m.updated_at desc,m.id limit p_limit offset p_offset
 ) select jsonb_build_object('total',(select count(*) from matches),'documents',coalesce((select jsonb_agg(item order by updated_at desc,id) from page),'[]')));
end; $$;
create function workspace_private.ministry_proposal_result(p workspace_private.ministry_proposals) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'documentId',p.document_id,'baseRevision',p.base_revision,'patch',p.patch,'reason',p.reason,
 'evidence',p.evidence,'origin',p.origin,'status',p.status,'createdAt',p.created_at,'appliedRevision',p.applied_revision);
$$;
create function workspace.ministry_propose_research(p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_patch jsonb,p_reason text,p_evidence text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry('research',true);d workspace_private.ministry_documents;
 p workspace_private.ministry_proposals; base_data jsonb; actor text:=case when auth.jwt()->>'client_id' is null then 'user' else 'assistant' end; normalized jsonb:=p_patch;
begin
 if p_expected_revision is null or p_expected_revision<1 or p_request_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or octet_length(p_patch::text)>600000
 or p_reason is null or char_length(trim(p_reason)) not between 1 and 2000 or p_evidence is null or char_length(trim(p_evidence)) not between 1 and 4000 then raise exception 'Invalid research proposal.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':ministry',0));
 select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.kind='research' and x.id=p_document_id for update;
 if not found then raise exception 'Ministry record unavailable.' using errcode='P0002'; end if;
 select v.data into base_data from workspace_private.ministry_document_versions v where v.workspace_id=target and v.document_id=d.id and v.revision=p_expected_revision;
 if not found then raise exception 'Research revision unavailable. Read the latest revision.' using errcode='40001'; end if;
 perform workspace_private.validate_ministry('research',base_data||p_patch);
 if actor='assistant' and p_patch ? 'notes' then
  -- An assistant cannot promote a newly authored interpretation to user testimony.
  normalized:=jsonb_set(p_patch,'{notes}',coalesce((select jsonb_agg(case when exists(select 1 from jsonb_array_elements(base_data->'notes') old where old=n) then n
   else jsonb_set(n,'{epistemicState}','"inferred"') end order by ord) from jsonb_array_elements(p_patch->'notes') with ordinality t(n,ord)),'[]'));
 end if;
 select * into p from workspace_private.ministry_proposals x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if p.document_id<>p_document_id or p.base_revision<>p_expected_revision or p.patch<>normalized or p.reason<>p_reason or p.evidence<>p_evidence or p.origin<>actor then raise exception 'Research proposal request already used.' using errcode='40001'; end if;
  return workspace_private.ministry_proposal_result(p);
 end if;
 if d.revision<>p_expected_revision then raise exception 'Research changed. Read the latest revision first.' using errcode='40001'; end if;
 insert into workspace_private.ministry_proposals(workspace_id,document_id,base_revision,patch,reason,evidence,origin,request_id)
 values(target,d.id,d.revision,normalized,p_reason,p_evidence,actor,p_request_id) returning * into p;
 return workspace_private.ministry_proposal_result(p);
end; $$;
create function workspace.ministry_decide_research(p_proposal_id uuid,p_expected_revision integer,p_decision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry('research',true); d workspace_private.ministry_documents; p workspace_private.ministry_proposals;
begin
 perform workspace_private.ministry_direct_user();
 if p_decision is null or p_decision not in ('approve','reject') or p_expected_revision is null or p_expected_revision<1 then raise exception 'Invalid research decision.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':ministry',0));
 select * into p from workspace_private.ministry_proposals x where x.workspace_id=target and x.id=p_proposal_id for update;
 if not found then raise exception 'Research proposal unavailable.' using errcode='P0002'; end if;
 select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.id=p.document_id and x.kind='research' for update;
 if not found then raise exception 'Ministry record unavailable.' using errcode='P0002'; end if;
 if p.status<>'pending' then
  if p.status<>(case when p_decision='approve' then 'approved' else 'rejected' end) then raise exception 'Research proposal already decided.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.ministry_document_result(d));
 end if;
 if p_decision='approve' then
  if d.revision<>p_expected_revision or p.base_revision<>d.revision then raise exception 'Research changed. Compare against the current revision.' using errcode='40001'; end if;
  perform workspace_private.validate_ministry('research',d.data||p.patch);
  update workspace_private.ministry_documents x set data=x.data||p.patch,revision=x.revision+1,origin=p.origin,updated_at=now() where x.id=d.id returning * into d;
  insert into workspace_private.ministry_document_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,gen_random_uuid(),auth.uid());
 end if;
 update workspace_private.ministry_proposals x set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 applied_revision=case when p_decision='approve' then d.revision else null end,decided_by=auth.uid(),decided_at=now() where x.id=p.id;
 return jsonb_build_object('document',workspace_private.ministry_document_result(d));
end; $$;
create function workspace.ministry_document_history(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry(p_kind);
begin
 perform workspace_private.ministry_direct_user();
 if not exists(select 1 from workspace_private.ministry_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id) then raise exception 'Ministry record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('revisions',coalesce((select jsonb_agg(item order by revision desc) from (
  select v.revision,jsonb_build_object('id',v.document_id,'kind',v.kind,'revision',v.revision,'data',v.data,'origin',v.origin,'createdAt',v.created_at,'updatedAt',v.updated_at) item
  from workspace_private.ministry_document_versions v where v.workspace_id=target and v.document_id=p_document_id
   and (v.revision=1 or v.revision in(select x.revision from workspace_private.ministry_document_versions x where x.workspace_id=target and x.document_id=p_document_id order by x.revision desc limit 9))
 ) versions),'[]'),'proposals',coalesce((select jsonb_agg(item order by created_at desc,id) from (
  select p.id,p.created_at,workspace_private.ministry_proposal_result(p) item from workspace_private.ministry_proposals p
  where p.workspace_id=target and p.document_id=p_document_id order by (p.status='pending') desc,p.created_at desc,p.id limit 50
 ) proposals),'[]'));
end; $$;
create function workspace.ministry_teaching_attention() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry('research');
begin
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.data->>'title','dueDate',d.data->>'dueDate','revision',d.revision,
  'reason',case when (d.data->>'dueDate')::date<current_date then 'The recorded teaching date has passed.' else 'A recorded teaching date is approaching.' end,
  'priority',case when (d.data->>'dueDate')::date<current_date then 'high' else 'normal' end) order by d.data->>'dueDate',d.id)
  from (select * from workspace_private.ministry_documents x where x.workspace_id=target and x.kind='research' and x.data->>'status'<>'archived'
   and x.data->>'dueDate' is not null and (x.data->>'dueDate')::date<=current_date+7 order by x.data->>'dueDate',x.id limit 10) d),'[]'));
end; $$;
create function workspace.ministry_save_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_confirm_profile boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_ministry(p_kind,true); d workspace_private.ministry_documents; v workspace_private.ministry_document_versions;
begin
 perform workspace_private.ministry_direct_user();
 if p_expected_revision is null or p_expected_revision<0 or p_request_id is null or (p_kind='profile' and p_confirm_profile is distinct from true) then raise exception 'Confirm the current Ministry details.' using errcode='22023'; end if;
 perform workspace_private.validate_ministry(p_kind,p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':ministry',0));
 select * into v from workspace_private.ministry_document_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.id=v.document_id;
  if v.kind<>p_kind or v.data is distinct from p_data or (p_document_id is not null and p_document_id<>d.id)
  or p_expected_revision<>v.revision-1 or d.revision<>v.revision then raise exception 'This Ministry save changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.ministry_document_result(d));
 end if;
 if p_kind='profile' and p_document_id is null then
  select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.kind='profile' for update;
 elsif p_document_id is not null then
  select * into d from workspace_private.ministry_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Ministry record unavailable.' using errcode='P0002'; end if;
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Ministry record changed. Your work was not applied.' using errcode='40001'; end if;
 if d.id is null then
  insert into workspace_private.ministry_documents(workspace_id,kind,revision,data,origin) values(target,p_kind,1,p_data,'user') returning * into d;
 else
  update workspace_private.ministry_documents x set revision=x.revision+1,data=p_data,origin='user',updated_at=now() where x.id=d.id returning * into d;
 end if;
 insert into workspace_private.ministry_document_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,p_request_id,auth.uid());
 return jsonb_build_object('document',workspace_private.ministry_document_result(d));
end; $$;

revoke all on function workspace_private.require_ministry(text,boolean),workspace_private.ministry_direct_user(),
 workspace_private.ministry_object(jsonb,jsonb,text[]),workspace_private.ministry_array(jsonb,integer,integer),
 workspace_private.ministry_date(jsonb),workspace_private.ministry_url(jsonb),workspace_private.ministry_uuid(jsonb),
 workspace_private.validate_ministry(text,jsonb),workspace_private.ministry_document_result(workspace_private.ministry_documents),
 workspace_private.ministry_proposal_result(workspace_private.ministry_proposals) from public,anon,authenticated;
revoke all on function workspace.ministry_get_document(text,uuid),workspace.ministry_save_document(text,uuid,integer,uuid,jsonb,boolean),
 workspace.ministry_search_documents(text,text,text,integer,integer),workspace.ministry_propose_research(uuid,integer,uuid,jsonb,text,text),
 workspace.ministry_decide_research(uuid,integer,text),workspace.ministry_document_history(text,uuid),workspace.ministry_teaching_attention() from public,anon,authenticated;
grant execute on function workspace.ministry_get_document(text,uuid),workspace.ministry_save_document(text,uuid,integer,uuid,jsonb,boolean),
 workspace.ministry_search_documents(text,text,text,integer,integer),workspace.ministry_propose_research(uuid,integer,uuid,jsonb,text,text),
 workspace.ministry_decide_research(uuid,integer,text),workspace.ministry_document_history(text,uuid),workspace.ministry_teaching_attention() to authenticated;
notify pgrst,'reload schema';
