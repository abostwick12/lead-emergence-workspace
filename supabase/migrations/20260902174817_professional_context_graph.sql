-- P2 / S2a: production-shaped Professional Context Graph.
-- Ingestion is not memory: observations enter as reviewable candidates, while
-- only explicit user decisions create confirmed Working/Chapter/Core context.

insert into workspace.capability_catalog (
  capability_key, display_name, benefit_description, value_type
) values (
  'professional_context',
  'Professional Context Graph',
  'Governed professional identity, direction, relationships, work evidence, and learning shared across bounded workflows.',
  'boolean'
)
on conflict (capability_key) do update set
  display_name = excluded.display_name,
  benefit_description = excluded.benefit_description,
  value_type = excluded.value_type,
  updated_at = now();

insert into workspace.bundle_capabilities (bundle_key, capability_key, enabled)
values ('sotf_transition', 'professional_context', true)
on conflict (bundle_key, capability_key) do update set
  enabled = excluded.enabled,
  updated_at = now();

create table workspace.context_chapters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  chapter_key text not null check (chapter_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  label text not null check (char_length(label) between 1 and 160),
  purpose text check (purpose is null or char_length(purpose) between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  unique (id, workspace_id),
  unique (workspace_id, chapter_key)
);

create table workspace.professional_context_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  chapter_id uuid,
  entity_family text not null check (entity_family in (
    'professional_identity', 'strength', 'skill', 'work_preference', 'communication_preference',
    'goal', 'career_direction', 'target_function', 'target_industry', 'target_role',
    'decision_criterion', 'career_hypothesis', 'person', 'organization', 'relationship',
    'opportunity', 'accomplishment', 'responsibility', 'story_bank', 'coaching_guidance',
    'feedback', 'lesson', 'assumption', 'context_gap'
  )),
  label text not null check (char_length(label) between 1 and 240),
  summary text not null check (char_length(summary) between 1 and 5000),
  tier text not null check (tier in ('working', 'chapter', 'core')),
  privacy_level text not null default 'normal' check (privacy_level in ('normal', 'private', 'sensitive')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'superseded', 'archived', 'deleted')),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  superseded_by_entity_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tier <> 'chapter' or chapter_id is not null),
  check ((tier = 'working' and expires_at is not null) or (tier <> 'working' and expires_at is null)),
  unique (id, workspace_id),
  foreign key (chapter_id, workspace_id) references workspace.context_chapters(id, workspace_id) on delete restrict,
  foreign key (superseded_by_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict
);

create unique index professional_context_active_dedupe_idx
  on workspace.professional_context_entities (workspace_id, entity_family, dedupe_key)
  where lifecycle_status = 'active';
create index professional_context_retrieval_idx
  on workspace.professional_context_entities (workspace_id, tier, entity_family, updated_at desc)
  where lifecycle_status = 'active';

create table workspace.context_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  entity_family text not null check (entity_family in (
    'professional_identity', 'strength', 'skill', 'work_preference', 'communication_preference',
    'goal', 'career_direction', 'target_function', 'target_industry', 'target_role',
    'decision_criterion', 'career_hypothesis', 'person', 'organization', 'relationship',
    'opportunity', 'accomplishment', 'responsibility', 'story_bank', 'coaching_guidance',
    'feedback', 'lesson', 'assumption', 'context_gap'
  )),
  proposed_label text not null check (char_length(proposed_label) between 1 and 240),
  proposed_summary text not null check (char_length(proposed_summary) between 1 and 5000),
  proposed_tier text not null check (proposed_tier in ('working', 'chapter', 'core')),
  proposed_chapter_key text check (proposed_chapter_key is null or proposed_chapter_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  privacy_level text not null default 'normal' check (privacy_level in ('normal', 'private', 'sensitive')),
  source_type text not null check (source_type in ('user_supplied', 'connector', 'workflow', 'inferred', 'legacy_memory')),
  source_reference text check (source_reference is null or char_length(source_reference) between 1 and 500),
  source_record_type text check (source_record_type is null or source_record_type in (
    'task', 'commitment', 'meeting', 'decision', 'capture', 'job_application', 'memory_entry'
  )),
  source_record_id uuid,
  observed_at timestamptz not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'conflict', 'confirmed', 'corrected', 'rejected', 'archived')),
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  conflict_with_entity_id uuid,
  possible_match_entity_id uuid,
  confirmed_entity_id uuid,
  expires_at timestamptz not null default (now() + interval '30 days'),
  client_id text,
  request_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_record_type is null) = (source_record_id is null)),
  check (status <> 'conflict' or conflict_with_entity_id is not null),
  unique (id, workspace_id),
  foreign key (conflict_with_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict,
  foreign key (possible_match_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict,
  foreign key (confirmed_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict
);

create unique index context_candidates_request_idx
  on workspace.context_candidates (workspace_id, created_by, client_id, request_id) nulls not distinct;
create unique index context_candidates_evidence_dedupe_idx
  on workspace.context_candidates (workspace_id, entity_family, dedupe_key, evidence_fingerprint)
  where status in ('pending', 'conflict', 'confirmed', 'corrected', 'rejected');
create index context_candidates_review_queue_idx
  on workspace.context_candidates (workspace_id, status, created_at desc);

create table workspace.context_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  candidate_id uuid,
  entity_id uuid,
  decision text not null check (decision in ('approve', 'correct', 'reject', 'supersede', 'promote', 'archive', 'delete')),
  previous_tier text check (previous_tier is null or previous_tier in ('working', 'chapter', 'core')),
  next_tier text check (next_tier is null or next_tier in ('working', 'chapter', 'core')),
  previous_status text,
  next_status text,
  review_notes text check (review_notes is null or char_length(review_notes) between 1 and 2000),
  resulting_entity_id uuid,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  client_id text,
  request_id uuid not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  check ((candidate_id is not null)::integer + (entity_id is not null)::integer = 1),
  unique (id, workspace_id),
  foreign key (candidate_id, workspace_id) references workspace.context_candidates(id, workspace_id) on delete restrict,
  foreign key (entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict,
  foreign key (resulting_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete restrict
);

create unique index context_reviews_request_idx
  on workspace.context_reviews (workspace_id, reviewed_by, client_id, request_id) nulls not distinct;
create index context_reviews_candidate_idx on workspace.context_reviews (workspace_id, candidate_id, reviewed_at desc);
create index context_reviews_entity_idx on workspace.context_reviews (workspace_id, entity_id, reviewed_at desc);

create table workspace.context_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  candidate_id uuid,
  entity_id uuid,
  evidence_role text not null check (evidence_role in ('supporting', 'contradicting')),
  source_type text not null check (source_type in ('user_supplied', 'connector', 'workflow', 'inferred', 'legacy_memory')),
  source_reference text check (source_reference is null or char_length(source_reference) between 1 and 500),
  source_record_type text check (source_record_type is null or source_record_type in (
    'task', 'commitment', 'meeting', 'decision', 'capture', 'job_application', 'memory_entry'
  )),
  source_record_id uuid,
  observed_at timestamptz not null,
  captured_at timestamptz not null default now(),
  excerpt text check (excerpt is null or char_length(excerpt) between 1 and 2000),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  privacy_level text not null check (privacy_level in ('normal', 'private', 'sensitive')),
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  check (candidate_id is not null or entity_id is not null),
  check ((source_record_type is null) = (source_record_id is null)),
  unique (id, workspace_id),
  foreign key (candidate_id, workspace_id) references workspace.context_candidates(id, workspace_id) on delete cascade,
  foreign key (entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete cascade
);

create unique index context_evidence_candidate_fingerprint_idx
  on workspace.context_evidence (workspace_id, candidate_id, evidence_fingerprint)
  where candidate_id is not null;
create index context_evidence_entity_idx on workspace.context_evidence (workspace_id, entity_id, captured_at desc);

create table workspace.professional_context_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  source_entity_id uuid not null,
  target_entity_id uuid,
  target_record_type text check (target_record_type is null or target_record_type in (
    'task', 'commitment', 'meeting', 'decision', 'capture', 'job_application', 'memory_entry'
  )),
  target_record_id uuid,
  link_type text not null check (link_type in (
    'related_to', 'supports', 'contradicts', 'about', 'applies_to', 'derived_from', 'fulfilled_by'
  )),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  client_id text,
  request_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((target_entity_id is not null)::integer + (target_record_id is not null)::integer = 1),
  check ((target_record_type is null) = (target_record_id is null)),
  check (target_entity_id is null or target_entity_id <> source_entity_id),
  unique (id, workspace_id),
  foreign key (source_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete cascade,
  foreign key (target_entity_id, workspace_id) references workspace.professional_context_entities(id, workspace_id) on delete cascade
);

create unique index professional_context_links_dedupe_idx
  on workspace.professional_context_links (
    workspace_id, source_entity_id, target_entity_id, target_record_type, target_record_id, link_type
  ) nulls not distinct;
create unique index professional_context_links_request_idx
  on workspace.professional_context_links (workspace_id, created_by, client_id, request_id) nulls not distinct;

create or replace function workspace_private.context_fingerprint(variadic values_to_hash text[])
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.array_to_string(values_to_hash, E'\x1f', '<null>'), 'sha256'),
    'hex'
  );
$$;

create or replace function workspace_private.context_record_belongs_to_workspace(
  target_workspace_id uuid,
  target_record_type text,
  target_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return case target_record_type
    when 'task' then exists (select 1 from workspace.tasks where id = target_record_id and workspace_id = target_workspace_id)
    when 'commitment' then exists (select 1 from workspace.commitments where id = target_record_id and workspace_id = target_workspace_id)
    when 'meeting' then exists (select 1 from workspace.meetings where id = target_record_id and workspace_id = target_workspace_id)
    when 'decision' then exists (select 1 from workspace.decisions where id = target_record_id and workspace_id = target_workspace_id)
    when 'capture' then exists (select 1 from workspace.capture_inbox where id = target_record_id and workspace_id = target_workspace_id)
    when 'job_application' then exists (select 1 from workspace.job_applications where id = target_record_id and workspace_id = target_workspace_id)
    when 'memory_entry' then exists (select 1 from workspace.memory_entries where id = target_record_id and workspace_id = target_workspace_id)
    else false
  end;
end;
$$;

create or replace function workspace_private.context_entity_payload(entity workspace.professional_context_entities)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', entity.id,
    'family', entity.entity_family,
    'label', entity.label,
    'summary', entity.summary,
    'tier', entity.tier,
    'privacy', entity.privacy_level,
    'status', entity.lifecycle_status,
    'confidence', entity.confidence,
    'chapter_id', entity.chapter_id,
    'expires_at', entity.expires_at,
    'confirmed_at', entity.confirmed_at,
    'superseded_by_entity_id', entity.superseded_by_entity_id,
    'updated_at', entity.updated_at
  );
$$;

create or replace function workspace_private.require_context_mcp_workspace()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.require_mcp_capability('professional_context');
$$;

create or replace function workspace_private.require_mcp_capability(target_capability text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  if target_capability not in ('core_workspace', 'tasks', 'quick_capture', 'memory', 'career', 'workspace_mcp', 'professional_context') then
    raise exception 'The requested Workspace capability is not supported.' using errcode = '22023';
  end if;
  if not workspace_private.has_personal_capability(target_workspace_id, target_capability) then
    raise exception 'This Workspace capability is not included for the current Personal plan.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.mcp_propose_context_candidate(
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
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  normalized_label text := nullif(trim(proposed_label), '');
  normalized_summary text := nullif(trim(proposed_summary), '');
  normalized_source_reference text := nullif(trim(target_source_reference), '');
  normalized_excerpt text := nullif(trim(evidence_excerpt), '');
  candidate_dedupe_key text;
  candidate_evidence_fingerprint text;
  candidate_request_fingerprint text;
  existing_candidate workspace.context_candidates%rowtype;
  existing_entity workspace.professional_context_entities%rowtype;
  created_candidate workspace.context_candidates%rowtype;
begin
  if request_id is null then
    raise exception 'A request identifier is required for context proposals.' using errcode = '22023';
  end if;
  if target_retention not in ('retain', 'do_not_retain') then
    raise exception 'Context retention must be retain or do_not_retain.' using errcode = '22023';
  end if;
  if target_military_sensitivity not in ('none', 'suspected_classified', 'suspected_cui', 'operationally_sensitive') then
    raise exception 'Military sensitivity classification is not supported.' using errcode = '22023';
  end if;
  if target_retention = 'do_not_retain' or target_military_sensitivity <> 'none' then
    return pg_catalog.jsonb_build_object(
      'retained', false,
      'candidate', null,
      'reason', case
        when target_retention = 'do_not_retain' then 'do_not_retain'
        else 'military_sensitive_content_not_accepted'
      end
    );
  end if;
  if normalized_label is null or char_length(normalized_label) > 240
    or normalized_summary is null or char_length(normalized_summary) > 5000 then
    raise exception 'Context label or summary length is invalid.' using errcode = '22023';
  end if;
  if proposed_tier not in ('working', 'chapter', 'core')
    or target_privacy_level not in ('normal', 'private', 'sensitive')
    or target_source_type not in ('user_supplied', 'connector', 'workflow', 'inferred', 'legacy_memory')
    or target_evidence_role not in ('supporting', 'contradicting')
    or target_confidence not between 0 and 1 then
    raise exception 'Context proposal classification is invalid.' using errcode = '22023';
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

  candidate_dedupe_key := workspace_private.context_fingerprint(
    lower(trim(target_family)), lower(normalized_label), lower(normalized_summary)
  );
  candidate_evidence_fingerprint := workspace_private.context_fingerprint(
    target_source_type, normalized_source_reference, target_observed_at::text,
    target_evidence_role, normalized_excerpt, target_source_record_type, target_source_record_id::text
  );
  candidate_request_fingerprint := workspace_private.context_fingerprint(
    target_family, normalized_label, normalized_summary, proposed_tier, target_privacy_level,
    target_source_type, normalized_source_reference, target_observed_at::text, target_confidence::text,
    normalized_excerpt, target_evidence_role, target_chapter_key, target_source_record_type,
    target_source_record_id::text, target_conflict_with_entity_id::text, target_possible_match_entity_id::text
  );

  select * into existing_candidate
  from workspace.context_candidates
  where workspace_id = target_workspace_id
    and created_by = auth.uid()
    and client_id is not distinct from token_client_id
    and context_candidates.request_id = mcp_propose_context_candidate.request_id;
  if found then
    if existing_candidate.request_fingerprint <> candidate_request_fingerprint then
      raise exception 'Reuse a context request identifier only with the same proposal.' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'retained', true,
      'candidate', pg_catalog.to_jsonb(existing_candidate) - array['workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'],
      'idempotent_replay', true
    );
  end if;

  select * into existing_entity
  from workspace.professional_context_entities
  where workspace_id = target_workspace_id
    and entity_family = target_family
    and dedupe_key = candidate_dedupe_key
    and lifecycle_status = 'active'
  limit 1;
  if found then
    return pg_catalog.jsonb_build_object(
      'retained', true,
      'candidate', null,
      'existing_context', workspace_private.context_entity_payload(existing_entity),
      'duplicate', true,
      'idempotent_replay', false
    );
  end if;

  select * into existing_candidate
  from workspace.context_candidates
  where workspace_id = target_workspace_id
    and entity_family = target_family
    and dedupe_key = candidate_dedupe_key
    and evidence_fingerprint = candidate_evidence_fingerprint
    and status in ('pending', 'conflict', 'confirmed', 'corrected', 'rejected')
  limit 1;
  if found then
    return pg_catalog.jsonb_build_object(
      'retained', true,
      'candidate', pg_catalog.to_jsonb(existing_candidate) - array['workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'],
      'duplicate', true,
      'idempotent_replay', true
    );
  end if;

  insert into workspace.context_candidates (
    workspace_id, entity_family, proposed_label, proposed_summary, proposed_tier,
    proposed_chapter_key, privacy_level, source_type, source_reference,
    source_record_type, source_record_id, observed_at, confidence, status,
    dedupe_key, evidence_fingerprint, request_fingerprint, conflict_with_entity_id,
    possible_match_entity_id, client_id, request_id, created_by
  ) values (
    target_workspace_id, target_family, normalized_label, normalized_summary, proposed_tier,
    target_chapter_key, target_privacy_level, target_source_type, normalized_source_reference,
    target_source_record_type, target_source_record_id, target_observed_at, target_confidence,
    case when target_conflict_with_entity_id is null then 'pending' else 'conflict' end,
    candidate_dedupe_key, candidate_evidence_fingerprint, candidate_request_fingerprint,
    target_conflict_with_entity_id, target_possible_match_entity_id, token_client_id,
    request_id, auth.uid()
  ) returning * into created_candidate;

  insert into workspace.context_evidence (
    workspace_id, candidate_id, evidence_role, source_type, source_reference,
    source_record_type, source_record_id, observed_at, excerpt, confidence,
    privacy_level, evidence_fingerprint, created_by
  ) values (
    target_workspace_id, created_candidate.id, target_evidence_role, target_source_type,
    normalized_source_reference, target_source_record_type, target_source_record_id,
    target_observed_at, normalized_excerpt, target_confidence, target_privacy_level,
    candidate_evidence_fingerprint, auth.uid()
  );

  return pg_catalog.jsonb_build_object(
    'retained', true,
    'candidate', pg_catalog.to_jsonb(created_candidate) - array['workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'],
    'duplicate', false,
    'idempotent_replay', false
  );
end;
$$;

create or replace function workspace.mcp_review_context_candidate(
  target_candidate_id uuid,
  target_decision text,
  request_id uuid,
  target_tier text default null,
  corrected_label text default null,
  corrected_summary text default null,
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
  selected_candidate workspace.context_candidates%rowtype;
  existing_review workspace.context_reviews%rowtype;
  resulting_entity workspace.professional_context_entities%rowtype;
  conflict_entity workspace.professional_context_entities%rowtype;
  resolved_label text;
  resolved_summary text;
  resolved_tier text;
  resolved_chapter_key text;
  resolved_chapter_id uuid;
  resolved_dedupe_key text;
  review_fingerprint text;
  next_candidate_status text;
begin
  if target_candidate_id is null or request_id is null
    or target_decision not in ('approve', 'correct', 'reject', 'supersede') then
    raise exception 'A candidate, supported decision, and request identifier are required.' using errcode = '22023';
  end if;

  review_fingerprint := workspace_private.context_fingerprint(
    target_candidate_id::text, target_decision, target_tier, corrected_label,
    corrected_summary, target_chapter_key, review_notes
  );
  select * into existing_review
  from workspace.context_reviews
  where workspace_id = target_workspace_id
    and reviewed_by = auth.uid()
    and client_id is not distinct from token_client_id
    and context_reviews.request_id = mcp_review_context_candidate.request_id;
  if found then
    if existing_review.request_fingerprint <> review_fingerprint then
      raise exception 'Reuse a review request identifier only with the same decision.' using errcode = '22023';
    end if;
    if existing_review.resulting_entity_id is not null then
      select * into resulting_entity from workspace.professional_context_entities
      where id = existing_review.resulting_entity_id and workspace_id = target_workspace_id;
    end if;
    return pg_catalog.jsonb_build_object(
      'decision', existing_review.decision,
      'candidate_id', existing_review.candidate_id,
      'context', case when resulting_entity.id is null then null else workspace_private.context_entity_payload(resulting_entity) end,
      'idempotent_replay', true
    );
  end if;

  select * into selected_candidate
  from workspace.context_candidates
  where id = target_candidate_id and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'Context candidate not found for this Workspace.' using errcode = '22023';
  end if;
  if selected_candidate.status not in ('pending', 'conflict') then
    raise exception 'Context candidate has already been reviewed.' using errcode = '22023';
  end if;
  if selected_candidate.expires_at <= now() then
    raise exception 'Context candidate has expired and must be proposed again with current evidence.' using errcode = '22023';
  end if;
  if selected_candidate.status = 'conflict' and target_decision not in ('supersede', 'reject') then
    raise exception 'Conflicting context must be explicitly superseded or rejected.' using errcode = '22023';
  end if;
  if selected_candidate.status <> 'conflict' and target_decision = 'supersede' then
    raise exception 'Only a conflict candidate can supersede confirmed context.' using errcode = '22023';
  end if;

  if target_decision = 'reject' then
    update workspace.context_candidates set status = 'rejected', updated_at = now()
    where id = selected_candidate.id;
    insert into workspace.context_reviews (
      workspace_id, candidate_id, decision, previous_status, next_status, review_notes,
      request_fingerprint, client_id, request_id, reviewed_by
    ) values (
      target_workspace_id, selected_candidate.id, 'reject', selected_candidate.status,
      'rejected', nullif(trim(review_notes), ''), review_fingerprint, token_client_id,
      request_id, auth.uid()
    );
    return pg_catalog.jsonb_build_object(
      'decision', 'reject', 'candidate_id', selected_candidate.id,
      'context', null, 'idempotent_replay', false
    );
  end if;

  resolved_label := coalesce(nullif(trim(corrected_label), ''), selected_candidate.proposed_label);
  resolved_summary := coalesce(nullif(trim(corrected_summary), ''), selected_candidate.proposed_summary);
  resolved_tier := coalesce(target_tier, selected_candidate.proposed_tier);
  resolved_chapter_key := coalesce(target_chapter_key, selected_candidate.proposed_chapter_key);
  if resolved_tier not in ('working', 'chapter', 'core') then
    raise exception 'The selected context tier is invalid.' using errcode = '22023';
  end if;
  if resolved_tier = 'chapter' and resolved_chapter_key is null then
    raise exception 'Chapter context requires a chapter key.' using errcode = '22023';
  end if;
  if target_decision = 'correct' and corrected_label is null and corrected_summary is null then
    raise exception 'A correction must amend the label or summary.' using errcode = '22023';
  end if;

  if resolved_tier = 'chapter' then
    insert into workspace.context_chapters (
      workspace_id, chapter_key, label, purpose, created_by
    ) values (
      target_workspace_id, resolved_chapter_key,
      initcap(replace(resolved_chapter_key, '_', ' ')),
      'Bounded professional chapter for confirmed context.', auth.uid()
    ) on conflict (workspace_id, chapter_key) do update set updated_at = now()
    returning id into resolved_chapter_id;
  end if;

  resolved_dedupe_key := workspace_private.context_fingerprint(
    lower(trim(selected_candidate.entity_family)), lower(resolved_label), lower(resolved_summary)
  );
  select * into resulting_entity
  from workspace.professional_context_entities
  where workspace_id = target_workspace_id
    and entity_family = selected_candidate.entity_family
    and dedupe_key = resolved_dedupe_key
    and lifecycle_status = 'active'
  limit 1;
  if not found then
    insert into workspace.professional_context_entities (
      workspace_id, chapter_id, entity_family, label, summary, tier, privacy_level,
      lifecycle_status, confidence, dedupe_key, expires_at, confirmed_by, created_by
    ) values (
      target_workspace_id, resolved_chapter_id, selected_candidate.entity_family,
      resolved_label, resolved_summary, resolved_tier, selected_candidate.privacy_level,
      'active', selected_candidate.confidence, resolved_dedupe_key,
      case when resolved_tier = 'working' then now() + interval '30 days' else null end,
      auth.uid(), auth.uid()
    ) returning * into resulting_entity;
  end if;

  if target_decision = 'supersede' then
    select * into conflict_entity
    from workspace.professional_context_entities
    where id = selected_candidate.conflict_with_entity_id
      and workspace_id = target_workspace_id and lifecycle_status = 'active'
    for update;
    if not found then
      raise exception 'The context conflict is no longer active.' using errcode = '22023';
    end if;
    if conflict_entity.id = resulting_entity.id then
      raise exception 'Conflicting context cannot supersede itself.' using errcode = '22023';
    end if;
    update workspace.professional_context_entities
    set lifecycle_status = 'superseded', superseded_by_entity_id = resulting_entity.id,
      updated_at = now()
    where id = conflict_entity.id;
  end if;

  next_candidate_status := case when target_decision = 'correct' then 'corrected' else 'confirmed' end;
  update workspace.context_candidates
  set status = next_candidate_status, confirmed_entity_id = resulting_entity.id, updated_at = now()
  where id = selected_candidate.id;
  update workspace.context_evidence
  set entity_id = resulting_entity.id
  where candidate_id = selected_candidate.id and workspace_id = target_workspace_id;

  insert into workspace.context_reviews (
    workspace_id, candidate_id, decision, previous_tier, next_tier,
    previous_status, next_status, review_notes, resulting_entity_id,
    request_fingerprint, client_id, request_id, reviewed_by
  ) values (
    target_workspace_id, selected_candidate.id, target_decision,
    selected_candidate.proposed_tier, resolved_tier, selected_candidate.status,
    next_candidate_status, nullif(trim(review_notes), ''), resulting_entity.id,
    review_fingerprint, token_client_id, request_id, auth.uid()
  );

  return pg_catalog.jsonb_build_object(
    'decision', target_decision,
    'candidate_id', selected_candidate.id,
    'context', workspace_private.context_entity_payload(resulting_entity),
    'superseded_context_id', case when target_decision = 'supersede' then conflict_entity.id else null end,
    'idempotent_replay', false
  );
end;
$$;

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
    raise exception 'Private context requires explicit access confirmation.' using errcode = '42501';
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
          and (entity.privacy_level <> 'private' or include_private)
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
    raise exception 'Private candidates require explicit access confirmation.' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'candidates', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(candidate_record) - array[
          'workspace_id', 'created_by', 'request_fingerprint', 'client_id', 'dedupe_key', 'evidence_fingerprint'
        ] order by candidate_record.created_at desc, candidate_record.id desc
      )
      from (
        select * from workspace.context_candidates
        where workspace_id = target_workspace_id
          and (target_status is null or status = target_status)
          and (privacy_level <> 'private' or include_private)
        order by created_at desc, id desc
        limit page_size
      ) as candidate_record
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_get_context_provenance(target_entity_id uuid)
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
  select * into selected_entity
  from workspace.professional_context_entities
  where id = target_entity_id and workspace_id = target_workspace_id;
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
      where evidence.workspace_id = target_workspace_id and evidence.entity_id = selected_entity.id
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
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_link_professional_context(
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
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  created_link workspace.professional_context_links%rowtype;
  was_created boolean := false;
  link_request_fingerprint text;
begin
  if request_id is null or link_type not in (
    'related_to', 'supports', 'contradicts', 'about', 'applies_to', 'derived_from', 'fulfilled_by'
  ) then
    raise exception 'A supported link and request identifier are required.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from workspace.professional_context_entities
    where id = source_context_id and workspace_id = target_workspace_id and lifecycle_status <> 'deleted'
  ) then
    raise exception 'Source context not found for this Workspace.' using errcode = '22023';
  end if;
  if (target_context_id is not null)::integer + (target_record_id is not null)::integer <> 1
    or ((target_record_type is null) <> (target_record_id is null)) then
    raise exception 'Choose exactly one context or operational-record target.' using errcode = '22023';
  end if;
  if target_context_id is not null and not exists (
    select 1 from workspace.professional_context_entities
    where id = target_context_id and workspace_id = target_workspace_id and lifecycle_status <> 'deleted'
  ) then
    raise exception 'Target context does not belong to this Workspace.' using errcode = '42501';
  end if;
  if target_record_id is not null and not workspace_private.context_record_belongs_to_workspace(
    target_workspace_id, target_record_type, target_record_id
  ) then
    raise exception 'Target operational record does not belong to this Workspace.' using errcode = '42501';
  end if;

  link_request_fingerprint := workspace_private.context_fingerprint(
    source_context_id::text, link_type, target_context_id::text,
    target_record_type, target_record_id::text
  );
  select * into created_link
  from workspace.professional_context_links
  where workspace_id = target_workspace_id
    and created_by = auth.uid()
    and client_id is not distinct from token_client_id
    and professional_context_links.request_id = mcp_link_professional_context.request_id;
  if found then
    if created_link.request_fingerprint <> link_request_fingerprint then
      raise exception 'Reuse a context-link request identifier only with the same link.' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'link', pg_catalog.to_jsonb(created_link) - array['workspace_id', 'created_by', 'request_fingerprint', 'client_id'],
      'idempotent_replay', true
    );
  end if;

  insert into workspace.professional_context_links (
    workspace_id, source_entity_id, target_entity_id, target_record_type,
    target_record_id, link_type, request_fingerprint, client_id, request_id, created_by
  ) values (
    target_workspace_id, source_context_id, target_context_id, target_record_type,
    target_record_id, link_type, link_request_fingerprint, token_client_id, request_id, auth.uid()
  ) on conflict do nothing
  returning * into created_link;
  was_created := found;
  if not found then
    select * into created_link
    from workspace.professional_context_links
    where workspace_id = target_workspace_id
      and source_entity_id = source_context_id
      and professional_context_links.target_entity_id is not distinct from target_context_id
      and professional_context_links.target_record_type is not distinct from mcp_link_professional_context.target_record_type
      and professional_context_links.target_record_id is not distinct from mcp_link_professional_context.target_record_id
      and professional_context_links.link_type = mcp_link_professional_context.link_type;
  end if;
  return pg_catalog.jsonb_build_object(
    'link', pg_catalog.to_jsonb(created_link) - array['workspace_id', 'created_by', 'request_fingerprint', 'client_id'],
    'idempotent_replay', not was_created
  );
end;
$$;

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
    delete from workspace.professional_context_links
    where workspace_id = target_workspace_id
      and (source_entity_id = selected_entity.id or target_entity_id = selected_entity.id);
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
    previous_tier,
    selected_entity.tier,
    previous_status,
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

alter table workspace.context_chapters enable row level security;
alter table workspace.professional_context_entities enable row level security;
alter table workspace.professional_context_links enable row level security;
alter table workspace.context_evidence enable row level security;
alter table workspace.context_candidates enable row level security;
alter table workspace.context_reviews enable row level security;

revoke all on workspace.context_chapters, workspace.professional_context_entities,
  workspace.professional_context_links, workspace.context_evidence,
  workspace.context_candidates, workspace.context_reviews
from public, anon, authenticated;

grant select on workspace.context_chapters, workspace.professional_context_entities,
  workspace.professional_context_links, workspace.context_evidence,
  workspace.context_candidates, workspace.context_reviews
to authenticated;

create policy context_chapters_select_owner on workspace.context_chapters
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );
create policy professional_context_entities_select_owner on workspace.professional_context_entities
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );
create policy professional_context_links_select_owner on workspace.professional_context_links
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );
create policy context_evidence_select_owner on workspace.context_evidence
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );
create policy context_candidates_select_owner on workspace.context_candidates
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );
create policy context_reviews_select_owner on workspace.context_reviews
  for select to authenticated using (
    workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'professional_context')
  );

revoke all on function workspace_private.context_fingerprint(variadic text[]) from public, anon, authenticated;
revoke all on function workspace_private.context_record_belongs_to_workspace(uuid, text, uuid) from public, anon, authenticated;
revoke all on function workspace_private.context_entity_payload(workspace.professional_context_entities) from public, anon, authenticated;
revoke all on function workspace_private.require_context_mcp_workspace() from public, anon, authenticated;
revoke all on function workspace_private.require_mcp_capability(text) from public, anon, authenticated;
grant execute on function workspace_private.require_mcp_capability(text) to authenticated;

revoke all on function workspace.mcp_propose_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_review_context_candidate(
  uuid, text, uuid, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function workspace.mcp_list_professional_context(
  text, text[], boolean, boolean, integer
) from public, anon, authenticated;
revoke all on function workspace.mcp_list_context_candidates(
  text, boolean, boolean, integer
) from public, anon, authenticated;
revoke all on function workspace.mcp_get_context_provenance(uuid) from public, anon, authenticated;
revoke all on function workspace.mcp_link_professional_context(
  uuid, text, uuid, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function workspace.mcp_manage_professional_context(
  uuid, text, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function workspace.mcp_propose_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) to authenticated;
grant execute on function workspace.mcp_review_context_candidate(
  uuid, text, uuid, text, text, text, text, text
) to authenticated;
grant execute on function workspace.mcp_list_professional_context(
  text, text[], boolean, boolean, integer
) to authenticated;
grant execute on function workspace.mcp_list_context_candidates(
  text, boolean, boolean, integer
) to authenticated;
grant execute on function workspace.mcp_get_context_provenance(uuid) to authenticated;
grant execute on function workspace.mcp_link_professional_context(
  uuid, text, uuid, uuid, text, uuid
) to authenticated;
grant execute on function workspace.mcp_manage_professional_context(
  uuid, text, uuid, text, text, text
) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'context_chapters', 'professional_context_entities', 'context_candidates'
  ] loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on workspace.%I for each row execute function workspace_private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
  foreach table_name in array array[
    'context_chapters', 'professional_context_entities', 'professional_context_links',
    'context_evidence', 'context_candidates', 'context_reviews'
  ] loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_enforce_immutable_tenancy', table_name);
    execute format(
      'create trigger %I before update on workspace.%I for each row execute function workspace_private.enforce_immutable_tenancy()',
      table_name || '_enforce_immutable_tenancy', table_name
    );
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_audit_mutation', table_name);
    execute format(
      'create trigger %I after insert or update or delete on workspace.%I for each row execute function workspace_private.audit_workspace_mutation()',
      table_name || '_audit_mutation', table_name
    );
  end loop;
end;
$$;

comment on table workspace.context_chapters is
  'Bounded professional chapters. Chapter context stays distinguishable from durable Core context.';
comment on table workspace.professional_context_entities is
  'User-confirmed professional context only. Working context expires; Chapter/Core promotion is review governed.';
comment on table workspace.professional_context_links is
  'Typed links to other context or existing Workspace operational records; operational records are not copied into the graph.';
comment on table workspace.context_evidence is
  'Bounded provenance excerpts and source references supporting or contradicting candidates/context; raw source bodies are excluded.';
comment on table workspace.context_candidates is
  'Review queue for user, connector, workflow, legacy-memory, and inferred observations. Ingestion never directly creates durable truth.';
comment on table workspace.context_reviews is
  'Auditable user decisions for candidate confirmation, correction, rejection, conflict supersession, promotion, archival, and deletion.';
comment on function workspace.mcp_list_professional_context(text, text[], boolean, boolean, integer) is
  'Returns bounded confirmed Professional Context Graph records plus legacy Workspace memory as a separate compatibility collection.';
comment on function workspace.mcp_propose_context_candidate(
  uuid, text, text, text, text, text, text, text, timestamptz, numeric,
  text, text, text, text, uuid, uuid, uuid, text, text
) is
  'Creates an idempotent review candidate with bounded provenance; do-not-retain and suspected classified/CUI/operationally-sensitive material are not persisted.';
