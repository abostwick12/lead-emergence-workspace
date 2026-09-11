begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

select ok(not has_table_privilege(role_name,'workspace_private.'||table_name,privilege),role_name||' cannot '||privilege||' private '||table_name)
from unnest(array['anon','authenticated'])role_name cross join unnest(array['executive_delivery_schedules','executive_delivery_events','executive_delivery_requests'])table_name
cross join unnest(array['select','insert','update','delete'])privilege;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||table_name)::regclass),table_name||' has RLS enabled')
from unnest(array['executive_delivery_schedules','executive_delivery_events','executive_delivery_requests'])table_name;
select ok(not has_function_privilege(role_name,function_name,'execute'),role_name||' cannot invoke '||function_name)
from unnest(array['anon','authenticated'])role_name cross join unnest(array[
 'workspace_private.executive_delivery_weekdays_valid(smallint[])','workspace_private.executive_delivery_capability(text)',
 'workspace_private.executive_delivery_object_length(jsonb)',
 'workspace_private.executive_delivery_next(text,text,smallint[],time without time zone,timestamp with time zone)',
 'workspace_private.validate_executive_delivery_definition(jsonb)',
 'workspace_private.executive_delivery_schedule_item(workspace_private.executive_delivery_schedules,boolean)',
 'workspace.executive_review_attention_ungrouped(date,integer,integer)'])function_name;
select ok(not has_function_privilege('anon',function_name,'execute'),'anonymous cannot invoke '||function_name)
from unnest(array['workspace.executive_review_attention(date,integer,integer)','workspace.executive_change_delivery(jsonb)','workspace.executive_deliveries()'])function_name;
select ok(has_function_privilege('authenticated',function_name,'execute'),'authenticated uses guarded '||function_name)
from unnest(array['workspace.executive_review_attention(date,integer,integer)','workspace.executive_change_delivery(jsonb)','workspace.executive_deliveries()'])function_name;
select ok((select prosecdef from pg_proc where oid=function_name::regprocedure),'guarded owner rights: '||function_name)
from unnest(array['workspace.executive_review_attention(date,integer,integer)','workspace.executive_change_delivery(jsonb)','workspace.executive_deliveries()'])function_name;
select throws_ok($$select workspace.executive_deliveries()$$,'42501',null::text,'delivery list needs verified identity');
select throws_ok($$select workspace.executive_change_delivery('{}')$$,'42501',null::text,'delivery changes need verified identity');
select ok(workspace_private.executive_delivery_next('America/Chicago','daily','{}','02:30','2026-03-08T07:00:00Z')>'2026-03-08T07:00:00Z','spring gap resolves to a later instant');
select is((workspace_private.executive_delivery_next('America/Chicago','daily','{}','02:30','2026-03-08T07:00:00Z') at time zone 'America/Chicago')::date,date '2026-03-08','spring gap remains on the intended local date');
select is(to_char(workspace_private.executive_delivery_next('America/Chicago','daily','{}','01:30','2026-11-01T05:00:00Z') at time zone 'America/Chicago','HH24:MI'),'01:30','repeated local hour resolves to the intended wall time');
select is(extract(isodow from workspace_private.executive_delivery_next('America/Chicago','weekly',array[5]::smallint[],'16:00','2026-09-10T18:00:00Z') at time zone 'America/Chicago')::integer,5,'weekly cadence returns an allowed ISO weekday');

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('23111111-1111-4111-8111-111111111111','authenticated','authenticated','p23.owner@example.invalid','{}','{}'),
('23222222-2222-4222-8222-222222222222','authenticated','authenticated','p23.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P23 owner','23111111-1111-4111-8111-111111111111'),
('23bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P23 other','23222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','23111111-1111-4111-8111-111111111111','owner','active'),
('23bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','23222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','23111111-1111-4111-8111-111111111111','personal'),
('23bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','23222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference) values
('23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','23111111-1111-4111-8111-111111111111','executive','operator_assignment','p23-owner-executive'),
('23bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','23222222-2222-4222-8222-222222222222','executive','operator_assignment','p23-other-executive');

insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','23cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'23111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values
('23111111-1111-4111-8111-111111111111','23cccccc-cccc-4ccc-8ccc-cccccccccccc','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
select set_config('request.p23_oauth',jsonb_build_object('sub','23111111-1111-4111-8111-111111111111','role','authenticated',
 'aud','https://workspace.leademergence.com/api/mcp','client_id','23cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp',true,
 'iat',floor(extract(epoch from clock_timestamp())))::text,true);
create temp table p23_state(k text primary key,v jsonb);grant all on p23_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p23_oauth'),true);
select throws_ok($$select workspace.executive_deliveries()$$,'42501','Review and confirm this change yourself in Workspace.','OAuth cannot read or trigger native schedules');
select throws_ok($q$select workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333331","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"OAuth daily brief","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"07:30"},"changePolicy":"always","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}')$q$,'42501','Review and confirm this change yourself in Workspace.','OAuth cannot create a native schedule');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('empty-attention',workspace.executive_review_attention(current_date,0,25));
select is((select (v->>'total')::integer from p23_state where k='empty-attention'),0,'empty attention has exact zero total');
select is((select jsonb_array_length(v->'groups') from p23_state where k='empty-attention'),0,'zero-total source groups are omitted');
select throws_ok($q$select workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333332","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Invalid zone brief","timeZone":"Imaginary/Nowhere","cadence":{"kind":"daily","localTime":"07:30"},"changePolicy":"always","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}')$q$,'22023','Review the schedule label, time zone and cadence.','unsupported named zone is rejected');
insert into p23_state values('created',workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333333","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Weekday daily brief","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"07:30"},"changePolicy":"when_attention_summary_changes","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}'));
select is((select (v->>'version')::integer from p23_state where k='created'),1,'creation starts at version one');
select is((select v->>'status' from p23_state where k='created'),'active','new schedule is active');
select is((select v->>'capabilityAvailable' from p23_state where k='created'),'true','current capability is reported');
select is(workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333333","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Weekday daily brief","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"07:30"},"changePolicy":"when_attention_summary_changes","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}')->>'replayed','true','lost creation response replays exactly');
select throws_ok($q$select workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333333","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Changed request meaning","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"07:30"},"changePolicy":"always","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}')$q$,'40001','This request identifier was already used.','request identity cannot be rebound');
select throws_ok($q$select workspace.executive_change_delivery('{"scheduleId":null,"expectedVersion":0,"requestId":"23333333-3333-4333-8333-333333333334","operation":"create","definition":{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Duplicate daily brief","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"08:00"},"changePolicy":"always","deliveryTarget":"native_executive_inbox"},"confirmExactSchedule":true}')$q$,'40001','A current schedule already exists for this review.','one current schedule per review kind');
insert into p23_state values('updated',workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',1,'requestId','23333333-3333-4333-8333-333333333335','operation','update','definition','{"schemaVersion":"1.0","deliveryKind":"daily_brief","label":"Focused weekday brief","timeZone":"America/Chicago","cadence":{"kind":"daily","localTime":"08:15"},"changePolicy":"when_attention_summary_changes","deliveryTarget":"native_executive_inbox"}'::jsonb,'confirmExactSchedule',true)));
select is((select (v->>'version')::integer from p23_state where k='updated'),2,'update advances the version');
insert into p23_state values('paused',workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',2,'requestId','23333333-3333-4333-8333-333333333336','operation','pause','definition',null,'confirmExactSchedule',true)));
select is((select v->>'nextOccurrence' from p23_state where k='paused'),null,'pause clears the next occurrence');
select is(workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',2,'requestId','23333333-3333-4333-8333-333333333336','operation','pause','definition',null,'confirmExactSchedule',true))->>'replayed','true','lost pause response replays despite the newer current version');
insert into p23_state values('resumed',workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',3,'requestId','23333333-3333-4333-8333-333333333337','operation','resume','definition',null,'confirmExactSchedule',true)));
select is((select (v->>'version')::integer from p23_state where k='resumed'),4,'resume advances the version');
reset role;

update workspace_private.executive_delivery_schedules set next_occurrence=now()-interval '1 minute' where id=(select (v->>'scheduleId')::uuid from p23_state where k='created');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('first-due',workspace.executive_deliveries());
select is((select v->'deliveries'->0->>'outcome' from p23_state where k='first-due'),'ready','first due occurrence creates a native ready cue');
select is((select (v->'deliveries'->0->>'currentAttentionCount')::integer from p23_state where k='first-due'),0,'delivery reports the exact current attention total');
reset role;
select is((select count(*)::integer from workspace_private.executive_documents where workspace_id='23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'delivery creates no canonical Executive record');
update workspace_private.executive_delivery_schedules set next_occurrence=now()-interval '1 minute' where id=(select (v->>'scheduleId')::uuid from p23_state where k='created');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('unchanged-due',workspace.executive_deliveries());
select is((select v->'deliveries'->0->>'outcome' from p23_state where k='unchanged-due'),'skipped_unchanged','unchanged bounded attention skips a redundant cue');
reset role;
select is((select count(*)::integer from workspace_private.executive_documents where workspace_id='23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'unchanged evaluation still creates no canonical record');

insert into workspace_private.executive_documents(id,workspace_id,kind,revision,data,origin) values
('23888888-8888-4888-8888-888888888888','23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','commitment',1,
'{"title":"Fictional launch follow-through","notes":"","priority":"normal","reviewState":"user_stated","reviewDate":null,"references":[],"recordType":"commitment","state":"open","owner":"Fictional owner","outcome":"Client receives a reviewed handoff","nextAction":"Review the handoff","dueDate":null,"followupDate":null,"completedOn":null,"blocker":""}','user');
update workspace_private.executive_delivery_schedules set next_occurrence=now()-interval '1 minute' where id=(select (v->>'scheduleId')::uuid from p23_state where k='created');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('changed-due',workspace.executive_deliveries());
select is((select v->'deliveries'->0->>'outcome' from p23_state where k='changed-due'),'ready','a meaningful bounded attention change creates a new ready cue');
select is((select (v->'deliveries'->0->>'currentAttentionCount')::integer from p23_state where k='changed-due'),1,'changed cue carries the exact complete attention total');
reset role;
select is((select count(*)::integer from workspace_private.executive_documents where workspace_id='23aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'delivery does not add a record beyond the explicit fixture');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('grouped',workspace.executive_review_attention(current_date,0,25));
select is((select v->'groups'->0->>'groupKey' from p23_state where k='grouped'),'executive','attention groups the cue by source domain');
select is((select (v->'groups'->0->>'total')::integer from p23_state where k='grouped'),1,'source group reports a complete exact total');
select is((select sum((g->>'total')::integer)::integer from p23_state,jsonb_array_elements(v->'groups')g where k='grouped'),(select (v->>'total')::integer from p23_state where k='grouped'),'source groups sum to the attention total');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is(jsonb_array_length(workspace.executive_deliveries()->'schedules'),0,'another tenant has independent schedule history');
select throws_ok(format($q$select workspace.executive_change_delivery('{"scheduleId":"%s","expectedVersion":4,"requestId":"23333333-3333-4333-8333-333333333338","operation":"pause","definition":null,"confirmExactSchedule":true}')$q$,(select v->>'scheduleId' from p23_state where k='created')),'42501','Executive schedule unavailable.','another tenant cannot probe or change the owner schedule');
reset role;

update workspace.bundle_capabilities set enabled=false where bundle_key='executive' and capability_key='executive_brief';
update workspace_private.executive_delivery_schedules set next_occurrence=now()-interval '1 minute' where id=(select (v->>'scheduleId')::uuid from p23_state where k='created');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('cap-lost',workspace.executive_deliveries());
select is((select v->'schedules'->0->>'capabilityAvailable' from p23_state where k='cap-lost'),'false','retained schedule reports capability loss honestly');
reset role;
select is((select count(*)::integer from workspace_private.executive_delivery_events where schedule_id=(select (v->>'scheduleId')::uuid from p23_state where k='created')),3,'capability loss does not materialize the overdue occurrence');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p23_state values('paused-lost',workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',4,'requestId','23333333-3333-4333-8333-333333333339','operation','pause','definition',null,'confirmExactSchedule',true)));
select is((select v->>'status' from p23_state where k='paused-lost'),'paused','direct owner can stop a retained schedule after capability loss');
select throws_ok(format($q$select workspace.executive_change_delivery('{"scheduleId":"%s","expectedVersion":5,"requestId":"23333333-3333-4333-8333-333333333340","operation":"resume","definition":null,"confirmExactSchedule":true}')$q$,(select v->>'scheduleId' from p23_state where k='created')),'42501','Executive access is unavailable.','capability loss prevents resume');
insert into p23_state values('cancelled',workspace.executive_change_delivery(jsonb_build_object('scheduleId',(select v->>'scheduleId' from p23_state where k='created'),'expectedVersion',5,'requestId','23333333-3333-4333-8333-333333333341','operation','cancel','definition',null,'confirmExactSchedule',true)));
select is((select v->>'status' from p23_state where k='cancelled'),'cancelled','direct owner can permanently cancel after capability loss');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P23 revocation' where source_reference='p23-owner-executive';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($$select workspace.executive_deliveries()$$,'42501','Executive access is unavailable.','full Executive revocation closes schedule history');
select throws_ok(format($q$select workspace.executive_change_delivery('{"scheduleId":"%s","expectedVersion":6,"requestId":"23333333-3333-4333-8333-333333333342","operation":"cancel","definition":null,"confirmExactSchedule":true}')$q$,(select v->>'scheduleId' from p23_state where k='created')),'42501','Executive access is unavailable.','full revocation closes delivery receipts');
reset role;

select * from finish();
rollback;
