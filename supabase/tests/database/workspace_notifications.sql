begin;
select no_plan();
select ok(not has_table_privilege(r,'workspace_private.'||t,p),r||' cannot '||p||' '||t)
from unnest(array['anon','authenticated'])r cross join unnest(array['notification_settings','notification_preferences','notification_states','notification_receipts'])t cross join unnest(array['select','insert','update','delete'])p;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||t)::regclass),t||' has RLS')
from unnest(array['notification_settings','notification_preferences','notification_states','notification_receipts'])t;
select ok(not has_function_privilege(r,s,'execute'),r||' cannot invoke '||s)
from unnest(array['anon','authenticated'])r cross join unnest(array['workspace_private.require_notification_owner()','workspace_private.notification_types(uuid)','workspace_private.notification_timezone()','workspace_private.notification_rows(uuid)'])s;
select ok(not has_function_privilege('anon',s,'execute'),'anonymous cannot invoke '||s)
from unnest(array['workspace.native_notifications(text,text,integer)','workspace.native_change_notifications(jsonb)'])s;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('14111111-1111-4111-8111-111111111111','authenticated','authenticated','p14.owner@example.invalid','{}','{}'),
('14222222-2222-4222-8222-222222222222','authenticated','authenticated','p14.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P14 owner','14111111-1111-4111-8111-111111111111'),
('14bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P14 other','14222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','14111111-1111-4111-8111-111111111111','owner','active'),
('14bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','14222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','14111111-1111-4111-8111-111111111111','personal'),
('14bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','14222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference)
select '14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','14111111-1111-4111-8111-111111111111',b,'operator_assignment','p14-owner-'||b
from unnest(array['writer_editor','ministry','nonprofit_founder','investor','executive','workspace_experience'])b;
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference)
values('14bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','14222222-2222-4222-8222-222222222222','workspace_experience','operator_assignment','p14-other-experience');
insert into workspace.user_profiles(user_id,timezone) values('14111111-1111-4111-8111-111111111111','Pacific/Kiritimati') on conflict(user_id)do update set timezone=excluded.timezone;
insert into workspace_private.writing_resources(id,workspace_id,title,source_label,publication_state,body_text)
select ('14000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fictional ready resource '||i,'Fictional metadata','ready','PRIVATE BODY NOT IN NOTIFICATIONS' from generate_series(1,28)i;
insert into workspace_private.writing_resources(workspace_id,title,source_label,publication_state)
values('14bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','FOREIGN READY RESOURCE','Fictional metadata','ready');
-- Deliberately metadata-only rows test the notifier, not domain input validation.
insert into workspace_private.ministry_documents(workspace_id,kind,revision,data,origin) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','research',1,jsonb_build_object('title','Fictional research due','dueDate',(now() at time zone 'Pacific/Kiritimati')::date+7,'status','researching'),'user');
insert into workspace_private.nonprofit_documents(workspace_id,kind,revision,data,origin) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','partner',1,jsonb_build_object('title','Fictional follow-up','followupDate',(now() at time zone 'Pacific/Kiritimati')::date,'stage','conversation'),'user');
insert into workspace_private.investor_documents(workspace_id,kind,revision,data,origin) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','thesis',1,'{"title":"Fictional recorded concern","status":"active","changeAssessment":"challenged","invalidations":[],"thesis":"PRIVATE THESIS BODY"}','user');
insert into workspace_private.executive_documents(workspace_id,kind,revision,data,origin)
select '14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',k,1,jsonb_build_object('title','Fictional '||k,'state','draft','actions',
jsonb_build_array(jsonb_build_object('id','14444444-4444-4444-8444-444444444444','title','Fictional action '||k,'state','blocked','dueDate',null))),'user'
from unnest(array['daily_brief','weekly_review'])k;
insert into workspace_private.executive_documents(workspace_id,kind,revision,data,origin) values
('14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','commitment',1,'{"title":"Fictional blocked commitment","state":"blocked","dueDate":null,"followupDate":null}','user');
insert into auth.oauth_clients(id,registration_type,redirect_uris,grant_types,client_type,token_endpoint_auth_method)
values('14555555-5555-4555-8555-555555555555','dynamic','https://example.invalid/callback','authorization_code,refresh_token','public','none');
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,status,granted_scopes)
values('14111111-1111-4111-8111-111111111111','14555555-5555-4555-8555-555555555555','https://workspace.leademergence.com/api/mcp','active',array['openid']);
create temp table p14_cache(k text primary key,v jsonb);
grant all on p14_cache to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"14111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into p14_cache values('initial',workspace.native_notifications());
select is((select v->>'timeZone' from p14_cache where k='initial'),'Pacific/Kiritimati','saved time zone used');
select is((select v->>'asOfDate' from p14_cache where k='initial'),(now() at time zone 'Pacific/Kiritimati')::date::text,'date follows saved zone');
select is((select (v->>'total')::int from p14_cache where k='initial'),35,'all seven functional condition groups plus connection represented');
select is((select jsonb_array_length(v->'types') from p14_cache where k='initial'),8,'all eight admitted notification types');
select is((select jsonb_array_length(v->'items') from p14_cache where k='initial'),25,'first page bounded');
select is(jsonb_array_length(workspace.native_notifications('inbox',null,25)->'items'),10,'complete next page');
select ok((workspace.native_notifications()::text||workspace.native_notifications('inbox',null,25)::text) !~ 'PRIVATE|FOREIGN|ciphertext|client_id','no body, foreign content or credential material');
select is((workspace.native_notifications('inbox','writer.notification.publication_ready')->>'total')::int,28,'type filter exact');
select throws_ok($q$select workspace.native_notifications('sent')$q$,'22023','Choose a valid notification view and page.','sent view not fabricated');
select throws_ok($q$select workspace.native_notifications('inbox',null,1)$q$,'22023','Choose a valid notification view and page.','noncanonical offset denied');
insert into p14_cache select 'writer',workspace.native_notifications('inbox','writer.notification.publication_ready')->'items'->0;
insert into p14_cache select 'change',jsonb_build_object('kind','items','requestId','14666666-6666-4666-8666-666666666666','expectedVersion',0,'action','read','items',jsonb_build_array(jsonb_build_object('id',v->>'id','revision',v->>'revision')))from p14_cache where k='writer';
insert into p14_cache select 'receipt',workspace.native_change_notifications(v) from p14_cache where k='change';
select is((workspace.native_notifications()->'counts'->>'unread')::int,34,'read acknowledged once');
select is(workspace.native_change_notifications((select v from p14_cache where k='change')),(select v from p14_cache where k='receipt'),'exact retry returns same receipt');
select is((workspace.native_notifications()->>'version')::int,1,'retry does not increment version');
select throws_ok($q$select workspace.native_change_notifications((select v||'{"action":"dismiss"}'::jsonb from p14_cache where k='change'))$q$,'40001','This request was already used.','conflicting receipt reuse rejected');
select throws_ok($q$select workspace.native_change_notifications((select v||'{"requestId":"14777777-7777-4777-8777-777777777777","action":"dismiss"}'::jsonb from p14_cache where k='change'))$q$,'40001','Notification choices changed. Refresh and review again.','stale tab does not overwrite read');
select lives_ok($q$select workspace.native_change_notifications((select v||'{"requestId":"14777777-7777-4777-8777-777777777777","expectedVersion":1,"action":"dismiss"}'::jsonb from p14_cache where k='change'))$q$,'dismiss current');
select is((workspace.native_notifications()->'counts'->>'dismissed')::int,1,'dismiss has its own view');
select is((workspace.native_notifications('dismissed')->>'total')::int,1,'dismiss reversible through current source');
select lives_ok($q$select workspace.native_change_notifications((select v||'{"requestId":"14888888-8888-4888-8888-888888888888","expectedVersion":2,"action":"snooze"}'::jsonb from p14_cache where k='change'))$q$,'snooze current');
select is((workspace.native_notifications()->'counts'->>'later')::int,1,'later separate from read and dismissal');
select is((workspace.native_notifications('later')->'items'->0->>'snoozedUntil')::timestamptz,now()+interval '24 hours','snooze duration is server chosen');
select lives_ok($q$select workspace.native_change_notifications('{"kind":"preference","requestId":"14999999-9999-4999-8999-999999999999","expectedVersion":3,"typeId":"writer.notification.publication_ready","enabled":false}')$q$,'mute only admitted type');
select is((workspace.native_notifications()->'counts'->>'muted')::int,28,'muting removes complete type from inbox counts');
select is((workspace.native_notifications()->'counts'->>'inbox')::int,7,'other source updates remain');
select lives_ok($q$select workspace.native_change_notifications('{"kind":"preference","requestId":"14aaaaaa-1111-4111-8111-111111111111","expectedVersion":4,"typeId":"writer.notification.publication_ready","enabled":true}')$q$,'unmute preserves individual state');
select is((workspace.native_notifications()->'counts'->>'later')::int,1,'unmute retains snooze');
reset role;
update workspace_private.notification_states set snoozed_until=now()-interval '1 second' where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update workspace_private.writing_resources set title=title||' edited',updated_at=clock_timestamp() where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((workspace.native_notifications()->'counts'->>'unread')::int,35,'expired snooze reappears on next check');
select is((select i->>'revision' from jsonb_array_elements(workspace.native_notifications('inbox','writer.notification.publication_ready')->'items')i where i->>'id'=(select v->>'id' from p14_cache where k='writer')),(select v->>'revision' from p14_cache where k='writer'),'routine title edits preserve condition fingerprint');
select throws_ok($q$select workspace.native_change_notifications('{}')$q$,'22023','Review a valid notification change.','missing change fields denied');
select throws_ok($q$select workspace.native_change_notifications('{"kind":"preference","requestId":"14bbbbbb-1111-4111-8111-111111111111","expectedVersion":5,"typeId":"writer.notification.publication_ready","enabled":"false"}')$q$,'22023','Review a valid notification change.','truthy preference string denied');
select throws_ok($q$select workspace.native_change_notifications((select v||'{"items":[]}'::jsonb from p14_cache where k='change'))$q$,'22023','Review one to twenty-five distinct current notifications.','empty bulk denied');
select throws_ok($q$select workspace.native_change_notifications((select v||jsonb_build_object('items',(v->'items')||(v->'items')) from p14_cache where k='change'))$q$,'22023','Review one to twenty-five distinct current notifications.','duplicate bulk denied');
select is((workspace.native_notifications()->>'version')::int,5,'invalid requests never change inbox version');
insert into p14_cache select 'research',workspace.native_notifications('inbox','ministry.notification.teaching_due')->'items'->0;
insert into p14_cache select 'research_change',jsonb_build_object('kind','items','requestId','14cccccc-1111-4111-8111-111111111111','expectedVersion',5,'action','read','items',jsonb_build_array(jsonb_build_object('id',v->>'id','revision',v->>'revision'))) from p14_cache where k='research';
select lives_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='research_change'))$q$,'research acknowledgement saved');
reset role;
update workspace_private.ministry_documents set data=jsonb_set(data,'{dueDate}',to_jsonb((now() at time zone 'Pacific/Kiritimati')::date::text)),revision=revision+1 where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is(workspace.native_notifications('inbox','ministry.notification.teaching_due')->'items'->0->>'status','unread','changed recorded date reopens unread');
select throws_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='research_change'))$q$,'40001','Notification changed. Refresh and review again.','changed date invalidates the old reviewed source');
select is((workspace.native_notifications()->>'version')::int,6,'changed-source rejection has no side effects');
reset role;
update workspace_private.ministry_documents set data=jsonb_set(data,'{status}','"archived"') where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((workspace.native_notifications('inbox','ministry.notification.teaching_due')->>'total')::int,0,'resolved research leaves inbox');
select throws_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='research_change'))$q$,'42501','Notification source unavailable. Refresh.','resolved source cannot be acknowledged from old tab');
select set_config('request.jwt.claims','{"sub":"14222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is((workspace.native_notifications()->>'total')::int,0,'other owner cannot see foreign work or unassigned own writing');
select throws_ok($q$select workspace.native_notifications('inbox','writer.notification.publication_ready')$q$,'42501','Notification type unavailable.','unassigned filter denied');
select throws_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='change'))$q$,'42501','Notification source unavailable. Refresh.','foreign item changes denied');
select set_config('request.jwt.claims','{"sub":"14111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"fictional-hostile"}',true);
select throws_ok('select workspace.native_notifications()','42501','Use the native Workspace connection center.','OAuth inbox denied');
select throws_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='change'))$q$,'42501','Use the native Workspace connection center.','OAuth acknowledgement denied');
reset role;
update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P14 revocation' where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key='writer_editor';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"14111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select is((workspace.native_notifications()->>'total')::int,6,'revoked source removed from all current counts');
select throws_ok($q$select workspace.native_change_notifications((select v from p14_cache where k='change'))$q$,'42501','Notification source unavailable. Refresh.','receipt replay after revocation does not expose source');
reset role;
select is((select count(*)::int from workspace_private.writing_resources where workspace_id='14aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and publication_state='ready'),28,'all notification actions leave original work untouched');
select * from finish();
rollback;
