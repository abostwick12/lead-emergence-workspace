begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

select is(has_function_privilege('anon','workspace.authorize_source_intake(text)','execute'),false,'anonymous source intake is denied');
select is(has_function_privilege('authenticated','workspace.authorize_source_intake(text)','execute'),true,'authenticated callers use the guarded intake authorizer');

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('19111111-1111-4111-8111-111111111111','authenticated','authenticated','p19.owner@example.invalid','{}','{}'),
('19222222-2222-4222-8222-222222222222','authenticated','authenticated','p19.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P19 owner','19111111-1111-4111-8111-111111111111'),
('19bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P19 other','19222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','19111111-1111-4111-8111-111111111111','owner','active'),
('19bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','19222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','19111111-1111-4111-8111-111111111111','personal'),
('19bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','19222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference) values
('19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','19111111-1111-4111-8111-111111111111','writer_editor','operator_assignment','p19-writer'),
('19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','19111111-1111-4111-8111-111111111111','ministry','operator_assignment','p19-ministry');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select is(workspace.authorize_source_intake('writer_resource')->>'workspaceId','19aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Writer intake resolves the authenticated owner workspace');
select is(workspace.authorize_source_intake('writer_resource')->>'bundleKey','writer_editor','Writer intake returns its fixed bundle');
select is(workspace.authorize_source_intake('ministry_archive')->>'purpose','ministry_archive','Ministry archive intake is admitted independently');
select throws_ok($q$select workspace.authorize_source_intake('investor_filing')$q$,'22023','Choose a supported source destination.','unknown destinations are rejected rather than inferred');
select set_config('request.jwt.claims','{"sub":"19111111-1111-4111-8111-111111111111","role":"authenticated","aud":"https://workspace.leademergence.com/api/mcp","client_id":"19333333-3333-4333-8333-333333333333"}',true);
select throws_ok($q$select workspace.authorize_source_intake('writer_resource')$q$,'42501','Open Workspace to import a source yourself.','OAuth-shaped assistant cannot submit file intake');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.authorize_source_intake('writer_resource')$q$,'42501','Writer source intake is unavailable.','another owner without Writer cannot inherit intake');
select throws_ok($q$select workspace.authorize_source_intake('ministry_archive')$q$,'42501','Ministry archive intake is unavailable.','another owner without Ministry cannot inherit intake');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P19 revocation' where source_reference='p19-writer';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.authorize_source_intake('writer_resource')$q$,'42501','Writer source intake is unavailable.','Writer revocation closes intake immediately');
select is(workspace.authorize_source_intake('ministry_archive')->>'bundleKey','ministry','Writer revocation does not remove Ministry intake');
reset role;

select * from finish();
rollback;
