-- P2 Phase B2: direct-session confirmation authority and protected-read grants.
-- Normal candidates remain autonomous. Protected candidates and every governed
-- Professional Context mutation are executed only by a direct Workspace session.

insert into workspace_private.product_settings (setting_key, setting_value)
values
  ('professional_context_confirmation_metadata_retention_days', '30'),
  ('professional_context_confirmation_cleanup_minutes', '15')
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  updated_at = now();

create table workspace_private.professional_context_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  mcp_authorization_id uuid not null references workspace.mcp_authorizations(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 500),
  authorization_valid_after timestamptz,
  logical_request_id uuid not null,
  action_type text not null check (action_type in (
    'propose_private', 'propose_sensitive',
    'approve', 'correct', 'reject', 'supersede',
    'link', 'promote', 'archive', 'delete'
  )),
  primary_target_type text not null check (primary_target_type in ('candidate', 'context', 'proposal')),
  primary_target_id uuid,
  contract_version text not null default 'professional-context-confirmation-v1'
    check (contract_version = 'professional-context-confirmation-v1'),
  normalized_payload jsonb,
  requested_payload_fingerprint text not null check (requested_payload_fingerprint ~ '^[0-9a-f]{64}$'),
  target_state_snapshot jsonb,
  target_state_fingerprint text not null check (target_state_fingerprint ~ '^[0-9a-f]{64}$'),
  final_payload_fingerprint text check (final_payload_fingerprint is null or final_payload_fingerprint ~ '^[0-9a-f]{64}$'),
  contains_private boolean not null default false,
  contains_sensitive boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'denied', 'stale', 'expired', 'revoked')),
  result_reference jsonb,
  user_edited_fields text[] not null default '{}',
  terminal_reason_code text check (terminal_reason_code is null or terminal_reason_code in (
    'user_denied', 'target_changed', 'expired', 'authorization_changed',
    'capability_unavailable', 'user_revoked'
  )),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  completed_by uuid references auth.users(id) on delete restrict,
  completed_at timestamptz,
  terminal_by uuid references auth.users(id) on delete restrict,
  terminal_at timestamptz,
  payload_cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, mcp_authorization_id, logical_request_id),
  check (expires_at > requested_at),
  check ((action_type in ('propose_private', 'propose_sensitive')) = (primary_target_type = 'proposal')),
  check ((primary_target_type = 'proposal') = (primary_target_id is null)),
  check (
    (status = 'pending' and normalized_payload is not null and target_state_snapshot is not null
      and result_reference is null and completed_at is null and terminal_at is null and payload_cleared_at is null)
    or
    (status = 'completed' and normalized_payload is null and target_state_snapshot is null
      and result_reference is not null and completed_by is not null and completed_at is not null
      and terminal_at is not null and payload_cleared_at is not null)
    or
    (status in ('denied', 'stale', 'expired', 'revoked')
      and normalized_payload is null and target_state_snapshot is null and result_reference is null
      and terminal_reason_code is not null and terminal_at is not null and payload_cleared_at is not null)
  )
);

create index professional_context_confirmation_pending_idx
  on workspace_private.professional_context_confirmation_requests (expires_at)
  where status = 'pending';
create index professional_context_confirmation_metadata_idx
  on workspace_private.professional_context_confirmation_requests (terminal_at)
  where status <> 'pending';

create table workspace_private.professional_context_read_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  mcp_authorization_id uuid not null references workspace.mcp_authorizations(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 500),
  authorization_valid_after timestamptz,
  privacy_scope text not null check (privacy_scope in ('private', 'sensitive')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check ((revoked_at is null) = (revoked_by is null))
);

create index professional_context_read_grants_lookup_idx
  on workspace_private.professional_context_read_grants (
    workspace_id, user_id, mcp_authorization_id, client_id, privacy_scope, expires_at
  ) where revoked_at is null;

alter table workspace_private.professional_context_confirmation_requests enable row level security;
alter table workspace_private.professional_context_read_grants enable row level security;
revoke all on table workspace_private.professional_context_confirmation_requests from public, anon, authenticated;
revoke all on table workspace_private.professional_context_read_grants from public, anon, authenticated;

create or replace function workspace_private.invalidate_professional_context_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'connected'
    or new.authorization_valid_after is distinct from old.authorization_valid_after
    or new.client_id is distinct from old.client_id then
    update workspace_private.professional_context_confirmation_requests
    set status = 'revoked', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = 'authorization_changed', terminal_at = now(),
      payload_cleared_at = now(), updated_at = now()
    where mcp_authorization_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_professional_context_authority_on_mcp_change
  on workspace.mcp_authorizations;
create trigger invalidate_professional_context_authority_on_mcp_change
after update of status, authorization_valid_after, client_id on workspace.mcp_authorizations
for each row
when (
  old.status is distinct from new.status
  or old.authorization_valid_after is distinct from new.authorization_valid_after
  or old.client_id is distinct from new.client_id
)
execute function workspace_private.invalidate_professional_context_authority();

create or replace function workspace_private.context_confirmation_fingerprint(
  fingerprint_domain text,
  fingerprint_value jsonb
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(extensions.digest(
    convert_to('lead-emergence:' || fingerprint_domain || ':v1' || chr(10) || fingerprint_value::text, 'UTF8'),
    'sha256'
  ), 'hex');
$$;

create or replace function workspace_private.lock_professional_context(target_workspace_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_workspace_id::text || ':professional-context', 0)
  );
$$;

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
  snapshot jsonb;
begin
  if target_record_id is null then
    return null;
  end if;
  case target_record_type
    when 'task' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.tasks as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'commitment' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.commitments as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'meeting' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.meetings as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'decision' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.decisions as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'capture' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.capture_inbox as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'job_application' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.job_applications as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    when 'memory_entry' then select to_jsonb(record) - array['workspace_id', 'created_by'] into snapshot from workspace.memory_entries as record where record.id = target_record_id and record.workspace_id = target_workspace_id;
    else return null;
  end case;
  return snapshot;
end;
$$;

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
    'status', case
      when request_record.status = 'pending' and request_record.expires_at <= now() then 'expired'
      when request_record.status = 'pending' and not exists (
        select 1 from workspace.mcp_authorizations as auth_record
        where auth_record.id = request_record.mcp_authorization_id
          and auth_record.workspace_id = request_record.workspace_id
          and auth_record.created_by = request_record.user_id
          and auth_record.client_id = request_record.client_id
          and auth_record.status = 'connected'
          and auth_record.authorization_valid_after is not distinct from request_record.authorization_valid_after
      ) then 'revoked'
      else request_record.status
    end,
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

create or replace function workspace_private.mcp_context_privacy_allowed(
  target_workspace_id uuid,
  target_privacy_level text,
  requested_privacy_scopes text[] default '{}'::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_privacy_level = 'normal' then true
    when target_privacy_level not in ('private', 'sensitive') then false
    when not target_privacy_level = any(coalesce(requested_privacy_scopes, '{}'::text[])) then false
    else exists (
      select 1
      from workspace_private.professional_context_read_grants as grant_record
      join workspace.mcp_authorizations as auth_record
        on auth_record.id = grant_record.mcp_authorization_id
      where grant_record.workspace_id = target_workspace_id
        and grant_record.user_id = auth.uid()
        and grant_record.client_id = nullif(auth.jwt() ->> 'client_id', '')
        and grant_record.privacy_scope = target_privacy_level
        and grant_record.revoked_at is null
        and grant_record.expires_at > now()
        and auth_record.workspace_id = grant_record.workspace_id
        and auth_record.created_by = grant_record.user_id
        and auth_record.client_id = grant_record.client_id
        and auth_record.status = 'connected'
        and auth_record.authorization_valid_after is not distinct from grant_record.authorization_valid_after
    )
  end;
$$;

create or replace function workspace.create_professional_context_read_grant(
  target_client_id text,
  target_privacy_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  authorization_record workspace.mcp_authorizations%rowtype;
  grant_record workspace_private.professional_context_read_grants%rowtype;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  if target_privacy_scope not in ('private', 'sensitive') then
    raise exception 'A private or sensitive read scope is required.' using errcode = '22023';
  end if;
  select workspace_record.id into target_workspace_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner' and membership.status = 'active'
  limit 1;
  if target_workspace_id is null
    or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
    raise exception 'Professional Context is not available for this Workspace.' using errcode = '42501';
  end if;
  select * into authorization_record from workspace.mcp_authorizations as auth_record
  where auth_record.workspace_id = target_workspace_id
    and auth_record.created_by = auth.uid()
    and auth_record.client_id = target_client_id
    and auth_record.status = 'connected';
  if not found then
    raise exception 'This assistant connection is not authorized.' using errcode = '42501';
  end if;

  update workspace_private.professional_context_read_grants as prior_grant
  set revoked_at = now(), revoked_by = auth.uid()
  where prior_grant.workspace_id = target_workspace_id
    and prior_grant.user_id = auth.uid()
    and prior_grant.mcp_authorization_id = authorization_record.id
    and prior_grant.client_id = authorization_record.client_id
    and prior_grant.privacy_scope = target_privacy_scope
    and prior_grant.revoked_at is null
    and prior_grant.expires_at > now();

  insert into workspace_private.professional_context_read_grants (
    workspace_id, user_id, mcp_authorization_id, client_id,
    authorization_valid_after, privacy_scope, expires_at
  ) values (
    target_workspace_id, auth.uid(), authorization_record.id, authorization_record.client_id,
    authorization_record.authorization_valid_after, target_privacy_scope,
    now() + case when target_privacy_scope = 'private' then interval '10 minutes' else interval '5 minutes' end
  ) returning * into grant_record;

  return jsonb_build_object(
    'grant_id', grant_record.id,
    'client_id', grant_record.client_id,
    'privacy_scope', grant_record.privacy_scope,
    'issued_at', grant_record.issued_at,
    'expires_at', grant_record.expires_at,
    'status', 'active'
  );
end;
$$;

create or replace function workspace.list_professional_context_read_grants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  select id into target_workspace_id from workspace.workspaces
  where owner_user_id = auth.uid() and workspace_type = 'personal' limit 1;
  if target_workspace_id is null then
    raise exception 'Personal Workspace not found.' using errcode = '42501';
  end if;
  return jsonb_build_object('grants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'grant_id', grant_record.id,
      'client_id', grant_record.client_id,
      'privacy_scope', grant_record.privacy_scope,
      'issued_at', grant_record.issued_at,
      'expires_at', grant_record.expires_at,
      'status', case
        when grant_record.revoked_at is not null then 'revoked'
        when grant_record.expires_at <= now() then 'expired'
        when auth_record.status <> 'connected'
          or auth_record.authorization_valid_after is distinct from grant_record.authorization_valid_after then 'revoked'
        else 'active'
      end
    ) order by grant_record.issued_at desc)
    from workspace_private.professional_context_read_grants as grant_record
    join workspace.mcp_authorizations as auth_record on auth_record.id = grant_record.mcp_authorization_id
    where grant_record.workspace_id = target_workspace_id and grant_record.user_id = auth.uid()
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.revoke_professional_context_read_grant(target_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_record workspace_private.professional_context_read_grants%rowtype;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  update workspace_private.professional_context_read_grants as grant_to_revoke
  set revoked_at = coalesce(grant_to_revoke.revoked_at, now()),
      revoked_by = coalesce(grant_to_revoke.revoked_by, auth.uid())
  where grant_to_revoke.id = target_grant_id
    and grant_to_revoke.user_id = auth.uid()
    and exists (
      select 1 from workspace.workspaces as workspace_record
      where workspace_record.id = grant_to_revoke.workspace_id
        and workspace_record.owner_user_id = auth.uid()
        and workspace_record.workspace_type = 'personal'
    )
  returning * into grant_record;
  if not found then
    raise exception 'Protected-read grant not found.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'grant_id', grant_record.id,
    'privacy_scope', grant_record.privacy_scope,
    'status', 'revoked',
    'revoked_at', grant_record.revoked_at
  );
end;
$$;

create or replace function workspace.mcp_submit_context_candidate(
  request_id uuid,
  target_family text,
  proposed_label text,
  proposed_summary text,
  proposed_tier text default 'working',
  target_privacy_level text default 'normal',
  target_source_type text default 'inferred',
  target_source_reference text default null,
  target_observed_at timestamptz default now(),
  target_confidence numeric default 0.5,
  evidence_excerpt text default null,
  target_evidence_role text default 'supporting',
  target_chapter_key text default null,
  target_source_record_type text default null,
  target_source_record_id uuid default null,
  target_conflict_with_entity_id uuid default null,
  target_possible_match_entity_id uuid default null,
  target_retention text default 'retain',
  target_military_sensitivity text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  canonical_payload jsonb;
  proposal_result jsonb;
  related_privacy text;
  normalized_label text := nullif(trim(proposed_label), '');
  normalized_summary text := nullif(trim(proposed_summary), '');
  normalized_source_reference text := nullif(trim(target_source_reference), '');
  normalized_excerpt text := nullif(trim(evidence_excerpt), '');
begin
  if request_id is null then
    raise exception 'A request identifier is required for context proposals.' using errcode = '22023';
  end if;
  if target_retention is null or target_retention not in ('retain', 'do_not_retain')
    or target_military_sensitivity is null
    or target_military_sensitivity not in ('none', 'suspected_classified', 'suspected_cui', 'operationally_sensitive') then
    raise exception 'Context retention or military sensitivity is invalid.' using errcode = '22023';
  end if;
  if target_retention = 'do_not_retain' or target_military_sensitivity <> 'none' then
    return jsonb_build_object(
      'outcome', 'refused',
      'retained', false,
      'reason', case when target_retention = 'do_not_retain'
        then 'do_not_retain' else 'military_sensitive_content_not_accepted' end
    );
  end if;
  if target_privacy_level is null or target_privacy_level not in ('normal', 'private', 'sensitive') then
    raise exception 'Context privacy classification is invalid.' using errcode = '22023';
  end if;
  if target_family is null or target_family not in (
    'professional_identity', 'strength', 'skill', 'work_preference', 'communication_preference',
    'goal', 'career_direction', 'target_function', 'target_industry', 'target_role',
    'decision_criterion', 'career_hypothesis', 'person', 'organization', 'relationship',
    'opportunity', 'accomplishment', 'responsibility', 'story_bank', 'coaching_guidance',
    'feedback', 'lesson', 'assumption', 'context_gap'
  ) or normalized_label is null or char_length(normalized_label) > 240
    or normalized_summary is null or char_length(normalized_summary) > 5000
    or proposed_tier is null or proposed_tier not in ('working', 'chapter', 'core')
    or target_source_type is null
    or target_source_type not in ('user_supplied', 'connector', 'workflow', 'inferred', 'legacy_memory')
    or target_evidence_role is null or target_evidence_role not in ('supporting', 'contradicting')
    or target_confidence is null or target_confidence not between 0 and 1
    or target_observed_at is null
    or char_length(normalized_source_reference) > 500
    or char_length(normalized_excerpt) > 2000
    or (target_chapter_key is not null and target_chapter_key !~ '^[a-z][a-z0-9_]{2,63}$') then
    raise exception 'Context proposal content or classification is invalid.' using errcode = '22023';
  end if;
  if proposed_tier = 'chapter' and target_chapter_key is null then
    raise exception 'Chapter context requires a chapter key.' using errcode = '22023';
  end if;
  if target_observed_at > now() + interval '5 minutes' then
    raise exception 'Context cannot be observed in the future.' using errcode = '22023';
  end if;
  if (target_source_record_type is null) <> (target_source_record_id is null) then
    raise exception 'A source record type and identifier must be supplied together.' using errcode = '22023';
  end if;
  if target_source_record_id is not null and not workspace_private.context_record_belongs_to_workspace(
    target_workspace_id, target_source_record_type, target_source_record_id
  ) then
    raise exception 'The source record does not belong to this Workspace.' using errcode = '42501';
  end if;
  if target_conflict_with_entity_id is not null and not exists (
    select 1 from workspace.professional_context_entities
    where id = target_conflict_with_entity_id and workspace_id = target_workspace_id
      and lifecycle_status = 'active'
  ) then
    raise exception 'The conflicting context does not belong to this Workspace.' using errcode = '42501';
  end if;
  if target_possible_match_entity_id is not null and not exists (
    select 1 from workspace.professional_context_entities
    where id = target_possible_match_entity_id and workspace_id = target_workspace_id
      and lifecycle_status = 'active'
  ) then
    raise exception 'The possible context match does not belong to this Workspace.' using errcode = '42501';
  end if;

  canonical_payload := jsonb_strip_nulls(jsonb_build_object(
    'request_id', request_id,
    'family', trim(target_family),
    'label', normalized_label,
    'summary', normalized_summary,
    'tier', proposed_tier,
    'privacy', target_privacy_level,
    'source_type', target_source_type,
    'source_reference', normalized_source_reference,
    'observed_at', target_observed_at,
    'confidence', target_confidence,
    'evidence_excerpt', normalized_excerpt,
    'evidence_role', target_evidence_role,
    'chapter_key', target_chapter_key,
    'source_record_type', target_source_record_type,
    'source_record_id', target_source_record_id,
    'conflict_with_entity_id', target_conflict_with_entity_id,
    'possible_match_entity_id', target_possible_match_entity_id
  ));

  if target_privacy_level = 'normal' then
    select privacy_level into related_privacy
    from workspace.professional_context_entities
    where workspace_id = target_workspace_id
      and id in (target_conflict_with_entity_id, target_possible_match_entity_id)
      and privacy_level in ('private', 'sensitive')
    limit 1;
    if found then
      raise exception 'Protected related context cannot be persisted through the normal candidate path.' using errcode = '42501';
    end if;
    perform workspace_private.lock_professional_context(target_workspace_id);
    proposal_result := workspace.mcp_propose_context_candidate(
      request_id, target_family, proposed_label, proposed_summary, proposed_tier,
      target_privacy_level, target_source_type, target_source_reference,
      target_observed_at, target_confidence, evidence_excerpt, target_evidence_role,
      target_chapter_key, target_source_record_type, target_source_record_id,
      target_conflict_with_entity_id, target_possible_match_entity_id,
      target_retention, target_military_sensitivity
    );
    return jsonb_build_object('outcome', 'candidate_created') || proposal_result;
  end if;

  return workspace_private.create_professional_context_confirmation(
    request_id,
    case when target_privacy_level = 'private' then 'propose_private' else 'propose_sensitive' end,
    'proposal', null, canonical_payload,
    target_privacy_level = 'private', target_privacy_level = 'sensitive'
  );
end;
$$;

create or replace function workspace.mcp_request_context_review(
  target_candidate_id uuid,
  target_decision text,
  request_id uuid,
  corrected_label text default null,
  corrected_summary text default null,
  review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  candidate_record workspace.context_candidates%rowtype;
  canonical_payload jsonb;
  contains_private boolean := false;
  contains_sensitive boolean := false;
begin
  if target_candidate_id is null or request_id is null or target_decision is null
    or target_decision not in ('approve', 'correct', 'reject', 'supersede') then
    raise exception 'A candidate, supported decision, and request identifier are required.' using errcode = '22023';
  end if;
  select * into candidate_record from workspace.context_candidates
  where id = target_candidate_id and workspace_id = target_workspace_id;
  if not found then
    raise exception 'Context candidate not found for this Workspace.' using errcode = '22023';
  end if;
  if not workspace_private.mcp_context_privacy_allowed(
      target_workspace_id, candidate_record.privacy_level, array['private', 'sensitive']::text[]
    ) or exists (
      select 1 from workspace.professional_context_entities as related
      where related.workspace_id = target_workspace_id
        and related.id in (candidate_record.conflict_with_entity_id, candidate_record.possible_match_entity_id)
        and not workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, related.privacy_level, array['private', 'sensitive']::text[]
        )
    ) then
    raise exception 'Context candidate not found for this Workspace.' using errcode = '22023';
  end if;
  if target_decision <> 'correct' and (corrected_label is not null or corrected_summary is not null) then
    raise exception 'Only a correction may include corrected content.' using errcode = '22023';
  end if;
  if target_decision = 'correct' and corrected_label is null and corrected_summary is null then
    raise exception 'A correction must provide a corrected label or summary.' using errcode = '22023';
  end if;
  if target_decision = 'correct'
    and coalesce(nullif(trim(corrected_label), ''), candidate_record.proposed_label) is not distinct from candidate_record.proposed_label
    and coalesce(nullif(trim(corrected_summary), ''), candidate_record.proposed_summary) is not distinct from candidate_record.proposed_summary then
    raise exception 'A correction must make an actual normalized content change.' using errcode = '22023';
  end if;
  if char_length(nullif(trim(corrected_label), '')) > 240
    or char_length(nullif(trim(corrected_summary), '')) > 5000
    or char_length(nullif(trim(review_notes), '')) > 2000 then
    raise exception 'Context review content is too large.' using errcode = '22023';
  end if;
  if candidate_record.status = 'conflict' and target_decision not in ('supersede', 'reject') then
    raise exception 'Conflicting context must be explicitly superseded or rejected.' using errcode = '22023';
  end if;
  if candidate_record.status <> 'conflict' and target_decision = 'supersede' then
    raise exception 'Only a conflict candidate can supersede confirmed context.' using errcode = '22023';
  end if;
  if candidate_record.status not in ('pending', 'conflict') or candidate_record.expires_at <= now() then
    raise exception 'Context candidate is not available for review.' using errcode = '22023';
  end if;

  select
    candidate_record.privacy_level = 'private' or coalesce(bool_or(entity.privacy_level = 'private'), false),
    candidate_record.privacy_level = 'sensitive' or coalesce(bool_or(entity.privacy_level = 'sensitive'), false)
  into contains_private, contains_sensitive
  from workspace.professional_context_entities as entity
  where entity.workspace_id = target_workspace_id
    and entity.id in (candidate_record.conflict_with_entity_id, candidate_record.possible_match_entity_id);

  canonical_payload := jsonb_strip_nulls(jsonb_build_object(
    'request_id', request_id,
    'candidate_id', target_candidate_id,
    'decision', target_decision,
    'corrected_label', nullif(trim(corrected_label), ''),
    'corrected_summary', nullif(trim(corrected_summary), ''),
    'review_notes', nullif(trim(review_notes), '')
  ));
  return workspace_private.create_professional_context_confirmation(
    request_id, target_decision, 'candidate', target_candidate_id,
    canonical_payload, contains_private, contains_sensitive
  );
end;
$$;

create or replace function workspace.mcp_request_context_link(
  source_context_id uuid,
  link_type text,
  request_id uuid,
  target_context_id uuid default null,
  target_record_type text default null,
  target_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  canonical_payload jsonb;
  contains_private boolean;
  contains_sensitive boolean;
begin
  if source_context_id is null or request_id is null or link_type is null
    or link_type not in ('related_to', 'supports', 'contradicts', 'about', 'applies_to', 'derived_from', 'fulfilled_by')
    or (target_context_id is not null)::integer + (target_record_id is not null)::integer <> 1
    or ((target_record_type is null) <> (target_record_id is null)) then
    raise exception 'A supported source, target, link, and request identifier are required.' using errcode = '22023';
  end if;
  if not exists (select 1 from workspace.professional_context_entities
    where id = source_context_id and workspace_id = target_workspace_id and lifecycle_status <> 'deleted')
    or (target_context_id is not null and not exists (
      select 1 from workspace.professional_context_entities
      where id = target_context_id and workspace_id = target_workspace_id and lifecycle_status <> 'deleted'
    ))
    or (target_record_id is not null and not workspace_private.context_record_belongs_to_workspace(
      target_workspace_id, target_record_type, target_record_id
    )) then
    raise exception 'Context link target is not available for this Workspace.' using errcode = '22023';
  end if;
  if exists (
    select 1 from workspace.professional_context_entities as linked_entity
    where linked_entity.workspace_id = target_workspace_id
      and linked_entity.id in (source_context_id, target_context_id)
      and not workspace_private.mcp_context_privacy_allowed(
        target_workspace_id, linked_entity.privacy_level, array['private', 'sensitive']::text[]
      )
  ) then
    raise exception 'Context link target is not available for this Workspace.' using errcode = '22023';
  end if;
  select coalesce(bool_or(privacy_level = 'private'), false),
         coalesce(bool_or(privacy_level = 'sensitive'), false)
    into contains_private, contains_sensitive
  from workspace.professional_context_entities
  where workspace_id = target_workspace_id and id in (source_context_id, target_context_id);
  canonical_payload := jsonb_strip_nulls(jsonb_build_object(
    'request_id', request_id, 'context_id', source_context_id,
    'link_type', link_type, 'target_context_id', target_context_id,
    'target_record_type', target_record_type, 'target_record_id', target_record_id
  ));
  return workspace_private.create_professional_context_confirmation(
    request_id, 'link', 'context', source_context_id,
    canonical_payload, contains_private, contains_sensitive
  );
end;
$$;

create or replace function workspace.mcp_request_context_management(
  target_entity_id uuid,
  target_action text,
  request_id uuid,
  target_tier text default null,
  target_chapter_key text default null,
  review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  entity_record workspace.professional_context_entities%rowtype;
  canonical_payload jsonb;
begin
  if target_entity_id is null or request_id is null or target_action is null
    or target_action not in ('promote', 'archive', 'delete') then
    raise exception 'A context item, supported action, and request identifier are required.' using errcode = '22023';
  end if;
  select * into entity_record from workspace.professional_context_entities
  where id = target_entity_id and workspace_id = target_workspace_id;
  if not found or entity_record.lifecycle_status = 'deleted' then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;
  if not workspace_private.mcp_context_privacy_allowed(
    target_workspace_id, entity_record.privacy_level, array['private', 'sensitive']::text[]
  ) then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;
  if target_action = 'promote' then
    if target_tier is null or target_tier not in ('chapter', 'core') or entity_record.tier = 'core'
      or (entity_record.tier = 'chapter' and target_tier <> 'core')
      or (target_tier = 'chapter' and target_chapter_key is null)
      or (target_chapter_key is not null and target_chapter_key !~ '^[a-z][a-z0-9_]{2,63}$') then
      raise exception 'Context can only be promoted from Working to Chapter/Core or Chapter to Core.' using errcode = '22023';
    end if;
  elsif target_tier is not null or target_chapter_key is not null then
    raise exception 'Archive and delete do not accept tier changes.' using errcode = '22023';
  end if;
  if char_length(nullif(trim(review_notes), '')) > 2000 then
    raise exception 'Context management notes are too large.' using errcode = '22023';
  end if;
  canonical_payload := jsonb_strip_nulls(jsonb_build_object(
    'request_id', request_id, 'context_id', target_entity_id,
    'action', target_action, 'tier', target_tier,
    'chapter_key', target_chapter_key, 'review_notes', nullif(trim(review_notes), '')
  ));
  return workspace_private.create_professional_context_confirmation(
    request_id, target_action, 'context', target_entity_id,
    canonical_payload,
    entity_record.privacy_level = 'private', entity_record.privacy_level = 'sensitive'
  );
end;
$$;

create or replace function workspace.mcp_get_context_confirmation_status(target_request_id uuid)
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
  current_snapshot jsonb;
begin
  select * into authorization_record from workspace.mcp_authorizations as auth_record
  where auth_record.workspace_id = target_workspace_id
    and auth_record.created_by = auth.uid()
    and auth_record.client_id = token_client_id
    and auth_record.status = 'connected';
  if not found then
    raise exception 'This assistant connection is not authorized.' using errcode = '42501';
  end if;
  perform workspace_private.lock_professional_context(target_workspace_id);
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.workspace_id = target_workspace_id
    and confirmation.user_id = auth.uid()
    and confirmation.mcp_authorization_id = authorization_record.id
    and confirmation.client_id = token_client_id
  for update;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  if request_record.status = 'pending' and request_record.expires_at <= now() then
    update workspace_private.professional_context_confirmation_requests
    set status = 'expired', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = 'expired', terminal_at = now(), payload_cleared_at = now(), updated_at = now()
    where id = request_record.id returning * into request_record;
  elsif request_record.status = 'pending'
    and authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after then
    update workspace_private.professional_context_confirmation_requests
    set status = 'revoked', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = 'authorization_changed', terminal_at = now(), payload_cleared_at = now(), updated_at = now()
    where id = request_record.id returning * into request_record;
  elsif request_record.status = 'pending' then
    current_snapshot := workspace_private.context_confirmation_target_snapshot(
      request_record.workspace_id, request_record.action_type, request_record.normalized_payload
    );
    if workspace_private.context_confirmation_fingerprint(
      'target-state:' || request_record.action_type, current_snapshot
    ) <> request_record.target_state_fingerprint then
      update workspace_private.professional_context_confirmation_requests
      set status = 'stale', normalized_payload = null, target_state_snapshot = null,
        terminal_reason_code = 'target_changed', terminal_at = now(), payload_cleared_at = now(), updated_at = now()
      where id = request_record.id returning * into request_record;
    end if;
  end if;
  return workspace_private.context_confirmation_public_status(request_record);
end;
$$;

create or replace function workspace_private.require_direct_context_workspace()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  select workspace_record.id into target_workspace_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if target_workspace_id is null then
    raise exception 'Personal Workspace not found.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.get_professional_context_confirmation(target_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  authorization_record workspace.mcp_authorizations%rowtype;
  current_snapshot jsonb;
  effective_status text;
begin
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.workspace_id = target_workspace_id
    and confirmation.user_id = auth.uid();
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  effective_status := request_record.status;
  if effective_status = 'pending' and request_record.expires_at <= now() then
    effective_status := 'expired';
  end if;
  if effective_status = 'pending' then
    select * into authorization_record from workspace.mcp_authorizations
    where id = request_record.mcp_authorization_id
      and workspace_id = request_record.workspace_id
      and created_by = request_record.user_id
      and client_id = request_record.client_id;
    if not found or authorization_record.status <> 'connected'
      or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after
      or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
      effective_status := 'revoked';
    end if;
  end if;
  if effective_status = 'pending' then
    current_snapshot := workspace_private.context_confirmation_target_snapshot(
      request_record.workspace_id, request_record.action_type, request_record.normalized_payload
    );
    if workspace_private.context_confirmation_fingerprint(
      'target-state:' || request_record.action_type, current_snapshot
    ) <> request_record.target_state_fingerprint then
      effective_status := 'stale';
    end if;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'confirmation_request_id', request_record.id,
    'status', effective_status,
    'action', request_record.action_type,
    'requested_at', request_record.requested_at,
    'expires_at', request_record.expires_at,
    'operation', case when effective_status = 'pending' then request_record.normalized_payload else null end,
    'reviewed_state', case when effective_status = 'pending' then request_record.target_state_snapshot else null end,
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
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  authorization_record workspace.mcp_authorizations%rowtype;
  current_snapshot jsonb;
  next_status text := 'denied';
  reason_code text := 'user_denied';
begin
  perform workspace_private.lock_professional_context(target_workspace_id);
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.workspace_id = target_workspace_id
    and confirmation.user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  if request_record.status <> 'pending' then
    return workspace_private.context_confirmation_public_status(request_record);
  end if;
  if request_record.expires_at <= now() then
    next_status := 'expired'; reason_code := 'expired';
  else
    select * into authorization_record from workspace.mcp_authorizations
    where id = request_record.mcp_authorization_id
      and workspace_id = request_record.workspace_id
      and created_by = request_record.user_id
      and client_id = request_record.client_id;
    if not found or authorization_record.status <> 'connected'
      or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after
      or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
      next_status := 'revoked';
      reason_code := case
        when not found or authorization_record.status <> 'connected'
          or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after
          then 'authorization_changed'
        else 'capability_unavailable'
      end;
    else
      current_snapshot := workspace_private.context_confirmation_target_snapshot(
        request_record.workspace_id, request_record.action_type, request_record.normalized_payload
      );
      if workspace_private.context_confirmation_fingerprint(
        'target-state:' || request_record.action_type, current_snapshot
      ) <> request_record.target_state_fingerprint then
        next_status := 'stale'; reason_code := 'target_changed';
      end if;
    end if;
  end if;
  update workspace_private.professional_context_confirmation_requests
  set status = next_status, normalized_payload = null, target_state_snapshot = null,
    terminal_reason_code = reason_code, terminal_by = auth.uid(), terminal_at = now(),
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
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  direct_user_id uuid := auth.uid();
  direct_claims jsonb := auth.jwt();
  request_record workspace_private.professional_context_confirmation_requests%rowtype;
  authorization_record workspace.mcp_authorizations%rowtype;
  current_snapshot jsonb;
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
  perform workspace_private.lock_professional_context(target_workspace_id);
  select * into request_record
  from workspace_private.professional_context_confirmation_requests as confirmation
  where confirmation.id = target_request_id
    and confirmation.workspace_id = target_workspace_id
    and confirmation.user_id = direct_user_id
  for update;
  if not found then
    raise exception 'Confirmation request not found.' using errcode = '22023';
  end if;
  if request_record.status = 'completed' then
    return workspace_private.context_confirmation_public_status(request_record)
      || jsonb_build_object('idempotent_replay', true);
  end if;
  if request_record.status <> 'pending' then
    return workspace_private.context_confirmation_public_status(request_record);
  end if;
  if request_record.expires_at <= now() then
    update workspace_private.professional_context_confirmation_requests
    set status = 'expired', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = 'expired', terminal_by = direct_user_id, terminal_at = now(),
      payload_cleared_at = now(), updated_at = now()
    where id = request_record.id returning * into request_record;
    return workspace_private.context_confirmation_public_status(request_record);
  end if;
  select * into authorization_record from workspace.mcp_authorizations
  where id = request_record.mcp_authorization_id
    and workspace_id = request_record.workspace_id
    and created_by = request_record.user_id
    and client_id = request_record.client_id;
  if not found or authorization_record.status <> 'connected'
    or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after
    or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
    update workspace_private.professional_context_confirmation_requests
    set status = 'revoked', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = case when authorization_record.id is null
        or authorization_record.status <> 'connected'
        or authorization_record.authorization_valid_after is distinct from request_record.authorization_valid_after
        then 'authorization_changed' else 'capability_unavailable' end,
      terminal_by = direct_user_id, terminal_at = now(), payload_cleared_at = now(), updated_at = now()
    where id = request_record.id returning * into request_record;
    return workspace_private.context_confirmation_public_status(request_record);
  end if;

  current_snapshot := workspace_private.context_confirmation_target_snapshot(
    request_record.workspace_id, request_record.action_type, request_record.normalized_payload
  );
  if workspace_private.context_confirmation_fingerprint(
    'target-state:' || request_record.action_type, current_snapshot
  ) <> request_record.target_state_fingerprint then
    update workspace_private.professional_context_confirmation_requests
    set status = 'stale', normalized_payload = null, target_state_snapshot = null,
      terminal_reason_code = 'target_changed', terminal_by = direct_user_id, terminal_at = now(),
      payload_cleared_at = now(), updated_at = now()
    where id = request_record.id returning * into request_record;
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
    bounded_result_reference := jsonb_strip_nulls(jsonb_build_object(
      'kind', 'candidate', 'candidate_id', mutation_result #>> '{candidate,id}'
    ));
  elsif request_record.action_type in ('approve', 'correct', 'reject', 'supersede') then
    mutation_result := workspace.mcp_review_context_candidate_protected(
      (final_payload ->> 'candidate_id')::uuid, final_payload ->> 'decision',
      (final_payload ->> 'request_id')::uuid, null,
      final_payload ->> 'corrected_label', final_payload ->> 'corrected_summary', null,
      final_payload ->> 'review_notes', true
    );
    bounded_result_reference := jsonb_strip_nulls(jsonb_build_object(
      'kind', 'context_review', 'candidate_id', mutation_result ->> 'candidate_id',
      'context_id', mutation_result #>> '{context,id}', 'decision', mutation_result ->> 'decision',
      'superseded_context_id', mutation_result ->> 'superseded_context_id'
    ));
  elsif request_record.action_type = 'link' then
    mutation_result := workspace.mcp_link_professional_context_protected(
      (final_payload ->> 'context_id')::uuid, final_payload ->> 'link_type',
      (final_payload ->> 'request_id')::uuid,
      nullif(final_payload ->> 'target_context_id', '')::uuid,
      final_payload ->> 'target_record_type', nullif(final_payload ->> 'target_record_id', '')::uuid,
      true
    );
    bounded_result_reference := jsonb_build_object(
      'kind', 'context_link', 'link_id', mutation_result #>> '{link,id}'
    );
  else
    mutation_result := workspace.mcp_manage_professional_context_protected(
      (final_payload ->> 'context_id')::uuid, final_payload ->> 'action',
      (final_payload ->> 'request_id')::uuid, final_payload ->> 'tier',
      final_payload ->> 'chapter_key', final_payload ->> 'review_notes', true
    );
    bounded_result_reference := jsonb_build_object(
      'kind', 'professional_context', 'context_id', mutation_result #>> '{context,id}',
      'action', mutation_result ->> 'action'
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
  return jsonb_build_object('expired_payloads_cleared', expired_count, 'metadata_deleted', deleted_count);
end;
$$;

create or replace function workspace.mcp_list_professional_context_granted(
  target_purpose text default 'all',
  target_tiers text[] default array['chapter', 'core']::text[],
  requested_privacy_scopes text[] default '{}'::text[],
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
begin
  if target_purpose not in ('all', 'profile', 'direction', 'relationships', 'work', 'learning')
    or target_tiers is null or not target_tiers <@ array['working', 'chapter', 'core']::text[]
    or array_length(target_tiers, 1) is null
    or not coalesce(requested_privacy_scopes, '{}'::text[]) <@ array['private', 'sensitive']::text[]
    or cardinality(coalesce(requested_privacy_scopes, '{}'::text[])) > 2
    or page_size not between 1 and 50 then
    raise exception 'Context retrieval filters are invalid.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'context', coalesce((
      select jsonb_agg(workspace_private.context_entity_payload(entity_record)
        order by entity_record.updated_at desc, entity_record.id desc)
      from (
        select entity.*
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id
          and entity.lifecycle_status = 'active'
          and entity.tier = any(target_tiers)
          and (entity.tier <> 'working' or entity.expires_at > now())
          and workspace_private.mcp_context_privacy_allowed(
            target_workspace_id, entity.privacy_level, requested_privacy_scopes
          )
          and case target_purpose
            when 'profile' then entity.entity_family in ('professional_identity', 'strength', 'skill', 'work_preference', 'communication_preference')
            when 'direction' then entity.entity_family in ('goal', 'career_direction', 'target_function', 'target_industry', 'target_role', 'decision_criterion', 'career_hypothesis')
            when 'relationships' then entity.entity_family in ('person', 'organization', 'relationship')
            when 'work' then entity.entity_family in ('opportunity', 'accomplishment', 'responsibility', 'story_bank')
            when 'learning' then entity.entity_family in ('coaching_guidance', 'feedback', 'lesson', 'assumption', 'context_gap')
            else true
          end
        order by entity.updated_at desc, entity.id desc
        limit page_size
      ) as entity_record
    ), '[]'::jsonb),
    'legacy_memory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', memory.id, 'memory_type', memory.memory_type, 'content', memory.content,
        'domain', memory.domain, 'created_at', memory.created_at,
        'compatibility_source', 'legacy_memory'
      ) order by memory.updated_at desc, memory.id desc)
      from (select * from workspace.memory_entries
        where workspace_id = target_workspace_id and created_by = auth.uid()
        order by updated_at desc, id desc limit page_size) as memory
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_list_context_candidates_granted(
  target_status text default null,
  requested_privacy_scopes text[] default '{}'::text[],
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
begin
  if target_status is not null and target_status not in ('pending', 'conflict', 'confirmed', 'corrected', 'rejected', 'archived') then
    raise exception 'Candidate status is invalid.' using errcode = '22023';
  end if;
  if not coalesce(requested_privacy_scopes, '{}'::text[]) <@ array['private', 'sensitive']::text[]
    or cardinality(coalesce(requested_privacy_scopes, '{}'::text[])) > 2
    or page_size not between 1 and 50 then
    raise exception 'Candidate retrieval filters are invalid.' using errcode = '22023';
  end if;
  return jsonb_build_object('candidates', coalesce((
    select jsonb_agg(to_jsonb(candidate_record) - array[
      'workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'
    ] order by candidate_record.created_at desc, candidate_record.id desc)
    from (
      select candidate.* from workspace.context_candidates as candidate
      where candidate.workspace_id = target_workspace_id
        and (target_status is null or candidate.status = target_status)
        and workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, candidate.privacy_level, requested_privacy_scopes
        )
        and not exists (
          select 1 from workspace.professional_context_entities as related
          where related.workspace_id = target_workspace_id
            and related.id in (candidate.conflict_with_entity_id, candidate.possible_match_entity_id)
            and not workspace_private.mcp_context_privacy_allowed(
              target_workspace_id, related.privacy_level, requested_privacy_scopes
            )
        )
      order by candidate.created_at desc, candidate.id desc limit page_size
    ) as candidate_record
  ), '[]'::jsonb));
end;
$$;

create or replace function workspace.mcp_get_context_provenance_granted(
  target_entity_id uuid,
  requested_privacy_scopes text[] default '{}'::text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  selected_entity workspace.professional_context_entities%rowtype;
begin
  if not coalesce(requested_privacy_scopes, '{}'::text[]) <@ array['private', 'sensitive']::text[]
    or cardinality(coalesce(requested_privacy_scopes, '{}'::text[])) > 2 then
    raise exception 'Protected-context scopes are invalid.' using errcode = '22023';
  end if;
  select * into selected_entity from workspace.professional_context_entities
  where id = target_entity_id and workspace_id = target_workspace_id
    and workspace_private.mcp_context_privacy_allowed(
      target_workspace_id, privacy_level, requested_privacy_scopes
    );
  if not found then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'context', workspace_private.context_entity_payload(selected_entity),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
      'id', evidence.id, 'role', evidence.evidence_role, 'source_type', evidence.source_type,
      'source_reference', evidence.source_reference, 'source_record_type', evidence.source_record_type,
      'source_record_id', evidence.source_record_id, 'observed_at', evidence.observed_at,
      'captured_at', evidence.captured_at, 'excerpt', evidence.excerpt,
      'confidence', evidence.confidence, 'privacy', evidence.privacy_level
    ) order by evidence.captured_at, evidence.id)
      from workspace.context_evidence as evidence
      where evidence.workspace_id = target_workspace_id and evidence.entity_id = selected_entity.id
        and workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, evidence.privacy_level, requested_privacy_scopes
        )), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
      'id', review.id, 'decision', review.decision,
      'previous_tier', review.previous_tier, 'next_tier', review.next_tier,
      'previous_status', review.previous_status, 'next_status', review.next_status,
      'review_notes', review.review_notes, 'reviewed_at', review.reviewed_at
    ) order by review.reviewed_at, review.id)
      from workspace.context_reviews as review
      where review.workspace_id = target_workspace_id
        and (review.entity_id = selected_entity.id or review.resulting_entity_id = selected_entity.id)
        and workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, review.privacy_level, requested_privacy_scopes
        )), '[]'::jsonb),
    'conflicts', coalesce((select jsonb_agg(jsonb_build_object(
      'candidate_id', candidate.id, 'label', candidate.proposed_label,
      'summary', candidate.proposed_summary, 'status', candidate.status,
      'observed_at', candidate.observed_at
    ) order by candidate.observed_at, candidate.id)
      from workspace.context_candidates as candidate
      where candidate.workspace_id = target_workspace_id
        and candidate.conflict_with_entity_id = selected_entity.id
        and workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, candidate.privacy_level, requested_privacy_scopes
        )), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object(
      'id', link.id, 'source_context_id', link.source_entity_id,
      'target_context_id', link.target_entity_id, 'target_record_type', link.target_record_type,
      'target_record_id', link.target_record_id, 'link_type', link.link_type,
      'created_at', link.created_at
    ) order by link.created_at, link.id)
      from workspace.professional_context_links as link
      join workspace.professional_context_entities as source_entity
        on source_entity.id = link.source_entity_id and source_entity.workspace_id = link.workspace_id
      left join workspace.professional_context_entities as target_entity
        on target_entity.id = link.target_entity_id and target_entity.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id
        and (link.source_entity_id = selected_entity.id or link.target_entity_id = selected_entity.id)
        and workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, source_entity.privacy_level, requested_privacy_scopes
        )
        and (target_entity.id is null or workspace_private.mcp_context_privacy_allowed(
          target_workspace_id, target_entity.privacy_level, requested_privacy_scopes
        ))), '[]'::jsonb)
  );
end;
$$;

-- Existing databases need the same qualified delete predicate as fresh replay.
-- The original unqualified target_entity_id collides with the function argument
-- only when the redaction path deletes related links.
create or replace function workspace.mcp_manage_professional_context(
  target_entity_id uuid,
  target_action text,
  request_id uuid,
  target_tier text default null,
  target_chapter_key text default null,
  review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  selected_entity workspace.professional_context_entities%rowtype;
  existing_review workspace.context_reviews%rowtype;
  target_chapter_id uuid;
  review_fingerprint text;
  previous_tier text;
  previous_status text;
begin
  if target_entity_id is null or request_id is null or target_action not in ('promote', 'archive', 'delete') then
    raise exception 'A context item, supported action, and request identifier are required.' using errcode = '22023';
  end if;
  review_fingerprint := workspace_private.context_fingerprint(
    target_entity_id::text, target_action, target_tier, target_chapter_key, review_notes
  );
  select * into existing_review from workspace.context_reviews
  where workspace_id = target_workspace_id and reviewed_by = auth.uid()
    and client_id is not distinct from token_client_id
    and context_reviews.request_id = mcp_manage_professional_context.request_id;
  if found then
    if existing_review.request_fingerprint <> review_fingerprint then
      raise exception 'Reuse a context action request identifier only with the same action.' using errcode = '22023';
    end if;
    select * into selected_entity from workspace.professional_context_entities
    where id = target_entity_id and workspace_id = target_workspace_id;
    return pg_catalog.jsonb_build_object(
      'action', existing_review.decision,
      'context', workspace_private.context_entity_payload(selected_entity),
      'idempotent_replay', true
    );
  end if;

  select * into selected_entity
  from workspace.professional_context_entities
  where id = target_entity_id and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;
  if selected_entity.lifecycle_status = 'deleted' then
    raise exception 'Deleted context cannot be changed.' using errcode = '22023';
  end if;
  previous_tier := selected_entity.tier;
  previous_status := selected_entity.lifecycle_status;

  if target_action = 'promote' then
    if target_tier not in ('chapter', 'core')
      or (selected_entity.tier = 'core')
      or (selected_entity.tier = 'chapter' and target_tier <> 'core') then
      raise exception 'Context can only be promoted from Working to Chapter/Core or Chapter to Core.' using errcode = '22023';
    end if;
    if target_tier = 'chapter' then
      if target_chapter_key is null then
        raise exception 'Chapter promotion requires a chapter key.' using errcode = '22023';
      end if;
      insert into workspace.context_chapters (workspace_id, chapter_key, label, purpose, created_by)
      values (
        target_workspace_id, target_chapter_key, initcap(replace(target_chapter_key, '_', ' ')),
        'Bounded professional chapter for confirmed context.', auth.uid()
      ) on conflict (workspace_id, chapter_key) do update set updated_at = now()
      returning id into target_chapter_id;
    end if;
    update workspace.professional_context_entities
    set tier = target_tier, chapter_id = target_chapter_id, expires_at = null, updated_at = now()
    where id = selected_entity.id returning * into selected_entity;
  elsif target_action = 'archive' then
    update workspace.professional_context_entities
    set lifecycle_status = 'archived', updated_at = now()
    where id = selected_entity.id returning * into selected_entity;
  else
    update workspace.context_evidence
    set excerpt = null, source_reference = null, source_record_type = null, source_record_id = null
    where workspace_id = target_workspace_id and entity_id = selected_entity.id;
    update workspace.context_candidates
    set proposed_label = 'Deleted context candidate', proposed_summary = '[deleted by user]',
      source_reference = null, source_record_type = null, source_record_id = null, updated_at = now()
    where workspace_id = target_workspace_id and confirmed_entity_id = selected_entity.id;
    update workspace.context_reviews
    set review_notes = null
    where workspace_id = target_workspace_id
      and (entity_id = selected_entity.id or resulting_entity_id = selected_entity.id);
    delete from workspace.professional_context_links as link_to_delete
    where link_to_delete.workspace_id = target_workspace_id
      and (link_to_delete.source_entity_id = selected_entity.id
        or link_to_delete.target_entity_id = selected_entity.id);
    update workspace.professional_context_entities
    set label = 'Deleted context', summary = '[deleted by user]', lifecycle_status = 'deleted',
      dedupe_key = workspace_private.context_fingerprint('deleted', selected_entity.id::text),
      chapter_id = null, tier = 'core', expires_at = null, updated_at = now()
    where id = selected_entity.id returning * into selected_entity;
  end if;

  insert into workspace.context_reviews (
    workspace_id, entity_id, decision, previous_tier, next_tier,
    previous_status, next_status, review_notes, resulting_entity_id,
    request_fingerprint, client_id, request_id, reviewed_by
  ) values (
    target_workspace_id, selected_entity.id, target_action,
    previous_tier, selected_entity.tier, previous_status,
    selected_entity.lifecycle_status, nullif(trim(review_notes), ''), selected_entity.id,
    review_fingerprint, token_client_id, request_id, auth.uid()
  );
  return pg_catalog.jsonb_build_object(
    'action', target_action,
    'context', workspace_private.context_entity_payload(selected_entity),
    'idempotent_replay', false
  );
end;
$$;

-- No API role may execute the previous governed mutation functions.
revoke all on function workspace.mcp_propose_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_propose_context_candidate_protected(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_review_context_candidate(
  uuid, text, uuid, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_review_context_candidate_protected(
  uuid, text, uuid, text, text, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_link_professional_context(
  uuid, text, uuid, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function workspace.mcp_link_professional_context_protected(
  uuid, text, uuid, uuid, text, uuid, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_manage_professional_context(
  uuid, text, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_manage_professional_context_protected(
  uuid, text, uuid, text, text, text, boolean
) from public, anon, authenticated;

-- Retire client-attested protected-read entry points.
revoke all on function workspace.mcp_list_professional_context(text, text[], boolean, boolean, integer)
  from public, anon, authenticated;
revoke all on function workspace.mcp_list_context_candidates(text, boolean, boolean, integer)
  from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_provenance_protected(uuid, boolean, boolean)
  from public, anon, authenticated;

revoke all on function workspace_private.context_confirmation_fingerprint(text, jsonb) from public, anon, authenticated;
revoke all on function workspace_private.invalidate_professional_context_authority() from public, anon, authenticated;
revoke all on function workspace_private.lock_professional_context(uuid) from public, anon, authenticated;
revoke all on function workspace_private.context_record_snapshot(uuid, text, uuid) from public, anon, authenticated;
revoke all on function workspace_private.context_confirmation_public_status(workspace_private.professional_context_confirmation_requests) from public, anon, authenticated;
revoke all on function workspace_private.create_professional_context_confirmation(uuid, text, text, uuid, jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function workspace_private.mcp_context_privacy_allowed(uuid, text, text[]) from public, anon, authenticated;
revoke all on function workspace_private.require_direct_context_workspace() from public, anon, authenticated;
revoke all on function workspace_private.cleanup_professional_context_confirmations() from public, anon, authenticated;

revoke all on function workspace.create_professional_context_read_grant(text, text) from public, anon, authenticated;
revoke all on function workspace.list_professional_context_read_grants() from public, anon, authenticated;
revoke all on function workspace.revoke_professional_context_read_grant(uuid) from public, anon, authenticated;
revoke all on function workspace.get_professional_context_confirmation(uuid) from public, anon, authenticated;
revoke all on function workspace.deny_professional_context_confirmation(uuid) from public, anon, authenticated;
revoke all on function workspace.confirm_and_execute_professional_context(uuid, text, text) from public, anon, authenticated;
revoke all on function workspace.mcp_submit_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_request_context_review(uuid, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function workspace.mcp_request_context_link(uuid, text, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function workspace.mcp_request_context_management(uuid, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_confirmation_status(uuid) from public, anon, authenticated;
revoke all on function workspace.mcp_list_professional_context_granted(text, text[], text[], integer) from public, anon, authenticated;
revoke all on function workspace.mcp_list_context_candidates_granted(text, text[], integer) from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_provenance_granted(uuid, text[]) from public, anon, authenticated;

grant execute on function workspace.create_professional_context_read_grant(text, text) to authenticated;
grant execute on function workspace.list_professional_context_read_grants() to authenticated;
grant execute on function workspace.revoke_professional_context_read_grant(uuid) to authenticated;
grant execute on function workspace.get_professional_context_confirmation(uuid) to authenticated;
grant execute on function workspace.deny_professional_context_confirmation(uuid) to authenticated;
grant execute on function workspace.confirm_and_execute_professional_context(uuid, text, text) to authenticated;
grant execute on function workspace.mcp_submit_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) to authenticated;
grant execute on function workspace.mcp_request_context_review(uuid, text, uuid, text, text, text) to authenticated;
grant execute on function workspace.mcp_request_context_link(uuid, text, uuid, uuid, text, uuid) to authenticated;
grant execute on function workspace.mcp_request_context_management(uuid, text, uuid, text, text, text) to authenticated;
grant execute on function workspace.mcp_get_context_confirmation_status(uuid) to authenticated;
grant execute on function workspace.mcp_list_professional_context_granted(text, text[], text[], integer) to authenticated;
grant execute on function workspace.mcp_list_context_candidates_granted(text, text[], integer) to authenticated;
grant execute on function workspace.mcp_get_context_provenance_granted(uuid, text[]) to authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    execute $schedule$
      select cron.schedule(
        'workspace-professional-context-confirmation-cleanup',
        '*/15 * * * *',
        'select workspace_private.cleanup_professional_context_confirmations()'
      )
    $schedule$;
  end if;
end;
$$;

comment on table workspace_private.professional_context_confirmation_requests is
  'Private, non-transferable workflow records. Only a direct Workspace session can atomically execute a pending governed Professional Context operation.';
comment on table workspace_private.professional_context_read_grants is
  'Short-lived, authorization-bound private or sensitive read grants. A grant never authorizes a mutation.';

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
begin
  if target_action in ('propose_private', 'propose_sensitive') then
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
          'dedupe_key', candidate.dedupe_key, 'evidence_fingerprint', candidate.evidence_fingerprint,
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
      'matching_links', coalesce((select jsonb_agg(
        to_jsonb(link) - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint'
        order by link.id
      ) from workspace.professional_context_links as link
        where link.workspace_id = target_workspace_id
          and link.source_entity_id = selected_context_id
          and link.target_entity_id is not distinct from selected_target_entity_id
          and link.target_record_type is not distinct from selected_target_record_type
          and link.target_record_id is not distinct from selected_target_record_id
          and link.link_type = target_payload ->> 'link_type'), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'context', (select to_jsonb(entity) - 'workspace_id' - 'created_by' - 'confirmed_by'
      from workspace.professional_context_entities as entity
      where entity.workspace_id = target_workspace_id and entity.id = selected_context_id),
    'destination_chapter', case when target_action = 'promote' then (
      select to_jsonb(chapter) - 'workspace_id' - 'created_by'
      from workspace.context_chapters as chapter
      where chapter.workspace_id = target_workspace_id
        and chapter.chapter_key = target_payload ->> 'chapter_key'
    ) else null end,
    'affected_evidence', case when target_action = 'delete' then coalesce((
      select jsonb_agg(to_jsonb(evidence) - 'workspace_id' - 'created_by' order by evidence.id)
      from workspace.context_evidence as evidence
      where evidence.workspace_id = target_workspace_id and evidence.entity_id = selected_context_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'affected_candidates', case when target_action = 'delete' then coalesce((
      select jsonb_agg(to_jsonb(candidate) - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint' order by candidate.id)
      from workspace.context_candidates as candidate
      where candidate.workspace_id = target_workspace_id and candidate.confirmed_entity_id = selected_context_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'affected_reviews', case when target_action = 'delete' then coalesce((
      select jsonb_agg(to_jsonb(review) - 'workspace_id' - 'reviewed_by' - 'client_id' - 'request_fingerprint' order by review.id)
      from workspace.context_reviews as review
      where review.workspace_id = target_workspace_id
        and (review.entity_id = selected_context_id or review.resulting_entity_id = selected_context_id)
    ), '[]'::jsonb) else '[]'::jsonb end,
    'affected_links', case when target_action = 'delete' then coalesce((
      select jsonb_agg(to_jsonb(link) - 'workspace_id' - 'created_by' - 'client_id' - 'request_fingerprint' order by link.id)
      from workspace.professional_context_links as link
      where link.workspace_id = target_workspace_id
        and (link.source_entity_id = selected_context_id or link.target_entity_id = selected_context_id)
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke all on function workspace_private.context_confirmation_target_snapshot(uuid, text, jsonb)
  from public, anon, authenticated;
