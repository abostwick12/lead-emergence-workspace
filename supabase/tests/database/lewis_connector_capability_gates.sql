begin;

select plan(27);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'connector.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'connector.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('81111111-1111-4111-8111-111111111111', 'Connector Alice'),
  ('82222222-2222-4222-8222-222222222222', 'Connector Bob');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Connector Alice workspace', '81111111-1111-4111-8111-111111111111'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Connector Bob workspace', '82222222-2222-4222-8222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '81111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '82222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '81111111-1111-4111-8111-111111111111', 'personal'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '82222222-2222-4222-8222-222222222222', 'personal');

select is(
  (select relation.relrowsecurity from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'workspace_private' and relation.relname = 'integration_credentials'),
  true,
  'private integration credentials enforce RLS as defense in depth'
);
select is(
  (select relation.relrowsecurity from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'workspace_private' and relation.relname = 'integration_oauth_attempts'),
  true,
  'private OAuth attempts enforce RLS as defense in depth'
);
select is(has_function_privilege('anon', 'workspace.save_integration_connection(uuid, text, text, text, text, text[], text, smallint, text, timestamptz, boolean)', 'execute'), false, 'anon cannot alter integration connections');
select is(has_table_privilege('authenticated', 'workspace_private.integration_credentials', 'select'), false, 'authenticated users cannot directly read private credentials');
select is(has_table_privilege('authenticated', 'workspace_private.integration_provider_releases', 'select'), false, 'authenticated users cannot inspect or enable consumer provider releases');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',
  true
);

select throws_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', repeat('a', 64), now() + interval '10 minutes')$sql$,
  '42501', 'External connections are not included for the current Personal plan.',
  'the default Personal plan cannot begin an external OAuth connection'
);
select throws_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', 'google', 'connected', 'Alice Google', array['openid']::text[], repeat('x', 40), 1::smallint, null, null, false)$sql$,
  '42501', 'External connections are not included for the current Personal plan.',
  'the default Personal plan cannot save an external credential'
);

reset role;
update workspace.plan_capabilities
set enabled = true, limit_value = 1
where plan_key = 'personal' and capability_key in ('external_connectors', 'integration_limit');

set local role authenticated;
select throws_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', repeat('a', 64), now() + interval '10 minutes')$sql$,
  '42501', 'This external provider is not released for consumer use.',
  'a plan alone cannot begin a consumer provider OAuth flow'
);

reset role;
update workspace_private.integration_provider_releases
set connection_enabled = true
where provider in ('gmail', 'google_calendar', 'slack');

set local role authenticated;
select lives_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', repeat('a', 64), now() + interval '10 minutes')$sql$,
  'a plan with one external slot can begin a Google OAuth connection'
);
select throws_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'slack', repeat('f', 64), now() + interval '10 minutes')$sql$,
  '42501', 'The current Personal plan has reached its external connection capacity.',
  'an outstanding connection request reserves the only external slot'
);
select throws_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', 'slack', 'connected', 'Alice Google', array['openid']::text[], repeat('x', 40), 1::smallint, null, null, false)$sql$,
  '22023', 'The provider does not match its credential family.',
  'a provider cannot be stored under a mismatched credential family'
);
select is(
  (workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', 'google', 'connected', 'Alice Google', array['openid']::text[], repeat('x', 40), 1::smallint, null, null, false)).status,
  'connected',
  'a permitted external provider stores an encrypted credential through the controlled RPC'
);
select lives_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', 'google', 'connected', 'Alice Google', array['openid']::text[], repeat('x', 40), 1::smallint, null, null, false)$sql$,
  'a linked Google Calendar connection shares the existing Google family slot'
);
select is(
  (select count(*) from workspace.integration_connections where workspace_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider in ('gmail', 'google_calendar') and status = 'connected'),
  2::bigint,
  'one Google family credential supports both linked Google connection records'
);
select throws_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'slack', 'slack', 'connected', 'Alice Slack', array['chat:write']::text[], repeat('s', 40), 1::smallint, null, null, false)$sql$,
  '42501', 'The current Personal plan has reached its external connection capacity.',
  'a second external provider cannot bypass the one-slot plan limit'
);
select lives_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('b', 64), now() + interval '10 minutes')$sql$,
  'a reauthorization request for the same Google family remains permitted'
);
select lives_ok(
  $sql$select workspace.consume_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('b', 64))$sql$,
  'the approved OAuth callback can claim its connection request'
);
select is(
  (workspace.complete_integration_oauth_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('b', 64), 'Alice Google', array['openid']::text[], repeat('c', 40), 1::smallint, null, null, false)).status,
  'connected',
  'a claimed OAuth request can complete only through the controlled connection RPC'
);
select lives_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('d', 64), now() + interval '10 minutes')$sql$,
  'a fresh same-family OAuth request can be created for the disconnect race check'
);
select lives_ok(
  $sql$select workspace.consume_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('d', 64))$sql$,
  'the disconnect race request is claimed before the provider callback completes'
);
select is(
  (workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', 'google', 'disconnected', null, '{}'::text[], null, 1::smallint, null, null, false)).status,
  'disconnected',
  'an owner can disconnect a linked external provider'
);
select throws_ok(
  $sql$select workspace.complete_integration_oauth_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', repeat('d', 64), 'Alice Google', array['openid']::text[], repeat('c', 40), 1::smallint, null, null, false)$sql$,
  '22023', 'This connection request has expired. Please try again.',
  'disconnecting invalidates an in-flight OAuth callback before it can restore a credential'
);

reset role;
select is(
  (select count(*) from workspace_private.integration_credentials where workspace_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider_family = 'google'),
  0::bigint,
  'disconnect removes the private Google credential'
);
select is(
  (select count(*) from workspace.integration_connections where workspace_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and provider in ('gmail', 'google_calendar') and status = 'disconnected' and secret_reference is null),
  2::bigint,
  'disconnect clears credential references from every linked Google connection record'
);

update workspace.plan_capabilities
set enabled = false, limit_value = 0
where plan_key = 'personal' and capability_key in ('external_connectors', 'integration_limit');

set local role authenticated;
select lives_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', 'google', 'disconnected', null, '{}'::text[], null, 1::smallint, null, null, false)$sql$,
  'a plan downgrade never prevents an owner from removing an external connection'
);
select throws_ok(
  $sql$select workspace.create_integration_oauth_attempt('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', repeat('e', 64), now() + interval '10 minutes')$sql$,
  '42501', 'External connections are not included for the current Personal plan.',
  'a downgraded plan cannot begin a new external OAuth connection'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',
  true
);
select throws_ok(
  $sql$select workspace.save_integration_connection('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', 'google', 'disconnected', null, '{}'::text[], null, 1::smallint, null, null, false)$sql$,
  '42501', 'Only the Workspace owner may change connections.',
  'another user cannot disconnect Alice external connection metadata'
);

select * from finish();
rollback;
