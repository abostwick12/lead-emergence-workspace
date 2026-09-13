begin;
select no_plan();

-- TypeScript and the loopback MCP/PostgREST runner consume these exact cases.
select set_config('request.sotf_time_zone_corpus',$time_zone_corpus$[
  {"id":"TZ01","description":"canonical Chicago zone","raw":"America/Chicago","accepted":true},
  {"id":"TZ02","description":"canonical UTC special identifier","raw":"UTC","accepted":true},
  {"id":"TZ03","description":"modern Kolkata primary","raw":"Asia/Kolkata","accepted":true},
  {"id":"TZ04","description":"modern Kyiv primary","raw":"Europe/Kyiv","accepted":true},
  {"id":"TZ05","description":"modern Nuuk primary","raw":"America/Nuuk","accepted":true},
  {"id":"TZ06","description":"modern Asmara primary","raw":"Africa/Asmara","accepted":true},
  {"id":"TZ07","description":"modern Chuuk primary","raw":"Pacific/Chuuk","accepted":true},
  {"id":"TZ08","description":"modern Kanton primary","raw":"Pacific/Kanton","accepted":true},
  {"id":"TZ09","description":"hierarchical Argentina primary","raw":"America/Argentina/Buenos_Aires","accepted":true},
  {"id":"TZ10","description":"half-hour DST primary","raw":"Australia/Lord_Howe","accepted":true},
  {"id":"TZ11","description":"reported PostgreSQL posix namespace","raw":"posix/America/Chicago","accepted":false},
  {"id":"TZ12","description":"US legacy link","raw":"US/Central","accepted":false},
  {"id":"TZ13","description":"POSIX rule identifier","raw":"CST6CDT","accepted":false},
  {"id":"TZ14","description":"Etc UTC link","raw":"Etc/UTC","accepted":false},
  {"id":"TZ15","description":"GMT link","raw":"GMT","accepted":false},
  {"id":"TZ16","description":"GMT0 link","raw":"GMT0","accepted":false},
  {"id":"TZ17","description":"Greenwich link","raw":"Greenwich","accepted":false},
  {"id":"TZ18","description":"UCT link","raw":"UCT","accepted":false},
  {"id":"TZ19","description":"Universal link","raw":"Universal","accepted":false},
  {"id":"TZ20","description":"Zulu link","raw":"Zulu","accepted":false},
  {"id":"TZ21","description":"superseded Calcutta link","raw":"Asia/Calcutta","accepted":false},
  {"id":"TZ22","description":"superseded Kiev link","raw":"Europe/Kiev","accepted":false},
  {"id":"TZ23","description":"superseded Godthab link","raw":"America/Godthab","accepted":false},
  {"id":"TZ24","description":"superseded Asmera link","raw":"Africa/Asmera","accepted":false},
  {"id":"TZ25","description":"superseded Truk link","raw":"Pacific/Truk","accepted":false},
  {"id":"TZ26","description":"superseded Enderbury link","raw":"Pacific/Enderbury","accepted":false},
  {"id":"TZ27","description":"flattened Argentina link","raw":"America/Buenos_Aires","accepted":false},
  {"id":"TZ28","description":"flattened Indiana link","raw":"America/Indianapolis","accepted":false},
  {"id":"TZ29","description":"case-altered identifier","raw":"america/chicago","accepted":false},
  {"id":"TZ30","description":"padded identifier","raw":" America/Chicago ","accepted":false},
  {"id":"TZ31","description":"leading slash","raw":"/America/Chicago","accepted":false},
  {"id":"TZ32","description":"empty path component","raw":"America//Chicago","accepted":false},
  {"id":"TZ33","description":"Unicode division-slash lookalike","raw":"America∕Chicago","accepted":false},
  {"id":"TZ34","description":"Pacific POSIX rule identifier","raw":"PST8PDT","accepted":false},
  {"id":"TZ35","description":"tzdb Factory entry","raw":"Factory","accepted":false},
  {"id":"TZ36","description":"empty string","raw":"","accepted":false},
  {"id":"TZ37","description":"numeric offset","raw":"+05:30","accepted":false},
  {"id":"TZ38","description":"right namespace","raw":"right/America/Chicago","accepted":false},
  {"id":"TZ39","description":"localtime implementation entry","raw":"localtime","accepted":false},
  {"id":"TZ40","description":"posixrules implementation entry","raw":"posixrules","accepted":false},
  {"id":"TZ41","description":"fixed-offset Etc zone","raw":"Etc/GMT+6","accepted":false},
  {"id":"TZ42","description":"Canada legacy link","raw":"Canada/Central","accepted":false},
  {"id":"TZ43","description":"IANA primary unavailable in pinned PostgreSQL","raw":"America/Coyhaique","accepted":false}
]$time_zone_corpus$,true);

select is(
  workspace_private.sotf_v1_time_zone_is_canonical(item ->> 'raw'),
  (item ->> 'accepted')::boolean,
  '[SOTF-TIME-ZONE:' || (item ->> 'id') || '] exact canonical membership: ' || (item ->> 'description')
)
from jsonb_array_elements(current_setting('request.sotf_time_zone_corpus')::jsonb) item;

select is(
  (select count(*)::integer from workspace_private.sotf_v1_canonical_time_zones),
  418,
  'canonical SOTF v1 time-zone set has exactly 418 identifiers'
);
select is(
  (select count(*)::integer
   from workspace_private.sotf_v1_canonical_time_zones zone
   where not exists (select 1 from pg_catalog.pg_timezone_names supported where supported.name = zone.name)),
  0,
  'every canonical SOTF v1 identifier is executable by PostgreSQL'
);
select ok(not has_table_privilege('authenticated','workspace_private.sotf_v1_canonical_time_zones','select'),
  'canonical time-zone table is private');
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_time_zone_is_canonical(text)','execute'),
  'canonical time-zone predicate is private');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','82111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.time-zone.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('82111111-1111-4111-8111-111111111111','Synthetic SOTF time-zone parity');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF time-zone parity','82111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','82111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','82111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','82111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-time-zone-parity');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','82cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'82111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '82111111-1111-4111-8111-111111111111','82cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';

create function pg_temp.time_zone_snapshot()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'outcomes',(select coalesce(jsonb_agg(to_jsonb(row) order by id),'[]'::jsonb)
      from workspace_private.sotf_daily_brief_outcomes row),
    'events',(select coalesce(jsonb_agg(to_jsonb(row) order by workspace_id,revision),'[]'::jsonb)
      from workspace_private.sotf_operation_events row),
    'heads',(select coalesce(jsonb_agg(to_jsonb(row) order by workspace_id),'[]'::jsonb)
      from workspace_private.sotf_operation_heads row),
    'audits',(select coalesce(jsonb_agg(to_jsonb(row) order by id),'[]'::jsonb)
      from workspace_private.sotf_workflow_access_audit row)
  );
$$;

select set_config('request.sotf_time_zone_claims',jsonb_build_object(
  'sub','82111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','82cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true',
  'iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_time_zone_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','82000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic',
    'question','Which direction?','weeklyHours',8,'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','time-zone fixture starts one ordinary transition');

create function pg_temp.time_zone_outcome(raw_time_zone text, expected_accept boolean)
returns jsonb language sql volatile set search_path='' as $$
  select jsonb_build_object(
    'schema_version','1','request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,
    'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',1,
    'brief_date',to_char(clock_timestamp() at time zone
      (case when expected_accept then raw_time_zone else 'America/Chicago' end),'YYYY-MM-DD'),
    'time_zone',raw_time_zone,'host','chatgpt','execution_mode','A',
    'data_class','ordinary_transition_operations','user_confirmed',true,'status','degraded',
    'connector_results',jsonb_build_object('calendar_read','not_requested','email_read','not_requested'),
    'degradation_reasons','[]'::jsonb,'selected_le_refs','[]'::jsonb,
    'priority_count',0,'usefulness','not_rated',
    'provenance',jsonb_build_object(
      'source','host_reported_user_confirmed','provider_content_persisted',false)
  );
$$;

create function pg_temp.time_zone_case(raw_time_zone text, expected_accept boolean)
returns boolean language plpgsql security definer set search_path='extensions' as $$
declare
  candidate jsonb := pg_temp.time_zone_outcome(raw_time_zone,expected_accept);
  response jsonb;
  replay jsonb;
  before_state jsonb := pg_temp.time_zone_snapshot();
  saved_state jsonb;
  caught_state text;
  caught_message text;
begin
  begin
    response := workspace.sotf_v1_record_daily_brief_outcome(candidate);
  exception when others then
    caught_state := sqlstate;
    caught_message := sqlerrm;
  end;
  if not expected_accept then
    return caught_state = '22023'
      and caught_message = 'sotf_v1:invalid_input'
      and pg_temp.time_zone_snapshot() = before_state;
  end if;
  if caught_state is not null
    or response ->> 'saved' is distinct from 'true'
    or response ->> 'replayed' is distinct from 'false'
  then return false; end if;
  saved_state := pg_temp.time_zone_snapshot();
  begin
    replay := workspace.sotf_v1_record_daily_brief_outcome(candidate);
  exception when others then
    return false;
  end;
  return replay ->> 'saved' = 'true'
    and replay ->> 'replayed' = 'true'
    and pg_temp.time_zone_snapshot() = saved_state
    and jsonb_array_length(saved_state -> 'outcomes')
      = jsonb_array_length(before_state -> 'outcomes') + 1
    and saved_state -> 'events' = before_state -> 'events'
    and saved_state -> 'heads' = before_state -> 'heads'
    and saved_state -> 'audits' = before_state -> 'audits';
end; $$;

select ok(
  pg_temp.time_zone_case(item ->> 'raw',(item ->> 'accepted')::boolean),
  '[SOTF-TIME-ZONE:' || (item ->> 'id') || '] authenticated RPC decision and persistence: '
    || (item ->> 'description')
)
from jsonb_array_elements(current_setting('request.sotf_time_zone_corpus')::jsonb) item;

select * from finish();
rollback;
