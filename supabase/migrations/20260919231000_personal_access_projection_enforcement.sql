-- Phase 2.2 Slice D: normalized non-billing PERSONAL authority projection and
-- cutover-gated Workspace enforcement. The installed cutover remains disabled.

do $$ begin
  create type workspace_private.personal_access_authority_kind as enum (
    'SPONSORED_ACCESS',
    'INTERNAL_OPERATOR'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type workspace_private.personal_access_authority_status as enum (
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
  );
exception when duplicate_object then null; end $$;

create table workspace_private.personal_access_authority_projections (
  canonical_user_id uuid not null,
  authority_kind workspace_private.personal_access_authority_kind not null,
  entitlement_status workspace_private.personal_access_authority_status not null,
  source text not null,
  source_projection_version bigint not null,
  source_delivery_id uuid not null unique,
  projected_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (canonical_user_id, authority_kind),
  constraint personal_access_authority_source_nonempty
    check (char_length(btrim(source)) between 1 and 120),
  constraint personal_access_authority_version_positive
    check (source_projection_version > 0)
);

alter table workspace_private.personal_access_authority_projections enable row level security;
revoke all on workspace_private.personal_access_authority_projections from public, anon, authenticated;
grant select, insert, update on workspace_private.personal_access_authority_projections to service_role;

create or replace function workspace_private.apply_personal_access_authority_projection(
  p_canonical_user_id uuid,
  p_authority_kind workspace_private.personal_access_authority_kind,
  p_entitlement_status workspace_private.personal_access_authority_status,
  p_source text,
  p_source_projection_version bigint,
  p_source_delivery_id uuid,
  p_projected_at timestamptz
) returns table(projection_result text, effective_version bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing workspace_private.personal_access_authority_projections%rowtype;
  v_inserted integer;
  v_source text := btrim(coalesce(p_source, ''));
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted projection writer identity is required.' using errcode = '42501';
  end if;
  if p_source_projection_version <= 0
    or p_source_delivery_id is null
    or p_projected_at is null
    or char_length(v_source) not between 1 and 120
  then
    raise exception 'A valid normalized authority projection is required.' using errcode = '22023';
  end if;

  insert into workspace_private.personal_access_authority_projections (
    canonical_user_id,
    authority_kind,
    entitlement_status,
    source,
    source_projection_version,
    source_delivery_id,
    projected_at
  ) values (
    p_canonical_user_id,
    p_authority_kind,
    p_entitlement_status,
    v_source,
    p_source_projection_version,
    p_source_delivery_id,
    p_projected_at
  )
  on conflict (canonical_user_id, authority_kind) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return query select 'APPLIED'::text, p_source_projection_version;
    return;
  end if;

  select * into v_existing
  from workspace_private.personal_access_authority_projections
  where canonical_user_id = p_canonical_user_id
    and authority_kind = p_authority_kind
  for update;

  if p_source_projection_version < v_existing.source_projection_version then
    return query select 'STALE_IGNORED'::text, v_existing.source_projection_version;
    return;
  end if;

  if p_source_projection_version = v_existing.source_projection_version then
    if v_existing.entitlement_status = p_entitlement_status
      and v_existing.source = v_source
      and v_existing.source_delivery_id = p_source_delivery_id
      and v_existing.projected_at = p_projected_at
    then
      return query select 'IDEMPOTENT'::text, v_existing.source_projection_version;
      return;
    end if;
    raise exception 'Projection version conflict.' using errcode = '23505';
  end if;

  update workspace_private.personal_access_authority_projections
  set entitlement_status = p_entitlement_status,
      source = v_source,
      source_projection_version = p_source_projection_version,
      source_delivery_id = p_source_delivery_id,
      projected_at = p_projected_at,
      updated_at = now()
  where canonical_user_id = p_canonical_user_id
    and authority_kind = p_authority_kind;

  return query select 'APPLIED'::text, p_source_projection_version;
end;
$$;

-- This is the one exposed, service-role-only Edge Function write contract. It
-- accepts normalized fields only and routes to fixed private projection RPCs.
create or replace function workspace.apply_personal_authority_projection(
  p_protocol_version text,
  p_delivery_id uuid,
  p_projection_kind text,
  p_projection_version bigint,
  p_canonical_user_id uuid,
  p_projected_at timestamptz,
  p_projection_data jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result text;
  v_version bigint;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted projection writer identity is required.' using errcode = '42501';
  end if;
  if p_protocol_version <> '1'
    or p_delivery_id is null
    or p_projection_version <= 0
    or p_canonical_user_id is null
    or p_projected_at is null
    or jsonb_typeof(p_projection_data) <> 'object'
  then
    raise exception 'Invalid PERSONAL projection envelope.' using errcode = '22023';
  end if;

  if p_projection_kind = 'BILLING' then
    if p_projection_data ->> 'effective_state' not in (
      'TRIALING', 'ACTIVE', 'PAYMENT_GRACE', 'PAUSED_NO_PAYMENT_METHOD',
      'SUSPENDED_PAYMENT', 'CANCEL_AT_PERIOD_END', 'CANCELED'
    ) or exists (
      select 1 from jsonb_object_keys(p_projection_data) as supplied(key)
      where supplied.key not in (
        'effective_state', 'trial_started_at', 'trial_ends_at',
        'current_period_started_at', 'current_period_ends_at', 'grace_until',
        'cancel_at_period_end', 'payment_method_required'
      )
    ) then
      raise exception 'Invalid normalized billing projection.' using errcode = '22023';
    end if;

    select applied.projection_result, applied.effective_version
      into v_result, v_version
    from workspace_private.apply_personal_billing_projection(
      p_canonical_user_id,
      (p_projection_data ->> 'effective_state')::workspace_private.personal_billing_effective_state,
      (p_projection_data ->> 'trial_started_at')::timestamptz,
      (p_projection_data ->> 'trial_ends_at')::timestamptz,
      (p_projection_data ->> 'current_period_started_at')::timestamptz,
      (p_projection_data ->> 'current_period_ends_at')::timestamptz,
      (p_projection_data ->> 'grace_until')::timestamptz,
      coalesce((p_projection_data ->> 'cancel_at_period_end')::boolean, false),
      coalesce((p_projection_data ->> 'payment_method_required')::boolean, false),
      p_projection_version,
      p_delivery_id::text,
      p_projected_at
    ) as applied;
  elsif p_projection_kind = 'NON_BILLING_AUTHORITY' then
    if p_projection_data ->> 'authority_kind' not in ('SPONSORED_ACCESS', 'INTERNAL_OPERATOR')
      or p_projection_data ->> 'entitlement_status' not in ('ACTIVE', 'SUSPENDED', 'REVOKED')
      or char_length(btrim(coalesce(p_projection_data ->> 'source', ''))) not between 1 and 120
      or exists (
        select 1 from jsonb_object_keys(p_projection_data) as supplied(key)
        where supplied.key not in ('authority_kind', 'entitlement_status', 'source')
      )
    then
      raise exception 'Invalid normalized non-billing authority projection.' using errcode = '22023';
    end if;

    select applied.projection_result, applied.effective_version
      into v_result, v_version
    from workspace_private.apply_personal_access_authority_projection(
      p_canonical_user_id,
      (p_projection_data ->> 'authority_kind')::workspace_private.personal_access_authority_kind,
      (p_projection_data ->> 'entitlement_status')::workspace_private.personal_access_authority_status,
      p_projection_data ->> 'source',
      p_projection_version,
      p_delivery_id,
      p_projected_at
    ) as applied;
  else
    raise exception 'Unsupported PERSONAL projection kind.' using errcode = '22023';
  end if;

  return jsonb_build_object('projection_result', v_result, 'effective_version', v_version);
end;
$$;

create or replace function workspace_private.personal_access_enforcement_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select setting.setting_value = 'true'
    from workspace_private.product_settings as setting
    where setting.setting_key = 'phase_2_2_billing_enforcement_enabled'
  ), false);
$$;

create or replace function workspace_private.has_effective_personal_access_for_canonical(
  p_canonical_user_id uuid,
  p_evaluated_at timestamptz default now()
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not workspace_private.personal_access_enforcement_enabled() then true
    else (
      exists (
        select 1
        from workspace_private.personal_billing_projections as billing
        where billing.canonical_user_id = p_canonical_user_id
          and (
            billing.effective_state in ('TRIALING', 'ACTIVE')
            or (
              billing.effective_state = 'PAYMENT_GRACE'
              and billing.grace_until is not null
              and billing.grace_until > p_evaluated_at
            )
            or (
              billing.effective_state = 'CANCEL_AT_PERIOD_END'
              and billing.current_period_ends_at is not null
              and billing.current_period_ends_at > p_evaluated_at
            )
          )
      )
      or exists (
        select 1
        from workspace_private.personal_access_authority_projections as authority
        where authority.canonical_user_id = p_canonical_user_id
          and authority.authority_kind in ('SPONSORED_ACCESS', 'INTERNAL_OPERATOR')
          and authority.entitlement_status = 'ACTIVE'
      )
    )
  end;
$$;

create or replace function workspace_private.has_effective_personal_access(
  p_workspace_id uuid,
  p_evaluated_at timestamptz default now()
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select workspace_private.has_effective_personal_access_for_canonical(
      profile.canonical_user_id,
      p_evaluated_at
    )
    from workspace.workspaces as workspace_record
    join workspace.user_profiles as profile
      on profile.user_id = workspace_record.owner_user_id
    where workspace_record.id = p_workspace_id
      and workspace_record.workspace_type = 'personal'
      and profile.canonical_user_id is not null
  ), not workspace_private.personal_access_enforcement_enabled());
$$;

-- Membership and ownership survive suspension. These helpers gate hosted data
-- use only when cutover is enabled; the workspace and membership policies stay.
create or replace function workspace_private.is_active_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.is_direct_session()
    and workspace_private.has_effective_personal_access(target_workspace_id, now())
    and exists (
      select 1
      from workspace.workspace_memberships as membership
      where membership.workspace_id = target_workspace_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    );
$$;

create or replace function workspace_private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.is_direct_session()
    and workspace_private.has_effective_personal_access(target_workspace_id, now())
    and exists (
      select 1
      from workspace.workspaces as workspace_record
      join workspace.workspace_memberships as membership
        on membership.workspace_id = workspace_record.id
      where workspace_record.id = target_workspace_id
        and workspace_record.owner_user_id = auth.uid()
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
        and membership.status = 'active'
    );
$$;

-- Preserve every accepted plan, entitlement, and bundle capability source, then
-- add the single centralized effective-access predicate around the result.
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
  select workspace_private.has_effective_personal_access(target_workspace_id, now())
    and (
      coalesce(
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
      )
      or (
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
      )
      or exists (
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
      )
    );
$$;

create or replace function workspace.mcp_verify_current_authority()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(workspace_private.is_valid_mcp_request(), false)
    and exists (
      select 1
      from workspace.workspaces as workspace_record
      join workspace.workspace_memberships as membership
        on membership.workspace_id = workspace_record.id
      where workspace_record.owner_user_id = auth.uid()
        and workspace_record.workspace_type = 'personal'
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
        and membership.status = 'active'
        and workspace_private.has_effective_personal_access(workspace_record.id, now())
    );
$$;

create or replace function workspace.get_personal_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_canonical_user_id uuid;
  v_billing_state workspace_private.personal_billing_effective_state;
  v_allowed boolean;
  v_reason text;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  if not workspace_private.personal_access_enforcement_enabled() then
    return jsonb_build_object(
      'enforcement_enabled', false,
      'access_allowed', true,
      'reason', 'LEGACY_PHASE_2_1'
    );
  end if;

  select profile.canonical_user_id into v_canonical_user_id
  from workspace.user_profiles as profile
  where profile.user_id = auth.uid();
  v_allowed := v_canonical_user_id is not null
    and workspace_private.has_effective_personal_access_for_canonical(v_canonical_user_id, now());

  if v_allowed then
    v_reason := 'ACCESS_ACTIVE';
  else
    select billing.effective_state into v_billing_state
    from workspace_private.personal_billing_projections as billing
    where billing.canonical_user_id = v_canonical_user_id;
    v_reason := case
      when v_billing_state = 'PAUSED_NO_PAYMENT_METHOD' then 'BILLING_ACTION_REQUIRED'
      when v_billing_state in ('CANCELED', 'CANCEL_AT_PERIOD_END') then 'SUBSCRIPTION_ENDED'
      else 'ACCESS_SUSPENDED'
    end;
  end if;

  return jsonb_build_object(
    'enforcement_enabled', true,
    'access_allowed', v_allowed,
    'reason', v_reason
  );
end;
$$;

revoke all on function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status, text, bigint, uuid, timestamptz
) from public, anon, authenticated;
revoke all on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function workspace_private.personal_access_enforcement_enabled() from public, anon, authenticated;
revoke all on function workspace_private.has_effective_personal_access_for_canonical(uuid, timestamptz) from public, anon, authenticated;
revoke all on function workspace_private.has_effective_personal_access(uuid, timestamptz) from public, anon, authenticated;
revoke all on function workspace.get_personal_access_state() from public, anon;

grant execute on function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status, text, bigint, uuid, timestamptz
) to service_role;
grant execute on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) to service_role;
grant execute on function workspace.get_personal_access_state() to authenticated;

comment on table workspace_private.personal_access_authority_projections is
  'Private normalized non-billing PERSONAL authority projections. Sponsored and internal authority never become billing states.';
comment on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) is 'Single service-only normalized PERSONAL projection RPC used by the dedicated HMAC-authenticated Edge Function.';
comment on function workspace_private.has_effective_personal_access_for_canonical(uuid, timestamptz) is
  'Central cutover-gated PERSONAL authority resolver. Billing and valid non-billing authorities combine with OR semantics.';

notify pgrst, 'reload schema';
