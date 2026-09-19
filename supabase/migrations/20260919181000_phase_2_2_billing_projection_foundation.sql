-- Phase 2.2 Slice A: normalized Entry-to-Workspace billing projection storage.
-- The cutover remains disabled and no existing authorization path reads this table.

do $$ begin
  create type workspace_private.personal_billing_effective_state as enum (
    'TRIALING',
    'ACTIVE',
    'PAYMENT_GRACE',
    'PAUSED_NO_PAYMENT_METHOD',
    'SUSPENDED_PAYMENT',
    'CANCEL_AT_PERIOD_END',
    'CANCELED',
    'INTERNAL_OPERATOR'
  );
exception when duplicate_object then null; end $$;

create table workspace_private.personal_billing_projections (
  canonical_user_id uuid primary key,
  effective_state workspace_private.personal_billing_effective_state not null,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  payment_method_required boolean not null default false,
  source_billing_version bigint not null,
  source_event_id text not null unique,
  source_event_created_at timestamptz not null,
  last_projected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_billing_projections_trial_window
    check (trial_ends_at is null or trial_started_at is null or trial_ends_at >= trial_started_at),
  constraint personal_billing_projections_period_window
    check (current_period_ends_at is null or current_period_started_at is null or current_period_ends_at >= current_period_started_at),
  constraint personal_billing_projections_version_positive check (source_billing_version > 0),
  constraint personal_billing_projections_event_id_nonempty check (btrim(source_event_id) <> '')
);

alter table workspace_private.personal_billing_projections enable row level security;
revoke all on workspace_private.personal_billing_projections from public, anon, authenticated;
grant select, insert, update on workspace_private.personal_billing_projections to service_role;

insert into workspace_private.product_settings (setting_key, setting_value)
values ('phase_2_2_billing_enforcement_enabled', 'false')
on conflict (setting_key) do nothing;

create or replace function workspace_private.apply_personal_billing_projection(
  p_canonical_user_id uuid,
  p_effective_state workspace_private.personal_billing_effective_state,
  p_trial_started_at timestamptz,
  p_trial_ends_at timestamptz,
  p_current_period_started_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_grace_until timestamptz,
  p_cancel_at_period_end boolean,
  p_payment_method_required boolean,
  p_source_billing_version bigint,
  p_source_event_id text,
  p_source_event_created_at timestamptz
) returns table(projection_result text, effective_version bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing workspace_private.personal_billing_projections%rowtype;
  v_inserted integer;
  v_event_id text := btrim(coalesce(p_source_event_id, ''));
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted projection writer identity is required.' using errcode = '42501';
  end if;
  if p_source_billing_version <= 0 then
    raise exception 'Projection version must be positive.' using errcode = '22023';
  end if;
  if v_event_id = '' or p_source_event_created_at is null then
    raise exception 'Projection source event identity and timestamp are required.' using errcode = '22023';
  end if;

  insert into workspace_private.personal_billing_projections (
    canonical_user_id,
    effective_state,
    trial_started_at,
    trial_ends_at,
    current_period_started_at,
    current_period_ends_at,
    grace_until,
    cancel_at_period_end,
    payment_method_required,
    source_billing_version,
    source_event_id,
    source_event_created_at
  ) values (
    p_canonical_user_id,
    p_effective_state,
    p_trial_started_at,
    p_trial_ends_at,
    p_current_period_started_at,
    p_current_period_ends_at,
    p_grace_until,
    p_cancel_at_period_end,
    p_payment_method_required,
    p_source_billing_version,
    v_event_id,
    p_source_event_created_at
  )
  on conflict (canonical_user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return query select 'APPLIED'::text, p_source_billing_version;
    return;
  end if;

  select * into v_existing
  from workspace_private.personal_billing_projections
  where canonical_user_id = p_canonical_user_id
  for update;

  if p_source_billing_version < v_existing.source_billing_version then
    return query select 'STALE_IGNORED'::text, v_existing.source_billing_version;
    return;
  end if;

  if p_source_billing_version = v_existing.source_billing_version then
    if v_existing.effective_state = p_effective_state
      and v_existing.trial_started_at is not distinct from p_trial_started_at
      and v_existing.trial_ends_at is not distinct from p_trial_ends_at
      and v_existing.current_period_started_at is not distinct from p_current_period_started_at
      and v_existing.current_period_ends_at is not distinct from p_current_period_ends_at
      and v_existing.grace_until is not distinct from p_grace_until
      and v_existing.cancel_at_period_end = p_cancel_at_period_end
      and v_existing.payment_method_required = p_payment_method_required
      and v_existing.source_event_id = v_event_id
      and v_existing.source_event_created_at = p_source_event_created_at
    then
      return query select 'IDEMPOTENT'::text, v_existing.source_billing_version;
      return;
    end if;
    raise exception 'Projection version conflict.' using errcode = '23505';
  end if;

  update workspace_private.personal_billing_projections
  set effective_state = p_effective_state,
      trial_started_at = p_trial_started_at,
      trial_ends_at = p_trial_ends_at,
      current_period_started_at = p_current_period_started_at,
      current_period_ends_at = p_current_period_ends_at,
      grace_until = p_grace_until,
      cancel_at_period_end = p_cancel_at_period_end,
      payment_method_required = p_payment_method_required,
      source_billing_version = p_source_billing_version,
      source_event_id = v_event_id,
      source_event_created_at = p_source_event_created_at,
      last_projected_at = now(),
      updated_at = now()
  where canonical_user_id = p_canonical_user_id;

  return query select 'APPLIED'::text, p_source_billing_version;
end;
$$;

revoke all on function workspace_private.apply_personal_billing_projection(
  uuid,
  workspace_private.personal_billing_effective_state,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  boolean,
  bigint,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function workspace_private.apply_personal_billing_projection(
  uuid,
  workspace_private.personal_billing_effective_state,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  boolean,
  bigint,
  text,
  timestamptz
) to service_role;

comment on table workspace_private.personal_billing_projections is
  'Private normalized billing projection from Entry. It contains no Stripe object ownership and is not an authorization source until a later cutover.';
comment on function workspace_private.apply_personal_billing_projection(
  uuid,
  workspace_private.personal_billing_effective_state,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  boolean,
  bigint,
  text,
  timestamptz
) is 'Service-only monotonic normalized projection write. Stale versions are ignored and equal versions must be identical.';
