begin;
create extension if not exists pgtap with schema extensions;
set search_path=workspace,extensions,public;
select no_plan();
select is(has_function_privilege(role,signature,'execute'),false,role||' cannot invoke '||signature)
 from unnest(array['anon','authenticated']) role
 cross join unnest(array[
 'workspace_private.executive_schema_v2(text)',
 'workspace_private.validate_executive_v2(text,jsonb)',
 'workspace_private.executive_schema(text)',
 'workspace_private.validate_executive(text,jsonb)',
 'workspace_private.executive_outcome_rules()',
 'workspace_private.executive_outcome_change(text,jsonb,jsonb)',
 'workspace_private.executive_weekly_events(uuid,timestamptz,timestamptz,timestamptz)'
 ]) signature;
select is(has_function_privilege('anon','workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer)','execute'),false,'anonymous weekly bridge denied');
select is(has_function_privilege('authenticated','workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer)','execute'),true,'authenticated guarded weekly bridge');
select ok((select prosecdef from pg_proc where oid='workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer)'::regprocedure),'weekly bridge has guarded owner rights');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid='workspace.executive_weekly_outcomes(date,date,text,timestamptz,integer,integer)'::regprocedure),'weekly bridge has an empty search path');
select throws_ok($$select workspace.executive_weekly_outcomes(current_date,current_date,'UTC')$$,'42501',null,'weekly history requires verified identity');
select is(has_table_privilege('authenticated','workspace_private.executive_versions','SELECT'),false,'raw history remains private');
select ok((select relrowsecurity from pg_class where oid='workspace_private.executive_versions'::regclass),'history RLS retained');
select is(workspace_private.executive_outcome_change('commitment','{"state":"open"}','{"state":"completed","completedOn":"2020-01-01"}')->>'change','recorded','backdated completion is recorded');
select is(workspace_private.executive_outcome_change('commitment','{"state":"completed","completedOn":"2020-01-01"}','{"state":"completed","completedOn":"2020-01-02"}')->>'change','corrected','changed completion date is a correction');
select is(workspace_private.executive_outcome_change('commitment','{"state":"completed","notes":"before"}','{"state":"completed","notes":"after"}'),null::jsonb,'ordinary notes do not become accomplishments');
select is(workspace_private.executive_outcome_change('commitment','{"state":"completed"}','{"state":"open"}')->>'change','withdrawn','reopening withdraws a recorded completion');
select is(workspace_private.executive_outcome_change('decision','{"state":"decided"}','{"state":"reversed"}')->>'outcome','reversed','decision reversal is explicitly distinguished');
select is(workspace_private.executive_outcome_change('action','{"state":"completed"}',null)->>'change','withdrawn','removed completed action has a withdrawal');
select is(workspace_private.executive_outcome_change('action','{"state":"open"}',null),null::jsonb,'removed unfinished action is not an accomplishment');
select is(workspace_private.executive_outcome_change('daily_brief','{"state":"reviewed"}','{"state":"archived"}'),null::jsonb,'archiving preserves a review without inventing another event');
select is(workspace_private.executive_outcome_change('weekly_review','{"state":"reviewed","summary":"before"}','{"state":"reviewed","summary":"after"}')->>'change','corrected','substantive review change is a correction');
select is(workspace_private.executive_outcome_change('unknown',null,'{"state":"completed"}'),null::jsonb,'unknown subjects do not produce history');
select is(workspace_private.executive_schema('weekly_review')->'properties'->'timeZone'->>'type','string','new reviews can retain a named time zone');
select ok(not (workspace_private.executive_schema('weekly_review')->'required' ? 'timeZone'),'older reviews do not require rewriting');
select * from finish();
rollback;
