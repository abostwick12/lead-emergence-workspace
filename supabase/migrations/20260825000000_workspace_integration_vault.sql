-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: durable, encrypted integration credentials and owner-scoped metadata bridge.
--
-- This migration is source only. Hosted application is not changed until the
-- recorded integration gate is approved and applied by the Ministry repository.

alter table workspace.integration_connections
  drop constraint if exists integration_connections_provider_check;

alter table workspace.integration_connections
  add constraint integration_connections_provider_check check (provider in (
    'logos', 'chatgpt', 'claude', 'gmail', 'slack', 'google_calendar', 'monday',
    'github', 'linkedin', 'google_drive', 'firecrawl', 'canva', 'powerpoint', 'youversion'
  ));

create table if not exists workspace_private.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  provider_family text not null check (provider_family in (
    'logos', 'openai', 'anthropic', 'google', 'slack', 'monday', 'github',
    'linkedin', 'firecrawl', 'canva', 'microsoft', 'youversion'
  )),
  ciphertext text not null check (char_length(ciphertext) between 40 and 100000),
  key_version smallint not null default 1 check (key_version > 0),
  account_subject_hash text,
  token_expires_at timestamptz,
  refresh_token_present boolean not null default false,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_family)
);

revoke all on table workspace_private.integration_credentials from public, anon, authenticated;

create table if not exists workspace_private.integration_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  provider text not null check (provider in (
    'gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin',
    'google_drive', 'canva', 'powerpoint', 'youversion'
  )),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

revoke all on table workspace_private.integration_oauth_attempts from public, anon, authenticated;

drop trigger if exists integration_credentials_set_updated_at on workspace_private.integration_credentials;
create trigger integration_credentials_set_updated_at
  before update on workspace_private.integration_credentials
  for each row execute function workspace_private.set_updated_at();

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
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change connections.' using errcode = '42501';
  end if;

  if p_provider not in (
    'logos', 'chatgpt', 'claude', 'gmail', 'slack', 'google_calendar', 'monday',
    'github', 'linkedin', 'google_drive', 'firecrawl', 'canva', 'powerpoint', 'youversion'
  ) then
    raise exception 'Unsupported integration provider.' using errcode = '22023';
  end if;

  if p_provider_family not in (
    'logos', 'openai', 'anthropic', 'google', 'slack', 'monday', 'github',
    'linkedin', 'firecrawl', 'canva', 'microsoft', 'youversion'
  ) then
    raise exception 'Unsupported integration credential family.' using errcode = '22023';
  end if;

  if p_status not in ('connected', 'disconnected', 'error') then
    raise exception 'Unsupported integration status.' using errcode = '22023';
  end if;

  if p_status = 'connected' and p_ciphertext is null then
    raise exception 'Connected integrations require an encrypted credential.' using errcode = '22023';
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

  if p_ciphertext is not null then
    insert into workspace_private.integration_credentials (
      workspace_id, provider_family, ciphertext, key_version, account_subject_hash,
      token_expires_at, refresh_token_present, created_by, revoked_at
    )
    values (
      p_workspace_id, p_provider_family, p_ciphertext, p_key_version, p_account_subject_hash,
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
  end if;

  return saved_connection;
end;
$$;

revoke all on function workspace.save_integration_connection(uuid, text, text, text, text, text[], text, smallint, text, timestamptz, boolean) from public, anon;
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
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may create a connection request.' using errcode = '42501';
  end if;
  if p_provider not in ('gmail', 'slack', 'google_calendar', 'monday', 'github', 'linkedin', 'google_drive', 'canva', 'powerpoint', 'youversion')
    or p_state_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then
    raise exception 'Invalid connection request.' using errcode = '22023';
  end if;
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
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may complete a connection request.' using errcode = '42501';
  end if;
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

revoke all on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) from public, anon;
revoke all on function workspace.consume_integration_oauth_attempt(uuid, text, text) from public, anon;
grant execute on function workspace.create_integration_oauth_attempt(uuid, text, text, timestamptz) to authenticated;
grant execute on function workspace.consume_integration_oauth_attempt(uuid, text, text) to authenticated;

comment on table workspace_private.integration_credentials is 'AES-GCM ciphertext only. OAuth tokens, refresh tokens, client secrets, and API keys must never be stored in an exposed schema.';
