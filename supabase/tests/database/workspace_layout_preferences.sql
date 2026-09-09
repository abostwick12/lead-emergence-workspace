begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();
select is(has_table_privilege(role,'workspace_private.'||relation,operation),false,role||' cannot '||operation||' '||relation)
 from unnest(array['anon','authenticated']) role
 cross join unnest(array['layout_contributions','layout_preferences','layout_versions']) relation
 cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) operation;
select ok((select relrowsecurity from pg_class where oid=('workspace_private.'||relation)::regclass),relation||' enables RLS')
 from unnest(array['layout_contributions','layout_preferences','layout_versions']) relation;
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot invoke '||signature)
 from unnest(array['anon','authenticated']) role cross join unnest(array[
 'workspace_private.require_layout_workspace()','workspace_private.default_layout()',
 'workspace_private.layout_item_choice(jsonb,text)','workspace_private.validate_layout(jsonb,jsonb,uuid)']) signature;
select is(has_function_privilege('anon',signature,'execute'),false,'anonymous cannot invoke '||signature)
 from unnest(array['workspace.get_workspace_layout()','workspace.save_workspace_layout(jsonb,integer,text,uuid,boolean)']) signature;
select is((select count(*)::integer from workspace_private.layout_contributions),11,'eleven implemented customizable contributions');
select is((select count(*)::integer from workspace_private.layout_contributions where route='/workspace'),0,'Home is an escape, not a hideable contribution');
select is((select count(*)::integer from workspace_private.bundle_capability_bindings where bundle_key='workspace_experience'),4,'only implemented Experience capabilities registered');
select * from finish();
rollback;
