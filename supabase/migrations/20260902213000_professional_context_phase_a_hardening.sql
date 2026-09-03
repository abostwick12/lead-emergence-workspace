-- P2 hardening Phase A: protected-context retrieval, exact review semantics,
-- and an explicit release gate separating graph availability from P1 bundles.

insert into workspace.bundle_capabilities (bundle_key, capability_key, enabled)
values ('sotf_transition', 'professional_context', false)
on conflict (bundle_key, capability_key) do update set
  enabled = false,
  updated_at = now();

create or replace function workspace_private.is_protected_context_privacy(privacy_level text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select privacy_level in ('private', 'sensitive');
$$;

alter table workspace.context_reviews
  add column if not exists privacy_level text not null default 'normal';
alter table workspace.context_reviews
  drop constraint if exists context_reviews_privacy_level_check;
alter table workspace.context_reviews
  add constraint context_reviews_privacy_level_check
  check (privacy_level in ('normal', 'private', 'sensitive'));

create or replace function workspace_private.enforce_context_review_immutable_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'Context review tenant and reviewer are immutable.';
  end if;
  return new;
end;
$$;

revoke all on function workspace_private.enforce_context_review_immutable_tenancy()
  from public, anon, authenticated;
drop trigger if exists context_reviews_enforce_immutable_tenancy
  on workspace.context_reviews;
create trigger context_reviews_enforce_immutable_tenancy
before update on workspace.context_reviews
for each row execute function workspace_private.enforce_context_review_immutable_tenancy();

update workspace.context_reviews as review
set privacy_level = coalesce(
  (select candidate.privacy_level from workspace.context_candidates as candidate
    where candidate.id = review.candidate_id and candidate.workspace_id = review.workspace_id),
  (select entity.privacy_level from workspace.professional_context_entities as entity
    where entity.id = review.entity_id and entity.workspace_id = review.workspace_id),
  (select resulting.privacy_level from workspace.professional_context_entities as resulting
    where resulting.id = review.resulting_entity_id and resulting.workspace_id = review.workspace_id),
  'normal'
);

-- Retire the Phase A-incompatible public signatures. Hardened entry points use
-- distinct names and delegate to these grant-revoked implementations so their
-- already-tested mutation and idempotency mechanics are preserved.
revoke all on function workspace.mcp_propose_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_review_context_candidate(
  uuid, text, uuid, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_provenance(uuid)
  from public, anon, authenticated;
revoke all on function workspace.mcp_link_professional_context(
  uuid, text, uuid, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function workspace.mcp_manage_professional_context(
  uuid, text, uuid, text, text, text
) from public, anon, authenticated;

create or replace function workspace.mcp_list_professional_context(
  target_purpose text default 'all',
  target_tiers text[] default array['chapter', 'core']::text[],
  include_private boolean default false,
  explicit_private_access boolean default false,
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
    or pg_catalog.array_length(target_tiers, 1) is null
    or page_size not between 1 and 50 then
    raise exception 'Context retrieval filters are invalid.' using errcode = '22023';
  end if;
  if include_private and not explicit_private_access then
    raise exception 'Protected context requires explicit access confirmation.' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'context', coalesce((
      select pg_catalog.jsonb_agg(workspace_private.context_entity_payload(entity_record)
        order by entity_record.updated_at desc, entity_record.id desc)
      from (
        select entity.*
        from workspace.professional_context_entities as entity
        where entity.workspace_id = target_workspace_id
          and entity.lifecycle_status = 'active'
          and entity.tier = any(target_tiers)
          and (entity.tier <> 'working' or entity.expires_at > now())
          and (not workspace_private.is_protected_context_privacy(entity.privacy_level) or include_private)
          and case target_purpose
            when 'profile' then entity.entity_family in (
              'professional_identity', 'strength', 'skill', 'work_preference', 'communication_preference'
            )
            when 'direction' then entity.entity_family in (
              'goal', 'career_direction', 'target_function', 'target_industry', 'target_role',
              'decision_criterion', 'career_hypothesis'
            )
            when 'relationships' then entity.entity_family in ('person', 'organization', 'relationship')
            when 'work' then entity.entity_family in (
              'opportunity', 'accomplishment', 'responsibility', 'story_bank'
            )
            when 'learning' then entity.entity_family in (
              'coaching_guidance', 'feedback', 'lesson', 'assumption', 'context_gap'
            )
            else true
          end
        order by entity.updated_at desc, entity.id desc
        limit page_size
      ) as entity_record
    ), '[]'::jsonb),
    'legacy_memory', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', memory.id,
        'memory_type', memory.memory_type,
        'content', memory.content,
        'domain', memory.domain,
        'created_at', memory.created_at,
        'compatibility_source', 'legacy_memory'
      ) order by memory.updated_at desc, memory.id desc)
      from (
        select * from workspace.memory_entries
        where workspace_id = target_workspace_id and created_by = auth.uid()
        order by updated_at desc, id desc
        limit page_size
      ) as memory
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_list_context_candidates(
  target_status text default null,
  include_private boolean default false,
  explicit_private_access boolean default false,
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
  if page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if include_private and not explicit_private_access then
    raise exception 'Protected candidates require explicit access confirmation.' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'candidates', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(candidate_record) - array[
          'workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'
        ] order by candidate_record.created_at desc, candidate_record.id desc
      )
      from (
        select candidate.* from workspace.context_candidates as candidate
        where candidate.workspace_id = target_workspace_id
          and (target_status is null or candidate.status = target_status)
          and (not workspace_private.is_protected_context_privacy(candidate.privacy_level) or include_private)
          and (include_private or not exists (
            select 1 from workspace.professional_context_entities as related_context
            where related_context.workspace_id = target_workspace_id
              and related_context.id in (
                candidate.conflict_with_entity_id,
                candidate.possible_match_entity_id
              )
              and workspace_private.is_protected_context_privacy(related_context.privacy_level)
          ))
        order by candidate.created_at desc, candidate.id desc
        limit page_size
      ) as candidate_record
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_propose_context_candidate_protected(
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
  target_military_sensitivity text default 'none',
  explicit_protected_access boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  proposal_result jsonb;
begin
  if workspace_private.is_protected_context_privacy(target_privacy_level)
    and not explicit_protected_access then
    raise exception 'Protected context requires explicit access confirmation.' using errcode = '42501';
  end if;
  if not explicit_protected_access and exists (
    select 1 from workspace.professional_context_entities
    where workspace_id = target_workspace_id
      and id in (target_conflict_with_entity_id, target_possible_match_entity_id)
      and workspace_private.is_protected_context_privacy(privacy_level)
  ) then
    raise exception 'Referenced context is unavailable for this operation.' using errcode = '22023';
  end if;

  proposal_result := workspace.mcp_propose_context_candidate(
    request_id, target_family, proposed_label, proposed_summary, proposed_tier,
    target_privacy_level, target_source_type, target_source_reference,
    target_observed_at, target_confidence, evidence_excerpt, target_evidence_role,
    target_chapter_key, target_source_record_type, target_source_record_id,
    target_conflict_with_entity_id, target_possible_match_entity_id,
    target_retention, target_military_sensitivity
  );
  if not explicit_protected_access and (
    workspace_private.is_protected_context_privacy(proposal_result #>> '{candidate,privacy_level}')
    or workspace_private.is_protected_context_privacy(proposal_result #>> '{existing_context,privacy}')
    or exists (
      select 1 from workspace.professional_context_entities as related_context
      where related_context.workspace_id = target_workspace_id
        and related_context.id in (
          (proposal_result #>> '{candidate,conflict_with_entity_id}')::uuid,
          (proposal_result #>> '{candidate,possible_match_entity_id}')::uuid
        )
        and workspace_private.is_protected_context_privacy(related_context.privacy_level)
    )
  ) then
    raise exception 'Protected context is unavailable for this operation.' using errcode = '22023';
  end if;
  return proposal_result;
end;
$$;

create or replace function workspace.mcp_review_context_candidate_protected(
  target_candidate_id uuid,
  target_decision text,
  request_id uuid,
  target_tier text default null,
  corrected_label text default null,
  corrected_summary text default null,
  target_chapter_key text default null,
  review_notes text default null,
  explicit_protected_access boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  selected_candidate workspace.context_candidates%rowtype;
  review_result jsonb;
  expected_label text;
  expected_summary text;
  expected_chapter_id uuid;
begin
  select * into selected_candidate
  from workspace.context_candidates
  where id = target_candidate_id and workspace_id = target_workspace_id;
  if not found or (
    workspace_private.is_protected_context_privacy(selected_candidate.privacy_level)
    and not explicit_protected_access
  ) then
    raise exception 'Context candidate not found for this Workspace.' using errcode = '22023';
  end if;
  if not explicit_protected_access and exists (
    select 1 from workspace.professional_context_entities as related_context
    where related_context.workspace_id = target_workspace_id
      and related_context.id in (
        selected_candidate.conflict_with_entity_id,
        selected_candidate.possible_match_entity_id
      )
      and workspace_private.is_protected_context_privacy(related_context.privacy_level)
  ) then
    raise exception 'Context candidate not found for this Workspace.' using errcode = '22023';
  end if;
  if selected_candidate.proposed_tier <> 'chapter'
    and selected_candidate.proposed_chapter_key is not null then
    raise exception 'The candidate tier and chapter are inconsistent.' using errcode = '22023';
  end if;

  if target_decision = 'approve' then
    if target_tier is not null or corrected_label is not null
      or corrected_summary is not null or target_chapter_key is not null then
      raise exception 'Approval must accept the candidate exactly.' using errcode = '22023';
    end if;
    expected_label := selected_candidate.proposed_label;
    expected_summary := selected_candidate.proposed_summary;
  elsif target_decision = 'correct' then
    if target_tier is not null or target_chapter_key is not null then
      raise exception 'Correction cannot change the candidate tier or chapter.' using errcode = '22023';
    end if;
    expected_label := coalesce(nullif(trim(corrected_label), ''), selected_candidate.proposed_label);
    expected_summary := coalesce(nullif(trim(corrected_summary), ''), selected_candidate.proposed_summary);
    if expected_label is not distinct from selected_candidate.proposed_label
      and expected_summary is not distinct from selected_candidate.proposed_summary then
      raise exception 'A correction must make an actual normalized content change.' using errcode = '22023';
    end if;
  elsif target_decision in ('reject', 'supersede') then
    if target_tier is not null or corrected_label is not null
      or corrected_summary is not null or target_chapter_key is not null then
      raise exception '% must not include candidate mutations.', initcap(target_decision) using errcode = '22023';
    end if;
    expected_label := selected_candidate.proposed_label;
    expected_summary := selected_candidate.proposed_summary;
  else
    raise exception 'A supported review decision is required.' using errcode = '22023';
  end if;

  review_result := workspace.mcp_review_context_candidate(
    target_candidate_id, target_decision, request_id, null,
    case when target_decision = 'correct' then corrected_label else null end,
    case when target_decision = 'correct' then corrected_summary else null end,
    null, review_notes
  );
  if selected_candidate.proposed_tier = 'chapter' then
    select chapter.id into expected_chapter_id
    from workspace.context_chapters as chapter
    where chapter.workspace_id = target_workspace_id
      and chapter.chapter_key = selected_candidate.proposed_chapter_key;
  end if;
  update workspace.context_reviews as review
  set privacy_level = selected_candidate.privacy_level
  where review.workspace_id = target_workspace_id
    and review.candidate_id = selected_candidate.id
    and review.request_id = mcp_review_context_candidate_protected.request_id
    and review.reviewed_by = auth.uid();

  if target_decision = 'reject' then
    if review_result -> 'context' <> 'null'::jsonb then
      raise exception 'Rejected context must not create a durable entity.' using errcode = '22023';
    end if;
  elsif review_result #>> '{context,label}' is distinct from expected_label
    or review_result #>> '{context,summary}' is distinct from expected_summary
    or review_result #>> '{context,family}' is distinct from selected_candidate.entity_family
    or review_result #>> '{context,tier}' is distinct from selected_candidate.proposed_tier
    or review_result #>> '{context,privacy}' is distinct from selected_candidate.privacy_level
    or (review_result #>> '{context,confidence}')::numeric is distinct from selected_candidate.confidence
    or (review_result #>> '{context,chapter_id}')::uuid is distinct from expected_chapter_id then
    raise exception 'The resulting context does not exactly match the reviewed decision.' using errcode = '22023';
  end if;
  return review_result;
end;
$$;

create or replace function workspace.mcp_get_context_provenance_protected(
  target_entity_id uuid,
  include_protected boolean default false,
  explicit_protected_access boolean default false
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
  if include_protected and not explicit_protected_access then
    raise exception 'Protected context requires explicit access confirmation.' using errcode = '42501';
  end if;
  select * into selected_entity
  from workspace.professional_context_entities
  where id = target_entity_id and workspace_id = target_workspace_id
    and (not workspace_private.is_protected_context_privacy(privacy_level) or include_protected);
  if not found then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'context', workspace_private.context_entity_payload(selected_entity),
    'evidence', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', evidence.id,
        'role', evidence.evidence_role,
        'source_type', evidence.source_type,
        'source_reference', evidence.source_reference,
        'source_record_type', evidence.source_record_type,
        'source_record_id', evidence.source_record_id,
        'observed_at', evidence.observed_at,
        'captured_at', evidence.captured_at,
        'excerpt', evidence.excerpt,
        'confidence', evidence.confidence,
        'privacy', evidence.privacy_level
      ) order by evidence.captured_at, evidence.id)
      from workspace.context_evidence as evidence
      where evidence.workspace_id = target_workspace_id
        and evidence.entity_id = selected_entity.id
        and (not workspace_private.is_protected_context_privacy(evidence.privacy_level) or include_protected)
    ), '[]'::jsonb),
    'reviews', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', review.id,
        'decision', review.decision,
        'previous_tier', review.previous_tier,
        'next_tier', review.next_tier,
        'previous_status', review.previous_status,
        'next_status', review.next_status,
        'review_notes', review.review_notes,
        'reviewed_at', review.reviewed_at
      ) order by review.reviewed_at, review.id)
      from workspace.context_reviews as review
      where review.workspace_id = target_workspace_id
        and (review.entity_id = selected_entity.id or review.resulting_entity_id = selected_entity.id)
        and (not workspace_private.is_protected_context_privacy(review.privacy_level) or include_protected)
    ), '[]'::jsonb),
    'conflicts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'candidate_id', candidate.id,
        'label', candidate.proposed_label,
        'summary', candidate.proposed_summary,
        'status', candidate.status,
        'observed_at', candidate.observed_at
      ) order by candidate.observed_at, candidate.id)
      from workspace.context_candidates as candidate
      where candidate.workspace_id = target_workspace_id
        and candidate.conflict_with_entity_id = selected_entity.id
        and (not workspace_private.is_protected_context_privacy(candidate.privacy_level) or include_protected)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_link_professional_context_protected(
  source_context_id uuid,
  link_type text,
  request_id uuid,
  target_context_id uuid default null,
  target_record_type text default null,
  target_record_id uuid default null,
  explicit_protected_access boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
begin
  if not exists (
    select 1 from workspace.professional_context_entities
    where id = source_context_id and workspace_id = target_workspace_id
      and (not workspace_private.is_protected_context_privacy(privacy_level) or explicit_protected_access)
  ) then
    raise exception 'Source context not found for this Workspace.' using errcode = '22023';
  end if;
  if target_context_id is not null and not exists (
    select 1 from workspace.professional_context_entities
    where id = target_context_id and workspace_id = target_workspace_id
      and (not workspace_private.is_protected_context_privacy(privacy_level) or explicit_protected_access)
  ) then
    raise exception 'Target context not found for this Workspace.' using errcode = '22023';
  end if;
  return workspace.mcp_link_professional_context(
    source_context_id, link_type, request_id, target_context_id,
    target_record_type, target_record_id
  );
end;
$$;

create or replace function workspace.mcp_manage_professional_context_protected(
  target_entity_id uuid,
  target_action text,
  request_id uuid,
  target_tier text default null,
  target_chapter_key text default null,
  review_notes text default null,
  explicit_protected_access boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_context_mcp_workspace();
  selected_privacy_level text;
  management_result jsonb;
begin
  select privacy_level into selected_privacy_level
    from workspace.professional_context_entities
    where id = target_entity_id and workspace_id = target_workspace_id
      and (not workspace_private.is_protected_context_privacy(privacy_level) or explicit_protected_access)
  ;
  if not found then
    raise exception 'Professional context not found for this Workspace.' using errcode = '22023';
  end if;
  management_result := workspace.mcp_manage_professional_context(
    target_entity_id, target_action, request_id, target_tier,
    target_chapter_key, review_notes
  );
  update workspace.context_reviews as review
  set privacy_level = selected_privacy_level
  where review.workspace_id = target_workspace_id
    and review.entity_id = target_entity_id
    and review.request_id = mcp_manage_professional_context_protected.request_id
    and review.reviewed_by = auth.uid();
  return management_result;
end;
$$;

revoke all on function workspace_private.is_protected_context_privacy(text)
  from public, anon, authenticated;
revoke all on function workspace.mcp_propose_context_candidate_protected(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_review_context_candidate_protected(
  uuid, text, uuid, text, text, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_provenance_protected(uuid, boolean, boolean)
  from public, anon, authenticated;
revoke all on function workspace.mcp_link_professional_context_protected(
  uuid, text, uuid, uuid, text, uuid, boolean
) from public, anon, authenticated;
revoke all on function workspace.mcp_manage_professional_context_protected(
  uuid, text, uuid, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function workspace.mcp_propose_context_candidate_protected(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text, boolean
) to authenticated;
grant execute on function workspace.mcp_review_context_candidate_protected(
  uuid, text, uuid, text, text, text, text, text, boolean
) to authenticated;
grant execute on function workspace.mcp_get_context_provenance_protected(uuid, boolean, boolean)
  to authenticated;
grant execute on function workspace.mcp_link_professional_context_protected(
  uuid, text, uuid, uuid, text, uuid, boolean
) to authenticated;
grant execute on function workspace.mcp_manage_professional_context_protected(
  uuid, text, uuid, text, text, text, boolean
) to authenticated;

comment on function workspace.mcp_get_context_provenance_protected(uuid, boolean, boolean) is
  'Returns provenance while omitting every private or sensitive nested record unless explicit protected-context access is present.';
comment on function workspace.mcp_review_context_candidate_protected(
  uuid, text, uuid, text, text, text, text, text, boolean
) is 'Enforces exact approve/reject/supersede decisions and actual-content corrections before delegating to the governed review transition.';
