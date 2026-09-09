begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot invoke '||signature)
 from unnest(array['anon','authenticated']) role cross join unnest(array[
 'workspace_private.executive_schema(text)','workspace_private.executive_schema_v3(text)',
 'workspace_private.validate_executive(text,jsonb)','workspace_private.validate_executive_v3(text,jsonb)']) signature;
select is(workspace_private.executive_schema('meeting')->'properties'->'availability'->>'type','object','meeting supports a bounded availability snapshot');
select ok(not (workspace_private.executive_schema('meeting')->'required' ? 'availability'),'legacy meetings remain valid');
select is((workspace_private.executive_schema('meeting')#>>'{properties,availability,properties,input,additionalProperties}')::boolean,false,'unknown provider credentials are not allowed');
select is(has_table_privilege('authenticated','workspace_private.executive_versions','SELECT'),false,'availability history remains inaccessible directly');
select ok((select relrowsecurity from pg_class where oid='workspace_private.executive_documents'::regclass),'private meeting RLS retained');
select * from finish();
rollback;
