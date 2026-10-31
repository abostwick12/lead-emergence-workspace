-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- SOURCE ONLY: Ministry owns review and application to the shared database.
-- Two independently revocable Calendar credentials. No OAuth or booking is enabled here.

create table workspace_private.calendar_account_credentials (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  account_slot text not null check (account_slot in ('personal', 'business')),
  ciphertext text check (ciphertext is null or char_length(ciphertext) between 40 and 100000),
  key_version smallint not null default 1 check (key_version > 0),
  account_subject_hash text not null check (account_subject_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  refresh_token_present boolean not null default false,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, account_slot),
  constraint calendar_credential_revocation_shape check (
    (revoked_at is null and ciphertext is not null)
    or (revoked_at is not null and ciphertext is null and not refresh_token_present)
  )
);

alter table workspace_private.calendar_account_credentials enable row level security;
revoke all on table workspace_private.calendar_account_credentials from public, anon, authenticated, service_role;

-- At most one pending OAuth flow per workspace and account slot. The owner
-- bearer is encrypted before storage and is never returned to the browser.
create table workspace_private.calendar_oauth_attempts (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  account_slot text not null check (account_slot in ('personal', 'business')),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  ciphertext text not null check (char_length(ciphertext) between 40 and 100000),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (workspace_id, account_slot)
);

alter table workspace_private.calendar_oauth_attempts enable row level security;
revoke all on table workspace_private.calendar_oauth_attempts from public, anon, authenticated, service_role;

create trigger calendar_account_credentials_set_updated_at
  before update on workspace_private.calendar_account_credentials
  for each row execute function workspace_private.set_updated_at();

create function workspace.save_owner_calendar_credential(
  p_workspace_id uuid,
  p_account_slot text,
  p_ciphertext text,
  p_key_version smallint,
  p_account_subject_hash text,
  p_token_expires_at timestamptz,
  p_refresh_token_present boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change Calendar credentials.' using errcode = '42501';
  end if;
  if p_account_slot is null or p_account_slot not in ('personal', 'business')
    or p_ciphertext is null or char_length(p_ciphertext) not between 40 and 100000
    or p_key_version is distinct from 1
    or p_account_subject_hash is null or p_account_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Calendar credential.' using errcode = '22023';
  end if;

  insert into workspace_private.calendar_account_credentials (
    workspace_id, account_slot, ciphertext, key_version, account_subject_hash,
    token_expires_at, refresh_token_present, created_by, revoked_at
  ) values (
    p_workspace_id, p_account_slot, p_ciphertext, p_key_version, p_account_subject_hash,
    p_token_expires_at, p_refresh_token_present, auth.uid(), null
  )
  on conflict (workspace_id, account_slot) do update set
    ciphertext = excluded.ciphertext,
    key_version = excluded.key_version,
    account_subject_hash = excluded.account_subject_hash,
    token_expires_at = excluded.token_expires_at,
    refresh_token_present = excluded.refresh_token_present,
    revoked_at = null;
end;
$$;

create function workspace.revoke_owner_calendar_credential(p_workspace_id uuid, p_account_slot text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change Calendar credentials.' using errcode = '42501';
  end if;
  if p_account_slot is null or p_account_slot not in ('personal', 'business') then
    raise exception 'Invalid Calendar account slot.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text || ':' || p_account_slot, 0));
  delete from workspace_private.calendar_oauth_attempts
   where workspace_id = p_workspace_id and account_slot = p_account_slot;

  update workspace_private.calendar_account_credentials
     set ciphertext = null, refresh_token_present = false,
         token_expires_at = null, revoked_at = now()
   where workspace_id = p_workspace_id and account_slot = p_account_slot;
end;
$$;

create function workspace.start_owner_calendar_oauth_attempt(
  p_workspace_id uuid,
  p_account_slot text,
  p_state_hash text,
  p_ciphertext text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change Calendar credentials.' using errcode = '42501';
  end if;
  if p_account_slot is null or p_account_slot not in ('personal', 'business')
    or p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_ciphertext is null or char_length(p_ciphertext) not between 40 and 100000 then
    raise exception 'Invalid Calendar connection request.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text || ':' || p_account_slot, 0));
  insert into workspace_private.calendar_oauth_attempts (
    workspace_id, account_slot, state_hash, ciphertext, expires_at, created_by
  ) values (
    p_workspace_id, p_account_slot, p_state_hash, p_ciphertext, now() + interval '10 minutes', auth.uid()
  )
  on conflict (workspace_id, account_slot) do update set
    state_hash = excluded.state_hash,
    ciphertext = excluded.ciphertext,
    expires_at = excluded.expires_at,
    created_by = excluded.created_by,
    created_at = now();
end;
$$;

-- This exact-state read is for the dedicated server-only Calendar role. It
-- returns an encrypted, short-lived owner bearer, never a plaintext token.
create function workspace.read_calendar_oauth_attempt(
  p_workspace_id uuid,
  p_account_slot text,
  p_state_hash text
)
returns table (ciphertext text)
language sql
stable
security definer
set search_path = ''
as $$
  select attempt.ciphertext
    from workspace_private.calendar_oauth_attempts as attempt
   where attempt.workspace_id = p_workspace_id
     and attempt.account_slot = p_account_slot
     and attempt.state_hash = p_state_hash
     and attempt.expires_at > now();
$$;

-- The attempt check, credential save, and consumption share one transaction.
-- Disconnect takes the same slot lock, so whichever commits last determines
-- the final credential state.
create function workspace.finish_owner_calendar_oauth_attempt(
  p_workspace_id uuid,
  p_account_slot text,
  p_state_hash text,
  p_ciphertext text,
  p_key_version smallint,
  p_account_subject_hash text,
  p_token_expires_at timestamptz,
  p_refresh_token_present boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_attempt workspace_private.calendar_oauth_attempts%rowtype;
begin
  if auth.uid() is null or not workspace_private.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the Workspace owner may change Calendar credentials.' using errcode = '42501';
  end if;
  if p_account_slot is null or p_account_slot not in ('personal', 'business')
    or p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Calendar connection request.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text || ':' || p_account_slot, 0));
  select * into pending_attempt
    from workspace_private.calendar_oauth_attempts
   where workspace_id = p_workspace_id and account_slot = p_account_slot
   for update;
  if not found or pending_attempt.state_hash <> p_state_hash
    or pending_attempt.expires_at <= now()
    or pending_attempt.created_by <> auth.uid() then
    raise exception 'This Calendar connection request has expired.' using errcode = '22023';
  end if;

  perform workspace.save_owner_calendar_credential(
    p_workspace_id, p_account_slot, p_ciphertext, p_key_version,
    p_account_subject_hash, p_token_expires_at, p_refresh_token_present
  );
  delete from workspace_private.calendar_oauth_attempts
   where workspace_id = p_workspace_id and account_slot = p_account_slot;
end;
$$;

-- The reader takes an exact slot and returns no row after revocation. A future
-- route must bind the workspace and meeting type on the server; this role alone
-- does not authenticate a visitor or establish tenant isolation.
create function workspace.read_calendar_credential(p_workspace_id uuid, p_account_slot text)
returns table (
  ciphertext text,
  key_version smallint,
  account_subject_hash text,
  token_expires_at timestamptz,
  refresh_token_present boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select credential.ciphertext, credential.key_version, credential.account_subject_hash,
         credential.token_expires_at, credential.refresh_token_present
    from workspace_private.calendar_account_credentials as credential
   where credential.workspace_id = p_workspace_id
     and credential.account_slot = p_account_slot
     and credential.revoked_at is null;
$$;

revoke all on function workspace.save_owner_calendar_credential(uuid, text, text, smallint, text, timestamptz, boolean) from public, anon;
revoke all on function workspace.revoke_owner_calendar_credential(uuid, text) from public, anon;
revoke all on function workspace.start_owner_calendar_oauth_attempt(uuid, text, text, text) from public, anon;
revoke all on function workspace.finish_owner_calendar_oauth_attempt(uuid, text, text, text, smallint, text, timestamptz, boolean) from public, anon;
revoke all on function workspace.read_calendar_oauth_attempt(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function workspace.read_calendar_credential(uuid, text) from public, anon, authenticated, service_role;
grant execute on function workspace.save_owner_calendar_credential(uuid, text, text, smallint, text, timestamptz, boolean) to authenticated;
grant execute on function workspace.revoke_owner_calendar_credential(uuid, text) to authenticated;
grant execute on function workspace.start_owner_calendar_oauth_attempt(uuid, text, text, text) to authenticated;
grant execute on function workspace.finish_owner_calendar_oauth_attempt(uuid, text, text, text, smallint, text, timestamptz, boolean) to authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'workspace_calendar_reader') then
    execute 'create role workspace_calendar_reader login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
end;
$$;
grant connect on database postgres to workspace_calendar_reader;
grant usage on schema workspace to workspace_calendar_reader;
grant execute on function workspace.read_calendar_credential(uuid, text) to workspace_calendar_reader;
grant execute on function workspace.read_calendar_oauth_attempt(uuid, text, text) to workspace_calendar_reader;

comment on table workspace_private.calendar_account_credentials is
  'Calendar ciphertext for two owner-selected account slots; never expose via the Data API.';
comment on table workspace_private.calendar_oauth_attempts is
  'Short-lived encrypted owner bearer for one pending Calendar OAuth flow per account slot.';
