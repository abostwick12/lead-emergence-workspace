begin;

select plan(31);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'boundary.untrusted@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'boundary.valid@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '73333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'boundary.skeleton@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '74444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'boundary.spoofed@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '75555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'boundary.ambiguous@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '76666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'boundary.disabled@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'boundary.wrong-provider@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '78888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'boundary.conflict@example.invalid', '', now(), '{}', '{}', now(), now());

insert into workspace_private.trusted_identity_providers (provider_identifier, environment, enabled)
values
  ('custom:lead-emergence-entry-workspace-boundary', 'development', true),
  ('custom:lead-emergence-entry-workspace-disabled', 'development', false)
on conflict (provider_identifier) do update set enabled = excluded.enabled;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);

select throws_ok(
  $sql$insert into workspace.user_profiles (user_id, display_name) values ('71111111-1111-4111-8111-111111111111', 'Untrusted')$sql$,
  '42501', 'permission denied for table user_profiles',
  'ordinary authenticated users cannot seed profiles'
);
select throws_ok(
  $sql$insert into workspace.workspaces (workspace_type, name, owner_user_id) values ('personal', 'Forged', '71111111-1111-4111-8111-111111111111')$sql$,
  '42501', 'permission denied for table workspaces',
  'ordinary authenticated users cannot seed Personal Workspaces'
);
select throws_ok(
  $sql$insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values ('7ccccccc-cccc-4ccc-8ccc-cccccccccccc', '71111111-1111-4111-8111-111111111111', 'owner', 'active')$sql$,
  '42501', 'permission denied for table workspace_memberships',
  'ordinary authenticated users cannot seed active owner memberships'
);
select throws_ok(
  $sql$select workspace.ensure_personal_workspace()$sql$,
  '42501', 'A verified Lead Emergence identity is required.',
  'an email-only authenticated user cannot provision a Personal graph'
);
reset role;

select is((select count(*) from workspace.user_profiles where user_id = '71111111-1111-4111-8111-111111111111'), 0::bigint, 'untrusted attempt created no profile');
select is((select count(*) from workspace.workspaces where owner_user_id = '71111111-1111-4111-8111-111111111111'), 0::bigint, 'untrusted attempt created no Workspace');
select is((select count(*) from workspace.personal_plans where user_id = '71111111-1111-4111-8111-111111111111'), 0::bigint, 'untrusted attempt created no plan');
select is((select count(*) from workspace.personal_onboarding where user_id = '71111111-1111-4111-8111-111111111111'), 0::bigint, 'untrusted attempt created no onboarding record');
select is(workspace_private.has_personal_capability('7ccccccc-cccc-4ccc-8ccc-cccccccccccc', 'workspace_mcp'), false, 'the denied chain cannot satisfy an MCP capability prerequisite');

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '72222222-2222-4222-8222-222222222222', '72222222-2222-4222-8222-222222222222', '{"sub":"72222222-2222-4222-8222-222222222222"}', 'custom:lead-emergence-entry-workspace-boundary', now(), now(), now()),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '74444444-4444-4444-8444-444444444445', '74444444-4444-4444-8444-444444444444', '{"sub":"74444444-4444-4444-8444-444444444444"}', 'custom:lead-emergence-entry-workspace-boundary', now(), now(), now()),
  ('8ccccccc-cccc-4ccc-8ccc-cccccccccccc', '75555555-5555-4555-8555-555555555555', '75555555-5555-4555-8555-555555555555', '{"sub":"75555555-5555-4555-8555-555555555555"}', 'custom:lead-emergence-entry-workspace-boundary', now(), now(), now()),
  ('8ddddddd-dddd-4ddd-8ddd-dddddddddddd', '75555555-5555-4555-8555-555555555556', '75555555-5555-4555-8555-555555555555', '{"sub":"75555555-5555-4555-8555-555555555556"}', 'custom:lead-emergence-entry-workspace-boundary', now(), now(), now()),
  ('8eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '76666666-6666-4666-8666-666666666666', '76666666-6666-4666-8666-666666666666', '{"sub":"76666666-6666-4666-8666-666666666666"}', 'custom:lead-emergence-entry-workspace-disabled', now(), now(), now()),
  ('8fffffff-ffff-4fff-8fff-ffffffffffff', '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '{"sub":"77777777-7777-4777-8777-777777777777"}', 'custom:untrusted-entry-provider', now(), now(), now()),
  ('89999999-9999-4999-8999-999999999999', '78888888-8888-4888-8888-888888888888', '78888888-8888-4888-8888-888888888888', '{"sub":"78888888-8888-4888-8888-888888888888"}', 'custom:lead-emergence-entry-workspace-boundary', now(), now(), now());

select ok(
  (select id <> provider_id::uuid from auth.identities where user_id = '72222222-2222-4222-8222-222222222222'),
  'valid fixture has a generated identity-row UUID distinct from the provider subject'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"74444444-4444-4444-8444-444444444444","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'A verified Lead Emergence identity is required.', 'spoofed provider ID and subject are denied');
select set_config('request.jwt.claims', '{"sub":"75555555-5555-4555-8555-555555555555","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'A verified Lead Emergence identity is required.', 'ambiguous trusted identities are denied');
select set_config('request.jwt.claims', '{"sub":"76666666-6666-4666-8666-666666666666","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'A verified Lead Emergence identity is required.', 'disabled trusted provider is denied');
select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'A verified Lead Emergence identity is required.', 'wrong provider is denied even when its subject matches');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select lives_ok($sql$select workspace.ensure_personal_workspace()$sql$, 'one exact trusted Entry identity provisions a graph');
select is((select count(*) from workspace.user_profiles where user_id = '72222222-2222-4222-8222-222222222222'), 1::bigint, 'valid provisioning creates one linked profile');
select is((select count(*) from workspace.workspaces where owner_user_id = '72222222-2222-4222-8222-222222222222' and workspace_type = 'personal'), 1::bigint, 'valid provisioning creates one Personal Workspace');
select is((select count(*) from workspace.workspace_memberships where user_id = '72222222-2222-4222-8222-222222222222' and role = 'owner' and status = 'active'), 1::bigint, 'valid provisioning creates one active owner membership');
select is((select count(*) from workspace.personal_plans where user_id = '72222222-2222-4222-8222-222222222222'), 1::bigint, 'valid provisioning creates one Personal plan');
select is((select count(*) from workspace.personal_onboarding where user_id = '72222222-2222-4222-8222-222222222222'), 1::bigint, 'valid provisioning creates one onboarding record');
select lives_ok($sql$select workspace.ensure_personal_workspace()$sql$, 'an exact linked trusted graph resumes idempotently');
select is((select count(*) from workspace.workspaces where owner_user_id = '72222222-2222-4222-8222-222222222222' and workspace_type = 'personal'), 1::bigint, 'retry does not duplicate the Personal Workspace');
select throws_ok(
  $sql$update workspace.user_profiles set canonical_user_id = '71111111-1111-4111-8111-111111111111' where user_id = '72222222-2222-4222-8222-222222222222'$sql$,
  '42501', 'permission denied for table user_profiles',
  'an owner cannot mutate their canonical identity link'
);
select lives_ok(
  $sql$update workspace.user_profiles set clock_timezones = array['Europe/London', 'Asia/Tokyo', 'Australia/Sydney'] where user_id = '72222222-2222-4222-8222-222222222222'$sql$,
  'clock preferences remain the sole direct profile update'
);
reset role;
select is(
  (select canonical_user_id from workspace.user_profiles where user_id = '72222222-2222-4222-8222-222222222222'),
  '72222222-2222-4222-8222-222222222222'::uuid,
  'the successful clock update leaves the canonical identity link unchanged'
);

insert into workspace.user_profiles (user_id, display_name, canonical_user_id, entry_provider)
values ('78888888-8888-4888-8888-888888888888', 'Conflicting link', '71111111-1111-4111-8111-111111111111', 'custom:lead-emergence-entry-workspace-boundary');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id)
values ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Conflicting Workspace', '78888888-8888-4888-8888-888888888888');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
values ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '78888888-8888-4888-8888-888888888888', 'owner', 'active');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"78888888-8888-4888-8888-888888888888","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'Personal Workspace integrity requires review.', 'a conflicting canonical profile link cannot be claimed');
reset role;
select is((select count(*) from workspace.personal_plans where user_id = '78888888-8888-4888-8888-888888888888'), 0::bigint, 'conflicting linked graph gains no plan');
select is((select count(*) from workspace.personal_onboarding where user_id = '78888888-8888-4888-8888-888888888888'), 0::bigint, 'conflicting linked graph gains no onboarding');

insert into workspace.user_profiles (user_id, display_name) values ('73333333-3333-4333-8333-333333333333', 'Skeleton');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id)
values ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Skeleton Workspace', '73333333-3333-4333-8333-333333333333');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
values ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '73333333-3333-4333-8333-333333333333', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"73333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated"}', true);
select throws_ok($sql$select workspace.ensure_personal_workspace()$sql$, '42501', 'A verified Lead Emergence identity is required.', 'an untrusted skeleton cannot receive a plan or onboarding upgrade');
reset role;
select is((select count(*) from workspace.personal_plans where user_id = '73333333-3333-4333-8333-333333333333'), 0::bigint, 'skeleton remains without a plan');
select is((select count(*) from workspace.personal_onboarding where user_id = '73333333-3333-4333-8333-333333333333'), 0::bigint, 'skeleton remains without onboarding');

select * from finish();
rollback;