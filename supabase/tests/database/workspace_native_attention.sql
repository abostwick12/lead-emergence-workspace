begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot invoke '||signature)
from unnest(array['anon','authenticated']) role cross join unnest(array[
'workspace_private.require_native_attention_workspace()','workspace_private.native_attention_scopes(uuid)',
'workspace_private.native_attention_metadata(text)','workspace_private.native_attention_task_metadata(text,uuid)']) signature;
select is(has_function_privilege('anon',signature,'execute'),false,'anonymous cannot invoke '||signature)
from unnest(array['workspace.native_attention_catalog()','workspace.native_attention(date,text,text,text,integer)']) signature;
select ok((select exists(select 1 from workspace_private.layout_contributions where identity='workspace_experience:workspace.widget.attention'
 and kind='widget' and capability_ids=array['workspace.attention'])),'attention is a supported user-owned layout widget');
select ok((select exists(select 1 from workspace_private.bundle_capability_bindings where bundle_key='workspace_experience'
 and runtime_capability_id='workspace.attention')),'native attention has a current capability binding');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"fictional-attention-hostile"}',true);
select throws_ok('select workspace.native_attention_catalog()','42501','Use native Workspace attention.','model catalog access denied before ownership');
select throws_ok($test$select workspace.native_attention(date '2026-09-09','stale')$test$,'42501','Use native Workspace attention.','model cross-domain attention denied before scope');
select * from finish();
rollback;
