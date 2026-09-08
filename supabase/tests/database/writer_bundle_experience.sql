begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','75111111-1111-4111-8111-111111111111','authenticated','authenticated','writer.sql.a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','75222222-2222-4222-8222-222222222222','authenticated','authenticated','writer.sql.b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('75111111-1111-4111-8111-111111111111','Synthetic Writer A'),('75222222-2222-4222-8222-222222222222','Synthetic Writer B');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic Writing A','75111111-1111-4111-8111-111111111111'),
('75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Synthetic Writing B','75222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75111111-1111-4111-8111-111111111111','owner','active'),
('75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','75222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75111111-1111-4111-8111-111111111111','personal'),
('75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','75222222-2222-4222-8222-222222222222','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','writer_editor','75111111-1111-4111-8111-111111111111','promotion','synthetic-writer-sql-a');
insert into workspace_private.writing_resources(id,workspace_id,title,source_label,publication_state) values
('75000000-0000-4000-8000-000000000001','75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A resource','Synthetic SQL fixture','in_review'),
('75000000-0000-4000-8000-000000000002','75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic B resource','Synthetic SQL fixture','draft');

select is(has_table_privilege('authenticated','workspace_private.writing_resources','select'),false,'private writing content cannot be selected directly');
select is(has_table_privilege('authenticated','workspace_private.writing_resources','insert'),false,'read-only scope exposes no resource writes');
select is(has_function_privilege('anon','workspace.get_bundle_experience()','execute'),false,'anonymous experience reads are denied');
select is(has_function_privilege('anon','workspace.writer_get_resource(uuid)','execute'),false,'anonymous resource reads are denied');
select is(has_function_privilege('authenticated','workspace_private.bundle_capability_active(uuid,text,text)','execute'),false,'callers cannot select a tenant through the internal authority helper');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.get_bundle_experience()->>'workspaceId','75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','native experience resolves the authenticated owner');
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),4,'Writer receives the four activated portable capabilities');
select is(workspace.writer_list_resources()->>'total','1','library counts include only the authenticated tenant');
select is(workspace.writer_list_resources()->>'awaitingPublication','1','attention count reflects actual resource state');
select is(workspace.writer_get_resource('75000000-0000-4000-8000-000000000001')->'resource'->>'title','Synthetic A resource','Writer can read their source');
select throws_ok($sql$select workspace.writer_get_resource('75000000-0000-4000-8000-000000000002')$sql$,'P0002','Resource unavailable.','another tenant ID reveals no resource');
select throws_ok($sql$select workspace.writer_get_resource('75000000-0000-4000-8000-000000000003')$sql$,'P0002','Resource unavailable.','missing ID has the same response as a foreign ID');
select throws_ok($sql$select workspace.writer_list_resources('',null,0,500)$sql$,'22023','Invalid resource search.','resource reads are bounded');
select set_config('request.writer_revision',workspace.get_bundle_experience()->>'revision',true);

select set_config('request.jwt.claims','{"sub":"75222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),0,'user B without Writer gets no Writer capability');
select throws_ok($sql$select workspace.writer_list_resources()$sql$,'42501','Active Writer & Editor access is required.','user B cannot invoke the library despite owning a resource');
reset role;
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','writer_editor','75222222-2222-4222-8222-222222222222','promotion','synthetic-writer-sql-b');
set local role authenticated;
select is(workspace.writer_list_resources()->>'total','1','a separately entitled user reads only their own library');
select throws_ok($sql$select workspace.writer_get_resource('75000000-0000-4000-8000-000000000001')$sql$,'P0002','Resource unavailable.','even two entitled users cannot cross tenants');
reset role;

update workspace.bundle_entitlements set starts_at=now()+interval '1 day' where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),0,'future grants activate no capabilities');
select throws_ok($sql$select workspace.writer_list_resources()$sql$,'42501','Active Writer & Editor access is required.','future grant cannot read resources');
reset role;
update workspace.bundle_entitlements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),0,'expired grants activate no capabilities');
reset role;
update workspace.bundle_entitlements set starts_at=now(),expires_at=null where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

update workspace.bundle_capabilities set enabled=false where bundle_key='writer_editor' and capability_key='writer_resource_review';
set local role authenticated;
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),3,'disabled mapping removes the individual capability');
select throws_ok($sql$select workspace.writer_get_resource('75000000-0000-4000-8000-000000000001')$sql$,'42501','Active Writer & Editor access is required.','disabled review mapping cannot read full source');
reset role;
update workspace.bundle_capabilities set enabled=true where bundle_key='writer_editor';
update workspace.bundle_definitions set availability_status='unavailable' where bundle_key='writer_editor';
set local role authenticated;
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),0,'unavailable catalog removes the capability');
reset role;
update workspace.bundle_definitions set availability_status='active' where bundle_key='writer_editor';

insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','75cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'75111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values
('75111111-1111-4111-8111-111111111111','75cccccc-cccc-4ccc-8ccc-cccccccccccc','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
select set_config('request.writer_mcp_claims',jsonb_build_object('sub','75111111-1111-4111-8111-111111111111','role','authenticated','aud','https://workspace.leademergence.com/api/mcp','client_id','75cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp',true,'iat',floor(extract(epoch from clock_timestamp())))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.writer_mcp_claims'),true);
select is(workspace.writer_list_resources()->>'total','1','MCP and browser share the same authenticated library');
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),4,'MCP resolves the same four capabilities');
select throws_ok($sql$select workspace.writer_decide_proposal('75000000-0000-4000-8000-000000000001',1,'approve')$sql$,'42501','Open Workspace to approve this action yourself.','MCP cannot approve by calling a hidden RPC directly');
select throws_ok($sql$select workspace.writer_import_resource('75000000-0000-4000-8000-000000000001','{}')$sql$,'42501','Open Workspace to approve this action yourself.','MCP cannot create canonical imports directly');
select set_config('request.jwt.claims',(current_setting('request.writer_mcp_claims')::jsonb || '{"aud":"https://wrong.invalid/mcp"}')::text,true);
select throws_ok($sql$select workspace.get_bundle_experience()$sql$,'42501',null,'wrong MCP audience fails closed');
select set_config('request.jwt.claims',current_setting('request.writer_mcp_claims'),true);
reset role;
update workspace.mcp_authorizations set status='disconnected' where client_id='75cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select throws_ok($sql$select workspace.writer_list_resources()$sql$,'42501',null,'disconnected assistant cannot read a cached tool');
reset role;
update workspace.mcp_authorizations set status='connected' where client_id='75cccccc-cccc-4ccc-8ccc-cccccccccccc';
update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now() where client_id='75cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select throws_ok($sql$select workspace.writer_list_resources()$sql$,'42501',null,'revoked provider authorization fails closed');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Synthetic lifecycle test revocation' where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(jsonb_array_length(workspace.get_bundle_experience()->'capabilities'),0,'revocation removes UI and tool capability source immediately');
select isnt(workspace.get_bundle_experience()->>'revision',current_setting('request.writer_revision'),'revocation changes the shared revision');
select throws_ok($sql$select workspace.writer_list_resources()$sql$,'42501','Active Writer & Editor access is required.','revocation denies browser reads');
reset role;
select is((select count(*) from workspace_private.writing_resources where workspace_id='75aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'revocation preserves original resources');
update workspace.personal_plans set status='suspended' where workspace_id='75bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($sql$select workspace.get_bundle_experience()$sql$,'42501',null,'suspended plan removes bundle authority');
reset role;
select * from finish();
rollback;
