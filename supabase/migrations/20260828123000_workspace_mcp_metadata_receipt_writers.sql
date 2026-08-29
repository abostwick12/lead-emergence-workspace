-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Convert every existing idempotent MCP mutation writer from
-- payload/result receipts to metadata-only receipts. Retries re-read the
-- canonical affected record after current authorization is evaluated.

create or replace function workspace_private.mcp_action_request_hash(input jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(input::text, 'sha256'), 'hex');
$$;

revoke all on function workspace_private.mcp_action_request_hash(jsonb) from public, anon, authenticated;
grant execute on function workspace_private.mcp_action_request_hash(jsonb) to authenticated;

create or replace function workspace.mcp_create_task(task_title text, request_id uuid, task_domain text default 'general', task_priority text default 'medium', task_due_date date default null, task_description text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_tasks_workspace();
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_title text := nullif(trim(task_title), '');
  effective_domain text := coalesce(nullif(trim(task_domain), ''), 'general');
  effective_priority text := coalesce(nullif(trim(task_priority), ''), 'medium');
  effective_description text := nullif(trim(task_description), '');
  request_hash text;
  receipt jsonb;
  record_id uuid;
  task workspace.tasks%rowtype;
begin
  if request_id is null or effective_title is null or char_length(effective_title) not between 1 and 240
    or effective_domain not in ('general','military_transition','sotf_fellowship','job_search','life','leadership')
    or effective_priority not in ('critical','high','medium','low')
    or (effective_description is not null and char_length(effective_description) > 10000) then
    raise exception 'Task input is not supported.' using errcode = '22023';
  end if;
  request_hash := workspace_private.mcp_action_request_hash(jsonb_build_object('title',effective_title,'domain',effective_domain,'priority',effective_priority,'due_date',task_due_date,'description',effective_description));
  receipt := workspace_private.begin_mcp_action_receipt(target_workspace_id, token_client_id, 'create_task', request_id, request_hash);
  if (receipt ->> 'replay')::boolean then
    record_id := (receipt ->> 'affected_record_id')::uuid;
    select * into task from workspace.tasks where id=record_id and workspace_id=target_workspace_id and created_by=auth.uid();
    if not found then raise exception 'The earlier task is no longer available for this Workspace.' using errcode='42501'; end if;
    return jsonb_build_object('task',jsonb_build_object('id',task.id,'domain',task.domain,'title',task.title,'description',task.description,'status',task.status,'priority',task.priority,'due_date',task.due_date,'tags',task.tags,'created_at',task.created_at,'updated_at',task.updated_at),'created',true,'idempotent_replay',true);
  end if;
  insert into workspace.tasks(workspace_id,domain,title,description,priority,due_date,created_by)
  values(target_workspace_id,effective_domain,effective_title,effective_description,effective_priority,task_due_date,auth.uid()) returning * into task;
  perform workspace_private.complete_mcp_action_receipt(target_workspace_id,token_client_id,'create_task',request_id,task.id,'task_created');
  return jsonb_build_object('task',jsonb_build_object('id',task.id,'domain',task.domain,'title',task.title,'description',task.description,'status',task.status,'priority',task.priority,'due_date',task.due_date,'tags',task.tags,'created_at',task.created_at,'updated_at',task.updated_at),'created',true,'idempotent_replay',false);
end; $$;

create or replace function workspace.mcp_create_memory(memory_content text, request_id uuid, target_memory_type text default 'context', target_domain text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_content text := nullif(trim(memory_content), '');
  effective_memory_type text := coalesce(nullif(trim(target_memory_type), ''), 'context');
  effective_domain text := nullif(trim(target_domain), '');
  request_hash text; receipt jsonb; record_id uuid; memory workspace.memory_entries%rowtype;
begin
  if request_id is null or effective_content is null or char_length(effective_content) not between 1 and 10000
    or effective_memory_type not in ('fact','preference','context','relationship')
    or (effective_domain is not null and effective_domain not in ('general','military_transition','sotf_fellowship','job_search','life','leadership')) then
    raise exception 'Memory input is not supported.' using errcode='22023';
  end if;
  request_hash := workspace_private.mcp_action_request_hash(jsonb_build_object('content',effective_content,'memory_type',effective_memory_type,'domain',effective_domain));
  receipt := workspace_private.begin_mcp_action_receipt(target_workspace_id,token_client_id,'create_memory',request_id,request_hash);
  if (receipt ->> 'replay')::boolean then
    record_id := (receipt ->> 'affected_record_id')::uuid;
    select * into memory from workspace.memory_entries where id=record_id and workspace_id=target_workspace_id and created_by=auth.uid();
    if not found then raise exception 'The earlier memory is no longer available for this Workspace.' using errcode='42501'; end if;
    return jsonb_build_object('memory',jsonb_build_object('id',memory.id,'memory_type',memory.memory_type,'content',memory.content,'domain',memory.domain,'created_at',memory.created_at,'updated_at',memory.updated_at),'created',true,'idempotent_replay',true);
  end if;
  insert into workspace.memory_entries(workspace_id,memory_type,content,domain,created_by) values(target_workspace_id,effective_memory_type,effective_content,effective_domain,auth.uid()) returning * into memory;
  perform workspace_private.complete_mcp_action_receipt(target_workspace_id,token_client_id,'create_memory',request_id,memory.id,'memory_created');
  return jsonb_build_object('memory',jsonb_build_object('id',memory.id,'memory_type',memory.memory_type,'content',memory.content,'domain',memory.domain,'created_at',memory.created_at,'updated_at',memory.updated_at),'created',true,'idempotent_replay',false);
end; $$;

create or replace function workspace.mcp_create_career_opportunity(target_company text, target_role text, request_id uuid, target_next_follow_up_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('career');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  company text := nullif(trim(target_company), ''); role_name text := nullif(trim(target_role), '');
  request_hash text; receipt jsonb; record_id uuid; opportunity workspace.job_applications%rowtype;
begin
  if request_id is null or company is null or role_name is null or char_length(company) not between 1 and 240 or char_length(role_name) not between 1 and 240 then raise exception 'Company and role must each be between 1 and 240 characters.' using errcode='22023'; end if;
  request_hash := workspace_private.mcp_action_request_hash(jsonb_build_object('company',company,'role',role_name,'next_follow_up_date',target_next_follow_up_date));
  receipt := workspace_private.begin_mcp_action_receipt(target_workspace_id,token_client_id,'create_career_opportunity',request_id,request_hash);
  if (receipt ->> 'replay')::boolean then
    record_id := (receipt ->> 'affected_record_id')::uuid;
    select * into opportunity from workspace.job_applications where id=record_id and workspace_id=target_workspace_id and created_by=auth.uid();
    if not found then raise exception 'The earlier career opportunity is no longer available for this Workspace.' using errcode='42501'; end if;
    return jsonb_build_object('opportunity',jsonb_build_object('id',opportunity.id,'company',opportunity.company,'role',opportunity.role,'status',opportunity.status,'next_follow_up_date',opportunity.next_follow_up_date,'created_at',opportunity.created_at,'updated_at',opportunity.updated_at),'created',true,'idempotent_replay',true);
  end if;
  insert into workspace.job_applications(workspace_id,company,role,next_follow_up_date,created_by) values(target_workspace_id,company,role_name,target_next_follow_up_date,auth.uid()) returning * into opportunity;
  perform workspace_private.complete_mcp_action_receipt(target_workspace_id,token_client_id,'create_career_opportunity',request_id,opportunity.id,'career_created');
  return jsonb_build_object('opportunity',jsonb_build_object('id',opportunity.id,'company',opportunity.company,'role',opportunity.role,'status',opportunity.status,'next_follow_up_date',opportunity.next_follow_up_date,'created_at',opportunity.created_at,'updated_at',opportunity.updated_at),'created',true,'idempotent_replay',false);
end; $$;

create or replace function workspace.mcp_resolve_capture(target_capture_id uuid, request_id uuid, task_domain text default 'general')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('quick_capture');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  effective_domain text := coalesce(nullif(trim(task_domain), ''), 'general');
  request_hash text; receipt jsonb; record_id uuid; task workspace.tasks%rowtype; capture workspace.capture_inbox%rowtype;
begin
  if not workspace_private.has_personal_capability(target_workspace_id,'tasks') then raise exception 'Task actions are not included for this Workspace.' using errcode='42501'; end if;
  if target_capture_id is null or request_id is null or effective_domain not in ('general','military_transition','sotf_fellowship','job_search','life','leadership') then raise exception 'Capture input is not supported.' using errcode='22023'; end if;
  request_hash := workspace_private.mcp_action_request_hash(jsonb_build_object('capture_id',target_capture_id,'domain',effective_domain));
  receipt := workspace_private.begin_mcp_action_receipt(target_workspace_id,token_client_id,'resolve_capture',request_id,request_hash);
  if (receipt ->> 'replay')::boolean then
    record_id := (receipt ->> 'affected_record_id')::uuid;
    select * into task from workspace.tasks where id=record_id and workspace_id=target_workspace_id and created_by=auth.uid();
    if not found then raise exception 'The earlier resolved task is no longer available for this Workspace.' using errcode='42501'; end if;
    return jsonb_build_object('task',jsonb_build_object('id',task.id,'domain',task.domain,'title',task.title,'status',task.status,'priority',task.priority,'due_date',task.due_date,'created_at',task.created_at,'updated_at',task.updated_at),'created',true,'idempotent_replay',true);
  end if;
  select * into capture from workspace.capture_inbox where id=target_capture_id and workspace_id=target_workspace_id and created_by=auth.uid() for update;
  if not found then raise exception 'Capture not found for this Workspace.' using errcode='22023'; end if;
  if capture.status <> 'unprocessed' then raise exception 'Capture is no longer available for task routing.' using errcode='22023'; end if;
  insert into workspace.tasks(workspace_id,domain,title,priority,created_by) values(target_workspace_id,effective_domain,capture.raw_text,'medium',auth.uid()) returning * into task;
  update workspace.capture_inbox set status='processed',routed_task_id=task.id,updated_at=now() where id=capture.id and workspace_id=target_workspace_id;
  perform workspace_private.complete_mcp_action_receipt(target_workspace_id,token_client_id,'resolve_capture',request_id,task.id,'capture_resolved');
  return jsonb_build_object('capture',jsonb_build_object('id',capture.id,'status','processed','routed_task_id',task.id),'task',jsonb_build_object('id',task.id,'domain',task.domain,'title',task.title,'status',task.status,'priority',task.priority,'due_date',task.due_date,'created_at',task.created_at,'updated_at',task.updated_at),'created',true,'idempotent_replay',false);
end; $$;

create or replace function workspace.mcp_replace_confirmed_workspace_configuration(target_area text, confirmed_text text, request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('core_workspace');
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  area_name text := nullif(trim(target_area), ''); text_value text := nullif(trim(confirmed_text), ''); assistant text;
  request_hash text; receipt jsonb; record_id uuid; item workspace.personal_configuration_items%rowtype;
begin
  if request_id is null or area_name not in ('responsibilities','areas_of_attention','priorities','commitments','value_focus','existing_systems','assistant_posture','review_rhythm','starting_capabilities','daily_brief','integration_recommendations') or text_value is null or char_length(text_value) not between 1 and 5000 then raise exception 'A supported setup area and concise confirmed text are required.' using errcode='22023'; end if;
  request_hash := workspace_private.mcp_action_request_hash(jsonb_build_object('area',area_name,'text',text_value));
  receipt := workspace_private.begin_mcp_action_receipt(target_workspace_id,token_client_id,'replace_workspace_configuration',request_id,request_hash);
  if (receipt ->> 'replay')::boolean then
    record_id := (receipt ->> 'affected_record_id')::uuid;
    select * into item from workspace.personal_configuration_items where id=record_id and workspace_id=target_workspace_id and created_by=auth.uid() and active;
    if not found then raise exception 'The earlier configuration record is no longer available for this Workspace.' using errcode='42501'; end if;
    return jsonb_build_object('item',jsonb_build_object('id',item.id,'area',item.area,'content',item.content,'epistemic_status',item.epistemic_status,'confirmed_at',item.confirmed_at,'updated_at',item.updated_at),'replaced',true,'idempotent_replay',true);
  end if;
  select coalesce(selected_assistant,'chatgpt') into assistant from workspace.personal_onboarding where workspace_id=target_workspace_id and user_id=auth.uid();
  update workspace.personal_configuration_items set active=false,updated_at=now() where workspace_id=target_workspace_id and area=area_name and active;
  insert into workspace.personal_configuration_items(workspace_id,area,content,epistemic_status,source_interface,active,confirmed_at,created_by) values(target_workspace_id,area_name,jsonb_build_object('text',text_value),'user_confirmed',assistant,true,now(),auth.uid()) returning * into item;
  update workspace.personal_onboarding set state=case when state in ('onboarding_complete','workspace_ready') then state else 'onboarding_in_progress' end,completed_areas=array(select distinct unnest(completed_areas || array[area_name])),last_resumed_at=now(),updated_at=now() where workspace_id=target_workspace_id and user_id=auth.uid();
  perform workspace_private.complete_mcp_action_receipt(target_workspace_id,token_client_id,'replace_workspace_configuration',request_id,item.id,'configuration_replaced');
  return jsonb_build_object('item',jsonb_build_object('id',item.id,'area',item.area,'content',item.content,'epistemic_status',item.epistemic_status,'confirmed_at',item.confirmed_at,'updated_at',item.updated_at),'replaced',true,'idempotent_replay',false);
end; $$;

-- Redact all historical content copies. Old rows no longer participate in
-- current writer replay because current operations use request_hash/reference.
update workspace_private.mcp_action_receipts
set request_payload = null,
    result = null
where request_payload is not null or result is not null;