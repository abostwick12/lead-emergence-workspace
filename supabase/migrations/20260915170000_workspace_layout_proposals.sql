-- P22: capability-grounded assistant proposals; native user decisions only.
create table workspace_private.layout_proposals (
 id uuid primary key default gen_random_uuid(),
 created_order bigint generated always as identity unique,
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 version integer not null default 1 check(version>0),
 base_layout_revision integer not null check(base_layout_revision>=0),
 authority_revision text not null check(char_length(authority_revision) between 1 and 200),
 title text not null check(char_length(title) between 5 and 120),
 goal text not null check(char_length(goal) between 5 and 500),
 goal_source text not null check(goal_source in ('user_stated','assistant_inferred')),
 summary text not null check(char_length(summary) between 10 and 1000),
 operations jsonb not null,
 proposed_preferences jsonb not null,
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 request_id uuid not null,
 created_by uuid references auth.users(id) on delete set null,
 created_by_type text not null check(created_by_type in ('assistant','user')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id) on delete set null,
 decision_note text not null default '' check(char_length(decision_note)<=500),
 unique(workspace_id,request_id)
);
create index layout_proposals_workspace_created_idx on workspace_private.layout_proposals(workspace_id,created_order desc);
create table workspace_private.layout_proposal_decisions (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 request_id uuid not null,
 proposal_id uuid not null references workspace_private.layout_proposals(id) on delete cascade,
 expected_proposal_version integer not null check(expected_proposal_version>0),
 expected_layout_revision integer not null check(expected_layout_revision>=0),
 expected_authority_revision text not null check(char_length(expected_authority_revision) between 1 and 200),
 decision text not null check(decision in ('accept','reject')),
 note text not null check(char_length(note)<=500),
 resulting_proposal_version integer not null check(resulting_proposal_version>0),
 resulting_layout_revision integer not null check(resulting_layout_revision>=0),
 decided_at timestamptz not null default now(),
 primary key(workspace_id,request_id)
);
alter table workspace_private.layout_proposals enable row level security;
alter table workspace_private.layout_proposal_decisions enable row level security;
revoke all on workspace_private.layout_proposals,workspace_private.layout_proposal_decisions from public,anon,authenticated;

create function workspace_private.require_layout_proposal_workspace() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Workspace layout proposals require current access.' using errcode='42501'; end if;
 if nullif(auth.jwt()->>'client_id','') is not null then target:=workspace_private.require_mcp_workspace();
 elsif workspace_private.is_direct_session() then target:=workspace_private.require_layout_workspace();
 else raise exception 'Workspace layout proposals require current access.' using errcode='42501'; end if;
 if not workspace_private.bundle_capability_active(target,'workspace_experience','workspace.personalize') then
  raise exception 'Workspace layout access is required.' using errcode='42501';
 end if;
 return target;
end; $$;

create function workspace_private.require_layout_proposal_direct() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin return workspace_private.require_layout_workspace(); end; $$;

create function workspace_private.layout_proposal_object_length(value jsonb) returns integer
language sql immutable set search_path='' as $$select count(*)::integer from jsonb_object_keys(value)$$;

create function workspace_private.layout_proposal_operations_valid(operations jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare operation jsonb; kind text; target text; seen text[]:='{}'; basis jsonb; expected_keys text[];
begin
 if operations is null or jsonb_typeof(operations)<>'array' or jsonb_array_length(operations) not between 1 and 30 or octet_length(operations::text)>45000 then return false; end if;
 for operation in select value from jsonb_array_elements(operations) loop
  if jsonb_typeof(operation)<>'object' or jsonb_typeof(operation->'kind')<>'string' or jsonb_typeof(operation->'reason')<>'string'
   or char_length(trim(operation->>'reason')) not between 10 and 400 or jsonb_typeof(operation->'basis')<>'array' then return false; end if;
  basis:=operation->'basis';
  if jsonb_array_length(basis) not between 1 and 4
   or exists(select 1 from jsonb_array_elements(basis) b where jsonb_typeof(b)<>'string' or b#>>'{}' not in ('user_stated_priority','current_layout','enabled_capability','assistant_inference'))
   or (select count(*)<>count(distinct b) from jsonb_array_elements_text(basis) b)
   or not exists(select 1 from jsonb_array_elements_text(basis) b where b<>'assistant_inference') then return false; end if;
  kind:=operation->>'kind';
  if kind='set_visibility' then expected_keys:=array['kind','itemId','visible','reason','basis'];
  elsif kind='set_pin' then expected_keys:=array['kind','itemId','pinned','reason','basis'];
  elsif kind='set_order' then expected_keys:=array['kind','itemId','order','reason','basis'];
  elsif kind='set_default_workspace' then expected_keys:=array['kind','route','reason','basis'];
  else return false; end if;
  if not (operation ?& expected_keys) or workspace_private.layout_proposal_object_length(operation)<>cardinality(expected_keys) then return false; end if;
  if kind='set_default_workspace' then
   if jsonb_typeof(operation->'route')<>'string' or char_length(operation->>'route')>200 or operation->>'route' !~ '^/workspace(/[a-z0-9][a-z0-9/_-]*)?$' then return false; end if;
   target:=operation->>'route';
  else
   if jsonb_typeof(operation->'itemId')<>'string' or operation->>'itemId' !~ '^[a-z][a-z0-9_]{1,49}:[a-z][a-z0-9._-]{2,99}$' then return false; end if;
   target:=operation->>'itemId';
   if kind='set_visibility' and jsonb_typeof(operation->'visible')<>'boolean' then return false; end if;
   if kind='set_pin' and jsonb_typeof(operation->'pinned')<>'boolean' then return false; end if;
   if kind='set_order' and (jsonb_typeof(operation->'order')<>'number' or (operation->>'order')::numeric<>trunc((operation->>'order')::numeric) or (operation->>'order')::numeric not between 0 and 10000) then return false; end if;
  end if;
  if kind||':'||target=any(seen) then return false; end if;seen:=array_append(seen,kind||':'||target);
 end loop;
 return true;
exception when others then return false;
end; $$;

create function workspace_private.layout_item_admitted(target uuid,item_id text) returns workspace_private.layout_contributions
language plpgsql stable security definer set search_path='' as $$
declare item workspace_private.layout_contributions;
begin
 select * into item from workspace_private.layout_contributions c where c.identity=item_id
  and exists(select 1 from unnest(c.capability_ids) cap where workspace_private.bundle_capability_active(target,c.bundle_key,cap));
 if not found then raise exception 'Layout item unavailable.' using errcode='42501'; end if;
 return item;
end; $$;

create function workspace_private.apply_layout_proposal_operations(current_preferences jsonb,operations jsonb,target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare proposed_layout jsonb:=current_preferences; operation jsonb; item workspace_private.layout_contributions; identity text; pin_key text; value_boolean boolean;
begin
 if not workspace_private.layout_proposal_operations_valid(operations) then raise exception 'Review a valid grounded proposal.' using errcode='22023'; end if;
 for operation in select value from jsonb_array_elements(operations) loop
  if operation->>'kind'='set_default_workspace' then
   if operation->>'route'<>'/workspace' and not exists(select 1 from workspace_private.layout_contributions c,unnest(c.capability_ids) cap
    where c.kind='navigation' and c.route=operation->>'route' and workspace_private.bundle_capability_active(target,c.bundle_key,cap)) then
    raise exception 'Default workspace unavailable.' using errcode='42501';
   end if;
   proposed_layout:=jsonb_set(proposed_layout,'{defaultWorkspaceRoute}',operation->'route');continue;
  end if;
  identity:=operation->>'itemId';item:=workspace_private.layout_item_admitted(target,identity);
  if operation->>'kind'='set_visibility' then
   value_boolean:=(operation->>'visible')::boolean;
   if value_boolean then proposed_layout:=jsonb_set(proposed_layout,'{hiddenItemIds}',(proposed_layout->'hiddenItemIds')-identity);
   else
    if not (proposed_layout->'hiddenItemIds' ? identity) then proposed_layout:=jsonb_set(proposed_layout,'{hiddenItemIds}',proposed_layout->'hiddenItemIds'||to_jsonb(identity)); end if;
    proposed_layout:=jsonb_set(proposed_layout,'{pinnedNavigationIds}',(proposed_layout->'pinnedNavigationIds')-identity);
    proposed_layout:=jsonb_set(proposed_layout,'{pinnedWidgetIds}',(proposed_layout->'pinnedWidgetIds')-identity);
   end if;
  elsif operation->>'kind'='set_pin' then
   value_boolean:=(operation->>'pinned')::boolean;pin_key:=case item.kind when 'navigation' then 'pinnedNavigationIds' else 'pinnedWidgetIds' end;
   proposed_layout:=jsonb_set(proposed_layout,'{hiddenItemIds}',(proposed_layout->'hiddenItemIds')-identity);
   if value_boolean and not (proposed_layout->pin_key ? identity) then proposed_layout:=jsonb_set(proposed_layout,array[pin_key],proposed_layout->pin_key||to_jsonb(identity));
   elsif not value_boolean then proposed_layout:=jsonb_set(proposed_layout,array[pin_key],(proposed_layout->pin_key)-identity); end if;
  elsif operation->>'kind'='set_order' then
   proposed_layout:=jsonb_set(proposed_layout,'{orderOverrides}',(proposed_layout->'orderOverrides')||jsonb_build_object(identity,operation->'order'));
  end if;
 end loop;
 perform workspace_private.validate_layout(proposed_layout,current_preferences,target);
 if proposed_layout is not distinct from current_preferences then raise exception 'The proposal must change the current layout.' using errcode='22023'; end if;
 return proposed_layout;
end; $$;

create function workspace.layout_proposal_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_proposal_workspace(); saved workspace_private.layout_preferences; current jsonb; authority text;
begin
 select * into saved from workspace_private.layout_preferences p where p.workspace_id=target;
 current:=coalesce(saved.preferences,workspace_private.default_layout());authority:=workspace.get_bundle_experience()->>'revision';
 return (with admitted as materialized (
  select c.* from workspace_private.layout_contributions c where exists(select 1 from unnest(c.capability_ids) cap where workspace_private.bundle_capability_active(target,c.bundle_key,cap))
 ), active_ids as (select identity from admitted), choices as (
  select jsonb_array_elements_text(current->'hiddenItemIds') id union select jsonb_array_elements_text(current->'pinnedNavigationIds')
  union select jsonb_array_elements_text(current->'pinnedWidgetIds') union select jsonb_object_keys(current->'orderOverrides')
 ), routes as (select '/workspace'::text route union select distinct route from admitted where kind='navigation')
 select jsonb_build_object('schemaVersion','1.0','workspaceId',target,'layoutRevision',coalesce(saved.revision,0),'authorityRevision',authority,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',a.identity,'bundleKey',a.bundle_key,'kind',a.kind,'route',a.route,
   'visible',not(current->'hiddenItemIds' ? a.identity),'pinned',case a.kind when 'navigation' then current->'pinnedNavigationIds' ? a.identity else current->'pinnedWidgetIds' ? a.identity end,
   'order',current->'orderOverrides'->a.identity) order by a.kind,a.identity collate "C") from admitted a),'[]'::jsonb),
  'defaultRoutes',(select jsonb_agg(route order by case when route='/workspace' then 0 else 1 end,route collate "C") from routes),
  'currentDefaultWorkspaceRoute',case when exists(select 1 from routes where route=current->>'defaultWorkspaceRoute') then current->>'defaultWorkspaceRoute' else '/workspace' end,
  'defaultUnavailable',not exists(select 1 from routes where route=current->>'defaultWorkspaceRoute'),
  'dormantChoiceCount',(select count(distinct id) from choices where id not in(select identity from active_ids))));
end; $$;

create function workspace_private.layout_proposal_status(p workspace_private.layout_proposals,target uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when p.status='pending' and (p.base_layout_revision<>coalesce((select revision from workspace_private.layout_preferences where workspace_id=target),0)
  or p.authority_revision is distinct from workspace.get_bundle_experience()->>'revision') then 'stale' else p.status end;
$$;
create function workspace_private.layout_proposal_item(p workspace_private.layout_proposals,target uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion','1.0','proposalId',p.id,'status',workspace_private.layout_proposal_status(p,target),
  'baseLayoutRevision',p.base_layout_revision,'authorityRevision',p.authority_revision,'createdAt',p.created_at,'version',p.version,
  'title',p.title,'goal',p.goal,'goalSource',p.goal_source,'summary',p.summary,'operations',p.operations,
  'proposedPreferences',p.proposed_preferences,'createdBy',p.created_by_type,'decidedAt',p.decided_at,'decisionNote',p.decision_note);
$$;
create function workspace_private.layout_proposal_receipt(p workspace_private.layout_proposals,target uuid,replayed boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion','1.0','proposalId',p.id,'status',workspace_private.layout_proposal_status(p,target),
  'baseLayoutRevision',p.base_layout_revision,'authorityRevision',p.authority_revision,'createdAt',p.created_at,'replayed',replayed);
$$;

create function workspace.propose_workspace_layout(expected_layout_revision integer,expected_authority_revision text,request_id uuid,
 proposal_title text,proposal_goal text,goal_source text,proposal_summary text,operations jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_proposal_workspace(); saved workspace_private.layout_preferences; current jsonb; proposed jsonb;
 existing workspace_private.layout_proposals; created workspace_private.layout_proposals; authority text; actor_type text:=case when nullif(auth.jwt()->>'client_id','') is null then 'user' else 'assistant' end;
begin
 if expected_layout_revision is null or expected_layout_revision<0 or request_id is null or expected_authority_revision is null or char_length(expected_authority_revision) not between 1 and 200
  or proposal_title is null or char_length(trim(proposal_title)) not between 5 and 120 or proposal_goal is null or char_length(trim(proposal_goal)) not between 5 and 500
  or goal_source is null or goal_source not in ('user_stated','assistant_inferred') or proposal_summary is null or char_length(trim(proposal_summary)) not between 10 and 1000
  or not workspace_private.layout_proposal_operations_valid(operations) then raise exception 'Review a valid grounded proposal.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-layout:'||target::text,0));
 authority:=workspace.get_bundle_experience()->>'revision';select * into saved from workspace_private.layout_preferences p where p.workspace_id=target;
 select * into existing from workspace_private.layout_proposals p where p.workspace_id=target and p.request_id=propose_workspace_layout.request_id;
 if found then
  if existing.base_layout_revision=expected_layout_revision and existing.authority_revision=expected_authority_revision and existing.title=trim(proposal_title)
   and existing.goal=trim(proposal_goal) and existing.goal_source=propose_workspace_layout.goal_source and existing.summary=trim(proposal_summary) and existing.operations=propose_workspace_layout.operations then
   return workspace_private.layout_proposal_receipt(existing,target,true);
  end if;
  raise exception 'This proposal request already means something else.' using errcode='40001';
 end if;
 if expected_layout_revision<>coalesce(saved.revision,0) or expected_authority_revision is distinct from authority then
  raise exception 'Workspace layout or access changed. Read the current proposal context.' using errcode='40001'; end if;
 current:=coalesce(saved.preferences,workspace_private.default_layout());proposed:=workspace_private.apply_layout_proposal_operations(current,operations,target);
 insert into workspace_private.layout_proposals(workspace_id,base_layout_revision,authority_revision,title,goal,goal_source,summary,operations,proposed_preferences,request_id,created_by,created_by_type)
 values(target,expected_layout_revision,expected_authority_revision,trim(proposal_title),trim(proposal_goal),goal_source,trim(proposal_summary),operations,proposed,request_id,auth.uid(),actor_type)
 returning * into created;
 return workspace_private.layout_proposal_receipt(created,target,false);
end; $$;

create function workspace.list_workspace_layout_proposals() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_proposal_direct(); saved workspace_private.layout_preferences; authority text:=workspace.get_bundle_experience()->>'revision';
begin
 select * into saved from workspace_private.layout_preferences p where p.workspace_id=target;
 return jsonb_build_object('schemaVersion','1.0','workspaceId',target,'layoutRevision',coalesce(saved.revision,0),'authorityRevision',authority,
  'items',coalesce((select jsonb_agg(workspace_private.layout_proposal_item(p,target) order by p.created_order desc)
   from (select * from workspace_private.layout_proposals x where x.workspace_id=target order by x.created_order desc limit 20) p),'[]'::jsonb));
end; $$;

create function workspace.decide_workspace_layout_proposal(proposal_id uuid,expected_proposal_version integer,expected_layout_revision integer,
 expected_authority_revision text,request_id uuid,decision text,confirmed boolean,decision_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_proposal_direct(); p workspace_private.layout_proposals; receipt workspace_private.layout_proposal_decisions;
 saved workspace_private.layout_preferences; authority text; resulting integer;
begin
 if proposal_id is null or expected_proposal_version is null or expected_proposal_version<1 or expected_layout_revision is null or expected_layout_revision<0
  or expected_authority_revision is null or char_length(expected_authority_revision) not between 1 and 200 or request_id is null
  or decision not in ('accept','reject') or confirmed is distinct from true or decision_note is null or char_length(trim(decision_note))>500 then
  raise exception 'Review and confirm one exact proposal decision.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-layout:'||target::text,0));
 select * into receipt from workspace_private.layout_proposal_decisions d where d.workspace_id=target and d.request_id=decide_workspace_layout_proposal.request_id;
 if found then
  if receipt.proposal_id=decide_workspace_layout_proposal.proposal_id and receipt.expected_proposal_version=expected_proposal_version
   and receipt.expected_layout_revision=expected_layout_revision and receipt.expected_authority_revision=expected_authority_revision
   and receipt.decision=decide_workspace_layout_proposal.decision and receipt.note=trim(decision_note) then
   select * into p from workspace_private.layout_proposals x where x.workspace_id=target and x.id=proposal_id;
   return workspace_private.layout_proposal_item(p,target)||jsonb_build_object('replayed',true,'resultingLayoutRevision',receipt.resulting_layout_revision);
  end if;
  raise exception 'This proposal decision request already means something else.' using errcode='40001';
 end if;
 authority:=workspace.get_bundle_experience()->>'revision';select * into saved from workspace_private.layout_preferences x where x.workspace_id=target;
 select * into p from workspace_private.layout_proposals x where x.workspace_id=target and x.id=proposal_id for update;
 if not found then raise exception 'Layout proposal unavailable.' using errcode='P0002'; end if;
 if p.version<>expected_proposal_version or p.status<>'pending'
  or expected_layout_revision<>coalesce(saved.revision,0) or expected_authority_revision is distinct from authority then
  raise exception 'Layout or proposal changed. Reload and review.' using errcode='40001'; end if;
 if decision='accept' then
  if p.base_layout_revision<>expected_layout_revision or p.authority_revision is distinct from authority then
   raise exception 'This recommendation is stale. Ask for a fresh proposal.' using errcode='40001'; end if;
  perform workspace.save_workspace_layout(p.proposed_preferences,expected_layout_revision,expected_authority_revision,request_id,true);
  resulting:=expected_layout_revision+1;
 else resulting:=expected_layout_revision; end if;
 update workspace_private.layout_proposals set version=version+1,status=case decide_workspace_layout_proposal.decision when 'accept' then 'accepted' else 'rejected' end,
  decided_at=now(),decided_by=auth.uid(),decision_note=trim(decide_workspace_layout_proposal.decision_note) where id=p.id returning * into p;
 insert into workspace_private.layout_proposal_decisions(workspace_id,request_id,proposal_id,expected_proposal_version,expected_layout_revision,
  expected_authority_revision,decision,note,resulting_proposal_version,resulting_layout_revision)
 values(target,request_id,p.id,expected_proposal_version,expected_layout_revision,expected_authority_revision,
  decide_workspace_layout_proposal.decision,trim(decide_workspace_layout_proposal.decision_note),p.version,resulting);
 return workspace_private.layout_proposal_item(p,target)||jsonb_build_object('replayed',false,'resultingLayoutRevision',resulting);
end; $$;

revoke all on function workspace_private.require_layout_proposal_workspace(),workspace_private.require_layout_proposal_direct(),
 workspace_private.layout_proposal_object_length(jsonb),workspace_private.layout_proposal_operations_valid(jsonb),
 workspace_private.layout_item_admitted(uuid,text),workspace_private.apply_layout_proposal_operations(jsonb,jsonb,uuid),
 workspace_private.layout_proposal_status(workspace_private.layout_proposals,uuid),workspace_private.layout_proposal_item(workspace_private.layout_proposals,uuid),
 workspace_private.layout_proposal_receipt(workspace_private.layout_proposals,uuid,boolean),workspace.layout_proposal_context(),
 workspace.propose_workspace_layout(integer,text,uuid,text,text,text,text,jsonb),workspace.list_workspace_layout_proposals(),
 workspace.decide_workspace_layout_proposal(uuid,integer,integer,text,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function workspace.layout_proposal_context(),workspace.propose_workspace_layout(integer,text,uuid,text,text,text,text,jsonb),
 workspace.list_workspace_layout_proposals(),workspace.decide_workspace_layout_proposal(uuid,integer,integer,text,uuid,text,boolean,text) to authenticated;
notify pgrst,'reload schema';
