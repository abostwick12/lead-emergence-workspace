begin;

select no_plan();

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '8a111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'workspace-authority@example.invalid', now(), now());
insert into auth.oauth_clients (
  id, registration_type, client_type, token_endpoint_auth_method,
  redirect_uris, grant_types, created_at, updated_at
) values
  ('8b111111-1111-4111-8111-111111111111', 'dynamic', 'public', 'none', 'https://client.example.invalid/callback', 'authorization_code,refresh_token', now(), now()),
  ('8b222222-2222-4222-8222-222222222222', 'dynamic', 'public', 'none', 'https://client.example.invalid/callback', 'authorization_code,refresh_token', now(), now());
insert into auth.sessions (id, user_id, oauth_client_id, created_at, updated_at, aal) values
  ('8c111111-1111-4111-8111-111111111111', '8a111111-1111-4111-8111-111111111111', '8b111111-1111-4111-8111-111111111111', now(), now(), 'aal1'),
  ('8c222222-2222-4222-8222-222222222222', '8a111111-1111-4111-8111-111111111111', '8b222222-2222-4222-8222-222222222222', now(), now(), 'aal1');

insert into workspace.user_profiles (user_id, display_name)
values ('8a111111-1111-4111-8111-111111111111', 'Workspace authority fixture');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id)
values ('8d111111-1111-4111-8111-111111111111', 'personal', 'Authority fixture', '8a111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
values ('8d111111-1111-4111-8111-111111111111', '8a111111-1111-4111-8111-111111111111', 'owner', 'active');
insert into workspace.personal_plans (workspace_id, user_id, plan_key)
values ('8d111111-1111-4111-8111-111111111111', '8a111111-1111-4111-8111-111111111111', 'personal');
insert into workspace.personal_onboarding (workspace_id, user_id, state, setup_method, selected_assistant, created_by)
values ('8d111111-1111-4111-8111-111111111111', '8a111111-1111-4111-8111-111111111111', 'workspace_ready', 'ai', 'chatgpt', '8a111111-1111-4111-8111-111111111111');
insert into workspace.mcp_authorizations (
  workspace_id, client_id, assistant_provider, status, connected_at, authorization_valid_after, created_by
) values (
  '8d111111-1111-4111-8111-111111111111', '8b111111-1111-4111-8111-111111111111', 'chatgpt', 'connected', now(), now() - interval '1 minute', '8a111111-1111-4111-8111-111111111111'
);

update workspace_private.product_settings
set setting_value = 'true'
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants (user_id, client_id, resource_uri, granted_scopes)
values ('8a111111-1111-4111-8111-111111111111', '8b111111-1111-4111-8111-111111111111', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']);

update private.oauth_product_binding_control set enabled = true;
insert into private.oauth_product_client_bindings (
  client_id, contract_key, product_key, resource_uri, audience_uri,
  status, source_authorization_id, bound_by_user_id
) values
  ('8b111111-1111-4111-8111-111111111111', 'workspace', 'workspace', 'https://workspace.leademergence.com/api/mcp', 'https://workspace.leademergence.com/api/mcp', 'ACTIVE', 'workspace-authority-fixture', '8a111111-1111-4111-8111-111111111111'),
  ('8b222222-2222-4222-8222-222222222222', 'consulting', 'consulting', 'https://consulting.leademergence.com/mcp', 'https://consulting.leademergence.com/mcp', 'ACTIVE', 'consulting-authority-fixture', '8a111111-1111-4111-8111-111111111111');

create function pg_temp.base_claims(target_client uuid, target_session uuid)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'sub', '8a111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'iss', 'https://cirqqhuvzekbvysiyedg.supabase.co/auth/v1',
    'aud', 'authenticated',
    'session_id', target_session,
    'client_id', target_client,
    'iat', extract(epoch from now())::bigint,
    'exp', extract(epoch from now() + interval '1 hour')::bigint
  );
$$;
create function pg_temp.issued_claims(target_client uuid, target_session uuid, patch jsonb default '{}'::jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select (workspace_private.custom_access_token_hook(jsonb_build_object(
    'user_id', '8a111111-1111-4111-8111-111111111111',
    'claims', pg_temp.base_claims(target_client, target_session) || patch
  )) -> 'claims');
$$;
create function pg_temp.set_claims(claims jsonb)
returns text
language sql
as $$
  select set_config('request.jwt.claims', claims::text, true);
$$;

select is(
  workspace_private.custom_access_token_hook(jsonb_build_object(
    'user_id', '8a111111-1111-4111-8111-111111111111',
    'claims', pg_temp.base_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111')
  )),
  private.custom_access_token_hook(jsonb_build_object(
    'user_id', '8a111111-1111-4111-8111-111111111111',
    'claims', pg_temp.base_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111')
  )),
  'Workspace issuance delegates exactly to the shared canonical hook'
);

select is(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'le_session_class', 'mcp_oauth', 'canonical session class is shared-hook derived');
select is(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'le_product', 'workspace', 'canonical product is binding-derived');
select is((pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'le_binding_version')::integer, 1, 'canonical binding version is registry-derived');
select is(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'aud', 'https://workspace.leademergence.com/api/mcp', 'canonical audience is exact');
select is(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'resource', 'https://workspace.leademergence.com/api/mcp', 'canonical resource is exact');
select is((pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') ->> 'workspace_mcp')::boolean, true, 'Workspace marker is boolean true');

select is(
  pg_temp.issued_claims(
    '8b111111-1111-4111-8111-111111111111',
    '8c111111-1111-4111-8111-111111111111',
    '{"le_session_class":"browser","le_product":"consulting","le_binding_version":99,"resource":"https://wrong.example/mcp","workspace_mcp":false}'::jsonb
  ) ->> 'le_product',
  null,
  'caller-supplied conflicting authority cannot override the durable binding'
);

set local role authenticated;
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111'));
select ok(private.assert_product_mcp_client('workspace', 'https://workspace.leademergence.com/api/mcp'), 'database guard accepts the canonical Workspace claim');
select is(workspace.mcp_verify_current_authority(), true, 'HTTP authority probe agrees on the canonical claim and local grant');
select is(workspace.mcp_get_onboarding_state() ->> 'state', 'workspace_ready', 'controlled Workspace RPC authority resolves only the intended workspace');

select pg_temp.set_claims(jsonb_build_object(
  'sub', '8a111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'client_id', '8b111111-1111-4111-8111-111111111111',
  'aud', 'https://workspace.leademergence.com/api/mcp', 'workspace_mcp', true
));
select is(workspace.mcp_verify_current_authority(), false, 'legacy pre-Stage-2 claims are rejected');

select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') - 'le_product');
select is(workspace.mcp_verify_current_authority(), false, 'missing product is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"le_product":"consulting"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'wrong product is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"le_session_class":"browser"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'wrong session class is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"le_binding_version":2}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'wrong binding version is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"aud":"https://wrong.example/mcp"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'wrong audience is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"resource":"https://wrong.example/mcp"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'wrong resource is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"iss":"https://wrong.example/auth/v1"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'issuer mismatch is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"session_id":"8c222222-2222-4222-8222-222222222222"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'session and client mismatch is rejected');
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111') || '{"client_id":"8b999999-9999-4999-8999-999999999999"}'::jsonb);
select is(workspace.mcp_verify_current_authority(), false, 'missing durable client binding is rejected');

reset role;
update workspace_private.mcp_oauth_resource_grants
set status = 'revoked', revoked_at = now()
where client_id = '8b111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.set_claims(pg_temp.issued_claims('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111'));
select is(workspace.mcp_verify_current_authority(), false, 'Workspace-local authorization failure is rejected');

reset role;
set local role authenticated;
select pg_temp.set_claims(pg_temp.issued_claims('8b222222-2222-4222-8222-222222222222', '8c222222-2222-4222-8222-222222222222'));
select is(workspace.mcp_verify_current_authority(), false, 'valid claim for another product cannot be reused for Workspace');

reset role;
select is(has_function_privilege('anon', 'workspace.mcp_verify_current_authority()', 'execute'), false, 'anonymous callers cannot probe Workspace authority');
select is(has_function_privilege('service_role', 'workspace.mcp_verify_current_authority()', 'execute'), false, 'runtime elevated roles receive no new authority probe grant');
select is(has_function_privilege('authenticated', 'workspace.mcp_verify_current_authority()', 'execute'), true, 'only the current authenticated bearer may run the self-authority probe');
select is(has_function_privilege('authenticated', 'workspace_private.custom_access_token_hook(jsonb)', 'execute'), false, 'authenticated callers cannot invoke the Auth hook');
select is(has_function_privilege('supabase_auth_admin', 'workspace_private.custom_access_token_hook(jsonb)', 'execute'), true, 'only Auth administration can invoke the configured hook entry point');

select * from finish();
rollback;
