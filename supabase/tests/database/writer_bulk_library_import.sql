begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

select ok(not has_table_privilege(role_name,'workspace_private.'||table_name,privilege),role_name||' cannot '||privilege||' private '||table_name)
from unnest(array['anon','authenticated']) role_name
cross join unnest(array['writing_import_batches','writing_batch_import_receipts']) table_name
cross join unnest(array['select','insert','update','delete']) privilege;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||table_name)::regclass),table_name||' has RLS enabled')
from unnest(array['writing_import_batches','writing_batch_import_receipts']) table_name;
select ok(not has_function_privilege(role_name,function_name,'execute'),role_name||' cannot invoke '||function_name)
from unnest(array['anon','authenticated']) role_name cross join unnest(array[
  'workspace_private.validate_writing_import_batch(jsonb)',
  'workspace_private.writing_import_batch_snapshot(workspace_private.writing_import_batches)',
  'workspace_private.writing_import_batch_review_items(uuid,jsonb)'
]) function_name;
select ok(not has_function_privilege('anon',function_name,'execute'),'anonymous cannot invoke '||function_name)
from unnest(array[
  'workspace.writer_get_import_batch()','workspace.writer_save_import_batch(integer,uuid,jsonb)',
  'workspace.writer_clear_import_batch(integer)','workspace.writer_review_import_batch(integer)',
  'workspace.writer_commit_import_batch(integer,uuid,text,boolean)'
]) function_name;
select ok(has_function_privilege('authenticated',function_name,'execute'),'authenticated uses guarded '||function_name)
from unnest(array[
  'workspace.writer_get_import_batch()','workspace.writer_save_import_batch(integer,uuid,jsonb)',
  'workspace.writer_clear_import_batch(integer)','workspace.writer_review_import_batch(integer)',
  'workspace.writer_commit_import_batch(integer,uuid,text,boolean)'
]) function_name;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('20111111-1111-4111-8111-111111111111','authenticated','authenticated','p20.owner@example.invalid','{}','{}'),
('20222222-2222-4222-8222-222222222222','authenticated','authenticated','p20.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P20 owner','20111111-1111-4111-8111-111111111111'),
('20bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P20 other','20222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20111111-1111-4111-8111-111111111111','owner','active'),
('20bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20111111-1111-4111-8111-111111111111','personal'),
('20bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference) values
('20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20111111-1111-4111-8111-111111111111','writer_editor','operator_assignment','p20-owner'),
('20bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20222222-2222-4222-8222-222222222222','writer_editor','operator_assignment','p20-other');
insert into workspace_private.writing_resources(id,workspace_id,title,body_text,source_label) values
('20333333-3333-4333-8333-333333333333','20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fictional duplicate title','Same source','Fictional P20 existing source'),
('20333333-3333-4333-8333-444444444444','20bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PRIVATE FOREIGN TITLE','Same source','PRIVATE FOREIGN SOURCE');

create temp table p20_state(k text primary key,v jsonb);
insert into p20_state values ('batch',$json$[
  {"itemId":"20444444-4444-4444-8444-444444444444","extraction":{"schemaVersion":"1.0","file":{"name":"first.docx","format":"word_docx","mediaType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","byteSize":13,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"titleSuggestion":"First","text":"Same   source","characterCount":13,"wordCount":2,"pageCount":null,"warnings":["formatting_not_preserved","review_extracted_text"],"originalRetained":false},"title":"Fictional duplicate title","sourceLabel":"Imported from first.docx","resourceType":"article","included":true},
  {"itemId":"20555555-5555-4555-8555-555555555555","extraction":{"schemaVersion":"1.0","file":{"name":"second.pdf","format":"pdf","mediaType":"application/pdf","byteSize":11,"sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"titleSuggestion":"Second","text":"Same source","characterCount":11,"wordCount":2,"pageCount":1,"warnings":["pdf_reading_order_may_differ","review_extracted_text"],"originalRetained":false},"title":"FICTIONAL DUPLICATE TITLE","sourceLabel":"Imported from second.pdf","resourceType":"sermon","included":true}
]$json$::jsonb);
grant all on p20_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is((workspace.writer_get_import_batch()->>'version')::integer,0,'owner begins with an empty batch');
select is(workspace.writer_get_import_batch()->'items','null'::jsonb,'empty snapshot contains no extracted text');
select throws_ok($q$select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-666666666666','[]')$q$,'22023','Stage between 1 and 20 resources.','empty staging lists are rejected');
select throws_ok($q$select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-111111111111',jsonb_set((select v from p20_state where k='batch'),'{0,itemId}',to_jsonb('A0444444-ABCD-4444-8444-ABCDEFABCDEF'::text)))$q$,'22023','Use a canonical staged resource identity.','direct RPC requires canonical lower-case item identity');
select throws_ok($q$select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-222222222222',jsonb_set((select v from p20_state where k='batch'),'{0,extraction,file,byteSize}','999999999999999999999999'::jsonb))$q$,'22023','Invalid extracted source descriptor.','oversized numeric input is rejected before integer casting');
select throws_ok($q$
  select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-777777777777',(
    select jsonb_agg(jsonb_set(jsonb_set((select v->0 from p20_state where k='batch'),'{itemId}',to_jsonb(gen_random_uuid()::text)),'{extraction,text}',to_jsonb(repeat('x',100000))))
    from generate_series(1,6)
  ))
$q$,'22023','Staged source text exceeds the aggregate limit.','direct RPC cannot exceed the aggregate extracted-text limit');
insert into p20_state select 'saved',workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-666666666666',v) from p20_state where k='batch';
select is((select (v->>'version')::integer from p20_state where k='saved'),1,'the exact staging list is versioned');
select is(workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-666666666666',(select v from p20_state where k='batch')),(select v from p20_state where k='saved'),'lost save response retries exactly');
select throws_ok($q$select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-888888888888',(select v from p20_state where k='batch'))$q$,'40001','A newer staging list exists. Your edits have not overwritten it.','a stale tab cannot overwrite the staging list');
select is((workspace.writer_get_import_batch()->'items')->0->'extraction'->>'text','Same   source','owner can resume exact extracted text');
insert into p20_state select 'review',workspace.writer_review_import_batch(1);
select is(length((select v->>'reviewToken' from p20_state where k='review')),64,'review returns a bounded freshness token');
select ok(jsonb_path_exists((select v from p20_state where k='review'),'$.items[*].candidates[*] ? (@.candidateType == "existing_resource")'),'review identifies an existing-resource duplicate candidate');
select ok(jsonb_path_exists((select v from p20_state where k='review'),'$.items[*].candidates[*] ? (@.candidateType == "staged_item")'),'review identifies duplicates within the staging list');
select ok(strpos((select v::text from p20_state where k='review'),'PRIVATE FOREIGN')=0,'review does not disclose another workspace');
select throws_ok($q$select workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='review'),false)$q$,'22023','Review duplicates and confirm the complete import.','database requires explicit confirmation');
select throws_ok($q$select workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-666666666666',null,true)$q$,'22023','Review duplicates and confirm the complete import.','database rejects a missing review token explicitly');
select lives_ok($q$select workspace.writer_import_resource('20888888-8888-4888-8888-888888888888','{"title":"Fictional duplicate title","body_text":"A newly staged neighboring source","source_label":"Fictional P20 concurrent source"}')$q$,'a new matching library item can arrive after review');
select throws_ok($q$select workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='review'),true)$q$,'40001','The library changed. Review duplicates again before importing.','commit rejects stale duplicate evidence');
insert into p20_state select 'fresh_review',workspace.writer_review_import_batch(1);
insert into p20_state select 'commit',workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true);
select is(jsonb_array_length((select v->'resources' from p20_state where k='commit')),2,'one atomic commit returns every included resource');
select is((workspace.writer_list_resources()->>'total')::integer,4,'commit creates exactly two resources after two pre-existing owner records');
select is(workspace.writer_get_import_batch()->'items','null'::jsonb,'successful commit retires staged source text');
select is((workspace.writer_get_import_batch()->>'version')::integer,2,'commit advances a content-free tombstone');
select is((workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true)->>'replayed')::boolean,true,'lost commit response replays without duplicate imports');
select is(workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true)->'resources',(select v->'resources' from p20_state where k='commit'),'replay returns the same imported resource identities');
select throws_ok($q$select workspace.writer_commit_import_batch(2,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true)$q$,'40001','Import request already used.','commit request cannot be rebound to another batch');
select throws_ok($q$select workspace.writer_save_import_batch(0,'20666666-6666-4666-8666-999999999999',(select v from p20_state where k='batch'))$q$,'40001','A newer staging list exists. Your edits have not overwritten it.','old autosave cannot resurrect committed text');
reset role;
select ok(strpos((select resources::text from workspace_private.writing_batch_import_receipts where workspace_id='20aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Same source')=0,'retry receipt retains no extracted body text');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is((workspace.writer_get_import_batch()->>'version')::integer,0,'another entitled owner has an independent staging list');
select is(workspace.writer_get_import_batch()->'items','null'::jsonb,'another owner cannot read staged or committed owner data');
select set_config('request.jwt.claims','{"sub":"20111111-1111-4111-8111-111111111111","role":"authenticated","aud":"https://workspace.leademergence.com/api/mcp","client_id":"20999999-9999-4999-8999-999999999999"}',true);
select throws_ok($q$select workspace.writer_get_import_batch()$q$,'42501',null::text,'OAuth assistant cannot read native staging text');
select throws_ok($q$select workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true)$q$,'42501',null::text,'OAuth assistant cannot replay a native batch approval');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P20 revocation' where source_reference='p20-owner';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.writer_get_import_batch()$q$,'42501',null::text,'revocation closes batch recovery immediately');
select throws_ok($q$select workspace.writer_commit_import_batch(1,'20777777-7777-4777-8777-777777777777',(select v->>'reviewToken' from p20_state where k='fresh_review'),true)$q$,'42501',null::text,'revocation closes commit replay immediately');
reset role;

select * from finish();
rollback;
