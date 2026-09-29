-- Canonical SOTF v1 decoded-text bound: UTF-16 code units, without normalization.
-- Preserve existing v1 limits; truncate only at a Unicode scalar boundary.
-- PostgreSQL UTF-8 rejects unpaired surrogates/NUL at input. Helpers are private.
create function workspace_private.sotf_v1_text_units(value text)
returns integer language sql immutable strict set search_path = '' as $$
  select coalesce(sum(case when ascii(substr(value,position,1)) > 65535 then 2 else 1 end),0)::integer
  from generate_series(1,char_length(value)) as position;
$$;

create function workspace_private.sotf_v1_text_prefix(value text, maximum integer)
returns text language plpgsql immutable strict set search_path = '' as $$
declare units integer := 0; width integer;
begin
  if maximum < 0 then raise exception 'sotf_v1:invalid_input' using errcode='22023'; end if;
  for position in 1..char_length(value) loop
    width := case when ascii(substr(value,position,1)) > 65535 then 2 else 1 end;
    if units + width > maximum then return left(value,position-1); end if;
    units := units + width;
  end loop;
  return value;
end; $$;

revoke all on function workspace_private.sotf_v1_text_units(text) from public,anon,authenticated;
revoke all on function workspace_private.sotf_v1_text_prefix(text,integer) from public,anon,authenticated;

create or replace function workspace_private.sotf_v1_daily_brief_projection_semantics(
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
        'id',target_id,'title',workspace_private.sotf_v1_text_prefix(command ->> 'nextAction',240),'due',command -> 'due',
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
          'id',target_id,'title',workspace_private.sotf_v1_text_prefix('Prepare: ' || (item ->> 'title'),240),
          'due',workspace_private.sotf_v1_text_prefix(item ->> 'startsAt',10),
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
        'id',target_id,'title',workspace_private.sotf_v1_text_prefix(command ->> 'nextAction',240),
        'definitionOfDone',command ->> 'nextAction',
        'reviewTrigger','New employer feedback or the next preparation decision','status','open'
      );
      commitments := jsonb_set(commitments,array[target_id],item,true);

    elsif command_type = 'record_interview' then
      target_id := (command #>> '{interview,id}') || ':prepare-next';
      item := jsonb_build_object(
        'id',target_id,'title',workspace_private.sotf_v1_text_prefix(command #>> '{interview,nextPreparation}',240),
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
    select 1 from jsonb_array_elements(criteria) as row where workspace_private.sotf_v1_text_units(row ->> 'desired') > 500
  ) then truncated := array_append(truncated,'criteria'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',row ->> 'id','label',row ->> 'label','dimension',row ->> 'dimension',
    'desired',workspace_private.sotf_v1_text_prefix(row ->> 'desired',500),'non_negotiable',row -> 'nonNegotiable',
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
      and workspace_private.sotf_v1_text_units(entry.value #>> '{decision,nextAction}') > 500
  ) then truncated := array_append(truncated,'opportunities'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'deadline',row ->> 'id'),'[]'::jsonb) into opportunity_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','company',entry.value ->> 'company','role',entry.value ->> 'role',
      'status',entry.value ->> 'status','deadline',entry.value -> 'deadline',
      'next_action',case when nullif(entry.value #>> '{decision,nextAction}','') is null then null else workspace_private.sotf_v1_text_prefix(entry.value #>> '{decision,nextAction}',500) end
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
      and (workspace_private.sotf_v1_text_units(entry.value ->> 'definitionOfDone') > 500 or workspace_private.sotf_v1_text_units(entry.value ->> 'reviewTrigger') > 500)
  ) then truncated := array_append(truncated,'commitments'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'due',row ->> 'id'),'[]'::jsonb) into commitment_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','title',entry.value ->> 'title','due',entry.value -> 'due',
      'status',entry.value ->> 'status','definition_of_done',workspace_private.sotf_v1_text_prefix(entry.value ->> 'definitionOfDone',500),
      'review_trigger',workspace_private.sotf_v1_text_prefix(entry.value ->> 'reviewTrigger',500)
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
      and workspace_private.sotf_v1_text_units(entry.value ->> 'objective') > 500
  ) then truncated := array_append(truncated,'meetings'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'starts_at',row ->> 'id'),'[]'::jsonb) into meeting_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','title',entry.value ->> 'title','starts_at',entry.value ->> 'startsAt',
      'ends_at',entry.value ->> 'endsAt','status',entry.value ->> 'status',
      'objective',workspace_private.sotf_v1_text_prefix(entry.value ->> 'objective',500)
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
      and (workspace_private.sotf_v1_text_units(entry.value ->> 'nextExperiment') > 500 or workspace_private.sotf_v1_text_units(entry.value ->> 'reviewTrigger') > 500)
  ) then truncated := array_append(truncated,'hypotheses'); end if;
  select coalesce(jsonb_agg(row order by row ->> 'id'),'[]'::jsonb) into hypothesis_rows
  from (select jsonb_build_object(
      'id',entry.value ->> 'id','proposition',entry.value ->> 'proposition',
      'next_experiment',workspace_private.sotf_v1_text_prefix(entry.value ->> 'nextExperiment',500),
      'review_trigger',workspace_private.sotf_v1_text_prefix(entry.value ->> 'reviewTrigger',500),
      'status',entry.value ->> 'status','epistemic_status','provisional'
    ) as row
    from jsonb_each(hypotheses) as entry
    where entry.value ->> 'status' in ('continue','refine')
    order by entry.value ->> 'id' limit 3) as source;

  if workspace_private.sotf_v1_text_units(chapter ->> 'question') > 500 then truncated := array_append(truncated,'chapter'); end if;

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
    'chapter',jsonb_build_object('question',workspace_private.sotf_v1_text_prefix(chapter ->> 'question',500),'phase',chapter ->> 'phase','weekly_hours',chapter -> 'weeklyHours'),
    'criteria',criteria_rows,'opportunities',opportunity_rows,'commitments',commitment_rows,
    'meetings',meeting_rows,'hypotheses',hypothesis_rows,'suggestions',suggestions,'recent_outcomes',recent_outcomes,
    'truncated_sections',to_jsonb((select coalesce(array_agg(distinct name order by name),'{}'::text[]) from unnest(truncated) name)),
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
      projection := jsonb_set(projection,array['truncated_sections'],
        to_jsonb((select coalesce(array_agg(distinct name order by name),'{}'::text[]) from unnest(truncated) name)));
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

create or replace function workspace_private.validate_sotf_v1_daily_brief_outcome(outcome jsonb)
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

  if jsonb_typeof(outcome -> 'schema_version') is distinct from 'string'
    or outcome ->> 'schema_version' is distinct from '1'
    or jsonb_typeof(outcome -> 'workflow_id') is distinct from 'string'
    or outcome ->> 'workflow_id' is distinct from 'transition.daily_brief'
    or jsonb_typeof(outcome -> 'workflow_version') is distinct from 'string'
    or outcome ->> 'workflow_version' is distinct from '1.0.0'
    or jsonb_typeof(outcome -> 'host') is distinct from 'string'
    or outcome ->> 'host' is distinct from 'chatgpt'
    or jsonb_typeof(outcome -> 'execution_mode') is distinct from 'string'
    or outcome ->> 'execution_mode' is distinct from 'A'
    or jsonb_typeof(outcome -> 'data_class') is distinct from 'string'
    or outcome ->> 'data_class' is distinct from 'ordinary_transition_operations'
    or outcome -> 'user_confirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(outcome -> 'status') is distinct from 'string'
    or outcome ->> 'status' not in ('completed','degraded')
    or jsonb_typeof(outcome -> 'usefulness') is distinct from 'string'
    or outcome ->> 'usefulness' not in ('useful','not_useful','not_rated')
    or jsonb_typeof(outcome -> 'request_id') is distinct from 'string'
    or outcome ->> 'request_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(outcome -> 'run_id') is distinct from 'string'
    or outcome ->> 'run_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(outcome -> 'expected_state_revision') is distinct from 'number'
    or outcome ->> 'expected_state_revision' !~ '^[0-9]{1,4}$'
    or jsonb_typeof(outcome -> 'brief_date') is distinct from 'string'
    or outcome ->> 'brief_date' !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(outcome -> 'time_zone') is distinct from 'string'
    or workspace_private.sotf_v1_text_units(outcome ->> 'time_zone') not between 1 and 80
    or not exists (select 1 from pg_timezone_names where name = outcome ->> 'time_zone')
    or jsonb_typeof(outcome -> 'priority_count') is distinct from 'number'
    or outcome ->> 'priority_count' !~ '^[0-3]$'
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  begin
    if (outcome ->> 'expected_state_revision')::integer not between 0 and 2000 then
      raise exception 'sotf_v1:invalid_input' using errcode = '22023';
    end if;
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
    or jsonb_typeof(connector -> 'calendar_read') is distinct from 'string'
    or connector ->> 'calendar_read' not in ('used','not_available','failed','not_requested')
    or jsonb_typeof(connector -> 'email_read') is distinct from 'string'
    or connector ->> 'email_read' not in ('used','not_available','failed','not_requested')
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  if jsonb_typeof(outcome -> 'degradation_reasons') is distinct from 'array'
    or jsonb_array_length(outcome -> 'degradation_reasons') > 5
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  for reason in select jsonb_array_elements_text(outcome -> 'degradation_reasons') loop
    if reason is null
      or reason not in ('calendar_unavailable','calendar_failed','email_unavailable','email_failed','state_truncated')
    then
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
      or jsonb_typeof(reference -> 'entity_type') is distinct from 'string'
      or reference ->> 'entity_type' not in ('criterion','opportunity','commitment','meeting','hypothesis')
      or jsonb_typeof(reference -> 'entity_id') is distinct from 'string'
      or workspace_private.sotf_v1_text_units(reference ->> 'entity_id') not between 1 and 100
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
    or jsonb_typeof(outcome #> '{provenance,source}') is distinct from 'string'
    or outcome #>> '{provenance,source}' is distinct from 'host_reported_user_confirmed'
    or outcome #> '{provenance,provider_content_persisted}' is distinct from 'false'::jsonb
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
end; $$;
