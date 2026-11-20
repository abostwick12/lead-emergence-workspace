-- LOCAL ONLY, fresh isolated Workspace database; never run against a hosted DB.
-- Run with the existing pgTAP runner after applying the candidate migration locally.
-- All fixtures and the fault trigger are rolled back. Calls execute as authenticated.
-- Cases 3/7 below establish retry/readback persistence only: lost HTTP responses and
-- browser reload need the browser harness. Cases 5/6 require separate connections
-- in that harness; a one-session SQL script does not prove concurrent serialization.
begin;
select no_plan();

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','f0911111-1111-4111-8111-111111111111','authenticated','authenticated','f09.alice@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0922222-2222-4222-8222-222222222222','authenticated','authenticated','f09.bob@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name,canonical_user_id) values
 ('f0911111-1111-4111-8111-111111111111','F09 Alice','f0911111-1111-4111-8111-111111111111'),
 ('f0922222-2222-4222-8222-222222222222','F09 Bob','f0922222-2222-4222-8222-222222222222');
insert into workspace_private.personal_access_authority_projections
 (canonical_user_id,authority_kind,entitlement_status,source,source_projection_version,source_delivery_id,projected_at) values
 ('f0911111-1111-4111-8111-111111111111','INTERNAL_OPERATOR','ACTIVE','f09_local_fixture',1,'f0911111-1111-4111-8111-111111111111',now()),
 ('f0922222-2222-4222-8222-222222222222','INTERNAL_OPERATOR','ACTIVE','f09_local_fixture',1,'f0922222-2222-4222-8222-222222222222',now());
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
 ('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','F09 Alice','f0911111-1111-4111-8111-111111111111'),
 ('f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','F09 Bob','f0922222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
 ('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','owner','active'),
 ('f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f0922222-2222-4222-8222-222222222222','owner','active');
-- A fixture-only plan permits independent revocation tests without changing a real plan.
insert into workspace.plan_definitions(plan_key,display_name,description)
 values ('f09_fixture','F09 fixture','Local transaction fixture only.');
insert into workspace.plan_capabilities(plan_key,capability_key,enabled) values
 ('f09_fixture','tasks',true),('f09_fixture','quick_capture',true);
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
 ('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','f09_fixture'),
 ('f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f0922222-2222-4222-8222-222222222222','f09_fixture');
insert into workspace.capture_inbox(id,workspace_id,created_by,raw_text,status) values
 ('f0900000-0000-4000-8000-000000000001','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111',U&'\FEFF\0009  F09 original content\000A\00A0','unprocessed'),
 ('f0900000-0000-4000-8000-000000000002','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 fault retry','unprocessed'),
 ('f0900000-0000-4000-8000-000000000003','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 zero-row retry','unprocessed'),
 ('f0900000-0000-4000-8000-000000000004','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 missing link','processed'),
 ('f0900000-0000-4000-8000-000000000005','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 discarded','discarded'),
 ('f0900000-0000-4000-8000-000000000006','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111',repeat('x',241),'unprocessed'),
 ('f0900000-0000-4000-8000-000000000007','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0922222-2222-4222-8222-222222222222','F09 different creator','unprocessed'),
 ('f0900000-0000-4000-8000-000000000008','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 denied requests','unprocessed'),
 ('f0900000-0000-4000-8000-000000000009','f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f0922222-2222-4222-8222-222222222222','F09 Bob task','unprocessed'),
 ('f0900000-0000-4000-8000-000000000010','f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0911111-1111-4111-8111-111111111111','F09 delete task','unprocessed');

select ok(not has_function_privilege('anon','workspace.resolve_capture_to_task(uuid,uuid,text)','execute'),'anon cannot execute');
select ok(not has_function_privilege('service_role','workspace.resolve_capture_to_task(uuid,uuid,text)','execute'),'service_role cannot execute');
select ok(has_function_privilege('authenticated','workspace.resolve_capture_to_task(uuid,uuid,text)','execute'),'authenticated can execute');
select ok(not has_schema_privilege('authenticated','workspace_private','usage'),'conversion does not require private-schema usage');
select ok(not exists (
 select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.oid='workspace.resolve_capture_to_task(uuid,uuid,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'
),'PUBLIC has no execution grant');
select ok((select not prosecdef and provolatile='v' and proconfig @> array['search_path=""']
 from pg_proc where oid='workspace.resolve_capture_to_task(uuid,uuid,text)'::regprocedure),'RPC is volatile invoker with empty search path');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f0911111-1111-4111-8111-111111111111","role":"authenticated"}',true);

-- 1 Normal; exact count, stored content, native defaults and linked ID.
select set_config('f09.result',workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001','life')::text,true);
select is((current_setting('f09.result')::jsonb)->>'already_processed','false','first call reports new conversion');
select is((select count(*) from workspace.tasks),1::bigint,'normal conversion creates exactly one visible task');
select is((select status from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000001'),'processed','normal capture is processed');
select is((select routed_task_id::text from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000001'),current_setting('f09.result')::jsonb#>>'{task,id}','normal capture links exactly returned task');
select is((select raw_text from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000001'),U&'\FEFF\0009  F09 original content\000A\00A0','raw capture content preserved');
select is((current_setting('f09.result')::jsonb->'task')-array['id','created_at','updated_at'],
 '{"workspace_id":"f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","domain":"life","title":"F09 original content","description":null,"status":"todo","priority":"medium","due_date":null,"tags":[]}'::jsonb,'task preserves trim and native field defaults');

-- 3/4/7/8/10 Boundary state used by response-loss, reload and sequential retry.
select is(workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001','life')->>'already_processed','true','same-capture retry reports existing result');
select is(workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001','leadership')->'task',current_setting('f09.result')::jsonb->'task','changed retry selection returns first committed task unchanged');
select is(workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001',null)->'task',current_setting('f09.result')::jsonb->'task','processed lookup precedes new-input validation');
select is((select count(*) from workspace.tasks),1::bigint,'repeated and changed-input calls create no additional task');

-- 2 Inject failure after task INSERT, before capture UPDATE; audit effects roll back too.
reset role;
create function pg_temp.f09_capture_fault() returns trigger language plpgsql as $$
begin
 if new.id='f0900000-0000-4000-8000-000000000002' and current_setting('f09.fault',true)='raise' then
   raise exception 'F09 injected linkage failure' using errcode='P0001';
 elsif new.id='f0900000-0000-4000-8000-000000000003' and current_setting('f09.fault',true)='skip' then
   return null;
 end if;
 return new;
end;
$$;
create trigger f09_local_capture_fault before update on workspace.capture_inbox for each row execute function pg_temp.f09_capture_fault();
set local role authenticated;
select set_config('f09.audit_before',(select count(*)::text from workspace.audit_events),true);
select set_config('f09.fault','raise',true);
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000002')$q$,'P0001','F09 injected linkage failure','failure after INSERT propagates');
select is((select count(*) from workspace.tasks),1::bigint,'failed linkage rolls back task INSERT');
select is((select count(*)::text from workspace.audit_events),current_setting('f09.audit_before'),'failed linkage rolls back audit effects');
select is((select jsonb_build_array(status,routed_task_id,raw_text) from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000002'),'["unprocessed",null,"F09 fault retry"]'::jsonb,'failed linkage preserves capture');
select set_config('f09.fault','off',true);
select lives_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000002')$q$,'clean retry after rollback succeeds');
select is((select count(*) from workspace.tasks),2::bigint,'clean retry adds exactly one task');

select set_config('f09.audit_before',(select count(*)::text from workspace.audit_events),true);
select set_config('f09.fault','skip',true);
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000003')$q$,'P0001','Capture linkage could not be confirmed. No task was created.','zero-row UPDATE fails closed');
select is((select count(*) from workspace.tasks),2::bigint,'zero-row UPDATE leaves no task');
select is((select count(*)::text from workspace.audit_events),current_setting('f09.audit_before'),'zero-row UPDATE rolls back audit effects');
select is((select jsonb_build_array(status,routed_task_id) from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000003'),'["unprocessed",null]'::jsonb,'zero-row capture remains unchanged');
select set_config('f09.fault','off',true);

-- 8 Missing link/discarded/overlength must not fabricate a task.
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000004')$q$,'P0001','This capture was processed, but its linked task is unavailable or access is not permitted.','processed without link is explicit failure');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000005')$q$,'P0001','Discarded captures cannot become tasks.','discarded capture fails');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000006')$q$,'22023','Task title must be between 1 and 240 characters. The capture has not changed.','overlength title fails without truncation');
select is((select char_length(raw_text) from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000006'),241,'overlength capture content intact');
select throws_ok($q$select workspace.resolve_capture_to_task(null,'f0900000-0000-4000-8000-000000000008')$q$,'22023','Workspace and capture IDs are required.','null workspace rejected');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null)$q$,'22023','Workspace and capture IDs are required.','null capture rejected');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008','invalid')$q$,'22023','Choose a valid task domain.','invalid new domain rejected');

-- 9 Missing, foreign tenant, wrong workspace and wrong creator are indistinguishable.
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000099')$q$,'42501','Capture is unavailable or access is not permitted.','missing capture denied');
select throws_ok($q$select workspace.resolve_capture_to_task('f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f0900000-0000-4000-8000-000000000009')$q$,'42501','Capture is unavailable or access is not permitted.','foreign workspace denied');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000009')$q$,'42501','Capture is unavailable or access is not permitted.','foreign capture under owned workspace denied');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000007')$q$,'42501','Capture is unavailable or access is not permitted.','same-workspace different creator denied');
select is((select count(*) from workspace.tasks),2::bigint,'validation and denied requests create no task');

-- Reject OAuth/MCP claims through the existing owner/direct-session predicate.
select set_config('request.jwt.claims','{"sub":"f0911111-1111-4111-8111-111111111111","role":"authenticated","client_id":"f09ccccC-cccc-4ccc-8ccc-cccccccccccc"}',true);
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008')$q$,'42501','Capture is unavailable or access is not permitted.','OAuth client claim rejected');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001')$q$,'42501','Capture is unavailable or access is not permitted.','OAuth client cannot replay a processed task');
select set_config('request.jwt.claims','{"sub":"f0911111-1111-4111-8111-111111111111","role":"authenticated","workspace_mcp":true}',true);
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008')$q$,'42501','Capture is unavailable or access is not permitted.','MCP claim rejected');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001')$q$,'42501','Capture is unavailable or access is not permitted.','MCP client cannot replay a processed task');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008')$q$,'42501','Capture is unavailable or access is not permitted.','missing user rejected');
select set_config('request.jwt.claims','{"sub":"f0911111-1111-4111-8111-111111111111","role":"authenticated"}',true);

reset role;
update workspace.plan_capabilities set enabled=false where plan_key='f09_fixture' and capability_key='tasks';
set local role authenticated;
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008')$q$,'42501',null,'revoked tasks capability denies new conversion through INSERT policy');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001')$q$,'P0001','This capture was processed, but its linked task is unavailable or access is not permitted.','revoked tasks capability also denies processed replay');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='f09_fixture' and capability_key='tasks';
update workspace.plan_capabilities set enabled=false where plan_key='f09_fixture' and capability_key='quick_capture';
set local role authenticated;
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000008')$q$,'42501','Capture is unavailable or access is not permitted.','revoked quick_capture capability denied');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001')$q$,'42501','Capture is unavailable or access is not permitted.','revoked quick_capture capability also denies processed replay');
reset role;
update workspace.plan_capabilities set enabled=true where plan_key='f09_fixture' and capability_key='quick_capture';
set local role authenticated;
select is((select count(*) from workspace.tasks),2::bigint,'authority denials leave task count unchanged');
select is((select jsonb_build_array(status,routed_task_id,raw_text) from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000008'),'["unprocessed",null,"F09 denied requests"]'::jsonb,'authority denials preserve capture');

-- A real deleted-link variant: FK clears link; retry must never replace the task.
select set_config('f09.deleted',workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000010')#>>'{task,id}',true);
delete from workspace.tasks where id=current_setting('f09.deleted')::uuid;
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000010')$q$,'P0001','This capture was processed, but its linked task is unavailable or access is not permitted.','deleted linked task is never replaced');
select is((select count(*) from workspace.tasks),2::bigint,'deleted-link retry creates no replacement');

-- Other tenant remains untouched until its owner performs the positive control.
select set_config('request.jwt.claims','{"sub":"f0922222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is((select count(*) from workspace.tasks),0::bigint,'foreign task count stayed zero');
select is((select jsonb_build_array(status,routed_task_id,raw_text) from workspace.capture_inbox where id='f0900000-0000-4000-8000-000000000009'),'["unprocessed",null,"F09 Bob task"]'::jsonb,'foreign capture stayed unchanged');
select throws_ok($q$select workspace.resolve_capture_to_task('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f0900000-0000-4000-8000-000000000001')$q$,'42501','Capture is unavailable or access is not permitted.','reverse tenant denial does not disclose processed task');
select lives_ok($q$select workspace.resolve_capture_to_task('f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f0900000-0000-4000-8000-000000000009')$q$,'second tenant legitimate owner positive control');
select is((select count(*) from workspace.tasks),1::bigint,'second tenant creates only its one task');
reset role;
select is((select count(*) from workspace.tasks where workspace_id in ('f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),3::bigint,'global fixture task count matches the three surviving conversions');
select * from finish();
rollback;
