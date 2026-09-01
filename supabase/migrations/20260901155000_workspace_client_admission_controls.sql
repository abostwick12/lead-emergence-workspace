-- DOMAIN OWNER: Lead Emergence Workspace
-- PURPOSE: Service-only Personal admission suspension and structural summary.
-- These commands preserve all client data and never restore MCP grants.

create or replace function workspace_private.personal_admission_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_workspace_count integer := 0;
  v_owner_membership_count integer := 0;
  v_plan_count integer := 0;
  v_onboarding_count integer := 0;
  v_active_plan_count integer := 0;
  v_mcp_connected_count integer := 0;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted Workspace operator service is required.' using errcode = '42501';
  end if;
  select count(*) into v_workspace_count
  from workspace.workspaces where owner_user_id = p_user_id and workspace_type = 'personal';
  select count(*) into v_owner_membership_count
  from workspace.workspace_memberships as membership
  join workspace.workspaces as workspace_record on workspace_record.id = membership.workspace_id
  where workspace_record.owner_user_id = p_user_id and workspace_record.workspace_type = 'personal'
    and membership.user_id = p_user_id and membership.role = 'owner' and membership.status = 'active';
  select count(*), count(*) filter (where plan.status = 'active') into v_plan_count, v_active_plan_count
  from workspace.personal_plans as plan
  join workspace.workspaces as workspace_record on workspace_record.id = plan.workspace_id
  where workspace_record.owner_user_id = p_user_id and workspace_record.workspace_type = 'personal' and plan.user_id = p_user_id;
  select count(*) into v_onboarding_count
  from workspace.personal_onboarding as onboarding
  join workspace.workspaces as workspace_record on workspace_record.id = onboarding.workspace_id
  where workspace_record.owner_user_id = p_user_id and workspace_record.workspace_type = 'personal' and onboarding.user_id = p_user_id;
  select count(*) into v_mcp_connected_count
  from workspace.mcp_authorizations as authorization
  join workspace.workspaces as workspace_record on workspace_record.id = authorization.workspace_id
  where workspace_record.owner_user_id = p_user_id and workspace_record.workspace_type = 'personal'
    and authorization.created_by = p_user_id and authorization.status = 'connected';
  return jsonb_build_object(
    'graph_state', case
      when v_workspace_count = 0 and v_owner_membership_count = 0 and v_plan_count = 0 and v_onboarding_count = 0 then 'absent'
      when v_workspace_count = 1 and v_owner_membership_count = 1 and v_plan_count = 1 and v_onboarding_count = 1 then 'complete'
      else 'structurally_inconsistent'
    end,
    'active_personal_plan', v_active_plan_count = 1,
    'mcp_connection_count', v_mcp_connected_count
  );
end;
$$;

create or replace function workspace_private.set_personal_admission_status(
  p_user_id uuid,
  p_status text,
  p_reason_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_workspace_count integer;
  v_summary jsonb;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted Workspace operator service is required.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') or char_length(trim(coalesce(p_reason_code, ''))) not between 3 and 80 then
    raise exception 'Invalid Personal admission operation.' using errcode = '22023';
  end if;
  select count(*) into v_workspace_count
  from workspace.workspaces
  where owner_user_id = p_user_id and workspace_type = 'personal';
  if v_workspace_count = 0 then
    return jsonb_build_object('graph_state', 'absent', 'personal_status', p_status);
  end if;
  if v_workspace_count <> 1 then
    raise exception 'Personal Workspace graph is structurally inconsistent.' using errcode = '23514';
  end if;
  select id into v_workspace_id
  from workspace.workspaces
  where owner_user_id = p_user_id and workspace_type = 'personal'
  limit 1;
  if not (workspace_private.personal_admission_summary(p_user_id) ->> 'graph_state' = 'complete') then
    raise exception 'Personal Workspace graph is structurally inconsistent.' using errcode = '23514';
  end if;

  update workspace.personal_plans set status = p_status, updated_at = now()
  where workspace_id = v_workspace_id and user_id = p_user_id;

  if p_status = 'suspended' then
    update workspace.mcp_authorizations
    set status = 'disconnected', disconnected_at = now(), authorization_valid_after = now(), updated_at = now()
    where workspace_id = v_workspace_id and created_by = p_user_id and status <> 'disconnected';
    insert into workspace_private.mcp_oauth_admission_audit (user_fingerprint, client_fingerprint, event_type, reason_code)
    select workspace_private.mcp_admission_fingerprint(p_user_id::text),
           workspace_private.mcp_admission_fingerprint(grant_record.client_id::text),
           'grant_revoked', left(trim(p_reason_code), 80)
    from workspace_private.mcp_oauth_resource_grants as grant_record
    where grant_record.user_id = p_user_id and grant_record.status = 'active';
    update workspace_private.mcp_oauth_resource_grants
    set status = 'revoked', revoked_at = now(), updated_at = now()
    where user_id = p_user_id and status = 'active';
  end if;

  v_summary := workspace_private.personal_admission_summary(p_user_id);
  return v_summary || jsonb_build_object('personal_status', p_status);
end;
$$;

create or replace function public.get_workspace_personal_admission_summary(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select workspace_private.personal_admission_summary(p_user_id);
$$;

create or replace function public.set_workspace_personal_admission_status(
  p_user_id uuid,
  p_status text,
  p_reason_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select workspace_private.set_personal_admission_status(p_user_id, p_status, p_reason_code);
$$;

revoke all on function workspace_private.personal_admission_summary(uuid) from public, anon, authenticated;
revoke all on function workspace_private.set_personal_admission_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_workspace_personal_admission_summary(uuid) from public, anon, authenticated;
revoke all on function public.set_workspace_personal_admission_status(uuid, text, text) from public, anon, authenticated;
grant execute on function workspace_private.personal_admission_summary(uuid) to service_role;
grant execute on function workspace_private.set_personal_admission_status(uuid, text, text) to service_role;
grant execute on function public.get_workspace_personal_admission_summary(uuid) to service_role;
grant execute on function public.set_workspace_personal_admission_status(uuid, text, text) to service_role;

comment on function workspace_private.set_personal_admission_status(uuid, text, text) is 'Service-only Personal admission suspension/reactivation. Suspension preserves data and revokes all private MCP resource grants.';
