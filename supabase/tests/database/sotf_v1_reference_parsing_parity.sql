begin;
select no_plan();

-- Shared decoded-string corpus. TypeScript and the live MCP/PostgREST runner
-- consume these exact cases; null parsed means INVALID without rewriting.
select set_config('request.sotf_reference_parsing_corpus',$parsing$[
  {"id":"P01","description":"exact canonical identifier","raw":"a-b","parsed":"a-b","accepted":true},
  {"id":"P02","description":"leading ASCII space","raw":" a-b","parsed":null,"accepted":false},
  {"id":"P03","description":"trailing ASCII space","raw":"a-b ","parsed":null,"accepted":false},
  {"id":"P04","description":"surrounding ASCII spaces","raw":" a-b ","parsed":null,"accepted":false},
  {"id":"P05","description":"leading tab","raw":"\ta-b","parsed":null,"accepted":false},
  {"id":"P06","description":"trailing tab","raw":"a-b\t","parsed":null,"accepted":false},
  {"id":"P07","description":"leading newline","raw":"\na-b","parsed":null,"accepted":false},
  {"id":"P08","description":"trailing newline","raw":"a-b\n","parsed":null,"accepted":false},
  {"id":"P09","description":"surrounding CRLF","raw":"\r\na-b\r\n","parsed":null,"accepted":false},
  {"id":"P10","description":"non-breaking spaces","raw":"\u00a0a-b\u00a0","parsed":null,"accepted":false},
  {"id":"P11","description":"en spaces","raw":"\u2002a-b\u2002","parsed":null,"accepted":false},
  {"id":"P12","description":"em spaces","raw":"\u2003a-b\u2003","parsed":null,"accepted":false},
  {"id":"P13","description":"narrow no-break spaces","raw":"\u202fa-b\u202f","parsed":null,"accepted":false},
  {"id":"P14","description":"ideographic spaces","raw":"\u3000a-b\u3000","parsed":null,"accepted":false},
  {"id":"P15","description":"byte-order marks recognized by JavaScript trim","raw":"\ufeffa-b\ufeff","parsed":null,"accepted":false},
  {"id":"P16","description":"zero-width spaces are distinct non-whitespace","raw":"\u200ba-b\u200b","parsed":null,"accepted":false},
  {"id":"P17","description":"Unicode hyphen lookalike","raw":"a\u2010b","parsed":null,"accepted":false},
  {"id":"P18","description":"non-breaking hyphen lookalike","raw":"a\u2011b","parsed":null,"accepted":false},
  {"id":"P19","description":"minus-sign lookalike","raw":"a\u2212b","parsed":null,"accepted":false},
  {"id":"P20","description":"fullwidth hyphen lookalike","raw":"a\uff0db","parsed":null,"accepted":false},
  {"id":"P21","description":"case-altered identifier","raw":"A-B","parsed":null,"accepted":false},
  {"id":"P22","description":"leading period","raw":".a-b","parsed":null,"accepted":false},
  {"id":"P23","description":"trailing period","raw":"a-b.","parsed":null,"accepted":false},
  {"id":"P24","description":"combining-mark insertion","raw":"a\u0301-b","parsed":null,"accepted":false},
  {"id":"P25","description":"leading unit-separator control","raw":"\u001fa-b","parsed":null,"accepted":false},
  {"id":"P26","description":"trailing carriage return","raw":"a-b\r","parsed":null,"accepted":false}
]$parsing$,true);

select is(
  workspace_private.sotf_v1_reference_is_eligible(
    '[{"entity_type":"hypothesis","entity_id":"a-b"}]'::jsonb,
    jsonb_build_object('entity_type','hypothesis','entity_id',item ->> 'raw')
  ),
  (item ->> 'accepted')::boolean,
  '[SOTF-REFERENCE:' || (item ->> 'id') || '] SQL exact decoded reference: ' || (item ->> 'description')
)
from jsonb_array_elements(current_setting('request.sotf_reference_parsing_corpus')::jsonb) item;

select ok(not has_function_privilege(
  'authenticated','workspace_private.sotf_v1_reference_is_eligible(jsonb,jsonb)','execute'
), 'exact-reference helper is private');
select ok(position('normalize' in lower(pg_get_functiondef(
  'workspace_private.sotf_v1_reference_is_eligible(jsonb,jsonb)'::regprocedure
))) = 0, 'exact-reference helper performs no Unicode normalization');
select ok(position('trim' in lower(pg_get_functiondef(
  'workspace_private.sotf_v1_reference_is_eligible(jsonb,jsonb)'::regprocedure
))) = 0, 'exact-reference helper performs no whitespace trimming');

-- Disposable tenant and a four-hypothesis projection. The transaction rolls
-- back, and each denial independently proves no success-side durable effect.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','80111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.reference.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('80111111-1111-4111-8111-111111111111','Synthetic SOTF reference parity');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF reference parity','80111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','80111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','80111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','80111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-reference-parity');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','80cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'80111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '80111111-1111-4111-8111-111111111111','80cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';

create function pg_temp.reference_snapshot()
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

select set_config('request.sotf_reference_claims',jsonb_build_object(
  'sub','80111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','80cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true',
  'iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_reference_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','80000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic',
    'question','Which direction?','weeklyHours',8,'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','reference fixture starts one ordinary transition');

select is(workspace.sotf_append_operation('{"requestId":"80000000-0000-4000-8000-000000000002","expectedRevision":1,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"0","proposition":"Synthetic 0","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Provisional"}}}'::jsonb)->>'revision','2','reference fixture saves hypothesis 0');
select is(workspace.sotf_append_operation('{"requestId":"80000000-0000-4000-8000-000000000003","expectedRevision":2,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"1","proposition":"Synthetic 1","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Provisional"}}}'::jsonb)->>'revision','3','reference fixture saves hypothesis 1');
select is(workspace.sotf_append_operation('{"requestId":"80000000-0000-4000-8000-000000000004","expectedRevision":3,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"a-b","proposition":"Synthetic a-b","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Provisional"}}}'::jsonb)->>'revision','4','reference fixture saves hypothesis a-b');
select is(workspace.sotf_append_operation('{"requestId":"80000000-0000-4000-8000-000000000005","expectedRevision":4,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"a_b","proposition":"Synthetic a_b","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Provisional"}}}'::jsonb)->>'revision','5','reference fixture saves hypothesis a_b');

create function pg_temp.reference_outcome(raw_reference text)
returns jsonb language sql volatile set search_path='' as $$
  select jsonb_build_object(
    'schema_version','1','request_id',gen_random_uuid()::text,'run_id',gen_random_uuid()::text,
    'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',5,
    'brief_date',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'time_zone','America/Chicago','host','chatgpt','execution_mode','A',
    'data_class','ordinary_transition_operations','user_confirmed',true,'status','degraded',
    'connector_results',jsonb_build_object('calendar_read','not_requested','email_read','not_requested'),
    'degradation_reasons',jsonb_build_array('state_truncated'),
    'selected_le_refs',jsonb_build_array(jsonb_build_object(
      'entity_type','hypothesis','entity_id',raw_reference)),
    'priority_count',1,'usefulness','not_rated',
    'provenance',jsonb_build_object(
      'source','host_reported_user_confirmed','provider_content_persisted',false)
  );
$$;

create function pg_temp.reference_case(raw_reference text, expected_accept boolean)
returns boolean language plpgsql security definer set search_path='extensions' as $$
declare
  candidate jsonb := pg_temp.reference_outcome(raw_reference);
  authority_token text;
  response jsonb;
  replay jsonb;
  before_state jsonb := pg_temp.reference_snapshot();
  saved_state jsonb;
  caught_state text;
  caught_message text;
begin
  authority_token := workspace.sotf_v1_get_daily_brief_authority(
    candidate ->> 'workflow_id',candidate ->> 'workflow_version',candidate ->> 'brief_date',candidate ->> 'time_zone'
  ) ->> 'authority_token';
  begin
    response := workspace.sotf_v1_record_daily_brief_outcome(candidate,authority_token);
  exception when others then
    caught_state := sqlstate;
    caught_message := sqlerrm;
  end;
  if not expected_accept then
    return caught_state = '22023'
      and caught_message = 'sotf_v1:invalid_input'
      and pg_temp.reference_snapshot() = before_state;
  end if;
  if caught_state is not null
    or response ->> 'saved' is distinct from 'true'
    or response ->> 'replayed' is distinct from 'false'
  then return false; end if;
  saved_state := pg_temp.reference_snapshot();
  begin
    replay := workspace.sotf_v1_record_daily_brief_outcome(candidate,authority_token);
  exception when others then
    return false;
  end;
  return replay ->> 'saved' = 'true'
    and replay ->> 'replayed' = 'true'
    and pg_temp.reference_snapshot() = saved_state
    and jsonb_array_length(saved_state -> 'outcomes')
      = jsonb_array_length(before_state -> 'outcomes') + 1
    and saved_state -> 'events' = before_state -> 'events'
    and saved_state -> 'heads' = before_state -> 'heads'
    and saved_state -> 'audits' = before_state -> 'audits';
end; $$;

select ok(
  pg_temp.reference_case(item ->> 'raw',(item ->> 'accepted')::boolean),
  '[SOTF-REFERENCE:' || (item ->> 'id') || '] authenticated RPC decision and persistence: '
    || (item ->> 'description')
)
from jsonb_array_elements(current_setting('request.sotf_reference_parsing_corpus')::jsonb) item;

set local role postgres;
create function pg_temp.reference_semantics()
returns jsonb language sql security definer set search_path='' as $$
  select workspace_private.sotf_v1_daily_brief_projection_semantics(
    '80aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (clock_timestamp() at time zone 'America/Chicago')::date,
    'America/Chicago'
  );
$$;
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_reference_claims'),true);

select is(
  pg_temp.reference_semantics() -> 'eligible_refs',
  '[{"entity_type":"hypothesis","entity_id":"0"},{"entity_type":"hypothesis","entity_id":"1"},{"entity_type":"hypothesis","entity_id":"a-b"}]'::jsonb,
  'reference fixture retains canonical bounded membership 0, 1, a-b'
);

select throws_ok(
  $$select workspace.sotf_v1_authorize_workflow_retrieval(' transition.daily_brief ','1.0.0')$$,
  '22023','sotf_v1:not_available',
  'authenticated workflow retrieval treats a padded workflow identifier as an exact non-match'
);

select * from finish();
rollback;
