-- Preserve the existing append contract while requiring a current review declaration
-- for new message approvals. Historical request-ID replays return before this gate.
create or replace function workspace.sotf_append_operation(operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_operations();
  head workspace_private.sotf_operation_heads%rowtype;
  prior workspace_private.sotf_operation_events%rowtype;
  operation_id uuid;
  expected_revision integer;
  size_bytes integer;
  action_id text;
  action_suffix text;
  origin_command jsonb;
  latest_edit jsonb;
  edit_count integer;
  message_action boolean;
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
    'resolve_requirement','decide_opportunity','save_person','prepare_outreach','record_meeting','debrief_meeting',
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

  if operation -> 'command' ->> 'type' = 'approve_action' then
    action_id := operation -> 'command' ->> 'actionId';
    action_suffix := substring(action_id from '^[^:]+:(.+)$');
    select event.envelope -> 'command' into origin_command
      from workspace_private.sotf_operation_events as event
      where event.workspace_id = target_workspace
        and event.envelope ->> 'requestId' = split_part(action_id, ':', 1);
    if origin_command is null or action_suffix is null then
      raise exception 'Unknown transition action.' using errcode = '22023';
    end if;
    message_action := case
      when origin_command ->> 'type' = 'prepare_action' and action_suffix = 'action'
        then origin_command ->> 'kind' = any(array['email','direct_message','public_comment'])
      when origin_command ->> 'type' = 'prepare_outreach'
        and action_suffix = any(array['action','public-comment','private-follow-up','warm-introduction']) then true
      when origin_command ->> 'type' = 'prepare_scheduling_reply' and action_suffix = 'scheduling-reply' then true
      when origin_command ->> 'type' = 'debrief_meeting' and action_suffix = 'thank-you' then true
      else null
    end;
    if message_action is null then
      raise exception 'Unknown transition action.' using errcode = '22023';
    end if;
    if message_action then
      select count(*)::integer, (array_agg(event.envelope -> 'command' order by event.revision desc))[1]
        into edit_count, latest_edit
        from workspace_private.sotf_operation_events as event
        where event.workspace_id = target_workspace
          and event.envelope -> 'command' ->> 'actionId' = action_id
          and event.envelope -> 'command' ->> 'type' = any(array['revise_action','retry_action']);
      if edit_count = 0
        or latest_edit ->> 'type' is distinct from 'revise_action'
        or latest_edit -> 'skillReviewed' is distinct from 'true'::jsonb
        or nullif(btrim(latest_edit ->> 'body'), '') is null
        or latest_edit ->> 'body' like 'Preparation only:%'
        or operation -> 'command' ->> 'exactRevision' is distinct from (edit_count + 1)::text then
        raise exception 'Review this exact message with AI Slop Killer in Codex before approval.' using errcode = '22023';
      end if;
    end if;
  end if;

  insert into workspace_private.sotf_operation_events(workspace_id, revision, request_id, envelope)
    values(target_workspace, head.revision + 1, operation_id, operation);
  update workspace_private.sotf_operation_heads set revision = head.revision + 1, payload_bytes = head.payload_bytes + size_bytes where workspace_id = target_workspace;
  return jsonb_build_object('revision', head.revision + 1, 'replayed', false);
end; $$;
