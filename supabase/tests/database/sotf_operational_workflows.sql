begin;
select no_plan();

-- Disposable synthetic users only; the entire acceptance transaction rolls back.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','60111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.synthetic.a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','60222222-2222-4222-8222-222222222222','authenticated','authenticated','sotf.synthetic.b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('60111111-1111-4111-8111-111111111111','Synthetic fellow A'),('60222222-2222-4222-8222-222222222222','Synthetic fellow B');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF A','60111111-1111-4111-8111-111111111111'),
('60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Synthetic SOTF B','60222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60111111-1111-4111-8111-111111111111','owner','active'),
('60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','60222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60111111-1111-4111-8111-111111111111','personal'),
('60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','60222222-2222-4222-8222-222222222222','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','60111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-a');

select is(has_table_privilege('authenticated','workspace_private.sotf_operation_events','select'),false,'event log is accessible only through owner-scoped product operations');
select is(has_table_privilege('authenticated','workspace_private.sotf_operation_events','insert'),false,'clients cannot append directly');
select is(has_table_privilege('authenticated','workspace_private.sotf_operation_events','update'),false,'clients cannot rewrite history');
select is(has_function_privilege('anon','workspace.sotf_read_operations()','execute'),false,'anonymous users cannot retrieve operational state');
select is(has_function_privilege('anon','workspace.sotf_append_operation(jsonb)','execute'),false,'anonymous users cannot write operational state');
select is(has_function_privilege('anon','workspace.sotf_has_access()','execute'),false,'anonymous users cannot probe SOTF access');
select is(has_function_privilege('authenticated','workspace.sotf_has_access()','execute'),true,'authenticated callers can perform the fail-closed access check');
select is(coalesce((select enabled from workspace.bundle_capabilities where bundle_key='sotf_transition' and capability_key='professional_context'),false),false,'the product migration leaves Professional Context absent and off');

select set_config('request.sotf_operation','{"requestId":"60000000-0000-4000-8000-000000000001","expectedRevision":0,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"start_transition","timing":"Six months","question":"Which work should I test?","weeklyHours":8,"criteria":[],"hypotheses":[]}}',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.sotf_has_access(),true,'an entitled direct session can discover SOTF');
select is(workspace.sotf_read_operations()->>'revision','0','new fellow begins at revision zero');
select is(workspace.sotf_append_operation(current_setting('request.sotf_operation')::jsonb)->>'revision','1','a confirmed operation advances one revision');
select is(workspace.sotf_append_operation(current_setting('request.sotf_operation')::jsonb)->>'replayed','true','an exact retry returns the original receipt');
select is(jsonb_array_length(workspace.sotf_read_operations()->'events'),1,'an exact retry does not duplicate the log');
select is(workspace.sotf_read_operations()->>'workspace_id','60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','workspace is resolved from the current owner rather than caller input');
select throws_ok($sql$select workspace.sotf_append_operation(jsonb_set(current_setting('request.sotf_operation')::jsonb,'{command,question}','"Changed question"'))$sql$,'22023','Request ID already belongs to a different operation.','same ID cannot acquire different intent');
select throws_ok($sql$select workspace.sotf_append_operation(jsonb_set(current_setting('request.sotf_operation')::jsonb,'{requestId}','"60000000-0000-4000-8000-000000000002"'))$sql$,'40001','Refresh before saving this operation.','a stale writer cannot overwrite a concurrent session');
select throws_ok($sql$select workspace.sotf_append_operation(jsonb_set(current_setting('request.sotf_operation')::jsonb,'{dataClass}','"sensitive"'))$sql$,'22023','A confirmed ordinary operation is required.','protected data envelopes are not an operational fallback');
select throws_ok($sql$select workspace.sotf_append_operation(jsonb_set(current_setting('request.sotf_operation')::jsonb,'{userConfirmed}','false'))$sql$,'22023','A confirmed ordinary operation is required.','unconfirmed writes are rejected');
select throws_ok($sql$select workspace.sotf_append_operation(current_setting('request.sotf_operation')::jsonb || '{"workspaceId":"60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}')$sql$,'22023','A confirmed ordinary operation is required.','a caller cannot substitute a workspace');
select is(workspace.sotf_read_operations()->>'revision','1','failed operations leave the prior revision intact');

select set_config('request.jwt.claims','{"sub":"60222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.sotf_has_access(),false,'a non-entitled owner cannot discover SOTF or select another Workspace');
select throws_ok($sql$select workspace.sotf_read_operations()$sql$,'42501','Active SOTF Bundle access is required.','an owner without a SOTF entitlement is denied');
reset role;
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sotf_transition','60222222-2222-4222-8222-222222222222','promotion','synthetic-sotf-b');
set local role authenticated;
select is(workspace.sotf_has_access(),true,'an independently entitled owner can discover only their own SOTF state');
select is(jsonb_array_length(workspace.sotf_read_operations()->'events'),0,'another entitled fellow cannot read the first fellow history');
-- The database authorizes the command type; the SOTF engine separately validates the contact and positive reply.
select is(workspace.sotf_append_operation('{"requestId":"60000000-0000-4000-8000-000000000003","expectedRevision":0,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"prepare_scheduling_reply","personId":"synthetic-contact","schedulingUrl":"https://workspace.leademergence.com/meet/andrew"}}'::jsonb)->>'revision','1','a confirmed scheduling reply passes the existing operation append boundary');
select is(jsonb_array_length(workspace.sotf_read_operations()->'events'),1,'the synthetic scheduling reply was recorded in its own entitled Workspace');
reset role;

update workspace.bundle_entitlements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'
where workspace_id='60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.sotf_has_access(),false,'an expired entitlement is not presented as available');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","client_id":"malformed-client"}',true);
select is(workspace.sotf_has_access(),false,'a malformed or unknown MCP entitlement context fails closed');
reset role;

update workspace.bundle_definitions set availability_status='unavailable' where bundle_key='sotf_transition';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.sotf_has_access(),false,'an unavailable catalog state fails closed');
reset role;
update workspace.bundle_definitions set availability_status='active' where bundle_key='sotf_transition';

insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'60111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '60111111-1111-4111-8111-111111111111','60cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile'] from workspace_private.product_settings where setting_key='mcp_resource_uri';
select set_config('request.sotf_mcp_claims',jsonb_build_object('sub','60111111-1111-4111-8111-111111111111','role','authenticated','aud',(select setting_value from workspace_private.product_settings where setting_key='mcp_resource_uri'),'client_id','60cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp())))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_mcp_claims'),true);
select is(workspace.sotf_has_access(),true,'an entitled connected MCP session receives SOTF discovery');
select is(workspace.sotf_read_operations()->>'revision','1','connected MCP and native sessions recover the same operational history');
reset role;
update workspace.mcp_authorizations set status='disconnected' where client_id='60cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select is(workspace.sotf_has_access(),false,'a disconnected MCP session loses SOTF discovery');
select throws_ok($sql$select workspace.sotf_read_operations()$sql$,'42501',null,'disconnected MCP clients cannot recover operational state');
reset role;
update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Synthetic access revoked for acceptance' where workspace_id='60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.sotf_has_access(),false,'a revoked entitlement immediately removes SOTF discovery');
select throws_ok($sql$select workspace.sotf_read_operations()$sql$,'42501','Active SOTF Bundle access is required.','revocation also denies a native session');
reset role;
select is((select count(*) from workspace_private.sotf_operation_events where workspace_id='60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'revocation preserves history without permitting access');

-- A separate disposable owner keeps the original entitlement/revision assertions intact.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','60333333-3333-4333-8333-333333333333','authenticated','authenticated','sotf.synthetic.review@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values ('60333333-3333-4333-8333-333333333333','Synthetic review fellow');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('60dddddd-dddd-4ddd-8ddd-dddddddddddd','personal','Synthetic SOTF review','60333333-3333-4333-8333-333333333333');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('60dddddd-dddd-4ddd-8ddd-dddddddddddd','60333333-3333-4333-8333-333333333333','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values ('60dddddd-dddd-4ddd-8ddd-dddddddddddd','60333333-3333-4333-8333-333333333333','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values ('60dddddd-dddd-4ddd-8ddd-dddddddddddd','sotf_transition','60333333-3333-4333-8333-333333333333','promotion','synthetic-sotf-review');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated"}',true);

select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000001","expectedRevision":0,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"prepare_action","kind":"email","recipient":"Synthetic peer","subject":"Hello","body":"Preparation only: review this"}}'::jsonb)->>'revision','1','synthetic message draft is recorded');
select throws_ok($sql$select workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000002","expectedRevision":1,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000001:action","exactRevision":1}}'::jsonb)$sql$,'22023','Review this exact message with AI Slop Killer in Codex before approval.','direct unreviewed message approval is denied');
select is(workspace.sotf_read_operations()->>'revision','1','denied approval does not advance the log');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000003","expectedRevision":1,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"revise_action","actionId":"60300000-0000-4000-8000-000000000001:action","recipient":"Synthetic peer","subject":"A specific question","body":"Hi, could we talk about your program work?","skillReviewed":true}}'::jsonb)->>'revision','2','reviewed replacement text is recorded');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000004","expectedRevision":2,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000001:action","exactRevision":2}}'::jsonb)->>'revision','3','current reviewed message can be approved');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000004","expectedRevision":2,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000001:action","exactRevision":2}}'::jsonb)->>'replayed','true','historical exact approval receipt still replays');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000005","expectedRevision":3,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"revise_action","actionId":"60300000-0000-4000-8000-000000000001:action","recipient":"Synthetic peer","subject":"A new question","body":"Can we discuss a different topic?"}}'::jsonb)->>'revision','4','later edit clears the effective review declaration');
select throws_ok($sql$select workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000006","expectedRevision":4,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000001:action","exactRevision":3}}'::jsonb)$sql$,'22023','Review this exact message with AI Slop Killer in Codex before approval.','an older review cannot authorize the edited text');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000007","expectedRevision":4,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"prepare_action","kind":"calendar_invite","recipient":"Synthetic peer","subject":"Meeting","body":"Meeting details"}}'::jsonb)->>'revision','5','non-message action remains available');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000008","expectedRevision":5,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000007:action","exactRevision":1}}'::jsonb)->>'revision','6','calendar invitation approval is outside the message-review gate');
select is(workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000009","expectedRevision":6,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"prepare_outreach","personId":"60300000-0000-4000-8000-000000000099","stage":"initial"}}'::jsonb)->>'revision','7','generated outreach operation is recorded');
select throws_ok($sql$select workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000010","expectedRevision":7,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60300000-0000-4000-8000-000000000009:action","exactRevision":1}}'::jsonb)$sql$,'22023','Review this exact message with AI Slop Killer in Codex before approval.','generated outreach also requires reviewed replacement text');
select throws_ok($sql$select workspace.sotf_append_operation('{"requestId":"60300000-0000-4000-8000-000000000011","expectedRevision":7,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"approve_action","actionId":"60000000-0000-4000-8000-000000000001:action","exactRevision":1}}'::jsonb)$sql$,'22023','Unknown transition action.','approval cannot resolve an action from another Workspace');
select is(workspace.sotf_read_operations()->>'revision','7','denied direct approvals leave the owner history unchanged');
reset role;
select * from finish();
rollback;
