-- P2 B2.1: release-hardening corrections for confirmation authority.
-- This migration keeps P2 disabled. It bounds protected request state,
-- materializes terminal invalidation, minimizes completion references, and
-- separates cleanup implementation from target-environment scheduler proof.

insert into workspace_private.product_settings (setting_key, setting_value)
values
  ('professional_context_confirmation_snapshot_max_bytes', '65536'),
  ('professional_context_confirmation_snapshot_max_items', '128')
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  updated_at = now();

alter table workspace_private.professional_context_confirmation_requests
  drop constraint if exists professional_context_confirmation_re_terminal_reason_code_check;
alter table workspace_private.professional_context_confirmation_requests
  drop constraint if exists professional_context_confirmation_requests_terminal_reason_code_check;
alter table workspace_private.professional_context_confirmation_requests
  add constraint professional_context_confirmation_requests_terminal_reason_code_check
  check (terminal_reason_code is null or terminal_reason_code in (
    'user_denied', 'target_changed', 'expired', 'authorization_changed',
    'capability_unavailable', 'workspace_access_changed', 'user_revoked'
  ));

-- Existing completed rows are minimized before the allowlist constraint is
-- installed. The retained values are action outcomes, never graph addresses.
update workspace_private.professional_context_confirmation_requests
set result_reference = case
  when action_type in ('propose_private', 'propose_sensitive')
    then jsonb_build_object('kind', 'candidate')
  when action_type in ('approve', 'correct', 'reject', 'supersede')
    then jsonb_build_object('kind', 'context_review', 'decision', action_type)
  when action_type = 'link'
    then jsonb_build_object('kind', 'context_link')
  else jsonb_build_object('kind', 'professional_context', 'action', action_type)
end,
updated_at = now()
where status = 'completed';

alter table workspace_private.professional_context_confirmation_requests
  drop constraint if exists professional_context_confirmation_snapshot_size_check;
alter table workspace_private.professional_context_confirmation_requests
  drop constraint if exists professional_context_confirmation_result_allowlist_check;
alter table workspace_private.professional_context_confirmation_requests
  add constraint professional_context_confirmation_snapshot_size_check
  check (target_state_snapshot is null or pg_column_size(target_state_snapshot) <= 65536);
alter table workspace_private.professional_context_confirmation_requests
  add constraint professional_context_confirmation_result_allowlist_check
  check (
    result_reference is null
    or (
      pg_column_size(result_reference) <= 1024
      and result_reference = case
        when action_type in ('propose_private', 'propose_sensitive')
          then jsonb_build_object('kind', 'candidate')
        when action_type in ('approve', 'correct', 'reject', 'supersede')
          then jsonb_build_object('kind', 'context_review', 'decision', action_type)
        when action_type = 'link'
          then jsonb_build_object('kind', 'context_link')
        else jsonb_build_object('kind', 'professional_context', 'action', action_type)
      end
    )
  );

create or replace function workspace_private.context_record_snapshot(
  target_workspace_id uuid,
  target_record_type text,
  target_record_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  record_state jsonb;
begin
  if target_record_id is null then
    return null;
  end if;
  case target_record_type
    when 'task' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.tasks as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'commitment' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.commitments as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'meeting' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.meetings as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'decision' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.decisions as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'capture' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.capture_inbox as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'job_application' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.job_applications as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'memory_entry' then select to_jsonb(record) - array['workspace_id', 'created_by'] into record_state from workspace.memory_entries as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    else return null;
  end case;
  if record_state is null then
    return null;
  end if;
  return jsonb_build_object(
    'record_type', target_record_type,
    'record_id', target_record_id,
    'state_fingerprint', workspace_private.context_confirmation_fingerprint(
      'source-record:' || target_record_type, record_state
    )
  );
end;
$$;

create or replace function workspace_private.context_confirmation_target_snapshot(
  target_workspace_id uuid,
  target_action text,
  target_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_candidate_id uuid;
  selected_context_id uuid;
  selected_target_entity_id uuid;
  selected_target_record_id uuid;
  selected_target_record_type text;
  candidate_record workspace.context_candidates%rowtype;
  max_items integer := 128;
  first_count integer := 0;
  second_count integer := 0;
  third_count integer := 0;
  fourth_count integer := 0;
  fanout_state jsonb;
begin
  select greatest(1, least(128, setting_value::integer)) into max_items
  from workspace_private.product_settings
  where setting_key = 'professional_context_confirmation_snapshot_max_items';
  max_items := coalesce(max_items, 128);

  if target_action in ('propose_private', 'propose_sensitive') then
    select count(*)::integer into first_count
    from workspace.context_candidates as candidate
    where candidate.workspace_id = target_workspace_id
      and candidate.entity_family = target_payload ->> 'family'
      and candidate.dedupe_key = workspace_private.context_fingerprint(
        lower(trim(target_payload ->> 'family')),
        lower(trim(target_payload ->> 'label')),
        lower(trim(target_payload ->> 'summary'))
      );
    if first_count > max_items then
      raise exception 'The confirmation target state exceeds supported bounds.' using errcode = '54000';
    end if;
    return jsonb_build_object(
      'chapter', (select to_jsonb(chapter) - 'workspace_id' - 'created_by'
        from workspace.context_chapters as chapter
        where chapter.workspace_id = target_workspace_id
          and chapter.chapter_key = target_payload ->> 'chapter_key'),
      'conflict', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id
          and entity.id = nullif(target_payload ->> 'conflict_with_entity_id', '')::uuid),
      'possible_match', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id
          and entity.id = nullif(target_payload ->> 'possible_match_entity_id', '')::uuid),
      'source_record', workspace_private.context_record_snapshot(
        target_workspace_id,
        target_payload ->> 'source_record_type',
        nullif(target_payload ->> 'source_record_id', '')::uuid
      ),
      'matching_candidates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', candidate.id, 'status', candidate.status,
          'dedupe_key', candidate.dedupe_key,
          'evidence_fingerprint', candidate.evidence_fingerprint,
          'updated_at', candidate.updated_at
        ) order by candidate.id)
        from workspace.context_candidates as candidate
        where candidate.workspace_id = target_workspace_id
          and candidate.entity_family = target_payload ->> 'family'
          and candidate.dedupe_key = workspace_private.context_fingerprint(
            lower(trim(target_payload ->> 'family')),
            lower(trim(target_payload ->> 'label')),
            lower(trim(target_payload ->> 'summary'))
          )
      ), '[]'::jsonb)
    );
  end if;

  if target_action in ('approve', 'correct', 'reject', 'supersede') then
    selected_candidate_id := (target_payload ->> 'candidate_id')::uuid;
    select * into candidate_record from workspace.context_candidates
    where id = selected_candidate_id and workspace_id = target_workspace_id;
    select count(*)::integer into first_count from workspace.context_evidence as evidence
    where evidence.workspace_id = target_workspace_id and evidence.candidate_id = selected_candidate_id;
    if target_action = 'correct' then
      select count(*)::integer into second_count
      from workspace.professional_context_entities as entity
      where entity.workspace_id = target_workspace_id
        and entity.entity_family = candidate_record.entity_family
        and entity.lifecycle_status = 'active';
    end if;
    if first_count + second_count > max_items then
      raise exception 'The confirmation target state exceeds supported bounds.' using errcode = '54000';
    end if;
    return jsonb_build_object(
      'candidate', case when candidate_record.id is null then null else to_jsonb(candidate_record)
        - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint' end,
      'evidence', coalesce((select jsonb_agg(
        to_jsonb(evidence) - 'workspace_id' - 'created_by' order by evidence.id
      ) from workspace.context_evidence as evidence
        where evidence.workspace_id = target_workspace_id and evidence.candidate_id = selected_candidate_id), '[]'::jsonb),
      'conflict', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id and entity.id = candidate_record.conflict_with_entity_id),
      'possible_match', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id and entity.id = candidate_record.possible_match_entity_id),
      'chapter', (select to_jsonb(chapter) - 'workspace_id' - 'created_by'
        from workspace.context_chapters as chapter
        where chapter.workspace_id = target_workspace_id and chapter.chapter_key = candidate_record.proposed_chapter_key),
      'family_entities', case when target_action = 'correct' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', entity.id, 'dedupe_key', entity.dedupe_key,
          'lifecycle_status', entity.lifecycle_status, 'updated_at', entity.updated_at
        ) order by entity.id)
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id
          and entity.entity_family = candidate_record.entity_family
          and entity.lifecycle_status = 'active'
      ), '[]'::jsonb) else '[]'::jsonb end
    );
  end if;

  selected_context_id := (target_payload ->> 'context_id')::uuid;
  if target_action = 'link' then
    selected_target_entity_id := nullif(target_payload ->> 'target_context_id', '')::uuid;
    selected_target_record_id := nullif(target_payload ->> 'target_record_id', '')::uuid;
    selected_target_record_type := nullif(target_payload ->> 'target_record_type', '');
    select count(*)::integer into first_count
    from workspace.professional_context_links as link
    where link.workspace_id = target_workspace_id
      and link.source_entity_id = selected_context_id
      and link.target_entity_id is not distinct from selected_target_entity_id
      and link.target_record_type is not distinct from selected_target_record_type
      and link.target_record_id is not distinct from selected_target_record_id
      and link.link_type = target_payload ->> 'link_type';
    if first_count > max_items then
      raise exception 'The confirmation target state exceeds supported bounds.' using errcode = '54000';
    end if;
    return jsonb_build_object(
      'source', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id and entity.id = selected_context_id),
      'target_context', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id and entity.id = selected_target_entity_id),
      'target_record', workspace_private.context_record_snapshot(
        target_workspace_id, selected_target_record_type, selected_target_record_id
      ),
      'matching_links', coalesce((select jsonb_agg(jsonb_build_object(
        'id', link.id, 'link_type', link.link_type, 'created_at', link.created_at
      ) order by link.id)
      from workspace.professional_context_links as link
      where link.workspace_id = target_workspace_id
        and link.source_entity_id = selected_context_id
        and link.target_entity_id is not distinct from selected_target_entity_id
        and link.target_record_type is not distinct from selected_target_record_type
        and link.target_record_id is not distinct from selected_target_record_id
        and link.link_type = target_payload ->> 'link_type'), '[]'::jsonb)
    );
  end if;

  if target_action = 'delete' then
    select count(*)::integer into first_count from workspace.context_evidence as evidence
    where evidence.workspace_id = target_workspace_id and evidence.entity_id = selected_context_id;
    select count(*)::integer into second_count from workspace.context_candidates as candidate
    where candidate.workspace_id = target_workspace_id and candidate.confirmed_entity_id = selected_context_id;
    select count(*)::integer into third_count from workspace.context_reviews as review
    where review.workspace_id = target_workspace_id
      and (review.entity_id = selected_context_id or review.resulting_entity_id = selected_context_id);
    select count(*)::integer into fourth_count from workspace.professional_context_links as link
    where link.workspace_id = target_workspace_id
      and (link.source_entity_id = selected_context_id or link.target_entity_id = selected_context_id);
    if first_count + second_count + third_count + fourth_count > max_items then
      raise exception 'The confirmation target state exceeds supported bounds.' using errcode = '54000';
    end if;
    fanout_state := jsonb_build_object(
      'evidence', coalesce((select jsonb_agg(
        workspace_private.context_confirmation_fingerprint(
          'delete-evidence-row', to_jsonb(evidence) - 'workspace_id' - 'created_by'
        ) order by evidence.id
      ) from workspace.context_evidence as evidence
        where evidence.workspace_id = target_workspace_id and evidence.entity_id = selected_context_id), '[]'::jsonb),
      'candidates', coalesce((select jsonb_agg(
        workspace_private.context_confirmation_fingerprint(
          'delete-candidate-row', to_jsonb(candidate) - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint'
        ) order by candidate.id
      ) from workspace.context_candidates as candidate
        where candidate.workspace_id = target_workspace_id and candidate.confirmed_entity_id = selected_context_id), '[]'::jsonb),
      'reviews', coalesce((select jsonb_agg(
        workspace_private.context_confirmation_fingerprint(
          'delete-review-row', to_jsonb(review) - 'workspace_id' - 'reviewed_by' - 'client_id' - 'request_fingerprint'
        ) order by review.id
      ) from workspace.context_reviews as review
        where review.workspace_id = target_workspace_id
          and (review.entity_id = selected_context_id or review.resulting_entity_id = selected_context_id)), '[]'::jsonb),
      'links', coalesce((select jsonb_agg(
        workspace_private.context_confirmation_fingerprint(
          'delete-link-row', to_jsonb(link) - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint'
        ) order by link.id
      ) from workspace.professional_context_links as link
        where link.workspace_id = target_workspace_id
          and (link.source_entity_id = selected_context_id or link.target_entity_id = selected_context_id)), '[]'::jsonb)
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'context', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
      from workspace.professional_context_entities as entity
      where entity.workspace_id = target_workspace_id and entity.id = selected_context_id),
    'destination_chapter', case when target_action = 'promote' then (
      select to_jsonb(chapter) - 'workspace_id' - 'created_by'
      from workspace.context_chapters as chapter
      where chapter.workspace_id = target_workspace_id
        and chapter.chapter_key = target_payload ->> 'chapter_key'
    ) else null end,
    'affected_counts', case when target_action = 'delete' then jsonb_build_object(
      'evidence', first_count, 'candidates', second_count,
      'reviews', third_count, 'links', fourth_count
    ) else null end,
    'affected_state_fingerprint', case when target_action = 'delete' then
      workspace_private.context_confirmation_fingerprint('delete-fanout', fanout_state)
      else null end
  ));
end;
$$;

-- Public status serialization reports only persisted state. Any path that can
-- discover expiry or invalidation must materialize it first; this helper never
-- creates an effective-but-unpersisted terminal state.
create or replace function workspace_private.context_confirmation_public_status(
  request_record workspace_private.professional_context_confirmation_requests
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'confirmation_request_id', request_record.id,
    'status', request_record.status,
    'action', request_record.action_type,
    'expires_at', request_record.expires_at,
    'result', request_record.result_reference
  ));
$$;

create or replace function workspace_private.create_professional_context_confirmation(
  logical_request_id uuid,
  target_action text,
  target_type text,
  target_id uuid,
  canonical_payload jsonb,
  contains_private boolean default false,
  contains_sensitive boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  authorization_record workspace.mcp_authorizations%rowtype;
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  payload_fingerprint text;
  target_snapshot jsonb;
  state_fingerprint text;
  max_snapshot_bytes integer := 65536;
begin
  if logical_request_id is null or canonical_payload is null or jsonb_typeof(canonical_payload) <> 'object'
    or pg_column_size(canonical_payload) > 32768 then
    raise exception 'The confirmation request is invalid or too large.' using errcode = '22023';
  end if;
  if target_action not in (
    'propose_private', 'propose_sensitive', 'approve', 'correct', 'reject',
    'supersede', 'link', 'promote', 'archive', 'delete'
  ) or target_type not in ('proposal', 'candidate', 'context') then
    raise exception 'The confirmation operation is not supported.' using errcode = '22023';
  end if;

  select * into authorization_record
  from workspace.mcp_authorizations as auth_record
  where auth_record.workspace_id = target_workspace_id
    and auth_record.created_by = auth.uid()
    and auth_record.client_id = token_client_id
    and auth_record.status = 'connected';
  if not found then
    raise exception 'This assistant connection is not authorized.' using errcode = '42501';
  end if;

  perform workspace_private.lock_professional_context(target_workspace_id);
  payload_fingerprint := workspace_private.context_confirmation_fingerprint(
    'payload:' || target_action, canonical_payload
  );
  target_snapshot := workspace_private.context_confirmation_target_snapshot(
    target_workspace_id, target_action, canonical_payload
  );
  select greatest(4096, least(65536, setting_value::integer)) into max_snapshot_bytes
  from workspace_private.product_settings
  where setting_key = 'professional_context_confirmation_snapshot_max_bytes';
  max_snapshot_bytes := coalesce(max_snapshot_bytes, 65536);
  if target_snapshot is null or pg_column_size(target_snapshot) > max_snapshot_bytes then
    raise exception 'The confirmation target state exceeds supported bounds.' using errcode = '54000';
  end if;
  state_fingerprint := workspace_private.context_confirmation_fingerprint(
    'target-state:' || target_action, target_snapshot
  );

  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.workspace_id = target_workspace_id
    and confirmation.user_id = auth.uid()
    and confirmation.mcp_authorization_id = authorization_record.id
    and confirmation.logical_request_id = create_professional_context_confirmation.logical_request_id;
  if found then
    if request_record.action_type <> target_action
      or request_record.requested_payload_fingerprint <> payload_fingerprint then
      raise exception 'Reuse a logical request identifier only with the same canonical operation.' using errcode = '22023';
    end if;
    request_record := workspace_private.materialize_professional_context_confirmation(request_record.id);
    return workspace_private.context_confirmation_public_status(request_record)
      || jsonb_build_object(
        'outcome', case when request_record.status = 'pending'
          then 'confirmation_pending' else 'confirmation_' || request_record.status end,
        'review_path', '/workspace/professional-context/confirmations/' || request_record.id::text,
        'idempotent_replay', true
      );
  end if;

  insert into workspace_private.professional_context_confirmation_requests (
    workspace_id, user_id, mcp_authorization_id, client_id, authorization_valid_after,
    logical_request_id, action_type, primary_target_type, primary_target_id,
    normalized_payload, requested_payload_fingerprint,
    target_state_snapshot, target_state_fingerprint,
    contains_private, contains_sensitive
  ) values (
    target_workspace_id, auth.uid(), authorization_record.id, authorization_record.client_id,
    authorization_record.authorization_valid_after,
    logical_request_id, target_action, target_type, target_id,
    canonical_payload, payload_fingerprint, target_snapshot, state_fingerprint,
    contains_private, contains_sensitive
  ) returning * into request_record;

  return workspace_private.context_confirmation_public_status(request_record)
    || jsonb_build_object(
      'outcome', 'confirmation_pending',
      'review_path', '/workspace/professional-context/confirmations/' || request_record.id::text,
      'idempotent_replay', false
    );
end;
$$;

create or replace function workspace_private.materialize_professional_context_confirmation(
  target_request_id uuid
)
returns workspace_private.professional_context_confirmation_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  authorization_record workspace.mcp_authorizations%rowtype;
  current_snapshot jsonb;
  has_workspace_access boolean;
  next_status text;
  reason_code text;
begin
  select * into request_record
  from workspace_private.professional_context_confirmation_requests
  where id = target_request_id;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  perform workspace_private.lock_professional_context(request_record.workspace_id);
  select * into request_record
  from workspace_private.professional_context_confirmation_requests
  where id = target_request_id
  for update;
  if request_record.status <> 'pending' then
    return request_record;
  end if;

  if request_record.expires_at <= now() then
    next_status := 'expired';
    reason_code := 'expired';
  else
    select * into authorization_record
    from workspace.mcp_authorizations
    where id = request_record.mcp_authorization_id
      and workspace_id = request_record.workspace_id
      and created_by = request_record.user_id
      and client_id = request_record.client_id;
    if not found or authorization_record.status <> 'connected'
      or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after then
      next_status := 'revoked';
      reason_code := 'authorization_changed';
    else
      select exists (
        select 1
        from workspace.workspaces as workspace_record
        join workspace.workspace_memberships as membership
          on membership.workspace_id = workspace_record.id
        where workspace_record.id = request_record.workspace_id
          and workspace_record.owner_user_id = request_record.user_id
          and workspace_record.workspace_type = 'personal'
          and membership.user_id = request_record.user_id
          and membership.role = 'owner'
          and membership.status = 'active'
      ) into has_workspace_access;
      if not has_workspace_access then
        next_status := 'revoked';
        reason_code := 'workspace_access_changed';
      elsif not workspace_private.has_personal_capability(request_record.workspace_id, 'core_workspace')
        or not workspace_private.has_personal_capability(request_record.workspace_id, 'workspace_mcp')
        or not workspace_private.has_personal_capability(request_record.workspace_id, 'professional_context') then
        next_status := 'revoked';
        reason_code := 'capability_unavailable';
      else
        begin
          current_snapshot := workspace_private.context_confirmation_target_snapshot(
            request_record.workspace_id, request_record.action_type, request_record.normalized_payload
          );
        exception when program_limit_exceeded then
          next_status := 'stale';
          reason_code := 'target_changed';
        end;
        if next_status is null and workspace_private.context_confirmation_fingerprint(
          'target-state:' || request_record.action_type, current_snapshot
        ) <> request_record.target_state_fingerprint then
          next_status := 'stale';
          reason_code := 'target_changed';
        end if;
      end if;
    end if;
  end if;

  if next_status is not null then
    update workspace_private.professional_context_confirmation_requests
    set status = next_status, normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = reason_code, terminal_at = now(),
      payload_cleared_at = now(), updated_at = now()
    where id = request_record.id
    returning * into request_record;
  end if;
  return request_record;
end;
$$;

create or replace function workspace_private.require_direct_context_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function workspace.mcp_get_context_confirmation_status(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
begin
  if not workspace_private.is_valid_mcp_request() then
    raise exception 'The MCP authorization is invalid or has the wrong audience.' using errcode = '42501';
  end if;
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.user_id = auth.uid()
    and confirmation.client_id = token_client_id;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  request_record := workspace_private.materialize_professional_context_confirmation(request_record.id);
  return workspace_private.context_confirmation_public_status(request_record);
end;
$$;

create or replace function workspace.get_professional_context_confirmation(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  direct_user_id uuid := workspace_private.require_direct_context_user();
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
begin
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.user_id = direct_user_id;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  request_record := workspace_private.materialize_professional_context_confirmation(request_record.id);
  return jsonb_strip_nulls(jsonb_build_object(
    'confirmation_request_id', request_record.id,
    'status', request_record.status,
    'action', request_record.action_type,
    'requested_at', request_record.requested_at,
    'expires_at', request_record.expires_at,
    'operation', case when request_record.status = 'pending' then request_record.normalized_payload else null end,
    'reviewed_state', case when request_record.status = 'pending' then request_record.target_state_snapshot else null end,
    'editable_fields', case when request_record.action_type = 'correct'
      then jsonb_build_array('corrected_label', 'corrected_summary') else '[]'::jsonb end,
    'result', request_record.result_reference
  ));
end;
$$;

create or replace function workspace.deny_professional_context_confirmation(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  direct_user_id uuid := workspace_private.require_direct_context_user();
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
begin
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.user_id = direct_user_id;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  request_record := workspace_private.materialize_professional_context_confirmation(request_record.id);
  if request_record.status <> 'pending' then
    return workspace_private.context_confirmation_public_status(request_record);
  end if;
  update workspace_private.professional_context_confirmation_requests
  set status = 'denied', normalized_payload = null, target_state_snapshot = null,
    terminal_reason_code = 'user_denied', terminal_by = direct_user_id, terminal_at = now(),
    payload_cleared_at = now(), updated_at = now()
  where id = request_record.id returning * into request_record;
  return workspace_private.context_confirmation_public_status(request_record);
end;
$$;

create or replace function workspace.confirm_and_execute_professional_context(
  target_request_id uuid,
  final_corrected_label text default null,
  final_corrected_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  direct_user_id uuid := workspace_private.require_direct_context_user();
  direct_claims jsonb := auth.jwt();
  target_workspace_id uuid;
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  final_payload jsonb;
  mutation_result jsonb;
  bounded_result_reference jsonb;
  edited_fields text[] := '{}';
  resource_uri text;
  synthetic_claims jsonb;
  candidate_record workspace.context_candidates%rowtype;
  normalized_label text;
  normalized_summary text;
begin
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.user_id = direct_user_id;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  request_record := workspace_private.materialize_professional_context_confirmation(request_record.id);
  target_workspace_id := request_record.workspace_id;
  if request_record.status = 'completed' then
    return workspace_private.context_confirmation_public_status(request_record)
      || jsonb_build_object('idempotent_replay', true);
  end if;
  if request_record.status <> 'pending' then
    return workspace_private.context_confirmation_public_status(request_record);
  end if;

  final_payload := request_record.normalized_payload;
  if request_record.action_type = 'correct' then
    select * into candidate_record from workspace.context_candidates
    where id = request_record.primary_target_id and workspace_id = target_workspace_id
    for update;
    normalized_label := coalesce(
      nullif(trim(final_corrected_label), ''),
      nullif(final_payload ->> 'corrected_label', ''),
      candidate_record.proposed_label
    );
    normalized_summary := coalesce(
      nullif(trim(final_corrected_summary), ''),
      nullif(final_payload ->> 'corrected_summary', ''),
      candidate_record.proposed_summary
    );
    if normalized_label is not distinct from candidate_record.proposed_label
      and normalized_summary is not distinct from candidate_record.proposed_summary then
      raise exception 'A correction must make an actual normalized content change.' using errcode = '22023';
    end if;
    if char_length(normalized_label) > 240 or char_length(normalized_summary) > 5000 then
      raise exception 'Corrected context length is invalid.' using errcode = '22023';
    end if;
    if final_corrected_label is not null
      and normalized_label is distinct from nullif(final_payload ->> 'corrected_label', '') then
      edited_fields := array_append(edited_fields, 'corrected_label');
    end if;
    if final_corrected_summary is not null
      and normalized_summary is distinct from nullif(final_payload ->> 'corrected_summary', '') then
      edited_fields := array_append(edited_fields, 'corrected_summary');
    end if;
    final_payload := final_payload
      || jsonb_build_object('corrected_label', normalized_label, 'corrected_summary', normalized_summary);
  elsif final_corrected_label is not null or final_corrected_summary is not null then
    raise exception 'This operation does not permit content edits.' using errcode = '22023';
  end if;

  select setting_value into resource_uri from workspace_private.product_settings
  where setting_key = 'mcp_resource_uri';
  synthetic_claims := direct_claims || jsonb_build_object(
    'client_id', request_record.client_id,
    'workspace_mcp', 'true',
    'aud', resource_uri,
    'iat', extract(epoch from now())::bigint
  );
  perform set_config('request.jwt.claims', synthetic_claims::text, true);

  if request_record.action_type in ('propose_private', 'propose_sensitive') then
    mutation_result := workspace.mcp_propose_context_candidate_protected(
      (final_payload ->> 'request_id')::uuid,
      final_payload ->> 'family', final_payload ->> 'label', final_payload ->> 'summary',
      final_payload ->> 'tier', final_payload ->> 'privacy', final_payload ->> 'source_type',
      final_payload ->> 'source_reference', (final_payload ->> 'observed_at')::timestamptz,
      (final_payload ->> 'confidence')::numeric, final_payload ->> 'evidence_excerpt',
      final_payload ->> 'evidence_role', final_payload ->> 'chapter_key',
      final_payload ->> 'source_record_type', nullif(final_payload ->> 'source_record_id', '')::uuid,
      nullif(final_payload ->> 'conflict_with_entity_id', '')::uuid,
      nullif(final_payload ->> 'possible_match_entity_id', '')::uuid,
      'retain', 'none', true
    );
    bounded_result_reference := jsonb_build_object('kind', 'candidate');
  elsif request_record.action_type in ('approve', 'correct', 'reject', 'supersede') then
    mutation_result := workspace.mcp_review_context_candidate_protected(
      (final_payload ->> 'candidate_id')::uuid, final_payload ->> 'decision',
      (final_payload ->> 'request_id')::uuid, null,
      final_payload ->> 'corrected_label', final_payload ->> 'corrected_summary', null,
      final_payload ->> 'review_notes', true
    );
    bounded_result_reference := jsonb_build_object(
      'kind', 'context_review', 'decision', request_record.action_type
    );
  elsif request_record.action_type = 'link' then
    mutation_result := workspace.mcp_link_professional_context_protected(
      (final_payload ->> 'context_id')::uuid, final_payload ->> 'link_type',
      (final_payload ->> 'request_id')::uuid,
      nullif(final_payload ->> 'target_context_id', '')::uuid,
      final_payload ->> 'target_record_type', nullif(final_payload ->> 'target_record_id', '')::uuid,
      true
    );
    bounded_result_reference := jsonb_build_object('kind', 'context_link');
  else
    mutation_result := workspace.mcp_manage_professional_context_protected(
      (final_payload ->> 'context_id')::uuid, final_payload ->> 'action',
      (final_payload ->> 'request_id')::uuid, final_payload ->> 'tier',
      final_payload ->> 'chapter_key', final_payload ->> 'review_notes', true
    );
    bounded_result_reference := jsonb_build_object(
      'kind', 'professional_context', 'action', request_record.action_type
    );
  end if;

  perform set_config('request.jwt.claims', direct_claims::text, true);
  update workspace_private.professional_context_confirmation_requests
  set status = 'completed', normalized_payload = null, target_state_snapshot = null,
    final_payload_fingerprint = workspace_private.context_confirmation_fingerprint(
      'payload:' || request_record.action_type, final_payload
    ),
    result_reference = bounded_result_reference, user_edited_fields = edited_fields,
    completed_by = direct_user_id, completed_at = now(), terminal_at = now(),
    payload_cleared_at = now(), updated_at = now()
  where id = request_record.id returning * into request_record;

  return workspace_private.context_confirmation_public_status(request_record)
    || jsonb_build_object('idempotent_replay', false);
end;
$$;

create or replace function workspace_private.cleanup_professional_context_confirmations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
  deleted_count integer;
  grant_count integer;
  retention_days integer;
begin
  update workspace_private.professional_context_confirmation_requests
  set status = 'expired', normalized_payload = null, target_state_snapshot = null,
    terminal_reason_code = 'expired', terminal_at = now(), payload_cleared_at = now(), updated_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics expired_count = row_count;
  select greatest(1, least(365, setting_value::integer)) into retention_days
  from workspace_private.product_settings
  where setting_key = 'professional_context_confirmation_metadata_retention_days';
  delete from workspace_private.professional_context_confirmation_requests
  where status <> 'pending'
    and terminal_at < now() - make_interval(days => coalesce(retention_days, 30));
  get diagnostics deleted_count = row_count;
  delete from workspace_private.professional_context_read_grants
  where coalesce(revoked_at, expires_at) < now() - interval '30 days';
  get diagnostics grant_count = row_count;
  return jsonb_build_object(
    'expired_payloads_cleared', expired_count,
    'metadata_deleted', deleted_count,
    'stale_grants_deleted', grant_count
  );
end;
$$;

create or replace function workspace_private.professional_context_cleanup_schedule_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  named_jobs integer := 0;
  matching_jobs integer := 0;
begin
  if to_regclass('cron.job') is null then
    return jsonb_build_object(
      'ready', false,
      'scheduler_available', false,
      'reason', 'scheduler_unavailable',
      'expected_job_name', 'workspace-professional-context-confirmation-cleanup',
      'expected_schedule', '*/15 * * * *',
      'expected_command', 'select workspace_private.cleanup_professional_context_confirmations()'
    );
  end if;
  execute $query$
    select
      count(*) filter (where jobname = 'workspace-professional-context-confirmation-cleanup')::integer,
      count(*) filter (
        where jobname = 'workspace-professional-context-confirmation-cleanup'
          and schedule = '*/15 * * * *'
          and trim(trailing ';' from trim(command)) = 'select workspace_private.cleanup_professional_context_confirmations()'
          and active
      )::integer
    from cron.job
  $query$ into named_jobs, matching_jobs;
  return jsonb_build_object(
    'ready', named_jobs = 1 and matching_jobs = 1,
    'scheduler_available', true,
    'reason', case
      when named_jobs = 0 then 'cleanup_job_missing'
      when named_jobs <> 1 then 'cleanup_job_duplicate'
      when matching_jobs <> 1 then 'cleanup_job_misconfigured'
      else 'ready'
    end,
    'named_job_count', named_jobs,
    'matching_job_count', matching_jobs,
    'expected_job_name', 'workspace-professional-context-confirmation-cleanup',
    'expected_schedule', '*/15 * * * *',
    'expected_command', 'select workspace_private.cleanup_professional_context_confirmations()'
  );
end;
$$;

create or replace function workspace_private.ensure_professional_context_cleanup_schedule()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  schedule_status jsonb;
  job_record record;
begin
  schedule_status := workspace_private.professional_context_cleanup_schedule_status();
  if not coalesce((schedule_status ->> 'scheduler_available')::boolean, false)
    or coalesce((schedule_status ->> 'ready')::boolean, false) then
    return schedule_status;
  end if;
  for job_record in execute $query$
    select jobid from cron.job
    where jobname = 'workspace-professional-context-confirmation-cleanup'
    order by jobid
  $query$
  loop
    execute 'select cron.unschedule($1)' using job_record.jobid;
  end loop;
  execute $schedule$
    select cron.schedule(
      'workspace-professional-context-confirmation-cleanup',
      '*/15 * * * *',
      'select workspace_private.cleanup_professional_context_confirmations()'
    )
  $schedule$;
  return workspace_private.professional_context_cleanup_schedule_status();
end;
$$;

revoke all on function workspace_private.context_record_snapshot(uuid, text, uuid) from public, anon, authenticated;
revoke all on function workspace_private.context_confirmation_target_snapshot(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function workspace_private.context_confirmation_public_status(workspace_private.professional_context_confirmation_requests) from public, anon, authenticated;
revoke all on function workspace_private.create_professional_context_confirmation(uuid, text, text, uuid, jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function workspace_private.materialize_professional_context_confirmation(uuid) from public, anon, authenticated;
revoke all on function workspace_private.require_direct_context_user() from public, anon, authenticated;
revoke all on function workspace_private.cleanup_professional_context_confirmations() from public, anon, authenticated;
revoke all on function workspace_private.professional_context_cleanup_schedule_status() from public, anon, authenticated;
revoke all on function workspace_private.ensure_professional_context_cleanup_schedule() from public, anon, authenticated;

revoke all on function workspace.mcp_get_context_confirmation_status(uuid) from public, anon, authenticated;
revoke all on function workspace.get_professional_context_confirmation(uuid) from public, anon, authenticated;
revoke all on function workspace.deny_professional_context_confirmation(uuid) from public, anon, authenticated;
revoke all on function workspace.confirm_and_execute_professional_context(uuid, text, text) from public, anon, authenticated;
grant execute on function workspace.mcp_get_context_confirmation_status(uuid) to authenticated;
grant execute on function workspace.get_professional_context_confirmation(uuid) to authenticated;
grant execute on function workspace.deny_professional_context_confirmation(uuid) to authenticated;
grant execute on function workspace.confirm_and_execute_professional_context(uuid, text, text) to authenticated;

-- Scheduling is reconciled when pg_cron is present. Absence remains usable for
-- local development but is reported as NOT READY by the release preflight.
select workspace_private.ensure_professional_context_cleanup_schedule();

comment on function workspace_private.materialize_professional_context_confirmation(uuid) is
  'Atomically persists terminal invalidation and clears transient protected confirmation state without granting mutation or preview authority.';
comment on function workspace_private.professional_context_cleanup_schedule_status() is
  'Read-only release-readiness evidence for the required <=15-minute Professional Context cleanup schedule.';
