begin;

select plan(21);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'd1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'budget.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'budget.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Budget Alice workspace', 'd1111111-1111-4111-8111-111111111111'),
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Budget Bob workspace', 'd2222222-2222-4222-8222-222222222222');

select is((select relrowsecurity from pg_class where oid = 'workspace_private.calendar_availability_read_budget'::regclass), true, 'budget table has RLS');
select is(has_schema_privilege('workspace_calendar_reader', 'workspace_private', 'usage'), false, 'reader cannot use private schema');
select is(has_table_privilege('workspace_calendar_reader', 'workspace_private.calendar_availability_read_budget', 'select'), false, 'reader cannot read counters or limits');
select is(has_function_privilege('anon', 'workspace.claim_calendar_availability_read(uuid)', 'execute'), false, 'anonymous visitor cannot claim directly');
select is(has_function_privilege('authenticated', 'workspace.claim_calendar_availability_read(uuid)', 'execute'), false, 'browser role cannot claim directly');
select is(has_function_privilege('service_role', 'workspace.claim_calendar_availability_read(uuid)', 'execute'), false, 'general service role cannot claim');
select is(has_function_privilege('workspace_calendar_reader', 'workspace.claim_calendar_availability_read(uuid)', 'execute'), true, 'dedicated reader can claim');

-- Test-only membership rolls back with this transaction. Assertions run as postgres.
grant workspace_calendar_reader to postgres;
set local role workspace_calendar_reader;
select set_config('test.budget.unconfigured', workspace.claim_calendar_availability_read('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
reset role;
select is(current_setting('test.budget.unconfigured')::boolean, false, 'unconfigured owner fails closed');
select is((select count(*) from workspace_private.calendar_availability_read_budget), 0::bigint, 'claim does not create a limit');

insert into workspace_private.calendar_availability_read_budget (workspace_id, max_per_minute) values
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2),
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1);

set local role workspace_calendar_reader;
select set_config('test.budget.alice_first', workspace.claim_calendar_availability_read('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
reset role;
select is(current_setting('test.budget.alice_first')::boolean, true, 'first accepted request claims one read');
select is((select accepted_count from workspace_private.calendar_availability_read_budget where workspace_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'first request increments once');

set local role workspace_calendar_reader;
select set_config('test.budget.alice_second', workspace.claim_calendar_availability_read('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
select set_config('test.budget.alice_third', workspace.claim_calendar_availability_read('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
reset role;
select is(current_setting('test.budget.alice_second')::boolean, true, 'second accepted request uses remaining budget');
select is(current_setting('test.budget.alice_third')::boolean, false, 'request over owner limit is denied');
select is((select accepted_count from workspace_private.calendar_availability_read_budget where workspace_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2, 'denied request does not increment');

set local role workspace_calendar_reader;
select set_config('test.budget.bob_first', workspace.claim_calendar_availability_read('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')::text, true);
select set_config('test.budget.bob_second', workspace.claim_calendar_availability_read('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')::text, true);
select set_config('test.budget.unknown', workspace.claim_calendar_availability_read('dccccccc-cccc-4ccc-8ccc-cccccccccccc')::text, true);
reset role;
select is(current_setting('test.budget.bob_first')::boolean, true, 'another Workspace has its own budget');
select is(current_setting('test.budget.bob_second')::boolean, false, 'other Workspace also stops at its limit');
select is((select accepted_count from workspace_private.calendar_availability_read_budget where workspace_id = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1, 'other Workspace counter is independent');
select is(current_setting('test.budget.unknown')::boolean, false, 'unknown Workspace fails closed');

update workspace_private.calendar_availability_read_budget
   set window_started_at = pg_catalog.clock_timestamp() - interval '2 minutes'
 where workspace_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role workspace_calendar_reader;
select set_config('test.budget.new_window', workspace.claim_calendar_availability_read('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
reset role;
select is(current_setting('test.budget.new_window')::boolean, true, 'a new minute permits another read');
select is((select accepted_count from workspace_private.calendar_availability_read_budget where workspace_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'new minute resets the count');
select is((select max_per_minute from workspace_private.calendar_availability_read_budget where workspace_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2, 'claim never changes reviewed limit');

select * from finish();
rollback;
