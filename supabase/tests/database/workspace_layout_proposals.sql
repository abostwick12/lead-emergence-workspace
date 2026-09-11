begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

select ok(not has_table_privilege(role_name,'workspace_private.'||table_name,privilege),role_name||' cannot '||privilege||' private '||table_name)
from unnest(array['anon','authenticated']) role_name cross join unnest(array['layout_proposals','layout_proposal_decisions']) table_name
cross join unnest(array['select','insert','update','delete']) privilege;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||table_name)::regclass),table_name||' has RLS enabled')
from unnest(array['layout_proposals','layout_proposal_decisions']) table_name;
select ok(not has_function_privilege(role_name,function_name,'execute'),role_name||' cannot invoke '||function_name)
from unnest(array['anon','authenticated']) role_name cross join unnest(array[
 'workspace_private.require_layout_proposal_workspace()','workspace_private.require_layout_proposal_direct()',
 'workspace_private.layout_proposal_object_length(jsonb)','workspace_private.layout_proposal_operations_valid(jsonb)',
 'workspace_private.layout_item_admitted(uuid,text)','workspace_private.apply_layout_proposal_operations(jsonb,jsonb,uuid)'
]) function_name;
select ok(not has_function_privilege('anon',function_name,'execute'),'anonymous cannot invoke '||function_name)
from unnest(array['workspace.layout_proposal_context()','workspace.propose_workspace_layout(integer,text,uuid,text,text,text,text,jsonb)',
 'workspace.list_workspace_layout_proposals()','workspace.decide_workspace_layout_proposal(uuid,integer,integer,text,uuid,text,boolean,text)']) function_name;
select ok(has_function_privilege('authenticated',function_name,'execute'),'authenticated uses guarded '||function_name)
from unnest(array['workspace.layout_proposal_context()','workspace.propose_workspace_layout(integer,text,uuid,text,text,text,text,jsonb)',
 'workspace.list_workspace_layout_proposals()','workspace.decide_workspace_layout_proposal(uuid,integer,integer,text,uuid,text,boolean,text)']) function_name;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('22111111-1111-4111-8111-111111111111','authenticated','authenticated','p22.owner@example.invalid','{}','{}'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','p22.other@example.invalid','{}','{}');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P22 owner','22111111-1111-4111-8111-111111111111'),
('22bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P22 other','22222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22111111-1111-4111-8111-111111111111','owner','active'),
('22bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22111111-1111-4111-8111-111111111111','personal'),
('22bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22111111-1111-4111-8111-111111111111','workspace_experience','operator_assignment','p22-owner-experience'),
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22111111-1111-4111-8111-111111111111','writer_editor','operator_assignment','p22-owner-writer'),
('22bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','workspace_experience','operator_assignment','p22-other-experience');
-- A formerly available Ministry choice is retained without disclosing its ID to OAuth context.
insert into workspace_private.layout_preferences(workspace_id,revision,preferences) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{"schemaVersion":"1.0","hiddenItemIds":["ministry:ministry.nav.home"],"pinnedNavigationIds":[],"pinnedWidgetIds":[],"orderOverrides":{"ministry:ministry.nav.home":7},"defaultWorkspaceRoute":"/workspace"}');

insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'22111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values
('22111111-1111-4111-8111-111111111111','22cccccc-cccc-4ccc-8ccc-cccccccccccc','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
select set_config('request.p22_oauth',jsonb_build_object('sub','22111111-1111-4111-8111-111111111111','role','authenticated',
 'aud','https://workspace.leademergence.com/api/mcp','client_id','22cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp',true,
 'iat',floor(extract(epoch from clock_timestamp())))::text,true);
create temp table p22_state(k text primary key,v jsonb);grant all on p22_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p22_oauth'),true);
insert into p22_state values('context1',workspace.layout_proposal_context());
select is((select v->>'workspaceId' from p22_state where k='context1'),'22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OAuth context binds the owner workspace');
select is((select (v->>'layoutRevision')::integer from p22_state where k='context1'),1,'OAuth context binds the exact layout revision');
select is((select jsonb_array_length(v->'items') from p22_state where k='context1'),3,'only currently admitted Workspace and Writer contributions are exposed');
select is((select (v->>'dormantChoiceCount')::integer from p22_state where k='context1'),1,'one unavailable saved choice is counted');
select ok((select v::text not like '%ministry.nav.home%' from p22_state where k='context1'),'dormant identity is not disclosed to OAuth');
select ok((select bool_and(x->>'bundleKey' in ('workspace_experience','writer_editor')) from p22_state,jsonb_array_elements(v->'items') x where k='context1'),'every exposed item belongs to an entitled bundle');
select throws_ok($q$select workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),'22333333-3333-4333-8333-333333333331',
 'Unsupported guess','Make the workspace better','assistant_inferred','This recommendation has no grounded basis.',
 '[{"kind":"set_pin","itemId":"writer_editor:writer.nav.writing","pinned":true,"reason":"The assistant simply guessed this preference.","basis":["assistant_inference"]}]')$q$,'22023','Review a valid grounded proposal.','assistant inference cannot be the only basis');
select throws_ok($q$select workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),'22333333-3333-4333-8333-333333333332',
 'Unavailable Ministry','Open Ministry first','user_stated','This tries to target an unavailable contribution.',
 '[{"kind":"set_pin","itemId":"ministry:ministry.nav.home","pinned":true,"reason":"The user stated that Ministry should be first.","basis":["user_stated_priority"]}]')$q$,'42501','Layout item unavailable.','OAuth cannot target a dormant item it was not shown');
select throws_ok($q$select workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),'22333333-3333-4333-8333-333333333333',
 'No actual change','Keep the current workspace','user_stated','This operation exactly repeats the current visible state.',
 '[{"kind":"set_visibility","itemId":"writer_editor:writer.nav.writing","visible":true,"reason":"The current layout already shows the Writing navigation.","basis":["current_layout"]}]')$q$,'22023','The proposal must change the current layout.','a no-op cannot create recommendation clutter');
insert into p22_state select 'proposal1',workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),
 '22333333-3333-4333-8333-333333333334','Put Writing first','Reach current writing with less navigation','user_stated',
 'Pin Writing and use it as the starting workspace without changing access.',
 '[{"kind":"set_pin","itemId":"writer_editor:writer.nav.writing","pinned":true,"reason":"The user said Writing is the first workspace opened each day.","basis":["user_stated_priority","enabled_capability"]},{"kind":"set_default_workspace","route":"/workspace/writing","reason":"The stated daily priority is to begin in the Writing workspace.","basis":["user_stated_priority"]}]');
select is((select v->>'status' from p22_state where k='proposal1'),'pending','a grounded proposal waits for review');
select is((select v->>'replayed' from p22_state where k='proposal1'),'false','the initial proposal is not a replay');
select is(workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),
 '22333333-3333-4333-8333-333333333334','Put Writing first','Reach current writing with less navigation','user_stated',
 'Pin Writing and use it as the starting workspace without changing access.',
 '[{"kind":"set_pin","itemId":"writer_editor:writer.nav.writing","pinned":true,"reason":"The user said Writing is the first workspace opened each day.","basis":["user_stated_priority","enabled_capability"]},{"kind":"set_default_workspace","route":"/workspace/writing","reason":"The stated daily priority is to begin in the Writing workspace.","basis":["user_stated_priority"]}]')->>'replayed','true','a lost proposal response replays exactly');
select throws_ok($q$select workspace.propose_workspace_layout(1,(select v->>'authorityRevision' from p22_state where k='context1'),
 '22333333-3333-4333-8333-333333333334','Changed meaning','Reach current writing with less navigation','user_stated','This tries to rebind the request identity.',
 '[{"kind":"set_pin","itemId":"writer_editor:writer.nav.writing","pinned":true,"reason":"The user said Writing is the first workspace opened each day.","basis":["user_stated_priority"]}]')$q$,'40001','This proposal request already means something else.','a proposal request cannot be rebound');
select throws_ok($q$select workspace.list_workspace_layout_proposals()$q$,'42501',null::text,'OAuth cannot list the native proposal history');
select throws_ok($q$select workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),1,1,
 (select v->>'authorityRevision' from p22_state where k='context1'),'22444444-4444-4444-8444-444444444441','accept',true,'Assistant attempted approval')$q$,'42501',null::text,'OAuth cannot accept a layout proposal');
reset role;
select is((select created_by_type from workspace_private.layout_proposals where request_id='22333333-3333-4333-8333-333333333334'),'assistant','proposal provenance records the OAuth assistant');
select ok((select proposed_preferences->'hiddenItemIds' ? 'ministry:ministry.nav.home' from workspace_private.layout_proposals where request_id='22333333-3333-4333-8333-333333333334'),'proposal application preserves the dormant hidden choice');
select is((select (proposed_preferences->'orderOverrides'->>'ministry:ministry.nav.home')::integer from workspace_private.layout_proposals where request_id='22333333-3333-4333-8333-333333333334'),7,'proposal application preserves dormant order');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p22_state select 'native1',workspace.list_workspace_layout_proposals();
select is((select jsonb_array_length(v->'items') from p22_state where k='native1'),1,'native owner sees the pending recommendation');
select is((select v->'items'->0->>'createdBy' from p22_state where k='native1'),'assistant','native review shows proposal provenance');
select ok((select v->'items'->0->'proposedPreferences'->'hiddenItemIds' ? 'ministry:ministry.nav.home' from p22_state where k='native1'),'native review retains dormant preferences without naming them in assistant context');
insert into p22_state select 'accepted',workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),1,1,
 (select v->>'authorityRevision' from p22_state where k='context1'),'22444444-4444-4444-8444-444444444442','accept',true,'Reviewed the exact fictional preview.');
select is((select v->>'status' from p22_state where k='accepted'),'accepted','native confirmation accepts the exact proposal');
select is((select (v->>'resultingLayoutRevision')::integer from p22_state where k='accepted'),2,'acceptance creates one new layout revision');
select is((select v->>'replayed' from p22_state where k='accepted'),'false','first acceptance is not a replay');
select is(workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),1,1,
 (select v->>'authorityRevision' from p22_state where k='context1'),'22444444-4444-4444-8444-444444444442','accept',true,'Reviewed the exact fictional preview.')->>'replayed','true','lost acceptance response replays exactly');
select throws_ok($q$select workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),1,1,
 (select v->>'authorityRevision' from p22_state where k='context1'),'22444444-4444-4444-8444-444444444442','reject',true,'Changed decision')$q$,'40001','This proposal decision request already means something else.','a decision request cannot be rebound');
reset role;
select ok((select preferences->'pinnedNavigationIds' ? 'writer_editor:writer.nav.writing' from workspace_private.layout_preferences where workspace_id='22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'accepted proposal pins the admitted navigation');
select is((select preferences->>'defaultWorkspaceRoute' from workspace_private.layout_preferences where workspace_id='22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'/workspace/writing','accepted proposal changes the starting workspace');
select ok((select preferences->'hiddenItemIds' ? 'ministry:ministry.nav.home' from workspace_private.layout_preferences where workspace_id='22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'acceptance preserves dormant preferences');
select is((select count(*)::integer from workspace_private.layout_versions where workspace_id='22aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'acceptance writes one normal recoverable layout version');

-- A second proposal becomes stale after a separate native layout save, then can
-- be rejected but never accepted.
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p22_oauth'),true);
insert into p22_state select 'context2',workspace.layout_proposal_context();
insert into p22_state select 'proposal2',workspace.propose_workspace_layout(2,(select v->>'authorityRevision' from p22_state where k='context2'),
 '22333333-3333-4333-8333-333333333335','Hide the handoff card','Reduce the Home view to navigation','assistant_inferred',
 'Hide the enabled Writing handoff card while retaining access and notification state.',
 '[{"kind":"set_visibility","itemId":"writer_editor:writer.widget.publication_queue","visible":false,"reason":"The current layout shows this enabled card and the inferred goal is a smaller Home view.","basis":["current_layout","enabled_capability","assistant_inference"]}]');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select lives_ok($q$select workspace.save_workspace_layout(
 '{"schemaVersion":"1.0","hiddenItemIds":["ministry:ministry.nav.home"],"pinnedNavigationIds":["writer_editor:writer.nav.writing"],"pinnedWidgetIds":[],"orderOverrides":{"ministry:ministry.nav.home":7,"writer_editor:writer.nav.writing":0},"defaultWorkspaceRoute":"/workspace/writing"}',
 2,(select v->>'authorityRevision' from p22_state where k='context2'),'22444444-4444-4444-8444-444444444443',true)$q$,'a separate native save advances the layout');
select is((workspace.list_workspace_layout_proposals()->'items'->0->>'status'),'stale','layout drift marks the newer pending proposal stale');
select throws_ok($q$select workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal2'),1,3,
 (select v->>'authorityRevision' from p22_state where k='context2'),'22444444-4444-4444-8444-444444444444','accept',true,'Tried to accept stale proposal')$q$,'40001','This recommendation is stale. Ask for a fresh proposal.','stale proposal cannot be accepted');
insert into p22_state select 'rejected',workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal2'),1,3,
 (select v->>'authorityRevision' from p22_state where k='context2'),'22444444-4444-4444-8444-444444444445','reject',true,'Rejected after layout changed.');
select is((select v->>'status' from p22_state where k='rejected'),'rejected','native user can clear a stale recommendation without changing layout');
select is((select (v->>'resultingLayoutRevision')::integer from p22_state where k='rejected'),3,'rejection leaves the current layout revision unchanged');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aud":"authenticated"}',true);
select is(jsonb_array_length(workspace.list_workspace_layout_proposals()->'items'),0,'another tenant has an independent proposal history');
select throws_ok($q$select workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),2,0,
 workspace.get_bundle_experience()->>'revision','22555555-5555-4555-8555-555555555551','reject',true,'Foreign decision')$q$,'P0002','Layout proposal unavailable.','another tenant cannot probe or reject the owner proposal');
reset role;

update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now() where client_id='22cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p22_oauth'),true);
select throws_ok($q$select workspace.layout_proposal_context()$q$,'42501',null::text,'revoked OAuth grant closes proposal context immediately');
select throws_ok($q$select workspace.propose_workspace_layout(3,'stale','22666666-6666-4666-8666-666666666661','Blocked','Blocked','user_stated','Blocked after revocation.',
 '[{"kind":"set_order","itemId":"writer_editor:writer.nav.writing","order":1,"reason":"The user stated this should move.","basis":["user_stated_priority"]}]')$q$,'42501',null::text,'revoked OAuth grant cannot create or replay proposals');
reset role;

update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P22 revocation' where source_reference='p22-owner-experience';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.list_workspace_layout_proposals()$q$,'42501',null::text,'Workspace Experience revocation closes native proposal history');
select throws_ok($q$select workspace.decide_workspace_layout_proposal((select (v->>'proposalId')::uuid from p22_state where k='proposal1'),2,3,'revoked',
 '22666666-6666-4666-8666-666666666662','reject',true,'Blocked')$q$,'42501',null::text,'revocation closes proposal decision receipts as authority');
reset role;

select * from finish();
rollback;
