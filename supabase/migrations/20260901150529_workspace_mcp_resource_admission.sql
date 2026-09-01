-- DOMAIN OWNER: Lead Emergence Workspace
-- PURPOSE: Bind dynamically registered OAuth clients to the one canonical
-- Workspace MCP resource. This is deliberately additive and never writes to
-- Supabase Auth's internal OAuth catalog.

-- Supabase Auth owns these catalogs. This migration and the runtime resolver
-- only read them, but an incompatible Auth catalog must stop the deployment
-- rather than silently broaden dynamic-client admission.
do $$
declare
  required_authorization_columns constant text[] := array[
    'authorization_id', 'client_id', 'user_id', 'redirect_uri', 'scope',
    'resource', 'code_challenge', 'code_challenge_method', 'status', 'expires_at'
  ];
  required_client_columns constant text[] := array[
    'id', 'registration_type', 'client_type', 'token_endpoint_auth_method',
    'redirect_uris', 'grant_types', 'deleted_at'
  ];
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'auth' and table_name = 'oauth_authorizations'
        and column_name = any(required_authorization_columns)) <> cardinality(required_authorization_columns) then
    raise exception 'Supabase OAuth authorization catalog contract is incompatible; refusing Workspace MCP admission deployment.';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'auth' and table_name = 'oauth_clients'
        and column_name = any(required_client_columns)) <> cardinality(required_client_columns) then
    raise exception 'Supabase OAuth client catalog contract is incompatible; refusing Workspace MCP admission deployment.';
  end if;
end;
$$;

create table if not exists workspace_private.mcp_oauth_resource_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  resource_uri text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_scopes text[] not null default '{}'::text[],
  authorized_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id, resource_uri),
  check (resource_uri = 'https://workspace.leademergence.com/api/mcp'),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);

create index if not exists mcp_oauth_resource_grants_active_client_idx
  on workspace_private.mcp_oauth_resource_grants (user_id, client_id)
  where status = 'active';

create table if not exists workspace_private.mcp_oauth_admission_audit (
  id uuid primary key default gen_random_uuid(),
  user_fingerprint text,
  client_fingerprint text,
  request_fingerprint text,
  event_type text not null check (event_type in (
    'request_classified', 'authorization_approved', 'authorization_denied',
    'grant_activated', 'grant_revoked', 'admission_setting_changed',
    'token_admitted', 'token_rejected', 'transport_initialized',
    'tools_list_completed', 'refresh_observed', 'connection_registered', 'connection_disconnected'
  )),
  reason_code text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists mcp_oauth_admission_audit_request_classified_once_idx
  on workspace_private.mcp_oauth_admission_audit (request_fingerprint, event_type)
  where event_type = 'request_classified';

alter table workspace_private.mcp_oauth_resource_grants enable row level security;
alter table workspace_private.mcp_oauth_admission_audit enable row level security;
revoke all on table workspace_private.mcp_oauth_resource_grants, workspace_private.mcp_oauth_admission_audit from public, anon, authenticated;

insert into workspace_private.product_settings (setting_key, setting_value)
values ('mcp_dynamic_admission_enabled', 'false')
on conflict (setting_key) do nothing;

create or replace function workspace_private.mcp_dynamic_admission_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select setting_value = 'true'
     from workspace_private.product_settings
     where setting_key = 'mcp_dynamic_admission_enabled'),
    false
  );
$$;

create or replace function workspace_private.mcp_admission_fingerprint(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select left(encode(extensions.digest('lead-emergence:workspace-mcp-admission:v1:' || p_value, 'sha256'), 'hex'), 16);
$$;

create or replace function workspace_private.record_mcp_oauth_admission_event(
  p_authorization_id text,
  p_event_type text,
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
  if auth.uid() is null then
    return;
  end if;
  select client_id into v_client_id
  from auth.oauth_authorizations
  where authorization_id = p_authorization_id and user_id = auth.uid()
  limit 1;
  if v_client_id is null then
    return;
  end if;
  insert into workspace_private.mcp_oauth_admission_audit (
    user_fingerprint, client_fingerprint, request_fingerprint, event_type, reason_code
  ) values (
    workspace_private.mcp_admission_fingerprint(auth.uid()::text),
    workspace_private.mcp_admission_fingerprint(v_client_id::text),
    workspace_private.mcp_admission_fingerprint(p_authorization_id),
    p_event_type,
    left(coalesce(nullif(trim(p_reason_code), ''), 'UNSPECIFIED'), 80)
  ) on conflict (request_fingerprint, event_type) where event_type = 'request_classified' do nothing;
end;
$$;

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

  if v_authorization.resource is distinct from 'https://workspace.leademergence.com/api/mcp' then
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
      and grant_record.resource_uri = 'https://workspace.leademergence.com/api/mcp'
      and grant_record.status = 'active'
  ) into v_active;

  return query select 'WORKSPACE_MCP'::text, 'ELIGIBLE'::text, v_authorization.redirect_uri, v_scopes, v_active;
end;
$$;

create or replace function workspace.resolve_mcp_oauth_authorization(p_authorization_id text)
returns table(
  request_class text,
  denial_code text,
  expected_redirect_uri text,
  requested_scopes text[],
  grant_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from workspace_private.resolve_mcp_oauth_authorization(p_authorization_id, false);
$$;

create or replace function workspace.record_mcp_oauth_authorization_event(
  p_authorization_id text,
  p_event_type text,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in ('request_classified', 'authorization_denied') then
    raise exception 'Unsupported MCP OAuth admission event.' using errcode = '22023';
  end if;
  perform workspace_private.record_mcp_oauth_admission_event(p_authorization_id, p_event_type, p_reason_code);
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

create or replace function workspace.mcp_record_observability_event(p_event_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
begin
  if p_event_type not in ('token_admitted', 'transport_initialized', 'tools_list_completed', 'connection_registered', 'connection_disconnected') then
    raise exception 'Unsupported MCP observability event.' using errcode = '22023';
  end if;
  if v_client_id is null or not workspace_private.is_valid_mcp_request() then
    return;
  end if;
  insert into workspace_private.mcp_oauth_admission_audit (user_fingerprint, client_fingerprint, event_type, reason_code)
  values (
    workspace_private.mcp_admission_fingerprint(auth.uid()::text),
    workspace_private.mcp_admission_fingerprint(v_client_id),
    p_event_type, 'MCP_RUNTIME'
  );
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
    and resource_uri = 'https://workspace.leademergence.com/api/mcp'
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

create or replace function workspace_private.set_mcp_dynamic_admission_enabled(
  p_enabled boolean,
  p_reason text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted Workspace operator identity is required.' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 1 and 120 then
    raise exception 'A concise operator reason is required.' using errcode = '22023';
  end if;

  insert into workspace_private.product_settings (setting_key, setting_value, updated_at)
  values ('mcp_dynamic_admission_enabled', case when p_enabled then 'true' else 'false' end, now())
  on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_at = now();

  insert into workspace_private.mcp_oauth_admission_audit (event_type, reason_code)
  values ('admission_setting_changed', v_reason);

  return p_enabled;
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
    and auth.jwt() ->> 'aud' = (
      select setting_value
      from workspace_private.product_settings
      where setting_key = 'mcp_resource_uri'
    )
    and exists (
      select 1
      from workspace_private.mcp_oauth_resource_grants as grant_record
      where grant_record.user_id = auth.uid()
        and grant_record.client_id::text = auth.jwt() ->> 'client_id'
        and grant_record.resource_uri = 'https://workspace.leademergence.com/api/mcp'
        and grant_record.status = 'active'
    );
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
  grant_is_active boolean := false;
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
    select exists(
      select 1
      from workspace_private.mcp_oauth_resource_grants as grant_record
      where grant_record.user_id = token_user_id
        and grant_record.client_id::text = token_client_id
        and grant_record.resource_uri = 'https://workspace.leademergence.com/api/mcp'
        and grant_record.status = 'active'
    ) into grant_is_active;
  end if;

  if grant_is_active then
    select setting_value into resource_uri
    from workspace_private.product_settings
    where setting_key = 'mcp_resource_uri';

    claims := jsonb_set(claims, '{client_id}', to_jsonb(token_client_id), true);
    claims := jsonb_set(claims, '{aud}', to_jsonb(resource_uri), true);
    claims := jsonb_set(claims, '{workspace_mcp}', 'true'::jsonb, true);
  else
    claims := claims - 'workspace_mcp';
  end if;

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

create or replace function workspace.disconnect_personal_mcp(target_client_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  select id into target_workspace_id from workspace.workspaces
  where owner_user_id = auth.uid() and workspace_type = 'personal' limit 1;
  update workspace.mcp_authorizations set
    status = 'disconnected',
    disconnected_at = now(),
    authorization_valid_after = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and created_by = auth.uid() and client_id = target_client_id;
  if not found then
    raise exception 'AI assistant authorization not found.' using errcode = '22023';
  end if;
  perform workspace_private.revoke_mcp_oauth_resource_grant(auth.uid(), target_client_id, 'WORKSPACE_SETTINGS');
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (target_workspace_id, 'mcp_disconnected', '{"client_id_present":true}'::jsonb, auth.uid());
end;
$$;

create or replace function workspace.mcp_disconnect_current_assistant()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('workspace_mcp');
  current_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  was_disconnected boolean := false;
  updated_connection_count integer := 0;
begin
  if current_client_id is null then
    raise exception 'This assistant connection is missing its registered client identity.' using errcode = '42501';
  end if;
  update workspace.mcp_authorizations
  set status = 'disconnected', disconnected_at = now(), authorization_valid_after = now(), updated_at = now()
  where workspace_id = target_workspace_id and created_by = auth.uid() and client_id = current_client_id and status <> 'disconnected';
  get diagnostics updated_connection_count = row_count;
  was_disconnected := updated_connection_count > 0;
  perform workspace_private.revoke_mcp_oauth_resource_grant(auth.uid(), current_client_id, 'MCP_SELF_SERVICE');
  if was_disconnected then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (target_workspace_id, 'mcp_disconnected', jsonb_build_object('interface', 'mcp', 'self_service', true), auth.uid());
  end if;
  return jsonb_build_object('workspace_id', target_workspace_id, 'disconnected', true, 'already_disconnected', not was_disconnected);
end;
$$;

create or replace function workspace.mcp_disconnect_assistant_connection(target_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('workspace_mcp');
  target_provider text;
  target_client_id text;
  was_disconnected boolean := false;
  updated_connection_count integer := 0;
begin
  if target_connection_id is null then
    raise exception 'An assistant connection identifier is required.' using errcode = '22023';
  end if;
  select assistant_provider, client_id into target_provider, target_client_id
  from workspace.mcp_authorizations
  where id = target_connection_id and workspace_id = target_workspace_id and created_by = auth.uid()
  for update;
  if not found then
    return jsonb_build_object('connection_id', target_connection_id, 'disconnected', false, 'already_absent', true);
  end if;
  update workspace.mcp_authorizations
  set status = 'disconnected', disconnected_at = now(), authorization_valid_after = now(), updated_at = now()
  where id = target_connection_id and workspace_id = target_workspace_id and created_by = auth.uid() and status <> 'disconnected';
  get diagnostics updated_connection_count = row_count;
  was_disconnected := updated_connection_count > 0;
  perform workspace_private.revoke_mcp_oauth_resource_grant(auth.uid(), target_client_id, 'MCP_CONNECTION_LIST');
  if was_disconnected then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (target_workspace_id, 'mcp_disconnected', jsonb_build_object('interface', 'mcp', 'self_service', false, 'assistant_provider', target_provider), auth.uid());
  end if;
  return jsonb_build_object('workspace_id', target_workspace_id, 'connection_id', target_connection_id, 'assistant_provider', target_provider, 'disconnected', true, 'already_disconnected', not was_disconnected);
end;
$$;

revoke all on function workspace_private.mcp_dynamic_admission_enabled() from public, anon, authenticated;
revoke all on function workspace_private.mcp_admission_fingerprint(text) from public, anon, authenticated;
revoke all on function workspace_private.record_mcp_oauth_admission_event(text, text, text) from public, anon, authenticated;
revoke all on function workspace_private.resolve_mcp_oauth_authorization(text, boolean) from public, anon, authenticated;
revoke all on function workspace_private.revoke_mcp_oauth_resource_grant(uuid, text, text) from public, anon, authenticated;
revoke all on function workspace_private.set_mcp_dynamic_admission_enabled(boolean, text) from public, anon, authenticated;
revoke all on function workspace_private.is_valid_mcp_request() from public, anon, authenticated;
revoke all on function workspace_private.custom_access_token_hook(jsonb) from public, anon, authenticated;
revoke all on function workspace.resolve_mcp_oauth_authorization(text) from public, anon;
revoke all on function workspace.record_mcp_oauth_authorization_event(text, text, text) from public, anon;
revoke all on function workspace.activate_mcp_oauth_grant(text) from public, anon;
revoke all on function workspace.mcp_record_observability_event(text) from public, anon;
grant execute on function workspace.resolve_mcp_oauth_authorization(text) to authenticated;
grant execute on function workspace.record_mcp_oauth_authorization_event(text, text, text) to authenticated;
grant execute on function workspace.activate_mcp_oauth_grant(text) to authenticated;
grant execute on function workspace.mcp_record_observability_event(text) to authenticated;
grant execute on function workspace_private.set_mcp_dynamic_admission_enabled(boolean, text) to service_role;
grant execute on function workspace_private.custom_access_token_hook(jsonb) to supabase_auth_admin;

notify pgrst, 'reload schema';
