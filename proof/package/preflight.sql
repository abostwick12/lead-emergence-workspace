-- READ ONLY. Pin this result to Entry-dev vnjdubrnmxvmsccxmhst immediately before any separately approved application.
with ledger as (
  select count(*) n, min(version) oldest, max(version) newest,
    md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' order by to_jsonb(r)::text), '')) hash
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
    ('workspace_private.resolve_mcp_oauth_authorization(text,boolean)','4946546f94741c166712558f64e551fd',false,false),
    ('workspace.activate_mcp_oauth_grant(text)','4da671d77c24bf8633dcead81cf137f2',true,false),
    ('workspace_private.revoke_mcp_oauth_resource_grant(uuid,text,text)','581d85010c5b9f4956de7f9705f30bfe',false,false),
    ('workspace_private.is_valid_mcp_request()','0f82385662283a1dec152193af59c5f9',false,false),
    ('workspace_private.custom_access_token_hook(jsonb)','b8cce1c8a03316f70ef9575621a94b93',false,true)
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
    (select count(*)=1 from pg_constraint
     where conrelid='workspace_private.mcp_oauth_resource_grants'::regclass
       and pg_get_constraintdef(oid)='CHECK ((resource_uri = ''https://workspace.leademergence.com/api/mcp''::text))') canonical_constraint,
    to_regclass('workspace_private.mcp_oauth_resource_grants_one_active_resource_per_client_idx') is null new_index_absent,
    not exists(select 1 from workspace_private.mcp_oauth_resource_grants where resource_uri <> 'https://workspace.leademergence.com/api/mcp') canonical_grants_only,
    not exists(select 1 from workspace_private.mcp_oauth_resource_grants where status='active' group by user_id,client_id having count(*)>1) no_ambiguous_active_grants,
    not exists(select 1 from workspace_private.product_settings where setting_key='mcp_preview_resource_uri') preview_unset,
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
    and (select n=31 and oldest='20260819000000' and newest='20260929125618' and hash='07770289d3cb570f025c421ea7537f2c' from ledger)
    and (select auth_n=11 and auth_hash='5b0d89cd03f7dd4277932b65722f2da1'
      and workspace_n=2 and workspace_hash='e826407a88c3e0f08032f497d76611be'
      and membership_n=2 and membership_hash='aff36841235f7cbd81a91e7b92024baa'
      and authorization_n=3 and authorization_hash='1b86e64fe46ac00cd75187541542e214'
      and grant_n=3 and grant_hash='e4d36c1b37fefde87d7232adec9407ff'
      and settings_n=6 and settings_hash='d241e3b674de7a7aee2298f134c7944e' from protected)
    and (select ok from function_guard)
    and (select canonical_constraint and new_index_absent and canonical_grants_only and no_ambiguous_active_grants
      and preview_unset and canonical_setting and dynamic_enabled and grants_private from shape)
) as gate_preflight;
