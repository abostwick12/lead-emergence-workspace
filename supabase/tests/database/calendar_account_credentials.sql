begin;

select plan(37);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'c1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'calendar.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'calendar.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('c1111111-1111-4111-8111-111111111111', 'Calendar Alice'),
  ('c2222222-2222-4222-8222-222222222222', 'Calendar Bob');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Calendar Alice workspace', 'c1111111-1111-4111-8111-111111111111'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Calendar Bob workspace', 'c2222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c2222222-2222-4222-8222-222222222222', 'owner', 'active');
insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', 'personal'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c2222222-2222-4222-8222-222222222222', 'personal');

select is((select relrowsecurity from pg_class where oid = 'workspace_private.calendar_account_credentials'::regclass), true, 'private Calendar credentials use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace_private.calendar_oauth_attempts'::regclass), true, 'private Calendar attempts use RLS');
select is((select rolcanlogin and not rolbypassrls and not rolinherit from pg_roles where rolname = 'workspace_calendar_reader'), true, 'reader is a restricted login role');
select is(has_schema_privilege('workspace_calendar_reader', 'workspace_private', 'usage'), false, 'reader cannot use private schema');
select is(has_schema_privilege('workspace_calendar_reader', 'workspace', 'create'), false, 'reader cannot create in exposed schema');
select is(has_table_privilege('workspace_calendar_reader', 'workspace_private.calendar_account_credentials', 'select'), false, 'reader has no table select');
select is(has_table_privilege('workspace_calendar_reader', 'workspace_private.calendar_oauth_attempts', 'select'), false, 'reader has no attempt-table select');
select is(has_table_privilege('authenticated', 'workspace_private.calendar_account_credentials', 'select'), false, 'browser role has no table select');
select is(has_function_privilege('workspace_calendar_reader', 'workspace.read_calendar_credential(uuid,text)', 'execute'), true, 'reader can call exact-slot RPC');
select is(has_function_privilege('workspace_calendar_reader', 'workspace.read_calendar_oauth_attempt(uuid,text,text)', 'execute'), true, 'reader can call exact-state attempt RPC');
select is(has_function_privilege('authenticated', 'workspace.read_calendar_oauth_attempt(uuid,text,text)', 'execute'), false, 'browser role cannot read pending owner bearer');
select is(has_function_privilege('authenticated', 'workspace.read_calendar_credential(uuid,text)', 'execute'), false, 'browser role cannot read ciphertext RPC');
select is(has_function_privilege('anon', 'workspace.read_calendar_credential(uuid,text)', 'execute'), false, 'anonymous role cannot read ciphertext RPC');
select is(has_function_privilege('service_role', 'workspace.read_calendar_credential(uuid,text)', 'execute'), false, 'general service role was not granted Calendar read');
select is(has_function_privilege('workspace_calendar_reader', 'workspace.save_owner_calendar_credential(uuid,text,text,smallint,text,timestamptz,boolean)', 'execute'), false, 'reader cannot save credentials');
select is(has_function_privilege('workspace_projection_writer', 'workspace.read_calendar_credential(uuid,text)', 'execute'), false, 'projection writer cannot read Calendar credentials');
select is((
  select count(*) from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('workspace', 'workspace_private')
    and has_function_privilege('workspace_calendar_reader', procedure.oid, 'execute')
), 2::bigint, 'reader can execute only the two exact Calendar read functions in Workspace schemas');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select lives_ok(
  $sql$select workspace.save_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('p', 40), 1::smallint, repeat('a', 64), null, true)$sql$,
  'owner can save personal slot'
);
select lives_ok(
  $sql$select workspace.save_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'business', repeat('b', 40), 1::smallint, repeat('b', 64), null, true)$sql$,
  'owner can save a separate business slot'
);
reset role;
select is((select count(*) from workspace_private.calendar_account_credentials where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2::bigint, 'both exact slots are preserved');

set local role authenticated;
select lives_ok(
  $sql$select workspace.revoke_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal')$sql$,
  'owner can revoke one slot'
);
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.save_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('x', 40), 1::smallint, repeat('x', 64), null, true)$sql$,
  '42501', 'Only the Workspace owner may change Calendar credentials.',
  'another Workspace owner cannot overwrite Alice slot'
);
reset role;
select is((select ciphertext is null and not refresh_token_present from workspace_private.calendar_account_credentials where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), true, 'revocation erases ciphertext and refresh indicator');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select lives_ok(
  $sql$select workspace.start_owner_calendar_oauth_attempt('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('c', 64), repeat('q', 40))$sql$,
  'owner can start one pending personal flow'
);
reset role;
select is((select count(*) from workspace_private.calendar_oauth_attempts where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), 1::bigint, 'pending flow exists for exact slot');

set local role authenticated;
select lives_ok(
  $sql$select workspace.revoke_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal')$sql$,
  'disconnect invalidates the pending flow'
);
reset role;
select is((select count(*) from workspace_private.calendar_oauth_attempts where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), 0::bigint, 'disconnect removed pending flow');
set local role authenticated;
select throws_ok(
  $sql$select workspace.finish_owner_calendar_oauth_attempt('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('c', 64), repeat('x', 40), 1::smallint, repeat('c', 64), null, true)$sql$,
  '22023', 'This Calendar connection request has expired.',
  'callback cannot restore a slot after disconnect'
);
reset role;
select is((select ciphertext is null from workspace_private.calendar_account_credentials where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), true, 'rejected callback leaves slot disconnected');

set local role authenticated;
select lives_ok(
  $sql$select workspace.start_owner_calendar_oauth_attempt('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('d', 64), repeat('q', 40))$sql$,
  'owner can start a fresh flow after disconnect'
);
select lives_ok(
  $sql$select workspace.finish_owner_calendar_oauth_attempt('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', repeat('d', 64), repeat('d', 40), 1::smallint, repeat('d', 64), null, true)$sql$,
  'fresh flow can finish once'
);
reset role;
select is((select ciphertext from workspace_private.calendar_account_credentials where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), repeat('d', 40), 'fresh flow saved its credential');
select is((select count(*) from workspace_private.calendar_oauth_attempts where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), 0::bigint, 'finish consumed the attempt');
set local role authenticated;
select lives_ok(
  $sql$select workspace.revoke_owner_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal')$sql$,
  'disconnect after finish clears the newly saved credential'
);
reset role;
select is((select ciphertext is null from workspace_private.calendar_account_credentials where workspace_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and account_slot = 'personal'), true, 'later disconnect remains final');

-- The local migration runner is not automatically a member of a newly created
-- NOINHERIT login. Test-only membership is rolled back with this fixture.
grant workspace_calendar_reader to postgres;
set local role workspace_calendar_reader;
select set_config('test.calendar.revoked_count',
  (select count(*) from workspace.read_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal'))::text, true);
select set_config('test.calendar.business_ciphertext',
  (select ciphertext from workspace.read_calendar_credential('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'business')), true);
reset role;
select is(current_setting('test.calendar.revoked_count')::bigint, 0::bigint, 'revoked slot cannot be read');
select is(current_setting('test.calendar.business_ciphertext'), repeat('b', 40), 'other slot remains readable');

select * from finish();
rollback;
