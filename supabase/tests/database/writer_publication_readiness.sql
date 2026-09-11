begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

select ok(not has_table_privilege(role_name,'workspace_private.'||table_name,privilege),role_name||' cannot '||privilege||' private '||table_name)
from unnest(array['anon','authenticated']) role_name
cross join unnest(array['writing_publication_queue','writing_publication_queue_revisions','writing_publication_link_evidence','writing_publication_requests']) table_name
cross join unnest(array['select','insert','update','delete']) privilege;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||table_name)::regclass),table_name||' has RLS enabled')
from unnest(array['writing_publication_queue','writing_publication_queue_revisions','writing_publication_link_evidence','writing_publication_requests']) table_name;
select ok(not has_function_privilege(role_name,function_name,'execute'),role_name||' cannot invoke '||function_name)
from unnest(array['anon','authenticated']) role_name cross join unnest(array[
 'workspace_private.publication_destination_valid(text)','workspace_private.publication_confirmations_valid(jsonb)',
 'workspace_private.require_writing_publication_direct()','workspace_private.writer_publication_queue_item(uuid,timestamp with time zone)'
]) function_name;
select ok(not has_function_privilege('anon',function_name,'execute'),'anonymous cannot invoke '||function_name)
from unnest(array[
 'workspace.writer_list_publication_queue(text,integer,integer)','workspace.writer_get_publication_queue_item(uuid)',
 'workspace.writer_save_publication_queue(uuid,integer,integer,uuid,text,text,text,jsonb,boolean)',
 'workspace.writer_record_publication_link(uuid,integer,uuid,text,text,text,boolean)'
]) function_name;
select ok(has_function_privilege('authenticated',function_name,'execute'),'authenticated uses guarded '||function_name)
from unnest(array[
 'workspace.writer_list_publication_queue(text,integer,integer)','workspace.writer_get_publication_queue_item(uuid)',
 'workspace.writer_save_publication_queue(uuid,integer,integer,uuid,text,text,text,jsonb,boolean)',
 'workspace.writer_record_publication_link(uuid,integer,uuid,text,text,text,boolean)'
]) function_name;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('21111111-1111-4111-8111-111111111111','authenticated','authenticated','p21.owner@example.invalid','{}','{}'),
('21222222-2222-4222-8222-222222222222','authenticated','authenticated','p21.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P21 owner','21111111-1111-4111-8111-111111111111'),
('21bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P21 other','21222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','21111111-1111-4111-8111-111111111111','owner','active'),
('21bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','21222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','21111111-1111-4111-8111-111111111111','personal'),
('21bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','21222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference) values
('21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','21111111-1111-4111-8111-111111111111','writer_editor','operator_assignment','p21-owner'),
('21bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','21222222-2222-4222-8222-222222222222','writer_editor','operator_assignment','p21-other');
insert into workspace_private.writing_resources(id,workspace_id,title,author,audience,topics,body_text,source_label,epistemic_state,publication_state,metadata) values
('21333333-3333-4333-8333-333333333333','21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fictional publication-ready resource','Fictional author','Community leaders',array['Welcome'],'Fictional reviewed source text.','Fictional P21 source','confirmed','ready','{"website_summary":"A useful fictional summary.","seo_description":"A concise fictional description."}'),
('21444444-4444-4444-8444-444444444444','21bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PRIVATE FOREIGN RESOURCE','Private author','Private readers',array['Private'],'PRIVATE FOREIGN BODY','PRIVATE FOREIGN SOURCE','confirmed','ready','{"website_summary":"PRIVATE","seo_description":"PRIVATE"}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is((workspace.writer_list_publication_queue()->>'total')::integer,0,'owner begins with an empty publication queue');
select is(workspace.writer_get_publication_queue_item('21333333-3333-4333-8333-333333333333'),'null'::jsonb,'an unqueued owner resource has no queue item');
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,0,'21555555-5555-4555-8555-555555555555','http://resources.example.com/item','','queued','{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)$q$,'22023','Review the exact revision, destination and confirmations.','HTTP destinations are rejected at the database boundary');
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,0,'21555555-5555-4555-8555-666666666666','https://127.0.0.1/item','','queued','{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)$q$,'22023','Review the exact revision, destination and confirmations.','IP-literal destinations are rejected at the database boundary');
create temp table p21_state(k text primary key,v jsonb);
grant all on p21_state to authenticated;
insert into p21_state values('created',workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,0,
 '21555555-5555-4555-8555-777777777777','https://resources.example.com/item','Fictional launch handoff','queued',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true));
select is((select v->>'replayed' from p21_state where k='created'),'false','the first queue save is not a replay');
select is((select v->'item'->>'evidenceStatus' from p21_state where k='created'),'unchecked','a destination without an observation is explicitly unchecked');
select ok(jsonb_path_exists((select v from p21_state where k='created'),'$.item.blockers[*] ? (@.code == "link_unchecked")'),'unchecked destination evidence blocks handoff');
select is(workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,0,
 '21555555-5555-4555-8555-777777777777','https://resources.example.com/item','Fictional launch handoff','queued',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)->>'replayed','true','lost create response replays exactly');
select throws_ok($q$select workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='created'),1,
 '21666666-6666-4666-8666-666666666666','redirected',null,'Observed a redirect',true)$q$,'22023','Record the exact destination result you observed.','redirect evidence requires a final URL');
insert into p21_state select 'checked',workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='created'),1,
 '21666666-6666-4666-8666-777777777777','working',null,'Opened manually in a fictional browser.',true);
select is((select v->'item'->>'evidenceStatus' from p21_state where k='checked'),'checked','a current matching working observation is checked');
select is((select v->'item'->'lastEvidence'->>'targetUrl' from p21_state where k='checked'),'https://resources.example.com/item','evidence is bound to the exact destination');
select is(workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='created'),1,
 '21666666-6666-4666-8666-777777777777','working',null,'Opened manually in a fictional browser.',true)->>'replayed','true','lost evidence response replays exactly');
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,2,
 '21666666-6666-4666-8666-777777777777','https://resources.example.com/item','','queued',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)$q$,'40001','Publication request already used.','a request identity cannot cross publication operations');
insert into p21_state select 'ready',workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,2,
 '21777777-7777-4777-8777-777777777777','https://resources.example.com/item','Fictional launch handoff','ready_for_handoff',
 '{"accuracyAndQuotesReviewed":true,"voiceReviewed":true,"rightsConfirmed":true}',true);
select is((select v->'item'->>'readyForHandoff' from p21_state where k='ready'),'true','complete current evidence derives readiness');
select is(jsonb_array_length((select v->'item'->'blockers' from p21_state where k='ready')),0,'ready item has no hidden blockers');
reset role;
select is(workspace_private.writer_publication_queue_item((select (v->'item'->>'id')::uuid from p21_state where k='ready'),now()+interval '31 days')->>'evidenceStatus','stale','link evidence ages to stale after 30 days');

insert into workspace_private.writing_proposals(id,resource_id,workspace_id,request_id,base_revision,patch,reason,evidence,origin) values
('21888888-8888-4888-8888-888888888888','21333333-3333-4333-8333-333333333333','21aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','21999999-9999-4999-8999-999999999999',1,'{"audience":"Fictional expanded audience"}','Fictional pending refinement','Fictional direct evidence','user');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,3,
 '21aaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','https://resources.example.com/item','Fictional launch handoff','handed_off',
 '{"accuracyAndQuotesReviewed":true,"voiceReviewed":true,"rightsConfirmed":true}',true)$q$,'22023','Resolve every current publication blocker before handoff.','handoff recomputes pending proposal blockers inside the write transaction');
reset role;
update workspace_private.writing_proposals set status='rejected',decided_at=now() where id='21888888-8888-4888-8888-888888888888';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p21_state select 'handed',workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',1,3,
 '21aaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2','https://resources.example.com/item','Fictional launch handoff','handed_off',
 '{"accuracyAndQuotesReviewed":true,"voiceReviewed":true,"rightsConfirmed":true}',true);
select is((select v->'item'->>'stage' from p21_state where k='handed'),'handed_off','handoff is recorded without claiming publication');
select ok(strpos((select v::text from p21_state where k='handed'),'Fictional reviewed source text.')=0,'queue receipts never contain source body text');
reset role;

update workspace_private.writing_resources set revision=2,updated_at=now() where id='21333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.writer_get_publication_queue_item('21333333-3333-4333-8333-333333333333')->>'evidenceStatus','stale','a newer resource revision stales prior evidence');
select ok(jsonb_path_exists(workspace.writer_get_publication_queue_item('21333333-3333-4333-8333-333333333333'),'$.blockers[*] ? (@.code == "revision_changed")'),'revision drift is an explicit blocker');
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',2,4,
 '21aaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3','https://resources.example.com/item','','ready_for_handoff',
 '{"accuracyAndQuotesReviewed":true,"voiceReviewed":true,"rightsConfirmed":true}',true)$q$,'22023','Rebase to the latest revision as queued and review every confirmation again.','rebasing cannot carry forward old human confirmations');
insert into p21_state select 'rebased',workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',2,4,
 '21aaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4','https://resources.example.com/item','','queued',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true);
select is((select v->'item'->>'version' from p21_state where k='rebased'),'5','rebase advances the exact queue version');
insert into p21_state select 'broken',workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='rebased'),5,
 '21aaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5','broken',null,'Observed a fictional missing page.',true);
select is((select v->'item'->>'stage' from p21_state where k='broken'),'blocked','a broken observation moves the item to blocked');
select is((select v->'item'->>'evidenceStatus' from p21_state where k='broken'),'error','a broken observation is explicit error evidence');
select throws_ok($q$select workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='rebased'),5,
 '21aaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6','working',null,'Stale-tab observation',true)$q$,'40001','The publication queue changed. Your observation was not recorded.','stale evidence cannot overwrite the current queue');
insert into p21_state select 'removed',workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',2,6,
 '21aaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7','https://resources.example.com/item','','removed',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true);
select is((workspace.writer_list_publication_queue()->>'total')::integer,0,'removed items leave the active queue');
select is(workspace.writer_get_publication_queue_item('21333333-3333-4333-8333-333333333333')->>'stage','removed','the resource view retains a recoverable queue tombstone');
select is(workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',2,6,
 '21aaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7','https://resources.example.com/item','','removed',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)->>'replayed','true','lost remove response replays without resurrecting the item');

select set_config('request.jwt.claims','{"sub":"21222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is((workspace.writer_list_publication_queue()->>'total')::integer,0,'another tenant has an independent queue');
select throws_ok($q$select workspace.writer_get_publication_queue_item('21333333-3333-4333-8333-333333333333')$q$,'P0002','Resource unavailable.','another tenant cannot probe an owner resource');
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"https://workspace.leademergence.com/api/mcp","client_id":"21bbbb01-bbbb-4bbb-8bbb-bbbbbbbbbbb1"}',true);
select throws_ok($q$select workspace.writer_list_publication_queue()$q$,'42501',null::text,'OAuth assistant cannot read the native publication queue');
select throws_ok($q$select workspace.writer_record_publication_link((select (v->'item'->>'id')::uuid from p21_state where k='rebased'),6,
 '21bbbb02-bbbb-4bbb-8bbb-bbbbbbbbbbb2','working',null,'Assistant claim',true)$q$,'42501',null::text,'OAuth assistant cannot record a user link observation');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P21 revocation' where source_reference='p21-owner';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"21111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.writer_list_publication_queue()$q$,'42501',null::text,'revocation closes publication queue reads immediately');
select throws_ok($q$select workspace.writer_save_publication_queue('21333333-3333-4333-8333-333333333333',2,7,
 '21cccc01-cccc-4ccc-8ccc-ccccccccccc1','https://resources.example.com/item','','queued',
 '{"accuracyAndQuotesReviewed":false,"voiceReviewed":false,"rightsConfirmed":false}',true)$q$,'42501',null::text,'revocation closes queue retry and restore operations immediately');
reset role;

select * from finish();
rollback;
