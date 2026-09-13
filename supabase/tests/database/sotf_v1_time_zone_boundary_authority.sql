begin;
select no_plan();

select is(
  to_char('2026-09-15'::timestamp at time zone 'America/Asuncion' at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  '2026-09-15T04:00:00Z',
  'PostgreSQL 15.8 with its pinned tzdata preserves the reported Asuncion boundary reproduction'
);
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_daily_brief_boundary_authority(uuid,date,text)','execute'),
  'database boundary authority implementation remains private');
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_daily_brief_utc_window(date,text)','execute'),
  'database civil-time conversion primitive remains private');
select ok(has_function_privilege('authenticated','workspace.sotf_v1_get_daily_brief_authority(text,text,text,text)','execute'),
  'authenticated MCP callers can retrieve the bounded authority result');
select ok(not has_function_privilege('anon','workspace.sotf_v1_get_daily_brief_authority(text,text,text,text)','execute'),
  'anonymous callers cannot retrieve boundary authority');
select ok(not has_function_privilege('authenticated','workspace.sotf_v1_record_daily_brief_outcome(jsonb)','execute'),
  'the legacy write overload cannot bypass application-visible authority');
select ok(has_function_privilege('authenticated','workspace.sotf_v1_record_daily_brief_outcome(jsonb,text)','execute'),
  'the authority-bound write overload is the authenticated write surface');

select is(workspace_private.sotf_v1_daily_brief_utc_window('2026-09-13','America/Asuncion') ->> 'window_end',
  '2026-09-15T04:00:00.000Z','the reusable database pathway reproduces the Asuncion authority boundary');
select is(
  (workspace_private.sotf_v1_daily_brief_utc_window('2026-03-08','America/Chicago') ->> 'window_end')::timestamptz
    - (workspace_private.sotf_v1_daily_brief_utc_window('2026-03-08','America/Chicago') ->> 'window_start')::timestamptz,
  interval '47 hours','spring-forward produces the database-authoritative shortened two-day window');
select is(
  (workspace_private.sotf_v1_daily_brief_utc_window('2026-11-01','America/Chicago') ->> 'window_end')::timestamptz
    - (workspace_private.sotf_v1_daily_brief_utc_window('2026-11-01','America/Chicago') ->> 'window_start')::timestamptz,
  interval '49 hours','fall-back produces the database-authoritative lengthened two-day window');
select is(
  ('2026-03-08 03:30'::timestamp at time zone 'America/Chicago')
    - ('2026-03-08 01:30'::timestamp at time zone 'America/Chicago'),
  interval '1 hour','PostgreSQL authority resolves the skipped local hour');
select is(
  ('2026-11-01 02:30'::timestamp at time zone 'America/Chicago')
    - ('2026-11-01 00:30'::timestamp at time zone 'America/Chicago'),
  interval '3 hours','PostgreSQL authority resolves the repeated local hour');
select is(
  (workspace_private.sotf_v1_daily_brief_utc_window('2026-06-01','UTC') ->> 'window_end')::timestamptz
    - (workspace_private.sotf_v1_daily_brief_utc_window('2026-06-01','UTC') ->> 'window_start')::timestamptz,
  interval '48 hours','ordinary UTC midnight rollover remains exactly two days');
select is(substring(workspace_private.sotf_v1_daily_brief_utc_window('2026-06-01','Pacific/Chatham') ->> 'window_start' from 15 for 2),
  '15','quarter-hour canonical zones retain database-owned minute boundaries');
select is(substring(workspace_private.sotf_v1_daily_brief_utc_window('2026-06-01','Asia/Kolkata') ->> 'window_start' from 15 for 2),
  '30','half-hour canonical zones retain database-owned minute boundaries');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','84111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.boundary.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('84111111-1111-4111-8111-111111111111','Synthetic SOTF boundary authority');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF boundary authority','84111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','84111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','84111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','84111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-boundary-authority');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','84cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'84111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '84111111-1111-4111-8111-111111111111','84cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';

create function pg_temp.boundary_outcome_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from workspace_private.sotf_daily_brief_outcomes
  where workspace_id='84aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$$;

select set_config('request.sotf_boundary_claims',jsonb_build_object(
  'sub','84111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp','client_id','84cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_boundary_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','84000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic',
    'question','Which boundary is authoritative?','weeklyHours',8,'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','boundary fixture starts one ordinary transition');

create function pg_temp.boundary_authority(target_zone text)
returns jsonb language sql volatile security definer set search_path='' as $$
  select workspace.sotf_v1_get_daily_brief_authority(
    'transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone target_zone,'YYYY-MM-DD'),target_zone
  );
$$;

select is(pg_temp.boundary_authority(zone) ->> 'time_zone',zone,
  '[SOTF-BOUNDARY:' || zone || '] exact canonical identifier survives authority retrieval')
from unnest(array[
  'America/Asuncion','America/Chicago','America/Santiago','Africa/Casablanca',
  'Australia/Lord_Howe','Pacific/Chatham','Asia/Kolkata','Europe/Kyiv','UTC'
]) zone;

select is(pg_temp.boundary_authority(zone) ->> 'window_start',
  to_char(((pg_temp.boundary_authority(zone) ->> 'brief_date')::date::timestamp at time zone zone) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  '[SOTF-BOUNDARY:' || zone || '] returned start is the PostgreSQL civil-time conversion')
from unnest(array[
  'America/Asuncion','America/Chicago','America/Santiago','Africa/Casablanca',
  'Australia/Lord_Howe','Pacific/Chatham','Asia/Kolkata','Europe/Kyiv','UTC'
]) zone;

select is(pg_temp.boundary_authority(zone) ->> 'window_end',
  to_char((((pg_temp.boundary_authority(zone) ->> 'brief_date')::date + 2)::timestamp at time zone zone) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  '[SOTF-BOUNDARY:' || zone || '] returned end is the PostgreSQL civil-time conversion')
from unnest(array[
  'America/Asuncion','America/Chicago','America/Santiago','Africa/Casablanca',
  'Australia/Lord_Howe','Pacific/Chatham','Asia/Kolkata','Europe/Kyiv','UTC'
]) zone;

select matches(pg_temp.boundary_authority(zone) ->> 'authority_token','^sha256:[0-9a-f]{64}$',
  '[SOTF-BOUNDARY:' || zone || '] authority result has a fixed-shape drift token')
from unnest(array['America/Asuncion','America/Chicago','Australia/Lord_Howe','Pacific/Chatham','Asia/Kolkata','UTC']) zone;
select is(pg_temp.boundary_authority('America/Asuncion') ->> 'authority_token',
  pg_temp.boundary_authority('America/Asuncion') ->> 'authority_token',
  'authority token is stable while local day, rules, revision, membership, and truncation are unchanged');
select is(pg_temp.boundary_authority('America/Asuncion') ->> 'authority_local_day',
  to_char(clock_timestamp() at time zone 'America/Asuncion','YYYY-MM-DD'),
  'authority local day comes from PostgreSQL rather than the application runtime');

select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),'posix/America/Chicago')$sql$,
  '22023','sotf_v1:invalid_input','posix namespace remains outside the identifier contract');
select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),' America/Chicago ')$sql$,
  '22023','sotf_v1:invalid_input','padded identifiers remain rejected');
select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),'america/chicago')$sql$,
  '22023','sotf_v1:invalid_input','case variants remain rejected');
select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),'US/Central')$sql$,
  '22023','sotf_v1:invalid_input','legacy aliases outside the contract remain rejected');
select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),'America∕Chicago')$sql$,
  '22023','sotf_v1:invalid_input','Unicode lookalikes remain rejected');

select set_config('request.sotf_asuncion_authority',pg_temp.boundary_authority('America/Asuncion')::text,true);
select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','84000000-0000-4000-8000-000000000002','expectedRevision',1,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','record_meeting','meeting',jsonb_build_object(
    'id','asuncion-boundary','title','Asuncion boundary meeting','hypothesisIds','[]'::jsonb,
    'kind','networking',
    'startsAt',to_char(((current_setting('request.sotf_asuncion_authority')::jsonb ->> 'window_end')::timestamptz - interval '45 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt',to_char(((current_setting('request.sotf_asuncion_authority')::jsonb ->> 'window_end')::timestamptz - interval '15 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status','accepted','provider','manual','objective','Exercise the database-owned end boundary'
  ))
))->>'revision','2','boundary fixture adds a meeting wholly inside the database-owned end boundary');

select set_config('request.sotf_asuncion_authority',pg_temp.boundary_authority('America/Asuncion')::text,true);
select ok(current_setting('request.sotf_asuncion_authority')::jsonb -> 'eligible_refs' @>
  '[{"entity_type":"meeting","entity_id":"asuncion-boundary"}]'::jsonb,
  'database authority marks the Asuncion boundary meeting eligible');

select set_config('request.sotf_boundary_outcome',jsonb_build_object(
  'schema_version','1','request_id','84000000-0000-4000-8000-000000000011',
  'run_id','84000000-0000-4000-8000-000000000012','workflow_id','transition.daily_brief',
  'workflow_version','1.0.0','expected_state_revision',2,
  'brief_date',current_setting('request.sotf_asuncion_authority')::jsonb ->> 'brief_date',
  'time_zone','America/Asuncion','host','chatgpt','execution_mode','A',
  'data_class','ordinary_transition_operations','user_confirmed',true,'status','degraded',
  'connector_results',jsonb_build_object('calendar_read','not_requested','email_read','not_requested'),
  'degradation_reasons','[]'::jsonb,
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','meeting','entity_id','asuncion-boundary')),
  'priority_count',1,'usefulness','not_rated',
  'provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);

select is(workspace.sotf_v1_record_daily_brief_outcome(
  current_setting('request.sotf_boundary_outcome')::jsonb,
  current_setting('request.sotf_asuncion_authority')::jsonb ->> 'authority_token'
) ->> 'replayed','false','direct authenticated RPC accepts and persists the database-eligible Asuncion reference');
select is(pg_temp.boundary_outcome_count(),1,
  'the valid boundary outcome persists exactly once');

select set_config('request.sotf_stale_authority_token',current_setting('request.sotf_asuncion_authority')::jsonb ->> 'authority_token',true);
select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','84000000-0000-4000-8000-000000000003','expectedRevision',2,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','authority-change','title','Change current authority','owner','Fellow',
    'due',current_setting('request.sotf_asuncion_authority')::jsonb ->> 'brief_date',
    'definitionOfDone','Revision changes','reviewTrigger','After the authority read'
  ))
))->>'revision','3','ordinary state changes after authority retrieval');

select throws_ok(format(
  'select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb,%L)',
  (current_setting('request.sotf_boundary_outcome')::jsonb || jsonb_build_object(
    'request_id','84000000-0000-4000-8000-000000000021','run_id','84000000-0000-4000-8000-000000000022',
    'expected_state_revision',3))::text,
  current_setting('request.sotf_stale_authority_token')
), '40001','sotf_v1:state_changed','changed revision makes the earlier authority token fail closed');
select is(pg_temp.boundary_outcome_count(),1,
  'stale authority denial has no partial persistence');

select is(workspace.sotf_v1_record_daily_brief_outcome(
  current_setting('request.sotf_boundary_outcome')::jsonb,
  current_setting('request.sotf_stale_authority_token')
) ->> 'replayed','true','an exact saved retry remains idempotent after later authority changes');
select is(pg_temp.boundary_outcome_count(),1,
  'exact replay after authority change does not duplicate persistence');

select * from finish();
rollback;
