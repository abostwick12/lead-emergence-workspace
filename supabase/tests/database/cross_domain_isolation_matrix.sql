begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();

-- Independent hostile fixtures: one all-bundle owner, one all-bundle control
-- owner, and one uniquely searchable private marker per domain. The oracle below
-- does not use application adapters or their identifier-routing assumptions.
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('18111111-1111-4111-8111-111111111111','authenticated','authenticated','p18.owner@example.invalid','{}','{}'),
('18222222-2222-4222-8222-222222222222','authenticated','authenticated','p18.other@example.invalid','{}','{}');
insert into workspace.user_profiles(user_id,display_name) values
('18111111-1111-4111-8111-111111111111','Fictional P18 owner'),
('18222222-2222-4222-8222-222222222222','Fictional P18 other');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Fictional P18 matrix','18111111-1111-4111-8111-111111111111'),
('18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','personal','Fictional P18 control','18222222-2222-4222-8222-222222222222');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','18111111-1111-4111-8111-111111111111','owner','active'),
('18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','18222222-2222-4222-8222-222222222222','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','18111111-1111-4111-8111-111111111111','personal'),
('18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','18222222-2222-4222-8222-222222222222','personal');
update workspace.plan_capabilities set enabled=true where plan_key='personal' and capability_key='core_workspace';
insert into workspace.bundle_entitlements(workspace_id,beneficiary_user_id,bundle_key,source,source_reference)
select w,u,b,'operator_assignment','p18-'||right(w::text,4)||'-'||b from (values
 ('18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'18111111-1111-4111-8111-111111111111'::uuid),
 ('18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,'18222222-2222-4222-8222-222222222222'::uuid)) owner(w,u)
cross join unnest(array['writer_editor','ministry','nonprofit_founder','investor','executive','workspace_experience']) b;

insert into workspace_private.writing_resources(id,workspace_id,title,source_label,body_text,publication_state) values
('18000000-0000-4000-8000-000000000001','18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','P18 Writer record','Fictional P18','P18WritingPrivateNeedle','in_review'),
('18000000-0000-4000-8000-000000000101','18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','P18 Other writer','Fictional P18','P18OtherWritingPrivateNeedle','in_review');
insert into workspace_private.ministry_documents(id,workspace_id,kind,revision,data,origin) values
('18000000-0000-4000-8000-000000000002','18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','research',1,
 '{"title":"P18 Ministry record","status":"draft","dueDate":null,"question":"P18MinistryPrivateNeedle"}','user'),
('18000000-0000-4000-8000-000000000102','18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','research',1,
 '{"title":"P18 Other ministry","status":"draft","dueDate":null,"question":"P18OtherMinistryPrivateNeedle"}','user');
insert into workspace_private.nonprofit_documents(id,workspace_id,kind,revision,data,origin) values
('18000000-0000-4000-8000-000000000003','18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','plan',1,
 '{"title":"P18 Nonprofit record","status":"active","targetDate":null,"mission":"P18NonprofitPrivateNeedle","milestones":[{"id":"18333333-3333-4333-8333-333333333333","title":"P18 nonprofit milestone","owner":"Participant","dueDate":null,"status":"planned","nextAction":"Review the fictional milestone","evidence":"Fictional P18","priority":"high","category":"launch","dependsOn":[]}]}','user'),
('18000000-0000-4000-8000-000000000103','18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','plan',1,
 '{"title":"P18 Other nonprofit","status":"active","targetDate":null,"mission":"P18OtherNonprofitPrivateNeedle","milestones":[]}','user');
insert into workspace_private.investor_documents(id,workspace_id,kind,revision,data,origin) values
('18000000-0000-4000-8000-000000000004','18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','thesis',1,
 '{"title":"P18 Investor record","status":"active","reviewDate":null,"purpose":"P18InvestorPrivateNeedle","catalysts":[{"id":"18444444-4444-4444-8444-444444444444","title":"P18 investor catalyst","status":"open","eventDate":null,"nextCheck":"Review the fictional catalyst","dateState":"estimated"}]}','user'),
('18000000-0000-4000-8000-000000000104','18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','thesis',1,
 '{"title":"P18 Other investor","status":"active","reviewDate":null,"purpose":"P18OtherInvestorPrivateNeedle","catalysts":[]}','user');
insert into workspace_private.executive_documents(id,workspace_id,kind,revision,data,origin) values
('18000000-0000-4000-8000-000000000005','18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','commitment',1,
 '{"title":"P18 Executive record","state":"open","reviewState":"confirmed","reviewDate":null,"dueDate":null,"followupDate":null,"outcome":"P18ExecutivePrivateNeedle","priority":"normal"}','user'),
('18000000-0000-4000-8000-000000000105','18bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','commitment',1,
 '{"title":"P18 Other executive","state":"open","reviewState":"confirmed","reviewDate":null,"dueDate":null,"followupDate":null,"outcome":"P18OtherExecutivePrivateNeedle","priority":"normal"}','user');

create temp table p18_records(domain text primary key,record_id uuid,foreign_id uuid,kind text,marker text,error_message text);
insert into p18_records values
('writing','18000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000101','resource','P18WritingPrivateNeedle','Resource unavailable.'),
('ministry','18000000-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000102','research','P18MinistryPrivateNeedle','Ministry record unavailable.'),
('nonprofit','18000000-0000-4000-8000-000000000003','18000000-0000-4000-8000-000000000103','plan','P18NonprofitPrivateNeedle','Founder record unavailable.'),
('investing','18000000-0000-4000-8000-000000000004','18000000-0000-4000-8000-000000000104','thesis','P18InvestorPrivateNeedle','Investor record unavailable.'),
('executive','18000000-0000-4000-8000-000000000005','18000000-0000-4000-8000-000000000105','commitment','P18ExecutivePrivateNeedle','Executive record unavailable.');
grant select on p18_records to authenticated;

-- Direct table access is denied independently of function behavior.
select is(has_table_privilege(role_name,'workspace_private.'||table_name,operation),false,
 format('%s cannot %s private %s records directly',role_name,lower(operation),domain_name))
from unnest(array['anon','authenticated']) role_name
cross join (values('writing','writing_resources'),('ministry','ministry_documents'),('nonprofit','nonprofit_documents'),
 ('investing','investor_documents'),('executive','executive_documents')) tables(domain_name,table_name)
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) operation;
select ok(c.relrowsecurity,format('%s canonical records retain RLS',x.domain_name))
from (values('writing','writing_resources'),('ministry','ministry_documents'),('nonprofit','nonprofit_documents'),
 ('investing','investor_documents'),('executive','executive_documents')) x(domain_name,table_name)
join pg_class c on c.oid=('workspace_private.'||x.table_name)::regclass;
select is(has_function_privilege('anon',signature,'execute'),false,format('anonymous cannot invoke the %s reader',domain_name))
from (values('writing','workspace.writer_get_resource(uuid)'),('ministry','workspace.ministry_get_document(text,uuid)'),
 ('nonprofit','workspace.nonprofit_get_document(text,uuid)'),('investing','workspace.investor_get_document(text,uuid)'),
 ('executive','workspace.executive_get_document(text,uuid)')) x(domain_name,signature);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"18111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);

-- Positive controls prove each reader can retrieve its own record.
select is(workspace.writer_get_resource('18000000-0000-4000-8000-000000000001')->'resource'->>'title','P18 Writer record','writing reader retrieves writing record');
select is(workspace.ministry_get_document('research','18000000-0000-4000-8000-000000000002')->'document'->'data'->>'title','P18 Ministry record','ministry reader retrieves ministry record');
select is(workspace.nonprofit_get_document('plan','18000000-0000-4000-8000-000000000003')->'document'->'data'->>'title','P18 Nonprofit record','nonprofit reader retrieves nonprofit record');
select is(workspace.investor_get_document('thesis','18000000-0000-4000-8000-000000000004')->'document'->'data'->>'title','P18 Investor record','investing reader retrieves investing record');
select is(workspace.executive_get_document('commitment','18000000-0000-4000-8000-000000000005')->'document'->'data'->>'title','P18 Executive record','executive reader retrieves executive record');

-- Every ordered pair: an identifier from domain B is indistinguishable from a
-- missing identifier when supplied to domain A's canonical reader.
select throws_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_resource(%L::uuid)',target.record_id)
 when 'ministry' then format('select workspace.ministry_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 when 'investing' then format('select workspace.investor_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 else format('select workspace.executive_get_document(%L,%L::uuid)',reader.kind,target.record_id) end,
 'P0002',reader.error_message,format('%s reader denies %s identifier',reader.domain,target.domain))
from p18_records reader cross join p18_records target where reader.domain<>target.domain;

-- Same-domain, other-owner identifiers fail through the identical path.
select throws_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_resource(%L::uuid)',reader.foreign_id)
 when 'ministry' then format('select workspace.ministry_get_document(%L,%L::uuid)',reader.kind,reader.foreign_id)
 when 'nonprofit' then format('select workspace.nonprofit_get_document(%L,%L::uuid)',reader.kind,reader.foreign_id)
 when 'investing' then format('select workspace.investor_get_document(%L,%L::uuid)',reader.kind,reader.foreign_id)
 else format('select workspace.executive_get_document(%L,%L::uuid)',reader.kind,reader.foreign_id) end,
 'P0002',reader.error_message,format('%s reader denies another owner identifier',reader.domain))
from p18_records reader;

-- History endpoints repeat the complete ordered-pair denial matrix.
select throws_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_revision_history(%L::uuid)',target.record_id)
 when 'ministry' then format('select workspace.ministry_document_history(%L,%L::uuid)',reader.kind,target.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_document_history(%L,%L::uuid)',reader.kind,target.record_id)
 when 'investing' then format('select workspace.investor_document_history(%L,%L::uuid)',reader.kind,target.record_id)
 else format('select workspace.executive_document_history(%L,%L::uuid)',reader.kind,target.record_id) end,
 'P0002',reader.error_message,format('%s history denies %s identifier',reader.domain,target.domain))
from p18_records reader cross join p18_records target where reader.domain<>target.domain;
select lives_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_revision_history(%L::uuid)',reader.record_id)
 when 'ministry' then format('select workspace.ministry_document_history(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_document_history(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'investing' then format('select workspace.investor_document_history(%L,%L::uuid)',reader.kind,reader.record_id)
 else format('select workspace.executive_document_history(%L,%L::uuid)',reader.kind,reader.record_id) end,
 format('%s history accepts its own identifier',reader.domain)) from p18_records reader;

-- Full-text search proves a reader can find its own private marker and cannot
-- find any of the other four, even for one owner entitled to every bundle.
select results_eq(case reader.domain
 when 'writing' then format('select (workspace.writer_list_resources(%L,null,0,25)->>''matchingCount'')::int',target.marker)
 when 'ministry' then format('select (workspace.ministry_search_documents(%L,%L,null,0,25)->>''total'')::int',reader.kind,target.marker)
 when 'nonprofit' then format('select (workspace.nonprofit_search_documents(%L,%L,0,25)->>''total'')::int',reader.kind,target.marker)
 when 'investing' then format('select (workspace.investor_search_documents(%L,%L,0,25)->>''total'')::int',reader.kind,target.marker)
 else format('select (workspace.executive_search_documents(%L,%L,0,25)->>''total'')::int',reader.kind,target.marker) end,
 array[case when reader.domain=target.domain then 1 else 0 end]::int[],
 format('%s search returns only the expected %s marker result',reader.domain,target.domain))
from p18_records reader cross join p18_records target;

-- Executive starts with no cross-domain authority. Exact record references are
-- visible only after explicit native confirmation and only through the fixed
-- metadata projection.
create temp table p18_cache(k text primary key,v jsonb); grant all on p18_cache to authenticated;
insert into p18_cache values('references','[
 {"capabilityId":"writer.resource.library","kind":"resource","documentId":"18000000-0000-4000-8000-000000000001","revision":1},
 {"capabilityId":"ministry.research","kind":"research","documentId":"18000000-0000-4000-8000-000000000002","revision":1},
 {"capabilityId":"nonprofit.roadmap","kind":"plan","documentId":"18000000-0000-4000-8000-000000000003","revision":1},
 {"capabilityId":"investor.thesis","kind":"thesis","documentId":"18000000-0000-4000-8000-000000000004","revision":1}
]');
insert into p18_cache values('before_grant',workspace.executive_resolve_references((select v from p18_cache where k='references')));
select is((select count(*)::int from p18_cache,jsonb_array_elements(v->'references') x where k='before_grant' and x->>'state'='unavailable'),4,'Executive starts with all four cross-domain references unavailable');
insert into p18_cache values('permission',workspace.executive_set_source_permissions_v2(
 '["writer.resource.library","ministry.research","nonprofit.roadmap","investor.thesis"]',
 '["nonprofit.roadmap","investor.thesis"]',0,'18555555-5555-4555-8555-555555555555',true,true,'task-metadata-v1'));
select is(jsonb_array_length(v->'sourceCapabilities'),4,'four explicit record metadata grants are retained') from p18_cache where k='permission';
select is(jsonb_array_length(v->'taskCapabilities'),2,'only two explicit expanded task metadata grants are retained') from p18_cache where k='permission';
insert into p18_cache values('after_grant',workspace.executive_resolve_references((select v from p18_cache where k='references')));
select is((select count(*)::int from p18_cache,jsonb_array_elements(v->'references') x where k='after_grant' and x->>'state'='current'),4,'confirmed Executive grant resolves four exact record metadata references');
select ok((select v::text from p18_cache where k='after_grant') not like '%P18WritingPrivateNeedle%'
 and (select v::text from p18_cache where k='after_grant') not like '%P18MinistryPrivateNeedle%'
 and (select v::text from p18_cache where k='after_grant') not like '%P18NonprofitPrivateNeedle%'
 and (select v::text from p18_cache where k='after_grant') not like '%P18InvestorPrivateNeedle%',
 'Executive record metadata omits every private source-domain marker');
select is((workspace.executive_find_sources('writer.resource.library','record','P18 Writer',null,20)->>'total')::int,1,'Executive finds permitted Writing record metadata');
select is((workspace.executive_find_sources('ministry.research','record','P18 Ministry',null,20)->>'total')::int,1,'Executive finds permitted Ministry record metadata');
select is((workspace.executive_find_sources('nonprofit.roadmap','record','P18 Nonprofit',null,20)->>'total')::int,1,'Executive finds permitted Nonprofit record metadata');
select is((workspace.executive_find_sources('investor.thesis','record','P18 Investor',null,20)->>'total')::int,1,'Executive finds permitted Investor record metadata');
select is((workspace.executive_find_sources('nonprofit.roadmap','task','P18 nonprofit milestone',null,20)->>'total')::int,1,'Executive finds explicitly permitted Nonprofit task metadata');
select is((workspace.executive_find_sources('investor.thesis','task','P18 investor catalyst',null,20)->>'total')::int,1,'Executive finds explicitly permitted Investor task metadata');
select throws_ok($q$select workspace.executive_find_sources('writer.resource.library','task','',null,20)$q$,'22023',null::text,'Writer has no fabricated expanded task contract');
select throws_ok($q$select workspace.executive_find_sources('ministry.research','task','',null,20)$q$,'22023',null::text,'Ministry has no fabricated expanded task contract');
reset role;

-- A real OAuth-shaped direct database session repeats every ordered cross-domain
-- canonical read denial. Native-only aggregate surfaces remain unavailable.
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','18cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'18111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values
('18111111-1111-4111-8111-111111111111','18cccccc-cccc-4ccc-8ccc-cccccccccccc','https://workspace.leademergence.com/api/mcp',array['openid','email','profile']);
select set_config('request.p18_oauth',jsonb_build_object('sub','18111111-1111-4111-8111-111111111111','role','authenticated',
 'aud','https://workspace.leademergence.com/api/mcp','client_id','18cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp',true,
 'iat',floor(extract(epoch from clock_timestamp())))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p18_oauth'),true);
select lives_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_resource(%L::uuid)',reader.record_id)
 when 'ministry' then format('select workspace.ministry_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'investing' then format('select workspace.investor_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 else format('select workspace.executive_get_document(%L,%L::uuid)',reader.kind,reader.record_id) end,
 format('authorized OAuth can read its own %s source',reader.domain)) from p18_records reader;
select throws_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_resource(%L::uuid)',target.record_id)
 when 'ministry' then format('select workspace.ministry_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 when 'investing' then format('select workspace.investor_get_document(%L,%L::uuid)',reader.kind,target.record_id)
 else format('select workspace.executive_get_document(%L,%L::uuid)',reader.kind,target.record_id) end,
 'P0002',reader.error_message,format('OAuth %s reader denies %s identifier',reader.domain,target.domain))
from p18_records reader cross join p18_records target where reader.domain<>target.domain;
insert into p18_cache values('oauth_references',workspace.executive_resolve_references((select v from p18_cache where k='references')));
select is((select count(*)::int from p18_cache,jsonb_array_elements(v->'references') x where k='oauth_references' and x->>'state'='current'),4,'OAuth sees the same explicitly shared record metadata references');
select ok((select v::text from p18_cache where k='oauth_references') not like '%PrivateNeedle%',
 'OAuth Executive metadata contains none of the private-domain marker pattern');
select throws_ok($q$select workspace.search_saved_work('P18',array['writing.resources'],workspace.get_bundle_experience()->>'revision',0)$q$,'42501',null::text,'OAuth cannot invoke native cross-domain saved-work search');
select throws_ok($q$select workspace.native_attention(current_date,workspace.get_bundle_experience()->>'revision')$q$,'42501',null::text,'OAuth cannot invoke native cross-domain attention');
reset role;

-- Revoking the OAuth grant fails every domain closed, even though the user still
-- owns all bundle entitlements and the source permissions remain saved.
update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now() where client_id='18cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.p18_oauth'),true);
select throws_ok(case reader.domain
 when 'writing' then format('select workspace.writer_get_resource(%L::uuid)',reader.record_id)
 when 'ministry' then format('select workspace.ministry_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'nonprofit' then format('select workspace.nonprofit_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 when 'investing' then format('select workspace.investor_get_document(%L,%L::uuid)',reader.kind,reader.record_id)
 else format('select workspace.executive_get_document(%L,%L::uuid)',reader.kind,reader.record_id) end,
 '42501',null::text,format('revoked OAuth cannot read %s source',reader.domain)) from p18_records reader;
reset role;

-- Source entitlement loss makes saved Executive references unavailable again;
-- the grant never outranks the source bundle's current authority.
update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P18 source revocation'
where workspace_id='18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key in ('writer_editor','ministry','nonprofit_founder','investor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"18111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
insert into p18_cache values('after_revocation',workspace.executive_resolve_references((select v from p18_cache where k='references')));
select is((select count(*)::int from p18_cache,jsonb_array_elements(v->'references') x where k='after_revocation' and x->>'state'='unavailable'),4,'revoking source bundles invalidates all four Executive references');
select ok((select v::text from p18_cache where k='after_revocation') not like '%PrivateNeedle%','unavailable Executive references disclose no private marker');
reset role;

-- Each domain's own canonical reader also fails immediately after its entitlement
-- is revoked. Executive is checked separately because it was not in the source set.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"18111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.writer_get_resource('18000000-0000-4000-8000-000000000001')$q$,'42501',null::text,'revoked Writer entitlement denies its own record');
select throws_ok($q$select workspace.ministry_get_document('research','18000000-0000-4000-8000-000000000002')$q$,'42501',null::text,'revoked Ministry entitlement denies its own record');
select throws_ok($q$select workspace.nonprofit_get_document('plan','18000000-0000-4000-8000-000000000003')$q$,'42501',null::text,'revoked Nonprofit entitlement denies its own record');
select throws_ok($q$select workspace.investor_get_document('thesis','18000000-0000-4000-8000-000000000004')$q$,'42501',null::text,'revoked Investor entitlement denies its own record');
reset role;
update workspace.bundle_entitlements set revoked_at=null,revocation_reason=null where workspace_id='18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 and bundle_key in ('writer_editor','ministry','nonprofit_founder','investor');
update workspace.bundle_entitlements set revoked_at=now(),revocation_reason='Fictional P18 Executive revocation'
 where workspace_id='18aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and bundle_key='executive';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"18111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}',true);
select throws_ok($q$select workspace.executive_get_document('commitment','18000000-0000-4000-8000-000000000005')$q$,'42501',null::text,'revoked Executive entitlement denies its own record');
reset role;

select * from finish();
rollback;
