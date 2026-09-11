begin;
select no_plan();

-- Disposable synthetic identities and ordinary SOTF records only. The transaction rolls back.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','74111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.v1.synthetic.a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','74222222-2222-4222-8222-222222222222','authenticated','authenticated','sotf.v1.synthetic.b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('74111111-1111-4111-8111-111111111111','Synthetic SOTF v1 A'),('74222222-2222-4222-8222-222222222222','Synthetic SOTF v1 B');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF v1 A','74111111-1111-4111-8111-111111111111'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Synthetic SOTF v1 B','74222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','74111111-1111-4111-8111-111111111111','owner','active'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','74222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','74111111-1111-4111-8111-111111111111','personal'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','74222222-2222-4222-8222-222222222222','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','74111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-v1-a'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sotf_transition','74222222-2222-4222-8222-222222222222','promotion','synthetic-sotf-v1-b');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','74cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'74111111-1111-4111-8111-111111111111'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','74dddddd-dddd-4ddd-8ddd-dddddddddddd','claude','connected',now(),'74222222-2222-4222-8222-222222222222'),
('74bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','74eeeeee-eeee-4eee-8eee-eeeeeeeeeeee','chatgpt','connected',now(),'74222222-2222-4222-8222-222222222222');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '74111111-1111-4111-8111-111111111111','74cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '74222222-2222-4222-8222-222222222222',clients.client_id,setting_value,array['openid','email','profile']
from workspace_private.product_settings
cross join (values ('74dddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid),('74eeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid)) as clients(client_id)
where setting_key='mcp_resource_uri';

select is((select setting_value from workspace_private.product_settings where setting_key='sotf_v1_daily_brief_enabled'),'false','the additive migration cannot activate the slice');
select is(has_table_privilege('authenticated','workspace_private.sotf_daily_brief_outcomes','select'),false,'outcome storage is not directly readable');
select is(has_table_privilege('authenticated','workspace_private.sotf_daily_brief_outcomes','insert'),false,'outcome storage is not directly writable');
select is(has_table_privilege('authenticated','workspace_private.sotf_workflow_access_audit','select'),false,'workflow access receipts are private operational audit data');
select is(has_function_privilege('anon','workspace.sotf_v1_access_state()','execute'),false,'anonymous callers cannot probe v1 access');
select is(has_function_privilege('authenticated','workspace.sotf_v1_record_daily_brief_outcome(jsonb)','execute'),true,'authenticated MCP callers may reach the fail-closed write bridge');

select set_config('request.sotf_mcp_claims',jsonb_build_object('sub','74111111-1111-4111-8111-111111111111','role','authenticated','aud',(select setting_value from workspace_private.product_settings where setting_key='mcp_resource_uri'),'client_id','74cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp())))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select is(workspace.sotf_v1_access_state()->>'state','service_unavailable','database release denial precedes catalog or state access');
reset role;

update workspace_private.product_settings set setting_value='true' where setting_key='sotf_v1_daily_brief_enabled';
update workspace.bundle_entitlements set starts_at=now()+interval '1 day' where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select is(workspace.sotf_v1_access_state()->>'state','entitlement_required','a future entitlement is not current authority');
reset role;
update workspace.bundle_entitlements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_access_state()->>'state','entitlement_required','an expired entitlement cannot retrieve the hosted workflow');
reset role;
update workspace.bundle_entitlements set expires_at=null where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.personal_plans set status='suspended' where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_access_state()->>'state','entitlement_required','a suspended Personal plan cannot authorize subscription-backed workflow access');
reset role;
update workspace.personal_plans set status='active' where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='agentic_workflows';
set local role authenticated;
select is(workspace.sotf_v1_access_state()->>'state','capability_unavailable','an entitled caller still needs every required capability');
reset role;
update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='agentic_workflows';

set local role authenticated;
select is(workspace.sotf_v1_access_state()->>'state','active','current entitlement, capability, MCP, and release gates authorize the slice');
select is(workspace.sotf_v1_access_state()->>'workspace_id','74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','access derives tenant binding from the current MCP authority');
select throws_ok($sql$select workspace.sotf_v1_authorize_workflow_retrieval('transition.daily_brief','2.0.0')$sql$,'22023','sotf_v1:version_not_available','an absent exact version is denied without an audit success receipt');
select is(workspace.sotf_v1_authorize_workflow_retrieval('transition.daily_brief','1.0.0')->>'state','active','exact workflow retrieval rechecks current authority at delivery');
reset role;
select is((select count(*) from workspace_private.sotf_workflow_access_audit where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'successful workflow retrieval stores one content-free access receipt');
select is((select workflow_id || ':' || workflow_version from workspace_private.sotf_workflow_access_audit where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'transition.daily_brief:1.0.0','the access receipt identifies only the fixed workflow/version');
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select set_config('request.start_operation','{"requestId":"74000000-0000-4000-8000-000000000001","expectedRevision":0,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"start_transition","timing":"Fall","question":"Which work should I test?","weeklyHours":8,"criteria":[],"hypotheses":[]}}',true);
select is(workspace.sotf_append_operation(current_setting('request.start_operation')::jsonb)->>'revision','1','the synthetic transition starts through the existing canonical event log');
select set_config('request.commitment_operation',jsonb_build_object(
  'requestId','74000000-0000-4000-8000-000000000002','expectedRevision',1,'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','synthetic-follow-up','title','Send the reviewed follow-up','owner','Fellow',
    'due',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'definitionOfDone','The fictional recipient has the reviewed note','reviewTrigger','Before local noon'
  ))
)::text,true);
select is(workspace.sotf_append_operation(current_setting('request.commitment_operation')::jsonb)->>'revision','2','the bounded outcome can refer to one canonical ordinary record');
select set_config('request.sotf_outcome',jsonb_build_object(
  'schema_version','1','request_id','74000000-0000-4000-8000-000000000011','run_id','74000000-0000-4000-8000-000000000012',
  'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',2,
  'brief_date',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),'time_zone','America/Chicago',
  'host','chatgpt','execution_mode','A','data_class','ordinary_transition_operations','user_confirmed',true,'status','completed',
  'connector_results',jsonb_build_object('calendar_read','used','email_read','used'),'degradation_reasons','[]'::jsonb,
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','synthetic-follow-up')),
  'priority_count',1,'usefulness','not_rated','provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb)->>'replayed','false','a reviewed metadata-only outcome is appended once');
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb)->>'replayed','true','an exact retry returns the original receipt');
reset role;
select is((select count(*) from workspace_private.sotf_daily_brief_outcomes where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'exact retry does not duplicate the outcome');
select is((select payload ? 'provider_content' from workspace_private.sotf_daily_brief_outcomes where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),false,'the durable payload has no provider-content field');
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(jsonb_set(current_setting('request.sotf_outcome')::jsonb,'{usefulness}','"useful"'))$sql$,'22023','sotf_v1:idempotency_conflict','one request or run identity cannot acquire changed intent');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb || jsonb_build_object('request_id','74000000-0000-4000-8000-000000000021','run_id','74000000-0000-4000-8000-000000000022','expected_state_revision',1))$sql$,'40001','sotf_v1:state_changed','a new stale outcome is rejected before persistence');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb || jsonb_build_object('request_id','74000000-0000-4000-8000-000000000031','run_id','74000000-0000-4000-8000-000000000032','selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','not-in-state'))))$sql$,'22023','sotf_v1:invalid_input','selected references must exist in the current tenant state');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb || jsonb_build_object('request_id','74000000-0000-4000-8000-000000000041','run_id','74000000-0000-4000-8000-000000000042','user_confirmed',false))$sql$,'22023','sotf_v1:invalid_input','unconfirmed outcomes cannot be saved');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb || jsonb_build_object('request_id','74000000-0000-4000-8000-000000000051','run_id','74000000-0000-4000-8000-000000000052','provider_content','forbidden'))$sql$,'22023','sotf_v1:invalid_input','extra provider data is rejected by the exact contract');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','74222222-2222-4222-8222-222222222222','role','authenticated','aud','https://workspace.leademergence.com/api/mcp','client_id','74cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp())))::text,true);
select is(workspace.sotf_v1_access_state()->>'state','access_denied','a different user cannot reuse another tenant MCP connection');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','74222222-2222-4222-8222-222222222222','role','authenticated','aud','https://workspace.leademergence.com/api/mcp','client_id','74eeeeee-eeee-4eee-8eee-eeeeeeeeeeee','workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp())))::text,true);
select is(workspace.sotf_v1_access_state()->>'state','active','the second tenant can hold independent current ChatGPT authority');
select is(jsonb_array_length(workspace.sotf_v1_list_daily_brief_outcomes('1.0.0')),0,'an authorized second tenant cannot read the first tenant outcome');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','74222222-2222-4222-8222-222222222222','role','authenticated','aud','https://workspace.leademergence.com/api/mcp','client_id','74dddddd-dddd-4ddd-8ddd-dddddddddddd','workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp())))::text,true);
select is(workspace.sotf_v1_access_state()->>'state','incompatible_contract','an otherwise authorized Claude connection is not silently certified for the ChatGPT-only workflow');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Synthetic cancellation test' where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select is(workspace.sotf_v1_access_state()->>'state','entitlement_required','cancellation removes current workflow authority immediately');
select throws_ok($sql$select workspace.sotf_v1_list_daily_brief_outcomes('1.0.0')$sql$,'42501','sotf_v1:entitlement_required','cancellation denies durable intelligence reads');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_outcome')::jsonb)$sql$,'42501','sotf_v1:entitlement_required','cancellation denies exact-replay and new write access');
reset role;
select is((select count(*) from workspace_private.sotf_daily_brief_outcomes where workspace_id='74aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'cancellation preserves data for separate retention and export policy');

select * from finish();
rollback;
