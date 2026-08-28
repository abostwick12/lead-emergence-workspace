-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: fail closed for external connection consent, credential storage, and plan limits.
--
-- This migration hardens the source-only integration vault introduced in
-- 20260825000000_workspace_integration_vault.sql. It must not be applied to a
-- hosted project until the recorded production integration gate is approved.

alter table workspace_private.integration_credentials enable row level security;
alter table workspace_private.integration_oauth_attempts enable row level security;

revoke all on table workspace_private.integration_credentials from public, anon, authenticated;
revoke all on table workspace_private.integration_oauth_attempts from public, anon, authenticated;

create or replace function workspace_private.integration_provider_family(p_provider text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_provider
    when 'logos' then 'logos'
    when 'gmail' then 'google'
    when 'google_calendar' then 'google'
    when 'google_drive' then 'google'
    when 'slack' then 'slack'
    when 'monday' then 'monday'
    when 'github' then 'github'
    when 'linkedin' then 'linkedin'
    when 'firecrawl' then 'firecrawl'
    when 'canva' then 'canva'
    when 'powerpoint' then 'microsoft'
    when 'youversion' then 'youversion'
    else null
  end;
$$;

revoke all on function workspace_private.integration_provider_family(text) from public, anon, authenticated;

create or replace function workspace_private.require_external_connector_workspace(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_limit integer;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change external connections.' using errcode = '42501';
  end if;

  if not workspace_private.has_personal_capability(p_workspace_id, 'external_connectors') then
    raise exception 'External connections are not included for the current Personal plan.' using errcode = '42501';
  end if;

  select coalesce(plan_capability.limit_value, 0)
    into target_limit
  from workspace.personal_plans as personal_plan
  join workspace.plan_capabilities as plan_capability
    on plan_capability.plan_key = personal_plan.plan_key
  where personal_plan.workspace_id = p_workspace_id
    and personal_plan.user_id = auth.uid()
    and personal_plan.status = 'active'
    and plan_capability.capability_key = 'integration_limit'
    and plan_capability.enabled
  limit 1;

  if coalesce(target_limit, 0) < 1 then
    raise exception 'External connection capacity is not included for the current Personal plan.' using errcode = '42501';
  end if;

  return target_limit;
end;
$$;

revoke all on function workspace_private.require_external_connector_workspace(uuid) from public, anon, authenticated;

create or replace function workspace_private.require_integration_slot(
  p_workspace_id uuid,
  p_provider_family text,
  p_integration_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_family_count bigint;
  requested_family_exists boolean;
begin
  if p_provider_family is null or coalesce(p_integration_limit, 0) < 1 then
    raise exception 'A valid external connection slot is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 0));

  with active_families as (
    select credential.provider_family as family
    from workspace_private.integration_credentials as credential
    where credential.workspace_id = p_workspace_id
      and credential.revoked_at is null
    union
    select workspace_private.integration_provider_family(connection.provider) as family
    from workspace.integration_connections as connection
    where connection.workspace_id = p_workspace_id
      and connection.status = 'connected'
    union
    select workspace_private.integration_provider_family(attempt.provider) as family
    from workspace_private.integration_oauth_attempts as attempt
    where attempt.workspace_id = p_workspace_id
      and attempt.consumed_at is null
      and attempt.expires_at > now()
  )
  select count(*), coalesce(bool_or(family = p_provider_family), false)
    into active_family_count, requested_family_exists
  from active_families
  where family is not null;

  if requested_family_exists then
    return;
  end if;

  if active_family_count >= p_integration_limit then
    raise exception 'The current Personal plan has reached its external connection capacity.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function workspace_private.require_integration_slot(uuid, text, integer) from public, anon, authenticated;

create or replace function workspace.save_integration_connection(
  p_workspace_id uuid,
  p_provider text,
  p_provider_family text,
  p_status text,
  p_account_label text,
  p_scopes text[],
  p_ciphertext text default null,
  p_key_version smallint default 1,
  p_account_subject_hash text default null,
  p_token_expires_at timestamptz default null,
  p_refresh_token_present boolean default false
)
returns workspace.integration_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_connection workspace.integration_connections;
  credential_id uuid;
  expected_provider_family text;
  integration_limit integer;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change connections.' using errcode = '42501';
  end if;

  expected_provider_family := workspace_private.integration_provider_family(p_provider);
  if expected_provider_family is null then
    raise exception 'Unsupported integration provider.' using errcode = '22023';
  end if;
  if p_provider_family is distinct from expected_provider_family then
    raise exception 'The provider does not match its credential family.' using errcode = '22023';
  end if;
  if p_status not in ('connected', 'disconnected', 'error') then
    raise exception 'Unsupported integration status.' using errcode = '22023';
  end if;

  if p_status = 'connected' then
    if p_ciphertext is null then
      raise exception 'Connected integrations require an encrypted credential.' using errcode = '22023';
    end if;
    integration_limit := workspace_private.require_external_connector_workspace(p_workspace_id);
    perform workspace_private.require_integration_slot(p_workspace_id, expected_provider_family, integration_limit);
  elsif p_status = 'disconnected' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 0));
  end if;

  insert into workspace.integration_connections (
    workspace_id, provider, status, connected_account_label, scopes, connected_at,
    last_success_at, last_error_at, last_error_code, created_by
  )
  values (
    p_workspace_id, p_provider, p_status, nullif(trim(p_account_label), ''), coalesce(p_scopes, '{}'),
    case when p_status = 'connected' then now() else null end,
    case when p_status = 'connected' then now() else null end,
    case when p_status = 'error' then now() else null end,
    case when p_status = 'error' then 'authorization_failed' else null end,
    auth.uid()
  )
  on conflict (workspace_id, provider) do update set
    status = excluded.status,
    connected_account_label = excluded.connected_account_label,
    scopes = excluded.scopes,
    connected_at = case when excluded.status = 'connected' then now() else workspace.integration_connections.connected_at end,
    last_success_at = case when excluded.status = 'connected' then now() else workspace.integration_connections.last_success_at end,
    last_error_at = case when excluded.status = 'error' then now() else null end,
    last_error_code = case when excluded.status = 'error' then 'authorization_failed' else null end
  returning * into saved_connection;

  if p_status = 'connected' then
    insert into workspace_private.integration_credentials (
      workspace_id, provider_family, ciphertext, key_version, account_subject_hash,
      token_expires_at, refresh_token_present, created_by, revoked_at
    )
    values (
      p_workspace_id, expected_provider_family, p_ciphertext, p_key_version, p_account_subject_hash,
      p_token_expires_at, p_refresh_token_present, auth.uid(), null
    )
    on conflict (workspace_id, provider_family) do update set
      ciphertext = excluded.ciphertext,
      key_version = excluded.key_version,
      account_subject_hash = excluded.account_subject_hash,
      token_expires_at = excluded.token_expires_at,
      refresh_token_present = excluded.refresh_token_present,
      revoked_at = null
    returning id into credential_id;

    update workspace.integration_connections
      set secret_reference = credential_id::text
      where id = saved_connection.id
      returning * into saved_connection;
  elsif p_status = 'disconnected' then
    delete from workspace_private.integration_credentials
    where workspace_id = p_workspace_id
      and provider_family = expected_provider_family;

    delete from workspace_private.integration_oauth_attempts as attempt
    where attempt.workspace_id = p_workspace_id
      and workspace_private.integration_provider_family(attempt.provider) = expected_provider_family;

    update workspace.integration_connections as connection
      set status = 'disconnected',
          connected_account_label = null,
          scopes = '{}'::text[],
          secret_reference = null,
          connected_at = null,
          last_error_at = null,
          last_error_code = null
      where connection.workspace_id = p_workspace_id
        and workspace_private.integration_provider_family(connection.provider) = expected_provider_family;

    select * into saved_connection
    from workspace.integration_connections
    where id = saved_connection.id;
  end if;

  return saved_connection;
end;
$$;

revoke all on function workspace.save_integration_connection(uuid, text, text, text, text, text[], text, smallint, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function workspace.save_integration_connection(uuid, text, text, text, text, text[], text, smallint, text, timestamptz, boolean) to authenticated;

create or replace function workspace.create_integration_oauth_attempt(
  p_workspace_id uuid,
  p_provider text,
  p_state_hash text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_provider_family text;
  integration_limit integer;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may create a connection request.' using errcode = '42501';
  end if;
  if p_provider is null
    or p_provider not in ('gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin', 'google_drive', 'canva', 'powerpoint', 'youversion')
    or p_state_hash is null
    or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '15 minutes' then
    raise exception 'Invalid connection request.' using errcode = '22023';
  end if;

  expected_provider_family := workspace_private.integration_provider_family(p_provider);
  integration_limit := workspace_private.require_external_connector_workspace(p_workspace_id);
  perform workspace_private.require_integration_slot(p_workspace_id, expected_provider_family, integration_limit);

  delete from workspace_private.integration_oauth_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and workspace_private.integration_provider_family(attempt.provider) = expected_provider_family;

  insert into workspace_private.integration_oauth_attempts (workspace_id, provider, state_hash, expires_at, created_by)
  values (p_workspace_id, p_provider, p_state_hash, p_expires_at, auth.uid());
end;
$$;

revoke all on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) to authenticated;

create or replace function workspace.consume_integration_oauth_attempt(
  p_workspace_id uuid,
  p_provider text,
  p_state_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_provider_family text;
  integration_limit integer;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may complete a connection request.' using errcode = '42501';
  end if;
  if p_provider is null
    or p_provider not in ('gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin', 'google_drive', 'canva', 'powerpoint', 'youversion')
    or p_state_hash is null
    or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid connection request.' using errcode = '22023';
  end if;

  expected_provider_family := workspace_private.integration_provider_family(p_provider);
  integration_limit := workspace_private.require_external_connector_workspace(p_workspace_id);
  perform workspace_private.require_integration_slot(p_workspace_id, expected_provider_family, integration_limit);

  update workspace_private.integration_oauth_attempts
    set consumed_at = now()
    where workspace_id = p_workspace_id
      and provider = p_provider
      and state_hash = p_state_hash
      and consumed_at is null
      and expires_at > now();
  if not found then
    raise exception 'This connection request has expired. Please try again.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function workspace.consume_integration_oauth_attempt(uuid, text, text) from public, anon, authenticated;
grant execute on function workspace.consume_integration_oauth_attempt(uuid, text, text) to authenticated;

create or replace function workspace.complete_integration_oauth_connection(
  p_workspace_id uuid,
  p_provider text,
  p_state_hash text,
  p_account_label text,
  p_scopes text[],
  p_ciphertext text,
  p_key_version smallint default 1,
  p_account_subject_hash text default null,
  p_token_expires_at timestamptz default null,
  p_refresh_token_present boolean default false
)
returns workspace.integration_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_provider_family text;
  integration_limit integer;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may complete a connection request.' using errcode = '42501';
  end if;
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid connection request.' using errcode = '22023';
  end if;
  if p_ciphertext is null then
    raise exception 'Connected integrations require an encrypted credential.' using errcode = '22023';
  end if;

  expected_provider_family := workspace_private.integration_provider_family(p_provider);
  if expected_provider_family is null then
    raise exception 'Unsupported integration provider.' using errcode = '22023';
  end if;
  integration_limit := workspace_private.require_external_connector_workspace(p_workspace_id);
  perform workspace_private.require_integration_slot(p_workspace_id, expected_provider_family, integration_limit);

  if not exists (
    select 1
    from workspace_private.integration_oauth_attempts as attempt
    where attempt.workspace_id = p_workspace_id
      and attempt.state_hash = p_state_hash
      and attempt.consumed_at is not null
      and attempt.expires_at > now()
      and workspace_private.integration_provider_family(attempt.provider) = expected_provider_family
  ) then
    raise exception 'This connection request has expired. Please try again.' using errcode = '22023';
  end if;

  return workspace.save_integration_connection(
    p_workspace_id,
    p_provider,
    expected_provider_family,
    'connected',
    p_account_label,
    p_scopes,
    p_ciphertext,
    p_key_version,
    p_account_subject_hash,
    p_token_expires_at,
    p_refresh_token_present
  );
end;
$$;

revoke all on function workspace.complete_integration_oauth_connection(uuid, text, text, text, text[], text, smallint, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function workspace.complete_integration_oauth_connection(uuid, text, text, text, text[], text, smallint, text, timestamptz, boolean) to authenticated;

comment on table workspace_private.integration_credentials is 'Encrypted external connection material only. It is private, RLS-protected, and unavailable through the Workspace Data API.';
