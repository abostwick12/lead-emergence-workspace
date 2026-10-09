-- READ ONLY. Check the one approved Entry-dev vnjdubrnmxvmsccxmhst application after commit.
with ledger as (
  select count(*) n, min(version) oldest, max(version) newest,
    count(*) filter(where version='20261009180000') preview_version,
    md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text) filter(where version<>'20261009180000'), '')) prior_hash
  from supabase_migrations.schema_migrations r
), protected as (
  select
    (select count(*) from auth.users) auth_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from auth.users r) auth_hash,
    (select count(*) from workspace.workspaces) workspace_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from workspace.workspaces r) workspace_hash,
    (select count(*) from workspace.workspace_memberships) membership_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from workspace.workspace_memberships r) membership_hash,
    (select count(*) from workspace.mcp_authorizations) authorization_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from workspace.mcp_authorizations r) authorization_hash,
    (select count(*) from workspace_private.mcp_oauth_resource_grants) grant_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from workspace_private.mcp_oauth_resource_grants r) grant_hash,
    (select count(*) from workspace_private.product_settings where setting_key<>'mcp_preview_resource_uri') settings_n,
    (select md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) from workspace_private.product_settings r where setting_key<>'mcp_preview_resource_uri') settings_hash
), expected_functions(signature, body_md5, authenticated_execute, auth_admin_execute) as (
  values
    ('workspace_private.resolve_mcp_oauth_authorization(text,boolean)','2560fcbd6b62f7bbb3f1d4f6ba056d05',false,false),
    ('workspace.activate_mcp_oauth_grant(text)','336eb07ee437451628318e4c7d588c28',true,false),
    ('workspace_private.revoke_mcp_oauth_resource_grant(uuid,text,text)','ab24339bf27b36e9e402060753e6ad58',false,false),
    ('workspace_private.is_valid_mcp_request()','3c4354dc94694d65fa5f0c88ce748adf',false,false),
    ('workspace_private.custom_access_token_hook(jsonb)','06ccbc035737207b1fc80a6969a37e8f',false,true)
), function_guard as (
  select count(*)=5 and bool_and(
    p.oid is not null and md5(p.prosrc)=f.body_md5 and p.prosecdef
    and p.proconfig is not distinct from array['search_path=""']::text[]
    and pg_get_userbyid(p.proowner)='postgres'
    and has_function_privilege('authenticated',p.oid,'execute')=f.authenticated_execute
    and has_function_privilege('anon',p.oid,'execute')=false
    and has_function_privilege('supabase_auth_admin',p.oid,'execute')=f.auth_admin_execute
  ) ok
  from expected_functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
), shape as (
  select
    (select count(*)=0 from pg_constraint
     where conrelid='workspace_private.mcp_oauth_resource_grants'::regclass
       and pg_get_constraintdef(oid)='CHECK ((resource_uri = ''https://workspace.leademergence.com/api/mcp''::text))') old_constraint_absent,
    (select count(*)=1 from pg_constraint
     where conrelid='workspace_private.mcp_oauth_resource_grants'::regclass
       and conname='mcp_oauth_resource_grants_https_mcp_resource_check'
       and pg_get_constraintdef(oid) like '%^https://[a-z0-9.-]+/api/mcp$%') new_constraint,
    (select count(*)=1 from pg_index i join pg_class c on c.oid=i.indexrelid
     where c.oid=to_regclass('workspace_private.mcp_oauth_resource_grants_one_active_resource_per_client_idx')
       and i.indrelid='workspace_private.mcp_oauth_resource_grants'::regclass
       and i.indisunique and i.indpred is not null) new_unique_index,
    not exists(select 1 from workspace_private.mcp_oauth_resource_grants where resource_uri <> 'https://workspace.leademergence.com/api/mcp') canonical_grants_only,
    not exists(select 1 from workspace_private.mcp_oauth_resource_grants where status='active' group by user_id,client_id having count(*)>1) no_ambiguous_active_grants,
    (select count(*)=1 from workspace_private.product_settings where setting_key='mcp_preview_resource_uri' and setting_value='') preview_disabled,
    (select setting_value='https://workspace.leademergence.com/api/mcp' from workspace_private.product_settings where setting_key='mcp_resource_uri') canonical_setting,
    (select setting_value='true' from workspace_private.product_settings where setting_key='mcp_dynamic_admission_enabled') dynamic_enabled,
    not has_table_privilege('anon','workspace_private.mcp_oauth_resource_grants','select') and
    not has_table_privilege('authenticated','workspace_private.mcp_oauth_resource_grants','select') grants_private
)
select jsonb_build_object(
  'target_ref','vnjdubrnmxvmsccxmhst','read_only',true,'operator_role',current_user,
  'ledger',(select to_jsonb(l) from ledger l),
  'protected_counts',(select jsonb_build_object('auth',auth_n,'workspaces',workspace_n,'memberships',membership_n,'mcp_authorizations',authorization_n,'oauth_grants',grant_n,'existing_settings',settings_n) from protected),
  'protected_hashes',(select jsonb_build_object('auth',auth_hash,'workspaces',workspace_hash,'memberships',membership_hash,'mcp_authorizations',authorization_hash,'oauth_grants',grant_hash,'existing_settings',settings_hash) from protected),
  'functions_ok',(select ok from function_guard),
  'shape',(select to_jsonb(s) from shape s),
  'ready',current_user='postgres'
    and (select n=32 and oldest='20260819000000' and newest='20261009180000'
      and preview_version=1 and prior_hash='07770289d3cb570f025c421ea7537f2c' from ledger)
    and (select auth_n=11 and auth_hash='5b0d89cd03f7dd4277932b65722f2da1'
      and workspace_n=2 and workspace_hash='e826407a88c3e0f08032f497d76611be'
      and membership_n=2 and membership_hash='aff36841235f7cbd81a91e7b92024baa'
      and authorization_n=3 and authorization_hash='1b86e64fe46ac00cd75187541542e214'
      and grant_n=3 and grant_hash='e4d36c1b37fefde87d7232adec9407ff'
      and settings_n=6 and settings_hash='d241e3b674de7a7aee2298f134c7944e' from protected)
    and (select ok from function_guard)
    and (select old_constraint_absent and new_constraint and new_unique_index and canonical_grants_only and no_ambiguous_active_grants
      and preview_disabled and canonical_setting and dynamic_enabled and grants_private from shape)
) as gate_postflight;
