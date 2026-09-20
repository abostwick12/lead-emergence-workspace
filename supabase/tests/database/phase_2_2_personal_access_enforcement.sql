begin;
select plan(63);

select is(
  (select setting_value from workspace_private.product_settings
   where setting_key = 'phase_2_2_billing_enforcement_enabled'),
  'false',
  'Workspace Phase 2.2 enforcement remains disabled by default'
);
select is(
  (select relrowsecurity from pg_class
   where oid = 'workspace_private.personal_access_authority_projections'::regclass),
  true,
  'Non-billing authority projections use defense-in-depth RLS'
);
select is(has_table_privilege('anon', 'workspace_private.personal_access_authority_projections', 'select'), false,
  'Anonymous callers cannot read non-billing projections');
select is(has_table_privilege('authenticated', 'workspace_private.personal_access_authority_projections', 'select'), false,
  'Ordinary authenticated callers cannot read non-billing projections');
select is(has_function_privilege(
  'service_role',
  'workspace.apply_personal_authority_projection(text,uuid,text,bigint,uuid,timestamptz,jsonb)',
  'execute'
), false, 'The service role cannot invoke the Edge projection RPC');
select is(has_function_privilege(
  'workspace_projection_writer',
  'workspace.apply_personal_authority_projection(text,uuid,text,bigint,uuid,timestamptz,jsonb)',
  'execute'
), true, 'The dedicated writer can invoke the single projection RPC');
select is(has_function_privilege(
  'authenticated',
  'workspace.apply_personal_authority_projection(text,uuid,text,bigint,uuid,timestamptz,jsonb)',
  'execute'
), false, 'Ordinary authenticated callers cannot invoke the projection RPC');
select is(has_function_privilege(
  'anon',
  'workspace.apply_personal_authority_projection(text,uuid,text,bigint,uuid,timestamptz,jsonb)',
  'execute'
), false, 'Anonymous callers cannot invoke the projection RPC');
select is(has_schema_privilege('workspace_projection_writer','workspace','usage'),true,
  'The dedicated writer has the required schema usage path');
select is(has_schema_privilege('workspace_projection_writer','workspace','create'),false,
  'The dedicated writer has no schema create privilege');
select is((select rolcanlogin from pg_roles where rolname = 'workspace_projection_owner'), false,
  'The projection owner cannot log in');
select is((select rolcanlogin from pg_roles where rolname = 'workspace_projection_writer'), true,
  'The projection writer is the dedicated login identity');
select is((select rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls
  from pg_roles where rolname = 'workspace_projection_writer'), false,
  'The projection writer has no elevated role attributes');
select is(has_table_privilege('workspace_projection_writer',
  'workspace_private.personal_billing_projections','select,insert,update,delete'),false,
  'The projection writer has no direct billing projection table privilege');
select is(has_table_privilege('workspace_projection_writer',
  'workspace_private.personal_access_authority_projections','select,insert,update,delete'),false,
  'The projection writer has no direct non-billing projection table privilege');
select is(has_function_privilege(
  'workspace_projection_writer',
  'workspace.mcp_verify_current_authority()',
  'execute'
), false, 'The projection writer cannot invoke unrelated Workspace RPCs');
select ok(not exists (
  select 1
  from pg_proc as function_record,
       aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) as acl
  where function_record.oid = 'workspace.apply_personal_authority_projection(text,uuid,text,bigint,uuid,timestamptz,jsonb)'::regprocedure
    and acl.grantee = 0
    and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot invoke the projection RPC');

grant workspace_projection_writer to postgres;
grant usage on schema extensions to workspace_projection_writer;
set local role workspace_projection_writer;
select results_eq(
  $$select (workspace.apply_personal_authority_projection(
      '1',
      '00000000-0000-4000-8000-00000000d101',
      'NON_BILLING_AUTHORITY',
      10,
      '00000000-0000-4000-8000-00000000d001',
      '2026-09-19 18:00:00+00',
      '{"authority_kind":"SPONSORED_ACCESS","entitlement_status":"ACTIVE","source":"family_comp_2026"}'::jsonb
    )->>'projection_result')$$,
  array['APPLIED'],
  'A trusted normalized sponsored projection succeeds'
);
reset role;
select results_eq(
  $$select authority_kind::text || ':' || entitlement_status::text || ':' || source
    from workspace_private.personal_access_authority_projections
    where canonical_user_id = '00000000-0000-4000-8000-00000000d001'$$,
  array['SPONSORED_ACCESS:ACTIVE:family_comp_2026'],
  'Sponsored authority is stored separately from billing'
);

set local role workspace_projection_writer;
select results_eq(
  $$select (workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d102','NON_BILLING_AUTHORITY',9,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:01:00+00',
      '{"authority_kind":"SPONSORED_ACCESS","entitlement_status":"REVOKED","source":"family_comp_2026"}'::jsonb
    )->>'projection_result')$$,
  array['STALE_IGNORED'],
  'A stale non-billing projection is ignored'
);
reset role;
select is(
  (select entitlement_status::text from workspace_private.personal_access_authority_projections
   where canonical_user_id = '00000000-0000-4000-8000-00000000d001'
     and authority_kind = 'SPONSORED_ACCESS'),
  'ACTIVE',
  'A stale projection cannot overwrite newer authority'
);
set local role workspace_projection_writer;
select results_eq(
  $$select (workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d101','NON_BILLING_AUTHORITY',10,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:00:00+00',
      '{"authority_kind":"SPONSORED_ACCESS","entitlement_status":"ACTIVE","source":"family_comp_2026"}'::jsonb
    )->>'projection_result')$$,
  array['IDEMPOTENT'],
  'An identical non-billing replay is idempotent'
);
select throws_ok(
  $$select workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d103','NON_BILLING_AUTHORITY',10,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:02:00+00',
      '{"authority_kind":"SPONSORED_ACCESS","entitlement_status":"REVOKED","source":"family_comp_2026"}'::jsonb
    )$$,
  '23505', 'Projection version conflict.',
  'An equal-version conflicting projection fails closed'
);
select throws_ok(
  $$select workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d104','ARBITRARY_RPC',11,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:03:00+00','{}'::jsonb
    )$$,
  '22023', 'Unsupported PERSONAL projection kind.',
  'The write contract cannot select an arbitrary RPC'
);
select results_eq(
  $$select (workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d105','BILLING',20,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:04:00+00',
      '{"effective_state":"ACTIVE","trial_started_at":null,"trial_ends_at":null,"current_period_started_at":null,"current_period_ends_at":"2026-09-20T00:00:00Z","grace_until":null,"cancel_at_period_end":false,"payment_method_required":false}'::jsonb
    )->>'projection_result')$$,
  array['APPLIED'],
  'The same fixed RPC applies a normalized billing projection'
);
reset role;

-- Resolver matrix. Projection writes remain possible while enforcement is off;
-- only this local transaction enables the cutover for behavioral assertions.
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','SUSPENDED','family_comp_2026',11,
  '00000000-0000-4000-8000-00000000d127','2026-09-19 18:04:30+00');
update workspace_private.product_settings
set setting_value = 'true', updated_at = now()
where setting_key = 'phase_2_2_billing_enforcement_enabled';

select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:05:00+00'), true,
  'ACTIVE before its period boundary allows access');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-20 00:00:00+00'), false,
  'ACTIVE at its period boundary denies access');
select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d002','ACTIVE',null,null,null,null,null,false,false,
  1,'00000000-0000-4000-8000-00000000d202','2026-09-19 18:05:30+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d002','2026-09-19 18:06:00+00'), false,
  'ACTIVE with a missing period boundary denies access');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','TRIALING',null,'2026-09-26 00:00:00+00',null,null,null,false,true,
  21,'00000000-0000-4000-8000-00000000d106','2026-09-19 18:06:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:07:00+00'), true,
  'TRIALING before its trial boundary allows access');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-26 00:00:00+00'), false,
  'TRIALING at its trial boundary denies access');
select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d003','TRIALING',null,null,null,null,null,false,true,
  1,'00000000-0000-4000-8000-00000000d203','2026-09-19 18:06:30+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d003','2026-09-19 18:07:00+00'), false,
  'TRIALING with a missing trial boundary denies access');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','PAYMENT_GRACE',null,null,null,null,'2026-09-20 00:00:00+00',false,true,
  22,'00000000-0000-4000-8000-00000000d107','2026-09-19 18:08:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 23:59:00+00'), true,
  'PAYMENT_GRACE before its deadline allows access');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-20 00:00:00+00'), false,
  'PAYMENT_GRACE at its deadline denies access');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','PAUSED_NO_PAYMENT_METHOD',null,null,null,null,null,false,true,
  23,'00000000-0000-4000-8000-00000000d108','2026-09-19 18:09:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:10:00+00'), false,
  'PAUSED_NO_PAYMENT_METHOD denies without another authority');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','SUSPENDED_PAYMENT',null,null,null,null,null,false,true,
  24,'00000000-0000-4000-8000-00000000d109','2026-09-19 18:11:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:12:00+00'), false,
  'SUSPENDED_PAYMENT denies without another authority');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','CANCEL_AT_PERIOD_END',null,null,null,'2026-09-21 00:00:00+00',null,true,false,
  25,'00000000-0000-4000-8000-00000000d110','2026-09-19 18:13:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-20 23:59:00+00'), true,
  'CANCEL_AT_PERIOD_END before period end allows access');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-21 00:00:00+00'), false,
  'CANCEL_AT_PERIOD_END at period end denies access');

select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','CANCELED',null,null,null,null,null,false,false,
  26,'00000000-0000-4000-8000-00000000d111','2026-09-19 18:14:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:15:00+00'), false,
  'CANCELED billing denies without another authority');

select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','ACTIVE','family_comp_2026',27,
  '00000000-0000-4000-8000-00000000d128','2026-09-19 18:15:30+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:15:00+00'), true,
  'ACTIVE sponsored authority allows despite canceled billing');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','SUSPENDED','family_comp_2026',28,
  '00000000-0000-4000-8000-00000000d112','2026-09-19 18:16:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:17:00+00'), false,
  'SUSPENDED sponsored authority denies without another authority');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','REVOKED','family_comp_2026',29,
  '00000000-0000-4000-8000-00000000d113','2026-09-19 18:18:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:19:00+00'), false,
  'REVOKED sponsored authority denies without another authority');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','INTERNAL_OPERATOR','ACTIVE','operator_allowlist',30,
  '00000000-0000-4000-8000-00000000d114','2026-09-19 18:20:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:21:00+00'), true,
  'ACTIVE internal operator authority allows access');

set local role workspace_projection_writer;
select throws_ok(
  $$select workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d115','NON_BILLING_AUTHORITY',30,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:22:00+00',
      '{"authority_kind":"OFFER_ELIGIBILITY","entitlement_status":"ACTIVE","source":"offer"}'::jsonb
    )$$,
  '22023', 'Invalid normalized non-billing authority projection.',
  'OFFER_ELIGIBILITY cannot be projected as access'
);
select throws_ok(
  $$select workspace.apply_personal_authority_projection(
      '1','00000000-0000-4000-8000-00000000d116','NON_BILLING_AUTHORITY',31,
      '00000000-0000-4000-8000-00000000d001','2026-09-19 18:23:00+00',
      '{"authority_kind":"LEGACY_PREBILLING","entitlement_status":"ACTIVE","source":"legacy"}'::jsonb
    )$$,
  '22023', 'Invalid normalized non-billing authority projection.',
  'LEGACY_PREBILLING cannot be projected as access'
);
reset role;
revoke usage on schema extensions from workspace_projection_writer;
revoke workspace_projection_writer from postgres;

select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','INTERNAL_OPERATOR','SUSPENDED','operator_allowlist',32,
  '00000000-0000-4000-8000-00000000d117','2026-09-19 18:24:00+00');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','ACTIVE','family_comp_2026',33,
  '00000000-0000-4000-8000-00000000d118','2026-09-19 18:25:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:26:00+00'), true,
  'Canceled billing plus active sponsored authority allows');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','REVOKED','family_comp_2026',34,
  '00000000-0000-4000-8000-00000000d119','2026-09-19 18:27:00+00');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','INTERNAL_OPERATOR','ACTIVE','operator_allowlist',35,
  '00000000-0000-4000-8000-00000000d120','2026-09-19 18:28:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:29:00+00'), true,
  'Suspended billing plus active internal authority allows');
select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','ACTIVE',null,null,null,'2026-09-20 00:00:00+00',null,false,false,
  36,'00000000-0000-4000-8000-00000000d121','2026-09-19 18:30:00+00');
select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','INTERNAL_OPERATOR','REVOKED','operator_allowlist',37,
  '00000000-0000-4000-8000-00000000d122','2026-09-19 18:31:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:32:00+00'), true,
  'Active billing plus revoked alternate authorities allows');
select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','SUSPENDED_PAYMENT',null,null,null,null,null,false,true,
  38,'00000000-0000-4000-8000-00000000d123','2026-09-19 18:33:00+00');
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000d001','2026-09-19 18:34:00+00'), false,
  'All non-authorizing authorities deny access');

-- Workspace, capability, MCP, and RLS enforcement fixture.
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-00000000d201','authenticated','authenticated','slice-d-alice@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-00000000d202','authenticated','authenticated','slice-d-bob@example.invalid','',now(),'{}','{}',now(),now());
insert into workspace.user_profiles(user_id,canonical_user_id,display_name) values
  ('00000000-0000-4000-8000-00000000d201','00000000-0000-4000-8000-00000000d001','Slice D Alice'),
  ('00000000-0000-4000-8000-00000000d202','00000000-0000-4000-8000-00000000d002','Slice D Bob');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
  ('00000000-0000-4000-8000-00000000d301','personal','Slice D Alice Workspace','00000000-0000-4000-8000-00000000d201'),
  ('00000000-0000-4000-8000-00000000d302','personal','Slice D Bob Workspace','00000000-0000-4000-8000-00000000d202');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
  ('00000000-0000-4000-8000-00000000d301','00000000-0000-4000-8000-00000000d201','owner','active'),
  ('00000000-0000-4000-8000-00000000d302','00000000-0000-4000-8000-00000000d202','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key,status) values
  ('00000000-0000-4000-8000-00000000d301','00000000-0000-4000-8000-00000000d201','personal','active'),
  ('00000000-0000-4000-8000-00000000d302','00000000-0000-4000-8000-00000000d202','personal','active');
insert into workspace.tasks(id,workspace_id,title,created_by) values
  ('00000000-0000-4000-8000-00000000d401','00000000-0000-4000-8000-00000000d301','Alice retained task','00000000-0000-4000-8000-00000000d201'),
  ('00000000-0000-4000-8000-00000000d402','00000000-0000-4000-8000-00000000d302','Bob private task','00000000-0000-4000-8000-00000000d202');
update workspace_private.product_settings set setting_value = 'true'
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
values ('00000000-0000-4000-8000-00000000d201','00000000-0000-4000-8000-00000000d501',
  'https://workspace.leademergence.com/api/mcp',array['openid']);
select set_config(
  'request.test_mcp_resource_uri',
  (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  true
);

-- Temporarily prove disabled behavior without changing the installed default.
update workspace_private.product_settings set setting_value = 'false'
where setting_key = 'phase_2_2_billing_enforcement_enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000d201","role":"authenticated","aud":"authenticated"}',true);
select is((select count(*) from workspace.tasks where workspace_id = '00000000-0000-4000-8000-00000000d301'),1::bigint,
  'Cutover disabled preserves Phase 2.1 hosted data access');
reset role;

update workspace_private.product_settings set setting_value = 'true'
where setting_key = 'phase_2_2_billing_enforcement_enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000d201","role":"authenticated","aud":"authenticated"}',true);
select is((select count(*) from workspace.workspaces where id = '00000000-0000-4000-8000-00000000d301'),1::bigint,
  'Suspension retains the Workspace row');
select is((select count(*) from workspace.workspace_memberships where workspace_id = '00000000-0000-4000-8000-00000000d301'),1::bigint,
  'Suspension retains and exposes the caller membership for the locked shell');
reset role;
select is(workspace_private.has_personal_capability('00000000-0000-4000-8000-00000000d301','core_workspace'),false,
  'Capabilities deny a suspended ordinary customer');
set local role authenticated;
select is((select count(*) from workspace.tasks where workspace_id = '00000000-0000-4000-8000-00000000d301'),0::bigint,
  'Direct hosted-data SELECT denies a suspended ordinary customer');
select throws_ok(
  $$insert into workspace.tasks(workspace_id,title,created_by)
    values ('00000000-0000-4000-8000-00000000d301','Denied write','00000000-0000-4000-8000-00000000d201')$$,
  '42501', null,
  'Hosted writes deny when effective access is denied'
);
select is(workspace.get_personal_access_state()->>'reason','ACCESS_SUSPENDED',
  'The bounded shell resolver reports a non-sensitive suspended state');
select set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
  'sub','00000000-0000-4000-8000-00000000d201',
  'role','authenticated',
  'aud',current_setting('request.test_mcp_resource_uri'),
  'client_id','00000000-0000-4000-8000-00000000d501',
  'workspace_mcp',true
)::text,true);
select is(workspace.mcp_verify_current_authority(),false,
  'MCP authorization denies a suspended ordinary customer');
reset role;

select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','ACTIVE','family_comp_2026',39,
  '00000000-0000-4000-8000-00000000d124','2026-09-19 18:35:00+00');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000d201","role":"authenticated","aud":"authenticated"}',true);
reset role;
select is(workspace_private.has_personal_capability('00000000-0000-4000-8000-00000000d301','core_workspace'),true,
  'Capabilities allow an active sponsored customer');
set local role authenticated;
select is((select count(*) from workspace.tasks where workspace_id = '00000000-0000-4000-8000-00000000d301'),1::bigint,
  'Direct hosted-data SELECT allows a valid customer within tenant scope');
select is((select count(*) from workspace.tasks where workspace_id = '00000000-0000-4000-8000-00000000d302'),0::bigint,
  'Effective access does not broaden cross-tenant visibility');
select set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
  'sub','00000000-0000-4000-8000-00000000d201',
  'role','authenticated',
  'aud',current_setting('request.test_mcp_resource_uri'),
  'client_id','00000000-0000-4000-8000-00000000d501',
  'workspace_mcp',true
)::text,true);
select is(workspace.mcp_verify_current_authority(),true,
  'MCP authorization allows a valid active sponsored customer');
reset role;

select workspace_private.apply_personal_access_authority_projection(
  '00000000-0000-4000-8000-00000000d001','SPONSORED_ACCESS','REVOKED','family_comp_2026',40,
  '00000000-0000-4000-8000-00000000d125','2026-09-19 18:36:00+00');
select workspace_private.apply_personal_billing_projection(
  '00000000-0000-4000-8000-00000000d001','ACTIVE',null,null,null,'2099-01-01 00:00:00+00',null,false,false,
  41,'00000000-0000-4000-8000-00000000d126','2026-09-19 18:37:00+00');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000d201","role":"authenticated","aud":"authenticated"}',true);
select is((select count(*) from workspace.tasks where id = '00000000-0000-4000-8000-00000000d401'),1::bigint,
  'Denied to valid recovery restores retained data without recreation');
select is((select id from workspace.workspaces where owner_user_id = '00000000-0000-4000-8000-00000000d201'),
  '00000000-0000-4000-8000-00000000d301'::uuid,
  'Recovery preserves the original Workspace identity');
reset role;

update workspace_private.product_settings set setting_value = 'false'
where setting_key = 'phase_2_2_billing_enforcement_enabled';
select is(workspace_private.has_effective_personal_access_for_canonical(
  '00000000-0000-4000-8000-00000000ffff',now()),true,
  'Cutover disabled preserves old behavior even without a projection');

select * from finish();
rollback;
