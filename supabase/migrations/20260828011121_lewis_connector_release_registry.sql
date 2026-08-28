-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Keep external connector consent fail-closed until a provider has a
-- reviewed consumer adapter and an explicitly released action contract.

create table workspace_private.integration_provider_releases (
  provider text primary key check (provider in (
    'gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin',
    'google_drive', 'firecrawl', 'canva', 'powerpoint', 'youversion'
  )),
  connection_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workspace_private.integration_provider_releases enable row level security;
revoke all on table workspace_private.integration_provider_releases from public, anon, authenticated;

insert into workspace_private.integration_provider_releases (provider)
values
  ('gmail'), ('slack'), ('google_calendar'), ('monday'), ('github'), ('linkedin'),
  ('google_drive'), ('firecrawl'), ('canva'), ('powerpoint'), ('youversion')
on conflict (provider) do nothing;

drop trigger if exists integration_provider_releases_set_updated_at on workspace_private.integration_provider_releases;
create trigger integration_provider_releases_set_updated_at
  before update on workspace_private.integration_provider_releases
  for each row execute function workspace_private.set_updated_at();

create or replace function workspace_private.require_integration_provider_connection(p_provider text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from workspace_private.integration_provider_releases as release
    where release.provider = p_provider
      and release.connection_enabled
  ) then
    raise exception 'This external provider is not released for consumer use.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function workspace_private.require_integration_provider_connection(text) from public, anon, authenticated;

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
  perform workspace_private.require_integration_provider_connection(p_provider);
  perform workspace_private.require_integration_slot(p_workspace_id, expected_provider_family, integration_limit);

  delete from workspace_private.integration_oauth_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and workspace_private.integration_provider_family(attempt.provider) = expected_provider_family;

  insert into workspace_private.integration_oauth_attempts (workspace_id, provider, state_hash, expires_at, created_by)
  values (p_workspace_id, p_provider, p_state_hash, p_expires_at, auth.uid());
end;
$$;

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
  perform workspace_private.require_integration_provider_connection(p_provider);
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

revoke all on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function workspace.consume_integration_oauth_attempt(uuid, text, text) from public, anon, authenticated;
grant execute on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) to authenticated;
grant execute on function workspace.consume_integration_oauth_attempt(uuid, text, text) to authenticated;

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
    perform workspace_private.require_integration_provider_connection(p_provider);
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

comment on table workspace_private.integration_provider_releases is 'Consumer connector release control. A catalog listing never enables credential collection or a provider action.';
