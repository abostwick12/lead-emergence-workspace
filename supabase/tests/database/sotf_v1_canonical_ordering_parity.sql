begin;
select no_plan();

-- This JSON is the permanent cross-runtime oracle. The TypeScript projection
-- tests and local MCP/PostgREST differential runner parse the same corpus.
select set_config('request.sotf_ordering_corpus',$ordering$[
  {"id":"O01","description":"reproduced punctuation disagreement","ids":["0","1","a-b","a_b"],"expected":["0","1","a-b","a_b"]},
  {"id":"O02","description":"numeric-looking identifiers","ids":["10","2","01","1"],"expected":["01","1","10","2"]},
  {"id":"O03","description":"ASCII case ordering","ids":["a","A","z","Z"],"expected":["A","Z","a","z"]},
  {"id":"O04","description":"mixed-case common prefix","ids":["aa","aA","Aa","AA"],"expected":["AA","Aa","aA","aa"]},
  {"id":"O05","description":"prefix-length ordering","ids":["a","aa","aaa","ab"],"expected":["a","aa","aaa","ab"]},
  {"id":"O06","description":"dash underscore dot slash","ids":["a-b","a_b","a.b","a/b"],"expected":["a-b","a.b","a/b","a_b"]},
  {"id":"O07","description":"spaces and punctuation","ids":["a:b","a b","a+b","a#b","a@b"],"expected":["a b","a#b","a+b","a:b","a@b"]},
  {"id":"O08","description":"CJK and ASCII","ids":["界","中","国","a"],"expected":["a","中","国","界"]},
  {"id":"O09","description":"composed Latin accents","ids":["é","è","ê","e"],"expected":["e","è","é","ê"]},
  {"id":"O10","description":"composed and decomposed accents","ids":["é","é","å","å"],"expected":["å","é","å","é"]},
  {"id":"O11","description":"supplementary-plane characters","ids":["🙂","🫠","🩷","𐐀"],"expected":["𐐀","🙂","🩷","🫠"]},
  {"id":"O12","description":"zero-width-joiner emoji sequences","ids":["👩‍👩‍👦","👩","👩‍👦","🙂"],"expected":["👩","👩‍👦","👩‍👩‍👦","🙂"]},
  {"id":"O13","description":"variation-selector sequences","ids":["❤","❤️","♥","♥️"],"expected":["♥","♥️","❤","❤️"]},
  {"id":"O14","description":"mixed ASCII CJK and emoji suffixes","ids":["a🙂","a界","a","A🙂"],"expected":["A🙂","a","a界","a🙂"]},
  {"id":"O15","description":"below projection limit","ids":["b","a"],"expected":["a","b"]},
  {"id":"O16","description":"exactly at projection limit","ids":["c","a","b"],"expected":["a","b","c"]},
  {"id":"O17","description":"well above projection limit","ids":["z","y","x","w","v","u","t","s"],"expected":["s","t","u","v","w","x","y","z"]},
  {"id":"O18","description":"reversed reproduced identifiers","ids":["a_b","a-b","1","0"],"expected":["0","1","a-b","a_b"]},
  {"id":"O19","description":"interleaved ASCII cases","ids":["b","A","a","B"],"expected":["A","B","a","b"]},
  {"id":"O20","description":"ASCII symbol ordering one","ids":["a@","a#","a&","a%"],"expected":["a#","a%","a&","a@"]},
  {"id":"O21","description":"ASCII symbol ordering two","ids":["a/","a.","a-","a:"],"expected":["a-","a.","a/","a:"]},
  {"id":"O22","description":"prefixes with digits","ids":["a","a0","a00","a01"],"expected":["a","a0","a00","a01"]},
  {"id":"O23","description":"Greek Cyrillic and ASCII","ids":["Ω","ω","Ж","ж","A"],"expected":["A","Ω","ω","Ж","ж"]},
  {"id":"O24","description":"BMP and supplementary CJK","ids":["𠀀","一","丁","a"],"expected":["a","一","丁","𠀀"]},
  {"id":"O25","description":"decomposition with punctuation","ids":["é","é","e-","E"],"expected":["E","e-","é","é"]},
  {"id":"O26","description":"leading-zero numeric strings","ids":["0","00","000","01"],"expected":["0","00","000","01"]},
  {"id":"O27","description":"symbol common prefix","ids":["a+b","a#b","a@b","a:b"],"expected":["a#b","a+b","a:b","a@b"]},
  {"id":"O28","description":"uppercase prefix and underscore","ids":["A","AA","Aa","A_"],"expected":["A","AA","A_","Aa"]},
  {"id":"O29","description":"Nordic composed case variants","ids":["Å","å","Ä","ä"],"expected":["Ä","Å","ä","å"]},
  {"id":"O30","description":"emoji prefix sequences","ids":["🙂","🙂a","🙂A","🙂🙂"],"expected":["🙂","🙂A","🙂a","🙂🙂"]},
  {"id":"O31","description":"required broad minimum group","ids":["0","1","01","10","a","A","a-b","a_b","a.b","a/b","a:b","a b","a+b","a#b","a@b"],"expected":["0","01","1","10","A","a","a b","a#b","a+b","a-b","a.b","a/b","a:b","a@b","a_b"]}
]$ordering$,true);

create function pg_temp.sotf_v1_ordered_ids(item jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value)),'[]'::jsonb)
  from jsonb_array_elements_text(item -> 'ids') as source(value);
$$;

create function pg_temp.sotf_v1_reversed_ordered_ids(item jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value)),'[]'::jsonb)
  from (
    select value
    from jsonb_array_elements_text(item -> 'ids') with ordinality as source(value,position)
    order by position desc
  ) as reversed;
$$;

create function pg_temp.sotf_v1_expected_slice(item jsonb, start_at integer, maximum integer)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(value order by position),'[]'::jsonb)
  from (
    select value,position
    from jsonb_array_elements(item -> 'expected') with ordinality as source(value,position)
    where position > start_at
    order by position
    limit maximum
  ) as bounded;
$$;

create function pg_temp.sotf_v1_ordered_ids_under_collation(item jsonb, target_collation text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  execute format(
    'select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value collate %I)),''[]''::jsonb) from jsonb_array_elements_text($1 -> ''ids'') source(value)',
    target_collation
  ) into result using item;
  return result;
end; $$;

select is(pg_temp.sotf_v1_ordered_ids(item),item -> 'expected',
  item ->> 'id' || ': exact canonical full order')
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item;

select is(pg_temp.sotf_v1_reversed_ordered_ids(item),item -> 'expected',
  item ->> 'id' || ': insertion order does not change canonical order')
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item;

select is(pg_temp.sotf_v1_expected_slice(item,0,3),
  (select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value)),'[]'::jsonb)
   from (select value from jsonb_array_elements_text(item -> 'ids') source(value)
         order by workspace_private.sotf_v1_order_key(value) limit 3) bounded),
  item ->> 'id' || ': bounded membership is canonical')
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item;

select is(pg_temp.sotf_v1_expected_slice(item,3,2147483647),
  (select coalesce(jsonb_agg(value order by workspace_private.sotf_v1_order_key(value)),'[]'::jsonb)
   from (select value from jsonb_array_elements_text(item -> 'ids') source(value)
         order by workspace_private.sotf_v1_order_key(value) offset 3) omitted),
  item ->> 'id' || ': omitted identifiers are canonical')
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item;

select is(jsonb_array_length(item -> 'ids') > 3,jsonb_array_length(item -> 'expected') > 3,
  item ->> 'id' || ': truncation classification follows bounded membership')
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item;

-- Explicit C plus available ICU/libc collations prove the byte key does not
-- inherit the ambient text collation. The test remains portable when a named
-- locale is absent by selecting collations actually installed in this cluster.
select is(pg_temp.sotf_v1_ordered_ids_under_collation(item,selected_collation.collname),item -> 'expected',
  item ->> 'id' || ': same result under collation ' || selected_collation.collname)
from jsonb_array_elements(current_setting('request.sotf_ordering_corpus')::jsonb) item
cross join lateral (
  select collname
  from pg_catalog.pg_collation
  where collname = 'C' or collprovider = 'i'
  order by case when collname = 'C' then 0 else 1 end,collname
  limit 3
) as selected_collation;

select is(pg_temp.sotf_v1_ordered_ids(
  jsonb_build_object('ids',jsonb_build_array('é','e' || chr(769)))),
  jsonb_build_array('e' || chr(769),'é'),'canonical ordering performs no normalization');
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_order_key(text)','execute'),
  'canonical order-key helper is not an exposed RPC');
select ok(pg_get_functiondef('workspace_private.sotf_v1_order_key(text)'::regprocedure)
  ilike '%convert_to(value,%UTF8%',
  'canonical order key explicitly encodes UTF-8');
select ok(position('collate' in lower(
  pg_get_functiondef('workspace_private.sotf_v1_order_key(text)'::regprocedure))) = 0,
  'canonical order key contains no collation dependency');

-- Reproduce the exact membership dispute at the authenticated write boundary.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','78111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.ordering.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('78111111-1111-4111-8111-111111111111','Synthetic SOTF ordering parity');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF ordering parity','78111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','78111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','78111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','78111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-ordering-parity');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','78cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'78111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '78111111-1111-4111-8111-111111111111','78cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';

create function pg_temp.ordering_snapshot() returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object(
  'outcomes',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from workspace_private.sotf_daily_brief_outcomes r),
  'events',(select coalesce(jsonb_agg(to_jsonb(r) order by workspace_id,revision),'[]'::jsonb) from workspace_private.sotf_operation_events r),
  'heads',(select coalesce(jsonb_agg(to_jsonb(r) order by workspace_id),'[]'::jsonb) from workspace_private.sotf_operation_heads r),
  'audits',(select count(*) from workspace_private.sotf_workflow_access_audit),
  'entitlements',(select count(*) from workspace.bundle_entitlements),
  'authorizations',(select count(*) from workspace.mcp_authorizations),
  'resource_grants',(select count(*) from workspace_private.mcp_oauth_resource_grants));
$$;

create function pg_temp.ordering_semantics() returns jsonb language sql security definer set search_path='' as $$
 select workspace_private.sotf_v1_daily_brief_projection_semantics(
 '78aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(clock_timestamp() at time zone 'America/Chicago')::date,'America/Chicago');
$$;

select set_config('request.sotf_ordering_claims',jsonb_build_object(
  'sub','78111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','78cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true',
  'iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_ordering_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','78000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','start_transition','timing','Synthetic','question','Which direction?','weeklyHours',8,'criteria','[]'::jsonb,'hypotheses','[]'::jsonb)
))->>'revision','1','ordering fixture starts one ordinary transition');

select is(workspace.sotf_append_operation('{"requestId":"78000000-0000-4000-8000-000000000002","expectedRevision":1,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"0","proposition":"Synthetic 0","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Still provisional"}}}'::jsonb)->>'revision','2','ordering fixture saves hypothesis 0');
select is(workspace.sotf_append_operation('{"requestId":"78000000-0000-4000-8000-000000000003","expectedRevision":2,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"1","proposition":"Synthetic 1","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Still provisional"}}}'::jsonb)->>'revision','3','ordering fixture saves hypothesis 1');
select is(workspace.sotf_append_operation('{"requestId":"78000000-0000-4000-8000-000000000004","expectedRevision":3,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"a-b","proposition":"Synthetic a-b","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Still provisional"}}}'::jsonb)->>'revision','4','ordering fixture saves hypothesis a-b');
select is(workspace.sotf_append_operation('{"requestId":"78000000-0000-4000-8000-000000000005","expectedRevision":4,"userConfirmed":true,"dataClass":"ordinary_transition_operations","command":{"type":"save_hypothesis","hypothesis":{"id":"a_b","proposition":"Synthetic a_b","whyPromising":"It is testable","assumptions":[],"gaps":[],"nextExperiment":"Run a synthetic test","reviewTrigger":"After the test","status":"continue","confidenceExplanation":"Still provisional"}}}'::jsonb)->>'revision','5','ordering fixture saves hypothesis a_b');

select is(pg_temp.ordering_semantics() -> 'eligible_refs' -> 0 ->> 'entity_id','0',
  'reproduced projection begins with 0');
select is(pg_temp.ordering_semantics() -> 'eligible_refs' -> 1 ->> 'entity_id','1',
  'reproduced projection continues with 1');
select is(pg_temp.ordering_semantics() -> 'eligible_refs' -> 2 ->> 'entity_id','a-b',
  'reproduced projection canonically includes a-b');
select ok(pg_temp.ordering_semantics() -> 'truncated_sections' ? 'hypotheses',
  'reproduced projection reports bounded hypothesis truncation');
select is(pg_temp.ordering_semantics() -> 'eligible_refs',
  '[{"entity_type":"hypothesis","entity_id":"0"},{"entity_type":"hypothesis","entity_id":"1"},{"entity_type":"hypothesis","entity_id":"a-b"}]'::jsonb,
  'governed eligible references exactly match projected membership');

select set_config('request.sotf_ordering_outcome',jsonb_build_object(
  'schema_version','1','request_id','78000000-0000-4000-8000-000000000011',
  'run_id','78000000-0000-4000-8000-000000000012',
  'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',5,
  'brief_date',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
  'time_zone','America/Chicago','host','chatgpt','execution_mode','A',
  'data_class','ordinary_transition_operations','user_confirmed',true,'status','degraded',
  'connector_results',jsonb_build_object('calendar_read','not_requested','email_read','not_requested'),
  'degradation_reasons',jsonb_build_array('state_truncated'),
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','hypothesis','entity_id','a_b')),
  'priority_count',1,'usefulness','not_rated',
  'provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);

select set_config('request.sotf_ordering_before',pg_temp.ordering_snapshot()::text,true);
select throws_ok(format('select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb)',current_setting('request.sotf_ordering_outcome')),
  '22023','sotf_v1:invalid_input','reproduced a_b direct-RPC bypass is denied');
select is(pg_temp.ordering_snapshot(),current_setting('request.sotf_ordering_before')::jsonb,
  'denied out-of-projection reference changes no durable surface');
select set_config('request.sotf_ordering_outcome',jsonb_set(
  current_setting('request.sotf_ordering_outcome')::jsonb,'{selected_le_refs,0,entity_id}','"a-b"'::jsonb
)::text,true);
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_ordering_outcome')::jsonb)->>'replayed','false',
  'canonically projected a-b reference persists once');
select set_config('request.sotf_ordering_saved',pg_temp.ordering_snapshot()::text,true);
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_ordering_outcome')::jsonb)->>'replayed','true',
  'exact retry of valid canonical reference is idempotent');
select is(pg_temp.ordering_snapshot(),current_setting('request.sotf_ordering_saved')::jsonb,
  'exact valid retry changes no durable surface');

select * from finish();
rollback;
