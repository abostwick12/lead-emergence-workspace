begin;
select no_plan();

-- Synthetic authority fixtures are confined to this rolled-back transaction.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','76111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.list.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name)
values ('76111111-1111-4111-8111-111111111111','Synthetic bundle-list caller');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id)
values ('76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic bundle-list workspace','76111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status)
values ('76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key)
values ('76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference)
values ('76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','76111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-list-76');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by)
values ('76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'76111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
update workspace_private.product_settings set setting_value='false' where setting_key='sotf_v1_daily_brief_enabled';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('76111111-1111-4111-8111-111111111111','76cccccc-cccc-4ccc-8ccc-cccccccccccc','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
select set_config('request.sotf_list_claims',jsonb_build_object(
  'sub','76111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','76cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'workspace_mcp','true','iat',floor(extract(epoch from clock_timestamp()))
)::text,true);

select is(has_function_privilege('anon','workspace.sotf_v1_bundle_list_access_state()','execute'),false,'anon cannot execute list authority');
select is(has_function_privilege('authenticated','workspace.sotf_v1_bundle_list_access_state()','execute'),true,'authenticated can execute list authority');
select is((select not exists (
  select 1 from pg_proc as p
  join pg_namespace as n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) as grant_row
  where n.nspname='workspace' and p.proname='sotf_v1_bundle_list_access_state'
    and grant_row.grantee=0 and grant_row.privilege_type='EXECUTE'
)),true,'PUBLIC has no execute grant');
select is((select p.prosecdef and p.provolatile='s' and 'search_path=""'=any(p.proconfig)
  from pg_proc as p join pg_namespace as n on n.oid=p.pronamespace
  where n.nspname='workspace' and p.proname='sotf_v1_bundle_list_access_state'),true,
  'list authority is stable security definer with empty search path');
select is((select setting_value from workspace_private.product_settings where setting_key='sotf_v1_daily_brief_enabled'),'false','daily-brief database gate stays off');

set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_list_claims'),true);
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','active','entitled ChatGPT caller has list authority while daily-brief gate is off');
select is(workspace.sotf_v1_bundle_list_access_state()->>'workspace_id','76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active list authority is bound to the current workspace');
select is(workspace.sotf_v1_access_state()->>'state','service_unavailable','existing daily-brief authority stays gated off');
select throws_ok($sql$select workspace.sotf_v1_authorize_workflow_retrieval('transition.daily_brief','1.0.0')$sql$,'42501','sotf_v1:service_unavailable','workflow retrieval stays gated');
select throws_ok($sql$select workspace.sotf_v1_get_daily_brief_authority('transition.daily_brief','1.0.0','2026-09-29','UTC')$sql$,'42501','sotf_v1:service_unavailable','daily-brief authority stays gated');
select throws_ok($sql$select workspace.sotf_v1_list_daily_brief_outcomes('1.0.0')$sql$,'42501','sotf_v1:service_unavailable','outcome list stays gated');
select throws_ok($sql$select workspace.sotf_v1_probe_daily_brief_outcome('{}'::jsonb)$sql$,'42501','sotf_v1:service_unavailable','outcome probe stays gated');
select throws_ok($sql$select workspace.sotf_v1_record_daily_brief_outcome('{}'::jsonb,null::text)$sql$,'42501','sotf_v1:service_unavailable','outcome write stays gated');
reset role;

-- Earlier MCP binding checks retain their existing access_denied result.
update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='core_workspace';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','access_denied','missing core_workspace is denied by MCP binding');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='workspace_mcp';
update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='workspace_mcp';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','access_denied','missing workspace_mcp is denied by MCP binding');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='workspace_mcp';
update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='workspace_mcp';

-- The remaining three capabilities reach the aggregate bounded error.
update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='career';
update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='career';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','capability_unavailable','missing career is reported');
select is(workspace.sotf_v1_bundle_list_access_state()->'missing_capabilities','["career"]'::jsonb,'career is named as missing');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='career';
update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='career';
update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='daily_brief';
update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='daily_brief';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','capability_unavailable','missing daily_brief is reported');
select is(workspace.sotf_v1_bundle_list_access_state()->'missing_capabilities','["daily_brief"]'::jsonb,'daily_brief is named as missing');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='daily_brief';
update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='daily_brief';
update workspace.bundle_capabilities set enabled=false where bundle_key='sotf_transition' and capability_key='agentic_workflows';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','capability_unavailable','missing agentic_workflows is reported');
select is(workspace.sotf_v1_bundle_list_access_state()->'missing_capabilities','["agentic_workflows"]'::jsonb,'agentic_workflows is named as missing');
reset role;
update workspace.bundle_capabilities set enabled=true where bundle_key='sotf_transition' and capability_key='agentic_workflows';

update workspace.personal_plans set status='suspended' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','inactive Personal plan is rejected');
reset role;
update workspace.personal_plans set status='active' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.bundle_entitlements set starts_at=now()+interval '1 day' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','future entitlement does not list');
reset role;
update workspace.bundle_entitlements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','expired entitlement does not list');
reset role;
update workspace.bundle_entitlements set expires_at=null,revoked_at=now(),revocation_reason='Synthetic list authority test' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','revoked entitlement does not list');
reset role;
update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.bundle_definitions set availability_status='unavailable' where bundle_key='sotf_transition';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','inactive bundle definition does not list');
reset role;
update workspace.bundle_definitions set availability_status='active' where bundle_key='sotf_transition';

update workspace.mcp_authorizations set assistant_provider='claude' where client_id='76cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','incompatible_contract','non-ChatGPT connection is incompatible');
reset role;
update workspace.mcp_authorizations set assistant_provider='chatgpt' where client_id='76cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_set(current_setting('request.sotf_list_claims')::jsonb,'{client_id}','""'::jsonb)::text,true);
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','access_denied','missing MCP client identity is denied');
select set_config('request.jwt.claims',jsonb_set(current_setting('request.sotf_list_claims')::jsonb,'{workspace_mcp}','"false"'::jsonb)::text,true);
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','access_denied','invalid MCP resource request is denied');
select set_config('request.jwt.claims',current_setting('request.sotf_list_claims'),true);
reset role;
update workspace.workspace_memberships set status='revoked' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','access_denied','inactive owner membership is denied');
reset role;
update workspace.workspace_memberships set status='active' where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from workspace.bundle_entitlements where workspace_id='76aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.sotf_v1_bundle_list_access_state()->>'state','entitlement_required','caller with no SOTF entitlement receives the empty-list authority state');
reset role;

select * from finish();
rollback;
