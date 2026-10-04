-- LOCAL ONLY: supabase test db --local supabase/tests/database/assistant_host_confirmation.sql
-- Run on a fresh isolated Workspace Supabase database. Identifiers are pinned
-- scope identifiers, but owners, client metadata and all content are synthetic.
-- The shared Auth binding catalog is a local contract fixture, never a migration.
begin;
select no_plan();
do $$ begin
  if to_regclass('private.oauth_product_client_bindings') is not null then
    raise exception 'This fixture requires a fresh local Workspace database, not the shared hosted authority database.';
  end if;
end $$;
create schema if not exists private;
create table private.oauth_product_client_bindings (
  client_id uuid primary key, contract_key text, product_key text, resource_uri text,
  audience_uri text, status text, bound_by_user_id uuid, revoked_at timestamptz
);
revoke all on private.oauth_product_client_bindings from public, anon, authenticated;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','64111111-1111-4111-8111-111111111111','authenticated','authenticated','host.owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','64222222-2222-4222-8222-222222222222','authenticated','authenticated','host.other@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
 ('64111111-1111-4111-8111-111111111111','Synthetic owner'),('64222222-2222-4222-8222-222222222222','Other synthetic owner');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
 ('ef17ae83-747b-4470-8dc5-08eeec86989f','personal','Synthetic approved workspace','64111111-1111-4111-8111-111111111111'),
 ('64bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Other synthetic workspace','64222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
 ('ef17ae83-747b-4470-8dc5-08eeec86989f','64111111-1111-4111-8111-111111111111','owner','active'),
 ('64bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','64222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
 ('ef17ae83-747b-4470-8dc5-08eeec86989f','64111111-1111-4111-8111-111111111111','personal');
insert into workspace.personal_onboarding(workspace_id,user_id,selected_assistant)
values ('ef17ae83-747b-4470-8dc5-08eeec86989f','64111111-1111-4111-8111-111111111111','claude');
insert into workspace.mcp_authorizations(id,workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
 ('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','ef17ae83-747b-4470-8dc5-08eeec86989f','61940a73-fafe-4b96-ab8e-1de7d4cafbac','other','connected',now(),'64111111-1111-4111-8111-111111111111'),
 ('64dddddd-dddd-4ddd-8ddd-dddddddddddd','ef17ae83-747b-4470-8dc5-08eeec86989f','64cccccc-cccc-4ccc-8ccc-cccccccccccc','claude','connected',now(),'64111111-1111-4111-8111-111111111111');
insert into auth.oauth_clients(id,registration_type,client_type,token_endpoint_auth_method,redirect_uris,grant_types)
values ('61940a73-fafe-4b96-ab8e-1de7d4cafbac','dynamic','public','none',array['http://localhost/synthetic-callback'],array['authorization_code','refresh_token']);
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('64111111-1111-4111-8111-111111111111','61940a73-fafe-4b96-ab8e-1de7d4cafbac','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
insert into private.oauth_product_client_bindings(client_id,contract_key,product_key,resource_uri,audience_uri,status,bound_by_user_id)
values ('61940a73-fafe-4b96-ab8e-1de7d4cafbac','workspace','workspace','https://workspace.leademergence.com/api/mcp','https://workspace.leademergence.com/api/mcp','ACTIVE','64111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='false' where setting_key='personal_access_enforcement_enabled';

create temporary table host_baseline as select
 (select to_jsonb(c)-array['assistant_provider','updated_at'] from workspace.mcp_authorizations c where c.id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3') as connection,
 (select to_jsonb(c) from workspace.mcp_authorizations c where c.id='64dddddd-dddd-4ddd-8ddd-dddddddddddd') as other_connection,
 (select to_jsonb(g) from workspace_private.mcp_oauth_resource_grants g where g.client_id='61940a73-fafe-4b96-ab8e-1de7d4cafbac') as resource_grant,
 (select to_jsonb(b) from private.oauth_product_client_bindings b) as binding,
 (select count(*) from workspace.audit_events where event_type like 'assistant_host_%') as declarations;
grant select on host_baseline to authenticated;
select ok(not has_function_privilege('anon','workspace.confirm_personal_assistant_connection_host(uuid,text)','execute'),'anon has no RPC execution privilege');
select ok(not has_table_privilege('authenticated','workspace.audit_events','insert'),'owner cannot insert protected provenance');
select ok(not has_function_privilege('authenticated','workspace_private.audit_workspace_mutation()','execute'),'owner cannot invoke generic audit writer directly');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"64111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','claude')$sql$,'22023','This action is limited to the approved ChatGPT connection.','arbitrary provider labels are rejected');
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('64dddddd-dddd-4ddd-8ddd-dddddddddddd','chatgpt')$sql$,'22023','This action is limited to the approved ChatGPT connection.','another same-owner connection is rejected');
select throws_ok($sql$insert into workspace.audit_events(workspace_id,actor_user_id,event_type,entity_type,entity_id,metadata) values('ef17ae83-747b-4470-8dc5-08eeec86989f','64111111-1111-4111-8111-111111111111','assistant_host_confirmed','mcp_authorizations','ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','{}')$sql$,'42501','permission denied for table audit_events','hostile owner cannot forge protected confirmation');
select set_config('request.jwt.claims','{"sub":"64111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"61940a73-fafe-4b96-ab8e-1de7d4cafbac","workspace_mcp":"true"}',true);
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','A direct authenticated Workspace owner session is required.','OAuth/MCP owner token cannot classify itself');
select set_config('request.jwt.claims','{"sub":"64111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"61940a73-fafe-4b96-ab8e-1de7d4cafbac"}',true);
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','A direct authenticated Workspace owner session is required.','OAuth client marker alone denies direct-owner action');
select set_config('request.jwt.claims','{"sub":"64111111-1111-4111-8111-111111111111","role":"authenticated","workspace_mcp":"true"}',true);
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','A direct authenticated Workspace owner session is required.','MCP marker alone denies direct-owner action');
select set_config('request.jwt.claims','{"sub":"64222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','An active owner connection with Workspace capabilities is required.','other workspace owner cannot confirm target');
select set_config('request.jwt.claims','{"sub":"64111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
reset role;

-- Neither a pre-existing classification nor owner-writable telemetry authorizes withdrawal.
update workspace.mcp_authorizations set assistant_provider='chatgpt' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
set local role authenticated;
insert into workspace.product_events(workspace_id,event_name,event_context,created_by)
values ('ef17ae83-747b-4470-8dc5-08eeec86989f','ai_setup_selected','{"source":"confirm_personal_assistant_connection_host","connection_host_confirmation":true,"client_id":"61940a73-fafe-4b96-ab8e-1de7d4cafbac"}','64111111-1111-4111-8111-111111111111');
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','other')$sql$,'42501','Only this action''s unchanged ChatGPT confirmation can be withdrawn.','forged telemetry cannot authorize withdrawal');
reset role;
update workspace.mcp_authorizations set assistant_provider='other' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';

-- Required existing authority must remain active; the RPC cannot repair it.
update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now();
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','The existing assistant authorization is unavailable.','revoked grant is denied');
reset role;
update workspace_private.mcp_oauth_resource_grants set status='active',revoked_at=null;
update private.oauth_product_client_bindings set status='REVOKED',revoked_at=now();
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','The existing assistant authorization is unavailable.','revoked binding is denied');
reset role;
update private.oauth_product_client_bindings set status='ACTIVE',revoked_at=null,audience_uri='https://wrong.example.invalid/mcp';
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','The existing assistant authorization is unavailable.','wrong product audience is denied');
reset role;
update private.oauth_product_client_bindings set audience_uri='https://workspace.leademergence.com/api/mcp';
update workspace.mcp_authorizations set status='disconnected' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','An active owner connection with Workspace capabilities is required.','disconnected lifecycle cannot be revived');
reset role;
update workspace.mcp_authorizations set status='connected',assistant_provider='claude' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'22023','Only an unclassified connection can be confirmed as ChatGPT.','existing Claude classification cannot be overwritten');
reset role;
update workspace.mcp_authorizations set assistant_provider='other' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='workspace_mcp';
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'42501','An active owner connection with Workspace capabilities is required.','missing capability is denied');
select is((select count(*) from workspace.audit_events where event_type like 'assistant_host_%'),(select declarations from host_baseline),'denials add no declaration events');
select is((select assistant_provider from workspace.mcp_authorizations where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3'),'other','denials leave target classification unchanged');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='workspace_mcp';

set local role authenticated;
select is(workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')->>'changed','true','owner explicitly confirms existing target');
select is(workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')->>'changed','false','repeated confirmation is a no-op');
select is((select count(*) from workspace.audit_events where event_type='assistant_host_confirmed'),1::bigint,'exactly one protected confirmation event');
select is((select actor_user_id::text from workspace.audit_events where event_type='assistant_host_confirmed'),'64111111-1111-4111-8111-111111111111','confirmation is bound to actual owner');
select is((select entity_id::text from workspace.audit_events where event_type='assistant_host_confirmed'),'ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','confirmation is bound to exact row');
select is((select to_jsonb(c)-array['assistant_provider','updated_at'] from workspace.mcp_authorizations c where c.id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3'),(select connection from host_baseline),'all other target fields are preserved');
select is((select to_jsonb(c) from workspace.mcp_authorizations c where c.id='64dddddd-dddd-4ddd-8ddd-dddddddddddd'),(select other_connection from host_baseline),'other connection is unchanged');
select is((select selected_assistant from workspace.personal_onboarding where workspace_id='ef17ae83-747b-4470-8dc5-08eeec86989f'),'claude','Workspace preference is unchanged');
reset role;
select is((select to_jsonb(g) from workspace_private.mcp_oauth_resource_grants g where g.client_id='61940a73-fafe-4b96-ab8e-1de7d4cafbac'),(select resource_grant from host_baseline),'existing grant is unchanged');
select is((select to_jsonb(b) from private.oauth_product_client_bindings b),(select binding from host_baseline),'existing binding is unchanged');

-- Routine verification does not change identity/lifecycle, so it does not block withdrawal.
update workspace.mcp_authorizations set last_verified_at=clock_timestamp() where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
set local role authenticated;
select is(workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','other')->>'assistant_provider','other','guarded owner withdrawal restores prior provider');
select is((select count(*) from workspace.audit_events where event_type='assistant_host_confirmation_withdrawn'),1::bigint,'withdrawal records protected audit');
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','other')$sql$,'42501','Only this action''s unchanged ChatGPT confirmation can be withdrawn.','withdrawal cannot be replayed');
select lives_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','chatgpt')$sql$,'owner may make a new explicit declaration');
reset role;
update workspace.mcp_authorizations set authorization_valid_after=now()+interval '1 second' where id='ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3';
set local role authenticated;
select throws_ok($sql$select workspace.confirm_personal_assistant_connection_host('ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3','other')$sql$,'42501','Only this action''s unchanged ChatGPT confirmation can be withdrawn.','changed authorization boundary prevents stale withdrawal');
reset role;
select * from finish();
rollback;
