begin;

select plan(31);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'parity.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'parity.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('71111111-1111-4111-8111-111111111111', 'Parity Alice'),
  ('72222222-2222-4222-8222-222222222222', 'Parity Bob');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Parity Alice workspace', '71111111-1111-4111-8111-111111111111'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Parity Bob workspace', '72222222-2222-4222-8222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '71111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '72222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '71111111-1111-4111-8111-111111111111', 'personal'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '72222222-2222-4222-8222-222222222222', 'personal');

insert into workspace.personal_onboarding (workspace_id, user_id, state, setup_method, selected_assistant, created_by) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '71111111-1111-4111-8111-111111111111', 'workspace_ready', 'ai', 'chatgpt', '71111111-1111-4111-8111-111111111111'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '72222222-2222-4222-8222-222222222222', 'workspace_ready', 'ai', 'claude', '72222222-2222-4222-8222-222222222222');

insert into workspace.personal_configuration_items (id, workspace_id, area, content, epistemic_status, source_interface, active, confirmed_at, created_by) values
  ('7a000000-0000-4000-8000-000000000001', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'priorities', '{"text":"Original private priority"}', 'user_confirmed', 'native', true, now(), '71111111-1111-4111-8111-111111111111'),
  ('7b000000-0000-4000-8000-000000000001', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'priorities', '{"text":"Bob private priority"}', 'user_confirmed', 'native', true, now(), '72222222-2222-4222-8222-222222222222');

insert into workspace.capture_inbox (id, workspace_id, raw_text, created_by) values
  ('7a100000-0000-4000-8000-000000000001', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice first private capture', '71111111-1111-4111-8111-111111111111'),
  ('7a100000-0000-4000-8000-000000000002', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice discardable private capture', '71111111-1111-4111-8111-111111111111'),
  ('7b100000-0000-4000-8000-000000000001', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob private capture', '72222222-2222-4222-8222-222222222222');

insert into workspace.memory_entries (id, workspace_id, memory_type, content, domain, created_by) values
  ('7a200000-0000-4000-8000-000000000001', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'context', 'Alice private context', 'life', '71111111-1111-4111-8111-111111111111'),
  ('7b200000-0000-4000-8000-000000000001', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'context', 'Bob private context', 'life', '72222222-2222-4222-8222-222222222222');

insert into workspace.job_applications (id, workspace_id, company, role, created_by) values
  ('7a300000-0000-4000-8000-000000000001', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice Company', 'Alice Role', '71111111-1111-4111-8111-111111111111'),
  ('7b300000-0000-4000-8000-000000000001', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob Company', 'Bob Role', '72222222-2222-4222-8222-222222222222');

insert into workspace.integration_connections (id, workspace_id, provider, status, connected_account_label, scopes, created_by) values
  ('7a400000-0000-4000-8000-000000000001', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'google_calendar', 'connected', 'Alice calendar', array['calendar.readonly'], '71111111-1111-4111-8111-111111111111'),
  ('7b400000-0000-4000-8000-000000000001', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'google_calendar', 'connected', 'Bob calendar', array['calendar.readonly'], '72222222-2222-4222-8222-222222222222');

insert into workspace.mcp_authorizations (workspace_id, client_id, assistant_provider, status, connected_at, created_by) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'parity-alice-client', 'chatgpt', 'connected', now(), '71111111-1111-4111-8111-111111111111'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'parity-bob-client', 'claude', 'connected', now(), '72222222-2222-4222-8222-222222222222');

select set_config(
  'request.test_mcp_resource_uri',
  (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  true
);

select is(has_function_privilege('anon', 'workspace.mcp_list_captures(text,integer)', 'execute'), false, 'anon cannot list private captures through Lewis');
select is(has_function_privilege('anon', 'workspace.mcp_create_memory(text,uuid,text,text)', 'execute'), false, 'anon cannot create private memory through Lewis');
select is(has_function_privilege('authenticated', 'workspace.mcp_list_captures(text,integer)', 'execute'), true, 'authenticated callers may invoke the controlled capture RPC');
select is(has_table_privilege('authenticated', 'workspace.integration_connections', 'insert'), false, 'MCP clients cannot manufacture external connector state directly');
select is(has_table_privilege('authenticated', 'workspace_private.mcp_action_receipts', 'select'), false, 'MCP idempotency receipts remain private');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', '71111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'aud', current_setting('request.test_mcp_resource_uri'),
    'client_id', 'parity-alice-client',
    'workspace_mcp', 'true',
    'iat', 1900000000
  )::text,
  true
);

select is((select count(*) from workspace.capture_inbox), 0::bigint, 'an MCP OAuth bearer cannot traverse ordinary capture RLS');
select is(pg_catalog.jsonb_array_length(workspace.mcp_list_captures() -> 'captures'), 2, 'Lewis lists only Alice captures');
select ok(
  not (workspace.mcp_list_captures() -> 'captures' @> '[{"raw_text":"Bob private capture"}]'::jsonb),
  'Lewis capture list never reveals Bob content'
);
select is(
  workspace.mcp_resolve_capture(
    '7a100000-0000-4000-8000-000000000001',
    '7a900000-0000-4000-8000-000000000001',
    'leadership'
  ) -> 'task' ->> 'title',
  'Alice first private capture',
  'Lewis resolves an owned capture into a private task'
);
select is(
  workspace.mcp_resolve_capture(
    '7a100000-0000-4000-8000-000000000001',
    '7a900000-0000-4000-8000-000000000001',
    'leadership'
  ) ->> 'idempotent_replay',
  'true',
  'capture resolution safely replays with the original request identifier'
);
select throws_ok(
  $sql$select workspace.mcp_resolve_capture('7a100000-0000-4000-8000-000000000001', '7a900000-0000-4000-8000-000000000001', 'life')$sql$,
  '22023', 'Reuse a capture request identifier only with the same capture details.',
  'capture request identifiers cannot be reused with different data'
);
select throws_ok(
  $sql$select workspace.mcp_resolve_capture('7b100000-0000-4000-8000-000000000001', '7a900000-0000-4000-8000-000000000002', 'general')$sql$,
  '22023', 'Capture not found for this Workspace.',
  'Lewis cannot resolve a capture from another Workspace'
);
select is(
  (workspace.mcp_dismiss_capture('7a100000-0000-4000-8000-000000000002') ->> 'dismissed')::boolean,
  true,
  'Lewis discards an explicitly selected owned capture'
);
select is(pg_catalog.jsonb_array_length(workspace.mcp_list_captures('unprocessed') -> 'captures'), 0, 'discarded and routed captures leave no unprocessed Alice captures');

select is(pg_catalog.jsonb_array_length(workspace.mcp_list_memory() -> 'memory'), 1, 'Lewis lists only Alice memory');
select is(
  workspace.mcp_create_memory(
    'Alice confirmed memory',
    '7a900000-0000-4000-8000-000000000003',
    'preference',
    'life'
  ) -> 'memory' ->> 'content',
  'Alice confirmed memory',
  'Lewis creates a confirmed private memory'
);
select is(
  workspace.mcp_create_memory(
    'Alice confirmed memory',
    '7a900000-0000-4000-8000-000000000003'::uuid,
    'preference',
    'life'
  ) ->> 'idempotent_replay',
  'true',
  'memory creation safely replays with the original request identifier'
);
select is(
  (workspace.mcp_delete_memory(
    (workspace.mcp_create_memory(
      'Alice confirmed memory',
      '7a900000-0000-4000-8000-000000000003',
      'preference',
      'life'
    ) -> 'memory' ->> 'id')::uuid
  ) ->> 'deleted')::boolean,
  true,
  'Lewis deletes only the selected owned memory'
);
select is(
  (workspace.mcp_delete_memory('7b200000-0000-4000-8000-000000000001') ->> 'already_absent')::boolean,
  true,
  'memory deletion does not disclose whether Bob records exist'
);

select is(pg_catalog.jsonb_array_length(workspace.mcp_list_career_opportunities() -> 'opportunities'), 1, 'Lewis lists only Alice career opportunities');
select is(
  workspace.mcp_create_career_opportunity(
    'Alice New Company',
    'New Role',
    '7a900000-0000-4000-8000-000000000004',
    '2026-09-30'
  ) -> 'opportunity' ->> 'company',
  'Alice New Company',
  'Lewis creates a confirmed private career opportunity'
);
select is(
  workspace.mcp_create_career_opportunity(
    'Alice New Company',
    'New Role',
    '7a900000-0000-4000-8000-000000000004',
    '2026-09-30'
  ) ->> 'idempotent_replay',
  'true',
  'career opportunity creation safely replays with the original request identifier'
);
select is(
  workspace.mcp_update_career_opportunity(
    (workspace.mcp_create_career_opportunity(
      'Alice New Company',
      'New Role',
      '7a900000-0000-4000-8000-000000000004',
      '2026-09-30'
    ) -> 'opportunity' ->> 'id')::uuid,
    'interview'
  ) -> 'opportunity' ->> 'status',
  'interview',
  'Lewis updates the status of an owned opportunity'
);
select throws_ok(
  $sql$select workspace.mcp_update_career_opportunity('7b300000-0000-4000-8000-000000000001', 'offer')$sql$,
  '22023', 'Career opportunity not found for this Workspace.',
  'Lewis cannot update a career opportunity from another Workspace'
);

select is(
  workspace.mcp_replace_confirmed_workspace_configuration(
    'priorities',
    'Updated private priority',
    '7a900000-0000-4000-8000-000000000005'
  ) -> 'item' ->> 'epistemic_status',
  'user_confirmed',
  'Lewis replaces configuration only as explicitly confirmed user content'
);
select is(
  workspace.mcp_replace_confirmed_workspace_configuration(
    'priorities',
    'Updated private priority',
    '7a900000-0000-4000-8000-000000000005'
  ) ->> 'idempotent_replay',
  'true',
  'configuration replacement safely replays with the original request identifier'
);

reset role;
select is(
  (select count(*) from workspace.personal_configuration_items where workspace_id = '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and area = 'priorities' and active),
  1::bigint,
  'configuration replacement preserves exactly one active priority'
);
select is(
  (select content ->> 'text' from workspace.personal_configuration_items where workspace_id = '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and area = 'priorities' and active),
  'Updated private priority',
  'configuration replacement stores the exact confirmed text'
);

set local role authenticated;
select is(pg_catalog.jsonb_array_length(workspace.mcp_list_integration_connections() -> 'connections'), 1, 'Lewis lists only Alice integration connection metadata');

reset role;
update workspace.plan_capabilities set enabled = false where plan_key = 'personal' and capability_key = 'memory';
set local role authenticated;
select throws_ok(
  $sql$select workspace.mcp_list_memory()$sql$,
  '42501', 'This Workspace capability is not included for the current Personal plan.',
  'MCP memory actions cannot bypass a disabled plan capability'
);
select set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', '71111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'aud', current_setting('request.test_mcp_resource_uri'),
    'client_id', 'unrecognized-client',
    'workspace_mcp', 'true',
    'iat', 1900000000
  )::text,
  true
);
select throws_ok(
  $sql$select workspace.mcp_list_captures()$sql$,
  '42501', 'This AI assistant connection is disconnected or requires authorization.',
  'an unrecognized OAuth client cannot use Alice Workspace actions'
);

select * from finish();
rollback;
