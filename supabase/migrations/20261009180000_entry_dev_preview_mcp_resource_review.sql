-- DOMAIN OWNER: Lead Emergence Workspace
-- REVIEW ONLY: source for an Entry-dev Preview MCP resource. Hosted application
-- belongs to Ministry and requires a separate target-specific approval.
-- The Preview URI is deliberately unset. An operator must approve an exact
-- HTTPS /api/mcp URI before an OAuth authorization can use it.
-- Existing canonical grants and tokens remain valid.

do $$
declare
  v_constraint_name text;
begin
  if (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri')
    is distinct from 'https://workspace.leademergence.com/api/mcp' then
    raise exception 'Unexpected canonical MCP resource; refusing Preview authorization change.';
  end if;
  if exists (select 1 from workspace_private.mcp_oauth_resource_grants
             where resource_uri <> 'https://workspace.leademergence.com/api/mcp') then
    raise exception 'Unexpected MCP resource grants; refusing Preview authorization change.';
  end if;
  if exists (select 1 from workspace_private.product_settings
             where setting_key = 'mcp_preview_resource_uri' and setting_value <> '') then
    raise exception 'Preview MCP resource already configured; refusing migration.';
  end if;
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'workspace_private.mcp_oauth_resource_grants'::regclass
    and pg_get_constraintdef(oid) =
      'CHECK ((resource_uri = ''https://workspace.leademergence.com/api/mcp''::text))';
  if v_constraint_name is null then
    raise exception 'Canonical-only grant constraint is missing or changed.';
  end if;
  execute format('alter table workspace_private.mcp_oauth_resource_grants drop constraint %I', v_constraint_name);
end;
$$;

-- Retain a syntactic defense at storage; the security-definer admission and
-- token functions enforce the exact configured allowlist below. No direct
-- anon/authenticated table privileges are added.
alter table workspace_private.mcp_oauth_resource_grants
  add constraint mcp_oauth_resource_grants_https_mcp_resource_check
  check (resource_uri ~ '^https://[a-z0-9.-]+/api/mcp$');

-- One OAuth client may have only one current token audience. The token hook
-- cannot infer which of two active grants a refresh request meant to use.
create unique index mcp_oauth_resource_grants_one_active_resource_per_client_idx
  on workspace_private.mcp_oauth_resource_grants (user_id, client_id)
  where status = 'active';

insert into workspace_private.product_settings (setting_key, setting_value)
values ('mcp_preview_resource_uri', '')
on conflict (setting_key) do nothing;

create or replace function workspace_private.resolve_mcp_oauth_authorization(
  p_authorization_id text,
  p_require_approved boolean default false
)
returns table(
  request_class text,
  denial_code text,
  expected_redirect_uri text,
  requested_scopes text[],
  grant_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authorization auth.oauth_authorizations%rowtype;
  v_client auth.oauth_clients%rowtype;
  v_scopes text[];
  v_allowed_scopes constant text[] := array['openid', 'profile', 'email', 'phone', 'offline_access'];
  v_grant_types text[];
  v_active boolean := false;
begin
  if auth.uid() is null then
    return query select 'DENY'::text, 'NO_SESSION'::text, null::text, '{}'::text[], false;
    return;
  end if;

  if not workspace_private.mcp_dynamic_admission_enabled() then
    return query select 'DENY'::text, 'ADMISSION_DISABLED'::text, null::text, '{}'::text[], false;
    return;
  end if;

  select oauth_authorization.*
    into v_authorization
  from auth.oauth_authorizations as oauth_authorization
  where oauth_authorization.authorization_id = p_authorization_id
    and oauth_authorization.user_id = auth.uid()
  limit 1;

  if not found then
    return query select 'DENY'::text, 'REQUEST_UNAVAILABLE'::text, null::text, '{}'::text[], false;
    return;
  end if;

  select client.*
    into v_client
  from auth.oauth_clients as client
  where client.id = v_authorization.client_id
    and client.deleted_at is null
  limit 1;

  if not found then
    return query select 'DENY'::text, 'CLIENT_UNAVAILABLE'::text, null::text, '{}'::text[], false;
    return;
  end if;

  v_scopes := array_remove(regexp_split_to_array(trim(v_authorization.scope), '\s+'), '');
  v_grant_types := array_remove(regexp_split_to_array(v_client.grant_types, '\s*,\s*'), '');

  if v_authorization.status not in ('pending', 'approved')
    or (p_require_approved and v_authorization.status <> 'approved') then
    return query select 'DENY'::text, 'REQUEST_STATE_INVALID'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if v_authorization.expires_at <= now() then
    return query select 'DENY'::text, 'REQUEST_EXPIRED'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if v_client.registration_type <> 'dynamic'
    or v_client.client_type <> 'public'
    or v_client.token_endpoint_auth_method <> 'none'
    or not (v_grant_types @> array['authorization_code', 'refresh_token']) then
    return query select 'DENY'::text, 'CLIENT_CLASS_INVALID'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if v_authorization.resource is distinct from (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri')
    and (v_authorization.resource is null or v_authorization.resource is distinct from (
      select nullif(setting_value, '') from workspace_private.product_settings where setting_key = 'mcp_preview_resource_uri'
    )) then
    return query select 'DENY'::text, 'RESOURCE_INVALID'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if v_authorization.code_challenge is null
    or v_authorization.code_challenge_method::text <> 's256' then
    return query select 'DENY'::text, 'PKCE_INVALID'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if not ('openid' = any(v_scopes))
    or exists (select 1 from unnest(v_scopes) as requested(scope_name) where requested.scope_name <> all(v_allowed_scopes)) then
    return query select 'DENY'::text, 'SCOPE_INVALID'::text, null::text, coalesce(v_scopes, '{}'::text[]), false;
    return;
  end if;

  if not (v_authorization.redirect_uri = any(string_to_array(v_client.redirect_uris, ','))) then
    return query select 'DENY'::text, 'REDIRECT_INVALID'::text, null::text, v_scopes, false;
    return;
  end if;

  select exists(
    select 1
    from workspace_private.mcp_oauth_resource_grants as grant_record
    where grant_record.user_id = auth.uid()
      and grant_record.client_id = v_client.id
      and grant_record.resource_uri = v_authorization.resource
      and grant_record.status = 'active'
  ) into v_active;

  return query select 'WORKSPACE_MCP'::text, 'ELIGIBLE'::text, v_authorization.redirect_uri, v_scopes, v_active;
end;
$$;

create or replace function workspace.activate_mcp_oauth_grant(p_authorization_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved record;
  v_client_id uuid;
  v_resource_uri text;
begin
  select * into resolved
  from workspace_private.resolve_mcp_oauth_authorization(p_authorization_id, true);

  if resolved.request_class <> 'WORKSPACE_MCP' then
    raise exception 'The requested OAuth authorization is not eligible for Workspace MCP.' using errcode = '42501';
  end if;

  select oauth_authorization.client_id, oauth_authorization.resource into v_client_id, v_resource_uri
  from auth.oauth_authorizations as oauth_authorization
  where oauth_authorization.authorization_id = p_authorization_id
    and oauth_authorization.user_id = auth.uid()
    and oauth_authorization.status = 'approved'
  limit 1;

  if v_client_id is null then
    raise exception 'The OAuth authorization could not be activated.' using errcode = '42501';
  end if;

  if exists (
    select 1 from workspace_private.mcp_oauth_resource_grants as grant_record
    where grant_record.user_id = auth.uid()
      and grant_record.client_id = v_client_id
      and grant_record.resource_uri <> v_resource_uri
      and grant_record.status = 'active'
  ) then
    raise exception 'This OAuth client is already active for another MCP resource.' using errcode = '42501';
  end if;

  insert into workspace_private.mcp_oauth_resource_grants (
    user_id, client_id, resource_uri, status, granted_scopes, authorized_at, revoked_at, updated_at
  ) values (
    auth.uid(), v_client_id, v_resource_uri, 'active', resolved.requested_scopes, now(), null, now()
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

create or replace function workspace_private.revoke_mcp_oauth_resource_grant(
  p_user_id uuid,
  p_client_id text,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  begin
    v_client_id := p_client_id::uuid;
  exception when invalid_text_representation then
    return;
  end;

  update workspace_private.mcp_oauth_resource_grants
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where user_id = p_user_id
    and client_id = v_client_id
    and status = 'active';

  if found then
    insert into workspace_private.mcp_oauth_admission_audit (user_fingerprint, client_fingerprint, event_type, reason_code)
    values (
      workspace_private.mcp_admission_fingerprint(p_user_id::text),
      workspace_private.mcp_admission_fingerprint(v_client_id::text),
      'grant_revoked', left(coalesce(nullif(trim(p_reason_code), ''), 'WORKSPACE_DISCONNECT'), 80)
    );
  end if;
end;
$$;

create or replace function workspace_private.is_valid_mcp_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and workspace_private.mcp_dynamic_admission_enabled()
    and nullif(auth.jwt() ->> 'client_id', '') is not null
    and coalesce(auth.jwt() ->> 'workspace_mcp', 'false') = 'true'
    and auth.jwt() ->> 'aud' in (
      select setting_value from workspace_private.product_settings
      where setting_key = 'mcp_resource_uri'
      union all
      select nullif(setting_value, '') from workspace_private.product_settings
      where setting_key = 'mcp_preview_resource_uri'
    )
    and exists (
      select 1
      from workspace_private.mcp_oauth_resource_grants as grant_record
      where grant_record.user_id = auth.uid()
        and grant_record.client_id::text = auth.jwt() ->> 'client_id'
        and grant_record.resource_uri = auth.jwt() ->> 'aud'
        and grant_record.status = 'active'
    )
    and (select count(*) from workspace_private.mcp_oauth_resource_grants as grant_record
         where grant_record.user_id = auth.uid()
           and grant_record.client_id::text = auth.jwt() ->> 'client_id'
           and grant_record.status = 'active') = 1;
$$;

create or replace function workspace_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  resource_uri text;
  token_client_id text := nullif(claims ->> 'client_id', '');
  token_session_id uuid;
  token_user_id uuid;
  active_grant_count integer := 0;
begin
  begin
    token_user_id := (claims ->> 'sub')::uuid;
  exception when invalid_text_representation then
    token_user_id := null;
  end;

  if token_client_id is null then
    begin
      token_session_id := (claims ->> 'session_id')::uuid;
    exception when invalid_text_representation then
      token_session_id := null;
    end;

    if token_session_id is not null and token_user_id is not null then
      select oauth_client_id::text into token_client_id
      from auth.sessions
      where id = token_session_id
        and user_id = token_user_id
        and oauth_client_id is not null;
    end if;
  end if;

  if token_client_id is not null and token_user_id is not null and workspace_private.mcp_dynamic_admission_enabled() then
    select count(*), min(grant_record.resource_uri)
      into active_grant_count, resource_uri
    from workspace_private.mcp_oauth_resource_grants as grant_record
    where grant_record.user_id = token_user_id
      and grant_record.client_id::text = token_client_id
      and grant_record.status = 'active';
  end if;

  -- A client with grants for two resources has no unambiguous token audience.
  if active_grant_count = 1 and resource_uri in (
    select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'
    union all
    select nullif(setting_value, '') from workspace_private.product_settings where setting_key = 'mcp_preview_resource_uri'
  ) then

    claims := jsonb_set(claims, '{client_id}', to_jsonb(token_client_id), true);
    claims := jsonb_set(claims, '{aud}', to_jsonb(resource_uri), true);
    claims := jsonb_set(claims, '{workspace_mcp}', 'true'::jsonb, true);
  else
    claims := claims - 'workspace_mcp';
  end if;

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

-- Preserve explicit function grants from the original admission migration.
revoke all on function workspace_private.resolve_mcp_oauth_authorization(text, boolean) from public, anon, authenticated;
revoke all on function workspace_private.revoke_mcp_oauth_resource_grant(uuid, text, text) from public, anon, authenticated;
revoke all on function workspace_private.is_valid_mcp_request() from public, anon, authenticated;
revoke all on function workspace_private.custom_access_token_hook(jsonb) from public, anon, authenticated;
revoke all on function workspace.activate_mcp_oauth_grant(text) from public, anon;
grant execute on function workspace.activate_mcp_oauth_grant(text) to authenticated;
grant execute on function workspace_private.custom_access_token_hook(jsonb) to supabase_auth_admin;

notify pgrst, 'reload schema';
