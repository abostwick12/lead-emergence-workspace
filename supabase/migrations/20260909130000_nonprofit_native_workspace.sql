-- Generic, nonclinical founder operations. No assignments, client configuration,
-- external calendars, outreach deliveries or legacy runtime data are created.
insert into workspace.bundle_definitions(bundle_key,display_name,description)
values('nonprofit_founder','Nonprofit Founder','Source-aware founder roadmaps, administrative partnerships, meetings and research.') on conflict do nothing;
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('nonprofit_roadmap','Founder roadmaps','Sequence formation, governance and launch work with explicit owners and dependencies.'),
 ('nonprofit_partners','People and partnerships','Keep administrative partner, volunteer and donor follow-ups moving.'),
 ('nonprofit_meetings','Founder meetings','Record meeting plans, decisions and owned follow-up actions.'),
 ('nonprofit_regulatory_research','Nonprofit research','Preserve authoritative findings, interpretation, uncertainty and review needs.')
on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
select 'nonprofit_founder',x from unnest(array['nonprofit_roadmap','nonprofit_partners','nonprofit_meetings','nonprofit_regulatory_research']) x on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('nonprofit_founder','nonprofit_roadmap','nonprofit.roadmap'),('nonprofit_founder','nonprofit_partners','nonprofit.partners'),
 ('nonprofit_founder','nonprofit_meetings','nonprofit.meetings'),('nonprofit_founder','nonprofit_regulatory_research','nonprofit.regulatory_research') on conflict do nothing;

create table workspace_private.nonprofit_documents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('plan','partner','meeting','research')),revision integer not null check(revision>0),data jsonb not null,
 origin text not null check(origin in ('user','assistant')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 search_vector tsvector generated always as (jsonb_to_tsvector('simple'::regconfig,data,'["string"]'::jsonb)) stored,unique(workspace_id,id)
);
create index nonprofit_document_search on workspace_private.nonprofit_documents using gin(search_vector);
create index nonprofit_document_list on workspace_private.nonprofit_documents(workspace_id,kind,updated_at desc,id);
create table workspace_private.nonprofit_versions(
 workspace_id uuid not null,document_id uuid not null,revision integer not null,kind text not null,data jsonb not null,
 origin text not null,created_at timestamptz not null,updated_at timestamptz not null,
 request_id uuid not null,base_document_id uuid,base_revision integer not null,recorded_by uuid not null references auth.users(id),
 primary key(document_id,revision),unique(workspace_id,request_id),
 foreign key(workspace_id,document_id) references workspace_private.nonprofit_documents(workspace_id,id) on delete cascade
);
create table workspace_private.nonprofit_proposals(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('plan','partner','meeting','research')),document_id uuid,base_revision integer not null check(base_revision>=0),
 data jsonb not null,reason text not null,evidence text not null,origin text not null check(origin in ('user','assistant')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),
 request_id uuid not null,applied_document_id uuid,applied_revision integer,decided_by uuid references auth.users(id),decided_at timestamptz,
 unique(workspace_id,request_id),foreign key(workspace_id,document_id) references workspace_private.nonprofit_documents(workspace_id,id) on delete cascade,
 foreign key(workspace_id,applied_document_id) references workspace_private.nonprofit_documents(workspace_id,id) on delete cascade,
 check((document_id is null and base_revision=0) or (document_id is not null and base_revision>0))
);
create index nonprofit_proposal_queue on workspace_private.nonprofit_proposals(workspace_id,kind,status,created_at,id);
alter table workspace_private.nonprofit_documents enable row level security;
alter table workspace_private.nonprofit_versions enable row level security;
alter table workspace_private.nonprofit_proposals enable row level security;
revoke all on workspace_private.nonprofit_documents,workspace_private.nonprofit_versions,workspace_private.nonprofit_proposals from public,anon,authenticated;

create function workspace_private.nonprofit_capability(p_kind text) returns text
language sql immutable set search_path='' as $$
 select case p_kind when 'plan' then 'nonprofit.roadmap' when 'partner' then 'nonprofit.partners' when 'meeting' then 'nonprofit.meetings' when 'research' then 'nonprofit.regulatory_research' end;
$$;
create function workspace_private.require_nonprofit(p_kind text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); capability text:=workspace_private.nonprofit_capability(p_kind);
begin
 if capability is null then raise exception 'Choose a founder record type.' using errcode='22023'; end if;
 if not workspace_private.bundle_capability_active(target,'nonprofit_founder',capability) then raise exception 'Nonprofit access is unavailable.' using errcode='42501'; end if;
 return target;
end; $$;
create function workspace_private.nonprofit_direct_user() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Review and confirm this change yourself in Workspace.' using errcode='42501';
 end if;
end; $$;

-- Independently validate direct database input; never rely on model or browser validation.
create function workspace_private.nonprofit_object(p_value jsonb,p_text_limits jsonb,p_other_keys text[]) returns void
language plpgsql immutable set search_path='' as $$
declare item record;
begin
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Expected an administrative object.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_value) k where not(p_text_limits ? k) and not(k=any(p_other_keys)))
 or exists(select 1 from jsonb_object_keys(p_text_limits) k where not(p_value ? k))
 or exists(select 1 from unnest(p_other_keys) k where not(p_value ? k)) then raise exception 'Invalid or missing administrative field.' using errcode='22023'; end if;
 for item in select * from jsonb_each(p_text_limits) loop
  if jsonb_typeof(p_value->item.key)<>'string' or char_length(p_value->>item.key)>(item.value::text)::integer then raise exception 'Invalid founder text.' using errcode='22023'; end if;
 end loop;
end; $$;
create function workspace_private.nonprofit_array(p_value jsonb,p_count integer,p_chars integer default null) returns void
language plpgsql immutable set search_path='' as $$
declare v jsonb;
begin
 if p_value is null or jsonb_typeof(p_value)<>'array' then raise exception 'Expected a founder list.' using errcode='22023'; end if;
 if jsonb_array_length(p_value)>p_count then raise exception 'Founder list is too long.' using errcode='22023'; end if;
 if p_chars is not null then
  for v in select * from jsonb_array_elements(p_value) loop
   if jsonb_typeof(v)<>'string' or char_length(trim(v#>>'{}')) not between 1 and p_chars then raise exception 'Invalid founder list entry.' using errcode='22023'; end if;
  end loop;
  if (select count(distinct lower(trim(x))) from jsonb_array_elements_text(p_value) x)<>jsonb_array_length(p_value) then raise exception 'Repeated founder list entry.' using errcode='22023'; end if;
 end if;
end; $$;
create function workspace_private.nonprofit_date(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare raw text:=p_value#>>'{}'; d date;
begin
 if p_value='null'::jsonb then return; end if;
 if jsonb_typeof(p_value) is distinct from 'string' or raw!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid founder date.' using errcode='22023'; end if;
 begin d:=raw::date; exception when others then raise exception 'Invalid founder date.' using errcode='22023'; end;
 if to_char(d,'YYYY-MM-DD')<>raw then raise exception 'Invalid founder date.' using errcode='22023'; end if;
end; $$;
create function workspace_private.nonprofit_uuid(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_value) is distinct from 'string' or (p_value#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid founder identifier.' using errcode='22023'; end if;
end; $$;
create function workspace_private.validate_nonprofit(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare v jsonb; dependency_value jsonb; ids text[]:='{}'; action_list jsonb;
begin
 if p_data is null or octet_length(p_data::text)>600000 then raise exception 'Founder record is too large or empty.' using errcode='22023'; end if;
 if p_kind='plan' then
  perform workspace_private.nonprofit_object(p_data,'{"title":240,"mission":4000,"jurisdiction":500,"status":20}',array['targetDate','milestones']);
  perform workspace_private.nonprofit_date(p_data->'targetDate'); perform workspace_private.nonprofit_array(p_data->'milestones',50);
  if p_data->>'status' not in ('active','paused','archived') then raise exception 'Invalid roadmap status.' using errcode='22023'; end if;
  action_list:=p_data->'milestones';
 elsif p_kind='partner' then
  perform workspace_private.nonprofit_object(p_data,'{"title":240,"role":20,"contactName":200,"contactEmail":320,"stage":20,"owner":200,"nextAction":2000,"notes":12000,"outreachDraft":8000}',array['followupDate','lastContactDate']);
  perform workspace_private.nonprofit_date(p_data->'followupDate'); perform workspace_private.nonprofit_date(p_data->'lastContactDate');
  if p_data->>'role' not in ('partner','volunteer','donor','grantmaker','board','other')
  or p_data->>'stage' not in ('identified','contacted','conversation','committed','closed')
  or ((p_data->>'contactEmail')<>'' and (p_data->>'contactEmail')!~'^(?!\.)(?!.*\.\.)([A-Za-z0-9_''+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$') then raise exception 'Invalid administrative partnership.' using errcode='22023'; end if;
 elsif p_kind='meeting' then
  perform workspace_private.nonprofit_object(p_data,'{"title":240,"localTime":5,"timeZone":80,"location":500,"status":20,"agenda":8000,"notes":20000}',array['scheduledDate','participants','decisions','actions']);
  perform workspace_private.nonprofit_date(p_data->'scheduledDate'); perform workspace_private.nonprofit_array(p_data->'participants',40,240);
  perform workspace_private.nonprofit_array(p_data->'decisions',30,2000); perform workspace_private.nonprofit_array(p_data->'actions',40);
  if p_data->>'status' not in ('scheduled','completed','cancelled')
  or ((p_data->>'localTime')<>'' and ((p_data->>'localTime')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_data->>'scheduledDate' is null or trim(p_data->>'timeZone')=''))
  or ((p_data->>'timeZone')<>'' and not exists(select 1 from pg_catalog.pg_timezone_names t where lower(t.name)=lower(p_data->>'timeZone'))) then raise exception 'Invalid meeting date or time zone.' using errcode='22023'; end if;
  action_list:=p_data->'actions';
 elsif p_kind='research' then
  perform workspace_private.nonprofit_object(p_data,'{"title":240,"category":20,"jurisdiction":500,"question":4000,"status":20,"owner":200,"interpretation":8000,"uncertainty":4000,"requiredAction":4000,"professionalReview":2000,"epistemicState":20}',array['reviewDate','sources']);
  perform workspace_private.nonprofit_date(p_data->'reviewDate'); perform workspace_private.nonprofit_array(p_data->'sources',30);
  if trim(p_data->>'jurisdiction')='' or trim(p_data->>'question')='' or trim(p_data->>'uncertainty')='' or trim(p_data->>'professionalReview')=''
  or p_data->>'category' not in ('formation','governance','fundraising','grant','regulatory','policy')
  or p_data->>'status' not in ('open','researching','review_required','reviewed','archived')
  or p_data->>'epistemicState' not in ('user_stated','inferred','stale','rejected')
  or (p_data->>'status'='reviewed' and jsonb_array_length(p_data->'sources')=0) then raise exception 'Research requires uncertainty, review guidance and source-aware status.' using errcode='22023'; end if;
  for v in select * from jsonb_array_elements(p_data->'sources') loop
   perform workspace_private.nonprofit_object(v,'{"title":500,"authority":500,"authorityType":30,"url":2000,"reference":2000,"jurisdiction":500,"finding":8000}',array['id','retrievedDate','effectiveDate','sourceDate']);
   perform workspace_private.nonprofit_uuid(v->'id'); perform workspace_private.nonprofit_date(v->'retrievedDate');
   perform workspace_private.nonprofit_date(v->'effectiveDate'); perform workspace_private.nonprofit_date(v->'sourceDate');
   if trim(v->>'title')='' or trim(v->>'authority')='' or trim(v->>'jurisdiction')='' or trim(v->>'finding')='' or v->>'retrievedDate' is null
   or v->>'authorityType' not in ('government','grantmaker','primary_organization','secondary')
   or (v->>'url')!~'^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' or (v->>'id')=any(ids) then raise exception 'Invalid research source.' using errcode='22023'; end if;
   ids:=array_append(ids,v->>'id');
  end loop;
 else raise exception 'Unknown founder record.' using errcode='22023';
 end if;
 if trim(p_data->>'title')='' then raise exception 'A record needs a title.' using errcode='22023'; end if;
 if action_list is not null then
  for v in select * from jsonb_array_elements(action_list) loop
   if p_kind='plan' then
    perform workspace_private.nonprofit_object(v,'{"title":240,"owner":200,"status":20,"nextAction":2000,"evidence":2000,"priority":10,"category":20}',array['id','dueDate','dependsOn']);
    perform workspace_private.nonprofit_array(v->'dependsOn',20,36);
    if v->>'category' not in ('formation','governance','partnerships','volunteers','funding','policy','launch','other') then raise exception 'Invalid milestone category.' using errcode='22023'; end if;
   else
    perform workspace_private.nonprofit_object(v,'{"title":240,"owner":200,"status":20,"nextAction":2000,"evidence":2000,"priority":10}',array['id','dueDate']);
   end if;
   perform workspace_private.nonprofit_uuid(v->'id'); perform workspace_private.nonprofit_date(v->'dueDate');
   if trim(v->>'title')='' or v->>'status' not in ('planned','in_progress','blocked','done','skipped') or v->>'priority' not in ('high','normal') or (v->>'id')=any(ids) then raise exception 'Invalid founder action.' using errcode='22023'; end if;
   ids:=array_append(ids,v->>'id');
  end loop;
  if p_kind='plan' then
   for v in select * from jsonb_array_elements(action_list) loop
    for dependency_value in select * from jsonb_array_elements(v->'dependsOn') loop
     perform workspace_private.nonprofit_uuid(dependency_value);
     if not((dependency_value#>>'{}')=any(ids)) then raise exception 'Dependency is outside this roadmap.' using errcode='22023'; end if;
    end loop;
   end loop;
   if exists(with recursive edges as (
    select a->>'id' a,d dep from jsonb_array_elements(action_list) a cross join lateral jsonb_array_elements_text(a->'dependsOn') d
   ), reach(a,dep) as (
    select a,dep from edges union select r.a,e.dep from reach r join edges e on e.a=r.dep
   ) select 1 from reach where a=dep) then raise exception 'Roadmap dependencies form a cycle.' using errcode='22023'; end if;
  end if;
 end if;
end; $$;

create function workspace_private.nonprofit_document_result(p workspace_private.nonprofit_documents) returns jsonb
language sql immutable security definer set search_path='' as $$
 select case when p.id is null then null else jsonb_build_object('id',p.id,'kind',p.kind,'revision',p.revision,'data',p.data,'origin',p.origin,'createdAt',p.created_at,'updatedAt',p.updated_at) end;
$$;
create function workspace_private.nonprofit_proposal_result(p workspace_private.nonprofit_proposals) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind',p.kind,'documentId',p.document_id,'baseRevision',p.base_revision,'data',p.data,'reason',p.reason,
 'evidence',p.evidence,'origin',p.origin,'status',p.status,'createdAt',p.created_at,'appliedDocumentId',p.applied_document_id,'appliedRevision',p.applied_revision);
$$;
create function workspace.nonprofit_get_document(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind); d workspace_private.nonprofit_documents;
begin
 select * into d from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id;
 if not found then raise exception 'Founder record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('document',workspace_private.nonprofit_document_result(d));
end; $$;
create function workspace.nonprofit_search_documents(p_kind text,p_search text default '',p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind); query tsquery;
begin
 if p_search is null or char_length(p_search)>200 or p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid founder search.' using errcode='22023'; end if;
 query:=websearch_to_tsquery('simple',p_search);
 return (with matches as materialized (
  select x.* from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=p_kind and (trim(p_search)='' or x.search_vector@@query)
 ), page as (
  select jsonb_build_object('id',m.id,'kind',m.kind,'title',m.data->>'title','revision',m.revision,'status',coalesce(m.data->>'status',m.data->>'stage'),
   'summary',left(coalesce(m.data->>'mission',m.data->>'nextAction',m.data->>'agenda',m.data->>'question',''),500),
   'dueDate',coalesce(m.data->'targetDate',m.data->'followupDate',m.data->'scheduledDate',m.data->'reviewDate','null'::jsonb),
   'updatedAt',m.updated_at) item,m.updated_at,m.id from matches m order by m.updated_at desc,m.id limit p_limit offset p_offset
 ) select jsonb_build_object('total',(select count(*) from matches),'documents',coalesce((select jsonb_agg(item order by updated_at desc,id) from page),'[]')));
end; $$;
create function workspace.nonprofit_save_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_confirm_administrative boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind); d workspace_private.nonprofit_documents; v workspace_private.nonprofit_versions;
begin
 perform workspace_private.nonprofit_direct_user();
 if p_confirm_administrative is distinct from true or p_request_id is null or p_expected_revision is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1) then raise exception 'Confirm the exact administrative record and revision.' using errcode='22023'; end if;
 perform workspace_private.validate_nonprofit(p_kind,p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':nonprofit',0));
 select * into v from workspace_private.nonprofit_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  select * into d from workspace_private.nonprofit_documents x where x.workspace_id=target and x.id=v.document_id;
  if v.kind<>p_kind or v.data<>p_data or v.base_document_id is distinct from p_document_id or v.base_revision<>p_expected_revision
  or v.origin<>'user' or d.revision<>v.revision then raise exception 'This founder save changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.nonprofit_document_result(d));
 end if;
 if p_document_id is not null then
  select * into d from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Founder record unavailable.' using errcode='P0002'; end if;
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Founder record changed. Your work was not applied.' using errcode='40001'; end if;
 if d.id is null then
  insert into workspace_private.nonprofit_documents(workspace_id,kind,revision,data,origin) values(target,p_kind,1,p_data,'user') returning * into d;
 else
  update workspace_private.nonprofit_documents x set revision=x.revision+1,data=p_data,origin='user',updated_at=now() where x.id=d.id returning * into d;
 end if;
 insert into workspace_private.nonprofit_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,p_request_id,p_document_id,p_expected_revision,auth.uid());
 return jsonb_build_object('document',workspace_private.nonprofit_document_result(d));
end; $$;
create function workspace.nonprofit_propose_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_reason text,p_evidence text,p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind);d workspace_private.nonprofit_documents;
 p workspace_private.nonprofit_proposals; base_data jsonb; actor text:=case when auth.jwt()->>'client_id' is null then 'user' else 'assistant' end; normalized jsonb:=p_data;
begin
 if p_scope is distinct from 'administrative_only' or p_expected_revision is null or p_request_id is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1)
 or p_reason is null or char_length(trim(p_reason)) not between 1 and 2000 or p_evidence is null or char_length(trim(p_evidence)) not between 1 and 4000 then raise exception 'Invalid administrative proposal.' using errcode='22023'; end if;
 perform workspace_private.validate_nonprofit(p_kind,p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':nonprofit',0));
 if p_document_id is not null then
  select * into d from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Founder record unavailable.' using errcode='P0002'; end if;
  select x.data into base_data from workspace_private.nonprofit_versions x where x.workspace_id=target and x.document_id=d.id and x.revision=p_expected_revision;
  if not found then raise exception 'Founder base revision unavailable.' using errcode='40001'; end if;
 end if;
 -- The immutable base makes retries deterministic, even after later edits.
 if actor='assistant' and p_kind='research' and base_data is distinct from p_data then
  normalized:=jsonb_set(normalized,'{epistemicState}','"inferred"');
  if normalized->>'status'='reviewed' then normalized:=jsonb_set(normalized,'{status}','"review_required"'); end if;
 end if;
 select * into p from workspace_private.nonprofit_proposals x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if p.kind<>p_kind or p.document_id is distinct from p_document_id or p.base_revision<>p_expected_revision or p.data<>normalized or p.reason<>p_reason or p.evidence<>p_evidence or p.origin<>actor then raise exception 'Founder proposal request already used.' using errcode='40001'; end if;
  return workspace_private.nonprofit_proposal_result(p);
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Founder record changed. Read the latest revision first.' using errcode='40001'; end if;
 insert into workspace_private.nonprofit_proposals(workspace_id,kind,document_id,base_revision,data,reason,evidence,origin,request_id)
 values(target,p_kind,p_document_id,p_expected_revision,normalized,p_reason,p_evidence,actor,p_request_id) returning * into p;
 return workspace_private.nonprofit_proposal_result(p);
end; $$;
create function workspace.nonprofit_list_proposals(p_kind text,p_offset integer default 0,p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind);
begin
 perform workspace_private.nonprofit_direct_user();
 if p_offset is null or p_offset not between 0 and 10000 or p_status is null or p_status not in ('pending','approved','rejected') then raise exception 'Invalid proposal page.' using errcode='22023'; end if;
 return (with matches as materialized (
  select x.* from workspace_private.nonprofit_proposals x where x.workspace_id=target and x.kind=p_kind and x.status=p_status
 ), page as (select * from matches order by created_at,id limit 25 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matches),'proposals',coalesce((select jsonb_agg(workspace_private.nonprofit_proposal_result(p) order by p.created_at,p.id) from page p),'[]')));
end; $$;
create function workspace.nonprofit_decide_proposal(p_proposal_id uuid,p_expected_revision integer,p_decision text,p_confirm_administrative boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); d workspace_private.nonprofit_documents; p workspace_private.nonprofit_proposals;
begin
 perform workspace_private.nonprofit_direct_user();
 if p_decision is null or p_decision not in ('approve','reject') or p_expected_revision is null or p_expected_revision<0 or (p_decision='approve' and p_confirm_administrative is distinct from true) then raise exception 'Confirm the exact administrative proposal.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':nonprofit',0));
 select * into p from workspace_private.nonprofit_proposals x where x.workspace_id=target and x.id=p_proposal_id for update;
 if not found then raise exception 'Founder proposal unavailable.' using errcode='P0002'; end if;
 perform workspace_private.require_nonprofit(p.kind);
 if p.base_revision<>p_expected_revision then raise exception 'Proposal base revision changed.' using errcode='40001'; end if;
 if p.document_id is not null or p.applied_document_id is not null then
  select * into d from workspace_private.nonprofit_documents x where x.workspace_id=target and x.id=coalesce(p.applied_document_id,p.document_id) and x.kind=p.kind for update;
  if not found then raise exception 'Founder record unavailable.' using errcode='P0002'; end if;
 end if;
 if p.status<>'pending' then
  if p.status<>(case when p_decision='approve' then 'approved' else 'rejected' end)
  or (p.status='approved' and d.revision<>p.applied_revision) then raise exception 'This proposal decision changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.nonprofit_document_result(d),'proposal',workspace_private.nonprofit_proposal_result(p));
 end if;
 if p_decision='approve' then
  if coalesce(d.revision,0)<>p.base_revision then raise exception 'Founder record changed. Compare against the latest revision.' using errcode='40001'; end if;
  perform workspace_private.validate_nonprofit(p.kind,p.data);
  if d.id is null then
   insert into workspace_private.nonprofit_documents(workspace_id,kind,revision,data,origin) values(target,p.kind,1,p.data,p.origin) returning * into d;
  else
   update workspace_private.nonprofit_documents x set data=p.data,revision=x.revision+1,origin=p.origin,updated_at=now() where x.id=d.id returning * into d;
  end if;
  insert into workspace_private.nonprofit_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,gen_random_uuid(),p.document_id,p.base_revision,auth.uid());
 end if;
 update workspace_private.nonprofit_proposals x set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 applied_document_id=case when p_decision='approve' then d.id else null end,
 applied_revision=case when p_decision='approve' then d.revision else null end,decided_by=auth.uid(),decided_at=now() where x.id=p.id returning * into p;
 return jsonb_build_object('document',workspace_private.nonprofit_document_result(d),'proposal',workspace_private.nonprofit_proposal_result(p));
end; $$;
create function workspace.nonprofit_document_history(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_nonprofit(p_kind);
begin
 perform workspace_private.nonprofit_direct_user();
 if not exists(select 1 from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id) then raise exception 'Founder record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('revisions',coalesce((select jsonb_agg(item order by revision desc) from (
  select v.revision,jsonb_build_object('id',v.document_id,'kind',v.kind,'revision',v.revision,'data',v.data,'origin',v.origin,'createdAt',v.created_at,'updatedAt',v.updated_at) item
  from workspace_private.nonprofit_versions v where v.workspace_id=target and v.document_id=p_document_id
   and (v.revision=1 or v.revision in(select x.revision from workspace_private.nonprofit_versions x where x.workspace_id=target and x.document_id=p_document_id order by x.revision desc limit 9))
 ) versions),'[]'));
end; $$;

create function workspace.nonprofit_next_moves() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace();
begin
 if not exists(select 1 from unnest(array['plan','partner','meeting','research']) k
  where workspace_private.bundle_capability_active(target,'nonprofit_founder',workspace_private.nonprofit_capability(k))) then
  raise exception 'Nonprofit access is unavailable.' using errcode='42501';
 end if;
 return (with admitted as materialized (
  select x.* from workspace_private.nonprofit_documents x where x.workspace_id=target
   and workspace_private.bundle_capability_active(target,'nonprofit_founder',workspace_private.nonprofit_capability(x.kind))
 ), actions as (
  select d.id::text||':'||(a->>'id') item_id,d.id document_id,d.kind,d.revision,
   a->>'title' title,coalesce(a->>'owner','') owner,(a->>'dueDate')::date due_date,
   case when a->>'status'='blocked' or exists(select 1 from jsonb_array_elements_text(a->'dependsOn') dep join lateral jsonb_array_elements(d.data->'milestones') m on m->>'id'=dep where m->>'status' not in ('done','skipped'))
    then 'This milestone is blocked or has unfinished dependencies.'
    when (a->>'dueDate')::date<current_date then 'This milestone is overdue.'
    when trim(a->>'owner')='' then 'This milestone needs an owner.'
    else 'An active roadmap has an unfinished next move.' end reason,
   coalesce(nullif(a->>'evidence',''),'Saved roadmap: '||(d.data->>'title')||', revision '||d.revision) evidence,
   case when a->>'priority'='high' or a->>'status'='blocked' or (a->>'dueDate')::date<current_date then 0 else 1 end rank
  from admitted d cross join lateral jsonb_array_elements(coalesce(d.data->'milestones','[]')) a
  where d.kind='plan' and d.data->>'status'='active' and a->>'status' not in ('done','skipped')
  union all
  select d.id::text,d.id,d.kind,d.revision,d.data->>'title',d.data->>'owner',(d.data->>'followupDate')::date,
   case when (d.data->>'followupDate')::date<current_date then 'This administrative follow-up is overdue.'
    when d.data->>'followupDate' is null then 'A recorded follow-up needs a date.' else 'A recorded follow-up is due soon.' end,
   coalesce(nullif(d.data->>'nextAction',''),'Saved partnership revision '||d.revision),
   case when (d.data->>'followupDate')::date<current_date then 0 else 1 end
  from admitted d where d.kind='partner' and d.data->>'stage'<>'closed'
   and ((d.data->>'followupDate')::date<=current_date+7 or (d.data->>'followupDate' is null and trim(d.data->>'nextAction')<>''))
  union all
  select d.id::text,d.id,d.kind,d.revision,d.data->>'title','',(d.data->>'scheduledDate')::date,
   case when (d.data->>'scheduledDate')::date<current_date then 'The recorded meeting date passed; confirm its outcome.' else 'A meeting plan is approaching; this is not a calendar booking.' end,
   'Saved meeting plan, revision '||d.revision,case when (d.data->>'scheduledDate')::date<current_date then 0 else 1 end
  from admitted d where d.kind='meeting' and d.data->>'status'='scheduled' and (d.data->>'scheduledDate')::date<=current_date+7
  union all
  select d.id::text||':'||(a->>'id'),d.id,d.kind,d.revision,a->>'title',a->>'owner',(a->>'dueDate')::date,
   case when a->>'status'='blocked' then 'A meeting action is blocked.' when (a->>'dueDate')::date<current_date then 'A meeting action is overdue.'
    when trim(a->>'owner')='' then 'A meeting action needs an owner.' else 'An agreed meeting action remains open.' end,
   coalesce(nullif(a->>'evidence',''),'Saved meeting: '||(d.data->>'title')||', revision '||d.revision),
   case when a->>'priority'='high' or a->>'status'='blocked' or (a->>'dueDate')::date<current_date then 0 else 1 end
  from admitted d cross join lateral jsonb_array_elements(coalesce(d.data->'actions','[]')) a
  where d.kind='meeting' and d.data->>'status'<>'cancelled' and a->>'status' not in ('done','skipped')
  union all
  select d.id::text,d.id,d.kind,d.revision,d.data->>'title',d.data->>'owner',(d.data->>'reviewDate')::date,
   case when jsonb_array_length(d.data->'sources')=0 then 'This research question has no recorded sources.'
    when (d.data->>'reviewDate')::date<current_date then 'The recorded research review date has passed.'
    else 'This research needs review; saved findings do not certify compliance.' end,
   'Saved research question, revision '||d.revision||'. '||left(d.data->>'requiredAction',1000),
   case when (d.data->>'reviewDate')::date<current_date then 0 else 1 end
  from admitted d where d.kind='research' and d.data->>'status'<>'archived'
   and (d.data->>'status'='review_required' or (d.data->>'reviewDate')::date<=current_date+7
    or (d.data->>'status'<>'reviewed' and jsonb_array_length(d.data->'sources')=0))
 ), page as (
  select * from actions order by rank,due_date nulls last,item_id limit 30
 ) select jsonb_build_object('asOfDate',current_date,'total',(select count(*) from actions),'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',p.item_id,'documentId',p.document_id,'kind',p.kind,'title',p.title,'owner',p.owner,'dueDate',p.due_date,'revision',p.revision,
  'reason',p.reason,'evidence',p.evidence,'priority',case when p.rank=0 then 'high' else 'normal' end)
  order by p.rank,p.due_date nulls last,p.item_id) from page p),'[]')));
end; $$;

revoke all on function workspace_private.nonprofit_capability(text),workspace_private.require_nonprofit(text),workspace_private.nonprofit_direct_user(),
 workspace_private.nonprofit_object(jsonb,jsonb,text[]),workspace_private.nonprofit_array(jsonb,integer,integer),workspace_private.nonprofit_date(jsonb),
 workspace_private.nonprofit_uuid(jsonb),workspace_private.validate_nonprofit(text,jsonb),
 workspace_private.nonprofit_document_result(workspace_private.nonprofit_documents),workspace_private.nonprofit_proposal_result(workspace_private.nonprofit_proposals)
 from public,anon,authenticated;
revoke all on function workspace.nonprofit_get_document(text,uuid),workspace.nonprofit_search_documents(text,text,integer,integer),
 workspace.nonprofit_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.nonprofit_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.nonprofit_list_proposals(text,integer,text),workspace.nonprofit_decide_proposal(uuid,integer,text,boolean),
 workspace.nonprofit_document_history(text,uuid),workspace.nonprofit_next_moves() from public,anon,authenticated;
grant execute on function workspace.nonprofit_get_document(text,uuid),workspace.nonprofit_search_documents(text,text,integer,integer),
 workspace.nonprofit_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.nonprofit_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.nonprofit_list_proposals(text,integer,text),workspace.nonprofit_decide_proposal(uuid,integer,text,boolean),
 workspace.nonprofit_document_history(text,uuid),workspace.nonprofit_next_moves() to authenticated;
notify pgrst,'reload schema';
