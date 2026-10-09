-- Review fixture only. The Preview URI here is synthetic, not an approved host.
begin;
select plan(21);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'preview-mcp-fixture@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

update workspace_private.product_settings set setting_value = 'true'
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants
  (user_id, client_id, resource_uri, granted_scopes)
values (
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000002',
  'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']
);
insert into auth.oauth_clients
  (id, registration_type, client_type, token_endpoint_auth_method, redirect_uris, grant_types)
values
  ('a3000000-0000-4000-8000-000000000003', 'dynamic', 'public', 'none',
   'https://chatgpt.com/connector/callback', 'authorization_code,refresh_token');
insert into auth.oauth_authorizations
  (id, authorization_id, client_id, user_id, redirect_uri, scope, resource,
   code_challenge, code_challenge_method, status, expires_at)
values
  ('a4000000-0000-4000-8000-000000000004', 'preview-review-authorization',
   'a3000000-0000-4000-8000-000000000003',
   'a1000000-0000-4000-8000-000000000001',
   'https://chatgpt.com/connector/callback', 'openid email profile',
   'https://lead-emergence-review-preview.vercel.app/api/mcp',
   'synthetic-pkce-challenge', 's256', 'approved', now() + interval '1 hour');

select is((select setting_value from workspace_private.product_settings
  where setting_key = 'mcp_preview_resource_uri'), '', 'Preview disabled by default');
select is(has_table_privilege('anon', 'workspace_private.mcp_oauth_resource_grants', 'select'),
  false, 'anonymous role cannot inspect private grants');
select is(has_table_privilege('authenticated', 'workspace_private.mcp_oauth_resource_grants', 'select'),
  false, 'authenticated role cannot inspect private grants');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aud":"authenticated"}', true);
select is((select request_class from workspace_private.resolve_mcp_oauth_authorization('preview-review-authorization', true)),
  'DENY', 'Preview authorization denied before exact resource configuration');
select is(workspace_private.custom_access_token_hook(
  '{"claims":{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a2000000-0000-4000-8000-000000000002","aud":"authenticated"}}'::jsonb
) #>> '{claims,aud}', 'https://workspace.leademergence.com/api/mcp', 'canonical audience remains');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a2000000-0000-4000-8000-000000000002","aud":"https://workspace.leademergence.com/api/mcp","workspace_mcp":true}', true);
select is(workspace_private.is_valid_mcp_request(), true, 'canonical grant stays valid');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a2000000-0000-4000-8000-000000000002","aud":"https://unapproved.example.invalid/api/mcp","workspace_mcp":true}', true);
select is(workspace_private.is_valid_mcp_request(), false, 'unapproved audience denied');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a2000000-0000-4000-8000-000000000002","aud":"https://workspace.leademergence.com/api/mcp","workspace_mcp":false}', true);
select is(workspace_private.is_valid_mcp_request(), false, 'missing admission claim denied');
select throws_ok($sql$insert into workspace_private.mcp_oauth_resource_grants
  (user_id,client_id,resource_uri) values
  ('a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003','http://unapproved.example.invalid/api/mcp')$sql$,
  '23514', null, 'grant storage requires HTTPS MCP URI');

update workspace_private.product_settings
set setting_value = 'https://lead-emergence-review-preview.vercel.app/api/mcp'
where setting_key = 'mcp_preview_resource_uri';
update workspace_private.mcp_oauth_resource_grants
set status = 'revoked', revoked_at = now()
where client_id = 'a2000000-0000-4000-8000-000000000002';
select is((select request_class from workspace_private.resolve_mcp_oauth_authorization('preview-review-authorization', true)),
  'WORKSPACE_MCP', 'exact Preview authorization eligible');
set local role authenticated;
select is(workspace.activate_mcp_oauth_grant('preview-review-authorization') ->> 'status',
  'active', 'approved Preview authorization activates its grant');
reset role;
select is((select resource_uri from workspace_private.mcp_oauth_resource_grants
  where client_id = 'a3000000-0000-4000-8000-000000000003'),
  'https://lead-emergence-review-preview.vercel.app/api/mcp', 'grant binds to requested Preview resource');
select is(workspace_private.custom_access_token_hook(
  '{"claims":{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"authenticated"}}'::jsonb
) #>> '{claims,aud}', 'https://lead-emergence-review-preview.vercel.app/api/mcp', 'Preview grant mints Preview audience');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"https://lead-emergence-review-preview.vercel.app/api/mcp","workspace_mcp":true}', true);
select is(workspace_private.is_valid_mcp_request(), true, 'matching Preview token admitted');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"https://workspace.leademergence.com/api/mcp","workspace_mcp":true}', true);
select is(workspace_private.is_valid_mcp_request(), false, 'Preview grant cannot authorize canonical audience');
select throws_ok($sql$insert into workspace_private.mcp_oauth_resource_grants
  (user_id,client_id,resource_uri) values
  ('a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003','https://workspace.leademergence.com/api/mcp')$sql$,
  '23505', null, 'one client cannot hold two active resource grants');
select workspace_private.revoke_mcp_oauth_resource_grant(
  'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'TEST');
select is((select status from workspace_private.mcp_oauth_resource_grants
  where client_id='a3000000-0000-4000-8000-000000000003'), 'revoked', 'disconnect revokes Preview grant');
select is(workspace_private.custom_access_token_hook(
  '{"claims":{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"authenticated"}}'::jsonb
) #>> '{claims,workspace_mcp}', null, 'revoked grant cannot mint admission claim');
update workspace_private.mcp_oauth_resource_grants
set status = 'active', revoked_at = null
where client_id = 'a3000000-0000-4000-8000-000000000003';
update workspace_private.product_settings set setting_value = ''
where setting_key = 'mcp_preview_resource_uri';
select is((select request_class from workspace_private.resolve_mcp_oauth_authorization('preview-review-authorization', true)),
  'DENY', 'disabled Preview resource denies new authorization');
select is(workspace_private.custom_access_token_hook(
  '{"claims":{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"authenticated"}}'::jsonb
) #>> '{claims,workspace_mcp}', null, 'disabled Preview resource cannot mint admission');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","client_id":"a3000000-0000-4000-8000-000000000003","aud":"https://lead-emergence-review-preview.vercel.app/api/mcp","workspace_mcp":true}', true);
select is(workspace_private.is_valid_mcp_request(), false, 'disabled Preview resource rejects prior token');
select * from finish();
rollback;
