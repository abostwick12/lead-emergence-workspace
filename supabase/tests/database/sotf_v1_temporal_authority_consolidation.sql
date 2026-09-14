begin;
select no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','86111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.temporal.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('86111111-1111-4111-8111-111111111111','Synthetic SOTF temporal authority');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF temporal authority','86111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','86111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','86111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','86111111-1111-4111-8111-111111111111','promotion','synthetic-temporal-authority');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','86cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'86111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('86111111-1111-4111-8111-111111111111','86cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);

select set_config('request.jwt.claims',jsonb_build_object(
  'sub','86111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp','client_id','86cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
select set_config('request.temporal_day',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),true);

create function pg_temp.append_interval(
  request_suffix integer,
  expected_revision integer,
  meeting_id text,
  starts_at text,
  ends_at text
)
returns jsonb language sql volatile security definer set search_path='' as $$
  select workspace.sotf_append_operation(jsonb_build_object(
    'requestId',format('86000000-0000-4000-8000-%s',lpad(request_suffix::text,12,'0'))::uuid,
    'expectedRevision',expected_revision,'userConfirmed',true,
    'dataClass','ordinary_transition_operations',
    'command',jsonb_build_object('type','record_meeting','meeting',jsonb_build_object(
      'id',meeting_id,'title','Temporal ' || meeting_id,'hypothesisIds','[]'::jsonb,
      'kind','networking','startsAt',starts_at,'endsAt',ends_at,
      'status','accepted','provider','manual','objective','Exercise exact PostgreSQL interval authority'
    ))
  ));
$$;

create function pg_temp.event_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from workspace_private.sotf_operation_events
  where workspace_id='86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$$;

create function pg_temp.raw_time(meeting_id text, field_name text)
returns text language sql stable security definer set search_path='' as $$
  select envelope #>> array['command','meeting',field_name]
  from workspace_private.sotf_operation_events
  where workspace_id='86aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and envelope #>> '{command,meeting,id}'=meeting_id;
$$;

set local role authenticated;

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','86000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic',
    'question','Which runtime owns exact temporal meaning?','weeklyHours',8,
    'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','temporal authority fixture starts at revision one');

select is(pg_temp.append_interval(10,1,'u001',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000001Z')->>'revision','2','positive 1 microsecond interval persists');
select is(pg_temp.append_interval(11,2,'u002',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000002Z')->>'revision','3','positive 2 microsecond interval persists');
select is(pg_temp.append_interval(12,3,'u010',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000010Z')->>'revision','4','positive 10 microsecond interval persists');
select is(pg_temp.append_interval(13,4,'u099',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000099Z')->>'revision','5','positive 99 microsecond interval persists');
select is(pg_temp.append_interval(14,5,'u100',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000100Z')->>'revision','6','positive 100 microsecond interval persists');
select is(pg_temp.append_interval(15,6,'u499',current_setting('request.temporal_day')||'T00:00:00.000001Z',current_setting('request.temporal_day')||'T00:00:00.000500Z')->>'revision','7','positive 499 microsecond interval persists');
select is(pg_temp.append_interval(16,7,'u500',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000500Z')->>'revision','8','positive 500 microsecond interval persists');
select is(pg_temp.append_interval(17,8,'u501',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000501Z')->>'revision','9','positive 501 microsecond interval persists');
select is(pg_temp.append_interval(18,9,'u999',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.000999Z')->>'revision','10','positive 999 microsecond interval persists');
select is(pg_temp.append_interval(19,10,'u1000',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.001000Z')->>'revision','11','exactly 1 millisecond persists');
select is(pg_temp.append_interval(20,11,'u1001',current_setting('request.temporal_day')||'T00:01:00.000000Z',current_setting('request.temporal_day')||'T00:01:00.001001Z')->>'revision','12','just over 1 millisecond persists');

select throws_ok(format('select pg_temp.append_interval(30,12,%L,%L,%L)','zero',
  current_setting('request.temporal_day')||'T00:00:00.000500Z',
  current_setting('request.temporal_day')||'T00:00:00.000500Z'),
  '22023','sotf:non_positive_meeting_interval','exactly zero microseconds is rejected by PostgreSQL');
select throws_ok(format('select pg_temp.append_interval(31,12,%L,%L,%L)','negative-1',
  current_setting('request.temporal_day')||'T00:00:00.000500Z',
  current_setting('request.temporal_day')||'T00:00:00.000499Z'),
  '22023','sotf:non_positive_meeting_interval','negative 1 microsecond is rejected by PostgreSQL');
select throws_ok(format('select pg_temp.append_interval(32,12,%L,%L,%L)','negative-499',
  current_setting('request.temporal_day')||'T00:00:00.000500Z',
  current_setting('request.temporal_day')||'T00:00:00.000001Z'),
  '22023','sotf:non_positive_meeting_interval','negative 499 microseconds is rejected by PostgreSQL');
select throws_ok(format('select pg_temp.append_interval(33,12,%L,%L,%L)','too-precise',
  current_setting('request.temporal_day')||'T00:00:00.0000000Z',
  current_setting('request.temporal_day')||'T00:00:00.0000001Z'),
  '22023','sotf:invalid_temporal_operation','precision beyond PostgreSQL exact microseconds is rejected');
select is(pg_temp.event_count(),12,'all rejected intervals leave revision and event count unchanged');

select is(pg_temp.append_interval(40,12,'local-midnight','2026-09-12T23:59:59.999999-05:00','2026-09-13T00:00:00.000001-05:00')->>'revision','13','positive interval across local-midnight rollover persists');
select is(pg_temp.append_interval(41,13,'spring','2026-03-08T01:59:59.999999-06:00','2026-03-08T03:00:00.000001-05:00')->>'revision','14','positive interval across the spring-forward transition persists');
select is(pg_temp.append_interval(42,14,'fall','2026-11-01T01:59:59.999999-05:00','2026-11-01T01:00:00.000001-06:00')->>'revision','15','positive interval across the fall-back transition persists despite decreasing wall time');
select is(pg_temp.append_interval(43,15,'half-hour','2026-10-04T00:00:00.000001+10:30','2026-10-04T00:00:00.000500+10:30')->>'revision','16','positive interval in half-hour zone representation persists');
select is(pg_temp.append_interval(44,16,'quarter-hour','2026-09-27T00:00:00.000001+12:45','2026-09-27T00:00:00.000500+12:45')->>'revision','17','positive interval in quarter-hour zone representation persists');
select is(pg_temp.append_interval(45,17,'window-end',
  (current_setting('request.temporal_day')::date+1)::text||'T23:59:59.999500Z',
  (current_setting('request.temporal_day')::date+1)::text||'T23:59:59.999999Z'
)->>'revision','18','positive interval immediately before authoritative UTC window end persists');

select is(pg_temp.raw_time('u499','startsAt'),current_setting('request.temporal_day')||'T00:00:00.000001Z','exact database start remains unchanged');
select is(pg_temp.raw_time('u499','endsAt'),current_setting('request.temporal_day')||'T00:00:00.000500Z','exact database end remains unchanged');

select set_config('request.temporal_authority',workspace.sotf_v1_get_daily_brief_authority(
  'transition.daily_brief','1.0.0',current_setting('request.temporal_day'),'UTC'
)::text,true);
select matches(current_setting('request.temporal_authority')::jsonb ->> 'projection_fingerprint',
  '^sha256:[0-9a-f]{64}$','database returns a closed projection fingerprint');
select is(current_setting('request.temporal_authority')::jsonb #>> '{projection,state_revision}','18',
  'database projection carries the exact source revision');
select ok(current_setting('request.temporal_authority')::jsonb -> 'eligible_refs' @>
  '[{"entity_type":"meeting","entity_id":"u499"}]'::jsonb,
  'database marks the positive 499 microsecond meeting eligible');
select is((select value ->> 'starts_at'
  from jsonb_array_elements(current_setting('request.temporal_authority')::jsonb #> '{projection,meetings}')
  where value ->> 'id'='u499'),
  current_setting('request.temporal_day')||'T00:00:00.000001Z',
  'database projection transports an exact microsecond start without JavaScript canonicalization');
select is((select value ->> 'ends_at'
  from jsonb_array_elements(current_setting('request.temporal_authority')::jsonb #> '{projection,meetings}')
  where value ->> 'id'='u499'),
  current_setting('request.temporal_day')||'T00:00:00.000500Z',
  'database projection transports an exact microsecond end without JavaScript canonicalization');

select throws_ok($sql$select workspace.sotf_append_operation(jsonb_build_object(
  'requestId','86000000-0000-4000-8000-000000000050','expectedRevision',18,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','record_submission','submittedAt',
    to_char(clock_timestamp()+interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
))$sql$,'22023','sotf:future_submission','future submission is rejected at the database event boundary');
select is(pg_temp.event_count(),18,'future temporal rejection has no partial persistence');

select * from finish();
rollback;
