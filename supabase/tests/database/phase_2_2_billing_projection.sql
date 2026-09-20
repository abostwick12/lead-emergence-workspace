begin;
select plan(21);

select is(
  (select relrowsecurity from pg_class where oid = 'workspace_private.personal_billing_projections'::regclass),
  true,
  'Workspace billing projections are RLS protected'
);
select is(
  has_table_privilege('anon', 'workspace_private.personal_billing_projections', 'select'),
  false,
  'Anonymous clients cannot read the billing projection'
);
select is(
  has_table_privilege('authenticated', 'workspace_private.personal_billing_projections', 'select'),
  false,
  'Authenticated clients cannot read the billing projection'
);
select is(
  has_table_privilege('authenticated', 'workspace_private.personal_billing_projections', 'insert'),
  false,
  'Authenticated clients cannot write the billing projection'
);
select is(
  has_function_privilege(
    'service_role',
    'workspace_private.apply_personal_billing_projection(uuid,workspace_private.personal_billing_effective_state,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,boolean,boolean,bigint,text,timestamptz)',
    'execute'
  ),
  false,
  'The service role cannot invoke the private billing projection function'
);
select is(
  has_function_privilege(
    'authenticated',
    'workspace_private.apply_personal_billing_projection(uuid,workspace_private.personal_billing_effective_state,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,boolean,boolean,bigint,text,timestamptz)',
    'execute'
  ),
  false,
  'Authenticated callers cannot invoke the projection writer'
);
select is(
  has_function_privilege(
    'anon',
    'workspace_private.apply_personal_billing_projection(uuid,workspace_private.personal_billing_effective_state,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,boolean,boolean,bigint,text,timestamptz)',
    'execute'
  ),
  false,
  'Anonymous callers cannot invoke the projection writer'
);
select is(
  (select setting_value from workspace_private.product_settings
   where setting_key = 'phase_2_2_billing_enforcement_enabled'),
  'false',
  'Workspace billing enforcement defaults disabled'
);

create temporary table phase_2_2_workspace_baseline as
select
  (select count(*) from workspace.workspaces) as workspace_count,
  (select count(*) from workspace.workspace_memberships) as membership_count;

select results_eq(
  $$select projection_result || ':' || effective_version::text
    from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b1',
      'ACTIVE',
      null,
      null,
      '2026-09-01 00:00:00+00',
      '2026-10-01 00:00:00+00',
      null,
      false,
      false,
      2,
      'evt_projection_v2',
      '2026-09-19 18:00:00+00'
    )$$,
  array['APPLIED:2'],
  'The private projection function applies a normalized projection for its database owner'
);

select results_eq(
  $$select effective_state::text || ':' || source_billing_version::text
    from workspace_private.personal_billing_projections
    where canonical_user_id = '00000000-0000-4000-8000-0000000022b1'$$,
  array['ACTIVE:2'],
  'The normalized state and source version are stored without Stripe identifiers'
);

select results_eq(
  $$select projection_result || ':' || effective_version::text
    from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b1',
      'CANCELED',
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      1,
      'evt_projection_stale',
      '2026-09-19 17:00:00+00'
    )$$,
  array['STALE_IGNORED:2'],
  'A stale projection is ignored'
);

select results_eq(
  $$select effective_state::text || ':' || source_event_id
    from workspace_private.personal_billing_projections
    where canonical_user_id = '00000000-0000-4000-8000-0000000022b1'$$,
  array['ACTIVE:evt_projection_v2'],
  'A stale projection cannot overwrite newer state'
);

select results_eq(
  $$select projection_result || ':' || effective_version::text
    from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b1',
      'ACTIVE',
      null,
      null,
      '2026-09-01 00:00:00+00',
      '2026-10-01 00:00:00+00',
      null,
      false,
      false,
      2,
      'evt_projection_v2',
      '2026-09-19 18:00:00+00'
    )$$,
  array['IDEMPOTENT:2'],
  'An identical projection retry is idempotent'
);
select throws_ok(
  $$select * from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b1',
      'SUSPENDED_PAYMENT',
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      2,
      'evt_projection_conflict',
      '2026-09-19 18:01:00+00'
    )$$,
  '23505',
  'Projection version conflict.',
  'An equal version with different content is rejected'
);

select is(
  (select count(*) from workspace.workspaces),
  (select workspace_count from phase_2_2_workspace_baseline),
  'Projection reconciliation creates no workspaces'
);
select is(
  (select count(*) from workspace.workspace_memberships),
  (select membership_count from phase_2_2_workspace_baseline),
  'Projection reconciliation creates no memberships'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000022c1',
  'authenticated',
  'authenticated',
  'phase22-workspace@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);
insert into workspace.user_profiles(user_id, canonical_user_id, display_name)
values (
  '00000000-0000-4000-8000-0000000022c1',
  '00000000-0000-4000-8000-0000000022b1',
  'Phase 2.2 Workspace User'
);
insert into workspace.workspaces(id, workspace_type, name, owner_user_id)
values (
  '00000000-0000-4000-8000-0000000022d1',
  'personal',
  'Phase 2.2 unchanged behavior',
  '00000000-0000-4000-8000-0000000022c1'
);
insert into workspace.workspace_memberships(workspace_id, user_id, role, status)
values (
  '00000000-0000-4000-8000-0000000022d1',
  '00000000-0000-4000-8000-0000000022c1',
  'owner',
  'active'
);
insert into workspace.personal_plans(workspace_id, user_id, plan_key, status)
values (
  '00000000-0000-4000-8000-0000000022d1',
  '00000000-0000-4000-8000-0000000022c1',
  'personal',
  'active'
);

select results_eq(
  $$select projection_result || ':' || effective_version::text
    from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b1',
      'CANCELED',
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      3,
      'evt_projection_v3_canceled',
      '2026-09-19 19:00:00+00'
    )$$,
  array['APPLIED:3'],
  'A newer normalized state can be projected without enforcing it'
);
select throws_ok(
  $$select * from workspace_private.apply_personal_billing_projection(
      '00000000-0000-4000-8000-0000000022b2',
      'ACTIVE',
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      1,
      'evt_projection_v3_canceled',
      '2026-09-19 19:00:00+00'
    )$$,
  '23505',
  null,
  'A source event ID cannot be applied to two canonical users'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000022c1","role":"authenticated","aud":"authenticated"}',
  true
);
select lives_ok(
  $$insert into workspace.tasks(id, workspace_id, title, created_by)
    values (
      '00000000-0000-4000-8000-0000000022e1',
      '00000000-0000-4000-8000-0000000022d1',
      'Phase 2.2 capability regression check',
      '00000000-0000-4000-8000-0000000022c1'
    )$$,
  'A canceled projection does not change existing capability-gated runtime writes while cutover is disabled'
);
reset role;

select results_eq(
  $$select status from workspace.workspace_memberships
    where workspace_id = '00000000-0000-4000-8000-0000000022d1'
      and user_id = '00000000-0000-4000-8000-0000000022c1'$$,
  array['active'],
  'A canceled projection does not alter existing membership state'
);
select ok(
  pg_get_functiondef('workspace.ensure_personal_workspace()'::regprocedure)
    not like '%personal_billing_projections%',
  'Existing provisioning does not consult the projection before cutover'
);

select * from finish();
rollback;
