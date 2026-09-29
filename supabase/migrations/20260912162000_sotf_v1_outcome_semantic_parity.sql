-- SOTF v1 outcome semantic parity only. The authenticated write authority must
-- derive projection-dependent facts from the canonical operation log rather
-- than trusting a caller's state_truncated declaration or broad record existence.

create function workspace_private.sotf_v1_compact_json(value jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare result text;
begin
  if jsonb_typeof(value) = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(entry.key)::text || ':' || workspace_private.sotf_v1_compact_json(entry.value), ',' order by entry.key), '') || '}'
      into result from jsonb_each(value) as entry;
  elsif jsonb_typeof(value) = 'array' then
    select '[' || coalesce(string_agg(workspace_private.sotf_v1_compact_json(entry.value), ',' order by entry.ordinality), '') || ']'
      into result from jsonb_array_elements(value) with ordinality as entry(value, ordinality);
  else
    result := value::text;
  end if;
  return result;
end; $$;

create function workspace_private.sotf_v1_daily_brief_projection_semantics(
  target_workspace uuid,
  target_brief_date date,
  target_time_zone text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  event_record record;
  command jsonb;
  command_type text;
  item jsonb;
  current_item jsonb;
  current_meeting jsonb;
  item_id text;
  target_id text;
  prior_prepare jsonb;
  reopen_prepare boolean;
  chapter jsonb := null;
  criteria jsonb := '[]'::jsonb;
  hypotheses jsonb := '{}'::jsonb;
  opportunities jsonb := '{}'::jsonb;
  commitments jsonb := '{}'::jsonb;
  meetings jsonb := '{}'::jsonb;
  criteria_rows jsonb;
  opportunity_rows jsonb;
  commitment_rows jsonb;
  meeting_rows jsonb;
  hypothesis_rows jsonb;
  recent_outcomes jsonb;
  suggestions jsonb;
  projection jsonb;
  eligible_refs jsonb;
  truncated text[] := '{}'::text[];
  section text;
  section_count integer;
  end_date date := target_brief_date + 2;
  window_start timestamptz := target_brief_date::timestamp at time zone target_time_zone;
  window_end timestamptz := (target_brief_date + 2)::timestamp at time zone target_time_zone;
  current_revision integer;
begin
  select revision into current_revision
  from workspace_private.sotf_operation_heads
  where workspace_id = target_workspace;
  if current_revision is null then
    raise exception 'sotf_v1:transition_not_started' using errcode = '22023';
  end if;

  for event_record in
    select envelope, recorded_at
    from workspace_private.sotf_operation_events
    where workspace_id = target_workspace
    order by revision
  loop
    command := event_record.envelope -> 'command';
    command_type := command ->> 'type';

    if command_type = 'start_transition' then
      chapter := jsonb_build_object(
        'question',command ->> 'question','phase','exploring','weeklyHours',command -> 'weeklyHours'
      );
      criteria := command -> 'criteria';
      hypotheses := '{}'::jsonb;
      for item in select value from jsonb_array_elements(command -> 'hypotheses') loop
        hypotheses := jsonb_set(hypotheses,array[item ->> 'id'],item,true);
      end loop;

    elsif command_type = 'confirm_criteria' then
      criteria := command -> 'criteria';

    elsif command_type = 'save_hypothesis' then
      item := command -> 'hypothesis';
      hypotheses := jsonb_set(hypotheses,array[item ->> 'id'],item,true);

    elsif command_type = 'review_week' then
      for item in select value from jsonb_array_elements(command -> 'hypothesisUpdates') loop
        hypotheses := jsonb_set(hypotheses,array[item ->> 'id'],item,true);
      end loop;
      for item in select value from jsonb_array_elements(command -> 'commitments') loop
        item_id := item ->> 'id';
        current_item := commitments -> item_id;
        item := item || jsonb_build_object('status',coalesce(current_item ->> 'status','open'));
        commitments := jsonb_set(commitments,array[item_id],item,true);
      end loop;

    elsif command_type = 'record_opportunity' then
      item := command -> 'opportunity';
      opportunities := jsonb_set(opportunities,array[item ->> 'id'],item || jsonb_build_object('status','exploring'),true);

    elsif command_type = 'decide_opportunity' then
      item_id := command ->> 'opportunityId';
      current_item := opportunities -> item_id;
      current_item := current_item || jsonb_build_object(
        'status',command ->> 'decision',
        'decision',jsonb_build_object('nextAction',command ->> 'nextAction','due',command -> 'due')
      );
      opportunities := jsonb_set(opportunities,array[item_id],current_item,true);
      target_id := item_id || ':decision-next-step';
      item := jsonb_build_object(
        'id',target_id,'title',left(command ->> 'nextAction',240),'due',command -> 'due',
        'definitionOfDone',command ->> 'nextAction','reviewTrigger',command ->> 'revisitWhen',
        'status',case when command ->> 'decision' in ('pause','decline') then 'cancelled' else 'open' end
      );
      commitments := jsonb_set(commitments,array[target_id],item,true);

    elsif command_type = 'save_commitment' then
      item := command -> 'commitment';
      item_id := item ->> 'id';
      current_item := commitments -> item_id;
      item := item || jsonb_build_object('status',coalesce(current_item ->> 'status','open'));
      commitments := jsonb_set(commitments,array[item_id],item,true);

    elsif command_type = 'resolve_commitment' then
      item_id := command ->> 'commitmentId';
      current_item := commitments -> item_id;
      commitments := jsonb_set(commitments,array[item_id],current_item || jsonb_build_object('status',command ->> 'status'),true);

    elsif command_type = 'record_meeting' then
      item := command -> 'meeting';
      target_id := item ->> 'id';
      current_meeting := meetings -> target_id;
      if nullif(item ->> 'sourceEventId','') is not null then
        select entry.key, entry.value into target_id, current_meeting
        from jsonb_each(meetings) as entry
        where entry.value ->> 'provider' = item ->> 'provider'
          and entry.value ->> 'sourceEventId' = item ->> 'sourceEventId'
        limit 1;
        target_id := coalesce(target_id,item ->> 'id');
      end if;
      item := item || jsonb_build_object('id',target_id);
      meetings := jsonb_set(meetings,array[target_id],item,true);
      target_id := target_id || ':prepare';
      prior_prepare := commitments -> target_id;
      if item ->> 'status' = 'cancelled' then
        if prior_prepare is not null then
          commitments := jsonb_set(commitments,array[target_id],prior_prepare || jsonb_build_object('status','cancelled'),true);
        end if;
      elsif item ->> 'status' in ('planned','accepted') then
        reopen_prepare := coalesce(current_meeting ->> 'status','') = 'cancelled'
          or (current_meeting is not null and (
            current_meeting ->> 'startsAt' is distinct from item ->> 'startsAt'
            or current_meeting ->> 'objective' is distinct from item ->> 'objective'
          ));
        current_item := jsonb_build_object(
          'id',target_id,'title',left('Prepare: ' || (item ->> 'title'),240),
          'due',left(item ->> 'startsAt',10),
          'definitionOfDone','Review the person, prior interactions, and questions needed to resolve: ' || (item ->> 'objective'),
          'reviewTrigger','Meeting time, purpose, or participant changes',
          'status',case when reopen_prepare then 'open' else coalesce(prior_prepare ->> 'status','open') end
        );
        commitments := jsonb_set(commitments,array[target_id],current_item,true);
      end if;

    elsif command_type = 'debrief_meeting' then
      item_id := command ->> 'meetingId';
      current_item := meetings -> item_id;
      meetings := jsonb_set(meetings,array[item_id],current_item || jsonb_build_object('status','completed'),true);
      for item in select value from jsonb_array_elements(command -> 'commitments') loop
        target_id := item ->> 'id';
        current_item := commitments -> target_id;
        item := item || jsonb_build_object('status',coalesce(current_item ->> 'status','open'));
        commitments := jsonb_set(commitments,array[target_id],item,true);
      end loop;
      target_id := item_id || ':prepare';
      if commitments -> target_id is not null then
        commitments := jsonb_set(commitments,array[target_id],commitments -> target_id || jsonb_build_object('status','done'),true);
      end if;

    elsif command_type = 'record_application_outcome' then
      target_id := (command ->> 'opportunityId') || ':application-next-step';
      item := jsonb_build_object(
        'id',target_id,'title',left(command ->> 'nextAction',240),
        'definitionOfDone',command ->> 'nextAction',
        'reviewTrigger','New employer feedback or the next preparation decision','status','open'
      );
      commitments := jsonb_set(commitments,array[target_id],item,true);

    elsif command_type = 'record_interview' then
      target_id := (command #>> '{interview,id}') || ':prepare-next';
      item := jsonb_build_object(
        'id',target_id,'title',left(command #>> '{interview,nextPreparation}',240),
        'definitionOfDone',command #>> '{interview,nextPreparation}',
        'reviewTrigger','Before the next interview round','status','open'
      );
      commitments := jsonb_set(commitments,array[target_id],item,true);

    elsif command_type = 'accept_offer' then
      if chapter is not null then chapter := chapter || jsonb_build_object('phase','transitioning'); end if;
      for item in select value from jsonb_array_elements(command -> 'checkpoints') loop
        target_id := item ->> 'id';
        current_item := commitments -> target_id;
        item := jsonb_build_object(
          'id',target_id,'title',item ->> 'title',
          'due',to_char((command ->> 'startDate')::date + (item ->> 'day')::integer,'YYYY-MM-DD'),
          'definitionOfDone',item ->> 'successEvidence',
          'reviewTrigger','First ' || (item ->> 'day') || ' days: revisit with your manager',
          'status',coalesce(current_item ->> 'status','open')
        );
        commitments := jsonb_set(commitments,array[target_id],item,true);
      end loop;

    elsif command_type = 'close_chapter' and chapter is not null then
      chapter := chapter || jsonb_build_object('phase','professional_work');
    end if;
  end loop;

  if chapter is null then
    raise exception 'sotf_v1:transition_not_started' using errcode = '22023';
  end if;

  select count(*) into section_count from jsonb_array_elements(criteria);
  if section_count > 20 or exists (
    select 1 from jsonb_array_elements(criteria) as row where char_length(row ->> 'desired') > 500
  ) then truncated := array_append(truncated,'criteria'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',row ->> 'id','label',row ->> 'label','dimension',row ->> 'dimension',
    'desired',left(row ->> 'desired',500),'non_negotiable',row -> 'nonNegotiable',
    'importance',row -> 'importance','confirmed',true
  ) order by (row ->> 'importance')::integer desc,row ->> 'id'),'[]'::jsonb)
    into criteria_rows from (
      select value as row
      from jsonb_array_elements(criteria)
      order by (value ->> 'importance')::integer desc,value ->> 'id'
      limit 20
    ) as source;

  select count(*) into section_count from jsonb_each(opportunities) as entry
    where entry.value ->> 'status' not in ('decline','pause')
      and nullif(entry.value ->> 'deadline','') is not null
      and (entry.value ->> 'deadline')::date < end_date;
  if section_count > 10 or exists (
    select 1 from jsonb_each(opportunities) as entry
    where entry.value ->> 'status' not in ('decline','pause')
      and nullif(entry.value ->> 'deadline','') is not null
      and (entry.value ->> 'deadline')::date < end_date
      and char_length(entry.value #>> '{decision,nextAction}') > 500
  ) then truncated := array_append(truncated,'opportunities'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'deadline',row ->> 'id'),'[]'::jsonb) into opportunity_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','company',entry.value ->> 'company','role',entry.value ->> 'role',
      'status',entry.value ->> 'status','deadline',entry.value -> 'deadline',
      'next_action',case when nullif(entry.value #>> '{decision,nextAction}','') is null then null else left(entry.value #>> '{decision,nextAction}',500) end
    ) as row
    from jsonb_each(opportunities) as entry
    where entry.value ->> 'status' not in ('decline','pause')
      and nullif(entry.value ->> 'deadline','') is not null
      and (entry.value ->> 'deadline')::date < end_date
    order by entry.value ->> 'deadline',entry.value ->> 'id' limit 10) as source;

  select count(*) into section_count from jsonb_each(commitments) as entry
    where entry.value ->> 'status' in ('open','blocked')
      and nullif(entry.value ->> 'due','') is not null
      and (entry.value ->> 'due')::date < end_date;
  if section_count > 10 or exists (
    select 1 from jsonb_each(commitments) as entry
    where entry.value ->> 'status' in ('open','blocked')
      and nullif(entry.value ->> 'due','') is not null
      and (entry.value ->> 'due')::date < end_date
      and (char_length(entry.value ->> 'definitionOfDone') > 500 or char_length(entry.value ->> 'reviewTrigger') > 500)
  ) then truncated := array_append(truncated,'commitments'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'due',row ->> 'id'),'[]'::jsonb) into commitment_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','title',entry.value ->> 'title','due',entry.value -> 'due',
      'status',entry.value ->> 'status','definition_of_done',left(entry.value ->> 'definitionOfDone',500),
      'review_trigger',left(entry.value ->> 'reviewTrigger',500)
    ) as row
    from jsonb_each(commitments) as entry
    where entry.value ->> 'status' in ('open','blocked')
      and nullif(entry.value ->> 'due','') is not null
      and (entry.value ->> 'due')::date < end_date
    order by entry.value ->> 'due',entry.value ->> 'id' limit 10) as source;

  select count(*) into section_count from jsonb_each(meetings) as entry
    where entry.value ->> 'status' in ('planned','accepted')
      and (entry.value ->> 'startsAt')::timestamptz < window_end
      and (entry.value ->> 'endsAt')::timestamptz > window_start;
  if section_count > 10 or exists (
    select 1 from jsonb_each(meetings) as entry
    where entry.value ->> 'status' in ('planned','accepted')
      and (entry.value ->> 'startsAt')::timestamptz < window_end
      and (entry.value ->> 'endsAt')::timestamptz > window_start
      and char_length(entry.value ->> 'objective') > 500
  ) then truncated := array_append(truncated,'meetings'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'starts_at',row ->> 'id'),'[]'::jsonb) into meeting_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','title',entry.value ->> 'title','starts_at',entry.value ->> 'startsAt',
      'ends_at',entry.value ->> 'endsAt','status',entry.value ->> 'status',
      'objective',left(entry.value ->> 'objective',500)
    ) as row
    from jsonb_each(meetings) as entry
    where entry.value ->> 'status' in ('planned','accepted')
      and (entry.value ->> 'startsAt')::timestamptz < window_end
      and (entry.value ->> 'endsAt')::timestamptz > window_start
    order by entry.value ->> 'startsAt',entry.value ->> 'id' limit 10) as source;

  select count(*) into section_count from jsonb_each(hypotheses) as entry
    where entry.value ->> 'status' in ('continue','refine');
  if section_count > 3 or exists (
    select 1 from jsonb_each(hypotheses) as entry
    where entry.value ->> 'status' in ('continue','refine')
      and (char_length(entry.value ->> 'nextExperiment') > 500 or char_length(entry.value ->> 'reviewTrigger') > 500)
  ) then truncated := array_append(truncated,'hypotheses'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'id'),'[]'::jsonb) into hypothesis_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','proposition',entry.value ->> 'proposition',
      'next_experiment',left(entry.value ->> 'nextExperiment',500),
      'review_trigger',left(entry.value ->> 'reviewTrigger',500),
      'status',entry.value ->> 'status','epistemic_status','provisional'
    ) as row
    from jsonb_each(hypotheses) as entry
    where entry.value ->> 'status' in ('continue','refine')
    order by entry.value ->> 'id' limit 3) as source;

  if char_length(chapter ->> 'question') > 500 then truncated := array_append(truncated,'chapter'); end if;

  select coalesce(jsonb_agg(receipt order by recorded_at desc,id desc),'[]'::jsonb) into recent_outcomes
  from (
    select outcome_row.id,outcome_row.recorded_at,
      workspace_private.sotf_v1_outcome_receipt(outcome_row) as receipt
    from workspace_private.sotf_daily_brief_outcomes as outcome_row
    where outcome_row.workspace_id=target_workspace and outcome_row.user_id=auth.uid()
      and outcome_row.workflow_id='transition.daily_brief' and outcome_row.workflow_version='1.0.0'
    order by outcome_row.recorded_at desc,outcome_row.id desc limit 3
  ) as rows;

  select coalesce(jsonb_agg(value order by rank,sort_key),'[]'::jsonb) into suggestions
  from (
    select jsonb_build_object('source_ref',jsonb_build_object('entity_type','commitment','entity_id',row ->> 'id'),
      'reason_code',case when (row ->> 'due')::date < target_brief_date then 'overdue' else 'due_soon' end,
      'epistemic_status','derived') value,
      case when (row ->> 'due')::date < target_brief_date then 0 else 3 end rank,(row ->> 'due') || ':' || (row ->> 'id') sort_key
    from jsonb_array_elements(commitment_rows) as row
    union all select jsonb_build_object('source_ref',jsonb_build_object('entity_type','meeting','entity_id',row ->> 'id'),'reason_code','meeting_soon','epistemic_status','derived'),1,(row ->> 'starts_at') || ':' || (row ->> 'id') from jsonb_array_elements(meeting_rows) as row
    union all select jsonb_build_object('source_ref',jsonb_build_object('entity_type','opportunity','entity_id',row ->> 'id'),'reason_code','deadline_soon','epistemic_status','derived'),2,(row ->> 'deadline') || ':' || (row ->> 'id') from jsonb_array_elements(opportunity_rows) as row
    union all select jsonb_build_object('source_ref',jsonb_build_object('entity_type','hypothesis','entity_id',row ->> 'id'),'reason_code','learning_step','epistemic_status','derived'),4,'9999:' || (row ->> 'id') from jsonb_array_elements(hypothesis_rows) as row
    order by rank,sort_key limit 3
  ) as ranked;

  projection := jsonb_build_object(
    'projection_version','1','workspace_id',target_workspace,'workflow_id','transition.daily_brief','workflow_version','1.0.0',
    'state_revision',current_revision,'as_of',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'brief_date',to_char(target_brief_date,'YYYY-MM-DD'),'time_zone',target_time_zone,
    'window_start',to_char(window_start at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'window_end',to_char(window_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'chapter',jsonb_build_object('question',left(chapter ->> 'question',500),'phase',chapter ->> 'phase','weekly_hours',chapter -> 'weeklyHours'),
    'criteria',criteria_rows,'opportunities',opportunity_rows,'commitments',commitment_rows,
    'meetings',meeting_rows,'hypotheses',hypothesis_rows,'suggestions',suggestions,'recent_outcomes',recent_outcomes,
    'truncated_sections','[]'::jsonb,
    'omitted_counts',jsonb_build_object(
      'criteria',greatest(jsonb_array_length(criteria)-20,0),
      'opportunities',greatest((select count(*) from jsonb_each(opportunities) e where e.value ->> 'status' not in ('decline','pause') and nullif(e.value ->> 'deadline','') is not null and (e.value ->> 'deadline')::date < end_date)-10,0),
      'commitments',greatest((select count(*) from jsonb_each(commitments) e where e.value ->> 'status' in ('open','blocked') and nullif(e.value ->> 'due','') is not null and (e.value ->> 'due')::date < end_date)-10,0),
      'meetings',greatest((select count(*) from jsonb_each(meetings) e where e.value ->> 'status' in ('planned','accepted') and (e.value ->> 'startsAt')::timestamptz < window_end and (e.value ->> 'endsAt')::timestamptz > window_start)-10,0),
      'hypotheses',greatest((select count(*) from jsonb_each(hypotheses) e where e.value ->> 'status' in ('continue','refine'))-3,0),
      'recent_outcomes',0
    )
  );

  foreach section in array array['recent_outcomes','hypotheses','meetings','commitments','opportunities','criteria'] loop
    while octet_length(workspace_private.sotf_v1_compact_json(projection)) > 65536
      and jsonb_array_length(projection -> section) > 0
    loop
      projection := projection #- array[section,(jsonb_array_length(projection -> section)-1)::text];
      projection := jsonb_set(projection,array['omitted_counts',section],
        to_jsonb((projection #>> array['omitted_counts',section])::integer+1));
      if not section = any(truncated) then truncated := array_append(truncated,section); end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(value order by value ->> 'source_ref'),'[]'::jsonb) into suggestions
  from jsonb_array_elements(projection -> 'suggestions') as candidate
  where exists (
    select 1 from (
      select 'criterion' kind,value ->> 'id' id from jsonb_array_elements(projection -> 'criteria')
      union all select 'opportunity',value ->> 'id' from jsonb_array_elements(projection -> 'opportunities')
      union all select 'commitment',value ->> 'id' from jsonb_array_elements(projection -> 'commitments')
      union all select 'meeting',value ->> 'id' from jsonb_array_elements(projection -> 'meetings')
      union all select 'hypothesis',value ->> 'id' from jsonb_array_elements(projection -> 'hypotheses')
    ) available
    where available.kind=candidate.value #>> '{source_ref,entity_type}' and available.id=candidate.value #>> '{source_ref,entity_id}'
  );
  projection := jsonb_set(projection,array['suggestions'],suggestions);
  if octet_length(workspace_private.sotf_v1_compact_json(projection)) > 65536 then
    raise exception 'sotf_v1:invalid_input' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('entity_type',kind,'entity_id',id) order by kind,id),'[]'::jsonb)
    into eligible_refs from (
      select 'criterion' kind,value ->> 'id' id from jsonb_array_elements(projection -> 'criteria')
      union all select 'opportunity',value ->> 'id' from jsonb_array_elements(projection -> 'opportunities')
      union all select 'commitment',value ->> 'id' from jsonb_array_elements(projection -> 'commitments')
      union all select 'meeting',value ->> 'id' from jsonb_array_elements(projection -> 'meetings')
      union all select 'hypothesis',value ->> 'id' from jsonb_array_elements(projection -> 'hypotheses')
    ) rows;
  return jsonb_build_object(
    'truncated_sections',to_jsonb((select coalesce(array_agg(distinct name order by name),'{}'::text[]) from unnest(truncated) name)),
    'eligible_refs',eligible_refs
  );
end; $$;

create function workspace_private.validate_sotf_v1_daily_brief_projection_semantics(
  outcome jsonb,
  target_workspace uuid
)
returns void language plpgsql stable security definer set search_path = '' as $$
declare semantics jsonb;
declare reference jsonb;
begin
  semantics := workspace_private.sotf_v1_daily_brief_projection_semantics(
    target_workspace,(outcome ->> 'brief_date')::date,outcome ->> 'time_zone'
  );
  if (jsonb_array_length(semantics -> 'truncated_sections') > 0)
    is distinct from (outcome -> 'degradation_reasons' ? 'state_truncated')
  then raise exception 'sotf_v1:invalid_input' using errcode='22023'; end if;
  for reference in select value from jsonb_array_elements(outcome -> 'selected_le_refs') loop
    if not semantics -> 'eligible_refs' @> jsonb_build_array(reference) then
      raise exception 'sotf_v1:invalid_input' using errcode='22023';
    end if;
  end loop;
end; $$;

create or replace function workspace.sotf_v1_probe_daily_brief_outcome(outcome jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_sotf_v1_access();
  existing workspace_private.sotf_daily_brief_outcomes%rowtype;
  match_count integer;
begin
  perform workspace_private.validate_sotf_v1_daily_brief_outcome(outcome);
  select count(*) into match_count from workspace_private.sotf_daily_brief_outcomes
  where workspace_id=target_workspace and user_id=auth.uid() and workflow_id='transition.daily_brief'
    and (request_id=(outcome ->> 'request_id')::uuid or run_id=(outcome ->> 'run_id')::uuid);
  if match_count > 1 then return jsonb_build_object('state','conflict'); end if;
  if match_count = 1 then
    select * into existing from workspace_private.sotf_daily_brief_outcomes
    where workspace_id=target_workspace and user_id=auth.uid() and workflow_id='transition.daily_brief'
      and (request_id=(outcome ->> 'request_id')::uuid or run_id=(outcome ->> 'run_id')::uuid) limit 1;
    if existing.payload <> outcome then return jsonb_build_object('state','conflict'); end if;
    return jsonb_build_object('state','replay','receipt',workspace_private.sotf_v1_outcome_receipt(existing));
  end if;
  perform workspace_private.validate_sotf_v1_daily_brief_projection_semantics(outcome,target_workspace);
  return jsonb_build_object('state','new');
end; $$;

create or replace function workspace.sotf_v1_record_daily_brief_outcome(outcome jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid;
  head workspace_private.sotf_operation_heads%rowtype;
  existing workspace_private.sotf_daily_brief_outcomes%rowtype;
  inserted workspace_private.sotf_daily_brief_outcomes%rowtype;
  match_count integer;
  local_today date;
begin
  target_workspace := workspace_private.require_sotf_v1_access();
  perform workspace_private.lock_sotf_v1_authority(target_workspace);
  perform workspace_private.validate_sotf_v1_daily_brief_outcome(outcome);
  select * into head from workspace_private.sotf_operation_heads where workspace_id=target_workspace for update;
  if head.workspace_id is null then raise exception 'sotf_v1:transition_not_started' using errcode='22023'; end if;
  select count(*) into match_count from workspace_private.sotf_daily_brief_outcomes
  where workspace_id=target_workspace and user_id=auth.uid() and workflow_id='transition.daily_brief'
    and (request_id=(outcome ->> 'request_id')::uuid or run_id=(outcome ->> 'run_id')::uuid);
  if match_count > 1 then raise exception 'sotf_v1:idempotency_conflict' using errcode='22023'; end if;
  if match_count = 1 then
    select * into existing from workspace_private.sotf_daily_brief_outcomes
    where workspace_id=target_workspace and user_id=auth.uid() and workflow_id='transition.daily_brief'
      and (request_id=(outcome ->> 'request_id')::uuid or run_id=(outcome ->> 'run_id')::uuid) limit 1;
    if existing.payload <> outcome then raise exception 'sotf_v1:idempotency_conflict' using errcode='22023'; end if;
    return jsonb_build_object('saved',true,'replayed',true,'receipt',workspace_private.sotf_v1_outcome_receipt(existing));
  end if;
  if head.revision <> (outcome ->> 'expected_state_revision')::integer then raise exception 'sotf_v1:state_changed' using errcode='40001'; end if;
  local_today := (clock_timestamp() at time zone (outcome ->> 'time_zone'))::date;
  if (outcome ->> 'brief_date')::date not in (local_today,local_today-1) then raise exception 'sotf_v1:invalid_input' using errcode='22023'; end if;
  perform workspace_private.validate_sotf_v1_daily_brief_projection_semantics(outcome,target_workspace);
  if (select count(*) from workspace_private.sotf_daily_brief_outcomes where workspace_id=target_workspace and user_id=auth.uid() and workflow_id='transition.daily_brief') >= 100
    then raise exception 'sotf_v1:capacity_reached' using errcode='54000'; end if;
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
  select * into inserted from workspace_private.sotf_daily_brief_outcomes where id=inserted.id;
  if inserted.id is null then raise exception 'sotf_v1:result_unknown' using errcode='P0001'; end if;
  return jsonb_build_object('saved',true,'replayed',false,'receipt',workspace_private.sotf_v1_outcome_receipt(inserted));
exception when unique_violation then raise exception 'sotf_v1:idempotency_conflict' using errcode='22023';
end; $$;

revoke all on function workspace_private.sotf_v1_compact_json(jsonb) from public,anon,authenticated;
revoke all on function workspace_private.sotf_v1_daily_brief_projection_semantics(uuid,date,text) from public,anon,authenticated;
revoke all on function workspace_private.validate_sotf_v1_daily_brief_projection_semantics(jsonb,uuid) from public,anon,authenticated;

comment on function workspace_private.sotf_v1_daily_brief_projection_semantics(uuid,date,text) is
  'Replays only the ordinary SOTF fields needed to derive daily-brief truncation and eligible LE references at the authenticated outcome boundary.';
