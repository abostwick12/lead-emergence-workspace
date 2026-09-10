-- P13 native-only privacy center. No assignment, provider release or hosted change.
create function workspace_private.require_connection_center_owner()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null or auth.jwt()->>'client_id' is not null or not workspace_private.is_direct_session() then
  raise exception 'Use the native Workspace connection center.' using errcode='42501';
 end if;
 select w.id into target from workspace.workspaces w join workspace.workspace_memberships m on m.workspace_id=w.id
 where w.owner_user_id=auth.uid() and w.workspace_type='personal'
 and m.user_id=auth.uid() and m.role='owner' and m.status='active' order by w.created_at,w.id limit 1;
 if target is null then raise exception 'An active Workspace owner is required.' using errcode='42501';end if;
 -- Deliberately not paywalled: owners can inspect and revoke access after plan loss.
 return target;
end;$$;

create function workspace_private.connection_center_rows(target uuid)
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
   encode(extensions.digest(jsonb_build_array(to_jsonb(a),to_jsonb(g),c.deleted_at,c.id)::text,'sha256'),'hex') rev,
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
   select jsonb_agg(to_jsonb(c) order by c.provider) rows,
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

create function workspace.native_connection_center(p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_connection_center_owner();result jsonb;
begin
 if p_offset is null or p_offset not between 0 and 2147483000 or p_offset%25<>0 then
  raise exception 'Choose a valid connection page.' using errcode='22023';end if;
 with entries as materialized(select * from workspace_private.connection_center_rows(target)),
 assistants as(select * from entries where kind='assistant'),
 page as(select * from assistants order by connection_id limit 25 offset p_offset)
 select jsonb_build_object(
  'workspaceId',target,'retrievedAt',now(),'offset',p_offset,'pageSize',25,
  'assistantAccessIncluded',workspace_private.has_personal_capability(target,'core_workspace') and workspace_private.has_personal_capability(target,'workspace_mcp'),
  'assistantAdmissionEnabled',workspace_private.mcp_dynamic_admission_enabled(),
  'externalAccessIncluded',workspace_private.has_personal_capability(target,'external_connectors') and exists(
   select 1 from workspace.personal_plans p join workspace.plan_capabilities c on c.plan_key=p.plan_key
   where p.workspace_id=target and p.user_id=auth.uid() and p.status='active'
   and c.capability_key='integration_limit' and c.enabled and c.limit_value>0),
  'assistantTotal',(select count(*) from assistants),
  'authorizedTotal',(select count(*) from assistants where item->>'state'='authorized'),
  'activeGrantTotal',(select count(*) from assistants where (item->>'grantActive')::boolean),
  'assistants',coalesce((select jsonb_agg(item order by connection_id) from page),'[]'::jsonb),
  'external',coalesce((select jsonb_agg(item order by reference) from entries where kind='external'),'[]'::jsonb),
  'releasedProviders',coalesce((select jsonb_agg(provider order by provider) from workspace_private.integration_provider_releases where connection_enabled),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

create table workspace_private.connection_disconnect_receipts(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(workspace_id,user_id,request_id)
);
alter table workspace_private.connection_disconnect_receipts enable row level security;
revoke all on workspace_private.connection_disconnect_receipts from public,anon,authenticated;

create function workspace.native_disconnect_connection(
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
revoke all on function workspace_private.require_connection_center_owner(),workspace_private.connection_center_rows(uuid) from public,anon,authenticated;
revoke all on function workspace.native_connection_center(integer),workspace.native_disconnect_connection(text,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function workspace.native_connection_center(integer),workspace.native_disconnect_connection(text,text,text,uuid,boolean) to authenticated;
