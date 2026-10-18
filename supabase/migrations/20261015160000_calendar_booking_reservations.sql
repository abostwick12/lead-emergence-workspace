-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- SOURCE ONLY: Ministry owns review and application to the shared database.
-- No public booking route, Calendar connection, or provider write is enabled here.

create table workspace_private.calendar_booking_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  meeting_type text not null check (meeting_type in ('networking_30', 'networking_60')),
  account_slot text not null check (account_slot = 'personal'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null default 'held' check (state in ('held', 'writing', 'confirmed', 'released')),
  hold_expires_at timestamptz not null,
  provider_event_id text check (provider_event_id is null or char_length(provider_event_id) between 1 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, request_digest),
  constraint calendar_booking_duration check (
    (meeting_type = 'networking_30' and ends_at = starts_at + interval '30 minutes')
    or (meeting_type = 'networking_60' and ends_at = starts_at + interval '60 minutes')
  ),
  constraint calendar_booking_event_state check (
    (state = 'confirmed' and provider_event_id is not null)
    or (state <> 'confirmed' and provider_event_id is null)
  )
);

create index calendar_booking_reservations_overlap_idx
  on workspace_private.calendar_booking_reservations (workspace_id, starts_at, ends_at)
  where state in ('held', 'writing', 'confirmed');

alter table workspace_private.calendar_booking_reservations enable row level security;
revoke all on table workspace_private.calendar_booking_reservations from public, anon, authenticated, service_role;

-- A retry can read its exact receipt before availability checks without
-- creating a new hold when the original Google event has made the slot busy.
create function workspace.find_calendar_booking(
  p_workspace_id uuid,
  p_request_digest text
)
returns table (reservation_id uuid, reservation_state text, meeting_type text,
  starts_at timestamptz, ends_at timestamptz, hold_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null or not exists (
      select 1 from workspace.workspaces as w
       where w.id = p_workspace_id and w.workspace_type = 'personal'
    ) or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Calendar booking lookup.' using errcode = '22023';
  end if;
  return query
    select r.id, r.state, r.meeting_type, r.starts_at, r.ends_at, r.hold_expires_at
      from workspace_private.calendar_booking_reservations as r
     where r.workspace_id = p_workspace_id and r.request_digest = p_request_digest;
end;
$$;

-- A workspace-wide transaction lock serializes claims for different 30/60-minute
-- starts that overlap. The private table is never readable by the public page.
create function workspace.claim_calendar_booking(
  p_workspace_id uuid,
  p_request_digest text,
  p_meeting_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_begin_write boolean default false
)
returns table (reservation_id uuid, reservation_state text, hold_expires_at timestamptz,
  write_started boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing workspace_private.calendar_booking_reservations%rowtype;
  claim_time timestamptz;
  started_now boolean := false;
begin
  if p_workspace_id is null or not exists (
      select 1 from workspace.workspaces as w
       where w.id = p_workspace_id and w.workspace_type = 'personal'
    ) or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$'
    or p_meeting_type is null or p_meeting_type not in ('networking_30', 'networking_60')
    or p_starts_at is null or p_ends_at is null
    or (p_meeting_type = 'networking_30' and p_ends_at <> p_starts_at + interval '30 minutes')
    or (p_meeting_type = 'networking_60' and p_ends_at <> p_starts_at + interval '60 minutes')
    or p_begin_write is null then
    raise exception 'Invalid Calendar booking claim.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 0));
  -- The transaction may have begun before this lock became available.
  claim_time := pg_catalog.clock_timestamp();
  if p_starts_at <= claim_time then
    raise exception 'Invalid Calendar booking claim.' using errcode = '22023';
  end if;

  select * into existing
    from workspace_private.calendar_booking_reservations as r
   where r.workspace_id = p_workspace_id and r.request_digest = p_request_digest
   for update;

  if found then
    if existing.meeting_type <> p_meeting_type or existing.account_slot <> 'personal'
      or existing.starts_at <> p_starts_at or existing.ends_at <> p_ends_at then
      raise exception 'Calendar booking request does not match its original claim.' using errcode = '22023';
    end if;
    if existing.state = 'released' or (existing.state = 'held' and existing.hold_expires_at <= claim_time) then
      raise exception 'Calendar booking claim is no longer active.' using errcode = '22023';
    end if;
    if p_begin_write and existing.state = 'held' then
      update workspace_private.calendar_booking_reservations as r
         set state = 'writing', updated_at = claim_time
       where r.id = existing.id;
      existing.state := 'writing';
      started_now := true;
    end if;
    return query select existing.id, existing.state, existing.hold_expires_at, started_now;
    return;
  end if;

  if p_begin_write then
    raise exception 'A Calendar booking must be held before provider write.' using errcode = '22023';
  end if;
  if exists (
    select 1 from workspace_private.calendar_booking_reservations as r
     where r.workspace_id = p_workspace_id
       and r.starts_at < p_ends_at and r.ends_at > p_starts_at
       and (r.state in ('writing', 'confirmed')
         or (r.state = 'held' and r.hold_expires_at > claim_time))
  ) then
    raise exception 'Calendar booking time is already held.' using errcode = '23P01';
  end if;

  insert into workspace_private.calendar_booking_reservations (
    workspace_id, request_digest, meeting_type, account_slot,
    starts_at, ends_at, hold_expires_at, created_at, updated_at
  ) values (
    p_workspace_id, p_request_digest, p_meeting_type, 'personal',
    p_starts_at, p_ends_at, claim_time + interval '10 minutes', claim_time, claim_time
  ) returning id, state, calendar_booking_reservations.hold_expires_at
    into reservation_id, reservation_state, hold_expires_at;
  write_started := false;
  return next;
end;
$$;

-- A held claim may be released before provider write begins. Once writing,
-- only a definite provider failure may release it; ambiguous outcomes stay reserved.
create function workspace.finish_calendar_booking(
  p_workspace_id uuid,
  p_request_digest text,
  p_reservation_id uuid,
  p_expected_state text,
  p_outcome text,
  p_provider_event_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing workspace_private.calendar_booking_reservations%rowtype;
begin
  if p_workspace_id is null or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$'
    or p_reservation_id is null or p_expected_state is null or p_expected_state not in ('held', 'writing')
    or p_outcome is null or p_outcome not in ('confirmed', 'released')
    or (p_outcome = 'confirmed' and (p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 256))
    or (p_outcome = 'released' and p_provider_event_id is not null) then
    raise exception 'Invalid Calendar booking result.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 0));
  select * into existing
    from workspace_private.calendar_booking_reservations as r
   where r.id = p_reservation_id and r.workspace_id = p_workspace_id
     and r.request_digest = p_request_digest
   for update;
  if not found then
    raise exception 'Calendar booking claim was not found.' using errcode = '22023';
  end if;
  if existing.state = p_outcome and existing.provider_event_id is not distinct from p_provider_event_id then
    return existing.state;
  end if;
  if existing.state <> p_expected_state
    or (p_expected_state = 'held' and p_outcome <> 'released') then
    raise exception 'Calendar booking claim cannot be finished.' using errcode = '22023';
  end if;
  update workspace_private.calendar_booking_reservations as r
     set state = p_outcome, provider_event_id = p_provider_event_id, updated_at = now()
   where r.id = p_reservation_id;
  return p_outcome;
end;
$$;

revoke all on function workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)
  from public, anon, authenticated, service_role;
revoke all on function workspace.finish_calendar_booking(uuid,text,uuid,text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function workspace.find_calendar_booking(uuid,text)
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'workspace_calendar_booker') then
    execute 'create role workspace_calendar_booker login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
end;
$$;
grant connect on database postgres to workspace_calendar_booker;
grant usage on schema workspace to workspace_calendar_booker;
grant execute on function workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)
  to workspace_calendar_booker;
grant execute on function workspace.finish_calendar_booking(uuid,text,uuid,text,text,text)
  to workspace_calendar_booker;
grant execute on function workspace.find_calendar_booking(uuid,text)
  to workspace_calendar_booker;

comment on table workspace_private.calendar_booking_reservations is
  'Private, content-free hold for an owner-bound Calendar booking; provider writes remain disabled until a later release.';
