-- Gate A hosted preflight: read-only inspection for the shared ministry project.
-- Run with a privileged inspection connection immediately before the approved
-- transactional Gate A operation. This script must not be used to change state.
--
-- The Data API check deliberately inspects the database-specific authenticator
-- setting and compares the value after '=' exactly. Do not replace it with a
-- regex: the former regex escaping produced a false failure for `public`.

with authenticator_database_settings as (
  select s.setting
  from pg_db_role_setting as role_setting
  cross join lateral unnest(role_setting.setconfig) as s(setting)
  where role_setting.setrole = 'authenticator'::regrole
    and role_setting.setdatabase = (
      select oid from pg_database where datname = current_database()
    )
    and s.setting like 'pgrst.db_schemas=%'
),
checks(check_name, passed) as (
  values
    (
      'workspace_exposure_not_yet_enabled',
      coalesce((
        select count(*) = 1
          and bool_and(split_part(setting, '=', 2) = 'public')
        from authenticator_database_settings
      ), false)
    ),
    (
      'workspace_private_not_exposed',
      coalesce((
        select count(*) = 1
          and bool_and(split_part(setting, '=', 2) = 'public')
        from authenticator_database_settings
      ), false)
    ),
    ('workspace_schema_absent', not exists (
      select 1 from pg_namespace where nspname = 'workspace'
    )),
    ('workspace_private_schema_absent', not exists (
      select 1 from pg_namespace where nspname = 'workspace_private'
    )),
    ('workspace_objects_absent', not exists (
      select 1
      from pg_namespace as schema_record
      left join pg_class as relation_record on relation_record.relnamespace = schema_record.oid
      left join pg_proc as function_record on function_record.pronamespace = schema_record.oid
      where schema_record.nspname in ('workspace', 'workspace_private')
        and (relation_record.oid is not null or function_record.oid is not null)
    )),
    ('workspace_private_bucket_absent', not exists (
      select 1 from storage.buckets where id = 'workspace-private'
    )),
    ('workspace_storage_policies_absent', not exists (
      select 1
      from pg_policy as policy_record
      where policy_record.polrelid = 'storage.objects'::regclass
        and policy_record.polname in (
          'workspace_private_objects_select',
          'workspace_private_objects_insert',
          'workspace_private_objects_update',
          'workspace_private_objects_delete'
        )
    )),
    ('auth_users_id_uuid', exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth' and table_name = 'users'
        and column_name = 'id' and udt_name = 'uuid'
    )),
    ('storage_buckets_columns_present', (
      select count(*) = 3
      from information_schema.columns
      where table_schema = 'storage' and table_name = 'buckets'
        and column_name in ('id', 'name', 'public')
    )),
    ('storage_objects_columns_present', (
      select count(*) = 4
      from information_schema.columns
      where table_schema = 'storage' and table_name = 'objects'
        and (
          column_name in ('id', 'bucket_id', 'name')
          or (column_name = 'owner_id' and udt_name = 'text')
        )
    )),
    ('storage_foldername_function_present',
      to_regprocedure('storage.foldername(text)') is not null
    ),
    ('current_ministry_id_returns_uuid',
      to_regprocedure('public.current_ministry_id()') is not null
      and pg_get_function_result(to_regprocedure('public.current_ministry_id()')) = 'uuid'
    ),
    ('pgcrypto_available', exists (
      select 1 from pg_extension where extname = 'pgcrypto'
    )),
    ('required_api_roles_present',
      exists (select 1 from pg_roles where rolname = 'anon')
      and exists (select 1 from pg_roles where rolname = 'authenticated')
      and exists (select 1 from pg_roles where rolname = 'authenticator')
    ),
    ('guest_permissions_table_present',
      to_regclass('public.guest_public_page_permissions') is not null
    ),
    ('guest_page_hardening_unapplied', coalesce((
      select pg_get_expr(policy_record.polqual, policy_record.polrelid) = 'true'
      from pg_policy as policy_record
      where policy_record.polrelid = 'public.guest_public_page_permissions'::regclass
        and policy_record.polname = 'guest_public_page_permissions_select_authenticated'
    ), false))
)
select
  count(*) as checks_run,
  bool_and(passed) as all_passed,
  coalesce(
    jsonb_agg(check_name order by check_name) filter (where not passed),
    '[]'::jsonb
  ) as failed_checks
from checks;
