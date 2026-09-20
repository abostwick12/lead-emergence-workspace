-- Phase 2.2 review hardening: fail-closed timestamp authority and a dedicated
-- least-privilege database identity for the normalized projection receiver.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'workspace_projection_owner') then
    execute 'create role workspace_projection_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'workspace_projection_writer') then
    execute 'create role workspace_projection_writer login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
end;
$$;

grant connect on database postgres to workspace_projection_writer;
revoke all on schema workspace from workspace_projection_writer;
revoke all on schema workspace_private from workspace_projection_writer;
revoke all on all tables in schema workspace, workspace_private from workspace_projection_writer;
revoke all on all sequences in schema workspace, workspace_private from workspace_projection_writer;
revoke all on all functions in schema workspace, workspace_private from workspace_projection_writer;
grant usage on schema workspace to workspace_projection_writer;

revoke all on schema workspace from workspace_projection_owner;
revoke all on schema workspace_private from workspace_projection_owner;
revoke all on all tables in schema workspace, workspace_private from workspace_projection_owner;
revoke all on all sequences in schema workspace, workspace_private from workspace_projection_owner;
revoke all on all functions in schema workspace, workspace_private from workspace_projection_owner;
grant usage on schema workspace, workspace_private to workspace_projection_owner;

alter function workspace_private.apply_personal_billing_projection(
  uuid, workspace_private.personal_billing_effective_state,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, boolean, bigint, text, timestamptz
) security definer;
alter function workspace_private.apply_personal_billing_projection(
  uuid, workspace_private.personal_billing_effective_state,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, boolean, bigint, text, timestamptz
) set search_path = '';
alter function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status,
  text, bigint, uuid, timestamptz
) security definer;
alter function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status,
  text, bigint, uuid, timestamptz
) set search_path = '';

revoke all on function workspace_private.apply_personal_billing_projection(
  uuid, workspace_private.personal_billing_effective_state,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, boolean, bigint, text, timestamptz
) from public, anon, authenticated, workspace_projection_writer;
revoke all on function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status,
  text, bigint, uuid, timestamptz
) from public, anon, authenticated, workspace_projection_writer;
grant execute on function workspace_private.apply_personal_billing_projection(
  uuid, workspace_private.personal_billing_effective_state,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, boolean, bigint, text, timestamptz
) to workspace_projection_owner;
grant execute on function workspace_private.apply_personal_access_authority_projection(
  uuid, workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status,
  text, bigint, uuid, timestamptz
) to workspace_projection_owner;

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
security definer
set search_path = ''
as $$
declare
  v_result text;
  v_version bigint;
begin
  if current_user <> 'workspace_projection_owner' then
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

do $$
begin
  execute format('grant workspace_projection_owner to %I', current_user);
end;
$$;
grant create on schema workspace to workspace_projection_owner;
comment on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) is 'Single normalized PERSONAL projection RPC owned by workspace_projection_owner and executable only by workspace_projection_writer.';
alter function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) owner to workspace_projection_owner;
revoke create on schema workspace from workspace_projection_owner;
revoke all on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) from public, anon, authenticated, service_role;
grant execute on function workspace.apply_personal_authority_projection(
  text, uuid, text, bigint, uuid, timestamptz, jsonb
) to workspace_projection_writer;

-- PostgreSQL grants new functions to PUBLIC by default. Preserve the existing
-- authenticated MCP admission path without allowing the projection-only login
-- to execute this unrelated RPC through PUBLIC membership.
revoke all on function workspace.mcp_verify_current_authority()
  from public, anon, workspace_projection_writer;
grant execute on function workspace.mcp_verify_current_authority()
  to authenticated;
do $$
begin
  execute format('revoke workspace_projection_owner from %I', current_user);
end;
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
            (
              billing.effective_state = 'TRIALING'
              and billing.trial_ends_at is not null
              and billing.trial_ends_at > p_evaluated_at
            )
            or (
              billing.effective_state = 'ACTIVE'
              and billing.current_period_ends_at is not null
              and billing.current_period_ends_at > p_evaluated_at
            )
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

comment on role workspace_projection_owner is
  'NOLOGIN owner for the bounded PERSONAL projection SECURITY DEFINER path.';
comment on role workspace_projection_writer is
  'LOGIN identity limited to the normalized PERSONAL projection RPC; password provisioned outside source control.';
