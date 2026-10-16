begin;

select plan(33);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'b1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'booking.alice@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'booking.bob@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into workspace.workspaces (id, workspace_type, name, owner_user_id) values
  ('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'personal', 'Booking Alice workspace', 'b1111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'personal', 'Booking Bob workspace', 'b2222222-2222-4222-8222-222222222222');

select is((select relrowsecurity from pg_class where oid = 'workspace_private.calendar_booking_reservations'::regclass), true, 'reservations have RLS');
select is((select rolcanlogin and not rolbypassrls and not rolinherit from pg_roles where rolname = 'workspace_calendar_booker'), true, 'booker is a restricted login role');
select is(has_schema_privilege('workspace_calendar_booker', 'workspace_private', 'usage'), false, 'booker cannot use private schema');
select is(has_table_privilege('workspace_calendar_booker', 'workspace_private.calendar_booking_reservations', 'select'), false, 'booker cannot read private reservations');
select is(has_function_privilege('workspace_calendar_booker', 'workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)', 'execute'), true, 'booker can claim');
select is(has_function_privilege('workspace_calendar_booker', 'workspace.finish_calendar_booking(uuid,text,uuid,text,text)', 'execute'), true, 'booker can finish');
select is(has_function_privilege('anon', 'workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)', 'execute'), false, 'anonymous visitor cannot claim');
select is(has_function_privilege('authenticated', 'workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)', 'execute'), false, 'signed-in browser cannot claim');
select is(has_function_privilege('service_role', 'workspace.finish_calendar_booking(uuid,text,uuid,text,text)', 'execute'), false, 'service role cannot finish');
select is(has_function_privilege('workspace_calendar_reader', 'workspace.claim_calendar_booking(uuid,text,text,timestamptz,timestamptz,boolean)', 'execute'), false, 'Calendar reader cannot book');

-- pgTAP connects as postgres, which does not inherit newly created login roles.
-- This membership exists only inside the test transaction and rolls back.
grant workspace_calendar_booker to postgres;

-- Execute calls under the restricted role, then inspect their captured result
-- after resetting to the test role. pgTAP is not granted to the booker.

set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_01', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_01', true), 'ok', 'booker holds one personal Networking slot');
reset role;
select is((select count(*) from workspace_private.calendar_booking_reservations where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint, 'one private claim exists');

set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_02', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_02', true), 'ok', 'same request is idempotent');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('b',64), 'networking_60', now() + interval '1 day 15 minutes', now() + interval '1 day 75 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_03', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_03', true), '23P01:Calendar booking time is already held.', 'overlapping 60-minute claim is denied');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'networking_30', now() + interval '1 day 30 minutes', now() + interval '1 day 60 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_04', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_04', true), '22023:Calendar booking request does not match its original claim.', 'same digest cannot move a held time');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('c',64), 'networking_30', now() + interval '1 day 30 minutes', now() + interval '1 day 60 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_05', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_05', true), 'ok', 'adjacent time is allowed');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('a',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_06', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_06', true), 'ok', 'a different workspace has independent claims');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('d',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes', true);
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_07', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_07', true), '22023:A Calendar booking must be held before provider write.', 'provider write cannot begin without a hold');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes', true);
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_08', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_08', true), 'ok', 'held request enters writing state');
reset role;
select is((select state from workspace_private.calendar_booking_reservations where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and request_digest = repeat('a',64)), 'writing', 'writing state is durable');

update workspace_private.calendar_booking_reservations
   set hold_expires_at = now() - interval '1 minute'
 where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and request_digest = repeat('a',64);
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('b',64), 'networking_60', now() + interval '1 day 15 minutes', now() + interval '1 day 75 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_09', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_09', true), '23P01:Calendar booking time is already held.', 'ambiguous provider write stays reserved after hold deadline');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('f',64), (select id from workspace_private.calendar_booking_reservations where request_digest = repeat('a',64) and workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'confirmed', 'provider-event-a');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_10', actual, true);
end
$booking_case$;
reset role;
select is(split_part(current_setting('booking_test.case_10', true), ':', 1), '42501', 'booker cannot query the private table to forge a receipt');
reset role;

set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('f',64), '00000000-0000-0000-0000-000000000000', 'confirmed', 'provider-event-a');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_11', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_11', true), '22023:Calendar booking claim was not found.', 'wrong receipt cannot finish a claim');
reset role;

select set_config('booking_test.receipt', (
  select id::text from workspace_private.calendar_booking_reservations
   where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and request_digest = repeat('a',64)
), true);

set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), current_setting('booking_test.receipt')::uuid, 'confirmed', 'provider-event-a');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_12', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_12', true), 'ok', 'exact writing claim can be confirmed');
reset role;
select is((select state from workspace_private.calendar_booking_reservations where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and request_digest = repeat('a',64)), 'confirmed', 'confirmed state is durable');

set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), current_setting('booking_test.receipt')::uuid, 'confirmed', 'provider-event-a');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_13', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_13', true), 'ok', 'confirmation retry is idempotent');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), current_setting('booking_test.receipt')::uuid, 'released');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_14', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_14', true), '22023:Calendar booking claim cannot be finished.', 'confirmed booking cannot be released');
reset role;

select set_config('booking_test.adjacent', (
  select id::text from workspace_private.calendar_booking_reservations
   where workspace_id = 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and request_digest = repeat('c',64)
), true);
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('c',64), 'networking_30', now() + interval '1 day 30 minutes', now() + interval '1 day 60 minutes', true);
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_15', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_15', true), 'ok', 'second hold can begin provider write');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform workspace.finish_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('c',64), current_setting('booking_test.adjacent')::uuid, 'released');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_16', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_16', true), 'ok', 'definite provider failure releases a writing claim');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('e',64), 'networking_30', now() + interval '1 day 30 minutes', now() + interval '1 day 60 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_17', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_17', true), 'ok', 'released slot can be held again');
reset role;

update workspace_private.calendar_booking_reservations
   set hold_expires_at = now() - interval '1 minute'
 where workspace_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and request_digest = repeat('a',64);
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('a',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_18', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_18', true), '22023:Calendar booking claim is no longer active.', 'expired digest cannot be revived');
set local role workspace_calendar_booker;
do $booking_case$
declare actual text := 'ok';
begin
  begin
    perform * from workspace.claim_calendar_booking('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('b',64), 'networking_30', now() + interval '1 day', now() + interval '1 day 30 minutes');
  exception when others then
    actual := SQLSTATE || ':' || SQLERRM;
  end;
  perform set_config('booking_test.case_19', actual, true);
end
$booking_case$;
reset role;
select is(current_setting('booking_test.case_19', true), 'ok', 'new request may claim an expired hold');
reset role;
select is((select count(*) from workspace_private.calendar_booking_reservations where workspace_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 2::bigint, 'expired hold remains as an audit record');

select * from finish();
rollback;
