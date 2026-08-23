begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '73333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'events.capture@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into workspace.user_profiles (user_id, display_name)
values ('73333333-3333-4333-8333-333333333333', 'Capture Events');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id)
values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'personal',
  'Capture Events workspace',
  '73333333-3333-4333-8333-333333333333'
);

insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '73333333-3333-4333-8333-333333333333',
  'owner',
  'active'
);

insert into workspace.personal_plans (workspace_id, user_id, plan_key)
values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '73333333-3333-4333-8333-333333333333',
  'personal'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"73333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated"}',
  true
);

insert into workspace.capture_inbox (workspace_id, raw_text, created_by) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Private first capture', '73333333-3333-4333-8333-333333333333'),
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Private second capture', '73333333-3333-4333-8333-333333333333');

select is((select count(*) from workspace.capture_inbox), 2::bigint, 'both private captures are retained');
select is((select count(*) from workspace.product_events where event_name = 'first_capture_created'), 1::bigint, 'the first-capture event is recorded exactly once');
select is((select event_context ->> 'interface' from workspace.product_events where event_name = 'first_capture_created'), 'quick_capture', 'the event records only its safe interface context');
select is((select created_by from workspace.product_events where event_name = 'first_capture_created'), '73333333-3333-4333-8333-333333333333'::uuid, 'the event remains bound to its Workspace owner');
select is((select event_context ? 'raw_text' from workspace.product_events where event_name = 'first_capture_created'), false, 'private capture content is not copied into analytics');

reset role;
select * from finish();
rollback;
