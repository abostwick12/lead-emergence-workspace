-- List-only SOTF V1 authority. The daily-brief release gate remains in
-- workspace.sotf_v1_access_state() for all existing workflow operations.
create function workspace.sotf_v1_bundle_list_access_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  candidate_workspace uuid;
  target_workspace uuid;
  required_capabilities constant text[] := array['core_workspace','workspace_mcp','career','daily_brief','agentic_workflows'];
  missing_capabilities text[];
begin
  if auth.uid() is null or nullif(auth.jwt() ->> 'client_id', '') is null then
    return pg_catalog.jsonb_build_object('state','access_denied');
  end if;
  if not workspace_private.is_valid_mcp_request() then
    return pg_catalog.jsonb_build_object('state','access_denied');
  end if;
  select workspace_record.id into candidate_workspace
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if candidate_workspace is null then
    return pg_catalog.jsonb_build_object('state','access_denied');
  end if;
  if not exists (
    select 1 from workspace.personal_plans
    where workspace_id = candidate_workspace and user_id = auth.uid() and status = 'active'
  ) then
    return pg_catalog.jsonb_build_object('state','entitlement_required');
  end if;
  begin
    target_workspace := workspace_private.require_mcp_workspace();
  exception when others then
    return pg_catalog.jsonb_build_object('state','access_denied');
  end;

  if not exists (
    select 1 from workspace.mcp_authorizations
    where workspace_id = target_workspace
      and client_id = auth.jwt() ->> 'client_id'
      and created_by = auth.uid()
      and status = 'connected'
      and assistant_provider = 'chatgpt'
  ) then
    return pg_catalog.jsonb_build_object('state','incompatible_contract');
  end if;

  if not exists (
    select 1
    from workspace.bundle_entitlements as entitlement
    join workspace.bundle_definitions as definition using (bundle_key)
    where entitlement.workspace_id = target_workspace
      and entitlement.beneficiary_user_id = auth.uid()
      and entitlement.bundle_key = 'sotf_transition'
      and definition.availability_status = 'active'
      and entitlement.starts_at <= pg_catalog.now()
      and (entitlement.expires_at is null or entitlement.expires_at > pg_catalog.now())
      and entitlement.revoked_at is null
  ) then
    return pg_catalog.jsonb_build_object('state','entitlement_required');
  end if;

  select coalesce(pg_catalog.array_agg(capability order by capability), '{}'::text[]) into missing_capabilities
  from pg_catalog.unnest(required_capabilities) as capability
  where not workspace_private.has_personal_capability(target_workspace, capability);
  if pg_catalog.cardinality(missing_capabilities) > 0 then
    return pg_catalog.jsonb_build_object('state','capability_unavailable','missing_capabilities',missing_capabilities);
  end if;
  return pg_catalog.jsonb_build_object(
    'state','active',
    'workspace_id',target_workspace,
    'capabilities',(select pg_catalog.jsonb_agg(capability order by capability) from pg_catalog.unnest(required_capabilities) as capability)
  );
end; $$;

revoke all on function workspace.sotf_v1_bundle_list_access_state() from public, anon, authenticated;
grant execute on function workspace.sotf_v1_bundle_list_access_state() to authenticated;
