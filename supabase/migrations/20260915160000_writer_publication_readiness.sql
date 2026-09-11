-- Revision-bound publication readiness and user-observed link evidence.
-- This workflow never fetches a destination and never publishes externally.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('writer_publication_queue','Publication readiness','Track exact revision readiness and user-observed public link evidence.') on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key) values
 ('writer_editor','writer_publication_queue') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('writer_editor','writer_publication_queue','writer.publication.queue') on conflict do nothing;
update workspace_private.layout_contributions set capability_ids=array['writer.publication.queue']
 where identity='writer_editor:writer.widget.publication_queue';

create function workspace_private.publication_destination_valid(value text) returns boolean
language sql immutable security definer set search_path='' as $$
 select value is null or (
  char_length(value) between 1 and 2000
  and value ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})(:443)?([/?#][^[:space:]]*)?$'
  and value !~* '^https://([^/?#]+\.)?(internal|intranet|local|localhost|home|lan|test|invalid|onion)(:443)?([/?#]|$)'
 );
$$;

create function workspace_private.publication_confirmations_valid(value jsonb) returns boolean
language sql immutable security definer set search_path='' as $$
 select value is not null and jsonb_typeof(value)='object'
  and (select count(*) from jsonb_object_keys(value))=3
  and value ?& array['accuracyAndQuotesReviewed','voiceReviewed','rightsConfirmed']
  and jsonb_typeof(value->'accuracyAndQuotesReviewed')='boolean'
  and jsonb_typeof(value->'voiceReviewed')='boolean'
  and jsonb_typeof(value->'rightsConfirmed')='boolean';
$$;

create table workspace_private.writing_publication_queue (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 resource_id uuid not null references workspace_private.writing_resources(id) on delete cascade,
 resource_revision integer not null check(resource_revision>0),
 version integer not null default 1 check(version>0),
 stage text not null default 'queued' check(stage in ('queued','blocked','ready_for_handoff','handed_off','removed')),
 destination_url text check(workspace_private.publication_destination_valid(destination_url)),
 note text not null default '' check(char_length(note)<=1000),
 confirmations jsonb not null default '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}'::jsonb
  check(workspace_private.publication_confirmations_valid(confirmations)),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,resource_id)
);
create index writing_publication_queue_workspace_idx on workspace_private.writing_publication_queue(workspace_id,stage,updated_at desc,id);

create table workspace_private.writing_publication_queue_revisions (
 queue_id uuid not null references workspace_private.writing_publication_queue(id) on delete cascade,
 version integer not null check(version>0),
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 snapshot jsonb not null,
 actor_id uuid references auth.users(id) on delete set null,
 recorded_at timestamptz not null default now(),
 primary key(queue_id,version)
);

create table workspace_private.writing_publication_link_evidence (
 id uuid primary key default gen_random_uuid(),
 queue_id uuid not null references workspace_private.writing_publication_queue(id) on delete cascade,
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 queue_version integer not null check(queue_version>0),
 resource_revision integer not null check(resource_revision>0),
 target_url text not null check(workspace_private.publication_destination_valid(target_url)),
 result text not null check(result in ('working','redirected','broken','access_limited')),
 final_url text check(workspace_private.publication_destination_valid(final_url)),
 note text not null default '' check(char_length(note)<=1000),
 checked_by uuid references auth.users(id) on delete set null,
 checked_at timestamptz not null default now(),
 check((result='redirected')=(final_url is not null))
);
create index writing_publication_evidence_queue_idx on workspace_private.writing_publication_link_evidence(workspace_id,queue_id,queue_version desc);

create table workspace_private.writing_publication_requests (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 request_id uuid not null,
 operation text not null check(operation in ('save_queue','record_evidence')),
 payload jsonb not null,
 queue_id uuid not null references workspace_private.writing_publication_queue(id) on delete cascade,
 queue_version integer not null check(queue_version>0),
 primary key(workspace_id,request_id)
);

alter table workspace_private.writing_publication_queue enable row level security;
alter table workspace_private.writing_publication_queue_revisions enable row level security;
alter table workspace_private.writing_publication_link_evidence enable row level security;
alter table workspace_private.writing_publication_requests enable row level security;
revoke all on workspace_private.writing_publication_queue,workspace_private.writing_publication_queue_revisions,
 workspace_private.writing_publication_link_evidence,workspace_private.writing_publication_requests from public,anon,authenticated;

create function workspace_private.require_writing_publication_direct() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.publication.queue');
begin
 perform workspace_private.require_writing_capability('writer.resource.review');
 if auth.uid() is null or not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Open Workspace to manage publication readiness yourself.' using errcode='42501';
 end if;
 return target;
end; $$;

create function workspace_private.writer_publication_queue_item(queue_id uuid,as_of timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q workspace_private.writing_publication_queue; r workspace_private.writing_resources;
 e workspace_private.writing_publication_link_evidence; pending integer; evidence_status text; blockers jsonb:='[]'::jsonb;
begin
 select * into q from workspace_private.writing_publication_queue x where x.id=writer_publication_queue_item.queue_id;
 if not found then raise exception 'Publication queue item unavailable.' using errcode='P0002'; end if;
 select * into r from workspace_private.writing_resources x where x.id=q.resource_id and x.workspace_id=q.workspace_id;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 select * into e from workspace_private.writing_publication_link_evidence x
  where x.workspace_id=q.workspace_id and x.queue_id=q.id order by x.queue_version desc limit 1;
 select count(*) into pending from workspace_private.writing_proposals p
  where p.workspace_id=q.workspace_id and p.resource_id=q.resource_id and p.status='pending';

 if e.id is null then evidence_status:='unchecked';
 elsif r.revision<>q.resource_revision or e.resource_revision<>q.resource_revision or e.target_url is distinct from q.destination_url then evidence_status:='stale';
 elsif e.checked_at < as_of-interval '30 days' then evidence_status:='stale';
 elsif e.result in ('broken','access_limited') then evidence_status:='error';
 else evidence_status:='checked'; end if;

 if r.revision<>q.resource_revision then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','revision_changed','label','Resource revision changed','detail','This queue item covers revision '||q.resource_revision||'; the resource is now revision '||r.revision||'. Review and rebase it.')); end if;
 if r.publication_state<>'ready' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','resource_not_ready','label','Resource status','detail','Mark the reviewed resource ready before preparing its handoff.')); end if;
 if pending>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','pending_proposals','label','Pending proposals','detail',pending||case when pending=1 then ' proposal still needs a decision.' else ' proposals still need decisions.' end)); end if;
 if r.epistemic_state in ('inferred','suggested','hypothesized','rejected','stale') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','source_uncertain','label','Source uncertainty','detail','Resolve the recorded '||r.epistemic_state||' source state before handoff.')); end if;
 if trim(r.body_text)='' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','source_text_missing','label','Source text','detail','Add and review the source text.')); end if;
 if coalesce(trim(r.author),'')='' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','author_missing','label','Author','detail','Confirm the author.')); end if;
 if coalesce(trim(r.audience),'')='' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','audience_missing','label','Intended reader','detail','Record the intended reader.')); end if;
 if coalesce(trim(r.metadata->>'website_summary'),'')='' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','summary_missing','label','Website summary','detail','Prepare a reader-facing website summary.')); end if;
 if coalesce(trim(r.metadata->>'seo_description'),'')='' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','seo_missing','label','SEO description','detail','Prepare an SEO description.')); end if;
 if cardinality(r.topics)=0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','topics_missing','label','Findable topics','detail','Choose at least one useful topic.')); end if;
 if coalesce((q.confirmations->>'accuracyAndQuotesReviewed')::boolean,false)=false then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','accuracy_review_missing','label','Accuracy and quotations','detail','Review claims, citations and quotations against their sources.')); end if;
 if coalesce((q.confirmations->>'voiceReviewed')::boolean,false)=false then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','voice_review_missing','label','Author voice','detail','Compare the final copy with the confirmed voice and intended meaning.')); end if;
 if coalesce((q.confirmations->>'rightsConfirmed')::boolean,false)=false then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','rights_confirmation_missing','label','Rights and permissions','detail','Confirm the rights for the text and included material.')); end if;
 if q.destination_url is null then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','destination_missing','label','Publication destination','detail','Record the intended public HTTPS destination.'));
 elsif evidence_status='unchecked' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','link_unchecked','label','Destination link','detail','Open the destination and record what you observe.'));
 elsif evidence_status='stale' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','link_stale','label','Destination evidence is stale','detail','Recheck this exact revision and destination. Link observations expire after 30 days.'));
 elsif evidence_status='error' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','link_error','label','Destination needs attention','detail','The latest observation was '||replace(e.result,'_',' ')||'. Resolve it and check again.')); end if;

 return jsonb_build_object(
  'id',q.id,'resourceId',q.resource_id,'title',r.title,'resourceRevision',q.resource_revision,'currentResourceRevision',r.revision,
  'version',q.version,'stage',q.stage,'publicationState',r.publication_state,'destinationUrl',q.destination_url,'note',q.note,
  'confirmations',q.confirmations,'pendingProposals',pending,'evidenceStatus',evidence_status,
  'lastEvidence',case when e.id is null then 'null'::jsonb else jsonb_build_object('id',e.id,'resourceRevision',e.resource_revision,'targetUrl',e.target_url,
   'result',e.result,'finalUrl',e.final_url,'note',e.note,'checkedAt',e.checked_at) end,
  'blockers',blockers,'readyForHandoff',jsonb_array_length(blockers)=0,'createdAt',q.created_at,'updatedAt',q.updated_at
 );
end; $$;

create function workspace.writer_list_publication_queue(stage_filter text default null,page_offset integer default 0,page_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_publication_direct(); at_time timestamptz:=now();
begin
 if stage_filter is not null and stage_filter not in ('queued','blocked','ready_for_handoff','handed_off')
  or page_offset is null or page_offset not between 0 and 10000 or page_size is null or page_size not between 1 and 50 then
  raise exception 'Invalid publication queue request.' using errcode='22023';
 end if;
 return jsonb_build_object('schemaVersion','1.0','retrievedAt',at_time,
  'total',(select count(*) from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage<>'removed'),
  'counts',jsonb_build_object(
   'queued',(select count(*) from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage='queued'),
   'blocked',(select count(*) from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage='blocked'),
   'readyForHandoff',(select count(*) from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage<>'removed' and (workspace_private.writer_publication_queue_item(q.id,at_time)->>'readyForHandoff')::boolean),
   'handedOff',(select count(*) from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage='handed_off')),
  'items',coalesce((select jsonb_agg(workspace_private.writer_publication_queue_item(p.id,at_time) order by p.updated_at desc,p.id) from
   (select q.id,q.updated_at from workspace_private.writing_publication_queue q where q.workspace_id=target and q.stage<>'removed'
    and (stage_filter is null or q.stage=stage_filter) order by q.updated_at desc,q.id limit page_size offset page_offset) p),'[]'::jsonb));
end; $$;

create function workspace.writer_get_publication_queue_item(resource_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_publication_direct(); queue_id uuid;
begin
 if not exists(select 1 from workspace_private.writing_resources r where r.workspace_id=target and r.id=resource_id) then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 select q.id into queue_id from workspace_private.writing_publication_queue q where q.workspace_id=target and q.resource_id=writer_get_publication_queue_item.resource_id;
 return case when queue_id is null then 'null'::jsonb else workspace_private.writer_publication_queue_item(queue_id,now()) end;
end; $$;

create function workspace.writer_save_publication_queue(resource_id uuid,expected_resource_revision integer,expected_version integer,request_id uuid,
 destination_url text,queue_note text,queue_stage text,review_confirmations jsonb,confirm_queue_change boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_publication_direct(); r workspace_private.writing_resources;
 q workspace_private.writing_publication_queue; receipt workspace_private.writing_publication_requests; payload jsonb; item jsonb; prior_stage text;
begin
 if request_id is null or expected_resource_revision is null or expected_resource_revision<1 or expected_version is null or expected_version<0
  or confirm_queue_change is distinct from true or queue_note is null or char_length(queue_note)>1000
  or queue_stage is null or queue_stage not in ('queued','blocked','ready_for_handoff','handed_off','removed')
  or not workspace_private.publication_destination_valid(destination_url)
  or not workspace_private.publication_confirmations_valid(review_confirmations) then
  raise exception 'Review the exact revision, destination and confirmations.' using errcode='22023';
 end if;
 payload:=jsonb_build_object('resourceId',resource_id,'expectedResourceRevision',expected_resource_revision,'expectedVersion',expected_version,
  'destinationUrl',destination_url,'note',queue_note,'stage',queue_stage,'confirmations',review_confirmations,'confirmQueueChange',true);
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into receipt from workspace_private.writing_publication_requests x where x.workspace_id=target and x.request_id=writer_save_publication_queue.request_id;
 if found then
  if receipt.operation<>'save_queue' or receipt.payload<>payload then raise exception 'Publication request already used.' using errcode='40001'; end if;
  select * into q from workspace_private.writing_publication_queue x where x.workspace_id=target and x.id=receipt.queue_id;
  if not found or q.version<>receipt.queue_version then raise exception 'This queue item has changed. Reload before making another decision.' using errcode='40001'; end if;
  return jsonb_build_object('item',workspace_private.writer_publication_queue_item(q.id,now()),'replayed',true);
 end if;
 select * into r from workspace_private.writing_resources x where x.workspace_id=target and x.id=resource_id for update;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 if r.revision<>expected_resource_revision then raise exception 'The resource changed. Review its latest revision before queuing it.' using errcode='40001'; end if;
 select * into q from workspace_private.writing_publication_queue x where x.workspace_id=target and x.resource_id=writer_save_publication_queue.resource_id for update;
 if not found then
  if expected_version<>0 then raise exception 'The publication queue changed. Reload before saving.' using errcode='40001'; end if;
  if queue_stage not in ('queued','blocked') then raise exception 'Begin by reviewing this resource in the queue.' using errcode='22023'; end if;
  insert into workspace_private.writing_publication_queue(workspace_id,resource_id,resource_revision,stage,destination_url,note,confirmations,created_by,updated_by)
   values(target,resource_id,expected_resource_revision,queue_stage,destination_url,trim(queue_note),review_confirmations,auth.uid(),auth.uid()) returning * into q;
 else
  prior_stage:=q.stage;
  if q.version<>expected_version then raise exception 'The publication queue changed. Your work was not applied.' using errcode='40001'; end if;
  if q.resource_revision<>expected_resource_revision and (queue_stage<>'queued'
   or review_confirmations<>'{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}'::jsonb) then
   raise exception 'Rebase to the latest revision as queued and review every confirmation again.' using errcode='22023';
  end if;
  if q.destination_url is distinct from destination_url and queue_stage in ('ready_for_handoff','handed_off') then
   raise exception 'A changed destination must be checked again before handoff.' using errcode='22023';
  end if;
  update workspace_private.writing_publication_queue set resource_revision=expected_resource_revision,version=q.version+1,stage=queue_stage,
   destination_url=writer_save_publication_queue.destination_url,note=trim(queue_note),confirmations=review_confirmations,updated_by=auth.uid(),updated_at=now()
   where id=q.id returning * into q;
 end if;
 item:=workspace_private.writer_publication_queue_item(q.id,now());
 if queue_stage in ('ready_for_handoff','handed_off') and not (item->>'readyForHandoff')::boolean then
  raise exception 'Resolve every current publication blocker before handoff.' using errcode='22023';
 end if;
 if queue_stage='handed_off' and prior_stage is distinct from 'ready_for_handoff' then
  raise exception 'Mark this exact revision ready before recording a handoff.' using errcode='22023';
 end if;
 insert into workspace_private.writing_publication_queue_revisions(queue_id,version,workspace_id,snapshot,actor_id)
  values(q.id,q.version,target,to_jsonb(q)-'workspace_id'-'created_by'-'updated_by',auth.uid());
 insert into workspace_private.writing_publication_requests values(target,request_id,'save_queue',payload,q.id,q.version);
 return jsonb_build_object('item',item,'replayed',false);
end; $$;

create function workspace.writer_record_publication_link(queue_id uuid,expected_version integer,request_id uuid,observed_result text,
 final_url text,evidence_note text,confirm_observation boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_publication_direct(); q workspace_private.writing_publication_queue;
 receipt workspace_private.writing_publication_requests; payload jsonb; evidence workspace_private.writing_publication_link_evidence; item jsonb;
begin
 if queue_id is null or expected_version is null or expected_version<1 or request_id is null or confirm_observation is distinct from true
  or observed_result is null or observed_result not in ('working','redirected','broken','access_limited')
  or evidence_note is null or char_length(evidence_note)>1000 or not workspace_private.publication_destination_valid(final_url)
  or ((observed_result='redirected')<>(final_url is not null)) then
  raise exception 'Record the exact destination result you observed.' using errcode='22023';
 end if;
 payload:=jsonb_build_object('queueId',queue_id,'expectedVersion',expected_version,'result',observed_result,'finalUrl',final_url,
  'note',evidence_note,'confirmObservation',true);
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into receipt from workspace_private.writing_publication_requests x where x.workspace_id=target and x.request_id=writer_record_publication_link.request_id;
 if found then
  if receipt.operation<>'record_evidence' or receipt.payload<>payload then raise exception 'Publication request already used.' using errcode='40001'; end if;
  select * into q from workspace_private.writing_publication_queue x where x.workspace_id=target and x.id=receipt.queue_id;
  if not found or q.version<>receipt.queue_version then raise exception 'This queue item has changed. Reload before recording another observation.' using errcode='40001'; end if;
  return jsonb_build_object('item',workspace_private.writer_publication_queue_item(q.id,now()),'replayed',true);
 end if;
 select * into q from workspace_private.writing_publication_queue x where x.workspace_id=target and x.id=writer_record_publication_link.queue_id for update;
 if not found or q.stage='removed' then raise exception 'Publication queue item unavailable.' using errcode='P0002'; end if;
 if q.version<>expected_version then raise exception 'The publication queue changed. Your observation was not recorded.' using errcode='40001'; end if;
 if q.destination_url is null then raise exception 'Record a destination before checking it.' using errcode='22023'; end if;
 insert into workspace_private.writing_publication_link_evidence(queue_id,workspace_id,queue_version,resource_revision,target_url,result,final_url,note,checked_by)
  values(q.id,target,q.version+1,q.resource_revision,q.destination_url,observed_result,final_url,trim(evidence_note),auth.uid()) returning * into evidence;
 update workspace_private.writing_publication_queue set version=q.version+1,
  stage=case when observed_result in ('broken','access_limited') then 'blocked' else stage end,updated_by=auth.uid(),updated_at=now()
  where id=q.id returning * into q;
 insert into workspace_private.writing_publication_queue_revisions(queue_id,version,workspace_id,snapshot,actor_id)
  values(q.id,q.version,target,(to_jsonb(q)-'workspace_id'-'created_by'-'updated_by')||jsonb_build_object('linkEvidenceId',evidence.id),auth.uid());
 insert into workspace_private.writing_publication_requests values(target,request_id,'record_evidence',payload,q.id,q.version);
 item:=workspace_private.writer_publication_queue_item(q.id,now());
 return jsonb_build_object('item',item,'replayed',false);
end; $$;

revoke all on function workspace_private.publication_destination_valid(text),workspace_private.publication_confirmations_valid(jsonb),workspace_private.require_writing_publication_direct(),
 workspace_private.writer_publication_queue_item(uuid,timestamptz) from public,anon,authenticated;
revoke all on function workspace.writer_list_publication_queue(text,integer,integer),workspace.writer_get_publication_queue_item(uuid),
 workspace.writer_save_publication_queue(uuid,integer,integer,uuid,text,text,text,jsonb,boolean),
 workspace.writer_record_publication_link(uuid,integer,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function workspace.writer_list_publication_queue(text,integer,integer),workspace.writer_get_publication_queue_item(uuid),
 workspace.writer_save_publication_queue(uuid,integer,integer,uuid,text,text,text,jsonb,boolean),
 workspace.writer_record_publication_link(uuid,integer,uuid,text,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
