-- Consent activation and reviewed revocation share a user-bound lock, including
-- first-time grants that have no existing row to lock. No OAuth protocol change.
create or replace function workspace.activate_mcp_oauth_grant(p_authorization_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved record;
  v_client_id uuid;
begin
  select * into resolved
  from workspace_private.resolve_mcp_oauth_authorization(p_authorization_id, true);

  if resolved.request_class <> 'WORKSPACE_MCP' then
    raise exception 'The requested OAuth authorization is not eligible for Workspace MCP.' using errcode = '42501';
  end if;

  select oauth_authorization.client_id into v_client_id
  from auth.oauth_authorizations as oauth_authorization
  where oauth_authorization.authorization_id = p_authorization_id
    and oauth_authorization.user_id = auth.uid()
    and oauth_authorization.status = 'approved'
  limit 1;

  if v_client_id is null then
    raise exception 'The OAuth authorization could not be activated.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workspace-mcp-grant:'||auth.uid()::text,0));

  insert into workspace_private.mcp_oauth_resource_grants (
    user_id, client_id, resource_uri, status, granted_scopes, authorized_at, revoked_at, updated_at
  ) values (
    auth.uid(), v_client_id, 'https://workspace.leademergence.com/api/mcp', 'active', resolved.requested_scopes, now(), null, now()
  ) on conflict (user_id, client_id, resource_uri) do update set
    status = 'active',
    granted_scopes = excluded.granted_scopes,
    authorized_at = excluded.authorized_at,
    revoked_at = null,
    updated_at = now();

  perform workspace_private.record_mcp_oauth_admission_event(p_authorization_id, 'authorization_approved', 'EXPLICIT_CONSENT');
  insert into workspace_private.mcp_oauth_admission_audit (user_fingerprint, client_fingerprint, event_type, reason_code)
  values (
    workspace_private.mcp_admission_fingerprint(auth.uid()::text),
    workspace_private.mcp_admission_fingerprint(v_client_id::text),
    'grant_activated', 'EXPLICIT_CONSENT'
  );

  return jsonb_build_object('status', 'active');
end;
$$;

create or replace function workspace.native_disconnect_connection(
 p_kind text,p_id text,p_revision text,p_request_id uuid,p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=workspace_private.require_connection_center_owner();review jsonb;
 saved workspace_private.connection_disconnect_receipts%rowtype;entry record;result jsonb;
begin
 if p_kind is null or p_kind not in ('assistant','external') or p_id is null or p_id!~'^[0-9a-f]{64}$'
 or p_revision is null or p_revision!~'^[0-9a-f]{64}$' or p_request_id is null or p_confirmed is distinct from true then
  raise exception 'Review and confirm the exact connection change.' using errcode='22023';end if;
 review:=jsonb_build_object('kind',p_kind,'id',p_id,'revision',p_revision);
 -- Shared with existing external setup/save paths; serializes family changes and retries.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,0));
 select * into saved from workspace_private.connection_disconnect_receipts
 where workspace_id=target and user_id=auth.uid() and request_id=p_request_id;
 if found then
  if saved.payload is distinct from review then raise exception 'This request was used for a different review.' using errcode='40001';end if;
  return saved.result;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workspace-mcp-grant:'||auth.uid()::text,0));
 -- Lock before recomputing the reviewed fingerprint. Consent activation updates
 -- grant rows; registration updates authorization rows. Neither is a display label.
 perform 1 from workspace_private.mcp_oauth_resource_grants where user_id=auth.uid()
 and resource_uri='https://workspace.leademergence.com/api/mcp' order by client_id for update;
 perform 1 from workspace.mcp_authorizations where workspace_id=target and created_by=auth.uid() order by id for update;
 perform 1 from workspace.integration_connections where workspace_id=target order by id for update;
 perform 1 from workspace_private.integration_credentials where workspace_id=target order by id for update;
 select * into entry from workspace_private.connection_center_rows(target) where kind=p_kind and connection_id=p_id;
 if not found then raise exception 'This connection is unavailable.' using errcode='42501';end if;
 if entry.revision is distinct from p_revision then raise exception 'Connection changed. Refresh and review again.' using errcode='40001';end if;
 if not (entry.item->>'canDisconnect')::boolean then raise exception 'Connection already disconnected. Refresh the center.' using errcode='40001';end if;
 if p_kind='assistant' then
  perform workspace_private.revoke_mcp_oauth_resource_grant(auth.uid(),entry.reference,'NATIVE_CONNECTION_REVIEW');
  update workspace.mcp_authorizations set status='disconnected',disconnected_at=now(),
   authorization_valid_after=now(),updated_at=now()
  where workspace_id=target and created_by=auth.uid() and client_id=entry.reference;
  result:=jsonb_build_object('requestId',p_request_id,'kind',p_kind,'id',p_id,'disconnectedAt',now(),
   'scope','workspace_assistant_access','affectedProviders',jsonb_build_array(entry.item->>'provider'));
 else
  delete from workspace_private.integration_credentials where workspace_id=target and provider_family=entry.reference;
  delete from workspace_private.integration_oauth_attempts where workspace_id=target
   and workspace_private.integration_provider_family(provider)=entry.reference;
  update workspace.integration_connections set status='disconnected',connected_account_label=null,scopes='{}'::text[],
   secret_reference=null,connected_at=null,last_error_at=null,last_error_code=null,updated_at=now()
  where workspace_id=target and workspace_private.integration_provider_family(provider)=entry.reference;
  result:=jsonb_build_object('requestId',p_request_id,'kind',p_kind,'id',p_id,'disconnectedAt',now(),
   'scope','workspace_credential_family','affectedProviders',entry.item->'providers');
 end if;
 insert into workspace_private.connection_disconnect_receipts(workspace_id,user_id,request_id,payload,result)
 values(target,auth.uid(),p_request_id,review,result);
 return result;
end;$$;
