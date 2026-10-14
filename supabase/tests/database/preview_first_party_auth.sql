-- Disposable local Supabase only. Synthetic UUIDs and example.invalid users.
-- No replacement Auth schema, helpers, service-role admission, or durable fixtures.
begin;
select no_plan();

select ok(not has_function_privilege('anon', 'workspace.ensure_personal_workspace()', 'execute'), 'anonymous provisioning remains denied');
select ok(has_function_privilege('authenticated', 'workspace.ensure_personal_workspace()', 'execute'), 'intended authenticated role retains provisioning');
select is((select count(*) from auth.users), 0::bigint, 'disposable database starts without hosted users');

insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid,
       ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'authenticated','authenticated','preview-proof-' || n || '@example.invalid','{}','{}',now(),now()
from generate_series(1,6) n;
insert into auth.oauth_clients(id,registration_type,client_type,token_endpoint_auth_method,redirect_uris,grant_types)
select ('f2000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'dynamic','public','none','https://synthetic.example.invalid/callback','authorization_code,refresh_token'
from generate_series(1,3) n;
insert into auth.sessions(id,user_id,oauth_client_id,created_at,updated_at)
select ('f3000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'f2000000-0000-4000-8000-000000000001'::uuid,now(),now()
from generate_series(1,5) n;
insert into auth.sessions(id,user_id,oauth_client_id,created_at,updated_at)
values ('f3000000-0000-4000-8000-000000000099','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002',now(),now());

-- Incompatible and broken graphs are created by fixture setup, never by an
-- authenticated positive test, and must survive every denied operation unchanged.
insert into workspace.user_profiles(user_id,canonical_user_id,entry_provider) values
 ('f1000000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000003','first-party:workspace-preview'),
 ('f1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','first-party:workspace-preview'),
 ('f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005','custom:synthetic-other');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id)
values ('f5000000-0000-4000-8000-000000000004','personal','Synthetic broken ownership','f1000000-0000-4000-8000-000000000004');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status)
values ('f5000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','member','active');

select set_config('request.preview_a_claims',
 '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aud":"authenticated","iss":"https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1","client_id":"f2000000-0000-4000-8000-000000000001","session_id":"f3000000-0000-4000-8000-000000000001"}',true);
select set_config('request.preview_b_claims',
 (current_setting('request.preview_a_claims')::jsonb || '{"sub":"f1000000-0000-4000-8000-000000000002","session_id":"f3000000-0000-4000-8000-000000000002"}'::jsonb)::text,true);
delete from workspace_private.product_settings where setting_key='workspace_preview_browser_client_id';

set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.preview_a_claims'),true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'missing pin denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'missing pin exposes no workspace');
reset role;
select is((select count(*) from workspace.user_profiles where user_id='f1000000-0000-4000-8000-000000000001'),0::bigint,'missing-pin denial created no profile');
insert into workspace_private.product_settings(setting_key,setting_value)
values ('workspace_preview_browser_client_id','f2000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(current_user::text,'authenticated','positive provisioning uses authenticated role');
select is((select rolbypassrls from pg_roles where rolname=current_user),false,'positive role cannot bypass RLS');
select set_config('request.preview_workspace_a',(select id::text from workspace.ensure_personal_workspace()),true);
select is((select canonical_user_id from workspace.user_profiles where user_id=auth.uid()),auth.uid(),'canonical identity is same-project authenticated UUID');
select is((select entry_provider from workspace.user_profiles where user_id=auth.uid()),'first-party:workspace-preview','first-party marker is distinct from Custom Provider');
select is((select owner_user_id from workspace.workspaces where id=current_setting('request.preview_workspace_a')::uuid),auth.uid(),'provisioned workspace belongs to caller');
select is((select count(*) from workspace.workspace_memberships where workspace_id=current_setting('request.preview_workspace_a')::uuid and user_id=auth.uid() and role='owner' and status='active'),1::bigint,'provisioning creates one active owner membership');
select is((select id::text from workspace.ensure_personal_workspace()),current_setting('request.preview_workspace_a'),'repeat provisioning returns same workspace');
select is((select count(*) from workspace.personal_plans),1::bigint,'repeat provisioning creates one plan');
select is((select count(*) from workspace.personal_onboarding),1::bigint,'repeat provisioning creates one onboarding record');
select lives_ok($q$insert into workspace.tasks(id,workspace_id,title,created_by) values ('f4000000-0000-4000-8000-000000000001',current_setting('request.preview_workspace_a')::uuid,'Synthetic A task',auth.uid())$q$,'A can write an own-workspace task');
select set_config('request.jwt.claims',current_setting('request.preview_b_claims'),true);
select set_config('request.preview_workspace_b',(select id::text from workspace.ensure_personal_workspace()),true);
select isnt(current_setting('request.preview_workspace_a'),current_setting('request.preview_workspace_b'),'B provisions a separate owned workspace');
select is((select canonical_user_id from workspace.user_profiles where user_id=auth.uid()),auth.uid(),'B canonical UUID is B');
select lives_ok($q$insert into workspace.tasks(id,workspace_id,title,created_by) values ('f4000000-0000-4000-8000-000000000002',current_setting('request.preview_workspace_b')::uuid,'Synthetic B task',auth.uid())$q$,'B can write an own-workspace task');

-- Two-way exposed-table RLS checks, including errors and zero-row updates.
select is((select count(*) from workspace.workspaces where id=current_setting('request.preview_workspace_a')::uuid),0::bigint,'B cannot read A workspace');
select is((select count(*) from workspace.tasks where workspace_id=current_setting('request.preview_workspace_a')::uuid),0::bigint,'B cannot read A tasks');
with changed as (update workspace.tasks set title='unauthorized B overwrite' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'B cannot update A task') from changed;
select throws_ok($q$insert into workspace.tasks(workspace_id,title,created_by) values (current_setting('request.preview_workspace_a')::uuid,'unauthorized B insert',auth.uid())$q$,'42501',null,'B cannot insert into A workspace');
select set_config('request.jwt.claims',current_setting('request.preview_a_claims'),true);
select is((select count(*) from workspace.workspaces where id=current_setting('request.preview_workspace_b')::uuid),0::bigint,'A cannot read B workspace');
select is((select count(*) from workspace.tasks where workspace_id=current_setting('request.preview_workspace_b')::uuid),0::bigint,'A cannot read B tasks');
with changed as (update workspace.tasks set title='unauthorized A overwrite' where id='f4000000-0000-4000-8000-000000000002' returning id) select is(count(*),0::bigint,'A cannot update B task') from changed;
select throws_ok($q$insert into workspace.tasks(workspace_id,title,created_by) values (current_setting('request.preview_workspace_b')::uuid,'unauthorized A insert',auth.uid())$q$,'42501',null,'A cannot insert into B workspace');
with changed as (update workspace.workspaces set name='unauthorized rename' where id=current_setting('request.preview_workspace_b')::uuid returning id) select is(count(*),0::bigint,'A cannot rename B workspace') from changed;
reset role;
select is((select title from workspace.tasks where id='f4000000-0000-4000-8000-000000000001'),'Synthetic A task','unauthorized B write persisted no A change');
select is((select title from workspace.tasks where id='f4000000-0000-4000-8000-000000000002'),'Synthetic B task','unauthorized A write persisted no B change');
select is((select count(*) from workspace.tasks),2::bigint,'unauthorized inserts persisted no rows');

select set_config('request.preview_graph_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
delete from workspace_private.product_settings where setting_key='workspace_preview_browser_client_id';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.preview_a_claims'),true);
select is((select count(*) from workspace.workspaces),0::bigint,'missing pin hides an already provisioned workspace');
with changed as (update workspace.tasks set title='unauthorized missing-pin write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'missing pin denies existing workspace writes') from changed;
reset role;
insert into workspace_private.product_settings(setting_key,setting_value)
values ('workspace_preview_browser_client_id','f2000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"client_id":"f2000000-0000-4000-8000-000000000002"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'wrong client denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'wrong client exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'wrong client persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"iss":"https://wrong.example.invalid/auth/v1"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'wrong issuer denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'wrong issuer exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'wrong issuer persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"aud":"https://workspace.leademergence.com/api/mcp"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'wrong audience denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'wrong audience exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'wrong audience persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"role":"anon"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'wrong role claim denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'wrong role claim exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'wrong role claim persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"session_id":null}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'missing session denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'missing session exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'missing session persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"session_id":"f3000000-0000-4000-8000-000000000088"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'unknown session denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'unknown session exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'unknown session persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"session_id":"f3000000-0000-4000-8000-000000000002"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'other user''s session denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'other user''s session exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'other user''s session persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"session_id":"f3000000-0000-4000-8000-000000000099"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'other client''s session denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'other client''s session exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'other client''s session persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"sub":"f1000000-0000-4000-8000-000000000002"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'user mismatching session denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'user mismatching session exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'user mismatching session persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"workspace_mcp":true}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'MCP boolean marker denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'MCP boolean marker exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'MCP boolean marker persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"workspace_mcp":"true"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'MCP text marker denies provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'MCP text marker exposes no workspace');
with changed as (update workspace.tasks set title='unauthorized denied-token write' where id='f4000000-0000-4000-8000-000000000001' returning id) select is(count(*),0::bigint,'MCP text marker persists no task write') from changed;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb - 'sub')::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'missing user denies provisioning');
reset role;
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.preview_a_claims'),true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'active MCP grant cannot bypass browser provisioning');
select is((select count(*) from workspace.workspaces),0::bigint,'active MCP grant exposes no browser workspace');
reset role;
select is(workspace_private.custom_access_token_hook(jsonb_build_object('claims',current_setting('request.preview_a_claims')::jsonb)) #>> '{claims,workspace_mcp}','true','unchanged hook stamps an actual active MCP grant');
update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now()
where client_id='f2000000-0000-4000-8000-000000000001';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by)
values (current_setting('request.preview_workspace_a')::uuid,'f2000000-0000-4000-8000-000000000003','chatgpt','connected',now(),'f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims',
 (current_setting('request.preview_a_claims')::jsonb || '{"client_id":"f2000000-0000-4000-8000-000000000003","aud":"https://workspace.leademergence.com/api/mcp","workspace_mcp":true}'::jsonb || jsonb_build_object('iat',floor(extract(epoch from now()))))::text,true);
select is(workspace.mcp_verify_current_authority(),true,'distinct existing MCP client retains its authorization through its supported RPC');
select is((select count(*) from workspace.workspaces),0::bigint,'authorized MCP token cannot traverse browser RLS');
select lives_ok($q$select workspace.mcp_get_onboarding_state()$q$,'existing MCP onboarding RPC remains usable');
select set_config('request.jwt.claims',current_setting('request.preview_a_claims'),true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"sub":"f1000000-0000-4000-8000-000000000003","session_id":"f3000000-0000-4000-8000-000000000003"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'incompatible canonical linkage is rejected rather than repaired');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"sub":"f1000000-0000-4000-8000-000000000004","session_id":"f3000000-0000-4000-8000-000000000004"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'broken owner membership is rejected rather than repaired');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',(current_setting('request.preview_a_claims')::jsonb || '{"sub":"f1000000-0000-4000-8000-000000000005","session_id":"f3000000-0000-4000-8000-000000000005"}'::jsonb)::text,true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501',null,'incompatible provider linkage is rejected rather than repaired');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.preview_graph_before'),'all rejected contexts and incompatible graphs preserve exact graph fingerprint');

-- New legacy Custom Provider provisioning uses the existing trusted provider.
insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select 'f9000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000006',
 '{"sub":"f9000000-0000-4000-8000-000000000006"}'::jsonb,provider_identifier,now(),now(),now()
from workspace_private.trusted_identity_providers where enabled order by provider_identifier limit 1;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000006","aud":"authenticated","role":"authenticated"}',true);
select lives_ok($q$select workspace.ensure_personal_workspace()$q$,'legacy trusted Custom Provider can provision');
select is((select canonical_user_id::text from workspace.user_profiles where user_id=auth.uid()),'f9000000-0000-4000-8000-000000000006','legacy canonical provider UUID remains distinct from Workspace user');
select matches((select entry_provider from workspace.user_profiles where user_id=auth.uid()),'^custom:','legacy provider marker stays a Custom Provider');
select lives_ok($q$select workspace.ensure_personal_workspace()$q$,'legacy repeat provisioning remains usable');
reset role;
-- Current hosted legacy integrity contract, supplied by the director.
-- Each caller has an existing personal workspace. No reconciliation is allowed.
insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid,
 ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'authenticated','authenticated','legacy-integrity-' || n || '@example.invalid','{}','{}',now(),now()
from generate_series(7,12) n;
insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select 'f9000000-0000-4000-8000-' || lpad(n::text,12,'0'),
 ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 jsonb_build_object('sub','f9000000-0000-4000-8000-' || lpad(n::text,12,'0')),
 (select provider_identifier from workspace_private.trusted_identity_providers where enabled order by provider_identifier limit 1),
 now(),now(),now()
from generate_series(8,12) n;
insert into workspace.user_profiles(user_id,canonical_user_id,entry_provider)
select ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 case when n=8 then null
      when n=9 then 'f9000000-0000-4000-8000-000000000099'::uuid
      else ('f9000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid end,
 case when n=8 then null when n=11 then 'custom:synthetic-other'
      else (select provider_identifier from workspace_private.trusted_identity_providers where enabled order by provider_identifier limit 1) end
from generate_series(7,11) n;
insert into workspace.workspaces(id,workspace_type,name,owner_user_id)
select ('f5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'personal','Synthetic legacy integrity ' || n,
 ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
from generate_series(7,12) n;
insert into workspace.workspace_memberships(workspace_id,user_id,role,status,revoked_at)
select ('f5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'owner',case when n=10 then 'revoked' else 'active' end,
 case when n=10 then now() else null end
from generate_series(7,12) n;

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000007","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','A verified Lead Emergence identity is required.','existing legacy workspace with zero trusted identities is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'zero trusted identities: complete existing graph is unchanged');

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000008","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','Personal Workspace integrity requires review.','existing legacy workspace with missing canonical/provider linkage is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'missing canonical/provider linkage: complete existing graph is unchanged');

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000009","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','Personal Workspace integrity requires review.','existing legacy workspace with incompatible canonical linkage is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'incompatible canonical linkage: complete existing graph is unchanged');

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000010","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','Personal Workspace integrity requires review.','existing legacy workspace with broken active owner membership is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'broken active owner membership: complete existing graph is unchanged');

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000011","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','Personal Workspace integrity requires review.','existing legacy workspace with incompatible provider linkage is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'incompatible provider linkage: complete existing graph is unchanged');

select set_config('request.legacy_integrity_before',md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000012","aud":"authenticated","role":"authenticated"}',true);
select throws_ok($q$select workspace.ensure_personal_workspace()$q$,'42501','Personal Workspace integrity requires review.','existing legacy workspace with missing profile is denied');
reset role;
select is(md5(jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from workspace.user_profiles p),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by id) from workspace.workspaces w),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace.workspace_memberships m),
 'plans',(select jsonb_agg(to_jsonb(p) order by workspace_id) from workspace.personal_plans p),
 'onboarding',(select jsonb_agg(to_jsonb(o) order by workspace_id) from workspace.personal_onboarding o),
 'tasks',(select jsonb_agg(to_jsonb(t) order by id) from workspace.tasks t)
)::text),current_setting('request.legacy_integrity_before'),'missing profile: complete existing graph is unchanged');
select * from finish();
rollback;
