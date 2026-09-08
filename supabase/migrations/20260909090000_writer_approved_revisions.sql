-- Native imports and immutable, approval-backed revisions. No assignments or publishing.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('writer_resource_metadata','Writing proposals','Save suggestions for review.'),
 ('writer_resource_manage','Writing revisions','Import and explicitly approve private library revisions.') on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key) values
 ('writer_editor','writer_resource_metadata'),('writer_editor','writer_resource_manage') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('writer_editor','writer_resource_metadata','writer.resource.metadata'),
 ('writer_editor','writer_resource_manage','writer.resource.manage') on conflict do nothing;
alter table workspace_private.writing_resources add column revision integer not null default 1 check (revision>0);
alter table workspace_private.writing_resources add column metadata jsonb not null default '{}';
create table workspace_private.writing_revisions (
 resource_id uuid not null references workspace_private.writing_resources(id) on delete cascade,
 revision integer not null check (revision>0),
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 snapshot jsonb not null, reason text not null,
 origin text not null check (origin in ('recorded','user_import','user_approved_proposal')),
 actor_id uuid references auth.users(id) on delete set null,
 recorded_at timestamptz not null default now(), primary key(resource_id,revision)
);
insert into workspace_private.writing_revisions(resource_id,revision,workspace_id,snapshot,reason,origin)
 select id,revision,workspace_id,to_jsonb(r)-'workspace_id','Existing resource preserved.','recorded' from workspace_private.writing_resources r;
create table workspace_private.writing_proposals (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references workspace_private.writing_resources(id) on delete cascade,
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 request_id uuid not null, base_revision integer not null check (base_revision>0), patch jsonb not null,
 reason text not null check (char_length(trim(reason)) between 1 and 2000),
 evidence text not null check (char_length(trim(evidence)) between 1 and 4000),
 origin text not null check (origin in ('user','assistant')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), decided_at timestamptz,
 decided_by uuid references auth.users(id) on delete set null, applied_revision integer,
 unique(workspace_id,request_id)
);
create index writing_proposals_resource_idx on workspace_private.writing_proposals(workspace_id,resource_id,created_at desc);
create table workspace_private.writing_import_requests (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade, request_id uuid not null,
 resource_id uuid not null references workspace_private.writing_resources(id) on delete cascade,
 payload jsonb not null, primary key(workspace_id,request_id)
);
alter table workspace_private.writing_revisions enable row level security;
alter table workspace_private.writing_proposals enable row level security;
alter table workspace_private.writing_import_requests enable row level security;
revoke all on workspace_private.writing_revisions,workspace_private.writing_proposals,workspace_private.writing_import_requests from public,anon,authenticated;

-- Validate at the database boundary too: callers can invoke RPC without the UI.
create function workspace_private.validate_writing_patch(patch jsonb) returns void
language plpgsql immutable security definer set search_path='' as $$
declare item record; nested record; lim integer;
begin
 if patch is null or jsonb_typeof(patch)<>'object' or patch='{}' or octet_length(patch::text)>650000 then
  raise exception 'Invalid writing change.' using errcode='22023';
 end if;
 for item in select * from jsonb_each(patch) loop
  if item.key not in ('title','author','resource_type','audience','topics','abstract','body_text','metadata','publication_state') then
   raise exception 'Invalid writing change.' using errcode='22023';
  end if;
  if item.key='metadata' then
   if jsonb_typeof(item.value)<>'object' then raise exception 'Invalid writing metadata.' using errcode='22023'; end if;
   for nested in select * from jsonb_each(item.value) loop
    if nested.key in ('themes','scripture_references','keywords','related_resource_ids','duplicate_candidate_ids') then
     if jsonb_typeof(nested.value)<>'array' then raise exception 'Invalid writing metadata.' using errcode='22023'; end if;
     if jsonb_array_length(nested.value)>30 or exists(select 1 from jsonb_array_elements(nested.value) v where jsonb_typeof(v)<>'string' or char_length(v#>>'{}') not between 1 and 240) then
      raise exception 'Invalid writing metadata.' using errcode='22023';
     end if;
     if nested.key in ('related_resource_ids','duplicate_candidate_ids') and exists(select 1 from jsonb_array_elements_text(nested.value) v where v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'Invalid writing metadata.' using errcode='22023';
     end if;
    elsif nested.key in ('series','website_summary','seo_description','source_file','canonical_file','provider_record_id') then
     lim:=case when nested.key='website_summary' then 3000 when nested.key='seo_description' then 320 else 500 end;
     if jsonb_typeof(nested.value)<>'string' or char_length(nested.value#>>'{}')>lim then raise exception 'Invalid writing metadata.' using errcode='22023'; end if;
    else raise exception 'Invalid writing metadata.' using errcode='22023';
    end if;
   end loop;
  elsif item.key='topics' then
   if jsonb_typeof(item.value)<>'array' then raise exception 'Invalid writing change.' using errcode='22023'; end if;
   if jsonb_array_length(item.value)>30 or exists(select 1 from jsonb_array_elements(item.value) v where jsonb_typeof(v)<>'string' or char_length(trim(v#>>'{}')) not between 1 and 120) then
    raise exception 'Invalid writing change.' using errcode='22023';
   end if;
  elsif item.value='null'::jsonb and item.key in ('author','audience','abstract') then null;
  else
   lim:=case item.key when 'body_text' then 100000 when 'abstract' then 3000 when 'audience' then 300 else 240 end;
   if jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>lim
    or (item.key='title' and char_length(trim(item.value#>>'{}'))=0)
    or (item.key='resource_type' and item.value#>>'{}' not in ('article','sermon','teaching','study_guide','other'))
    or (item.key='publication_state' and item.value#>>'{}' not in ('draft','in_review','ready','archived')) then
    raise exception 'Invalid writing change.' using errcode='22023';
   end if;
  end if;
 end loop;
end; $$;
create function workspace_private.require_writing_direct() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target_workspace uuid:=workspace_private.require_writing_capability('writer.resource.manage');
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Open Workspace to approve this action yourself.' using errcode='42501';
 end if;
 return target_workspace;
end; $$;

create function workspace.writer_import_resource(request_id uuid,resource_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_workspace uuid:=workspace_private.require_writing_direct();
 existing workspace_private.writing_import_requests; saved workspace_private.writing_resources; editable jsonb; source_date_value date; related_id text;
begin
 if request_id is null or resource_input is null or jsonb_typeof(resource_input)<>'object' then raise exception 'Invalid resource import.' using errcode='22023'; end if;
 -- Same lock ordering for all writes. Retries cannot create duplicates.
 perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
 select * into existing from workspace_private.writing_import_requests q where q.workspace_id=target_workspace and q.request_id=writer_import_resource.request_id;
 if found then
  if existing.payload<>resource_input then raise exception 'Request already used with different content.' using errcode='40001'; end if;
  return jsonb_build_object('resourceId',existing.resource_id,'revision',1,'replayed',true);
 end if;
 editable:=resource_input-array['source_label','source_url','source_date'];
 perform workspace_private.validate_writing_patch(editable);
 if not (editable ? 'title') or not (editable ? 'body_text') or editable ? 'publication_state'
  or jsonb_typeof(resource_input->'source_label') is distinct from 'string'
  or char_length(trim(resource_input->>'source_label')) not between 1 and 240 then
  raise exception 'Title, source, and source text are required.' using errcode='22023';
 end if;
 if resource_input ? 'source_url' and resource_input->'source_url'<>'null'::jsonb and
  (jsonb_typeof(resource_input->'source_url')<>'string' or char_length(resource_input->>'source_url')>2000
   or resource_input->>'source_url' !~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$') then
  raise exception 'Use a public HTTP or HTTPS source URL without credentials.' using errcode='22023';
 end if;
 if resource_input ? 'source_date' and resource_input->'source_date'<>'null'::jsonb then
  if jsonb_typeof(resource_input->'source_date')<>'string' or resource_input->>'source_date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid source date.' using errcode='22023'; end if;
  begin source_date_value:=(resource_input->>'source_date')::date;
  exception when others then raise exception 'Invalid source date.' using errcode='22023'; end;
 end if;
 for related_id in select jsonb_array_elements_text(coalesce(editable->'metadata'->'related_resource_ids','[]')) union select jsonb_array_elements_text(coalesce(editable->'metadata'->'duplicate_candidate_ids','[]')) loop
  if not exists(select 1 from workspace_private.writing_resources r where r.id=related_id::uuid and r.workspace_id=target_workspace) then raise exception 'Related resource unavailable.' using errcode='P0002'; end if;
 end loop;
 insert into workspace_private.writing_resources(workspace_id,title,body_text,author,resource_type,audience,topics,abstract,metadata,source_label,source_url,source_date)
 values(target_workspace,editable->>'title',editable->>'body_text',editable->>'author',coalesce(editable->>'resource_type','article'),editable->>'audience',
  array(select jsonb_array_elements_text(coalesce(editable->'topics','[]'))),editable->>'abstract',coalesce(editable->'metadata','{}'),
  resource_input->>'source_label',resource_input->>'source_url',source_date_value) returning * into saved;
 insert into workspace_private.writing_revisions(resource_id,revision,workspace_id,snapshot,reason,origin,actor_id)
 values(saved.id,1,target_workspace,to_jsonb(saved)-'workspace_id','Original imported by the user.','user_import',auth.uid());
 insert into workspace_private.writing_import_requests values(target_workspace,request_id,saved.id,resource_input);
 return jsonb_build_object('resourceId',saved.id,'revision',1,'replayed',false);
end; $$;

create function workspace.writer_propose_revision(resource_id uuid,request_id uuid,base_revision integer,proposed_patch jsonb,proposal_reason text,source_evidence text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_workspace uuid:=workspace_private.require_writing_capability('writer.resource.metadata');
 existing workspace_private.writing_proposals; saved workspace_private.writing_proposals; resource workspace_private.writing_resources; related_id text;
begin
 perform workspace_private.require_writing_capability('writer.resource.review');
 if request_id is null or base_revision is null or base_revision<1 or proposal_reason is null or char_length(trim(proposal_reason)) not between 1 and 2000
  or source_evidence is null or char_length(trim(source_evidence)) not between 1 and 4000 then raise exception 'A revision, reason, and source evidence are required.' using errcode='22023'; end if;
 perform workspace_private.validate_writing_patch(proposed_patch);
 perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
 select * into resource from workspace_private.writing_resources r where r.id=writer_propose_revision.resource_id and r.workspace_id=target_workspace for update;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 select * into existing from workspace_private.writing_proposals p where p.workspace_id=target_workspace and p.request_id=writer_propose_revision.request_id;
 if found then
  if existing.resource_id<>resource_id or existing.base_revision<>base_revision or existing.patch<>proposed_patch or existing.reason<>proposal_reason or existing.evidence<>source_evidence then
   raise exception 'Request already used with different content.' using errcode='40001';
  end if;
  return jsonb_build_object('proposalId',existing.id,'status',existing.status,'baseRevision',existing.base_revision);
 end if;
 if resource.revision<>base_revision then raise exception 'Resource changed. Refresh and compare the latest revision.' using errcode='40001'; end if;
 if (select count(*) from workspace_private.writing_proposals p where p.resource_id=resource.id and p.status='pending')>=20 then raise exception 'Review existing proposals before adding more.' using errcode='22023'; end if;
 for related_id in select jsonb_array_elements_text(coalesce(proposed_patch->'metadata'->'related_resource_ids','[]')) union select jsonb_array_elements_text(coalesce(proposed_patch->'metadata'->'duplicate_candidate_ids','[]')) loop
  if not exists(select 1 from workspace_private.writing_resources r where r.id=related_id::uuid and r.workspace_id=target_workspace) then raise exception 'Related resource unavailable.' using errcode='P0002'; end if;
 end loop;
 insert into workspace_private.writing_revisions(resource_id,revision,workspace_id,snapshot,reason,origin)
 values(resource.id,resource.revision,target_workspace,to_jsonb(resource)-'workspace_id','Baseline preserved before a proposal.','recorded') on conflict do nothing;
 insert into workspace_private.writing_proposals(resource_id,workspace_id,request_id,base_revision,patch,reason,evidence,origin)
 values(resource.id,target_workspace,request_id,base_revision,proposed_patch,proposal_reason,source_evidence,case when auth.jwt()->>'client_id' is null then 'user' else 'assistant' end) returning * into saved;
 return jsonb_build_object('proposalId',saved.id,'status',saved.status,'baseRevision',saved.base_revision);
end; $$;

create function workspace.writer_decide_proposal(proposal_id uuid,expected_revision integer,decision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_workspace uuid:=workspace_private.require_writing_direct();
 proposal workspace_private.writing_proposals; resource workspace_private.writing_resources; revised workspace_private.writing_resources;
begin
 perform workspace_private.require_writing_capability('writer.resource.review');
 if expected_revision is null or expected_revision<1 or decision is null or decision not in ('approve','reject') then raise exception 'Choose approve or reject for a specific revision.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
 select * into proposal from workspace_private.writing_proposals p where p.id=proposal_id and p.workspace_id=target_workspace for update;
 if not found then raise exception 'Proposal unavailable.' using errcode='P0002'; end if;
 if proposal.base_revision<>expected_revision then raise exception 'The reviewed revision does not match.' using errcode='40001'; end if;
 if proposal.status<>'pending' then
  if proposal.status<>(case decision when 'approve' then 'approved' else 'rejected' end) then raise exception 'Proposal already decided.' using errcode='40001'; end if;
  return jsonb_build_object('proposalId',proposal.id,'status',proposal.status,'revision',proposal.applied_revision,'replayed',true);
 end if;
 if decision='reject' then
  update workspace_private.writing_proposals set status='rejected',decided_at=now(),decided_by=auth.uid() where id=proposal.id;
  return jsonb_build_object('proposalId',proposal.id,'status','rejected','revision',null,'replayed',false);
 end if;
 select * into resource from workspace_private.writing_resources r where r.id=proposal.resource_id and r.workspace_id=target_workspace for update;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 if resource.revision<>proposal.base_revision then raise exception 'Resource changed. Refresh and compare the latest revision.' using errcode='40001'; end if;
 -- Only the stored immutable patch is applied. No model-supplied replacement.
 select * into revised from jsonb_populate_record(resource,proposal.patch);
 update workspace_private.writing_resources set title=revised.title,author=revised.author,resource_type=revised.resource_type,audience=revised.audience,
  topics=revised.topics,abstract=revised.abstract,body_text=revised.body_text,metadata=revised.metadata,publication_state=revised.publication_state,
  revision=resource.revision+1,updated_at=now() where id=resource.id returning * into revised;
 insert into workspace_private.writing_revisions(resource_id,revision,workspace_id,snapshot,reason,origin,actor_id)
 values(revised.id,revised.revision,target_workspace,to_jsonb(revised)-'workspace_id',proposal.reason,'user_approved_proposal',auth.uid());
 update workspace_private.writing_proposals set status='approved',decided_at=now(),decided_by=auth.uid(),applied_revision=revised.revision where id=proposal.id;
 return jsonb_build_object('proposalId',proposal.id,'status','approved','revision',revised.revision,'replayed',false);
end; $$;

create function workspace.writer_get_revision_history(resource_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target_workspace uuid:=workspace_private.require_writing_capability('writer.resource.review');
begin
 if not exists(select 1 from workspace_private.writing_resources r where r.id=writer_get_revision_history.resource_id and r.workspace_id=target_workspace) then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('proposals',coalesce((select jsonb_agg(to_jsonb(p)-'workspace_id'-'request_id'-'decided_by' order by (p.status='pending') desc,p.created_at desc,p.id) from
  (select * from workspace_private.writing_proposals q where q.resource_id=writer_get_revision_history.resource_id and q.workspace_id=target_workspace order by (q.status='pending') desc,q.created_at desc,q.id limit 50) p),'[]'),
  'revisions',coalesce((select jsonb_agg(to_jsonb(v)-'workspace_id'-'actor_id' order by v.revision desc) from
  (select * from workspace_private.writing_revisions r where r.resource_id=writer_get_revision_history.resource_id and r.workspace_id=target_workspace and
    (r.revision=1 or r.revision in (select h.revision from workspace_private.writing_revisions h where h.resource_id=r.resource_id and h.workspace_id=target_workspace and h.revision>1 order by h.revision desc limit 9))
    order by r.revision desc limit 10) v),'[]'));
end; $$;
revoke all on function workspace_private.validate_writing_patch(jsonb) from public,anon,authenticated;
revoke all on function workspace_private.require_writing_direct() from public,anon,authenticated;
revoke all on function workspace.writer_import_resource(uuid,jsonb),workspace.writer_propose_revision(uuid,uuid,integer,jsonb,text,text),
 workspace.writer_decide_proposal(uuid,integer,text),workspace.writer_get_revision_history(uuid) from public,anon,authenticated;
grant execute on function workspace.writer_import_resource(uuid,jsonb),workspace.writer_propose_revision(uuid,uuid,integer,jsonb,text,text),
 workspace.writer_decide_proposal(uuid,integer,text),workspace.writer_get_revision_history(uuid) to authenticated;
notify pgrst,'reload schema';
