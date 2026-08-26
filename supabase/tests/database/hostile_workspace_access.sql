begin;

select plan(25);

-- Deterministic fixtures. These inserts execute as the test administrator;
-- every assertion below runs as anon or authenticated with a hostile claim.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'alice.workspace.test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bob.workspace.test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'eve.workspace.test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob'),
  ('33333333-3333-3333-3333-333333333333', 'Eve');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'personal', 'Alice workspace', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'personal', 'Bob workspace', '22222222-2222-2222-2222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'personal'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'personal');

insert into workspace.tasks (id, workspace_id, title, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice private task', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob private task', '22222222-2222-2222-2222-222222222222');

-- This represents an independently owned ministry product table. Authenticated
-- Workspace principals receive table privileges but its RLS policy denies them.
create table public.ministry_fixture (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id),
  body text not null
);
alter table public.ministry_fixture enable row level security;
grant select, insert, update, delete on public.ministry_fixture to authenticated;
create policy ministry_fixture_deny_workspace on public.ministry_fixture
  for all to authenticated using (false) with check (false);
insert into public.ministry_fixture (id, owner_user_id, body) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ministry record for Alice'),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Ministry record for Bob');

insert into storage.buckets (id, name, public)
values ('ministry-fixture', 'ministry-fixture', false);
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('workspace-private', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/alice.txt', '11111111-1111-1111-1111-111111111111', '{}'),
  ('ministry-fixture', 'ministry-only.txt', '11111111-1111-1111-1111-111111111111', '{}');

select is(
  has_schema_privilege('authenticated', 'workspace_private', 'usage'), false,
  'authenticated has no usage on the private helper schema'
);
select is(
  has_schema_privilege('anon', 'workspace_private', 'usage'), false,
  'anon has no usage on the private helper schema'
);
select is(
  (select prosecdef from pg_proc where oid = 'workspace_private.is_active_member(uuid)'::regprocedure), true,
  'membership helper is security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'workspace_private.is_workspace_owner(uuid)'::regprocedure), true,
  'owner helper is security definer'
);
select ok(
  (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid = 'workspace_private.is_active_member(uuid)'::regprocedure),
  'membership helper fixes its search path'
);
select is(
  has_function_privilege('anon', 'workspace_private.is_active_member(uuid)', 'execute'), false,
  'anon cannot execute membership helper'
);
select is(
  has_function_privilege('authenticated', 'workspace_private.is_active_member(uuid)', 'execute'), true,
  'authenticated policy evaluation can execute membership helper'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from workspace.tasks), 1::bigint, 'Alice sees only her task');
select is((select count(*) from workspace.tasks where workspace_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0::bigint, 'Alice cannot read Bob task');
select lives_ok(
  $sql$insert into workspace.tasks (id, workspace_id, title, created_by) values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice created task', '11111111-1111-1111-1111-111111111111')$sql$,
  'Alice can create a record only in her own workspace'
);
select is((select count(*) from workspace.audit_events where entity_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 1::bigint, 'security-definer audit trigger records an authenticated write');
select throws_ok(
  $sql$insert into workspace.audit_events (workspace_id, actor_user_id, event_type, entity_type) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'forged', 'task')$sql$,
  '42501', 'permission denied for table audit_events',
  'Alice cannot forge an audit event'
);
select throws_ok(
  $sql$update workspace.tasks set workspace_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$sql$,
  'P0001', 'Workspace tenant and creator are immutable.',
  'Alice cannot move a tenant record to Bob workspace'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*) from workspace.tasks), 1::bigint, 'Bob sees only his task');
select is((select count(*) from workspace.tasks where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'Bob cannot read Alice tasks');
select throws_ok(
  $sql$insert into workspace.tasks (workspace_id, title, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bob intrusion', '22222222-2222-2222-2222-222222222222')$sql$,
  '42501', 'new row violates row-level security policy for table "tasks"',
  'Bob cannot create a task in Alice workspace'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is((select count(*) from workspace.tasks), 0::bigint, 'non-member Eve sees no Workspace tasks');
select throws_ok(
  $sql$insert into workspace.tasks (workspace_id, title, created_by) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Eve intrusion', '33333333-3333-3333-3333-333333333333')$sql$,
  '42501', 'new row violates row-level security policy for table "tasks"',
  'non-member Eve cannot create a task in Bob workspace'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is((select count(*) from storage.objects where bucket_id = 'workspace-private'), 1::bigint, 'Alice sees her private Storage object');
select is((select count(*) from storage.objects where bucket_id = 'ministry-fixture'), 0::bigint, 'Alice cannot read another product storage bucket');
select is((select count(*) from public.ministry_fixture), 0::bigint, 'Alice cannot read ministry fixture records despite shared auth identity');
select throws_ok(
  $sql$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('workspace-private', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/alice-in-bob-space.txt', '11111111-1111-1111-1111-111111111111', '{}')$sql$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'Alice cannot upload into Bob workspace Storage prefix'
);
select throws_ok(
  $sql$update storage.objects set owner_id = '22222222-2222-2222-2222-222222222222' where bucket_id = 'workspace-private' and name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/alice.txt'$sql$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'Alice cannot transfer ownership of a private Storage object'
);
select throws_ok(
  $sql$select workspace_private.is_active_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$sql$,
  '42501', 'permission denied for schema workspace_private',
  'private helper cannot be called directly through the authenticated role'
);

reset role;
set local role anon;
select throws_ok(
  $sql$select * from workspace.tasks$sql$,
  '42501', 'permission denied for schema workspace',
  'anon cannot access the Workspace API schema'
);

reset role;
select * from finish();
rollback;
