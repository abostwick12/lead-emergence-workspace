begin;

select no_plan();

create function pg_temp.context_test_count(target_kind text, target_family text default null)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return case target_kind
    when 'candidate' then (
      select count(*)::integer from workspace.context_candidates
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and (target_family is null or entity_family = target_family)
    )
    when 'entity' then (
      select count(*)::integer from workspace.professional_context_entities
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and (target_family is null or entity_family = target_family)
    )
    when 'active_entity' then (
      select count(*)::integer from workspace.professional_context_entities
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and lifecycle_status = 'active'
        and (target_family is null or entity_family = target_family)
    )
    when 'evidence' then (
      select count(*)::integer from workspace.context_evidence
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
    when 'memory_link' then (
      select count(*)::integer from workspace.professional_context_links
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and target_record_type = 'memory_entry'
    )
    when 'link' then (
      select count(*)::integer from workspace.professional_context_links
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
    when 'review' then (
      select count(*)::integer from workspace.context_reviews
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
    when 'chapter' then (
      select count(*)::integer from workspace.context_chapters
      where workspace_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
    else -1
  end;
end;
$$;

create function pg_temp.context_candidate_value(target_id uuid, target_field text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case target_field when 'status' then status when 'summary' then proposed_summary end
  from workspace.context_candidates where id = target_id;
$$;

create function pg_temp.context_entity_value(target_id uuid, target_field text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case target_field
    when 'tier' then tier
    when 'status' then lifecycle_status
    when 'summary' then summary
    when 'superseded_by' then superseded_by_entity_id::text
    when 'chapter_key' then (
      select chapter.chapter_key
      from workspace.context_chapters as chapter
      where chapter.id = professional_context_entities.chapter_id
        and chapter.workspace_id = professional_context_entities.workspace_id
    )
  end
  from workspace.professional_context_entities where id = target_id;
$$;

create function pg_temp.context_entity_evidence_count(target_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from workspace.context_evidence where entity_id = target_id;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'context.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'context.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('a1111111-1111-4111-8111-111111111111', 'Context Alice'),
  ('a2222222-2222-4222-8222-222222222222', 'Context Bob');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Context Alice Workspace', 'a1111111-1111-4111-8111-111111111111'),
  ('a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Context Bob Workspace', 'a2222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a2222222-2222-4222-8222-222222222222', 'owner', 'active');
insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111', 'personal'),
  ('a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a2222222-2222-4222-8222-222222222222', 'personal');
insert into workspace.bundle_entitlements (
  workspace_id, bundle_key, beneficiary_user_id, source, source_reference
) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'a1111111-1111-4111-8111-111111111111', 'subscription', 'context-alice-test-entitlement'),
  ('a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sotf_transition', 'a2222222-2222-4222-8222-222222222222', 'subscription', 'context-bob-test-entitlement');
insert into workspace.memory_entries (id, workspace_id, memory_type, content, domain, created_by) values
  ('a1100000-0000-4000-8000-000000000001', 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'preference', 'Alice legacy confirmed memory', 'job_search', 'a1111111-1111-4111-8111-111111111111'),
  ('a2200000-0000-4000-8000-000000000001', 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'preference', 'Bob legacy confirmed memory', 'job_search', 'a2222222-2222-4222-8222-222222222222');
insert into workspace.job_applications (id, workspace_id, company, role, created_by) values
  ('a1300000-0000-4000-8000-000000000001', 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice Target', 'Operations Lead', 'a1111111-1111-4111-8111-111111111111'),
  ('a2300000-0000-4000-8000-000000000001', 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob Target', 'Program Lead', 'a2222222-2222-4222-8222-222222222222');
insert into workspace.mcp_authorizations (workspace_id, client_id, assistant_provider, status, connected_at, created_by) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ac111111-1111-4111-8111-111111111111', 'chatgpt', 'connected', now(), 'a1111111-1111-4111-8111-111111111111'),
  ('a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ac222222-2222-4222-8222-222222222222', 'claude', 'connected', now(), 'a2222222-2222-4222-8222-222222222222');
update workspace_private.product_settings set setting_value = 'true', updated_at = now()
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants (user_id, client_id, resource_uri, granted_scopes) values
  ('a1111111-1111-4111-8111-111111111111', 'ac111111-1111-4111-8111-111111111111', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']),
  ('a2222222-2222-4222-8222-222222222222', 'ac222222-2222-4222-8222-222222222222', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']);

select set_config('request.test_mcp_resource_uri', (
  select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'
), true);

select is((select count(*)::integer from workspace.capability_catalog where capability_key = 'professional_context'), 1, 'Professional Context Graph is a normal capability');
select is((select enabled from workspace.bundle_capabilities where bundle_key = 'sotf_transition' and capability_key = 'professional_context'), false, 'P1 entitlement does not activate the P2 graph capability');
select is((select relrowsecurity from pg_class where oid = 'workspace.context_chapters'::regclass), true, 'context chapters use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.professional_context_entities'::regclass), true, 'context entities use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.professional_context_links'::regclass), true, 'context links use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.context_evidence'::regclass), true, 'context evidence uses RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.context_candidates'::regclass), true, 'context candidates use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace.context_reviews'::regclass), true, 'context reviews use RLS');
select is(has_table_privilege('authenticated', 'workspace.professional_context_entities', 'insert'), false, 'ordinary clients cannot bypass confirmation by inserting context');
select is(has_table_privilege('authenticated', 'workspace.context_candidates', 'update'), false, 'ordinary clients cannot self-confirm a candidate');
select is(has_table_privilege('authenticated', 'workspace.context_evidence', 'insert'), false, 'ordinary clients cannot forge evidence');
select is(has_function_privilege('anon', 'workspace.mcp_get_context_provenance_protected(uuid,boolean,boolean)', 'execute'), false, 'anonymous callers cannot inspect context provenance');
select is(has_function_privilege('authenticated', 'workspace.mcp_get_context_provenance(uuid)', 'execute'), false, 'the unprotected provenance signature is not callable');

-- Preserve the Phase A domain-semantic suite after B2 revokes every API-role
-- mutation signature. These transaction-local grants exercise the underlying
-- implementation only; the B2 suite separately proves production lockdown.
grant execute on function workspace.mcp_propose_context_candidate_protected(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text, boolean
) to authenticated;
grant execute on function workspace.mcp_review_context_candidate_protected(
  uuid, text, uuid, text, text, text, text, text, boolean
) to authenticated;
grant execute on function workspace.mcp_get_context_provenance_protected(uuid, boolean, boolean) to authenticated;
grant execute on function workspace.mcp_link_professional_context_protected(
  uuid, text, uuid, uuid, text, uuid, boolean
) to authenticated;
grant execute on function workspace.mcp_manage_professional_context_protected(
  uuid, text, uuid, text, text, text, boolean
) to authenticated;
grant execute on function workspace.mcp_list_professional_context(text, text[], boolean, boolean, integer) to authenticated;
grant execute on function workspace.mcp_list_context_candidates(text, boolean, boolean, integer) to authenticated;

-- Test-only activation exercises P2 after proving that P1 entitlement alone is insufficient.
update workspace.bundle_capabilities set enabled = true
where bundle_key = 'sotf_transition' and capability_key = 'professional_context';

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'sub', 'a1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.test_mcp_resource_uri'),
  'client_id', 'ac111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);

select is((select count(*) from workspace.professional_context_entities), 0::bigint, 'MCP bearer cannot traverse context tables directly');
select set_config('request.identity_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000001',
  target_family => 'professional_identity', proposed_label => 'Operational leader',
  proposed_summary => 'Translates complex operations into clear team execution.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition',
  target_source_type => 'user_supplied', target_source_reference => 'pilot-intake:identity',
  target_observed_at => '2026-09-01T15:00:00Z', target_confidence => 1,
  evidence_excerpt => 'I lead through clarity and disciplined execution.'
) #>> '{candidate,id}', true);
select is(pg_temp.context_test_count('candidate', 'professional_identity'), 1, 'initial identity enters as one candidate');
select is(pg_temp.context_test_count('entity'), 0, 'ingestion does not create durable context');
select is(workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000001',
  target_family => 'professional_identity', proposed_label => 'Operational leader',
  proposed_summary => 'Translates complex operations into clear team execution.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition',
  target_source_type => 'user_supplied', target_source_reference => 'pilot-intake:identity',
  target_observed_at => '2026-09-01T15:00:00Z', target_confidence => 1,
  evidence_excerpt => 'I lead through clarity and disciplined execution.'
) ->> 'idempotent_replay', 'true', 'repeating the same observation is idempotent');
select set_config('request.identity_entity_id', workspace.mcp_review_context_candidate_protected(
  current_setting('request.identity_candidate_id')::uuid, 'approve',
  'a1920000-0000-4000-8000-000000000001', null, null, null,
  null, 'User confirmed during intake.'
) #>> '{context,id}', true);
select is(pg_temp.context_entity_value(current_setting('request.identity_entity_id')::uuid, 'tier'), 'chapter', 'confirmed identity uses the reviewed Chapter tier');
select is(pg_temp.context_entity_value(
  current_setting('request.identity_entity_id')::uuid, 'chapter_key'
), 'sotf_transition', 'exact approval preserves the candidate Chapter binding');
select is(pg_temp.context_entity_evidence_count(current_setting('request.identity_entity_id')::uuid), 1, 'promotion retains bounded provenance');

select set_config('request.goal_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000002', target_family => 'goal',
  proposed_label => 'Post-transition direction', proposed_summary => 'Lead operations in a mission-driven organization.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_source_type => 'user_supplied',
  target_source_reference => 'pilot-intake:goal', target_observed_at => '2026-09-01T15:05:00Z', target_confidence => 0.95
) #>> '{candidate,id}', true);
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, %L)',
  current_setting('request.goal_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000012', 'core'
), '22023', 'Approval must accept the candidate exactly.', 'approval rejects tier mutation fields');
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, %L)',
  current_setting('request.goal_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000013', 'Changed label'
), '22023', 'Approval must accept the candidate exactly.', 'approval rejects corrected content fields');
select lives_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, null, null, %L)',
  current_setting('request.goal_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000002',
  'Goal confirmed.'
), 'initial career goal can be confirmed through bounded review');
select set_config('request.direction_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000003', target_family => 'career_direction',
  proposed_label => 'Operations leadership', proposed_summary => 'Focus on operational leadership roles with public impact.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_source_type => 'user_supplied',
  target_source_reference => 'pilot-intake:direction', target_observed_at => '2026-09-01T15:06:00Z', target_confidence => 0.9
) #>> '{candidate,id}', true);
select lives_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, null, null, %L)',
  current_setting('request.direction_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000003',
  'Direction confirmed.'
), 'career direction can be confirmed');
select set_config('request.criterion_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000004', target_family => 'decision_criterion',
  proposed_label => 'Mission alignment', proposed_summary => 'The role must have measurable public-service impact.',
  proposed_tier => 'core', target_source_type => 'user_supplied', target_source_reference => 'pilot-intake:criteria',
  target_observed_at => '2026-09-01T15:07:00Z', target_confidence => 1
) #>> '{candidate,id}', true);
select lives_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, null, null, %L)',
  current_setting('request.criterion_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000004',
  'Criterion confirmed.'
), 'decision criterion can be confirmed as user-governed Core context');
select is(pg_temp.context_test_count('active_entity'), 4, 'initial context confirms four distinct canonical entities');

select set_config('request.learning_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000005', target_family => 'lesson',
  proposed_label => 'Translate scale explicitly', proposed_summary => 'State team size and operational scale in interview examples.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_source_type => 'workflow',
  target_source_reference => 'interview-lab:session-1', target_observed_at => '2026-09-01T16:00:00Z',
  target_confidence => 0.8, evidence_excerpt => 'Coach requested clearer scale evidence.'
) #>> '{candidate,id}', true);
select is(pg_temp.context_candidate_value(current_setting('request.learning_candidate_id')::uuid, 'status'), 'pending', 'workflow learning remains a candidate instead of durable truth');
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, %L)',
  current_setting('request.learning_candidate_id'), 'correct', 'a1920000-0000-4000-8000-000000000014',
  'State team size and operational scale in interview examples.'
), '22023', 'A correction must make an actual normalized content change.', 'correction rejects a normalized no-op');
select set_config('request.learning_entity_id', workspace.mcp_review_context_candidate_protected(
  current_setting('request.learning_candidate_id')::uuid, 'correct',
  'a1920000-0000-4000-8000-000000000005', null, null,
  'Quantify team size, operating tempo, and outcomes in interview examples.',
  null, 'User amended the coaching lesson.'
) #>> '{context,id}', true);
select is(pg_temp.context_candidate_value(current_setting('request.learning_candidate_id')::uuid, 'status'), 'corrected', 'user correction is preserved in candidate history');
select is(pg_temp.context_entity_value(current_setting('request.learning_entity_id')::uuid, 'summary'), 'Quantify team size, operating tempo, and outcomes in interview examples.', 'corrected learning becomes confirmed Chapter context');

select set_config('request.preference_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000006', target_family => 'work_preference',
  proposed_label => 'Work location', proposed_summary => 'Remote work is required.',
  proposed_tier => 'core', target_source_type => 'user_supplied', target_source_reference => 'preferences:initial',
  target_observed_at => '2026-09-01T17:00:00Z', target_confidence => 1
) #>> '{candidate,id}', true);
select set_config('request.preference_entity_id', workspace.mcp_review_context_candidate_protected(
  current_setting('request.preference_candidate_id')::uuid, 'approve',
  'a1920000-0000-4000-8000-000000000006', null, null, null, null, 'Initial preference confirmed.'
) #>> '{context,id}', true);
select set_config('request.conflict_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000007', target_family => 'work_preference',
  proposed_label => 'Work location', proposed_summary => 'Hybrid work is acceptable.',
  proposed_tier => 'core', target_source_type => 'user_supplied', target_source_reference => 'preferences:later',
  target_observed_at => '2026-09-02T12:00:00Z', target_confidence => 1,
  target_evidence_role => 'contradicting', target_conflict_with_entity_id => current_setting('request.preference_entity_id')::uuid
) #>> '{candidate,id}', true);
select is(pg_temp.context_candidate_value(current_setting('request.conflict_candidate_id')::uuid, 'status'), 'conflict', 'contradictory evidence enters an explicit conflict state');
select is(pg_temp.context_entity_value(current_setting('request.preference_entity_id')::uuid, 'status'), 'active', 'conflict does not silently overwrite confirmed truth');
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid)',
  current_setting('request.conflict_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000007'
), '22023', 'Conflicting context must be explicitly superseded or rejected.', 'generic approval cannot bypass conflict resolution');
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, %L)',
  current_setting('request.conflict_candidate_id'), 'supersede', 'a1920000-0000-4000-8000-000000000015',
  'Edited during supersession.'
), '22023', 'Supersede must not include candidate mutations.', 'supersession rejects silent edits');
select set_config('request.replacement_preference_id', workspace.mcp_review_context_candidate_protected(
  current_setting('request.conflict_candidate_id')::uuid, 'supersede',
  'a1920000-0000-4000-8000-000000000008', null, null, null, null,
  'User explicitly changed the location criterion.'
) #>> '{context,id}', true);
select is(pg_temp.context_entity_value(current_setting('request.preference_entity_id')::uuid, 'status'), 'superseded', 'resolved old context remains auditable as superseded');
select is(pg_temp.context_entity_value(current_setting('request.preference_entity_id')::uuid, 'superseded_by'), current_setting('request.replacement_preference_id'), 'supersession points to the new active truth');
select is(pg_temp.context_entity_value(current_setting('request.replacement_preference_id')::uuid, 'status'), 'active', 'replacement context becomes the active truth');
select is(pg_temp.context_entity_value(current_setting('request.replacement_preference_id')::uuid, 'summary'), 'Hybrid work is acceptable.', 'supersession installs the conflict candidate exactly');
select ok(pg_catalog.jsonb_array_length(workspace.mcp_get_context_provenance_protected(current_setting('request.preference_entity_id')::uuid) -> 'conflicts') = 1, 'provenance exposes normal conflict history');

select is(pg_catalog.jsonb_array_length(workspace.mcp_list_professional_context('all', array['chapter','core'], false, false, 25) -> 'legacy_memory'), 1, 'legacy confirmed memory remains available through a separate compatibility collection');
select ok(workspace.mcp_list_professional_context('all', array['chapter','core'], false, false, 25) -> 'legacy_memory' @> '[{"content":"Alice legacy confirmed memory"}]'::jsonb, 'Lewis retrieves owned legacy memory without backfill');
select is(workspace.mcp_link_professional_context_protected(
  current_setting('request.identity_entity_id')::uuid, 'related_to',
  'a1930000-0000-4000-8000-000000000001', null, 'memory_entry',
  'a1100000-0000-4000-8000-000000000001'
) ->> 'idempotent_replay', 'false', 'new graph context links to legacy memory instead of copying it');
select is(workspace.mcp_link_professional_context_protected(
  current_setting('request.identity_entity_id')::uuid, 'related_to',
  'a1930000-0000-4000-8000-000000000002', null, 'memory_entry',
  'a1100000-0000-4000-8000-000000000001'
) ->> 'idempotent_replay', 'true', 'repeated operational links dedupe safely');
select is(pg_temp.context_test_count('memory_link'), 1, 'legacy link creates no duplicate graph or memory record');
select throws_ok(format(
  'select workspace.mcp_link_professional_context_protected(%L::uuid, %L, %L::uuid, null, %L, %L::uuid)',
  current_setting('request.identity_entity_id'), 'related_to', 'a1930000-0000-4000-8000-000000000003',
  'job_application', 'a2300000-0000-4000-8000-000000000001'
), '42501', 'Target operational record does not belong to this Workspace.', 'operational links cannot cross Workspace boundaries');

select set_config('request.reject_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000012', target_family => 'assumption',
  proposed_label => 'Rejected assumption', proposed_summary => 'This should not become durable context.',
  target_source_type => 'inferred', target_observed_at => '2026-09-02T12:30:00Z', target_confidence => 0.4
) #>> '{candidate,id}', true);
select set_config('request.entity_count_before_reject', pg_temp.context_test_count('entity')::text, true);
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, %L)',
  current_setting('request.reject_candidate_id'), 'reject', 'a1920000-0000-4000-8000-000000000016',
  'Changed while rejecting.'
), '22023', 'Reject must not include candidate mutations.', 'rejection rejects corrected content fields');
select is(workspace.mcp_review_context_candidate_protected(
  current_setting('request.reject_candidate_id')::uuid, 'reject',
  'a1920000-0000-4000-8000-000000000017'
) -> 'context', 'null'::jsonb, 'rejection returns no durable context');
select is(pg_temp.context_test_count('entity'), current_setting('request.entity_count_before_reject')::integer, 'rejection creates no durable entity');

select throws_ok(
  $sql$select workspace.mcp_propose_context_candidate_protected(
    request_id => 'a1910000-0000-4000-8000-000000000008', target_family => 'relationship',
    proposed_label => 'Private sponsor context', proposed_summary => 'Discuss only when explicitly invoked.',
    proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_privacy_level => 'private',
    target_source_type => 'user_supplied', target_observed_at => '2026-09-02T13:00:00Z', target_confidence => 1
  )$sql$,
  '42501', 'Protected context requires explicit access confirmation.',
  'private proposal requires explicit protected access'
);
select set_config('request.private_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000008', target_family => 'relationship',
  proposed_label => 'Private sponsor context', proposed_summary => 'Discuss only when explicitly invoked.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_privacy_level => 'private',
  target_source_type => 'user_supplied', target_observed_at => '2026-09-02T13:00:00Z', target_confidence => 1,
  explicit_protected_access => true
) #>> '{candidate,id}', true);
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid)',
  current_setting('request.private_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000018'
), '22023', 'Context candidate not found for this Workspace.', 'private candidate review requires explicit protected access');
select set_config('request.private_entity_id', workspace.mcp_review_context_candidate_protected(
  current_setting('request.private_candidate_id')::uuid, 'approve',
  'a1920000-0000-4000-8000-000000000009', null, null, null, null, null, true
) #>> '{context,id}', true);
select lives_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, null, null, null, true)',
  current_setting('request.private_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000009'
), 'private review retry is idempotent with explicit protected access');
select ok(not (workspace.mcp_list_professional_context('all', array['chapter','core'], false, false, 25) -> 'context' @> '[{"label":"Private sponsor context"}]'::jsonb), 'private context is excluded from default projections');
select ok(workspace.mcp_list_professional_context('all', array['chapter','core'], true, true, 25) -> 'context' @> '[{"label":"Private sponsor context"}]'::jsonb, 'private context is available only through explicit authorized retrieval');
select throws_ok(
  $sql$select workspace.mcp_list_professional_context('all', array['chapter','core'], true, false, 25)$sql$,
  '42501', 'Protected context requires explicit access confirmation.',
  'private retrieval fails closed without explicit confirmation'
);
select throws_ok(format(
  'select workspace.mcp_get_context_provenance_protected(%L::uuid)',
  current_setting('request.private_entity_id')
), '22023', 'Professional context not found for this Workspace.', 'private provenance requires explicit protected access');
select ok(workspace.mcp_get_context_provenance_protected(
  current_setting('request.private_entity_id')::uuid, true, true
) -> 'context' @> '{"label":"Private sponsor context"}'::jsonb, 'explicit protected access returns private provenance intentionally');
select throws_ok(format(
  'select workspace.mcp_link_professional_context_protected(%L::uuid, %L, %L::uuid, %L::uuid)',
  current_setting('request.identity_entity_id'), 'related_to', 'a1930000-0000-4000-8000-000000000004',
  current_setting('request.private_entity_id')
), '22023', 'Target context not found for this Workspace.', 'linking cannot bypass protected target access');
select throws_ok(format(
  'select workspace.mcp_manage_professional_context_protected(%L::uuid, %L, %L::uuid)',
  current_setting('request.private_entity_id'), 'archive', 'a1940000-0000-4000-8000-000000000001'
), '22023', 'Professional context not found for this Workspace.', 'management cannot bypass protected target access');
select lives_ok(format(
  'select workspace.mcp_link_professional_context_protected(%L::uuid, %L, %L::uuid, %L::uuid, null, null, true)',
  current_setting('request.identity_entity_id'), 'related_to', 'a1930000-0000-4000-8000-000000000005',
  current_setting('request.private_entity_id')
), 'explicit protected access permits an intentional private context link');

select set_config('request.normal_candidate_protected_target_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000020', target_family => 'feedback',
  proposed_label => 'Protected-target feedback', proposed_summary => 'Normal candidate related to protected context.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_privacy_level => 'normal',
  target_source_type => 'user_supplied', target_observed_at => '2026-09-02T13:04:00Z', target_confidence => 1,
  target_evidence_role => 'contradicting',
  target_conflict_with_entity_id => current_setting('request.private_entity_id')::uuid,
  explicit_protected_access => true
) #>> '{candidate,id}', true);
select ok(not (workspace.mcp_list_context_candidates(null, false, false, 25) -> 'candidates' @> '[{"proposed_label":"Protected-target feedback"}]'::jsonb), 'ordinary candidate retrieval omits a normal candidate that references protected context');
select ok(workspace.mcp_list_context_candidates(null, true, true, 25) -> 'candidates' @> '[{"proposed_label":"Protected-target feedback"}]'::jsonb, 'explicit protected retrieval intentionally returns a candidate with a protected target');
select throws_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid)',
  current_setting('request.normal_candidate_protected_target_id'), 'reject', 'a1920000-0000-4000-8000-000000000020'
), '22023', 'Context candidate not found for this Workspace.', 'candidate review cannot bypass a protected related-context target');
select is(workspace.mcp_review_context_candidate_protected(
  current_setting('request.normal_candidate_protected_target_id')::uuid, 'reject',
  'a1920000-0000-4000-8000-000000000020', null, null, null, null, null, true
) ->> 'decision', 'reject', 'explicit protected access permits intentional rejection of the protected-target candidate');

select set_config('request.protected_conflict_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000013', target_family => 'professional_identity',
  proposed_label => 'Protected identity conflict', proposed_summary => 'Protected conflict summary must remain omitted.',
  proposed_tier => 'chapter', target_chapter_key => 'sotf_transition', target_privacy_level => 'private',
  target_source_type => 'user_supplied', target_source_reference => 'protected-conflict-source',
  target_observed_at => '2026-09-02T13:05:00Z', target_confidence => 1,
  evidence_excerpt => 'Protected conflict excerpt.', target_evidence_role => 'contradicting',
  target_conflict_with_entity_id => current_setting('request.identity_entity_id')::uuid,
  explicit_protected_access => true
) #>> '{candidate,id}', true);
select is(pg_catalog.jsonb_array_length(
  workspace.mcp_get_context_provenance_protected(current_setting('request.identity_entity_id')::uuid) -> 'conflicts'
), 0, 'accessible provenance completely omits protected conflicts');
select ok(workspace.mcp_get_context_provenance_protected(
  current_setting('request.identity_entity_id')::uuid, true, true
) -> 'conflicts' @> '[{"label":"Protected identity conflict"}]'::jsonb, 'explicit protected provenance returns the protected conflict intentionally');

select set_config('request.candidate_count_before_no_retain', pg_temp.context_test_count('candidate')::text, true);
select set_config('request.entity_count_before_no_retain', pg_temp.context_test_count('entity')::text, true);
select set_config('request.evidence_count_before_no_retain', pg_temp.context_test_count('evidence')::text, true);
select set_config('request.link_count_before_no_retain', pg_temp.context_test_count('link')::text, true);
select set_config('request.review_count_before_no_retain', pg_temp.context_test_count('review')::text, true);
select set_config('request.chapter_count_before_no_retain', pg_temp.context_test_count('chapter')::text, true);
select is(workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000009', target_family => 'feedback',
  proposed_label => 'Transient feedback', proposed_summary => 'Use only for this immediate response.',
  target_source_type => 'user_supplied', target_observed_at => '2026-09-02T13:10:00Z',
  target_confidence => 1, target_retention => 'do_not_retain'
) ->> 'retained', 'false', 'do-not-retain content is accepted only transiently');
select is(pg_temp.context_test_count('candidate'), current_setting('request.candidate_count_before_no_retain')::integer, 'do-not-retain creates no candidate');
select is(pg_temp.context_test_count('entity'), current_setting('request.entity_count_before_no_retain')::integer, 'do-not-retain creates no confirmed context');
select is(pg_temp.context_test_count('evidence'), current_setting('request.evidence_count_before_no_retain')::integer, 'do-not-retain creates no evidence');
select is(pg_temp.context_test_count('link'), current_setting('request.link_count_before_no_retain')::integer, 'do-not-retain creates no graph link');
select is(pg_temp.context_test_count('review'), current_setting('request.review_count_before_no_retain')::integer, 'do-not-retain creates no review');
select is(pg_temp.context_test_count('chapter'), current_setting('request.chapter_count_before_no_retain')::integer, 'do-not-retain creates no chapter');
select is(workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000010', target_family => 'responsibility',
  proposed_label => 'Operational detail', proposed_summary => 'Potentially controlled military detail.',
  target_source_type => 'user_supplied', target_observed_at => '2026-09-02T13:11:00Z',
  target_confidence => 1, target_military_sensitivity => 'suspected_cui'
) ->> 'reason', 'military_sensitive_content_not_accepted', 'suspected CUI is refused as graph storage');
select is(pg_temp.context_test_count('candidate'), current_setting('request.candidate_count_before_no_retain')::integer, 'military-sensitive refusal persists no candidate or source body');
select is(pg_temp.context_test_count('entity'), current_setting('request.entity_count_before_no_retain')::integer, 'military-sensitive refusal creates no confirmed context');
select is(pg_temp.context_test_count('evidence'), current_setting('request.evidence_count_before_no_retain')::integer, 'military-sensitive refusal creates no evidence');
select is(pg_temp.context_test_count('link'), current_setting('request.link_count_before_no_retain')::integer, 'military-sensitive refusal creates no graph link');
select is(pg_temp.context_test_count('review'), current_setting('request.review_count_before_no_retain')::integer, 'military-sensitive refusal creates no review');

select set_config('request.sensitive_candidate_id', workspace.mcp_propose_context_candidate_protected(
  request_id => 'a1910000-0000-4000-8000-000000000011', target_family => 'feedback',
  proposed_label => 'Sensitive feedback', proposed_summary => 'Retain only after explicit review.',
  proposed_tier => 'core', target_privacy_level => 'sensitive', target_source_type => 'user_supplied',
  target_observed_at => '2026-09-02T13:20:00Z', target_confidence => 1,
  explicit_protected_access => true
) #>> '{candidate,id}', true);
select is(pg_temp.context_test_count('entity', 'feedback'), 0, 'sensitive input cannot auto-promote');
select ok(not (workspace.mcp_list_context_candidates(null, false, false, 25) -> 'candidates' @> '[{"proposed_label":"Sensitive feedback"}]'::jsonb), 'sensitive candidates are excluded from default projections');
select ok(workspace.mcp_list_context_candidates(null, true, true, 25) -> 'candidates' @> '[{"proposed_label":"Sensitive feedback"}]'::jsonb, 'explicit protected access returns sensitive candidates intentionally');
select lives_ok(format(
  'select workspace.mcp_review_context_candidate_protected(%L::uuid, %L, %L::uuid, null, null, null, null, null, true)',
  current_setting('request.sensitive_candidate_id'), 'approve', 'a1920000-0000-4000-8000-000000000010'
), 'explicit user review may confirm sensitive context');
select ok(not (workspace.mcp_list_professional_context('all', array['core'], false, false, 25) -> 'context' @> '[{"label":"Sensitive feedback"}]'::jsonb), 'sensitive confirmed context is excluded from default retrieval');
select ok(workspace.mcp_list_professional_context('all', array['core'], true, true, 25) -> 'context' @> '[{"label":"Sensitive feedback"}]'::jsonb, 'explicit protected access returns sensitive confirmed context intentionally');

reset role;

insert into workspace.context_evidence (
  workspace_id, entity_id, evidence_role, source_type, source_reference,
  observed_at, excerpt, confidence, privacy_level, evidence_fingerprint, created_by
) values (
  'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_setting('request.identity_entity_id')::uuid,
  'supporting', 'user_supplied', 'protected-nested-source-reference', '2026-09-02T13:06:00Z',
  'Protected nested evidence excerpt.', 1, 'private',
  workspace_private.context_fingerprint('protected-nested-evidence'),
  'a1111111-1111-4111-8111-111111111111'
);
insert into workspace.context_reviews (
  workspace_id, entity_id, decision, previous_tier, next_tier,
  previous_status, next_status, review_notes, privacy_level,
  request_fingerprint, request_id, reviewed_by
) values (
  'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_setting('request.identity_entity_id')::uuid,
  'promote', 'chapter', 'chapter', 'active', 'active',
  'Protected nested review note.', 'private',
  workspace_private.context_fingerprint('protected-nested-review'),
  'a1920000-0000-4000-8000-000000000019', 'a1111111-1111-4111-8111-111111111111'
);

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'sub', 'a1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.test_mcp_resource_uri'),
  'client_id', 'ac111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(
  position('Protected nested' in workspace.mcp_get_context_provenance_protected(
    current_setting('request.identity_entity_id')::uuid
  )::text) = 0,
  'accessible provenance omits protected evidence, source metadata, and review notes'
);
select ok(
  position('Protected nested evidence excerpt.' in workspace.mcp_get_context_provenance_protected(
    current_setting('request.identity_entity_id')::uuid, true, true
  )::text) > 0,
  'explicit protected provenance returns protected evidence intentionally'
);
select ok(
  position('Protected nested review note.' in workspace.mcp_get_context_provenance_protected(
    current_setting('request.identity_entity_id')::uuid, true, true
  )::text) > 0,
  'explicit protected provenance returns protected review notes intentionally'
);
reset role;

insert into workspace.professional_context_entities (
  id, workspace_id, entity_family, label, summary, tier, privacy_level,
  lifecycle_status, confidence, dedupe_key, confirmed_by, created_by
) values (
  'a2400000-0000-4000-8000-000000000001', 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'goal', 'Bob goal', 'Bob private confirmed goal.', 'core', 'normal', 'active', 1,
  workspace_private.context_fingerprint('goal', 'bob goal', 'bob private confirmed goal.'),
  'a2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222'
);
insert into workspace.context_candidates (
  id, workspace_id, entity_family, proposed_label, proposed_summary, proposed_tier,
  privacy_level, source_type, observed_at, confidence, status, dedupe_key,
  evidence_fingerprint, request_fingerprint, request_id, created_by
) values (
  'a2500000-0000-4000-8000-000000000001', 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'goal', 'Bob candidate', 'Bob private candidate.', 'core', 'normal', 'user_supplied', now(), 1,
  'pending', workspace_private.context_fingerprint('bob-candidate'),
  workspace_private.context_fingerprint('bob-evidence'), workspace_private.context_fingerprint('bob-request'),
  'a2510000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222'
);
insert into workspace.context_evidence (
  workspace_id, candidate_id, evidence_role, source_type, observed_at, confidence,
  privacy_level, evidence_fingerprint, created_by
) values (
  'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a2500000-0000-4000-8000-000000000001',
  'supporting', 'user_supplied', now(), 1, 'normal', workspace_private.context_fingerprint('bob-evidence'),
  'a2222222-2222-4222-8222-222222222222'
);
insert into workspace.context_reviews (
  workspace_id, candidate_id, decision, previous_status, next_status,
  request_fingerprint, request_id, reviewed_by
) values (
  'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a2500000-0000-4000-8000-000000000001',
  'reject', 'pending', 'rejected', workspace_private.context_fingerprint('bob-review'),
  'a2520000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is((select count(*)::integer from workspace.professional_context_entities where workspace_id = 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Workspace A cannot read Workspace B context entities');
select is((select count(*)::integer from workspace.context_candidates where workspace_id = 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Workspace A cannot read Workspace B candidates');
select is((select count(*)::integer from workspace.context_evidence where workspace_id = 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Workspace A cannot read Workspace B evidence');
select is((select count(*)::integer from workspace.context_reviews where workspace_id = 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Workspace A cannot read Workspace B reviews');
select is((select count(*)::integer from workspace.memory_entries where workspace_id = 'a2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'legacy memory ownership remains tenant isolated');
reset role;

select * from finish();
rollback;
