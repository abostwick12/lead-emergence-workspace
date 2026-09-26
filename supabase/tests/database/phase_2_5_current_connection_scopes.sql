-- Run against a disposable local database with the Workspace migrations applied.
-- Synthetic fixtures only; every change is rolled back.
begin;
select plan(16);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('25111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'scopes.alice@example.invalid', '{}', '{}'),
  ('25222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'scopes.bob@example.invalid', '{}', '{}');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Scope Alice', '25111111-1111-4111-8111-111111111111'),
  ('25bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Scope Bob', '25222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '25111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('25bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '25222222-2222-4222-8222-222222222222', 'owner', 'active');
insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '25111111-1111-4111-8111-111111111111', 'personal'),
  ('25bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '25222222-2222-4222-8222-222222222222', 'personal');
insert into workspace.mcp_authorizations
  (id, workspace_id, client_id, assistant_provider, status, granted_scopes, created_by, updated_at)
values
  ('25c11111-1111-4111-8111-111111111111', '25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '25d11111-1111-4111-8111-111111111111', 'chatgpt', 'connected', '{}', '25111111-1111-4111-8111-111111111111', '2026-09-26T03:00:00Z'),
  ('25c22222-2222-4222-8222-222222222222', '25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '25d22222-2222-4222-8222-222222222222', 'claude', 'connected', array['profile'], '25111111-1111-4111-8111-111111111111', '2026-09-26T02:00:00Z'),
  ('25c33333-3333-4333-8333-333333333333', '25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'legacy-non-uuid-client', 'other', 'disconnected', array['email'], '25111111-1111-4111-8111-111111111111', '2026-09-26T01:00:00Z'),
  -- Neither another creator in this Workspace nor this creator in another
  -- Workspace may escape the two existing listing ownership predicates.
  ('25c44444-4444-4444-8444-444444444444', '25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '25d44444-4444-4444-8444-444444444444', 'other', 'connected', array['openid'], '25222222-2222-4222-8222-222222222222', now()),
  ('25c55555-5555-4555-8555-555555555555', '25bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '25d55555-5555-4555-8555-555555555555', 'other', 'connected', array['openid'], '25111111-1111-4111-8111-111111111111', now());

update workspace_private.product_settings set setting_value = 'true'
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants
  (user_id, client_id, resource_uri, granted_scopes) values
  ('25111111-1111-4111-8111-111111111111', '25d11111-1111-4111-8111-111111111111', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'offline_access', 'profile']),
  ('25111111-1111-4111-8111-111111111111', '25d22222-2222-4222-8222-222222222222', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email']),
  -- Same client under another user must never influence Alice's scopes.
  ('25222222-2222-4222-8222-222222222222', '25d11111-1111-4111-8111-111111111111', 'https://workspace.leademergence.com/api/mcp', array['openid', 'phone']);

select is(has_function_privilege('anon', 'workspace.mcp_list_assistant_connections()', 'execute'), false,
  'anon cannot execute the listing');
select is(has_function_privilege('authenticated', 'workspace.mcp_list_assistant_connections()', 'execute'), true,
  'authenticated retains controlled listing execution');
select ok(not exists (
  select 1 from pg_proc p,
  aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = 'workspace.mcp_list_assistant_connections()'::regprocedure
    and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute the listing');
select ok((select prosecdef and provolatile = 's' and proconfig = array['search_path=""']
  from pg_proc where oid = 'workspace.mcp_list_assistant_connections()'::regprocedure),
  'stable SECURITY DEFINER and empty search_path are preserved');

select set_config('request.test_scope_claims', jsonb_build_object(
  'sub', '25111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  'client_id', '25d11111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1700000000
)::text, true);
set local role authenticated;
select set_config('request.jwt.claims', current_setting('request.test_scope_claims'), true);

select is(
  (select item -> 'granted_scopes' from jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') item
    where (item ->> 'is_current_connection')::boolean),
  '["openid","email","offline_access","profile"]'::jsonb,
  'current scopes come from its active grant, not empty metadata, another user or another client');
select is(
  (select item -> 'granted_scopes' from jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') item
    where item ->> 'connection_id' = '25c22222-2222-4222-8222-222222222222'),
  '["profile"]'::jsonb,
  'non-current scopes retain metadata even when its active grant differs');
select is(
  (select item -> 'granted_scopes' from jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') item
    where item ->> 'connection_id' = '25c33333-3333-4333-8333-333333333333'),
  '["email"]'::jsonb,
  'non-current legacy identifiers are not cast or used to reconstruct authority');
select is(jsonb_array_length(workspace.mcp_list_assistant_connections() -> 'connections'), 3,
  'both Workspace and created_by ownership filters remain enforced');
select is(workspace.mcp_list_assistant_connections() ->> 'workspace_id', '25aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'listing retains the Workspace resolved by the capability guard');
select ok(
  not exists (select 1 from jsonb_object_keys(workspace.mcp_list_assistant_connections()) k
    where k not in ('workspace_id', 'connections'))
  and not exists (
    select 1 from jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') item,
    jsonb_object_keys(item) k where k not in (
      'connection_id', 'assistant_provider', 'status', 'granted_scopes', 'connected_at',
      'disconnected_at', 'last_verified_at', 'last_error_code', 'is_current_connection'
    )
  ), 'response contains only approved metadata and never client_id or raw grant fields');
select is(workspace.mcp_list_assistant_connections() -> 'connections' -> 0 ->> 'connection_id',
  '25c11111-1111-4111-8111-111111111111', 'updated_at descending order is preserved');
select is((select count(*) from jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') item
  where (item ->> 'is_current_connection')::boolean), 1::bigint,
  'exactly the authenticated client is identified as current');

select set_config('request.jwt.claims',
  jsonb_set(current_setting('request.test_scope_claims')::jsonb, '{aud}', '"https://other.example.invalid/mcp"')::text, true);
select throws_ok($$select workspace.mcp_list_assistant_connections()$$,
  '42501', 'The MCP authorization is invalid or has the wrong audience.',
  'a bearer for another resource cannot use this grant');
select set_config('request.jwt.claims', current_setting('request.test_scope_claims'), true);
reset role;

savepoint active_grant;
delete from workspace_private.mcp_oauth_resource_grants
where user_id = '25111111-1111-4111-8111-111111111111'
  and client_id = '25d11111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$select workspace.mcp_list_assistant_connections()$$,
  '42501', 'The MCP authorization is invalid or has the wrong audience.',
  'no current-user grant fails closed despite another user having the same client grant');
rollback to savepoint active_grant;

update workspace_private.mcp_oauth_resource_grants set status = 'revoked', revoked_at = now()
where user_id = '25111111-1111-4111-8111-111111111111'
  and client_id = '25d11111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$select workspace.mcp_list_assistant_connections()$$,
  '42501', 'The MCP authorization is invalid or has the wrong audience.',
  'revoked current authority fails closed without falling back to metadata or another grant');
rollback to savepoint active_grant;

-- The existing resource CHECK forbids a wrong-resource row altogether.
-- Exercise that constraint rather than weakening the schema for a fixture.
select throws_ok($$insert into workspace_private.mcp_oauth_resource_grants
  (user_id, client_id, resource_uri, granted_scopes) values
  ('25111111-1111-4111-8111-111111111111', '25d11111-1111-4111-8111-111111111111',
   'https://other.example.invalid/mcp', array['phone'])$$,
  '23514', null, 'another resource cannot populate the authoritative Workspace grant store');

select * from finish();
rollback;
