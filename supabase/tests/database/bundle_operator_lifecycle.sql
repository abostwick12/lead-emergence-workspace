begin;

select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'lifecycle.operator@example.invalid', '', now(), '{"provider":"email","providers":["email"],"workspace_bundle_operator":true}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'lifecycle.client@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'lifecycle.ordinary@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('a2222222-2222-4222-8222-222222222222', 'Lifecycle Client');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Lifecycle Client Workspace', 'a2222222-2222-4222-8222-222222222222');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2222222-2222-4222-8222-222222222222', 'personal');

select is(has_function_privilege('anon', 'workspace.get_bundle_operator_state(uuid)', 'execute'), false, 'anonymous callers cannot review client bundle state');
select is(has_function_privilege('authenticated', 'workspace.get_bundle_operator_state(uuid)', 'execute'), true, 'authenticated callers reach the fail-closed review bridge');
select is(has_function_privilege('authenticated', 'workspace_private.get_bundle_operator_state(uuid)', 'execute'), false, 'the private review implementation is not directly callable');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select throws_ok(
  $sql$select workspace.get_bundle_operator_state(null)$sql$,
  '42501', 'Bundle operator authorization is required.',
  'a stale or forged JWT operator flag cannot authorize a catalog review'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(workspace.get_bundle_operator_state(null) -> 'workspace', 'null'::jsonb, 'an operator can load the catalog before choosing a client');
select is(
  (select count(*)::integer from jsonb_array_elements(workspace.get_bundle_operator_state(null) -> 'bundles') as bundle where bundle ->> 'bundleKey' in ('executive','writer_editor','ministry','nonprofit_founder','investor','workspace_experience')),
  6,
  'the client access catalog includes all six Lead Emergence bundles'
);
select is(
  (select count(*)::integer from jsonb_array_elements(workspace.get_bundle_operator_state(null) -> 'bundles') as bundle where bundle ->> 'state' = 'available' and bundle -> 'entitlementId' = 'null'::jsonb),
  (select count(*)::integer from workspace.bundle_definitions where availability_status = 'active'),
  'unscoped catalog review returns no client entitlement details'
);
select is(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') #>> '{workspace,ownerDisplayName}', 'Lifecycle Client', 'review verifies the active owner display name');
select is(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') #>> '{workspace,ownerEmail}', 'lifecycle.client@example.invalid', 'review returns the normalized owner email');
select is(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') #>> '{workspace,workspaceName}', 'Lifecycle Client Workspace', 'review returns the exact Personal Workspace name');
select throws_ok(
  $sql$select workspace.get_bundle_operator_state('a9aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$sql$,
  '22023', 'An active Personal Workspace owner is required.',
  'review rejects an unknown workspace instead of exposing a partial record'
);

select is(
  (
    select count(*)::integer
    from (
      select workspace.issue_bundle_assignment(
        'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        bundle_key,
        'lifecycle-' || bundle_key || '-001',
        null
      ) as entitlement
      from unnest(array['executive','writer_editor','ministry','nonprofit_founder','investor','workspace_experience']) as bundle_key
    ) as issued
    where issued.entitlement ->> 'state' = 'active'
  ),
  6,
  'one operator operation path grants all six bundle definitions'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') -> 'bundles') as bundle
    where bundle ->> 'bundleKey' in ('executive','writer_editor','ministry','nonprofit_founder','investor','workspace_experience')
      and bundle ->> 'state' = 'active'
      and bundle ->> 'source' = 'operator_assignment'
  ),
  6,
  'review reconciles all six direct grants as active'
);
select is(
  (select bundle ->> 'capabilityCount' from jsonb_array_elements(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') -> 'bundles') as bundle where bundle ->> 'bundleKey' = 'writer_editor'),
  (select count(*)::text from workspace.bundle_capabilities where bundle_key = 'writer_editor' and enabled),
  'review derives capability count from the canonical catalog'
);
reset role;

select set_config(
  'request.lifecycle_writer_entitlement',
  (select id::text from workspace.bundle_entitlements where workspace_id = 'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key = 'writer_editor' and revoked_at is null),
  true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.revoke_bundle_entitlement(current_setting('request.lifecycle_writer_entitlement')::uuid, 'Client access lifecycle acceptance.') ->> 'state',
  'revoked',
  'operator removal revokes the exact reviewed entitlement'
);
select is(
  (select bundle ->> 'state' from jsonb_array_elements(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') -> 'bundles') as bundle where bundle ->> 'bundleKey' = 'writer_editor'),
  'revoked',
  'review immediately reflects removed access'
);
select is(
  (select bundle ->> 'revocationReason' from jsonb_array_elements(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') -> 'bundles') as bundle where bundle ->> 'bundleKey' = 'writer_editor'),
  'Client access lifecycle acceptance.',
  'review preserves the auditable removal reason'
);
select is(
  workspace.issue_bundle_assignment('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'writer_editor', 'lifecycle-writer-editor-002', null) ->> 'state',
  'active',
  'operator can safely grant a removed bundle again'
);
select is(
  (select bundle ->> 'state' from jsonb_array_elements(workspace.get_bundle_operator_state('a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') -> 'bundles') as bundle where bundle ->> 'bundleKey' = 'writer_editor'),
  'active',
  'review resolves the newest active entitlement after re-grant'
);
reset role;

select is(
  (select count(*)::integer from workspace.bundle_entitlements where workspace_id = 'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key = 'writer_editor'),
  2,
  're-grant preserves the removed entitlement in audit history'
);
select is(
  (select count(*)::integer from workspace.bundle_entitlements where workspace_id = 'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key in ('executive','writer_editor','ministry','nonprofit_founder','investor','workspace_experience') and revoked_at is null),
  6,
  'exactly one current entitlement remains for every Lead Emergence bundle'
);

select * from finish();
rollback;
