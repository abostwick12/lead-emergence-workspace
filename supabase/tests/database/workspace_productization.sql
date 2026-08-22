begin;

select plan(53);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '61111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'product.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '62222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'product.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('61111111-1111-4111-8111-111111111111', 'Product Alice'),
  ('62222222-2222-4222-8222-222222222222', 'Product Bob');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Product Alice workspace', '61111111-1111-4111-8111-111111111111'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Product Bob workspace', '62222222-2222-4222-8222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '61111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '62222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '61111111-1111-4111-8111-111111111111', 'personal'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '62222222-2222-4222-8222-222222222222', 'personal');

insert into workspace.personal_onboarding (workspace_id, user_id, state, setup_method, selected_assistant, created_by) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '61111111-1111-4111-8111-111111111111', 'onboarding_in_progress', 'ai', 'chatgpt', '61111111-1111-4111-8111-111111111111'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '62222222-2222-4222-8222-222222222222', 'workspace_ready', 'native', null, '62222222-2222-4222-8222-222222222222');

insert into workspace.personal_configuration_items (id, workspace_id, area, content, epistemic_status, source_interface, created_by) values
  ('6a000000-0000-4000-8000-000000000001', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'responsibilities', '{"text":"Alice responsibility"}', 'user_confirmed', 'native', '61111111-1111-4111-8111-111111111111'),
  ('6b000000-0000-4000-8000-000000000001', '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'responsibilities', '{"text":"Bob responsibility"}', 'user_confirmed', 'native', '62222222-2222-4222-8222-222222222222');

insert into workspace.tasks (id, workspace_id, title, created_by) values
  ('6a100000-0000-4000-8000-000000000001', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice private task', '61111111-1111-4111-8111-111111111111'),
  ('6b100000-0000-4000-8000-000000000001', '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob private task', '62222222-2222-4222-8222-222222222222');

insert into workspace.mcp_authorizations (workspace_id, client_id, assistant_provider, status, connected_at, created_by) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice-mcp-client', 'chatgpt', 'connected', now(), '61111111-1111-4111-8111-111111111111'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob-mcp-client', 'claude', 'connected', now(), '62222222-2222-4222-8222-222222222222');

select set_config(
  'request.test_mcp_resource_uri',
  (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  true
);

select is((select relrowsecurity from pg_class where oid = 'workspace.personal_plans'::regclass), true, 'Personal plans use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.personal_onboarding'::regclass), true, 'onboarding uses RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.personal_configuration_items'::regclass), true, 'shared configuration uses RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.mcp_authorizations'::regclass), true, 'MCP metadata uses RLS');
select is(has_table_privilege('anon', 'workspace.personal_plans', 'select'), false, 'anon has no Personal plan access');
select is(has_function_privilege('anon', 'workspace.mcp_get_onboarding_state()', 'execute'), false, 'anon cannot invoke MCP tools');
select is(has_function_privilege('authenticated', 'workspace_private.assign_personal_plan(uuid,text,text)', 'execute'), false, 'normal users cannot assign Personal plans');
select is(has_function_privilege('service_role', 'workspace_private.assign_personal_plan(uuid,text,text)', 'execute'), true, 'auditable plan administration is restricted to the service role');
select is(has_table_privilege('authenticated', 'workspace.personal_onboarding', 'update'), false, 'onboarding transitions cannot bypass controlled RPCs');
select is(has_table_privilege('authenticated', 'workspace.mcp_authorizations', 'update'), false, 'MCP state cannot be re-enabled through direct table updates');
select is(has_table_privilege('authenticated', 'workspace.integration_connections', 'insert'), false, 'browser clients cannot manufacture external connector state');

update workspace.workspace_memberships set status = 'revoked', revoked_at = now()
where workspace_id = '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and user_id = '62222222-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"62222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.ensure_personal_workspace()$sql$,
  '42501', 'Personal Workspace authorization is not active.',
  'sign-in provisioning cannot reactivate a revoked product-local membership'
);
select throws_ok(
  $sql$select workspace.select_personal_setup_method('native', null)$sql$,
  '42501', 'This setup method is not available for the current Personal plan.',
  'revoked membership cannot bypass product-local authorization through a setup RPC'
);
reset role;
update workspace.workspace_memberships set status = 'active', revoked_at = null
where workspace_id = '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and user_id = '62222222-2222-4222-8222-222222222222';

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  '63333333-3333-4333-8333-333333333333',
  '61111111-1111-4111-8111-111111111111',
  '{"sub":"63333333-3333-4333-8333-333333333333","email":"product.alice@example.invalid"}'::jsonb,
  provider_identifier,
  now(), now(), now()
from workspace_private.trusted_identity_providers
where enabled
order by provider_identifier
limit 1;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select lives_ok($sql$select workspace.ensure_personal_workspace()$sql$, 'existing active owner can reconcile a verified Entry identity');
select is(
  (select canonical_user_id from workspace.user_profiles where user_id = '61111111-1111-4111-8111-111111111111'),
  '63333333-3333-4333-8333-333333333333'::uuid,
  'existing owner stores the canonical Entry identity without changing Workspace ownership'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);

select is((select count(*) from workspace.personal_plans), 1::bigint, 'Alice sees only her plan');
select is((select count(*) from workspace.personal_onboarding), 1::bigint, 'Alice sees only her onboarding state');
select is((select count(*) from workspace.personal_configuration_items), 1::bigint, 'Alice sees only her configuration');
select is((select count(*) from workspace.personal_configuration_items where workspace_id = '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'Alice cannot read Bob configuration');
select is(workspace.select_personal_setup_method('native', null) ->> 'setup_method', 'native', 'native and AI setup switch through a controlled transition');
select throws_ok(
  $sql$update workspace.personal_onboarding set state = 'workspace_ready' where workspace_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$,
  '42501', 'permission denied for table personal_onboarding',
  'direct API cannot forge onboarding completion'
);
select is((select plan_key from workspace.personal_plans), 'personal', 'Alice resolves her included Personal plan');
select is((select count(*) from workspace.personal_plans where workspace_id = '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'Alice cannot inherit Bob plan');
select throws_ok(
  $sql$insert into workspace.personal_configuration_items (workspace_id, area, content, epistemic_status, source_interface, created_by) values ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'priorities', '{"text":"intrusion"}', 'user_confirmed', 'native', '61111111-1111-4111-8111-111111111111')$sql$,
  '42501', 'new row violates row-level security policy for table "personal_configuration_items"',
  'Alice cannot write Bob configuration'
);
select throws_ok(
  $sql$select workspace.complete_personal_onboarding()$sql$,
  '22023', 'Confirm at least three setup areas before completing onboarding.',
  'native completion requires enough confirmed context'
);
select lives_ok(
  $sql$insert into workspace.personal_configuration_items (workspace_id, area, content, epistemic_status, source_interface, created_by) values
    ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'areas_of_attention', '{"text":"Alice attention"}', 'user_confirmed', 'native', '61111111-1111-4111-8111-111111111111'),
    ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'priorities', '{"text":"Alice priority"}', 'user_confirmed', 'native', '61111111-1111-4111-8111-111111111111')$sql$,
  'Alice can populate the shared native configuration model'
);
select lives_ok($sql$select workspace.complete_personal_onboarding()$sql$, 'native onboarding completes with three confirmed areas');
select is((select state from workspace.personal_onboarding), 'workspace_ready', 'completed native onboarding is resumably ready');

reset role;
update workspace.personal_plans set status = 'suspended' where workspace_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.complete_personal_onboarding()$sql$,
  '42501', 'Personal Workspace access is not available.',
  'downgrade disables privileged capability server-side'
);
select is((select count(*) from workspace.personal_configuration_items), 3::bigint, 'downgrade preserves Personal configuration data');
select is((select count(*) from workspace.tasks), 1::bigint, 'downgrade keeps existing task data readable');
select throws_ok(
  $sql$insert into workspace.tasks (workspace_id, title, created_by) values ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bypass while suspended', '61111111-1111-4111-8111-111111111111')$sql$,
  '42501', 'new row violates row-level security policy for table "tasks"',
  'suspended plan denies direct task API writes'
);

reset role;
update workspace.personal_plans set status = 'active' where workspace_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace.plan_capabilities set enabled = false where plan_key = 'personal' and capability_key = 'tasks';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$insert into workspace.tasks (workspace_id, title, created_by) values ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bypass excluded task', '61111111-1111-4111-8111-111111111111')$sql$,
  '42501', 'new row violates row-level security policy for table "tasks"',
  'excluded task capability denies direct API writes'
);
select is((select count(*) from workspace.tasks), 1::bigint, 'capability removal preserves existing task data');

select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1900000000)::text, true);
select is(
  pg_catalog.jsonb_array_length(workspace.mcp_get_leadership_state() -> 'open_tasks'),
  0,
  'MCP cannot bypass an excluded task capability'
);

reset role;
update workspace.plan_capabilities set enabled = false where plan_key = 'personal' and capability_key = 'workspace_mcp';
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1900000000)::text, true);
select throws_ok(
  $sql$select workspace.mcp_get_onboarding_state()$sql$,
  '42501', 'The AI assistant connection is not included for this Workspace.',
  'MCP cannot bypass an excluded MCP capability'
);

reset role;
update workspace.plan_capabilities set enabled = true where plan_key = 'personal' and capability_key in ('tasks', 'workspace_mcp');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select lives_ok(
  $sql$insert into workspace.tasks (workspace_id, title, created_by) values ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Enabled task', '61111111-1111-4111-8111-111111111111')$sql$,
  'upgrade enables the task capability server-side'
);
select is((select count(*) from workspace.tasks), 2::bigint, 'enabled capability creates only Alice task data');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1900000000)::text, true);

select is((select count(*) from workspace.tasks), 0::bigint, 'MCP OAuth token cannot traverse ordinary task RLS');
select is((select count(*) from workspace.personal_configuration_items), 0::bigint, 'MCP OAuth token cannot traverse configuration RLS');
select is(workspace.mcp_get_onboarding_state() ->> 'state', 'workspace_ready', 'connected MCP can use its controlled onboarding tool');
select is(workspace.mcp_get_workspace_setup() ->> 'workspace_id', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'controlled MCP setup is bound to Alice workspace');
select is(workspace.mcp_save_user_reported_setup('commitments', 'Alice reported commitment') ->> 'epistemic_status', 'user_reported', 'MCP stores user statements as user-reported');
select is(workspace.mcp_suggest_workspace_configuration('value_focus', 'Suggested value focus') ->> 'requires_user_confirmation', 'true', 'MCP suggestions require confirmation');
select is((workspace.mcp_confirm_workspace_configuration(array['6b000000-0000-4000-8000-000000000001']::uuid[]) ->> 'confirmed_count')::integer, 0, 'Alice cannot confirm Bob configuration');

select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'bob-mcp-client', 'workspace_mcp', 'true', 'iat', 1900000000)::text, true);
select throws_ok(
  $sql$select workspace.mcp_get_workspace_setup()$sql$,
  '42501', 'This AI assistant connection is disconnected or requires authorization.',
  'Alice cannot use Bob MCP client authorization'
);

select set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","aud":"https://wrong.example/api/mcp","client_id":"alice-mcp-client","workspace_mcp":"true","iat":1900000000}', true);
select throws_ok(
  $sql$select workspace.mcp_get_workspace_setup()$sql$,
  '42501', 'The MCP authorization is invalid or has the wrong audience.',
  'wrong-audience MCP token is denied'
);

reset role;
update workspace.mcp_authorizations set status = 'disconnected', disconnected_at = now() where workspace_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1700000000)::text, true);
select throws_ok(
  $sql$select workspace.mcp_get_onboarding_state()$sql$,
  '42501', 'This AI assistant connection is disconnected or requires authorization.',
  'disconnected MCP cannot make privileged calls'
);

select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1900000100)::text, true);
select is(workspace.mcp_register_connection() ->> 'status', 'connected', 'a newly issued authorization can reconnect the same MCP client');
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '61111111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aud', current_setting('request.test_mcp_resource_uri'), 'client_id', 'alice-mcp-client', 'workspace_mcp', 'true', 'iat', 1700000000)::text, true);
select throws_ok(
  $sql$select workspace.mcp_get_onboarding_state()$sql$,
  '42501', 'This AI assistant connection is disconnected or requires authorization.',
  'an older bearer remains denied after reconnect'
);

reset role;
select is(
  workspace_private.custom_access_token_hook('{"claims":{"sub":"61111111-1111-4111-8111-111111111111","aud":"authenticated"}}'::jsonb) #>> '{claims,aud}',
  'authenticated',
  'direct session audience is unchanged by the OAuth hook'
);
select is(
  workspace_private.custom_access_token_hook('{"claims":{"sub":"61111111-1111-4111-8111-111111111111","client_id":"alice-mcp-client"}}'::jsonb) #>> '{claims,aud}',
  current_setting('request.test_mcp_resource_uri'),
  'OAuth hook binds MCP token to the canonical resource'
);
select is(
  workspace_private.custom_access_token_hook('{"claims":{"sub":"61111111-1111-4111-8111-111111111111","client_id":"alice-mcp-client"}}'::jsonb) #>> '{claims,workspace_mcp}',
  'true',
  'OAuth hook marks only OAuth client tokens as Workspace MCP tokens'
);

select * from finish();
rollback;
