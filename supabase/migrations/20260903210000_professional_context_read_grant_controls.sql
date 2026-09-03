-- B2.2 keeps the existing protected-read grant architecture while aligning
-- direct-session creation and status presentation with its effective MCP gates.

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
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  authorization_record workspace.mcp_authorizations%rowtype;
  grant_record workspace_private.professional_context_read_grants%rowtype;
begin
  if target_privacy_scope not in ('private', 'sensitive') then
    raise exception 'A private or sensitive read scope is required.' using errcode = '22023';
  end if;
  if not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp')
    or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
    raise exception 'Professional Context protected reads are not available for this Workspace.' using errcode = '42501';
  end if;

  select * into authorization_record
  from workspace.mcp_authorizations as auth_record
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
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  protected_reads_available boolean;
begin
  protected_reads_available :=
    workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    and workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp')
    and workspace_private.has_personal_capability(target_workspace_id, 'professional_context');

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
        when not protected_reads_available
          or auth_record.status <> 'connected'
          or auth_record.authorization_valid_after is distinct from grant_record.authorization_valid_after then 'revoked'
        else 'active'
      end
    ) order by grant_record.issued_at desc)
    from workspace_private.professional_context_read_grants as grant_record
    join workspace.mcp_authorizations as auth_record
      on auth_record.id = grant_record.mcp_authorization_id
    where grant_record.workspace_id = target_workspace_id
      and grant_record.user_id = auth.uid()
      and auth_record.workspace_id = grant_record.workspace_id
      and auth_record.created_by = grant_record.user_id
      and auth_record.client_id = grant_record.client_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function workspace.create_professional_context_read_grant(text, text) from public, anon, authenticated;
revoke all on function workspace.list_professional_context_read_grants() from public, anon, authenticated;
grant execute on function workspace.create_professional_context_read_grant(text, text) to authenticated;
grant execute on function workspace.list_professional_context_read_grants() to authenticated;
