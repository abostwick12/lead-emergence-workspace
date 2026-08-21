-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Add three independent display-clock preferences without changing
-- the user's primary Workspace timezone or any stored timestamp.

alter table workspace.user_profiles
  add column if not exists clock_timezones text[] not null
  default array['America/New_York', 'America/Chicago', 'America/Los_Angeles']::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'workspace.user_profiles'::regclass
      and conname = 'user_profiles_clock_timezones_exactly_three'
  ) then
    alter table workspace.user_profiles
      add constraint user_profiles_clock_timezones_exactly_three
      check (
        cardinality(clock_timezones) = 3
        and array_position(clock_timezones, null) is null
        and array_position(clock_timezones, '') is null
      );
  end if;
end;
$$;

comment on column workspace.user_profiles.clock_timezones is
  'Exactly three IANA time zone identifiers used only for locally derived header clocks.';

notify pgrst, 'reload schema';
