begin;
select no_plan();

select ok(not has_table_privilege(r,'workspace_private.'||t,p),r||' cannot '||p||' '||t)
from unnest(array['anon','authenticated']) r
cross join unnest(array['bundle_value_pilot_definitions','bundle_value_pilot_sessions','bundle_value_pilot_receipts']) t
cross join unnest(array['select','insert','update','delete']) p;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||t)::regclass),t||' has RLS')
from unnest(array['bundle_value_pilot_definitions','bundle_value_pilot_sessions','bundle_value_pilot_receipts']) t;
select ok(not has_function_privilege(r,s,'execute'),r||' cannot invoke '||s)
from unnest(array['anon','authenticated']) r cross join unnest(array[
  'workspace_private.value_pilot_exact_keys(jsonb,text[])','workspace_private.value_pilot_integer(jsonb,integer,integer)',
  'workspace_private.require_bundle_value_pilot(text)','workspace_private.bundle_value_pilot_json(uuid)']) s;
select ok(not has_function_privilege('anon',s,'execute'),'anonymous cannot invoke '||s)
from unnest(array['workspace.native_bundle_value_pilot_dashboard()','workspace.native_change_bundle_value_pilot(jsonb)']) s;
select is((select count(*)::int from workspace_private.bundle_value_pilot_definitions),6,'all six bundle definitions are server-authoritative');
select is((select sum(target_minutes)::int from workspace_private.bundle_value_pilot_definitions),59,'declared time-to-value targets match the portable manifests');
select ok(not exists(select 1 from information_schema.columns where table_schema='workspace_private'
  and table_name='bundle_value_pilot_sessions' and column_name in ('prompt','prompt_text','source','source_excerpt','output','output_text','notes','client_content')),
  'pilot storage has no client work or free-text content column');

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('16111111-1111-4111-8111-111111111111','authenticated','authenticated','p16.owner@example.invalid','{}','{}'),
('16222222-2222-4222-8222-222222222222','authenticated','authenticated','p16.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('16aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P16 owner','16111111-1111-4111-8111-111111111111'),
('16bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P16 other','16222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('16aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','16111111-1111-4111-8111-111111111111','owner','active'),
('16bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','16222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('16aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','16111111-1111-4111-8111-111111111111','personal'),
('16bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','16222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference)
select '16aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','16111111-1111-4111-8111-111111111111',b,'operator_assignment','p16-owner-'||b
from unnest(array['executive','writer_editor','ministry','nonprofit_founder','investor','workspace_experience']) b;
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference)
values('16bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','16222222-2222-4222-8222-222222222222','workspace_experience','operator_assignment','p16-other-experience');

create temp table p16_cache(k text primary key,v jsonb);grant all on p16_cache to authenticated;
insert into p16_cache values
('executive_start','{"operation":"start","requestId":"16333333-3333-4333-8333-333333333333","bundleKey":"executive","baselineMinutes":30}'),
('writer_start','{"operation":"start","requestId":"16444444-4444-4444-8444-444444444444","bundleKey":"writer_editor","baselineMinutes":20}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select is(workspace.native_bundle_value_pilot_dashboard()->'sessions','[]'::jsonb,'owner begins with no private value history');
insert into p16_cache values('executive_active',workspace.native_change_bundle_value_pilot((select v from p16_cache where k='executive_start')));
select is((v->>'status'),'active','value check starts explicitly') from p16_cache where k='executive_active';
select is((v->>'version')::int,1,'new value check starts at version one') from p16_cache where k='executive_active';
select is((v->>'baselineMinutes')::int,30,'usual-process estimate is fixed before work') from p16_cache where k='executive_active';
select is((v->>'targetMinutes')::int,8,'server supplies the manifest time target') from p16_cache where k='executive_active';
select is(v->'availableSignalIds','["executive.signal.brief_accepted","executive.signal.followup_recovered"]'::jsonb,'server supplies exact declared success signals') from p16_cache where k='executive_active';
select is(workspace.native_change_bundle_value_pilot((select v from p16_cache where k='executive_start')),(select v from p16_cache where k='executive_active'),'lost start response retries exactly');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||'{"baselineMinutes":31}'::jsonb)from p16_cache where k='executive_start'$q$,'40001',null::text,'request ID cannot be reused with a changed baseline');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid()))from p16_cache where k='executive_start'$q$,'40001',null::text,'a second active value check for the same bundle is denied');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'notes','private prose'))from p16_cache where k='writer_start'$q$,'22023',null::text,'start rejects extra prose');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'baselineMinutes',0))from p16_cache where k='writer_start'$q$,'22023',null::text,'start rejects a zero baseline');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'baselineMinutes',12.5))from p16_cache where k='writer_start'$q$,'22023',null::text,'start rejects a fractional baseline');
reset role;

update workspace_private.bundle_value_pilot_sessions set started_at=clock_timestamp()-interval '6 minutes 30 seconds'
where id=((select v from p16_cache where k='executive_active')->>'id')::uuid;
insert into p16_cache values('executive_finish',jsonb_build_object(
  'operation','finish','requestId','16555555-5555-4555-8555-555555555555','pilotId',(select v->>'id' from p16_cache where k='executive_active'),
  'expectedVersion',1,'outcomeAchieved',true,'successSignalIds','["executive.signal.brief_accepted"]'::jsonb,
  'ratings','{"usefulness":5,"trust":4,"actionability":4}'::jsonb,
  'gates','{"evidenceVisible":true,"provenanceVisible":true,"mutationControlPreserved":true}'::jsonb,'correctionCount',1));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'outcomeAchieved',false))from p16_cache where k='executive_finish'$q$,'22023',null::text,'contradictory outcome and signal are denied');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'successSignalIds','["executive.signal.unknown"]'::jsonb))from p16_cache where k='executive_finish'$q$,'22023',null::text,'undeclared success signal is denied');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'successSignalIds','["executive.signal.brief_accepted","executive.signal.brief_accepted"]'::jsonb))from p16_cache where k='executive_finish'$q$,'22023',null::text,'duplicate success signal is denied');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid(),'privateResult','content'))from p16_cache where k='executive_finish'$q$,'22023',null::text,'finish rejects result prose');
insert into p16_cache values('executive_result',workspace.native_change_bundle_value_pilot((select v from p16_cache where k='executive_finish')));
select is(v->>'status','completed','the user can record a completed result') from p16_cache where k='executive_result';
select is((v->>'version')::int,2,'completion advances the optimistic version') from p16_cache where k='executive_result';
select ok((v->'result'->>'elapsedSeconds')::int between 390 and 400,'elapsed time is measured from server timestamps') from p16_cache where k='executive_result';
select is((v->'result'->>'targetMet')::boolean,true,'the measured session meets its eight-minute target') from p16_cache where k='executive_result';
select is((v->'result'->>'estimatedMinutesSaved')::int,23,'time-saved estimate uses the pre-work baseline') from p16_cache where k='executive_result';
select is(v->'result'->>'assessment','strong_signal','high ratings and trust gates produce a strong user-reported signal') from p16_cache where k='executive_result';
select is(workspace.native_change_bundle_value_pilot((select v from p16_cache where k='executive_finish')),(select v from p16_cache where k='executive_result'),'lost finish response retries exactly');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid()))from p16_cache where k='executive_finish'$q$,'40001',null::text,'completed session cannot be finished again');

insert into p16_cache values('writer_active',workspace.native_change_bundle_value_pilot((select v from p16_cache where k='writer_start')));
insert into p16_cache values('writer_abandon',jsonb_build_object('operation','abandon','requestId','16666666-6666-4666-8666-666666666666',
  'pilotId',(select v->>'id' from p16_cache where k='writer_active'),'expectedVersion',1,'reason','source_gap'));
insert into p16_cache values('writer_stopped',workspace.native_change_bundle_value_pilot((select v from p16_cache where k='writer_abandon')));
select is(v->>'status','abandoned','a stopped check remains honest instead of becoming a success') from p16_cache where k='writer_stopped';
select is(v->'abandonment'->>'reason','source_gap','bounded stop reason is retained without prose') from p16_cache where k='writer_stopped';
select is(workspace.native_change_bundle_value_pilot((select v from p16_cache where k='writer_abandon')),(select v from p16_cache where k='writer_stopped'),'lost stop response retries exactly');
select is(jsonb_array_length(workspace.native_bundle_value_pilot_dashboard()->'sessions'),2,'owner dashboard returns only its two private sessions');
reset role;

select is((select count(*)::int from workspace_private.bundle_value_pilot_receipts),4,'exactly one receipt exists per successful operation');
select ok(not exists(select 1 from workspace_private.bundle_value_pilot_receipts where response_json::text like '%private prose%'), 'retry receipts contain no rejected prose');
select ok(not exists(select 1 from workspace_private.bundle_value_pilot_sessions where row_to_json(bundle_value_pilot_sessions)::text like '%private prose%'), 'session rows contain no rejected prose');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is(workspace.native_bundle_value_pilot_dashboard()->'sessions','[]'::jsonb,'another owner sees a separate empty history');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(jsonb_build_object('operation','finish','requestId',gen_random_uuid(),
  'pilotId',(select v->>'id' from p16_cache where k='executive_active'),'expectedVersion',1,'outcomeAchieved',false,'successSignalIds','[]'::jsonb,
  'ratings','{"usefulness":1,"trust":1,"actionability":1}'::jsonb,'gates','{"evidenceVisible":false,"provenanceVisible":false,"mutationControlPreserved":false}'::jsonb,'correctionCount',0))$q$,
  'P0002',null::text,'another owner cannot finish a private session by identifier');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(jsonb_build_object('operation','start','requestId',gen_random_uuid(),'bundleKey','executive','baselineMinutes',20))$q$,
  '42501',null::text,'Experience entitlement alone cannot start another bundle value check');
select set_config('request.jwt.claims','{"sub":"16111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"16777777-7777-4777-8777-777777777777"}',true);
select throws_ok($q$select workspace.native_bundle_value_pilot_dashboard()$q$,'42501',null::text,'OAuth assistant cannot read native value history');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid()))from p16_cache where k='writer_start'$q$,
  '42501',null::text,'OAuth assistant cannot start a native value check');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P16 revocation test'
where workspace_id='16aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key='executive';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select is(workspace.native_change_bundle_value_pilot((select v from p16_cache where k='executive_finish')),(select v from p16_cache where k='executive_result'),'exact finished receipt remains safely replayable after bundle revocation');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(v||jsonb_build_object('requestId',gen_random_uuid()))from p16_cache where k='executive_start'$q$,
  '42501',null::text,'revoked bundle cannot start a new value check');
select is(jsonb_array_length(workspace.native_bundle_value_pilot_dashboard()->'sessions'),2,'revocation retains the owner history for honest evaluation');
select throws_ok($q$select workspace.native_change_bundle_value_pilot(jsonb_build_object('operation','start','requestId',gen_random_uuid(),'bundleKey','unknown','baselineMinutes',20))$q$,
  '22023',null::text,'unknown bundle is rejected');
reset role;

select * from finish();
rollback;
