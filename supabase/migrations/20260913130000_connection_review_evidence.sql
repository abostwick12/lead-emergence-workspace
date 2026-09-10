-- Review fingerprints represent authorization/credential changes, not ordinary
-- request timestamps. A busy assistant must remain disconnectable. New consent,
-- registration-state changes, scopes and credential replacement still invalidate.
create or replace function workspace_private.connection_center_rows(target uuid)
returns table(kind text,connection_id text,reference text,revision text,item jsonb)
language sql security definer set search_path='' as $$
 with assistant_keys as (
  select a.client_id from workspace.mcp_authorizations a where a.workspace_id=target and a.created_by=auth.uid()
  union select g.client_id::text from workspace_private.mcp_oauth_resource_grants g
  where g.user_id=auth.uid() and g.resource_uri='https://workspace.leademergence.com/api/mcp'
 ), assistants as (
  select k.client_id,a.assistant_provider,a.status,a.connected_at,a.last_verified_at,
   coalesce(g.status='active',false) grant_active,g.granted_scopes,g.authorized_at,
   encode(extensions.digest(target::text||':assistant:'||k.client_id,'sha256'),'hex') id,
   encode(extensions.digest(jsonb_build_array(a.id,a.workspace_id,a.client_id,a.assistant_provider,a.status,a.created_by,a.disconnected_at,g.status,g.granted_scopes,g.authorized_at,g.revoked_at,c.deleted_at,c.id)::text,'sha256'),'hex') rev,
   case
    when g.status='revoked' then 'revoked'
    when g.status='active' and (c.id is null or c.deleted_at is not null
      or not workspace_private.mcp_dynamic_admission_enabled()
      or not workspace_private.has_personal_capability(target,'core_workspace')
      or not workspace_private.has_personal_capability(target,'workspace_mcp')) then 'blocked'
    when g.status='active' and a.status='connected' then 'authorized'
    when g.status='active' and (a.status is null or a.status='connecting') then 'setup_required'
    when g.status='active' then 'blocked'
    when a.status='disconnected' then 'disconnected' else 'unverified' end state
  from assistant_keys k
  left join workspace.mcp_authorizations a on a.client_id=k.client_id and a.workspace_id=target and a.created_by=auth.uid()
  left join workspace_private.mcp_oauth_resource_grants g on g.client_id::text=k.client_id
   and g.user_id=auth.uid() and g.resource_uri='https://workspace.leademergence.com/api/mcp'
  left join auth.oauth_clients c on c.id::text=k.client_id
 ), family_keys as (
  select workspace_private.integration_provider_family(c.provider) family
  from workspace.integration_connections c where c.workspace_id=target
  and workspace_private.integration_provider_family(c.provider) is not null
  union select v.provider_family from workspace_private.integration_credentials v where v.workspace_id=target
  union select workspace_private.integration_provider_family(o.provider) from workspace_private.integration_oauth_attempts o where o.workspace_id=target
 ), families as (
  select f.family,v.id credential_id,v.token_expires_at,v.revoked_at,
   coalesce(m.rows,'[]'::jsonb) metadata,
   case f.family
    when 'google' then array['gmail','google_calendar','google_drive']
    when 'microsoft' then array['powerpoint']
    when 'openai' then array['chatgpt']
    when 'anthropic' then array['claude']
    else array[f.family] end providers,
   coalesce(m.has_connected,false) has_connected,coalesce(m.has_other,false) has_other,
   m.last_recorded,
   encode(extensions.digest(target::text||':external:'||f.family,'sha256'),'hex') id,
   encode(extensions.digest(jsonb_build_array(m.rows,v.id,v.key_version,v.updated_at,v.token_expires_at,v.revoked_at,attempts.rows)::text,'sha256'),'hex') rev,
   case when v.id is null then 'missing' when v.revoked_at is not null then 'revoked'
    when v.token_expires_at<=now() then 'expired' else 'recorded' end credential_state,
   v.id is not null or coalesce(m.has_live_metadata,false) or coalesce(attempts.total,0)>0 can_disconnect
  from family_keys f
  left join workspace_private.integration_credentials v on v.workspace_id=target and v.provider_family=f.family
  left join lateral (
   select jsonb_agg(jsonb_build_array(c.id,c.provider,c.status,c.scopes,c.secret_reference,c.created_by) order by c.provider) rows,
    bool_or(c.status='connected') has_connected,bool_or(c.status not in ('connected','disconnected')) has_other,
    bool_or(c.status<>'disconnected' or c.secret_reference is not null) has_live_metadata,max(c.last_success_at) last_recorded
   from workspace.integration_connections c where c.workspace_id=target
    and workspace_private.integration_provider_family(c.provider)=f.family
  ) m on true
  left join lateral (
   select jsonb_agg(jsonb_build_array(o.id,o.created_at,o.expires_at,o.state_hash) order by o.id) rows,count(*) total
   from workspace_private.integration_oauth_attempts o where o.workspace_id=target
    and workspace_private.integration_provider_family(o.provider)=f.family
  ) attempts on true
 )
 select 'assistant',a.id,a.client_id,a.rev,jsonb_build_object(
  'kind','assistant','id',a.id,'revision',a.rev,'provider',coalesce(a.assistant_provider,'other'),
  'state',a.state,'grantActive',a.grant_active,'registered',coalesce(a.status='connected',false),
  'canDisconnect',a.grant_active or coalesce(a.status<>'disconnected',false),
  'scopes',coalesce(a.granted_scopes,'{}'::text[]),'registeredAt',a.last_verified_at,'authorizedAt',a.authorized_at
 ) from assistants a
 union all
 select 'external',f.id,f.family,f.rev,jsonb_build_object(
  'kind','external','id',f.id,'revision',f.rev,'family',f.family,'providers',f.providers,
  'canDisconnect',f.can_disconnect,'credentialState',f.credential_state,
  'metadataState',case when f.has_connected then 'connected' when f.has_other then 'needs_review' else 'disconnected' end,
  'lastRecordedAt',f.last_recorded,'expiresAt',f.token_expires_at
 ) from families f;
$$;
