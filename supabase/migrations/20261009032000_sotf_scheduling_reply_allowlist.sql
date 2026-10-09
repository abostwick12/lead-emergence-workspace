-- Permit the existing scheduling-reply command through the SOTF operation append boundary.
create or replace function workspace.sotf_append_operation(operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_operations();
  head workspace_private.sotf_operation_heads%rowtype;
  prior workspace_private.sotf_operation_events%rowtype;
  operation_id uuid;
  expected_revision integer;
  size_bytes integer;
begin
  if jsonb_typeof(operation) is distinct from 'object'
    or operation ->> 'dataClass' is distinct from 'ordinary_transition_operations'
    or operation -> 'userConfirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(operation -> 'command') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(operation)) <> 5
    or not operation ?& array['requestId', 'expectedRevision', 'userConfirmed', 'dataClass', 'command']
    then raise exception 'A confirmed ordinary operation is required.' using errcode = '22023'; end if;
  if operation -> 'command' ->> 'type' is null or not (operation -> 'command' ->> 'type' = any(array[
    'start_transition','confirm_criteria','save_hypothesis','record_opportunity','record_evidence','review_evidence',
    'resolve_requirement','decide_opportunity','save_person','prepare_outreach','prepare_scheduling_reply','record_meeting','debrief_meeting',
    'save_commitment','resolve_commitment','save_story','save_material','record_submission','record_application_outcome',
    'record_interview','record_offer','accept_offer','review_week','prepare_action','revise_action','approve_action',
    'record_action_result','retry_action','close_chapter'
  ])) then raise exception 'Unknown transition operation.' using errcode = '22023'; end if;
  operation_id := (operation ->> 'requestId')::uuid;
  expected_revision := (operation ->> 'expectedRevision')::integer;
  size_bytes := octet_length(operation::text);
  if operation_id is null or expected_revision is null or expected_revision < 0 or size_bytes > 64000 then
    raise exception 'Invalid or oversized transition operation.' using errcode = '22023'; end if;
  insert into workspace_private.sotf_operation_heads(workspace_id) values(target_workspace) on conflict do nothing;
  select * into head from workspace_private.sotf_operation_heads where workspace_id = target_workspace for update;
  select * into prior from workspace_private.sotf_operation_events where workspace_id = target_workspace and request_id = operation_id;
  if found then
    if prior.envelope <> operation then raise exception 'Request ID already belongs to a different operation.' using errcode = '22023'; end if;
    return jsonb_build_object('revision', prior.revision, 'replayed', true);
  end if;
  if head.revision <> expected_revision then raise exception 'Refresh before saving this operation.' using errcode = '40001'; end if;
  if head.revision >= 2000 or head.payload_bytes + size_bytes > 2000000 then raise exception 'Pilot chapter capacity reached; existing work is preserved.' using errcode = '54000'; end if;
  insert into workspace_private.sotf_operation_events(workspace_id, revision, request_id, envelope)
    values(target_workspace, head.revision + 1, operation_id, operation);
  update workspace_private.sotf_operation_heads set revision = head.revision + 1, payload_bytes = head.payload_bytes + size_bytes where workspace_id = target_workspace;
  return jsonb_build_object('revision', head.revision + 1, 'replayed', false);
end; $$;
