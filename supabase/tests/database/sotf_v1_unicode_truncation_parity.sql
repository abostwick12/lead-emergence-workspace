begin;
select no_plan();

-- Single permanent corpus: unit tests and the local real-MCP/PostgREST runner
-- parse this same JSON, including the text, independent expected widths and prefix.
select set_config('request.sotf_unicode_corpus',$unicode$[
  {
    "id": "U01",
    "description": "empty",
    "segments": [
      {
        "text": "",
        "repeat": 1
      }
    ],
    "units": 0,
    "prefixUnits": 0,
    "truncated": false
  },
  {
    "id": "U02",
    "description": "ASCII below",
    "segments": [
      {
        "text": "a",
        "repeat": 499
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U03",
    "description": "ASCII exact",
    "segments": [
      {
        "text": "a",
        "repeat": 500
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U04",
    "description": "ASCII above",
    "segments": [
      {
        "text": "a",
        "repeat": 501
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U05",
    "description": "ASCII large",
    "segments": [
      {
        "text": "a",
        "repeat": 1500
      }
    ],
    "units": 1500,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U06",
    "description": "Latin-1 below",
    "segments": [
      {
        "text": "ñ",
        "repeat": 499
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U07",
    "description": "composed exact",
    "segments": [
      {
        "text": "é",
        "repeat": 500
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U08",
    "description": "composed above",
    "segments": [
      {
        "text": "é",
        "repeat": 501
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U09",
    "description": "decomposed below",
    "segments": [
      {
        "text": "é",
        "repeat": 249
      },
      {
        "text": "e",
        "repeat": 1
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U10",
    "description": "decomposed exact",
    "segments": [
      {
        "text": "é",
        "repeat": 250
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U11",
    "description": "decomposed above",
    "segments": [
      {
        "text": "é",
        "repeat": 250
      },
      {
        "text": "e",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U12",
    "description": "CJK exact",
    "segments": [
      {
        "text": "界",
        "repeat": 500
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U13",
    "description": "CJK above",
    "segments": [
      {
        "text": "界",
        "repeat": 501
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U14",
    "description": "supplementary below",
    "segments": [
      {
        "text": "𐐀",
        "repeat": 249
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U15",
    "description": "supplementary exact",
    "segments": [
      {
        "text": "𐐀",
        "repeat": 250
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U16",
    "description": "supplementary above",
    "segments": [
      {
        "text": "𐐀",
        "repeat": 250
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U17",
    "description": "emoji reproduced bypass",
    "segments": [
      {
        "text": "🙂",
        "repeat": 300
      }
    ],
    "units": 600,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U18",
    "description": "emoji exact",
    "segments": [
      {
        "text": "🙂",
        "repeat": 250
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U19",
    "description": "mixed ASCII surrogate crossing",
    "segments": [
      {
        "text": "a",
        "repeat": 499
      },
      {
        "text": "🙂",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 499,
    "truncated": true
  },
  {
    "id": "U20",
    "description": "mixed BMP surrogate crossing",
    "segments": [
      {
        "text": "é",
        "repeat": 499
      },
      {
        "text": "🙂",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 499,
    "truncated": true
  },
  {
    "id": "U21",
    "description": "variation selector below",
    "segments": [
      {
        "text": "🙂️",
        "repeat": 166
      },
      {
        "text": "x",
        "repeat": 1
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U22",
    "description": "variation selector exact",
    "segments": [
      {
        "text": "🙂️",
        "repeat": 166
      },
      {
        "text": "xy",
        "repeat": 1
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U23",
    "description": "variation selector above",
    "segments": [
      {
        "text": "🙂️",
        "repeat": 167
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U24",
    "description": "ZWJ below",
    "segments": [
      {
        "text": "👩‍💻",
        "repeat": 99
      },
      {
        "text": "abcd",
        "repeat": 1
      }
    ],
    "units": 499,
    "prefixUnits": 499,
    "truncated": false
  },
  {
    "id": "U25",
    "description": "ZWJ exact",
    "segments": [
      {
        "text": "👩‍💻",
        "repeat": 100
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U26",
    "description": "ZWJ above",
    "segments": [
      {
        "text": "👩‍💻",
        "repeat": 100
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U27",
    "description": "ZWJ split safe scalar",
    "segments": [
      {
        "text": "x",
        "repeat": 498
      },
      {
        "text": "👩‍💻",
        "repeat": 1
      }
    ],
    "units": 503,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U28",
    "description": "newline crossing",
    "segments": [
      {
        "text": "a",
        "repeat": 498
      },
      {
        "text": "\n\n",
        "repeat": 1
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U29",
    "description": "CRLF crossing",
    "segments": [
      {
        "text": "a",
        "repeat": 498
      },
      {
        "text": "\r\n",
        "repeat": 1
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U30",
    "description": "quote escape exact",
    "segments": [
      {
        "text": "\"",
        "repeat": 500
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U31",
    "description": "backslash escape above",
    "segments": [
      {
        "text": "\\",
        "repeat": 501
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U32",
    "description": "tab boundary",
    "segments": [
      {
        "text": "a",
        "repeat": 498
      },
      {
        "text": "\t\t",
        "repeat": 1
      },
      {
        "text": "a",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U33",
    "description": "mixed international",
    "segments": [
      {
        "text": "東京é🙂",
        "repeat": 100
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U34",
    "description": "mixed international above",
    "segments": [
      {
        "text": "東京é🙂",
        "repeat": 100
      },
      {
        "text": "界",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U35",
    "description": "literal backslash-u text",
    "segments": [
      {
        "text": "\\uD83D\\uDE42",
        "repeat": 42
      }
    ],
    "units": 504,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U36",
    "description": "transport escaped emoji",
    "segments": [
      {
        "text": "🙂",
        "repeat": 250
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U37",
    "description": "transport escaped composed",
    "segments": [
      {
        "text": "é",
        "repeat": 501
      }
    ],
    "units": 501,
    "prefixUnits": 500,
    "truncated": true
  },
  {
    "id": "U38",
    "description": "newline plus surrogate",
    "segments": [
      {
        "text": "a",
        "repeat": 498
      },
      {
        "text": "\n🙂",
        "repeat": 1
      }
    ],
    "units": 501,
    "prefixUnits": 499,
    "truncated": true
  },
  {
    "id": "U39",
    "description": "variation selector text emoji",
    "segments": [
      {
        "text": "✈️",
        "repeat": 250
      }
    ],
    "units": 500,
    "prefixUnits": 500,
    "truncated": false
  },
  {
    "id": "U40",
    "description": "supplementary large",
    "segments": [
      {
        "text": "🙂",
        "repeat": 2000
      }
    ],
    "units": 4000,
    "prefixUnits": 500,
    "truncated": true
  }
]$unicode$,true);

create function pg_temp.unicode_text(item jsonb) returns text language sql immutable as $$
  select string_agg(repeat(segment ->> 'text',(segment ->> 'repeat')::integer),'' order by position)
  from jsonb_array_elements(item -> 'segments') with ordinality as parts(segment,position);
$$;

select is(workspace_private.sotf_v1_text_units(pg_temp.unicode_text(item)),
  (item ->> 'units')::integer,item ->> 'id' || ': canonical UTF-16 units')
from jsonb_array_elements(current_setting('request.sotf_unicode_corpus')::jsonb) item;
select is(workspace_private.sotf_v1_text_units(workspace_private.sotf_v1_text_prefix(pg_temp.unicode_text(item),500)),
  (item ->> 'prefixUnits')::integer,item ->> 'id' || ': longest whole-scalar prefix within 500')
from jsonb_array_elements(current_setting('request.sotf_unicode_corpus')::jsonb) item;
select is(workspace_private.sotf_v1_text_units(pg_temp.unicode_text(item)) > 500,
  (item ->> 'truncated')::boolean,item ->> 'id' || ': truncation classification')
from jsonb_array_elements(current_setting('request.sotf_unicode_corpus')::jsonb) item;
select is(workspace_private.sotf_v1_text_prefix('a' || chr(128578),2),'a','no split supplementary scalar');
select is(workspace_private.sotf_v1_text_prefix('é',0),'','zero budget');
select is(workspace_private.sotf_v1_text_units('e' || chr(769)),2,'no NFC normalization');
select is(workspace_private.sotf_v1_text_units('é'),1,'composed form remains distinct');
select is(('"\uD83D\uDE42"'::jsonb #>> '{}'),chr(128578),'escaped/direct transport decode identically');
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_text_units(text)','execute'),'private measurement is not an exposed RPC');
select ok(not has_function_privilege('authenticated','workspace_private.sotf_v1_text_prefix(text,integer)','execute'),'private prefix is not an exposed RPC');

-- Real authenticated writes additionally prove the reproduced Unicode bypass is
-- closed. Observation helpers are privileged, but the RPC itself runs with
-- SET LOCAL ROLE authenticated, not through a security-definer test wrapper.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','77111111-1111-4111-8111-111111111111','authenticated','authenticated','sotf.semantic.synthetic@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into workspace.user_profiles(user_id,display_name) values
('77111111-1111-4111-8111-111111111111','Synthetic SOTF semantic parity');
insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values
('77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','personal','Synthetic SOTF semantic parity','77111111-1111-4111-8111-111111111111');
insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values
('77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77111111-1111-4111-8111-111111111111','owner','active');
insert into workspace.personal_plans(workspace_id,user_id,plan_key) values
('77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77111111-1111-4111-8111-111111111111','personal');
insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values
('77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sotf_transition','77111111-1111-4111-8111-111111111111','promotion','synthetic-sotf-semantic-parity');
insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values
('77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77cccccc-cccc-4ccc-8ccc-cccccccccccc','chatgpt','connected',now(),'77111111-1111-4111-8111-111111111111');
update workspace_private.product_settings set setting_value='true'
where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');
update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp'
where setting_key='mcp_resource_uri';
insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes)
select '77111111-1111-4111-8111-111111111111','77cccccc-cccc-4ccc-8ccc-cccccccccccc',setting_value,array['openid','email','profile']
from workspace_private.product_settings where setting_key='mcp_resource_uri';


create function pg_temp.unicode_snapshot() returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object(
  'outcomes',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from workspace_private.sotf_daily_brief_outcomes r),
  'events',(select coalesce(jsonb_agg(to_jsonb(r) order by workspace_id,revision),'[]'::jsonb) from workspace_private.sotf_operation_events r),
  'heads',(select coalesce(jsonb_agg(to_jsonb(r) order by workspace_id),'[]'::jsonb) from workspace_private.sotf_operation_heads r),
  'audits',(select count(*) from workspace_private.sotf_workflow_access_audit),
  'entitlements',(select count(*) from workspace.bundle_entitlements),
  'authorizations',(select count(*) from workspace.mcp_authorizations),
  'resource_grants',(select count(*) from workspace_private.mcp_oauth_resource_grants));
$$;
create function pg_temp.unicode_semantics() returns jsonb language sql security definer set search_path='' as $$
 select workspace_private.sotf_v1_daily_brief_projection_semantics(
 '77aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(clock_timestamp() at time zone 'America/Chicago')::date,'America/Chicago');
$$;
select set_config('request.sotf_unicode_claims',jsonb_build_object(
  'sub','77111111-1111-4111-8111-111111111111','role','authenticated',
  'aud','https://workspace.leademergence.com/api/mcp',
  'client_id','77cccccc-cccc-4ccc-8ccc-cccccccccccc','workspace_mcp','true',
  'iat',floor(extract(epoch from clock_timestamp()))
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('request.sotf_unicode_claims'),true);

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','77000000-0000-4000-8000-000000000001','expectedRevision',0,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object(
    'type','start_transition','timing','Fall','question','Which work should I test?',
    'weeklyHours',8,'criteria',jsonb_build_array(jsonb_build_object(
      'id','criterion-old','label','Decision ownership','dimension','actual_work',
      'desired','Own a meaningful decision','nonNegotiable',false,'importance',5,'confirmed',true
    )),'hypotheses','[]'::jsonb
  )
))->>'revision','1','semantic corpus starts one ordinary transition');

select is(workspace.sotf_append_operation(jsonb_build_object(
  'requestId','77000000-0000-4000-8000-000000000002','expectedRevision',1,
  'userConfirmed',true,'dataClass','ordinary_transition_operations',
  'command',jsonb_build_object('type','save_commitment','commitment',jsonb_build_object(
    'id','eligible-now','title','Complete the reviewed follow-up','owner','Fellow',
    'due',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
    'definitionOfDone',repeat(chr(128578),300),'reviewTrigger','Before local noon'
  ))
))->>'revision','2','semantic corpus adds one currently returned commitment');

select set_config('request.sotf_unicode_outcome',jsonb_build_object(
  'schema_version','1','request_id','77000000-0000-4000-8000-000000000011',
  'run_id','77000000-0000-4000-8000-000000000012',
  'workflow_id','transition.daily_brief','workflow_version','1.0.0','expected_state_revision',2,
  'brief_date',to_char(clock_timestamp() at time zone 'America/Chicago','YYYY-MM-DD'),
  'time_zone','America/Chicago','host','chatgpt','execution_mode','A',
  'data_class','ordinary_transition_operations','user_confirmed',true,'status','completed',
  'connector_results',jsonb_build_object('calendar_read','used','email_read','used'),
  'degradation_reasons','[]'::jsonb,
  'selected_le_refs',jsonb_build_array(jsonb_build_object('entity_type','commitment','entity_id','eligible-now')),
  'priority_count',1,'usefulness','not_rated',
  'provenance',jsonb_build_object('source','host_reported_user_confirmed','provider_content_persisted',false)
)::text,true);


select is(current_user::text,'authenticated','Unicode RPC tests use authenticated role');
select is(pg_temp.unicode_semantics()->'truncated_sections','["commitments"]'::jsonb,'300 supplementary scalars derive state_truncated at RPC');
select set_config('request.sotf_unicode_authority_token',workspace.sotf_v1_get_daily_brief_authority(
  'transition.daily_brief','1.0.0',current_setting('request.sotf_unicode_outcome')::jsonb ->> 'brief_date','America/Chicago'
) ->> 'authority_token',true);
select set_config('request.sotf_unicode_before',pg_temp.unicode_snapshot()::text,true);
select throws_ok(format('select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb,%L)',current_setting('request.sotf_unicode_outcome'),current_setting('request.sotf_unicode_authority_token')),
 '22023','sotf_v1:invalid_input','reproduced bypass cannot save an outcome');
select throws_ok(format('select workspace.sotf_v1_probe_daily_brief_outcome(%L::jsonb)',current_setting('request.sotf_unicode_outcome')),
 '22023','sotf_v1:invalid_input','independent probe denies the same Unicode bypass');
select is(pg_temp.unicode_snapshot(),current_setting('request.sotf_unicode_before')::jsonb,
 'denial leaves outcomes, receipts, ordinary events, state revision, audits and authority unchanged');
select set_config('request.sotf_unicode_outcome',(current_setting('request.sotf_unicode_outcome')::jsonb ||
 jsonb_build_object('status','degraded','degradation_reasons',jsonb_build_array('state_truncated')))::text,true);
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_unicode_outcome')::jsonb,current_setting('request.sotf_unicode_authority_token'))->>'replayed','false',
 'valid supplementary state persists with correct metadata');
select set_config('request.sotf_unicode_saved',pg_temp.unicode_snapshot()::text,true);
select is(workspace.sotf_v1_record_daily_brief_outcome(current_setting('request.sotf_unicode_outcome')::jsonb,current_setting('request.sotf_unicode_authority_token'))->>'replayed','true',
 'valid supplementary outcome exact retry is idempotent');
select is(pg_temp.unicode_snapshot(),current_setting('request.sotf_unicode_saved')::jsonb,'exact retry changes no durable surface');
select throws_ok(format('select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb,%L)',
 (current_setting('request.sotf_unicode_outcome')::jsonb || jsonb_build_object('request_id',gen_random_uuid(),'run_id',gen_random_uuid(),'host',null))::text,current_setting('request.sotf_unicode_authority_token')),
 '22023','sotf_v1:invalid_input','host NULL remains fail closed with Unicode state');
select throws_ok(format('select workspace.sotf_v1_record_daily_brief_outcome(%L::jsonb,%L)',
 (current_setting('request.sotf_unicode_outcome')::jsonb || jsonb_build_object('request_id',gen_random_uuid(),'run_id',gen_random_uuid(),'state_truncated',true,'truncated_sections','[]'::jsonb))::text,current_setting('request.sotf_unicode_authority_token')),
 '22023','sotf_v1:invalid_input','prior true plus empty sections forgery remains denied');
select is(pg_temp.unicode_snapshot(),current_setting('request.sotf_unicode_saved')::jsonb,'regression denials leave the success receipt and every other surface unchanged');
reset role;

select * from finish();
rollback;
