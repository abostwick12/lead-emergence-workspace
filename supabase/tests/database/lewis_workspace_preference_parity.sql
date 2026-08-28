begin;

select plan(20);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '91111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'preferences.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '92222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'preferences.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name, clock_timezones) values
  ('91111111-1111-4111-8111-111111111111', 'Preference Alice', array['America/New_York', 'America/Chicago', 'America/Los_Angeles']),
  ('92222222-2222-4222-8222-222222222222', 'Preference Bob', array['Europe/London', 'Europe/Paris', 'Europe/Rome']);

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Preference Alice workspace', '91111111-1111-4111-8111-111111111111'),
  ('9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Preference Bob workspace', '92222222-2222-4222-8222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '91111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '92222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '91111111-1111-4111-8111-111111111111', 'personal'),
  ('9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '92222222-2222-4222-8222-222222222222', 'personal');

insert into workspace.mcp_authorizations (id, workspace_id, client_id, assistant_provider, status, granted_scopes, connected_at, created_by) values
  ('9c111111-1111-4111-8111-111111111111', '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'preferences-chatgpt', 'chatgpt', 'connected', array['openid', 'email', 'profile'], now(), '91111111-1111-4111-8111-111111111111'),
  ('9c222222-2222-4222-8222-222222222222', '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'preferences-claude', 'claude', 'connected', array['openid', 'email', 'profile'], now(), '91111111-1111-4111-8111-111111111111'),
  ('9c333333-3333-4333-8333-333333333333', '9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'preferences-bob-claude', 'claude', 'connected', array['openid', 'email', 'profile'], now(), '92222222-2222-4222-8222-222222222222');

select set_config(
  'request.test_mcp_resource_uri',
  (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  true
);

select is(has_function_privilege('anon', 'workspace.mcp_save_clock_preferences(text[])', 'execute'), false, 'anon cannot change private display-clock preferences');
select is(has_function_privilege('authenticated', 'workspace.mcp_save_clock_preferences(text[])', 'execute'), true, 'authenticated callers may invoke the controlled clock-preference RPC');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', '91111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'aud', current_setting('request.test_mcp_resource_uri'),
    'client_id', 'preferences-chatgpt',
    'workspace_mcp', 'true',
    'iat', 1700000000
  )::text,
  true
);

select is((select count(*) from workspace.user_profiles), 0::bigint, 'an MCP bearer cannot traverse ordinary profile RLS');
select is(
  pg_catalog.jsonb_array_length(workspace.mcp_get_clock_preferences() -> 'clock_timezones'),
  3,
  'Lewis reads exactly three private display-clock time zones'
);
select is(
  (workspace.mcp_save_clock_preferences(array['America/Denver', 'America/Chicago', 'America/Los_Angeles']) -> 'clock_timezones' ->> 0),
  'America/Denver',
  'Lewis saves a confirmed set of display-clock preferences through its narrow RPC'
);
select throws_ok(
  $sql$select workspace.mcp_save_clock_preferences(array['America/Denver', 'America/Chicago', 'Not/A_Timezone'])$sql$,
  '22023', 'Choose exactly three supported IANA time zones.',
  'Lewis rejects an unsupported display-clock time zone'
);
select throws_ok(
  $sql$select workspace.mcp_save_clock_preferences(array['America/Denver', 'America/Denver', 'America/Chicago'])$sql$,
  '22023', 'Choose exactly three supported IANA time zones.',
  'Lewis rejects duplicate display-clock time zones'
);
select is(
  pg_catalog.jsonb_array_length(workspace.mcp_list_assistant_connections() -> 'connections'),
  2,
  'Lewis lists the owner assistant connection states'
);
select ok(
  not exists (
    select 1
    from pg_catalog.jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') as connection(item)
    where connection.item ? 'client_id'
  ),
  'assistant connection status never exposes OAuth client identifiers'
);
select is(
  (select count(*) from pg_catalog.jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') as connection(item) where (connection.item ->> 'is_current_connection')::boolean),
  1::bigint,
  'Lewis identifies only its current assistant connection without revealing its identifier'
);
select ok(
  exists (
    select 1
    from pg_catalog.jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') as connection(item)
    where connection.item ? 'connection_id'
      and connection.item ->> 'connection_id' = '9c222222-2222-4222-8222-222222222222'
  ),
  'Lewis exposes an opaque connection handle, not a client identifier, for a listed assistant connection'
);
select is(
  (workspace.mcp_disconnect_assistant_connection(
    (select (connection.item ->> 'connection_id')::uuid
      from pg_catalog.jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') as connection(item)
      where connection.item ->> 'assistant_provider' = 'claude'
      limit 1)
  ) ->> 'disconnected')::boolean,
  true,
  'Lewis can revoke a separately authorized assistant connection after explicit confirmation at the tool layer'
);
select is(
  (select connection.item ->> 'status'
    from pg_catalog.jsonb_array_elements(workspace.mcp_list_assistant_connections() -> 'connections') as connection(item)
    where connection.item ->> 'connection_id' = '9c222222-2222-4222-8222-222222222222'),
  'disconnected',
  'Lewis reports the separately revoked assistant connection as disconnected'
);
select is(
  pg_catalog.jsonb_array_length(workspace.mcp_get_clock_preferences() -> 'clock_timezones'),
  3,
  'revoking another assistant does not invalidate the current assistant bearer'
);
select is(
  (workspace.mcp_disconnect_assistant_connection('9c333333-3333-4333-8333-333333333333') ->> 'already_absent')::boolean,
  true,
  'Lewis cannot target an assistant connection belonging to another Workspace'
);
select is(
  (workspace.mcp_disconnect_current_assistant() ->> 'disconnected')::boolean,
  true,
  'Lewis can disconnect only the current assistant after explicit confirmation at the tool layer'
);
select throws_ok(
  $sql$select workspace.mcp_get_clock_preferences()$sql$,
  '42501', 'This AI assistant connection is disconnected or requires authorization.',
  'a disconnected assistant bearer cannot make further privileged Lewis calls'
);

reset role;
select is(
  (select status from workspace.mcp_authorizations where workspace_id = '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and client_id = 'preferences-chatgpt'),
  'disconnected',
  'self-disconnect updates only the current assistant authorization'
);
select is(
  (select status from workspace.mcp_authorizations where workspace_id = '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and client_id = 'preferences-claude'),
  'disconnected',
  'confirmed cross-assistant disconnect revokes the separately authorized assistant'
);
select is(
  (select status from workspace.mcp_authorizations where workspace_id = '9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and client_id = 'preferences-bob-claude'),
  'connected',
  'cross-Workspace assistant authorization remains connected'
);

select * from finish();
rollback;
