begin;

select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'bundle.operator@example.invalid', '', now(), '{"provider":"email","providers":["email"],"workspace_bundle_operator":true}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'bundle.founder@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '83333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'bundle.invitee@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '84444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'bundle.intruder@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('82222222-2222-4222-8222-222222222222', 'Bundle Founder'),
  ('83333333-3333-4333-8333-333333333333', 'Bundle Invitee'),
  ('84444444-4444-4444-8444-444444444444', 'Bundle Intruder');

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Bundle Founder Workspace', '82222222-2222-4222-8222-222222222222'),
  ('83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Bundle Invitee Workspace', '83333333-3333-4333-8333-333333333333'),
  ('84cccccc-cccc-4ccc-8ccc-cccccccccccc', 'personal', 'Bundle Intruder Workspace', '84444444-4444-4444-8444-444444444444');

insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '82222222-2222-4222-8222-222222222222', 'owner', 'active'),
  ('83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '83333333-3333-4333-8333-333333333333', 'owner', 'active'),
  ('84cccccc-cccc-4ccc-8ccc-cccccccccccc', '84444444-4444-4444-8444-444444444444', 'owner', 'active');

insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '82222222-2222-4222-8222-222222222222', 'personal'),
  ('83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '83333333-3333-4333-8333-333333333333', 'personal'),
  ('84cccccc-cccc-4ccc-8ccc-cccccccccccc', '84444444-4444-4444-8444-444444444444', 'personal');

select is((select bundle_key from workspace.bundle_definitions where bundle_key = 'sotf_transition'), 'sotf_transition', 'SOTF is normal bundle catalog data');
select is((select display_name from workspace.bundle_definitions where bundle_key = 'sotf_transition'), 'SOTF Bundle', 'the catalog preserves the approved user-facing label');
select is((select count(*)::integer from workspace.bundle_capabilities where bundle_key = 'sotf_transition'), 6, 'SOTF receives generic capability mappings including the P2 context graph');
select is((select relrowsecurity from pg_class where oid = 'workspace.bundle_definitions'::regclass), true, 'bundle definitions use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.bundle_capabilities'::regclass), true, 'bundle capability mappings use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.bundle_entitlements'::regclass), true, 'bundle entitlements use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace_private.bundle_invites'::regclass), true, 'private bundle invites use defense-in-depth RLS');
select is(has_table_privilege('authenticated', 'workspace.bundle_entitlements', 'insert'), false, 'ordinary users cannot directly insert bundle entitlements');
select is(has_table_privilege('authenticated', 'workspace.bundle_entitlements', 'update'), false, 'ordinary users cannot directly revoke or rewrite bundle entitlements');
select is(has_table_privilege('authenticated', 'workspace_private.bundle_invites', 'select'), false, 'invite internals are not readable by ordinary users');
select is(has_function_privilege('anon', 'workspace.issue_bundle_assignment(uuid,text,text,timestamptz)', 'execute'), false, 'anonymous callers cannot issue assignments');
select is(has_function_privilege('anon', 'workspace.claim_bundle_invite(text)', 'execute'), false, 'anonymous callers cannot claim invites');
select is(has_function_privilege('authenticated', 'workspace.issue_bundle_assignment(uuid,text,text,timestamptz)', 'execute'), true, 'authenticated callers reach the fail-closed operator bridge');
select is(has_function_privilege('authenticated', 'workspace_private.upsert_bundle_entitlement(uuid,text,uuid,text,text,uuid,timestamptz)', 'execute'), false, 'canonical entitlement writes are not directly callable by ordinary users');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.issue_bundle_assignment('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'founder-grant-001', null) ->> 'state',
  'active',
  'an authorized operator grants the founder through the product RPC'
);
select is(
  workspace.issue_bundle_assignment('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'founder-grant-001', null) ->> 'idempotent_replay',
  'true',
  'repeating the founder assignment is idempotent'
);
reset role;

select is((select count(*)::integer from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'repeated founder assignment creates one entitlement');
select is((select source from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'operator_assignment', 'founder assignment records its source');
select is((select issuer_user_id from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '81111111-1111-4111-8111-111111111111'::uuid, 'founder assignment records its issuer');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') ->> 'state', 'active', 'the founder resolves an active SOTF Bundle');
select is((select count(*)::integer from workspace.bundle_entitlements), 1, 'the founder can read their own entitlement');
select is((select count(*)::integer from workspace.bundle_entitlements where workspace_id = '83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'workspace A cannot read workspace B entitlements');
select throws_ok(
  $sql$select workspace.resolve_bundle_entitlement('83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sotf_transition')$sql$,
  '42501', 'This Workspace bundle state is unavailable.',
  'workspace A cannot resolve workspace B bundle state'
);
select is(workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'missing_bundle') ->> 'state', 'unavailable', 'an unknown bundle resolves unavailable without a special case');
select throws_ok(
  $sql$select workspace.issue_bundle_assignment('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'ordinary-grant-001', null)$sql$,
  '42501', 'Bundle operator authorization is required.',
  'an ordinary user cannot issue an operator assignment'
);
select throws_ok(
  $sql$select workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'ordinary-user-cannot-issue-this-token-0001', 'ordinary-invite-001', null)$sql$,
  '42501', 'Bundle operator authorization is required.',
  'an ordinary user cannot issue bundle invites'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'invitee-valid-token-00000000000000000001', 'invitee-invite-001', null) ->> 'status',
  'pending',
  'an authorized operator issues a bounded bundle invite'
);
select is(
  workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'invitee-valid-token-00000000000000000001', 'invitee-invite-001', null) ? 'token_hash',
  false,
  'invite issuance does not expose the token hash'
);
select is(
  workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'invitee-valid-token-00000000000000000001', 'invitee-invite-001', null) ->> 'idempotent_replay',
  'true',
  'invite issuance retries reconcile safely'
);
reset role;

select is((select count(*)::integer from workspace_private.bundle_invites where idempotency_key = 'invitee-invite-001'), 1, 'invite retries create one private invite');
select is((select issuer_user_id from workspace_private.bundle_invites where idempotency_key = 'invitee-invite-001'), '81111111-1111-4111-8111-111111111111'::uuid, 'invite issuance records its operator');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"83333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated"}', true);
select is(
  workspace.claim_bundle_invite('invitee-valid-token-00000000000000000001') #>> '{entitlement,state}',
  'active',
  'the intended pilot claims an active canonical entitlement'
);
select is(
  workspace.claim_bundle_invite('invitee-valid-token-00000000000000000001') #>> '{entitlement,source}',
  'invite',
  'invite claim records the canonical invite source'
);
select is(
  workspace.claim_bundle_invite('invitee-valid-token-00000000000000000001') ->> 'idempotent_replay',
  'true',
  'the intended claimant can safely retry without claiming twice'
);
select is(workspace.resolve_bundle_entitlement('83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sotf_transition') ->> 'state', 'active', 'the invited pilot resolves the same active contract as the founder');
select throws_ok(
  $sql$select workspace.claim_bundle_invite('invalid-invite-token-000000000000000000000')$sql$,
  '42501', 'This bundle invite is invalid or unavailable.',
  'an invalid invite token fails closed'
);
reset role;

select is((select count(*)::integer from workspace.bundle_entitlements where workspace_id = '83bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1, 'repeated invite claim creates one entitlement');
select is((select count(*)::integer from workspace_private.bundle_invites where claimed_by_user_id = '83333333-3333-4333-8333-333333333333'), 1, 'an invite is consumed once by the intended user');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"84444444-4444-4444-8444-444444444444","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.claim_bundle_invite('invitee-valid-token-00000000000000000001')$sql$,
  '42501', 'This bundle invite is invalid or unavailable.',
  'a consumed invite cannot be claimed by another user'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select lives_ok(
  $sql$select workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'wrong-user-invite-token-000000000000000001', 'wrong-user-invite-01', null)$sql$,
  'operator can issue an invite used to verify recipient binding'
);
select lives_ok(
  $sql$select workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'revoked-invite-token-00000000000000000001', 'revoked-invite-001', null)$sql$,
  'operator can issue an invite used to verify revocation'
);
select lives_ok(
  $sql$select workspace.issue_bundle_invite('sotf_transition', 'bundle.invitee@example.invalid', 'expired-invite-token-00000000000000000001', 'expired-invite-001', null)$sql$,
  'operator can issue an invite used to verify expiry'
);
reset role;
select set_config(
  'request.revoked_invite_id',
  (select id::text from workspace_private.bundle_invites where idempotency_key = 'revoked-invite-001'),
  true
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.revoke_bundle_invite(
    current_setting('request.revoked_invite_id')::uuid,
    'Pilot invitation withdrawn.'
  ) ->> 'status',
  'revoked',
  'an operator can revoke an unclaimed invite'
);
select is(
  workspace.revoke_bundle_invite(
    current_setting('request.revoked_invite_id')::uuid,
    'Pilot invitation withdrawn.'
  ) ->> 'idempotent_replay',
  'true',
  'invite revocation is safe to retry'
);
reset role;

update workspace_private.bundle_invites
set expires_at = now() - interval '1 minute'
where idempotency_key = 'expired-invite-001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"84444444-4444-4444-8444-444444444444","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.claim_bundle_invite('wrong-user-invite-token-000000000000000001')$sql$,
  '42501', 'This bundle invite is invalid or unavailable.',
  'an invite cannot be claimed by a different authenticated email'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"83333333-3333-4333-8333-333333333333","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $sql$select workspace.claim_bundle_invite('revoked-invite-token-00000000000000000001')$sql$,
  '42501', 'This bundle invite is invalid or unavailable.',
  'a revoked invite fails closed'
);
select throws_ok(
  $sql$select workspace.claim_bundle_invite('expired-invite-token-00000000000000000001')$sql$,
  '42501', 'This bundle invite is invalid or unavailable.',
  'an expired invite fails closed'
);
reset role;

select set_config(
  'request.founder_entitlement_id',
  (select id::text from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revoked_at is null),
  true
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.revoke_bundle_entitlement(
    current_setting('request.founder_entitlement_id')::uuid,
    'Founder access paused for lifecycle verification.'
  ) ->> 'state',
  'revoked',
  'an operator can revoke a bundle entitlement'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') ->> 'state', 'revoked', 'a revoked entitlement does not resolve active');
select is(
  workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') -> 'capabilities' @> '[{"capability_key":"agentic_workflows"}]'::jsonb,
  false,
  'a revoked bundle adds no capability'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.issue_bundle_assignment('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'founder-grant-002', null) ->> 'state',
  'active',
  'a later operator grant restores canonical access without rewriting history'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select is(
  workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') -> 'capabilities' @> '[{"capability_key":"agentic_workflows"}]'::jsonb,
  true,
  'an active bundle adds mapped capabilities to the foundational plan'
);
reset role;

update workspace.bundle_entitlements set
  starts_at = now() - interval '2 days',
  expires_at = now() - interval '1 day'
where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revoked_at is null;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') ->> 'state', 'expired', 'an expired entitlement does not resolve active');
select is(
  workspace.resolve_bundle_entitlement('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition') -> 'capabilities' @> '[{"capability_key":"agentic_workflows"}]'::jsonb,
  false,
  'an expired bundle adds no capability'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated","app_metadata":{"workspace_bundle_operator":true}}', true);
select is(
  workspace.issue_bundle_assignment('82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'founder-grant-003', null) ->> 'state',
  'active',
  'a new grant safely supersedes an expired current entitlement'
);
reset role;

select is((select count(*)::integer from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 3, 'revoked and expired history remains available for audit');
select is((select count(*)::integer from workspace.bundle_entitlements where workspace_id = '82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revoked_at is null), 1, 'only one current entitlement exists per Workspace and bundle');

select * from finish();
rollback;
