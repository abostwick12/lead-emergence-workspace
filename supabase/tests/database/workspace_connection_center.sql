begin;
select no_plan();
select ok(not has_function_privilege('anon','workspace.native_connection_center(integer)','execute'),'anonymous inventory denied');
select ok(not has_function_privilege('anon','workspace.native_disconnect_connection(text,text,text,uuid,boolean)','execute'),'anonymous mutation denied');
select ok(not has_function_privilege('authenticated','workspace_private.connection_center_rows(uuid)','execute'),'raw helper private');
select ok(not has_table_privilege('authenticated','workspace_private.connection_disconnect_receipts','select'),'receipts private');
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('13111111-1111-4111-8111-111111111111','authenticated','authenticated','p13.owner@example.invalid','{}','{}'),
 ('13222222-2222-4222-8222-222222222222','authenticated','authenticated','p13.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
 ('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P13 owner','13111111-1111-4111-8111-111111111111'),
 ('13bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P13 other','13222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
 ('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','13111111-1111-4111-8111-111111111111','owner','active'),
 ('13bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','13222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
 ('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','13111111-1111-4111-8111-111111111111','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key in ('workspace_mcp','core_workspace');
insert into workspace_private.product_settings(setting_key,setting_value) values('mcp_dynamic_admission_enabled','true') on conflict(setting_key)do update set setting_value='true';
insert into auth.oauth_clients(id,registration_type,redirect_uris,grant_types,client_type,token_endpoint_auth_method)
select ('13000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'dynamic','https://example.invalid/callback','authorization_code,refresh_token','public','none'
from generate_series(1,3)i;
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,status,granted_scopes,revoked_at)
select '13111111-1111-4111-8111-111111111111',('13000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'https://workspace.leademergence.com/api/mcp',case when i=3 then 'revoked' else 'active' end,array['openid','profile'],case when i=3 then now() else null end from generate_series(1,3)i;
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,created_by)
values('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','13000000-0000-4000-8000-000000000001','chatgpt','connected','13111111-1111-4111-8111-111111111111');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,created_by)
select '13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','p13-unverified-'||i,'other','connected','13111111-1111-4111-8111-111111111111' from generate_series(1,28)i;
insert into workspace.integration_connections(workspace_id,provider,status,created_by)
select '13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p,'connected','13111111-1111-4111-8111-111111111111' from unnest(array['gmail','google_calendar','google_drive','slack'])p;
insert into workspace_private.integration_credentials(workspace_id,provider_family,ciphertext,key_version,token_expires_at,created_by)
values('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','google',repeat('fictional-no-secret-',4),1,now()-interval '1 minute','13111111-1111-4111-8111-111111111111');
create temp table p13_state(key text primary key,value jsonb);
grant all on p13_state to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into p13_state values('snapshot',workspace.native_connection_center());
select is((select (value->>'assistantTotal')::int from p13_state where key='snapshot'),31,'counts include every metadata row and orphan grant');
select is((select jsonb_array_length(value->'assistants') from p13_state where key='snapshot'),25,'bounded first page');
select is(jsonb_array_length(workspace.native_connection_center(25)->'assistants'),6,'all remaining connections appear');
select is((select (value->>'authorizedTotal')::int from p13_state where key='snapshot'),1,'metadata alone is not authorization');
select is((select (value->>'activeGrantTotal')::int from p13_state where key='snapshot'),2,'unfinished consent remains visible');
select is((select count(*)::int from p13_state,jsonb_array_elements(value->'external')e where key='snapshot' and e->>'credentialState'='expired'),1,'expired credential distinct from connected label');
select is((select count(*)::int from p13_state,jsonb_array_elements(value->'external')e where key='snapshot' and e->>'credentialState'='missing'),1,'metadata without credential is missing');
select ok((select value::text !~ 'ciphertext|secret_reference|client_id|13000000|fictional-no-secret' from p13_state where key='snapshot'),'response excludes raw identifiers and credentials');
select throws_ok('select workspace.native_connection_center(1)','22023','Choose a valid connection page.','bad page rejected at database');
select throws_ok('select workspace.native_connection_center(null)','22023','Choose a valid connection page.','null page rejected');
insert into p13_state select 'google',e from jsonb_array_elements(workspace.native_connection_center()->'external')e where e->>'family'='google';
insert into p13_state select 'active_assistant',e from jsonb_array_elements((workspace.native_connection_center()->'assistants')||(workspace.native_connection_center(25)->'assistants'))e where e->>'state'='authorized';
reset role;
update workspace.mcp_authorizations set last_verified_at=clock_timestamp(),connected_at=clock_timestamp(),authorization_valid_after=clock_timestamp()
 where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and client_id='13000000-0000-4000-8000-000000000001';
update workspace.integration_connections set last_success_at=clock_timestamp()
 where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider='gmail';
set local role authenticated;
select is((select e->>'revision' from jsonb_array_elements((workspace.native_connection_center()->'assistants')||(workspace.native_connection_center(25)->'assistants'))e where e->>'id'=(select value->>'id' from p13_state where key='active_assistant')),(select value->>'revision' from p13_state where key='active_assistant'),'routine assistant activity does not stale a disconnect review');
select is((select e->>'revision' from jsonb_array_elements(workspace.native_connection_center()->'external')e where e->>'family'='google'),(select value->>'revision' from p13_state where key='google'),'recorded provider activity does not stale a shared-family review');
reset role;
update workspace_private.mcp_oauth_resource_grants set authorized_at=clock_timestamp(),updated_at=clock_timestamp()
 where user_id='13111111-1111-4111-8111-111111111111' and client_id='13000000-0000-4000-8000-000000000001';
set local role authenticated;
select isnt((select e->>'revision' from jsonb_array_elements((workspace.native_connection_center()->'assistants')||(workspace.native_connection_center(25)->'assistants'))e where e->>'id'=(select value->>'id' from p13_state where key='active_assistant')),(select value->>'revision' from p13_state where key='active_assistant'),'actual new consent invalidates the earlier review');
select is((select value->'providers' from p13_state where key='google'),'["gmail","google_calendar","google_drive"]'::jsonb,'Google impact includes all shared-family consumers');
select throws_ok(format('select workspace.native_disconnect_connection(%L,%L,%L,%L,false)','external',(select value->>'id' from p13_state where key='google'),(select value->>'revision' from p13_state where key='google'),'13000000-0000-4000-8000-000000000011'),'22023','Review and confirm the exact connection change.','explicit confirmation required');
select set_config('request.jwt.claims','{"sub":"13222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is((workspace.native_connection_center()->>'assistantTotal')::int,0,'other owner sees no foreign grants');
select is(jsonb_array_length(workspace.native_connection_center()->'external'),0,'other owner sees no foreign vault state');
select throws_ok(format('select workspace.native_disconnect_connection(%L,%L,%L,%L,true)','external',(select value->>'id' from p13_state where key='google'),(select value->>'revision' from p13_state where key='google'),'13000000-0000-4000-8000-000000000011'),'42501','This connection is unavailable.','foreign disconnect denied');
select set_config('request.jwt.claims','{"sub":"13111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"hostile"}',true);
select throws_ok('select workspace.native_connection_center()','42501','Use the native Workspace connection center.','OAuth inventory denied');
select throws_ok(format('select workspace.native_disconnect_connection(%L,%L,%L,%L,true)','external',(select value->>'id' from p13_state where key='google'),(select value->>'revision' from p13_state where key='google'),'13000000-0000-4000-8000-000000000011'),'42501','Use the native Workspace connection center.','OAuth mutation denied');
reset role;
update workspace_private.integration_credentials set token_expires_at=now()+interval '1 hour' where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.personal_plans set status='suspended' where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select is((workspace.native_connection_center()->>'authorizedTotal')::int,0,'suspended plan blocks access claims');
select is((workspace.native_connection_center()->>'activeGrantTotal')::int,2,'suspension does not hide outstanding grants');
select throws_ok(format('select workspace.native_disconnect_connection(%L,%L,%L,%L,true)','external',(select value->>'id' from p13_state where key='google'),(select value->>'revision' from p13_state where key='google'),'13000000-0000-4000-8000-000000000011'),'40001','Connection changed. Refresh and review again.','stale credential review rejected');
update p13_state set value=(select e from jsonb_array_elements(workspace.native_connection_center()->'external')e where e->>'family'='google') where key='google';
insert into p13_state select 'receipt',workspace.native_disconnect_connection('external',value->>'id',value->>'revision','13000000-0000-4000-8000-000000000011',true) from p13_state where key='google';
select is((select value->>'scope' from p13_state where key='receipt'),'workspace_credential_family','disconnect remains available after plan suspension');
select is((select value from p13_state where key='receipt'),(select workspace.native_disconnect_connection('external',value->>'id',value->>'revision','13000000-0000-4000-8000-000000000011',true) from p13_state where key='google'),'same review retry returns exact receipt');
reset role;
select is((select count(*)::int from workspace_private.integration_credentials where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'shared credential removed');
select is((select count(*)::int from workspace.integration_connections where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider in ('gmail','google_calendar','google_drive') and status='disconnected'),3,'all Google metadata disconnected');
select is((select status from workspace.integration_connections where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider='slack'),'connected','other family left unchanged');
insert into workspace_private.integration_credentials(workspace_id,provider_family,ciphertext,key_version,created_by)
values('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','google',repeat('fictional-new-credential-',3),1,'13111111-1111-4111-8111-111111111111');
set local role authenticated;
select is((select value from p13_state where key='receipt'),(select workspace.native_disconnect_connection('external',value->>'id',value->>'revision','13000000-0000-4000-8000-000000000011',true) from p13_state where key='google'),'retry after new credential returns old receipt, not new mutation');
select throws_ok(format('select workspace.native_disconnect_connection(%L,%L,%L,%L,true)','external',(select value->>'id' from p13_state where key='google'),repeat('a',64),'13000000-0000-4000-8000-000000000011'),'40001','This request was used for a different review.','request reuse conflict denied');
reset role;
select is((select count(*)::int from workspace_private.integration_credentials where workspace_id='13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'new credential survives old retry');
set local role authenticated;
insert into p13_state select 'orphan',e from jsonb_array_elements((workspace.native_connection_center()->'assistants')||(workspace.native_connection_center(25)->'assistants'))e where e->>'id'=encode(extensions.digest('13aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:assistant:13000000-0000-4000-8000-000000000002','sha256'),'hex');
insert into p13_state select 'orphan_receipt',workspace.native_disconnect_connection('assistant',value->>'id',value->>'revision','13000000-0000-4000-8000-000000000012',true) from p13_state where key='orphan';
select is((select value->>'scope' from p13_state where key='orphan_receipt'),'workspace_assistant_access','orphan consent can be revoked without registration or active plan');
reset role;
select is((select status from workspace_private.mcp_oauth_resource_grants where user_id='13111111-1111-4111-8111-111111111111' and client_id='13000000-0000-4000-8000-000000000002'),'revoked','orphan grant actually revoked');
select is((select status from workspace_private.mcp_oauth_resource_grants where user_id='13111111-1111-4111-8111-111111111111' and client_id='13000000-0000-4000-8000-000000000001'),'active','different assistant grant unchanged');
select is((select count(*)::int from auth.oauth_clients where id='13000000-0000-4000-8000-000000000002'),1,'provider Auth catalog not deleted');
select * from finish();
rollback;
