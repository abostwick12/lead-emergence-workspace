-- Generic additive bundle entitlement foundation. SOTF is catalog data, not a
-- cohort, account, membership, or authorization special case.

create table if not exists workspace.bundle_definitions (
  bundle_key text primary key check (bundle_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  availability_status text not null default 'active'
    check (availability_status in ('active', 'unavailable', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.bundle_capabilities (
  bundle_key text not null references workspace.bundle_definitions(bundle_key) on delete cascade,
  capability_key text not null references workspace.capability_catalog(capability_key) on delete cascade,
  enabled boolean not null default true,
  limit_value integer check (limit_value is null or limit_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bundle_key, capability_key)
);

create table if not exists workspace.bundle_entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  bundle_key text not null references workspace.bundle_definitions(bundle_key) on delete restrict,
  beneficiary_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in (
    'operator_assignment', 'invite', 'subscription', 'promotion', 'organization_license'
  )),
  source_reference text not null check (char_length(source_reference) between 8 and 200),
  issuer_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) between 5 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check ((revoked_at is null and revocation_reason is null)
    or (revoked_at is not null and revocation_reason is not null))
);

create unique index if not exists bundle_entitlements_issue_unique
  on workspace.bundle_entitlements (source, issuer_user_id, source_reference) nulls not distinct;
create unique index if not exists bundle_entitlements_one_current_per_workspace
  on workspace.bundle_entitlements (workspace_id, bundle_key)
  where revoked_at is null;
create index if not exists bundle_entitlements_beneficiary_workspace_idx
  on workspace.bundle_entitlements (beneficiary_user_id, workspace_id);
create index if not exists bundle_entitlements_bundle_key_idx
  on workspace.bundle_entitlements (bundle_key);
create index if not exists bundle_entitlements_revoked_by_idx
  on workspace.bundle_entitlements (revoked_by_user_id)
  where revoked_by_user_id is not null;

create table if not exists workspace_private.bundle_invites (
  id uuid primary key default gen_random_uuid(),
  bundle_key text not null references workspace.bundle_definitions(bundle_key) on delete restrict,
  recipient_email text not null check (
    recipient_email = lower(trim(recipient_email))
    and char_length(recipient_email) between 3 and 254
    and position('@' in recipient_email) > 1
  ),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  issuer_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) between 5 and 500),
  claimed_at timestamptz,
  claimed_by_user_id uuid references auth.users(id) on delete cascade,
  claimed_workspace_id uuid references workspace.workspaces(id) on delete cascade,
  claimed_entitlement_id uuid references workspace.bundle_entitlements(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer_user_id, idempotency_key),
  check ((revoked_at is null and revocation_reason is null and revoked_by_user_id is null)
    or (revoked_at is not null and revocation_reason is not null and revoked_by_user_id is not null)),
  check ((claimed_at is null and claimed_by_user_id is null and claimed_workspace_id is null and claimed_entitlement_id is null)
    or (claimed_at is not null and claimed_by_user_id is not null and claimed_workspace_id is not null and claimed_entitlement_id is not null))
);

create index if not exists bundle_invites_bundle_key_idx
  on workspace_private.bundle_invites (bundle_key);
create index if not exists bundle_invites_claimed_by_idx
  on workspace_private.bundle_invites (claimed_by_user_id)
  where claimed_by_user_id is not null;
create index if not exists bundle_invites_claimed_workspace_idx
  on workspace_private.bundle_invites (claimed_workspace_id)
  where claimed_workspace_id is not null;
create index if not exists bundle_invites_claimed_entitlement_idx
  on workspace_private.bundle_invites (claimed_entitlement_id)
  where claimed_entitlement_id is not null;
create index if not exists bundle_invites_revoked_by_idx
  on workspace_private.bundle_invites (revoked_by_user_id)
  where revoked_by_user_id is not null;

insert into workspace.bundle_definitions (bundle_key, display_name, description, availability_status)
values (
  'sotf_transition',
  'SOTF Bundle',
  'Transition workflows and AI-native operating support delivered through the persistent Lead Emergence Workspace.',
  'active'
)
on conflict (bundle_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  availability_status = excluded.availability_status,
  updated_at = now();

insert into workspace.bundle_capabilities (bundle_key, capability_key, enabled, limit_value)
values
  ('sotf_transition', 'career', true, null),
  ('sotf_transition', 'daily_brief', true, null),
  ('sotf_transition', 'memory', true, null),
  ('sotf_transition', 'workspace_mcp', true, null),
  ('sotf_transition', 'agentic_workflows', true, null)
on conflict (bundle_key, capability_key) do update set
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  updated_at = now();

create or replace function workspace_private.is_bundle_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.is_direct_session()
    and exists (
      select 1
      from auth.users as auth_user
      where auth_user.id = auth.uid()
        and coalesce(auth_user.raw_app_meta_data ->> 'workspace_bundle_operator', 'false') = 'true'
    );
$$;

create or replace function workspace_private.bundle_entitlement_payload(
  entitlement_record workspace.bundle_entitlements,
  idempotent_replay boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'entitlement_id', entitlement_record.id,
    'workspace_id', entitlement_record.workspace_id,
    'bundle_key', entitlement_record.bundle_key,
    'source', entitlement_record.source,
    'starts_at', entitlement_record.starts_at,
    'expires_at', entitlement_record.expires_at,
    'revoked_at', entitlement_record.revoked_at,
    'state', case
      when entitlement_record.revoked_at is not null then 'revoked'
      when entitlement_record.expires_at is not null and entitlement_record.expires_at <= now() then 'expired'
      else 'active'
    end,
    'idempotent_replay', idempotent_replay
  );
$$;

create or replace function workspace_private.upsert_bundle_entitlement(
  target_workspace_id uuid,
  target_bundle_key text,
  target_beneficiary_user_id uuid,
  target_source text,
  target_source_reference text,
  target_issuer_user_id uuid,
  target_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement_record workspace.bundle_entitlements%rowtype;
  replay_record workspace.bundle_entitlements%rowtype;
begin
  if target_source not in ('operator_assignment', 'invite', 'subscription', 'promotion', 'organization_license') then
    raise exception 'Unsupported bundle entitlement source.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(target_source_reference, ''))) not between 8 and 200 then
    raise exception 'A valid bundle entitlement source reference is required.' using errcode = '22023';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Bundle entitlement expiry must be in the future.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from workspace.bundle_definitions as definition
    where definition.bundle_key = target_bundle_key and definition.availability_status = 'active'
  ) then
    raise exception 'This bundle is unavailable.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from workspace.workspaces as workspace_record
    join workspace.workspace_memberships as membership
      on membership.workspace_id = workspace_record.id
    where workspace_record.id = target_workspace_id
      and workspace_record.workspace_type = 'personal'
      and workspace_record.owner_user_id = target_beneficiary_user_id
      and membership.user_id = target_beneficiary_user_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'The bundle beneficiary does not own this active Personal Workspace.' using errcode = '42501';
  end if;

  select * into replay_record
  from workspace.bundle_entitlements as entitlement
  where entitlement.source = target_source
    and entitlement.issuer_user_id is not distinct from target_issuer_user_id
    and entitlement.source_reference = trim(target_source_reference)
  for update;

  if replay_record.id is not null then
    if replay_record.workspace_id <> target_workspace_id
      or replay_record.bundle_key <> target_bundle_key
      or replay_record.beneficiary_user_id <> target_beneficiary_user_id then
      raise exception 'The idempotency key is already bound to a different bundle grant.' using errcode = '22023';
    end if;
    return workspace_private.bundle_entitlement_payload(replay_record, true);
  end if;

  select * into entitlement_record
  from workspace.bundle_entitlements as entitlement
  where entitlement.workspace_id = target_workspace_id
    and entitlement.bundle_key = target_bundle_key
    and entitlement.revoked_at is null
  for update;

  if entitlement_record.id is not null
    and (entitlement_record.expires_at is null or entitlement_record.expires_at > now()) then
    return workspace_private.bundle_entitlement_payload(entitlement_record, true);
  end if;

  if entitlement_record.id is not null then
    update workspace.bundle_entitlements set
      revoked_at = now(),
      revoked_by_user_id = coalesce(target_issuer_user_id, target_beneficiary_user_id),
      revocation_reason = 'Superseded by a new grant after expiry.',
      updated_at = now()
    where id = entitlement_record.id;
  end if;

  begin
    insert into workspace.bundle_entitlements (
      workspace_id, bundle_key, beneficiary_user_id, source, source_reference,
      issuer_user_id, starts_at, expires_at
    ) values (
      target_workspace_id, target_bundle_key, target_beneficiary_user_id, target_source,
      trim(target_source_reference), target_issuer_user_id, now(), target_expires_at
    )
    returning * into entitlement_record;
  exception when unique_violation then
    select * into replay_record
    from workspace.bundle_entitlements as entitlement
    where entitlement.source = target_source
      and entitlement.issuer_user_id is not distinct from target_issuer_user_id
      and entitlement.source_reference = trim(target_source_reference);
    if replay_record.id is null then
      select * into replay_record
      from workspace.bundle_entitlements as entitlement
      where entitlement.workspace_id = target_workspace_id
        and entitlement.bundle_key = target_bundle_key
        and entitlement.revoked_at is null;
    end if;
    if replay_record.id is null
      or replay_record.workspace_id <> target_workspace_id
      or replay_record.bundle_key <> target_bundle_key
      or replay_record.beneficiary_user_id <> target_beneficiary_user_id then
      raise;
    end if;
    return workspace_private.bundle_entitlement_payload(replay_record, true);
  end;

  return workspace_private.bundle_entitlement_payload(entitlement_record, false);
end;
$$;

create or replace function workspace_private.issue_bundle_assignment(
  target_workspace_id uuid,
  target_bundle_key text,
  idempotency_key text,
  target_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not workspace_private.is_bundle_operator() then
    raise exception 'Bundle operator authorization is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(idempotency_key, ''))) not between 8 and 120 then
    raise exception 'A valid assignment idempotency key is required.' using errcode = '22023';
  end if;

  select workspace_record.owner_user_id into target_user_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership
    on membership.workspace_id = workspace_record.id
  where workspace_record.id = target_workspace_id
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = workspace_record.owner_user_id
    and membership.role = 'owner'
    and membership.status = 'active';

  if target_user_id is null then
    raise exception 'An active Personal Workspace owner is required.' using errcode = '22023';
  end if;

  return workspace_private.upsert_bundle_entitlement(
    target_workspace_id,
    target_bundle_key,
    target_user_id,
    'operator_assignment',
    trim(idempotency_key),
    auth.uid(),
    target_expires_at
  );
end;
$$;

create or replace function workspace_private.issue_bundle_invite(
  target_bundle_key text,
  target_recipient_email text,
  invite_token text,
  request_idempotency_key text,
  target_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_email text := lower(trim(coalesce(target_recipient_email, '')));
  normalized_token text := trim(coalesce(invite_token, ''));
  computed_token_hash text;
  actual_expires_at timestamptz := coalesce(target_expires_at, now() + interval '7 days');
  invite_record workspace_private.bundle_invites%rowtype;
  was_replay boolean := false;
begin
  if not workspace_private.is_bundle_operator() then
    raise exception 'Bundle operator authorization is required.' using errcode = '42501';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 254 then
    raise exception 'A valid invite email is required.' using errcode = '22023';
  end if;
  if char_length(normalized_token) not between 32 and 512 then
    raise exception 'A valid opaque invite token is required.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(request_idempotency_key, ''))) not between 8 and 120 then
    raise exception 'A valid invite idempotency key is required.' using errcode = '22023';
  end if;
  if actual_expires_at < now() + interval '5 minutes'
    or actual_expires_at > now() + interval '30 days' then
    raise exception 'Bundle invites must expire between five minutes and thirty days from issuance.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from workspace.bundle_definitions as definition
    where definition.bundle_key = target_bundle_key and definition.availability_status = 'active'
  ) then
    raise exception 'This bundle is unavailable.' using errcode = '22023';
  end if;

  computed_token_hash := encode(extensions.digest(normalized_token, 'sha256'), 'hex');
  select * into invite_record
  from workspace_private.bundle_invites as invite
  where invite.issuer_user_id = caller_id
    and invite.idempotency_key = trim(request_idempotency_key)
  for update;

  if invite_record.id is not null then
    if invite_record.bundle_key <> target_bundle_key
      or invite_record.recipient_email <> normalized_email
      or invite_record.token_hash <> computed_token_hash
      or (target_expires_at is not null and invite_record.expires_at <> target_expires_at) then
      raise exception 'The idempotency key is already bound to a different bundle invite.' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'invite_id', invite_record.id,
      'bundle_key', invite_record.bundle_key,
      'recipient_email', invite_record.recipient_email,
      'expires_at', invite_record.expires_at,
      'status', case
        when invite_record.claimed_at is not null then 'claimed'
        when invite_record.revoked_at is not null then 'revoked'
        when invite_record.expires_at <= now() then 'expired'
        else 'pending'
      end,
      'idempotent_replay', true
    );
  end if;

  begin
    insert into workspace_private.bundle_invites (
      bundle_key, recipient_email, token_hash, issuer_user_id, idempotency_key, expires_at
    ) values (
      target_bundle_key, normalized_email, computed_token_hash, caller_id,
      trim(request_idempotency_key), actual_expires_at
    )
    returning * into invite_record;
  exception when unique_violation then
    select * into invite_record
    from workspace_private.bundle_invites as invite
    where invite.issuer_user_id = caller_id
      and invite.idempotency_key = trim(request_idempotency_key);
    if invite_record.id is null
      or invite_record.bundle_key <> target_bundle_key
      or invite_record.recipient_email <> normalized_email
      or invite_record.token_hash <> computed_token_hash then
      raise;
    end if;
    was_replay := true;
  end;

  return pg_catalog.jsonb_build_object(
    'invite_id', invite_record.id,
    'bundle_key', invite_record.bundle_key,
    'recipient_email', invite_record.recipient_email,
    'expires_at', invite_record.expires_at,
    'status', case
      when invite_record.claimed_at is not null then 'claimed'
      when invite_record.revoked_at is not null then 'revoked'
      when invite_record.expires_at <= now() then 'expired'
      else 'pending'
    end,
    'idempotent_replay', was_replay
  );
end;
$$;

create or replace function workspace_private.claim_bundle_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  normalized_token text := trim(coalesce(invite_token, ''));
  computed_token_hash text;
  target_workspace_id uuid;
  invite_record workspace_private.bundle_invites%rowtype;
  entitlement_result jsonb;
  entitlement_record workspace.bundle_entitlements%rowtype;
begin
  if caller_id is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  if char_length(normalized_token) not between 32 and 512 then
    raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
  end if;

  select lower(trim(auth_user.email)) into caller_email
  from auth.users as auth_user where auth_user.id = caller_id;
  select workspace_record.id into target_workspace_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership
    on membership.workspace_id = workspace_record.id
  where workspace_record.workspace_type = 'personal'
    and workspace_record.owner_user_id = caller_id
    and membership.user_id = caller_id
    and membership.role = 'owner'
    and membership.status = 'active'
  order by workspace_record.created_at
  limit 1;

  if caller_email is null or target_workspace_id is null then
    raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
  end if;

  computed_token_hash := encode(extensions.digest(normalized_token, 'sha256'), 'hex');
  select * into invite_record
  from workspace_private.bundle_invites as invite
  where invite.token_hash = computed_token_hash
  for update;

  if invite_record.id is null then
    raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
  end if;

  if invite_record.claimed_at is not null then
    if invite_record.claimed_by_user_id <> caller_id
      or invite_record.claimed_workspace_id <> target_workspace_id then
      raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
    end if;
    select * into entitlement_record
    from workspace.bundle_entitlements as entitlement
    where entitlement.id = invite_record.claimed_entitlement_id;
    if entitlement_record.id is null then
      raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
    end if;
    entitlement_result := workspace_private.bundle_entitlement_payload(entitlement_record, true);
    return pg_catalog.jsonb_build_object(
      'invite_id', invite_record.id,
      'bundle_key', invite_record.bundle_key,
      'workspace_id', target_workspace_id,
      'entitlement', entitlement_result,
      'idempotent_replay', true
    );
  end if;

  if invite_record.revoked_at is not null
    or invite_record.expires_at <= now()
    or invite_record.recipient_email <> caller_email then
    raise exception 'This bundle invite is invalid or unavailable.' using errcode = '42501';
  end if;

  entitlement_result := workspace_private.upsert_bundle_entitlement(
    target_workspace_id,
    invite_record.bundle_key,
    caller_id,
    'invite',
    invite_record.id::text,
    invite_record.issuer_user_id,
    null
  );

  update workspace_private.bundle_invites set
    claimed_at = now(),
    claimed_by_user_id = caller_id,
    claimed_workspace_id = target_workspace_id,
    claimed_entitlement_id = (entitlement_result ->> 'entitlement_id')::uuid,
    updated_at = now()
  where id = invite_record.id;

  return pg_catalog.jsonb_build_object(
    'invite_id', invite_record.id,
    'bundle_key', invite_record.bundle_key,
    'workspace_id', target_workspace_id,
    'entitlement', entitlement_result,
    'idempotent_replay', false
  );
end;
$$;

create or replace function workspace_private.revoke_bundle_entitlement(
  target_entitlement_id uuid,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement_record workspace.bundle_entitlements%rowtype;
begin
  if not workspace_private.is_bundle_operator() then
    raise exception 'Bundle operator authorization is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(requested_reason, ''))) not between 5 and 500 then
    raise exception 'A concise revocation reason is required.' using errcode = '22023';
  end if;
  select * into entitlement_record
  from workspace.bundle_entitlements as entitlement
  where entitlement.id = target_entitlement_id
  for update;
  if entitlement_record.id is null then
    raise exception 'Bundle entitlement not found.' using errcode = '22023';
  end if;
  if entitlement_record.revoked_at is not null then
    return workspace_private.bundle_entitlement_payload(entitlement_record, true);
  end if;
  update workspace.bundle_entitlements set
    revoked_at = now(),
    revoked_by_user_id = auth.uid(),
    revocation_reason = trim(requested_reason),
    updated_at = now()
  where id = target_entitlement_id
  returning * into entitlement_record;
  return workspace_private.bundle_entitlement_payload(entitlement_record, false);
end;
$$;

create or replace function workspace_private.revoke_bundle_invite(
  target_invite_id uuid,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_record workspace_private.bundle_invites%rowtype;
begin
  if not workspace_private.is_bundle_operator() then
    raise exception 'Bundle operator authorization is required.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(requested_reason, ''))) not between 5 and 500 then
    raise exception 'A concise revocation reason is required.' using errcode = '22023';
  end if;
  select * into invite_record
  from workspace_private.bundle_invites as invite
  where invite.id = target_invite_id
  for update;
  if invite_record.id is null then
    raise exception 'Bundle invite not found.' using errcode = '22023';
  end if;
  if invite_record.claimed_at is not null then
    raise exception 'A claimed bundle invite cannot be revoked; revoke its entitlement instead.' using errcode = '22023';
  end if;
  if invite_record.revoked_at is not null then
    return pg_catalog.jsonb_build_object(
      'invite_id', invite_record.id,
      'bundle_key', invite_record.bundle_key,
      'status', 'revoked',
      'revoked_at', invite_record.revoked_at,
      'idempotent_replay', true
    );
  end if;
  update workspace_private.bundle_invites set
    revoked_at = now(),
    revoked_by_user_id = auth.uid(),
    revocation_reason = trim(requested_reason),
    updated_at = now()
  where id = target_invite_id
  returning * into invite_record;
  return pg_catalog.jsonb_build_object(
    'invite_id', invite_record.id,
    'bundle_key', invite_record.bundle_key,
    'status', 'revoked',
    'revoked_at', invite_record.revoked_at,
    'idempotent_replay', false
  );
end;
$$;

create or replace function workspace.issue_bundle_assignment(
  target_workspace_id uuid,
  target_bundle_key text,
  idempotency_key text,
  target_expires_at timestamptz default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select workspace_private.issue_bundle_assignment(
    target_workspace_id, target_bundle_key, idempotency_key, target_expires_at
  );
$$;

create or replace function workspace.issue_bundle_invite(
  target_bundle_key text,
  target_recipient_email text,
  invite_token text,
  idempotency_key text,
  target_expires_at timestamptz default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select workspace_private.issue_bundle_invite(
    target_bundle_key, target_recipient_email, invite_token, idempotency_key, target_expires_at
  );
$$;

create or replace function workspace.claim_bundle_invite(invite_token text)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select workspace_private.claim_bundle_invite(invite_token);
$$;

create or replace function workspace.revoke_bundle_entitlement(
  target_entitlement_id uuid,
  revocation_reason text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select workspace_private.revoke_bundle_entitlement(target_entitlement_id, revocation_reason);
$$;

create or replace function workspace.revoke_bundle_invite(
  target_invite_id uuid,
  revocation_reason text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select workspace_private.revoke_bundle_invite(target_invite_id, revocation_reason);
$$;

create or replace function workspace.resolve_bundle_entitlement(
  target_workspace_id uuid,
  target_bundle_key text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  definition_record workspace.bundle_definitions%rowtype;
  entitlement_record workspace.bundle_entitlements%rowtype;
  resolved_state text;
begin
  if auth.uid() is null or not exists (
    select 1
    from workspace.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  ) then
    raise exception 'This Workspace bundle state is unavailable.' using errcode = '42501';
  end if;
  select * into definition_record
  from workspace.bundle_definitions as definition
  where definition.bundle_key = target_bundle_key;
  if definition_record.bundle_key is null then
    return pg_catalog.jsonb_build_object(
      'bundle_key', target_bundle_key,
      'display_name', null,
      'catalog_available', false,
      'entitled', false,
      'state', 'unavailable',
      'entitlement_id', null
    );
  end if;

  select * into entitlement_record
  from workspace.bundle_entitlements as entitlement
  where entitlement.workspace_id = target_workspace_id
    and entitlement.bundle_key = target_bundle_key
    and entitlement.beneficiary_user_id = auth.uid()
  order by
    case
      when entitlement.revoked_at is null
        and (entitlement.expires_at is null or entitlement.expires_at > now()) then 0
      when entitlement.revoked_at is null then 1
      else 2
    end,
    entitlement.created_at desc
  limit 1;

  resolved_state := case
    when definition_record.availability_status <> 'active' then 'unavailable'
    when entitlement_record.id is null then 'available'
    when entitlement_record.revoked_at is not null then 'revoked'
    when entitlement_record.expires_at is not null and entitlement_record.expires_at <= now() then 'expired'
    else 'active'
  end;

  return pg_catalog.jsonb_build_object(
    'bundle_key', definition_record.bundle_key,
    'display_name', definition_record.display_name,
    'catalog_available', definition_record.availability_status = 'active',
    'entitled', resolved_state = 'active',
    'state', resolved_state,
    'entitlement_id', entitlement_record.id,
    'source', entitlement_record.source,
    'starts_at', entitlement_record.starts_at,
    'expires_at', entitlement_record.expires_at,
    'revoked_at', entitlement_record.revoked_at,
    'capabilities', case when resolved_state = 'active' then coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'capability_key', bundle_capability.capability_key,
            'enabled', bundle_capability.enabled,
            'limit_value', bundle_capability.limit_value
          ) order by bundle_capability.capability_key
        )
        from workspace.bundle_capabilities as bundle_capability
        where bundle_capability.bundle_key = definition_record.bundle_key
          and bundle_capability.enabled
      ),
      '[]'::jsonb
    ) else '[]'::jsonb end
  );
end;
$$;

-- Preserve plan capability behavior and add active bundles as a second,
-- independent capability source. Record access still depends on membership/RLS.
create or replace function workspace_private.has_personal_capability(
  target_workspace_id uuid,
  target_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select plan_capability.enabled
      from workspace.personal_plans as personal_plan
      join workspace.plan_capabilities as plan_capability
        on plan_capability.plan_key = personal_plan.plan_key
      where personal_plan.workspace_id = target_workspace_id
        and personal_plan.user_id = auth.uid()
        and personal_plan.status = 'active'
        and plan_capability.capability_key = target_capability
    ), false
  ) or (
    target_capability = 'leader_mode'
    and exists (
      select 1 from workspace.personal_plans as owner_plan
      where owner_plan.workspace_id = target_workspace_id
        and owner_plan.user_id = auth.uid()
        and owner_plan.status = 'active'
    )
    and exists (
      select 1 from workspace.workspace_entitlements as entitlement
      where entitlement.workspace_id = target_workspace_id
        and entitlement.feature_key = 'leader_mode'
        and entitlement.enabled
        and (entitlement.expires_at is null or entitlement.expires_at > now())
    )
  ) or exists (
    select 1
    from workspace.bundle_entitlements as entitlement
    join workspace.bundle_definitions as definition
      on definition.bundle_key = entitlement.bundle_key
    join workspace.bundle_capabilities as bundle_capability
      on bundle_capability.bundle_key = entitlement.bundle_key
    where entitlement.workspace_id = target_workspace_id
      and entitlement.beneficiary_user_id = auth.uid()
      and exists (
        select 1 from workspace.personal_plans as owner_plan
        where owner_plan.workspace_id = target_workspace_id
          and owner_plan.user_id = auth.uid()
          and owner_plan.status = 'active'
      )
      and entitlement.starts_at <= now()
      and entitlement.revoked_at is null
      and (entitlement.expires_at is null or entitlement.expires_at > now())
      and definition.availability_status = 'active'
      and bundle_capability.capability_key = target_capability
      and bundle_capability.enabled
  );
$$;

alter table workspace.bundle_definitions enable row level security;
alter table workspace.bundle_capabilities enable row level security;
alter table workspace.bundle_entitlements enable row level security;
alter table workspace_private.bundle_invites enable row level security;

revoke all on workspace.bundle_definitions, workspace.bundle_capabilities,
  workspace.bundle_entitlements from public, anon, authenticated;
revoke all on workspace_private.bundle_invites from public, anon, authenticated;
grant select on workspace.bundle_definitions, workspace.bundle_capabilities,
  workspace.bundle_entitlements to authenticated;

create policy bundle_definitions_select_direct on workspace.bundle_definitions
  for select to authenticated using (workspace_private.is_direct_session());
create policy bundle_capabilities_select_direct on workspace.bundle_capabilities
  for select to authenticated using (workspace_private.is_direct_session());
create policy bundle_entitlements_select_owner on workspace.bundle_entitlements
  for select to authenticated using (
    beneficiary_user_id = (select auth.uid())
    and workspace_private.is_active_member(workspace_id)
  );

revoke all on function workspace_private.is_bundle_operator() from public, anon, authenticated;
revoke all on function workspace_private.bundle_entitlement_payload(workspace.bundle_entitlements, boolean) from public, anon, authenticated;
revoke all on function workspace_private.upsert_bundle_entitlement(uuid, text, uuid, text, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function workspace_private.issue_bundle_assignment(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function workspace_private.issue_bundle_invite(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function workspace_private.claim_bundle_invite(text) from public, anon, authenticated;
revoke all on function workspace_private.revoke_bundle_entitlement(uuid, text) from public, anon, authenticated;
revoke all on function workspace_private.revoke_bundle_invite(uuid, text) from public, anon, authenticated;

revoke all on function workspace.issue_bundle_assignment(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function workspace.issue_bundle_invite(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function workspace.claim_bundle_invite(text) from public, anon, authenticated;
revoke all on function workspace.revoke_bundle_entitlement(uuid, text) from public, anon, authenticated;
revoke all on function workspace.revoke_bundle_invite(uuid, text) from public, anon, authenticated;
revoke all on function workspace.resolve_bundle_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function workspace.issue_bundle_assignment(uuid, text, text, timestamptz) to authenticated;
grant execute on function workspace.issue_bundle_invite(text, text, text, text, timestamptz) to authenticated;
grant execute on function workspace.claim_bundle_invite(text) to authenticated;
grant execute on function workspace.revoke_bundle_entitlement(uuid, text) to authenticated;
grant execute on function workspace.revoke_bundle_invite(uuid, text) to authenticated;
grant execute on function workspace.resolve_bundle_entitlement(uuid, text) to authenticated;

revoke all on function workspace_private.has_personal_capability(uuid, text) from public, anon, authenticated;
grant execute on function workspace_private.has_personal_capability(uuid, text) to authenticated;

drop trigger if exists bundle_definitions_set_updated_at on workspace.bundle_definitions;
create trigger bundle_definitions_set_updated_at
  before update on workspace.bundle_definitions
  for each row execute function workspace_private.set_updated_at();
drop trigger if exists bundle_capabilities_set_updated_at on workspace.bundle_capabilities;
create trigger bundle_capabilities_set_updated_at
  before update on workspace.bundle_capabilities
  for each row execute function workspace_private.set_updated_at();
drop trigger if exists bundle_entitlements_set_updated_at on workspace.bundle_entitlements;
create trigger bundle_entitlements_set_updated_at
  before update on workspace.bundle_entitlements
  for each row execute function workspace_private.set_updated_at();
drop trigger if exists bundle_invites_set_updated_at on workspace_private.bundle_invites;
create trigger bundle_invites_set_updated_at
  before update on workspace_private.bundle_invites
  for each row execute function workspace_private.set_updated_at();

comment on table workspace.bundle_definitions is
  'Generic bundle catalog. SOTF is represented only by the sotf_transition catalog row.';
comment on table workspace.bundle_capabilities is
  'Additive capability mappings supplied by an active bundle entitlement; Personal plan capability resolution remains foundational.';
comment on table workspace.bundle_entitlements is
  'Canonical Workspace bundle grant model shared by operator, invite, subscription, promotion, and organization-license sources.';
comment on table workspace_private.bundle_invites is
  'Unexposed, hash-only bundle invitations with bounded expiry, single-claim state, issuer provenance, and revocation support.';
