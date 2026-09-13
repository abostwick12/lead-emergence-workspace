begin;
select no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','85111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.precision.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('85111111-1111-4111-8111-111111111111','Synthetic SOTF timestamp precision');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF timestamp precision','85111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','85111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','85111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','85111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-timestamp-precision');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','85cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'85111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('85111111-1111-4111-8111-111111111111','85cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);

select set_config('request.jwt.claims',jsonb_build_object(
  'sub','85111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp','client_id','85cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
select set_config('request.precision_day',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),true);

-- Build the startsAt strings explicitly because timestamp text is stored as JSON,
-- while PostgreSQL alone casts the authority-sensitive values to timestamptz.
create function pg_temp.append_precision_meeting_exact(
  request_id uuid,
  expected_revision integer,
  meeting_id text,
  meeting_end text
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare payload jsonb;
begin
  payload := jsonb_build_object(
    'requestId',request_id,'expectedRevision',expected_revision,
    'userConfirmed',true,'dataClass','ordinary_transition_operations',
    'command',jsonb_build_object(
      'type','record_meeting',
      'meeting',jsonb_build_object(
        'id',meeting_id,'title','Precision ' || meeting_id,'hypothesisIds','[]'::jsonb,
        'kind','networking',
        'startsAt',to_char((current_setting('request.precision_day')::date::timestamp - interval '1 minute') at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'endsAt',meeting_end,
        'status','accepted','provider','manual','objective','Exercise native PostgreSQL timestamp precision'
      )
    )
  );
  return workspace.sotf_append_operation(payload);
end; $$;

create function pg_temp.precision_authority()
returns jsonb language sql volatile security definer set search_path='' as $$
  select workspace.sotf_v1_get_daily_brief_authority(
    'transition.daily_brief','1.0.0',current_setting('request.precision_day'),'UTC'
  );
$$;
create function pg_temp.precision_outcome_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from workspace_private.sotf_daily_brief_outcomes
  where workspace_id='85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$$;
create function pg_temp.raw_end(meeting_id text)
returns text language sql stable security definer set search_path='' as $$
  select envelope #>> '{command,meeting,endsAt}'
  from workspace_private.sotf_operation_events
  where workspace_id='85aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and envelope #>> '{command,meeting,id}'=meeting_id;
$$;

set local role authenticated;

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','85000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic',
    'question','Which timestamp authority is exact?','weeklyHours',8,'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','precision fixture starts at revision one');

select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000010',1,'fraction-before',
  to_char((current_setting('request.precision_day')::date::timestamp - interval '0.000001 seconds') at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))->>'revision','2','just-before-boundary timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000011',2,'fraction-000000',
  current_setting('request.precision_day') || 'T00:00:00.000000Z')->>'revision','3','.000000Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000012',3,'fraction-000001',
  current_setting('request.precision_day') || 'T00:00:00.000001Z')->>'revision','4','.000001Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000013',4,'fraction-000499',
  current_setting('request.precision_day') || 'T00:00:00.000499Z')->>'revision','5','.000499Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000014',5,'fraction-000500',
  current_setting('request.precision_day') || 'T00:00:00.000500Z')->>'revision','6','.000500Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000015',6,'fraction-000999',
  current_setting('request.precision_day') || 'T00:00:00.000999Z')->>'revision','7','.000999Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000016',7,'fraction-001000',
  current_setting('request.precision_day') || 'T00:00:00.001000Z')->>'revision','8','.001000Z timestamp is stored');
select is(pg_temp.append_precision_meeting_exact('85000000-0000-4000-8000-000000000017',8,'fraction-001001',
  current_setting('request.precision_day') || 'T00:00:00.001001Z')->>'revision','9','.001001Z timestamp is stored');

select ok(not (pg_temp.precision_authority() -> 'eligible_refs' @>
  '[{"entity_type":"meeting","entity_id":"fraction-before"}]'::jsonb),
  'meeting ending one microsecond before midnight is ineligible');
select ok(not (pg_temp.precision_authority() -> 'eligible_refs' @>
  '[{"entity_type":"meeting","entity_id":"fraction-000000"}]'::jsonb),
  'meeting ending exactly at midnight is ineligible');
select ok(pg_temp.precision_authority() -> 'eligible_refs' @>
  jsonb_build_array(jsonb_build_object('entity_type','meeting','entity_id',meeting_id)),
  meeting_id || ' remains eligible at PostgreSQL microsecond precision')
from unnest(array[
  'fraction-000001','fraction-000499','fraction-000500',
  'fraction-000999','fraction-001000','fraction-001001'
]) meeting_id;

select is(pg_temp.raw_end('fraction-' || fraction),
  current_setting('request.precision_day') || 'T00:00:00.' || fraction || 'Z',
  '.' || fraction || 'Z remains exact in the PostgreSQL JSON event')
from unnest(array['000000','000001','000499','000500','000999','001000','001001']) fraction;

select is(
  to_char(pg_temp.raw_end('fraction-' || fraction)::timestamptz at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  current_setting('request.precision_day') || 'T00:00:00.' || fraction || 'Z',
  '.' || fraction || 'Z casts without precision loss in PostgreSQL')
from unnest(array['000000','000001','000499','000500','000999','001000','001001']) fraction;

select ok(
  ('2026-03-08 00:00:00.000001'::timestamp at time zone 'America/Chicago')
    > ('2026-03-08'::timestamp at time zone 'America/Chicago'),
  'spring-forward day preserves one-microsecond ordering after local midnight');
select ok(
  ('2026-11-01 00:00:00.000001'::timestamp at time zone 'America/Chicago')
    > ('2026-11-01'::timestamp at time zone 'America/Chicago'),
  'fall-back day preserves one-microsecond ordering after local midnight');
select ok(
  ('2026-10-04 00:00:00.000001'::timestamp at time zone 'Australia/Lord_Howe')
    > ('2026-10-04'::timestamp at time zone 'Australia/Lord_Howe'),
  'half-hour DST zone preserves one-microsecond ordering after local midnight');
select ok(
  ('2026-09-27 00:00:00.000001'::timestamp at time zone 'Pacific/Chatham')
    > ('2026-09-27'::timestamp at time zone 'Pacific/Chatham'),
  'quarter-hour DST zone preserves one-microsecond ordering after local midnight');

select set_config('request.precision_authority',pg_temp.precision_authority()::text,true);
select set_config('request.precision_outcome',jsonb_build_object(
  'schema_version','1','request_id','85000000-0000-4000-8000-000000000090',
  'run_id','85000000-0000-4000-8000-000000000091','workflow_id','transition.daily_brief',
  'workflow_version','1.0.0','expected_state_revision',9,
  'brief_date',current_setting('request.precision_day'),'time_zone','UTC',
  'host','chatgpt','execution_mode','A','data_class','ordinary_transition_operations',
  'user_confirmed',true,'status','degraded',
  'connector_results',jsonb_build_object('calendar_read','not_requested','email_read','not_requested'),
  'degradation_reasons','[]'::jsonb,
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','meeting','entity_id','fraction-000500')),
  'priority_count',1,'usefulness','not_rated',
  'provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);

select is(workspace.sotf_v1_record_daily_brief_outcome(
  current_setting('request.precision_outcome')::jsonb,
  current_setting('request.precision_authority')::jsonb ->> 'authority_token'
)->>'replayed','false','.000500Z database-authorized reference persists once');
select is(pg_temp.precision_outcome_count(),1,'precision outcome count is exactly one');
select is(workspace.sotf_v1_record_daily_brief_outcome(
  current_setting('request.precision_outcome')::jsonb,
  current_setting('request.precision_authority')::jsonb ->> 'authority_token'
)->>'replayed','true','exact .000500Z retry returns the original receipt');
select is(pg_temp.precision_outcome_count(),1,'precision retry does not duplicate persistence');

select throws_ok(format(
  'select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb,%L)',
  (current_setting('request.precision_outcome')::jsonb || jsonb_build_object(
    'request_id','85000000-0000-4000-8000-000000000092',
    'run_id','85000000-0000-4000-8000-000000000093',
    'selected_le_refs',jsonb_build_array(jsonb_build_object(
      'entity_type','meeting','entity_id','fraction-000000'
    ))
  ))::text,
  current_setting('request.precision_authority')::jsonb ->> 'authority_token'
), '22023','sotf_v1:invalid_input','exact-boundary reference remains unauthorized');
select is(pg_temp.precision_outcome_count(),1,'unauthorized exact-boundary reference has no partial persistence');

select * from finish();
rollback;
