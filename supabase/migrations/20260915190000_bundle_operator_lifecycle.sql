-- Reviewed, catalog-wide bundle access state for authorized operators.
-- The browser never receives invite hashes or an authority to designate operators.

create or replace function workspace_private.get_bundle_operator_state(
  target_workspace_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reviewed_workspace_id uuid;
  reviewed_workspace_name text;
  reviewed_owner_user_id uuid;
  owner_email text;
  owner_display_name text;
  catalog jsonb;
begin
  if not workspace_private.is_bundle_operator() then
    raise exception 'Bundle operator authorization is required.' using errcode = '42501';
  end if;

  if target_workspace_id is not null then
    select target.id, target.name, target.owner_user_id, lower(trim(auth_user.email)), profile.display_name
      into reviewed_workspace_id, reviewed_workspace_name, reviewed_owner_user_id, owner_email, owner_display_name
    from workspace.workspaces as target
    join workspace.workspace_memberships as membership
      on membership.workspace_id = target.id
      and membership.user_id = target.owner_user_id
      and membership.role = 'owner'
      and membership.status = 'active'
    join auth.users as auth_user on auth_user.id = target.owner_user_id
    left join workspace.user_profiles as profile on profile.user_id = target.owner_user_id
    where target.id = target_workspace_id
      and target.workspace_type = 'personal';

    if reviewed_workspace_id is null then
      raise exception 'An active Personal Workspace owner is required.' using errcode = '22023';
    end if;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'bundleKey', definition.bundle_key,
      'displayName', definition.display_name,
      'description', definition.description,
      'capabilityCount', (
        select count(*)::integer
        from workspace.bundle_capabilities as capability
        where capability.bundle_key = definition.bundle_key
          and capability.enabled
      ),
      'state', case
        when target_workspace_id is null or entitlement.id is null then 'available'
        when entitlement.revoked_at is not null then 'revoked'
        when entitlement.expires_at is not null and entitlement.expires_at <= now() then 'expired'
        else 'active'
      end,
      'entitlementId', entitlement.id,
      'source', entitlement.source,
      'startsAt', entitlement.starts_at,
      'expiresAt', entitlement.expires_at,
      'revokedAt', entitlement.revoked_at,
      'revocationReason', entitlement.revocation_reason
    ) order by definition.display_name), '[]'::jsonb)
  into catalog
  from workspace.bundle_definitions as definition
  left join lateral (
    select candidate.*
    from workspace.bundle_entitlements as candidate
    where target_workspace_id is not null
      and candidate.workspace_id = target_workspace_id
      and candidate.bundle_key = definition.bundle_key
      and candidate.beneficiary_user_id = reviewed_owner_user_id
    order by
      case
        when candidate.revoked_at is null
          and (candidate.expires_at is null or candidate.expires_at > now()) then 0
        when candidate.revoked_at is null then 1
        else 2
      end,
      candidate.created_at desc,
      candidate.id desc
    limit 1
  ) as entitlement on true
  where definition.availability_status = 'active';

  return pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0',
    'reviewedAt', now(),
    'workspace', case when target_workspace_id is null then null else
      pg_catalog.jsonb_build_object(
        'workspaceId', reviewed_workspace_id,
        'workspaceName', reviewed_workspace_name,
        'ownerUserId', reviewed_owner_user_id,
        'ownerDisplayName', coalesce(nullif(trim(owner_display_name), ''), 'Workspace owner'),
        'ownerEmail', owner_email
      )
    end,
    'bundles', catalog
  );
end;
$$;

create or replace function workspace.get_bundle_operator_state(
  target_workspace_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.get_bundle_operator_state(target_workspace_id);
$$;

revoke all on function workspace_private.get_bundle_operator_state(uuid) from public, anon, authenticated;
revoke all on function workspace.get_bundle_operator_state(uuid) from public, anon, authenticated;
grant execute on function workspace.get_bundle_operator_state(uuid) to authenticated;

comment on function workspace.get_bundle_operator_state(uuid) is
  'Operator-only review of one verified Personal Workspace owner and the active bundle catalog; invite secrets are excluded.';
