begin;

select no_plan();

create function pg_temp.pc_count(target_kind text, target_label text default null)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return case target_kind
    when 'candidate' then (select count(*)::integer from workspace.context_candidates
      where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and (target_label is null or proposed_label = target_label))
    when 'entity' then (select count(*)::integer from workspace.professional_context_entities
      where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        and (target_label is null or label = target_label))
    when 'confirmation' then (select count(*)::integer from workspace_private.professional_context_confirmation_requests
      where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    else -1
  end;
end;
$$;

create function pg_temp.pc_confirmation_value(target_id uuid, target_field text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case target_field
    when 'status' then status
    when 'payload' then normalized_payload::text
    when 'snapshot' then target_state_snapshot::text
    when 'result' then result_reference::text
    when 'action' then action_type
    when 'edited' then user_edited_fields::text
    when 'reason' then terminal_reason_code
    when 'cleared_at' then payload_cleared_at::text
    when 'snapshot_bytes' then pg_column_size(target_state_snapshot)::text
  end
  from workspace_private.professional_context_confirmation_requests where id = target_id;
$$;

create function pg_temp.pc_candidate_value(target_label text, target_field text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case target_field
    when 'id' then id::text
    when 'status' then status
    when 'context_id' then confirmed_entity_id::text
  end
  from workspace.context_candidates
  where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and proposed_label = target_label
  order by created_at desc limit 1;
$$;

create function pg_temp.pc_entity_value(target_id uuid, target_field text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case target_field
    when 'label' then label
    when 'summary' then summary
    when 'tier' then tier
    when 'status' then lifecycle_status
    when 'superseded_by' then superseded_by_entity_id::text
  end
  from workspace.professional_context_entities
  where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and id = target_id;
$$;

create function pg_temp.pc_link_count(target_source_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from workspace.professional_context_links
  where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and source_entity_id = target_source_id;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'b1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'phaseb.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b1222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'phaseb.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('b1111111-1111-4111-8111-111111111111', 'Phase B Alice'),
  ('b1222222-2222-4222-8222-222222222222', 'Phase B Bob');
insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Phase B Alice Workspace', 'b1111111-1111-4111-8111-111111111111'),
  ('b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Phase B Bob Workspace', 'b1222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships (workspace_id, user_id, role, status) values
  ('b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1222222-2222-4222-8222-222222222222', 'owner', 'active');
insert into workspace.personal_plans (workspace_id, user_id, plan_key) values
  ('b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b1111111-1111-4111-8111-111111111111', 'personal'),
  ('b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1222222-2222-4222-8222-222222222222', 'personal');
insert into workspace.bundle_entitlements (
  workspace_id, bundle_key, beneficiary_user_id, source, source_reference
) values
  ('b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sotf_transition', 'b1111111-1111-4111-8111-111111111111', 'subscription', 'phase-b-alice'),
  ('b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sotf_transition', 'b1222222-2222-4222-8222-222222222222', 'subscription', 'phase-b-bob');
insert into workspace.mcp_authorizations (
  id, workspace_id, client_id, assistant_provider, status, connected_at,
  authorization_valid_after, created_by
) values
  ('b1cc1111-1111-4111-8111-111111111111', 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bc111111-1111-4111-8111-111111111111', 'chatgpt', 'connected', now(), now() - interval '1 minute', 'b1111111-1111-4111-8111-111111111111'),
  ('b1cc2222-2222-4222-8222-222222222222', 'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bc222222-2222-4222-8222-222222222222', 'claude', 'connected', now(), now() - interval '1 minute', 'b1222222-2222-4222-8222-222222222222');
update workspace_private.product_settings set setting_value = 'true', updated_at = now()
where setting_key = 'mcp_dynamic_admission_enabled';
insert into workspace_private.mcp_oauth_resource_grants (user_id, client_id, resource_uri, granted_scopes) values
  ('b1111111-1111-4111-8111-111111111111', 'bc111111-1111-4111-8111-111111111111', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']),
  ('b1222222-2222-4222-8222-222222222222', 'bc222222-2222-4222-8222-222222222222', 'https://workspace.leademergence.com/api/mcp', array['openid', 'email', 'profile']);

select set_config('request.pc_resource_uri', (
  select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'
), true);

select is((select enabled from workspace.bundle_capabilities
  where bundle_key = 'sotf_transition' and capability_key = 'professional_context'), false,
  'P1 still does not activate P2');
select is((select relrowsecurity from pg_class where oid = 'workspace_private.professional_context_confirmation_requests'::regclass), true, 'confirmation requests use RLS');
select is((select relrowsecurity from pg_class where oid = 'workspace_private.professional_context_read_grants'::regclass), true, 'protected-read grants use RLS');
select is(has_table_privilege('authenticated', 'workspace_private.professional_context_confirmation_requests', 'select'), false, 'authenticated clients cannot read confirmation storage');
select is(has_table_privilege('authenticated', 'workspace_private.professional_context_read_grants', 'select'), false, 'authenticated clients cannot read grant storage');
select is(has_function_privilege('authenticated', 'workspace.mcp_review_context_candidate_protected(uuid,text,uuid,text,text,text,text,text,boolean)', 'execute'), false, 'Phase A review execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_link_professional_context_protected(uuid,text,uuid,uuid,text,uuid,boolean)', 'execute'), false, 'Phase A link execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_manage_professional_context_protected(uuid,text,uuid,text,text,text,boolean)', 'execute'), false, 'Phase A management execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_get_context_provenance_protected(uuid,boolean,boolean)', 'execute'), false, 'client-attested protected provenance is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_propose_context_candidate(uuid,text,text,text,text,text,text,text,timestamptz,numeric,text,text,text,text,uuid,uuid,uuid,text,text)', 'execute'), false, 'legacy proposal execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_propose_context_candidate_protected(uuid,text,text,text,text,text,text,text,timestamptz,numeric,text,text,text,text,uuid,uuid,uuid,text,text,boolean)', 'execute'), false, 'Phase A protected proposal execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_review_context_candidate(uuid,text,uuid,text,text,text,text,text)', 'execute'), false, 'legacy review execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_link_professional_context(uuid,text,uuid,uuid,text,uuid)', 'execute'), false, 'legacy link execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_manage_professional_context(uuid,text,uuid,text,text,text)', 'execute'), false, 'legacy management execution is revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_list_professional_context(text,text[],boolean,boolean,integer)', 'execute'), false, 'client-attested protected entity reads are revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_list_context_candidates(text,boolean,boolean,integer)', 'execute'), false, 'client-attested protected candidate reads are revoked');
select is(has_function_privilege('authenticated', 'workspace.mcp_get_context_provenance(uuid)', 'execute'), false, 'legacy unprotected provenance is revoked');
select is(has_function_privilege('authenticated', 'workspace_private.invalidate_professional_context_authority()', 'execute'), false, 'authorization invalidation trigger helper is private');
select is((select count(*)::integer from pg_trigger
  where tgname = 'invalidate_professional_context_authority_on_mcp_change' and not tgisinternal),
  1, 'MCP authorization changes have one Professional Context invalidation trigger');
select is((
  select count(*)::integer
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'workspace'
    and procedure.proname like '%context%'
    and (
      has_function_privilege('anon', procedure.oid, 'execute')
      or exists (
        select 1 from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
        where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
      )
    )
), 0, 'no Workspace context function is executable by anon or PUBLIC');
select is((
  select array_agg(signature order by signature)
  from (
    select format('%I.%I(%s)', namespace.nspname, procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)) as signature
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'workspace'
      and procedure.proname like '%context%'
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ) as allowed_surface
), array[
  'workspace.confirm_and_execute_professional_context(target_request_id uuid, final_corrected_label text, final_corrected_summary text)',
  'workspace.create_professional_context_read_grant(target_client_id text, target_privacy_scope text)',
  'workspace.deny_professional_context_confirmation(target_request_id uuid)',
  'workspace.get_professional_context_confirmation(target_request_id uuid)',
  'workspace.list_professional_context_read_grants()',
  'workspace.mcp_get_context_confirmation_status(target_request_id uuid)',
  'workspace.mcp_get_context_provenance_granted(target_entity_id uuid, requested_privacy_scopes text[])',
  'workspace.mcp_list_context_candidates_granted(target_status text, requested_privacy_scopes text[], page_size integer)',
  'workspace.mcp_list_professional_context_granted(target_purpose text, target_tiers text[], requested_privacy_scopes text[], page_size integer)',
  'workspace.mcp_request_context_link(source_context_id uuid, link_type text, request_id uuid, target_context_id uuid, target_record_type text, target_record_id uuid)',
  'workspace.mcp_request_context_management(target_entity_id uuid, target_action text, request_id uuid, target_tier text, target_chapter_key text, review_notes text)',
  'workspace.mcp_request_context_review(target_candidate_id uuid, target_decision text, request_id uuid, corrected_label text, corrected_summary text, review_notes text)',
  'workspace.mcp_submit_context_candidate(request_id uuid, target_family text, proposed_label text, proposed_summary text, proposed_tier text, target_privacy_level text, target_source_type text, target_source_reference text, target_observed_at timestamp with time zone, target_confidence numeric, evidence_excerpt text, target_evidence_role text, target_chapter_key text, target_source_record_type text, target_source_record_id uuid, target_conflict_with_entity_id uuid, target_possible_match_entity_id uuid, target_retention text, target_military_sensitivity text)',
  'workspace.revoke_professional_context_read_grant(target_grant_id uuid)'
]::text[], 'authenticated Professional Context execution surface exactly matches the explicit allowlist');

-- Test-only activation after the separation assertion.
update workspace.bundle_capabilities set enabled = true
where bundle_key = 'sotf_transition' and capability_key = 'professional_context';

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);

select is(workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000001', 'skill', 'Normal autonomous candidate',
  'This is a suggestion, not confirmed truth.', 'working', 'normal', 'inferred', null,
  '2026-09-02T12:00:00Z', 0.7
) ->> 'outcome', 'candidate_created', 'normal retained proposal creates an autonomous candidate');
select is(pg_temp.pc_count('candidate', 'Normal autonomous candidate'), 1, 'normal proposal creates one candidate');
select is(pg_temp.pc_count('entity'), 0, 'normal proposal creates no confirmed context');
select is(workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000001', 'skill', 'Normal autonomous candidate',
  'This is a suggestion, not confirmed truth.', 'working', 'normal', 'inferred', null,
  '2026-09-02T12:00:00Z', 0.7
) ->> 'idempotent_replay', 'true', 'normal proposal retry is idempotent');

select set_config('request.private_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000002', 'relationship', 'Private mentor',
  'Discuss only with an explicit private grant.', 'chapter', 'private', 'user_supplied', null,
  '2026-09-02T12:05:00Z', 1, null, 'supporting', 'sotf_transition'
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_count('candidate', 'Private mentor'), 0, 'private proposal creates no graph candidate before confirmation');
select is(pg_temp.pc_confirmation_value(current_setting('request.private_confirmation_id')::uuid, 'status'), 'pending', 'private proposal creates only pending confirmation state');
select set_config('request.private_retry', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000002', 'relationship', 'Private mentor',
  'Discuss only with an explicit private grant.', 'chapter', 'private', 'user_supplied', null,
  '2026-09-02T12:05:00Z', 1, null, 'supporting', 'sotf_transition'
)::text, true);
select is(current_setting('request.private_retry')::jsonb ->> 'confirmation_request_id',
  current_setting('request.private_confirmation_id'), 'identical protected retry returns the same confirmation request');
select is(current_setting('request.private_retry')::jsonb ->> 'idempotent_replay', 'true', 'protected request retry is marked idempotent');
select throws_ok(
  $$select workspace.mcp_submit_context_candidate(
    'b1900000-0000-4000-8000-000000000002', 'relationship', 'Different private mentor',
    'Discuss only with an explicit private grant.', 'chapter', 'private', 'user_supplied', null,
    '2026-09-02T12:05:00Z', 1, null, 'supporting', 'sotf_transition'
  )$$,
  '22023', 'Reuse a logical request identifier only with the same canonical operation.',
  'same protected logical request cannot represent conflicting content'
);
select throws_ok(
  $$select workspace.mcp_submit_context_candidate(
    request_id => 'b1900000-0000-4000-8000-000000000021',
    target_family => 'skill', proposed_label => 'Invalid protected proposal',
    proposed_summary => 'Malformed chapter keys are rejected before pending storage.',
    proposed_tier => 'chapter', target_privacy_level => 'private',
    target_chapter_key => 'Bad Key'
  )$$,
  '22023', 'Context proposal content or classification is invalid.',
  'invalid protected proposal is rejected before confirmation storage'
);
select throws_ok(format(
  'select workspace.mcp_request_context_review(%L::uuid, %L, %L::uuid, null, null, repeat(%L, 2001))',
  pg_temp.pc_candidate_value('Normal autonomous candidate', 'id'), 'approve',
  'b1900000-0000-4000-8000-000000000022', 'x'
), '22023', 'Context review content is too large.', 'oversized review content is rejected before confirmation storage');
select is(pg_temp.pc_count('confirmation'), 1, 'invalid protected and review requests create no confirmation rows');
select ok(position('Private mentor' in workspace.mcp_get_context_confirmation_status(
  current_setting('request.private_confirmation_id')::uuid
)::text) = 0, 'MCP status omits protected preview content');
select throws_ok(format(
  'select workspace.confirm_and_execute_professional_context(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot confirm');
select throws_ok(format(
  'select workspace.get_professional_context_confirmation(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot load the protected preview');
select throws_ok(format(
  'select workspace.deny_professional_context_confirmation(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot deny a confirmation');
select throws_ok(
  $$select workspace.create_professional_context_read_grant('bc111111-1111-4111-8111-111111111111', 'private')$$,
  '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot create a protected-read grant'
);
select throws_ok(
  $$select workspace.list_professional_context_read_grants()$$,
  '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot enumerate protected-read grants'
);
select throws_ok(
  $$select workspace.revoke_professional_context_read_grant('b1000000-0000-4000-8000-000000000001')$$,
  '42501', 'A direct authenticated Workspace session is required.', 'MCP bearer cannot revoke protected-read grants'
);

select is(workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000003', 'feedback', 'Never stored',
  'Do not retain this.', 'working', 'private', 'user_supplied', null,
  '2026-09-02T12:06:00Z', 1, null, 'supporting', null, null, null, null, null,
  'do_not_retain', 'none'
) ->> 'outcome', 'refused', 'do-not-retain material is refused before confirmation storage');
select is(pg_temp.pc_count('confirmation'), 1, 'refusal creates no confirmation row');
select is(workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000026', 'responsibility', 'Military-sensitive refusal',
  'This must be refused before confirmation persistence.', 'working', 'sensitive', 'user_supplied', null,
  '2026-09-02T12:06:30Z', 1, null, 'supporting', null, null, null, null, null,
  'retain', 'suspected_cui'
) ->> 'outcome', 'refused', 'military-sensitive material is refused through the B2 submission path');
select is(pg_temp.pc_count('confirmation'), 1, 'military-sensitive refusal creates no confirmation row');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(format(
  'select workspace.get_professional_context_confirmation(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '22023', 'Confirmation request not found.', 'another Workspace owner cannot load the protected preview');
select throws_ok(format(
  'select workspace.confirm_and_execute_professional_context(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '22023', 'Confirmation request not found.', 'another Workspace owner cannot execute the request');
select throws_ok(
  $$select workspace.create_professional_context_read_grant('bc111111-1111-4111-8111-111111111111', 'private')$$,
  '42501', 'This assistant connection is not authorized.',
  'another Workspace owner cannot grant access to the first owner connection'
);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1222222-2222-4222-8222-222222222222', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc222222-2222-4222-8222-222222222222',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select throws_ok(format(
  'select workspace.mcp_get_context_confirmation_status(%L::uuid)',
  current_setting('request.private_confirmation_id')
), '22023', 'Confirmation request not found.', 'wrong-client MCP status polling cannot discover a confirmation');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select ok(position('Private mentor' in workspace.get_professional_context_confirmation(
  current_setting('request.private_confirmation_id')::uuid
)::text) > 0, 'direct owner can load the exact protected preview');
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.private_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct confirmation atomically executes the protected proposal');
select is(pg_temp.pc_count('candidate', 'Private mentor'), 1, 'completed protected proposal creates its candidate');
select is(pg_temp.pc_confirmation_value(current_setting('request.private_confirmation_id')::uuid, 'payload'), null, 'completed request clears transient payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.private_confirmation_id')::uuid, 'result'),
  '{"kind": "candidate"}', 'protected proposal completion retains no candidate identifier');
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.private_confirmation_id')::uuid
) ->> 'idempotent_replay', 'true', 'double confirm returns the completed result without another mutation');
select is((workspace.confirm_and_execute_professional_context(
  current_setting('request.private_confirmation_id')::uuid
) -> 'result')::text, pg_temp.pc_confirmation_value(
  current_setting('request.private_confirmation_id')::uuid, 'result'
), 'lost-response retry returns the original bounded completed result');
select is(pg_temp.pc_count('candidate', 'Private mentor'), 1, 'double confirm does not duplicate the candidate');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select throws_ok(format(
  'select workspace.mcp_request_context_review(%L::uuid, %L, %L::uuid)',
  pg_temp.pc_candidate_value('Private mentor', 'id'), 'approve',
  'b1900000-0000-4000-8000-000000000025'
), '22023', 'Context candidate not found for this Workspace.', 'protected candidate request does not acknowledge the target without a read grant');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select set_config('request.replaced_private_grant_id', workspace.create_professional_context_read_grant(
  'bc111111-1111-4111-8111-111111111111', 'private'
) ->> 'grant_id', true);
select set_config('request.private_grant_id', workspace.create_professional_context_read_grant(
  'bc111111-1111-4111-8111-111111111111', 'private'
) ->> 'grant_id', true);
select isnt(current_setting('request.private_grant_id'), current_setting('request.replaced_private_grant_id'),
  'repeated same-scope creation replaces the prior grant deterministically');
select set_config('request.sensitive_grant', workspace.create_professional_context_read_grant(
  'bc111111-1111-4111-8111-111111111111', 'sensitive'
)::text, true);
select ok((current_setting('request.sensitive_grant')::jsonb ->> 'expires_at')::timestamptz
  between now() + interval '4 minutes 58 seconds' and now() + interval '5 minutes 2 seconds',
  'sensitive grant lasts five minutes');
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.privacy_scope == "private" && @.status == "active")'
)), 1, 'authoritative list reports one active private grant after replacement');
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.privacy_scope == "sensitive" && @.status == "active")'
)), 1, 'private creation and replacement do not create or replace the sensitive grant');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(format(
  'select workspace.revoke_professional_context_read_grant(%L::uuid)',
  current_setting('request.private_grant_id')
), '22023', 'Protected-read grant not found.', 'another Workspace owner cannot revoke the first owner grant');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(workspace.mcp_list_context_candidates_granted(null, array['private'], 25)
  -> 'candidates' @> '[{"proposed_label":"Private mentor"}]'::jsonb,
  'private grant returns private candidates');
select ok(not (workspace.mcp_list_context_candidates_granted(null, array['sensitive'], 25)
  -> 'candidates' @> '[{"proposed_label":"Private mentor"}]'::jsonb),
  'sensitive grant does not imply private access');

select set_config('request.review_confirmation_id', workspace.mcp_request_context_review(
  (workspace.mcp_list_context_candidates_granted(null, '{}'::text[], 25) #>> '{candidates,0,id}')::uuid,
  'approve', 'b1900000-0000-4000-8000-000000000004'
) ->> 'confirmation_request_id', true);
select set_config('request.private_review_confirmation_id', workspace.mcp_request_context_review(
  pg_temp.pc_candidate_value('Private mentor', 'id')::uuid,
  'approve', 'b1900000-0000-4000-8000-000000000023'
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_count('entity'), 0, 'MCP review request does not execute approval');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.review_confirmation_id')::uuid
) ->> 'status', 'completed', 'normal review confirmation returns a minimized completion status');
select is(pg_temp.pc_confirmation_value(current_setting('request.review_confirmation_id')::uuid, 'status'), 'completed', 'direct confirmation executes exact candidate approval');
select is(pg_temp.pc_count('entity', 'Normal autonomous candidate'), 1, 'approved candidate becomes confirmed context');
select is(pg_temp.pc_confirmation_value(current_setting('request.review_confirmation_id')::uuid, 'result'),
  '{"kind": "context_review", "decision": "approve"}', 'normal review completion retains only its action-specific allowlist');
select set_config('request.normal_entity_id', pg_temp.pc_candidate_value('Normal autonomous candidate', 'context_id'), true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.private_review_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct confirmation executes the protected candidate approval');
select set_config('request.private_entity_id', pg_temp.pc_candidate_value('Private mentor', 'context_id'), true);
select is(pg_temp.pc_confirmation_value(current_setting('request.private_review_confirmation_id')::uuid, 'result'),
  '{"kind": "context_review", "decision": "approve"}', 'protected review result retains no candidate, context, conflict, or supersession identifiers');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.protected_link_confirmation_id', workspace.mcp_request_context_link(
  current_setting('request.normal_entity_id')::uuid, 'related_to',
  'b1900000-0000-4000-8000-000000000024', current_setting('request.private_entity_id')::uuid
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_link_count(current_setting('request.normal_entity_id')::uuid), 0, 'protected link request remains request-only');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select workspace.confirm_and_execute_professional_context(current_setting('request.protected_link_confirmation_id')::uuid);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select is(jsonb_array_length(workspace.mcp_get_context_provenance_granted(
  current_setting('request.normal_entity_id')::uuid, '{}'::text[]
) -> 'links'), 0, 'accessible parent does not expose a private linked child without its grant scope');
select is(jsonb_array_length(workspace.mcp_get_context_provenance_granted(
  current_setting('request.normal_entity_id')::uuid, array['private']
) -> 'links'), 1, 'private grant permits the independently protected linked child');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.revoke_professional_context_read_grant(
  current_setting('request.private_grant_id')::uuid
) ->> 'status', 'revoked', 'user can immediately revoke a private grant');
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.privacy_scope == "sensitive" && @.status == "active")'
)), 1, 'revoking private access leaves sensitive access active');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(not (workspace.mcp_list_context_candidates_granted(null, array['private'], 25)
  -> 'candidates' @> '[{"proposed_label":"Private mentor"}]'::jsonb),
  'revoked private grant stops protected reads');
select is(workspace.mcp_get_context_confirmation_status(
  current_setting('request.private_review_confirmation_id')::uuid
) -> 'result', '{"kind": "context_review", "decision": "approve"}'::jsonb,
  'protected review status remains useful but identifier-free after private grant revocation');
select ok(position(current_setting('request.private_entity_id') in
  workspace.mcp_get_context_confirmation_status(
    current_setting('request.private_review_confirmation_id')::uuid
  )::text) = 0, 'completed status does not bypass protected reads with a retained relationship identifier');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select set_config('request.expiring_private_grant', workspace.create_professional_context_read_grant(
  'bc111111-1111-4111-8111-111111111111', 'private'
)::text, true);
select ok((current_setting('request.expiring_private_grant')::jsonb ->> 'expires_at')::timestamptz
  between now() + interval '9 minutes 58 seconds' and now() + interval '10 minutes 2 seconds',
  'private grant lasts ten minutes');
reset role;
update workspace_private.professional_context_read_grants
set issued_at = now() - interval '11 minutes', expires_at = now() - interval '1 minute'
where id = (current_setting('request.expiring_private_grant')::jsonb ->> 'grant_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.privacy_scope == "private" && @.status == "active")'
)), 0, 'expired private grants are not presented as active');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(not (workspace.mcp_list_context_candidates_granted(null, array['private'], 25)
  -> 'candidates' @> '[{"proposed_label":"Private mentor"}]'::jsonb),
  'expired private grant stops protected reads');

select set_config('request.sensitive_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000027', 'feedback', 'Sensitive grant boundary',
  'Visible only through an explicit sensitive grant.', 'working', 'sensitive', 'user_supplied', null,
  '2026-09-02T12:09:30Z', 1
) ->> 'confirmation_request_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.sensitive_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct confirmation persists the sensitive candidate');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(not (workspace.mcp_list_context_candidates_granted(null, array['private'], 25)
  -> 'candidates' @> '[{"proposed_label":"Sensitive grant boundary"}]'::jsonb),
  'private grant does not imply sensitive access');
select ok(workspace.mcp_list_context_candidates_granted(null, array['sensitive'], 25)
  -> 'candidates' @> '[{"proposed_label":"Sensitive grant boundary"}]'::jsonb,
  'sensitive grant returns the sensitive candidate');

-- Correction stays request-only and the direct owner may edit only the two
-- correction fields before the exact operation is atomically executed.
select workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000006', 'goal', 'Correction candidate',
  'Assistant-proposed summary.', 'working', 'normal', 'inferred', null,
  '2026-09-02T12:10:00Z', 0.6
);
select set_config('request.correction_candidate_id', pg_temp.pc_candidate_value('Correction candidate', 'id'), true);
select set_config('request.correction_confirmation_id', workspace.mcp_request_context_review(
  current_setting('request.correction_candidate_id')::uuid,
  'correct', 'b1900000-0000-4000-8000-000000000007', null, 'Assistant correction draft.'
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_candidate_value('Correction candidate', 'status'), 'pending', 'MCP correction request does not mutate the candidate');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(format(
  'select workspace.confirm_and_execute_professional_context(%L::uuid, null, repeat(%L, 5001))',
  current_setting('request.correction_confirmation_id'), 'x'
), '22023', 'Corrected context length is invalid.', 'failed direct execution rolls back before mutation and completion');
select is(pg_temp.pc_confirmation_value(current_setting('request.correction_confirmation_id')::uuid, 'status'),
  'pending', 'failed execution leaves the confirmation pending');
select is(pg_temp.pc_candidate_value('Correction candidate', 'status'), 'pending', 'failed execution leaves the candidate unchanged');
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.correction_confirmation_id')::uuid,
  null, 'Owner-confirmed corrected summary.'
) ->> 'status', 'completed', 'direct owner confirmation executes correction');
select set_config('request.corrected_entity_id', pg_temp.pc_candidate_value('Correction candidate', 'context_id'), true);
select is(pg_temp.pc_candidate_value('Correction candidate', 'status'), 'corrected', 'correction preserves corrected candidate semantics');
select is(pg_temp.pc_entity_value(current_setting('request.corrected_entity_id')::uuid, 'summary'),
  'Owner-confirmed corrected summary.', 'direct correction edit is the durable value');
select is(pg_temp.pc_confirmation_value(current_setting('request.correction_confirmation_id')::uuid, 'edited'),
  '{corrected_summary}', 'confirmation metadata records the allowed edited field without retaining content');

-- Rejection also requires direct confirmation and never creates context.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000008', 'assumption', 'Reject candidate',
  'This proposal should not become context.', 'working', 'normal', 'inferred', null,
  '2026-09-02T12:11:00Z', 0.4
);
select set_config('request.reject_candidate_id', pg_temp.pc_candidate_value('Reject candidate', 'id'), true);
select set_config('request.reject_confirmation_id', workspace.mcp_request_context_review(
  current_setting('request.reject_candidate_id')::uuid,
  'reject', 'b1900000-0000-4000-8000-000000000009'
) ->> 'confirmation_request_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.reject_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct owner confirmation executes rejection');
select is(pg_temp.pc_candidate_value('Reject candidate', 'status'), 'rejected', 'rejected candidate stays rejected');
select is(pg_temp.pc_candidate_value('Reject candidate', 'context_id'), null, 'rejection creates no confirmed context');

-- Supersede, link, promote, archive, and delete all traverse the same
-- request-only MCP boundary and direct-session executor.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000010', 'career_direction', 'Original direction',
  'The original confirmed direction.', 'working', 'normal', 'user_supplied', null,
  '2026-09-02T12:12:00Z', 1
);
select set_config('request.original_candidate_id', pg_temp.pc_candidate_value('Original direction', 'id'), true);
select set_config('request.original_approval_id', workspace.mcp_request_context_review(
  current_setting('request.original_candidate_id')::uuid,
  'approve', 'b1900000-0000-4000-8000-000000000011'
) ->> 'confirmation_request_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select workspace.confirm_and_execute_professional_context(current_setting('request.original_approval_id')::uuid);
select set_config('request.original_entity_id', pg_temp.pc_candidate_value('Original direction', 'context_id'), true);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000012', 'career_direction', 'Replacement direction',
  'New evidence replaces the original direction.', 'working', 'normal', 'user_supplied', null,
  '2026-09-02T12:13:00Z', 1, null, 'supporting', null, null, null,
  current_setting('request.original_entity_id')::uuid
);
select set_config('request.replacement_candidate_id', pg_temp.pc_candidate_value('Replacement direction', 'id'), true);
select set_config('request.supersede_confirmation_id', workspace.mcp_request_context_review(
  current_setting('request.replacement_candidate_id')::uuid,
  'supersede', 'b1900000-0000-4000-8000-000000000013'
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_entity_value(current_setting('request.original_entity_id')::uuid, 'status'), 'active', 'MCP supersede request does not replace active context');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.supersede_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct owner confirmation executes supersession');
select set_config('request.replacement_entity_id', pg_temp.pc_candidate_value('Replacement direction', 'context_id'), true);
select is(pg_temp.pc_entity_value(current_setting('request.original_entity_id')::uuid, 'status'), 'superseded', 'supersession retires the challenged context');
select is(pg_temp.pc_entity_value(current_setting('request.original_entity_id')::uuid, 'superseded_by'),
  current_setting('request.replacement_entity_id'), 'supersession records the replacement context');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.link_confirmation_id', workspace.mcp_request_context_link(
  current_setting('request.corrected_entity_id')::uuid, 'related_to',
  'b1900000-0000-4000-8000-000000000014',
  current_setting('request.replacement_entity_id')::uuid
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_link_count(current_setting('request.corrected_entity_id')::uuid), 0, 'MCP link request creates no link');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.link_confirmation_id')::uuid
) ->> 'status', 'completed', 'direct owner confirmation creates the exact link');
select is(pg_temp.pc_link_count(current_setting('request.corrected_entity_id')::uuid), 1, 'confirmed link is persisted once');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.promote_confirmation_id', workspace.mcp_request_context_management(
  current_setting('request.corrected_entity_id')::uuid, 'promote',
  'b1900000-0000-4000-8000-000000000015', 'core'
) ->> 'confirmation_request_id', true);
select is(pg_temp.pc_entity_value(current_setting('request.corrected_entity_id')::uuid, 'tier'), 'working', 'MCP promotion request does not promote context');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select workspace.confirm_and_execute_professional_context(current_setting('request.promote_confirmation_id')::uuid);
select is(pg_temp.pc_entity_value(current_setting('request.corrected_entity_id')::uuid, 'tier'), 'core', 'direct owner confirmation promotes Working to Core');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.archive_confirmation_id', workspace.mcp_request_context_management(
  current_setting('request.replacement_entity_id')::uuid, 'archive',
  'b1900000-0000-4000-8000-000000000016'
) ->> 'confirmation_request_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select workspace.confirm_and_execute_professional_context(current_setting('request.archive_confirmation_id')::uuid);
select is(pg_temp.pc_entity_value(current_setting('request.replacement_entity_id')::uuid, 'status'), 'archived', 'direct owner confirmation archives context');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.delete_confirmation_id', workspace.mcp_request_context_management(
  current_setting('request.corrected_entity_id')::uuid, 'delete',
  'b1900000-0000-4000-8000-000000000017'
) ->> 'confirmation_request_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select workspace.confirm_and_execute_professional_context(current_setting('request.delete_confirmation_id')::uuid);
select is(pg_temp.pc_entity_value(current_setting('request.corrected_entity_id')::uuid, 'status'), 'deleted', 'direct owner confirmation redacts and deletes context');
select is(pg_temp.pc_entity_value(current_setting('request.corrected_entity_id')::uuid, 'label'), 'Deleted context', 'delete removes the retained context label');
select is(pg_temp.pc_link_count(current_setting('request.corrected_entity_id')::uuid), 0, 'delete removes links to the redacted context');

-- Denial and expiry are terminal, clear protected payload synchronously, and
-- never materialize protected graph content.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.denied_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000018', 'person', 'Denied private person',
  'Protected payload that the owner will deny.', 'working', 'private', 'user_supplied', null,
  '2026-09-02T12:18:00Z', 1
) ->> 'confirmation_request_id', true);
select set_config('request.expired_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000019', 'feedback', 'Expired sensitive feedback',
  'Protected payload that will expire.', 'working', 'sensitive', 'user_supplied', null,
  '2026-09-02T12:19:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace_private.professional_context_confirmation_requests
set requested_at = now() - interval '31 minutes', expires_at = now() - interval '1 minute'
where id = current_setting('request.expired_confirmation_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.deny_professional_context_confirmation(
  current_setting('request.denied_confirmation_id')::uuid
) ->> 'status', 'denied', 'direct owner denial is terminal');
select is(pg_temp.pc_confirmation_value(current_setting('request.denied_confirmation_id')::uuid, 'payload'), null, 'denial clears protected payload synchronously');
select is(pg_temp.pc_count('candidate', 'Denied private person'), 0, 'denied protected proposal creates no graph candidate');
select is(workspace.get_professional_context_confirmation(
  current_setting('request.expired_confirmation_id')::uuid
) ->> 'status', 'expired', 'preview materializes logical expiry immediately');
select is(pg_temp.pc_confirmation_value(current_setting('request.expired_confirmation_id')::uuid, 'payload'), null, 'expiry clears protected payload synchronously');
select is(pg_temp.pc_confirmation_value(current_setting('request.expired_confirmation_id')::uuid, 'snapshot'), null, 'expiry clears protected target state synchronously');
select is(pg_temp.pc_count('candidate', 'Expired sensitive feedback'), 0, 'expired protected proposal creates no graph candidate');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.stale_confirmation_id', workspace.mcp_request_context_management(
  current_setting('request.normal_entity_id')::uuid,
  'archive', 'b1900000-0000-4000-8000-000000000005'
) ->> 'confirmation_request_id', true);
reset role;
update workspace.professional_context_entities
set summary = summary || ' Changed after the confirmation was prepared.', updated_at = now()
where id = (select primary_target_id from workspace_private.professional_context_confirmation_requests
  where id = current_setting('request.stale_confirmation_id')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.get_professional_context_confirmation(
  current_setting('request.stale_confirmation_id')::uuid
) ->> 'status', 'stale', 'preview persists changed target state as stale');
select is(pg_temp.pc_confirmation_value(current_setting('request.stale_confirmation_id')::uuid, 'payload'), null, 'stale request clears transient payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.stale_confirmation_id')::uuid, 'snapshot'), null, 'stale request clears transient target state');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select ok(position('Changed after the confirmation was prepared' in
  workspace.mcp_get_context_confirmation_status(
    current_setting('request.stale_confirmation_id')::uuid
  )::text) = 0, 'terminal MCP polling exposes no protected preview content');

-- Capability and ownership loss can still identify and safely terminalize an
-- already-bound request without restoring preview or mutation authority.
select set_config('request.capability_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000028', 'goal', 'Capability-loss payload',
  'This protected payload must be cleared when P2 authority is removed.',
  'working', 'private', 'user_supplied', null, '2026-09-02T12:21:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace.bundle_capabilities set enabled = false
where bundle_key = 'sotf_transition' and capability_key = 'professional_context';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select throws_ok(
  $$select workspace.mcp_list_context_candidates_granted(null, array['sensitive'], 25)$$,
  '42501', 'This Workspace capability is not included for the current Personal plan.',
  'capability loss invalidates a still-unexpired protected-read grant'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.status == "active")'
)), 0, 'capability loss prevents stored grants from being presented as active');
select is(workspace.get_professional_context_confirmation(
  current_setting('request.capability_confirmation_id')::uuid
) ->> 'status', 'revoked', 'capability loss persists revoked status through the narrow direct status path');
select is(pg_temp.pc_confirmation_value(current_setting('request.capability_confirmation_id')::uuid, 'reason'),
  'capability_unavailable', 'capability loss records the bounded reason code');
select is(pg_temp.pc_confirmation_value(current_setting('request.capability_confirmation_id')::uuid, 'payload'),
  null, 'capability loss clears protected payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.capability_confirmation_id')::uuid, 'snapshot'),
  null, 'capability loss clears protected target state');
reset role;
update workspace.bundle_capabilities set enabled = true
where bundle_key = 'sotf_transition' and capability_key = 'professional_context';

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.membership_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000029', 'goal', 'Membership-loss payload',
  'This protected payload must be cleared when ownership is lost.',
  'working', 'private', 'user_supplied', null, '2026-09-02T12:22:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace.workspace_memberships set status = 'revoked', revoked_at = now()
where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = 'b1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select throws_ok(
  $$select workspace.mcp_list_context_candidates_granted(null, array['sensitive'], 25)$$,
  '42501', 'The AI assistant connection is not included for this Workspace.',
  'ownership membership loss invalidates a still-unexpired protected-read grant'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select throws_ok(
  $$select workspace.list_professional_context_read_grants()$$,
  '42501', 'Personal Workspace not found.',
  'ownership membership loss prevents protected grants from being presented as active'
);
select is(workspace.get_professional_context_confirmation(
  current_setting('request.membership_confirmation_id')::uuid
) ->> 'status', 'revoked', 'ownership membership loss persists revoked status without preview access');
select is(pg_temp.pc_confirmation_value(current_setting('request.membership_confirmation_id')::uuid, 'reason'),
  'workspace_access_changed', 'ownership membership loss records the bounded reason code');
select is(pg_temp.pc_confirmation_value(current_setting('request.membership_confirmation_id')::uuid, 'payload'),
  null, 'ownership membership loss clears protected payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.membership_confirmation_id')::uuid, 'snapshot'),
  null, 'ownership membership loss clears protected target state');
reset role;
update workspace.workspace_memberships set status = 'active', revoked_at = null
where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = 'b1111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.epoch_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000030', 'goal', 'Epoch-change payload',
  'This protected payload must be cleared by the authorization trigger.',
  'working', 'private', 'user_supplied', null, '2026-09-02T12:23:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace.mcp_authorizations
set authorization_valid_after = now(), updated_at = now()
where id = 'b1cc1111-1111-4111-8111-111111111111';
select is(pg_temp.pc_confirmation_value(current_setting('request.epoch_confirmation_id')::uuid, 'status'),
  'revoked', 'authorization epoch change immediately revokes the pending request');
select is(pg_temp.pc_confirmation_value(current_setting('request.epoch_confirmation_id')::uuid, 'payload'),
  null, 'authorization epoch change immediately clears payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.epoch_confirmation_id')::uuid, 'snapshot'),
  null, 'authorization epoch change immediately clears target state');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.status == "active")'
)), 0, 'authorization epoch change prevents prior grants from being presented as active');
reset role;

-- Bounded snapshots preserve stale detection but reject unusually connected
-- delete/redaction targets before a confirmation row can be inserted.
insert into workspace.context_evidence (
  workspace_id, entity_id, evidence_role, source_type, source_reference,
  observed_at, confidence, privacy_level, evidence_fingerprint, created_by
) values (
  'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  current_setting('request.normal_entity_id')::uuid,
  'supporting', 'inferred', 'bounded-fanout-1', now(), 0.5, 'normal',
  encode(extensions.digest(convert_to('bounded-fanout-1', 'UTF8'), 'sha256'), 'hex'),
  'b1111111-1111-4111-8111-111111111111'
);
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.bounded_delete_confirmation_id', workspace.mcp_request_context_management(
  current_setting('request.normal_entity_id')::uuid, 'delete',
  'b1900000-0000-4000-8000-000000000033'
) ->> 'confirmation_request_id', true);
select ok(pg_temp.pc_confirmation_value(
  current_setting('request.bounded_delete_confirmation_id')::uuid, 'snapshot_bytes'
)::integer <= 65536, 'normal bounded delete target snapshot succeeds within the byte limit');
reset role;
insert into workspace.context_evidence (
  workspace_id, entity_id, evidence_role, source_type, source_reference,
  observed_at, confidence, privacy_level, evidence_fingerprint, created_by
) values (
  'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  current_setting('request.normal_entity_id')::uuid,
  'supporting', 'inferred', 'bounded-fanout-2', now(), 0.5, 'normal',
  encode(extensions.digest(convert_to('bounded-fanout-2', 'UTF8'), 'sha256'), 'hex'),
  'b1111111-1111-4111-8111-111111111111'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(workspace.get_professional_context_confirmation(
  current_setting('request.bounded_delete_confirmation_id')::uuid
) ->> 'status', 'stale', 'minimized delete fanout fingerprint preserves stale-state detection');
select is(pg_temp.pc_confirmation_value(
  current_setting('request.bounded_delete_confirmation_id')::uuid, 'payload'
), null, 'fanout stale detection clears the pending payload');
reset role;
delete from workspace.context_evidence
where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and entity_id = current_setting('request.normal_entity_id')::uuid
  and source_reference like 'bounded-fanout-%';

insert into workspace.context_evidence (
  workspace_id, entity_id, evidence_role, source_type, source_reference,
  observed_at, confidence, privacy_level, evidence_fingerprint, created_by
)
select
  'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  current_setting('request.normal_entity_id')::uuid,
  'supporting', 'inferred', 'fanout-' || series::text,
  now(), 0.5, 'normal',
  encode(extensions.digest(convert_to('fanout-' || series::text, 'UTF8'), 'sha256'), 'hex'),
  'b1111111-1111-4111-8111-111111111111'
from generate_series(1, 129) as series;
select set_config('request.confirmation_count_before_fanout', pg_temp.pc_count('confirmation')::text, true);
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select throws_ok(format(
  'select workspace.mcp_request_context_management(%L::uuid, %L, %L::uuid)',
  current_setting('request.normal_entity_id'), 'delete',
  'b1900000-0000-4000-8000-000000000031'
), '54000', 'The confirmation target state exceeds supported bounds.',
  'large delete/redaction fanout fails with a bounded error');
reset role;
select is(pg_temp.pc_count('confirmation'), current_setting('request.confirmation_count_before_fanout')::integer,
  'large fanout failure leaves no partial confirmation state');
delete from workspace.context_evidence
where workspace_id = 'b1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and entity_id = current_setting('request.normal_entity_id')::uuid
  and source_reference like 'fanout-%';
select ok(not exists (
  select 1 from workspace_private.professional_context_confirmation_requests
  where status = 'pending' and pg_column_size(target_state_snapshot) > 65536
), 'all retained pending target snapshots satisfy the explicit byte limit');

-- Cleanup implementation is independently executable. Scheduler readiness is
-- false before pg_cron exists, then deterministic and idempotent once installed.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.cleanup_expired_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000032', 'goal', 'Cleanup expiry payload',
  'The cleanup function must clear this expired protected payload.',
  'working', 'private', 'user_supplied', null, '2026-09-02T12:24:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace_private.professional_context_confirmation_requests
set requested_at = now() - interval '31 minutes', expires_at = now() - interval '1 minute'
where id = current_setting('request.cleanup_expired_id')::uuid;
update workspace_private.professional_context_confirmation_requests
set terminal_at = now() - interval '31 days'
where id = current_setting('request.denied_confirmation_id')::uuid;
update workspace_private.professional_context_read_grants
set issued_at = now() - interval '32 days', expires_at = now() - interval '31 days'
where id = (current_setting('request.expiring_private_grant')::jsonb ->> 'grant_id')::uuid;
select set_config('request.cleanup_result', workspace_private.cleanup_professional_context_confirmations()::text, true);
select is(pg_temp.pc_confirmation_value(current_setting('request.cleanup_expired_id')::uuid, 'status'),
  'expired', 'cleanup expires pending rows');
select is(pg_temp.pc_confirmation_value(current_setting('request.cleanup_expired_id')::uuid, 'payload'),
  null, 'cleanup clears expired protected payload');
select is(pg_temp.pc_confirmation_value(current_setting('request.cleanup_expired_id')::uuid, 'snapshot'),
  null, 'cleanup clears expired target state');
select ok((current_setting('request.cleanup_result')::jsonb ->> 'metadata_deleted')::integer >= 1,
  'cleanup removes terminal metadata older than configured retention');
select ok((current_setting('request.cleanup_result')::jsonb ->> 'stale_grants_deleted')::integer >= 1,
  'cleanup removes stale grants');
select is((workspace_private.professional_context_cleanup_schedule_status() ->> 'ready')::boolean,
  false, 'release preflight reports NOT READY when scheduler capability is absent');
select is(workspace_private.professional_context_cleanup_schedule_status() ->> 'reason',
  'scheduler_unavailable', 'missing scheduler is not represented as success');
create extension pg_cron;
select is((workspace_private.ensure_professional_context_cleanup_schedule() ->> 'ready')::boolean,
  true, 'installed pg_cron receives the deterministic cleanup schedule');
select is((workspace_private.ensure_professional_context_cleanup_schedule() ->> 'ready')::boolean,
  true, 'cleanup scheduling is idempotent');
select is((select count(*)::integer from cron.job
  where jobname = 'workspace-professional-context-confirmation-cleanup'),
  1, 'idempotent scheduling creates exactly one cleanup job');
select cron.schedule(
  'workspace-professional-context-confirmation-cleanup',
  '0 * * * *',
  'select workspace_private.cleanup_professional_context_confirmations()'
);
select is(workspace_private.professional_context_cleanup_schedule_status() ->> 'reason',
  'cleanup_job_misconfigured', 'release preflight rejects an incorrect cadence');
select cron.schedule(
  'workspace-professional-context-confirmation-cleanup',
  '*/15 * * * *',
  'select 1'
);
select is(workspace_private.professional_context_cleanup_schedule_status() ->> 'reason',
  'cleanup_job_misconfigured', 'release preflight rejects an incorrect target function');
select is((workspace_private.ensure_professional_context_cleanup_schedule() ->> 'ready')::boolean,
  true, 'scheduler reconciliation restores the exact bounded cleanup job');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select set_config('request.disconnect_grant_id', workspace.create_professional_context_read_grant(
  'bc111111-1111-4111-8111-111111111111', 'private'
) ->> 'grant_id', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b1111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'aud', current_setting('request.pc_resource_uri'),
  'client_id', 'bc111111-1111-4111-8111-111111111111',
  'workspace_mcp', 'true', 'iat', 1900000000
)::text, true);
select set_config('request.revoked_confirmation_id', workspace.mcp_submit_context_candidate(
  'b1900000-0000-4000-8000-000000000020', 'responsibility', 'Revoked private proposal',
  'This pending payload must not survive a disconnect.', 'working', 'private', 'user_supplied', null,
  '2026-09-02T12:20:00Z', 1
) ->> 'confirmation_request_id', true);
reset role;
update workspace.mcp_authorizations set status = 'disconnected', disconnected_at = now()
where id = 'b1cc1111-1111-4111-8111-111111111111';
select is(pg_temp.pc_confirmation_value(current_setting('request.revoked_confirmation_id')::uuid, 'status'),
  'revoked', 'assistant disconnect terminalizes the pending request in the disconnect transaction');
select is(pg_temp.pc_confirmation_value(current_setting('request.revoked_confirmation_id')::uuid, 'payload'),
  null, 'assistant disconnect clears protected payload in the disconnect transaction');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}', true);
select is(jsonb_array_length(jsonb_path_query_array(
  workspace.list_professional_context_read_grants(),
  '$.grants[*] ? (@.status == "active")'
)), 0, 'disconnect prevents its protected-read grants from being presented as active');
select is(workspace.confirm_and_execute_professional_context(
  current_setting('request.revoked_confirmation_id')::uuid
) ->> 'status', 'revoked', 'a terminal revoked request cannot execute after disconnect');
select is(pg_temp.pc_count('candidate', 'Revoked private proposal'), 0, 'revoked protected proposal creates no graph candidate');

reset role;
select * from finish();
rollback;
