begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();
select is(has_table_privilege(role,'workspace_private.search_providers',operation),false,role||' cannot '||operation||' search providers')
 from unnest(array['anon','authenticated']) role cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) operation;
select ok((select relrowsecurity from pg_class where oid='workspace_private.search_providers'::regclass),'provider registry uses RLS');
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot invoke '||signature)
 from unnest(array['anon','authenticated']) role cross join unnest(array[
 'workspace_private.require_search_workspace()','workspace_private.admitted_search_providers(uuid)','workspace_private.search_document_text(jsonb)']) signature;
select is(has_function_privilege('anon',signature,'execute'),false,'anonymous cannot invoke '||signature)
 from unnest(array['workspace.search_saved_work_catalog()','workspace.search_saved_work(text,text[],text,integer)']) signature;
select is((select count(*)::integer from workspace_private.search_providers),16,'sixteen implemented scopes');
select is((select count(*)::integer from workspace_private.search_providers where kind='profile'),0,'no private profile scope');
select is((select cardinality(capability_ids) from workspace_private.search_providers where id='writer.search.resources'),2,'Writer full-text requires library and review');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"fictional-search-hostile-test"}',true);
select throws_ok('select workspace.search_saved_work_catalog()','42501','Use native Workspace search.','model catalog read denied before ownership');
select throws_ok($test$select workspace.search_saved_work('secret',array['ministry.search.research'],'stale',0)$test$,'42501','Use native Workspace search.','model shared search denied before scope');
select * from finish();
rollback;
