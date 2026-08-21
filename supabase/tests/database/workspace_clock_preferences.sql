begin;

select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'clock.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'clock.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.user_profiles (user_id, display_name) values
  ('44444444-4444-4444-4444-444444444444', 'Clock Alice'),
  ('55555555-5555-5555-5555-555555555555', 'Clock Bob');

select is(
  cardinality((select clock_timezones from workspace.user_profiles where user_id = '44444444-4444-4444-4444-444444444444')),
  3,
  'clock preferences default to exactly three values'
);
select is(
  (select clock_timezones from workspace.user_profiles where user_id = '44444444-4444-4444-4444-444444444444'),
  array['America/New_York', 'America/Chicago', 'America/Los_Angeles']::text[],
  'clock preferences use the approved defaults'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $sql$update workspace.user_profiles set clock_timezones = array['Europe/London', 'Asia/Tokyo', 'Australia/Sydney'] where user_id = '44444444-4444-4444-4444-444444444444'$sql$,
  'a user can update their own display clocks'
);
select is(
  (select timezone from workspace.user_profiles where user_id = '44444444-4444-4444-4444-444444444444'),
  'America/Chicago',
  'saving display clocks does not change the primary timezone'
);

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select is(
  (select count(*) from workspace.user_profiles where user_id = '44444444-4444-4444-4444-444444444444'),
  0::bigint,
  'another user cannot read clock preferences'
);
select lives_ok(
  $sql$update workspace.user_profiles set clock_timezones = array['UTC', 'UTC', 'UTC'] where user_id = '44444444-4444-4444-4444-444444444444'$sql$,
  'a hostile update is safely filtered by RLS'
);

reset role;
select is(
  (select clock_timezones from workspace.user_profiles where user_id = '44444444-4444-4444-4444-444444444444'),
  array['Europe/London', 'Asia/Tokyo', 'Australia/Sydney']::text[],
  'a hostile update leaves the owner preference unchanged'
);

select * from finish();
rollback;
