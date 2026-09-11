-- SOTF v1 transition.daily_brief only. This stores content-free reviewed outcome
-- metadata and exposes current-authority product operations. It does not execute
-- workflows, access provider data, or change protected Professional Context.
-- Source migration only: hosted application requires its own written gate.

insert into workspace_private.product_settings (setting_key, setting_value)
values ('sotf_v1_daily_brief_enabled', 'false')
on conflict (setting_key) do nothing;

create table workspace_private.sotf_daily_brief_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  request_id uuid not null,
  run_id uuid not null,
  workflow_id text not null check (workflow_id = 'transition.daily_brief'),
  workflow_version text not null check (workflow_version = '1.0.0'),
  state_revision integer not null check (state_revision between 0 and 2000),
  brief_date date not null,
  time_zone text not null check (char_length(time_zone) between 1 and 80),
  status text not null check (status in ('completed','degraded')),
  connector_results jsonb not null check (jsonb_typeof(connector_results) = 'object'),
  degradation_reasons text[] not null default '{}',
  selected_le_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_le_refs) = 'array'),
  priority_count smallint not null check (priority_count between 0 and 3),
  usefulness text not null check (usefulness in ('useful','not_useful','not_rated')),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (workspace_id, user_id, workflow_id, request_id),
  unique (workspace_id, user_id, workflow_id, run_id)
);

create table workspace_private.sotf_workflow_access_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  operation text not null check (operation = 'workflow_retrieved'),
  bundle_key text not null check (bundle_key = 'sotf_transition'),
  workflow_id text not null check (workflow_id = 'transition.daily_brief'),
  workflow_version text not null check (workflow_version = '1.0.0'),
  result text not null check (result = 'authorized'),
  recorded_at timestamptz not null default clock_timestamp()
);

create index sotf_workflow_access_audit_recent_idx
  on workspace_private.sotf_workflow_access_audit(workspace_id, user_id, recorded_at desc, id desc);

create index sotf_daily_brief_outcomes_recent_idx
  on workspace_private.sotf_daily_brief_outcomes(workspace_id, user_id, workflow_id, workflow_version, recorded_at desc, id desc);

alter table workspace_private.sotf_daily_brief_outcomes enable row level security;
alter table workspace_private.sotf_workflow_access_audit enable row level security;
revoke all on workspace_private.sotf_daily_brief_outcomes, workspace_private.sotf_workflow_access_audit
  from public, anon, authenticated;

create function workspace.sotf_v1_access_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  candidate_workspace uuid;
  target_workspace uuid;
  required_capabilities constant text[] := array['core_workspace','workspace_mcp','career','daily_brief','agentic_workflows'];
  missing_capabilities text[];
begin
  if auth.uid() is null or nullif(auth.jwt() ->> 'client_id', '') is null then
    return jsonb_build_object('state','access_denied');
  end if;
  if not workspace_private.is_valid_mcp_request() then
    return jsonb_build_object('state','access_denied');
  end if;
  select workspace_record.id into candidate_workspace
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if candidate_workspace is null then
    return jsonb_build_object('state','access_denied');
  end if;
  if not exists (
    select 1 from workspace.personal_plans
    where workspace_id = candidate_workspace and user_id = auth.uid() and status = 'active'
  ) then
    return jsonb_build_object('state','entitlement_required');
  end if;
  begin
    target_workspace := workspace_private.require_mcp_workspace();
  exception when others then
    return jsonb_build_object('state','access_denied');
  end;

  if not exists (
    select 1 from workspace_private.product_settings
    where setting_key = 'sotf_v1_daily_brief_enabled' and setting_value = 'true'
  ) then
    return jsonb_build_object('state','service_unavailable');
  end if;

  if not exists (
    select 1 from workspace.mcp_authorizations
    where workspace_id = target_workspace
      and client_id = auth.jwt() ->> 'client_id'
      and created_by = auth.uid()
      and status = 'connected'
      and assistant_provider = 'chatgpt'
  ) then
    return jsonb_build_object('state','incompatible_contract');
  end if;

  if not exists (
    select 1
    from workspace.bundle_entitlements as entitlement
    join workspace.bundle_definitions as definition using (bundle_key)
    where entitlement.workspace_id = target_workspace
      and entitlement.beneficiary_user_id = auth.uid()
      and entitlement.bundle_key = 'sotf_transition'
      and definition.availability_status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
      and entitlement.revoked_at is null
  ) then
    return jsonb_build_object('state','entitlement_required');
  end if;

  select coalesce(array_agg(capability order by capability), '{}'::text[]) into missing_capabilities
  from unnest(required_capabilities) as capability
  where not workspace_private.has_personal_capability(target_workspace, capability);
  if cardinality(missing_capabilities) > 0 then
    return jsonb_build_object('state','capability_unavailable','missing_capabilities',missing_capabilities);
  end if;
  return jsonb_build_object(
    'state','active',
    'workspace_id',target_workspace,
    'capabilities',(select jsonb_agg(capability order by capability) from unnest(required_capabilities) as capability)
  );
end; $$;

create function workspace_private.require_sotf_v1_access()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare access jsonb := workspace.sotf_v1_access_state();
begin
  if access ->> 'state' <> 'active' then
    raise exception 'sotf_v1:%', access ->> 'state' using errcode = '42501';
  end if;
  return (access ->> 'workspace_id')::uuid;
end; $$;

-- This is an operational, content-free access receipt, not a user-state write.
-- Successful contract delivery can therefore be audited without storing the
-- contract body, prompt, provider content, or any customer conversation.
create function workspace.sotf_v1_authorize_workflow_retrieval(p_workflow_id text, p_workflow_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_v1_access();
begin
  perform workspace_private.lock_sotf_v1_authority(target_workspace);
  if p_workflow_id <> 'transition.daily_brief' then
    raise exception 'sotf_v1:not_available' using errcode = '22023';
  end if;
  if p_workflow_version <> '1.0.0' then
    raise exception 'sotf_v1:version_not_available' using errcode = '22023';
  end if;
  insert into workspace_private.sotf_workflow_access_audit(
    workspace_id,user_id,client_id,operation,bundle_key,workflow_id,workflow_version,result
  ) values (
    target_workspace,auth.uid(),auth.jwt() ->> 'client_id','workflow_retrieved','sotf_transition',
    p_workflow_id,p_workflow_version,'authorized'
  );
  return jsonb_build_object(
    'state','active','workspace_id',target_workspace,
    'capabilities',to_jsonb(array['agentic_workflows','career','core_workspace','daily_brief','workspace_mcp'])
  );
end; $$;

-- Serialize contract delivery and outcome writes with release, membership,
-- plan, connection, entitlement, definition, and capability changes, then recheck authority.
-- A competing revocation/disconnect either commits before this check and wins,
-- or waits until this outcome transaction has committed.
create function workspace_private.lock_sotf_v1_authority(target_workspace uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare checked_workspace uuid;
begin
  perform 1 from workspace_private.product_settings
    where setting_key = 'sotf_v1_daily_brief_enabled' for update;
  perform 1 from workspace.workspace_memberships
    where workspace_id = target_workspace and user_id = auth.uid() for update;
  perform 1 from workspace.personal_plans
    where workspace_id = target_workspace and user_id = auth.uid() for update;
  perform 1 from workspace.mcp_authorizations
    where workspace_id = target_workspace and client_id = auth.jwt() ->> 'client_id' for update;
  perform 1 from workspace.bundle_definitions
    where bundle_key = 'sotf_transition' for update;
  perform 1 from workspace.bundle_entitlements
    where workspace_id = target_workspace and beneficiary_user_id = auth.uid() and bundle_key = 'sotf_transition'
    for update;
  perform 1 from workspace.bundle_capabilities
    where bundle_key = 'sotf_transition'
      and capability_key = any(array['workspace_mcp','career','daily_brief','agentic_workflows'])
    for update;
  checked_workspace := workspace_private.require_sotf_v1_access();
  if checked_workspace is distinct from target_workspace then
    raise exception 'sotf_v1:access_denied' using errcode = '42501';
  end if;
end; $$;

create function workspace_private.sotf_v1_outcome_receipt(item workspace_private.sotf_daily_brief_outcomes)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'outcome_id',item.id,
    'request_id',item.request_id,
    'run_id',item.run_id,
    'workflow_id',item.workflow_id,
    'workflow_version',item.workflow_version,
    'state_revision',item.state_revision,
    'recorded_at',item.recorded_at,
    'brief_date',item.brief_date,
    'time_zone',item.time_zone,
    'status',item.status,
    'connector_results',item.connector_results,
    'degradation_reasons',to_jsonb(item.degradation_reasons),
    'selected_le_refs',item.selected_le_refs,
    'priority_count',item.priority_count,
    'usefulness',item.usefulness,
    'provenance',item.provenance || jsonb_build_object(
      'workspace_id',item.workspace_id,'subject_id',item.user_id,'client_id',item.client_id
    )
  );
$$;

create function workspace_private.validate_sotf_v1_daily_brief_outcome(outcome jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  connector jsonb;
  reason text;
  reference jsonb;
  reference_count integer;
  required_reason text;
  complete boolean;
begin
  if jsonb_typeof(outcome) is distinct from 'object' then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;
  if octet_length(outcome::text) > 8192
    or (select count(*) from jsonb_object_keys(outcome)) <> 19
    or not outcome ?& array[
      'schema_version','request_id','run_id','workflow_id','workflow_version','expected_state_revision',
      'brief_date','time_zone','host','execution_mode','data_class','user_confirmed','status',
      'connector_results','degradation_reasons','selected_le_refs','priority_count','usefulness','provenance'
    ]
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  if outcome ->> 'schema_version' <> '1'
    or jsonb_typeof(outcome -> 'schema_version') is distinct from 'string'
    or outcome ->> 'workflow_id' <> 'transition.daily_brief'
    or outcome ->> 'workflow_version' <> '1.0.0'
    or outcome ->> 'host' <> 'chatgpt'
    or outcome ->> 'execution_mode' <> 'A'
    or outcome ->> 'data_class' <> 'ordinary_transition_operations'
    or outcome -> 'user_confirmed' is distinct from 'true'::jsonb
    or outcome ->> 'status' not in ('completed','degraded')
    or outcome ->> 'usefulness' not in ('useful','not_useful','not_rated')
    or outcome ->> 'request_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or outcome ->> 'run_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(outcome -> 'expected_state_revision') is distinct from 'number'
    or outcome ->> 'expected_state_revision' !~ '^[0-9]{1,4}$'
    or (outcome ->> 'expected_state_revision')::integer not between 0 and 2000
    or outcome ->> 'brief_date' !~ '^\d{4}-\d{2}-\d{2}$'
    or char_length(outcome ->> 'time_zone') not between 1 and 80
    or not exists (select 1 from pg_timezone_names where name = outcome ->> 'time_zone')
    or jsonb_typeof(outcome -> 'priority_count') is distinct from 'number'
    or outcome ->> 'priority_count' !~ '^[0-3]$'
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  begin
    perform (outcome ->> 'brief_date')::date;
    perform (outcome ->> 'request_id')::uuid;
    perform (outcome ->> 'run_id')::uuid;
  exception when others then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end;

  connector := outcome -> 'connector_results';
  if jsonb_typeof(connector) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(connector)) <> 2
    or not connector ?& array['calendar_read','email_read']
    or connector ->> 'calendar_read' not in ('used','not_available','failed','not_requested')
    or connector ->> 'email_read' not in ('used','not_available','failed','not_requested')
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  if jsonb_typeof(outcome -> 'degradation_reasons') is distinct from 'array'
    or jsonb_array_length(outcome -> 'degradation_reasons') > 5
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  for reason in select jsonb_array_elements_text(outcome -> 'degradation_reasons') loop
    if reason not in ('calendar_unavailable','calendar_failed','email_unavailable','email_failed','state_truncated') then
      raise exception 'sotf_v1:invalid_input' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements_text(outcome -> 'degradation_reasons'))
    <> (select count(distinct value) from jsonb_array_elements_text(outcome -> 'degradation_reasons') as value)
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  foreach required_reason in array array['calendar_unavailable','calendar_failed','email_unavailable','email_failed'] loop
    if ((required_reason = 'calendar_unavailable' and connector ->> 'calendar_read' = 'not_available')
      or (required_reason = 'calendar_failed' and connector ->> 'calendar_read' = 'failed')
      or (required_reason = 'email_unavailable' and connector ->> 'email_read' = 'not_available')
      or (required_reason = 'email_failed' and connector ->> 'email_read' = 'failed'))
      is distinct from (outcome -> 'degradation_reasons' ? required_reason)
    then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  end loop;
  complete := connector ->> 'calendar_read' = 'used' and connector ->> 'email_read' = 'used'
    and jsonb_array_length(outcome -> 'degradation_reasons') = 0;
  if (outcome ->> 'status' = 'completed') is distinct from complete then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(outcome -> 'selected_le_refs') is distinct from 'array'
    or jsonb_array_length(outcome -> 'selected_le_refs') > 3
    or jsonb_array_length(outcome -> 'selected_le_refs') > (outcome ->> 'priority_count')::integer
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  for reference in select value from jsonb_array_elements(outcome -> 'selected_le_refs') loop
    if jsonb_typeof(reference) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(reference)) <> 2
      or not reference ?& array['entity_type','entity_id']
      or reference ->> 'entity_type' not in ('criterion','opportunity','commitment','meeting','hypothesis')
      or jsonb_typeof(reference -> 'entity_id') is distinct from 'string'
      or char_length(reference ->> 'entity_id') not between 1 and 100
    then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  end loop;
  select count(*) into reference_count from (
    select distinct value ->> 'entity_type', value ->> 'entity_id'
    from jsonb_array_elements(outcome -> 'selected_le_refs')
  ) as unique_reference;
  if reference_count <> jsonb_array_length(outcome -> 'selected_le_refs') then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(outcome -> 'provenance') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(outcome -> 'provenance')) <> 2
    or outcome #>> '{provenance,source}' <> 'host_reported_user_confirmed'
    or outcome #> '{provenance,provider_content_persisted}' is distinct from 'false'::jsonb
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
end; $$;

create function workspace_private.sotf_v1_reference_exists(target_workspace uuid, entity_type text, entity_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from workspace_private.sotf_operation_events as event
    where event.workspace_id = target_workspace and (
      (entity_type = 'opportunity' and event.envelope #>> '{command,type}' = 'record_opportunity'
        and event.envelope #>> '{command,opportunity,id}' = entity_id)
      or (entity_type = 'meeting' and event.envelope #>> '{command,type}' = 'record_meeting'
        and event.envelope #>> '{command,meeting,id}' = entity_id)
      or (entity_type = 'hypothesis' and (
        (event.envelope #>> '{command,type}' = 'save_hypothesis' and event.envelope #>> '{command,hypothesis,id}' = entity_id)
        or (event.envelope #>> '{command,type}' = 'start_transition' and exists (
          select 1 from jsonb_array_elements(coalesce(event.envelope #> '{command,hypotheses}','[]'::jsonb)) as item where item ->> 'id' = entity_id))))
      or (entity_type = 'criterion' and event.envelope #>> '{command,type}' in ('start_transition','confirm_criteria') and exists (
        select 1 from jsonb_array_elements(coalesce(event.envelope #> '{command,criteria}','[]'::jsonb)) as item where item ->> 'id' = entity_id))
      or (entity_type = 'commitment' and (
        (event.envelope #>> '{command,type}' = 'save_commitment' and event.envelope #>> '{command,commitment,id}' = entity_id)
        or (event.envelope #>> '{command,type}' = 'debrief_meeting' and exists (
          select 1 from jsonb_array_elements(coalesce(event.envelope #> '{command,commitments}','[]'::jsonb)) as item where item ->> 'id' = entity_id))
        or (event.envelope #>> '{command,type}' = 'decide_opportunity' and event.envelope #>> '{command,opportunityId}' || ':decision-next-step' = entity_id)
        or (event.envelope #>> '{command,type}' = 'record_meeting' and event.envelope #>> '{command,meeting,id}' || ':prepare' = entity_id)))
    )
  );
$$;

create function workspace.sotf_v1_probe_daily_brief_outcome(outcome jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_v1_access();
  existing workspace_private.sotf_daily_brief_outcomes%rowtype;
  match_count integer;
begin
  perform workspace_private.validate_sotf_v1_daily_brief_outcome(outcome);
  select count(*) into match_count
  from workspace_private.sotf_daily_brief_outcomes
  where workspace_id = target_workspace and user_id = auth.uid() and workflow_id = 'transition.daily_brief'
    and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid);
  if match_count = 0 then return jsonb_build_object('state','new'); end if;
  if match_count > 1 then return jsonb_build_object('state','conflict'); end if;
  select * into existing from workspace_private.sotf_daily_brief_outcomes
  where workspace_id = target_workspace and user_id = auth.uid() and workflow_id = 'transition.daily_brief'
    and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid)
  limit 1;
  if existing.payload <> outcome then return jsonb_build_object('state','conflict'); end if;
  return jsonb_build_object('state','replay','receipt',workspace_private.sotf_v1_outcome_receipt(existing));
end; $$;

create function workspace.sotf_v1_list_daily_brief_outcomes(p_workflow_version text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.require_sotf_v1_access();
begin
  if p_workflow_version <> '1.0.0' then raise exception 'sotf_v1:version_not_available' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(row.receipt order by row.recorded_at desc, row.id desc)
    from (
      select item.id, item.recorded_at, workspace_private.sotf_v1_outcome_receipt(item) as receipt
      from workspace_private.sotf_daily_brief_outcomes as item
      where item.workspace_id = target_workspace and item.user_id = auth.uid()
        and item.workflow_id = 'transition.daily_brief' and item.workflow_version = p_workflow_version
      order by item.recorded_at desc, item.id desc limit 3
    ) as row
  ), '[]'::jsonb);
end; $$;

create function workspace.sotf_v1_record_daily_brief_outcome(outcome jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid;
  head workspace_private.sotf_operation_heads%rowtype;
  existing workspace_private.sotf_daily_brief_outcomes%rowtype;
  inserted workspace_private.sotf_daily_brief_outcomes%rowtype;
  match_count integer;
  reference jsonb;
  local_today date;
begin
  target_workspace := workspace_private.require_sotf_v1_access();
  perform workspace_private.lock_sotf_v1_authority(target_workspace);
  perform workspace_private.validate_sotf_v1_daily_brief_outcome(outcome);
  select * into head from workspace_private.sotf_operation_heads where workspace_id = target_workspace for update;
  if head.workspace_id is null then raise exception 'sotf_v1:transition_not_started' using errcode = '22023'; end if;

  select count(*) into match_count
  from workspace_private.sotf_daily_brief_outcomes
  where workspace_id = target_workspace and user_id = auth.uid() and workflow_id = 'transition.daily_brief'
    and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid);
  if match_count > 1 then raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023'; end if;
  if match_count = 1 then
    select * into existing from workspace_private.sotf_daily_brief_outcomes
    where workspace_id = target_workspace and user_id = auth.uid() and workflow_id = 'transition.daily_brief'
      and (request_id = (outcome ->> 'request_id')::uuid or run_id = (outcome ->> 'run_id')::uuid)
    limit 1;
    if existing.payload <> outcome then raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023'; end if;
    return jsonb_build_object('saved',true,'replayed',true,'receipt',workspace_private.sotf_v1_outcome_receipt(existing));
  end if;

  if head.revision <> (outcome ->> 'expected_state_revision')::integer then
    raise exception 'sotf_v1:state_changed' using errcode = '40001';
  end if;
  local_today := (clock_timestamp() at time zone (outcome ->> 'time_zone'))::date;
  if (outcome ->> 'brief_date')::date not in (local_today, local_today - 1) then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;
  for reference in select value from jsonb_array_elements(outcome -> 'selected_le_refs') loop
    if not workspace_private.sotf_v1_reference_exists(target_workspace, reference ->> 'entity_type', reference ->> 'entity_id') then
      raise exception 'sotf_v1:invalid_input' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from workspace_private.sotf_daily_brief_outcomes
      where workspace_id = target_workspace and user_id = auth.uid() and workflow_id = 'transition.daily_brief') >= 100
  then raise exception 'sotf_v1:capacity_reached' using errcode = '54000'; end if;

  insert into workspace_private.sotf_daily_brief_outcomes(
    workspace_id,user_id,client_id,request_id,run_id,workflow_id,workflow_version,state_revision,
    brief_date,time_zone,status,connector_results,degradation_reasons,selected_le_refs,priority_count,usefulness,provenance,payload
  ) values (
    target_workspace,auth.uid(),auth.jwt() ->> 'client_id',(outcome ->> 'request_id')::uuid,(outcome ->> 'run_id')::uuid,
    outcome ->> 'workflow_id',outcome ->> 'workflow_version',(outcome ->> 'expected_state_revision')::integer,
    (outcome ->> 'brief_date')::date,outcome ->> 'time_zone',outcome ->> 'status',outcome -> 'connector_results',
    array(select jsonb_array_elements_text(outcome -> 'degradation_reasons')),outcome -> 'selected_le_refs',
    (outcome ->> 'priority_count')::smallint,outcome ->> 'usefulness',outcome -> 'provenance',outcome
  ) returning * into inserted;
  select * into inserted from workspace_private.sotf_daily_brief_outcomes where id = inserted.id;
  if inserted.id is null then raise exception 'sotf_v1:result_unknown' using errcode = 'P0001'; end if;
  return jsonb_build_object('saved',true,'replayed',false,'receipt',workspace_private.sotf_v1_outcome_receipt(inserted));
exception when unique_violation then
  raise exception 'sotf_v1:idempotency_conflict' using errcode = '22023';
end; $$;

revoke all on function workspace_private.require_sotf_v1_access() from public, anon, authenticated;
revoke all on function workspace_private.lock_sotf_v1_authority(uuid) from public, anon, authenticated;
revoke all on function workspace_private.sotf_v1_outcome_receipt(workspace_private.sotf_daily_brief_outcomes) from public, anon, authenticated;
revoke all on function workspace_private.validate_sotf_v1_daily_brief_outcome(jsonb) from public, anon, authenticated;
revoke all on function workspace_private.sotf_v1_reference_exists(uuid,text,text) from public, anon, authenticated;
revoke all on function workspace.sotf_v1_access_state() from public, anon, authenticated;
revoke all on function workspace.sotf_v1_authorize_workflow_retrieval(text,text) from public, anon, authenticated;
revoke all on function workspace.sotf_v1_probe_daily_brief_outcome(jsonb) from public, anon, authenticated;
revoke all on function workspace.sotf_v1_list_daily_brief_outcomes(text) from public, anon, authenticated;
revoke all on function workspace.sotf_v1_record_daily_brief_outcome(jsonb) from public, anon, authenticated;
grant execute on function workspace.sotf_v1_access_state() to authenticated;
grant execute on function workspace.sotf_v1_authorize_workflow_retrieval(text,text) to authenticated;
grant execute on function workspace.sotf_v1_probe_daily_brief_outcome(jsonb) to authenticated;
grant execute on function workspace.sotf_v1_list_daily_brief_outcomes(text) to authenticated;
grant execute on function workspace.sotf_v1_record_daily_brief_outcome(jsonb) to authenticated;

comment on table workspace_private.sotf_daily_brief_outcomes is
  'Content-free, user-reviewed transition.daily_brief v1 outcome receipts. No provider payloads, brief text, protected context, or workflow execution.';
comment on table workspace_private.sotf_workflow_access_audit is
  'Content-free audit receipts for authorized SOTF v1 workflow retrieval. Not user state; no contract, prompt, conversation, or provider content.';
