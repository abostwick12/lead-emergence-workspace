begin;
select no_plan();

-- One synthetic tenant exercises the authenticated authority boundary. Every
-- row and setting change is transaction-local and rolls back with this file.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','75111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.semantic.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('75111111-1111-4111-8111-111111111111','Synthetic SOTF semantic parity');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF semantic parity','75111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','75111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-semantic-parity');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'75111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '75111111-1111-4111-8111-111111111111','75cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';

-- A denial is valid only when the call cannot claim success and every SOTF
-- durable surface remains byte-for-byte/count-for-count unchanged.
create function pg_temp.assert_sotf_v1_semantic_denied(
  candidate jsonb, expected_state text, description text
) returns text language plpgsql security definer set search_path = 'extensions' as $$
declare
  response jsonb;
  authority_token text;
  before_state jsonb;
  after_state jsonb;
  caught_state text;
  caught_message text;
begin
  select jsonb_build_object(
    'outcomes',(select count(*) from workspace_private.sotf_daily_brief_outcomes),
    'events',(select count(*) from workspace_private.sotf_operation_events),
    'heads',(select coalesce(jsonb_agg(to_jsonb(item) order by workspace_id),'[]'::jsonb) from workspace_private.sotf_operation_heads item),
    'audits',(select count(*) from workspace_private.sotf_workflow_access_audit),
    'entitlements',(select count(*) from workspace.bundle_entitlements),
    'authorizations',(select count(*) from workspace.mcp_authorizations),
    'resource_grants',(select count(*) from workspace_private.mcp_oauth_resource_grants)
  ) into before_state;

  authority_token := workspace.sotf_v1_get_daily_brief_authority(
    candidate ->> 'workflow_id',candidate ->> 'workflow_version',candidate ->> 'brief_date',candidate ->> 'time_zone'
  ) ->> 'authority_token';

  begin
    response := workspace.sotf_v1_record_daily_brief_outcome(candidate,authority_token);
  exception when others then
    caught_state := sqlstate;
    caught_message := sqlerrm;
  end;

  select jsonb_build_object(
    'outcomes',(select count(*) from workspace_private.sotf_daily_brief_outcomes),
    'events',(select count(*) from workspace_private.sotf_operation_events),
    'heads',(select coalesce(jsonb_agg(to_jsonb(item) order by workspace_id),'[]'::jsonb) from workspace_private.sotf_operation_heads item),
    'audits',(select count(*) from workspace_private.sotf_workflow_access_audit),
    'entitlements',(select count(*) from workspace.bundle_entitlements),
    'authorizations',(select count(*) from workspace.mcp_authorizations),
    'resource_grants',(select count(*) from workspace_private.mcp_oauth_resource_grants)
  ) into after_state;

  return extensions.ok(
    caught_state = expected_state
      and caught_message in ('sotf_v1:invalid_input','sotf_v1:state_changed')
      and response ->> 'saved' is distinct from 'true'
      and after_state = before_state,
    description || ' is denied with no success receipt or durable side effect'
  );
end; $$;

create function pg_temp.sotf_v1_projection_semantics(target_date date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select workspace_private.sotf_v1_daily_brief_projection_semantics(
    '75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',target_date,'America/Chicago'
  );
$$;

create function pg_temp.sotf_v1_authority_token(candidate jsonb)
returns text language sql volatile security definer set search_path = '' as $$
  select workspace.sotf_v1_get_daily_brief_authority(
    candidate ->> 'workflow_id',candidate ->> 'workflow_version',candidate ->> 'brief_date',candidate ->> 'time_zone'
  ) ->> 'authority_token';
$$;

select set_config('request.sotf_semantic_claims',jsonb_build_object(
  'sub','75111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','75cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true',
  'iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_semantic_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object(
    'type','start_transition','timing','Fall','question','Which work should I test?',
    'weeklyHours',8,'criteria',jsonb_build_array(jsonb_build_object(
      'id','criterion-old','label','Decision ownership','dimension','actual_work',
      'desired','Own a meaningful decision','nonNegotiable',false,'importance',5,'confirmed',true
    )),'hypotheses','[]'::jsonb
  )
))->>'revision','1','semantic corpus starts one ordinary transition');

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000002','expectedRevision',1,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','eligible-now','title','Complete the reviewed follow-up','owner','Fellow',
    'due',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'definitionOfDone','The synthetic follow-up is complete','reviewTrigger','Before local noon'
  ))
))->>'revision','2','semantic corpus adds one currently returned commitment');

select set_config('request.sotf_semantic_outcome',jsonb_build_object(
  'schema_version','1','request_id','75000000-0000-4000-8000-000000000011',
  'run_id','75000000-0000-4000-8000-000000000012',
  'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',2,
  'brief_date',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
  'time_zone','America/Chicago','host','chatgpt','execution_mode','A',
  'data_class','ordinary_transition_operations','user_confirmed',true,'status','completed',
  'connector_results',jsonb_build_object('calendar_read','used','email_read','used'),
  'degradation_reasons','[]'::jsonb,
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','eligible-now')),
  'priority_count',1,'usefulness','not_rated',
  'provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);

select is(pg_temp.sotf_v1_projection_semantics(
  (current_setting('request.sotf_semantic_outcome')::jsonb ->> 'brief_date')::date
) -> 'truncated_sections','[]'::jsonb,'[SOTF-PARITY:C01] false plus empty is derived from the untruncated projection');
select is(workspace.sotf_v1_probe_daily_brief_outcome(current_setting('request.sotf_semantic_outcome')::jsonb)->>'state','new','[SOTF-PARITY:C01] false plus empty is accepted by the authenticated probe');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_semantic_outcome')::jsonb,pg_temp.sotf_v1_authority_token(current_setting('request.sotf_semantic_outcome')::jsonb))->>'replayed','false','[SOTF-PARITY:C01] false plus empty persists once');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_semantic_outcome')::jsonb,pg_temp.sotf_v1_authority_token(current_setting('request.sotf_semantic_outcome')::jsonb))->>'replayed','true','[SOTF-PARITY:C01] exact retry is idempotent');
select is(workspace.sotf_v1_probe_daily_brief_outcome(current_setting('request.sotf_semantic_outcome')::jsonb)->>'state','replay','[SOTF-PARITY:C05] no redundant boolean is the canonical false declaration');
select is(workspace.sotf_v1_probe_daily_brief_outcome(current_setting('request.sotf_semantic_outcome')::jsonb)->>'state','replay','[SOTF-PARITY:C06] no caller sections field is canonical because the server derives it');

-- The outcome has no caller-owned truncated_sections field. Presence/absence of
-- state_truncated is represented only by the degradation-reason enum member.
select pg_temp.assert_sotf_v1_semantic_denied(payload,'22023','[SOTF-PARITY:' || case_id || '] ' || description)
from (values
  ('C03',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,
    'status','degraded','degradation_reasons',jsonb_build_array('state_truncated')
  ),'true plus empty projection'),
  ('C07',jsonb_set(current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object('request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text),'{degradation_reasons}','null'::jsonb),'JSON-null declaration'),
  ('C08',jsonb_set(current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object('request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text),'{degradation_reasons}','"state_truncated"'::jsonb),'wrong-type declaration'),
  ('C09',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'status','degraded',
    'degradation_reasons',jsonb_build_array('state_truncated','state_truncated')
  ),'duplicate declaration'),
  ('C10',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'status','degraded',
    'degradation_reasons',jsonb_build_array('criteria')
  ),'unsupported section name used as a reason'),
  ('C11',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'status','degraded',
    'degradation_reasons',jsonb_build_array('')
  ),'empty-string declaration'),
  ('C12',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'status','degraded',
    'degradation_reasons',jsonb_build_array('   ')
  ),'whitespace-only declaration'),
  ('C13',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'status','degraded',
    'degradation_reasons',jsonb_build_array(jsonb_build_array('state_truncated'))
  ),'malformed nested declaration'),
  ('C14',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'truncated_sections','[]'::jsonb
  ),'caller-supplied empty sections field'),
  ('C15',current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'state_truncated',true
  ),'caller-supplied redundant boolean')
) as corpus(case_id,payload,description);

select throws_ok(
  format('select workspace.sotf_v1_probe_daily_brief_outcome(%L::jsonb)',(
    current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
      'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,
      'status','degraded','degradation_reasons',jsonb_build_array('state_truncated')
    )
  )::text),
  '22023','sotf_v1:invalid_input','[SOTF-PARITY:C03] direct probe also denies true plus empty projection'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000003','expectedRevision',2,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','future-commitment','title','Future synthetic work','owner','Fellow',
    'due',to_char((clock_timestamp() at time zone 'America/Chicago')::date + 30,'YYYY-MM-DD'),
    'definitionOfDone','Future work completed','reviewTrigger','At the future date'
  ))
))->>'revision','3','future reference fixture is recorded');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',3,
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','future-commitment'))
  ),'22023','[SOTF-PARITY:C16] historically present but future-filtered commitment reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000004','expectedRevision',3,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','resolve_commitment','commitmentId','eligible-now','status','done','evidence','Synthetic completion')
))->>'revision','4','eligible reference is resolved out of the projection');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',4
  ),'22023','[SOTF-PARITY:C17] historically present but resolved commitment reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000005','expectedRevision',4,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','confirm_criteria','reason','Synthetic replacement','criteria',jsonb_build_array(jsonb_build_object(
    'id','criterion-new','label','Current criterion','dimension','actual_work','desired','Current desired state',
    'nonNegotiable',false,'importance',5,'confirmed',true
  )))
))->>'revision','5','criterion replacement fixture is recorded');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',5,
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','criterion','entity_id','criterion-old'))
  ),'22023','[SOTF-PARITY:C18] historically present but replaced criterion reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000006','expectedRevision',5,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_hypothesis','hypothesis',jsonb_build_object(
    'id','direction-old','proposition','A synthetic direction','whyPromising','It is testable',
    'assumptions','[]'::jsonb,'gaps','[]'::jsonb,'nextExperiment','Run a synthetic test',
    'reviewTrigger','After the test','status','continue','confidenceExplanation','Still provisional'
  ))
))->>'revision','6','hypothesis fixture is recorded');
select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000007','expectedRevision',6,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_hypothesis','hypothesis',jsonb_build_object(
    'id','direction-old','proposition','A synthetic direction','whyPromising','It was testable',
    'assumptions','[]'::jsonb,'gaps','[]'::jsonb,'nextExperiment','No further experiment',
    'reviewTrigger','If new evidence appears','status','reject','confidenceExplanation','Synthetic rejection'
  ))
))->>'revision','7','hypothesis is filtered from the projection');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',7,
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','hypothesis','entity_id','direction-old'))
  ),'22023','[SOTF-PARITY:C19] historically present but rejected hypothesis reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000008','expectedRevision',7,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','record_opportunity','opportunity',jsonb_build_object(
    'id','paused-opportunity','company','Synthetic Company','role','Synthetic Role','description','',
    'hypothesisIds','[]'::jsonb,'requirements','[]'::jsonb,
    'deadline',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'actualWork','','decisionQuestion','Should this synthetic role continue?'
  ))
))->>'revision','8','opportunity fixture is recorded');
select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000009','expectedRevision',8,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','decide_opportunity','opportunityId','paused-opportunity','decision','pause',
    'rationale','Synthetic pause','nextAction','Wait for synthetic evidence','revisitWhen','When evidence changes')
))->>'revision','9','opportunity is paused out of the projection');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',9,
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','opportunity','entity_id','paused-opportunity'))
  ),'22023','[SOTF-PARITY:C20] historically present but paused opportunity reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000010','expectedRevision',9,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','record_meeting','meeting',jsonb_build_object(
    'id','outside-window','title','Future synthetic meeting','hypothesisIds','[]'::jsonb,'kind','networking',
    'startsAt',to_char((clock_timestamp()+interval '10 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'endsAt',to_char((clock_timestamp()+interval '10 days 1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'status','planned','provider','manual','objective','Synthetic future discussion'
  ))
))->>'revision','10','outside-window meeting fixture is recorded');
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',10,
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','meeting','entity_id','outside-window'))
  ),'22023','[SOTF-PARITY:C21] historically present but outside-window meeting reference'
);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000020','expectedRevision',10,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','long-commitment','title','Bounded semantic fixture','owner','Fellow',
    'due',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'definitionOfDone',repeat('x',501),'reviewTrigger','Review after the synthetic test'
  ))
))->>'revision','11','long commitment creates authoritative truncation');
select is(pg_temp.sotf_v1_projection_semantics(
  (current_setting('request.sotf_semantic_outcome')::jsonb ->> 'brief_date')::date
) -> 'truncated_sections','["commitments"]'::jsonb,'[SOTF-PARITY:C02] true plus non-empty sections is server-derived');

select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',11,
    'selected_le_refs','[]'::jsonb,'priority_count',0
  ),'22023','[SOTF-PARITY:C04] false plus non-empty projection'
);

select set_config('request.sotf_truncated_outcome',(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id','75000000-0000-4000-8000-000000000021','run_id','75000000-0000-4000-8000-000000000022',
    'expected_state_revision',11,'status','degraded','degradation_reasons',jsonb_build_array('state_truncated'),
    'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','long-commitment'))
  )
)::text,true);
select is(workspace.sotf_v1_probe_daily_brief_outcome(current_setting('request.sotf_truncated_outcome')::jsonb)->>'state','new','[SOTF-PARITY:C02] true plus non-empty is accepted by the authenticated probe');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_truncated_outcome')::jsonb,pg_temp.sotf_v1_authority_token(current_setting('request.sotf_truncated_outcome')::jsonb))->>'replayed','false','[SOTF-PARITY:C02] true plus non-empty persists once');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_truncated_outcome')::jsonb,pg_temp.sotf_v1_authority_token(current_setting('request.sotf_truncated_outcome')::jsonb))->>'replayed','true','[SOTF-PARITY:C02] exact retry is idempotent');

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','75000000-0000-4000-8000-000000000023','expectedRevision',11,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','resolve_commitment','commitmentId','long-commitment','status','done','evidence','Synthetic completion')
))->>'revision','12','truncated fixture is later resolved out of projection');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_truncated_outcome')::jsonb,pg_temp.sotf_v1_authority_token(current_setting('request.sotf_truncated_outcome')::jsonb))->>'replayed','true','[SOTF-PARITY:C22] exact retry remains replayable after projection changes');

select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_truncated_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',12,
    'selected_le_refs','[]'::jsonb,'priority_count',0
  ),'22023','[SOTF-PARITY:C23] stale true declaration against newly untruncated current projection'
);
select pg_temp.assert_sotf_v1_semantic_denied(
  current_setting('request.sotf_semantic_outcome')::jsonb || jsonb_build_object(
    'request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,'expected_state_revision',11,
    'selected_le_refs','[]'::jsonb,'priority_count',0
  ),'40001','[SOTF-PARITY:C24] stale revision with otherwise valid semantics'
);

reset role;
select is((select count(*) from workspace_private.sotf_daily_brief_outcomes where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),2::bigint,'only the two canonical valid outcomes persisted');
select is((select count(*) from workspace_private.sotf_operation_events where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),12::bigint,'semantic denials never appended an operation event');
select is((select revision from workspace_private.sotf_operation_heads where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),12,'semantic denials never advanced the state revision');
select is((select count(*) from workspace_private.sotf_workflow_access_audit where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0::bigint,'semantic denials never created a workflow access receipt');

select * from finish();
rollback;
