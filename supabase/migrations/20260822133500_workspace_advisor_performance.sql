-- Preserve Workspace policy semantics while allowing Postgres to evaluate Auth
-- helpers once per statement instead of once per row.
do $$
declare
  policy_record record;
  optimized_qual text;
  optimized_check text;
  policy_roles text;
begin
  for policy_record in
    select *
    from pg_catalog.pg_policies
    where schemaname = 'workspace'
      and (
        position('auth.uid()' in coalesce(qual, '')) > 0
        or position('auth.jwt()' in coalesce(qual, '')) > 0
        or position('auth.uid()' in coalesce(with_check, '')) > 0
        or position('auth.jwt()' in coalesce(with_check, '')) > 0
      )
    order by tablename, policyname
  loop
    optimized_qual := replace(replace(policy_record.qual, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');
    optimized_check := replace(replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');
    select string_agg(pg_catalog.quote_ident(role_name::text), ', ' order by role_name::text)
      into policy_roles
    from unnest(policy_record.roles) as role_name;

    execute format('drop policy %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
    execute format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename,
      policy_record.permissive,
      policy_record.cmd,
      policy_roles,
      case when optimized_qual is null then '' else format(' using (%s)', optimized_qual) end,
      case when optimized_check is null then '' else format(' with check (%s)', optimized_check) end
    );
  end loop;
end;
$$;

-- Every foreign key in the private Workspace schemas receives a covering
-- prefix index unless one already exists. This is additive and retains the
-- deliberate query indexes created by earlier migrations.
do $$
declare
  foreign_key record;
  index_name text;
begin
  for foreign_key in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      constraint_record.conname as constraint_name,
      constraint_record.conrelid,
      constraint_record.conkey,
      string_agg(pg_catalog.quote_ident(attribute.attname), ', ' order by key_column.ordinality) as indexed_columns,
      string_agg(attribute.attname, '_' order by key_column.ordinality) as index_column_name
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral unnest(constraint_record.conkey) with ordinality as key_column(attnum, ordinality)
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_record.conrelid
      and attribute.attnum = key_column.attnum
    where constraint_record.contype = 'f'
      and namespace.nspname in ('workspace', 'workspace_private')
      and not exists (
        select 1
        from pg_catalog.pg_index as index_record
        where index_record.indrelid = constraint_record.conrelid
          and index_record.indisvalid
          and index_record.indisready
          and index_record.indnkeyatts >= cardinality(constraint_record.conkey)
          and not exists (
            select 1
            from generate_subscripts(constraint_record.conkey, 1) as key_position
            where (index_record.indkey::smallint[])[key_position - 1] <> constraint_record.conkey[key_position]
          )
      )
    group by namespace.nspname, relation.relname, constraint_record.conname,
      constraint_record.conrelid, constraint_record.conkey
    order by namespace.nspname, relation.relname, constraint_record.conname
  loop
    index_name := left(foreign_key.table_name || '_' || foreign_key.index_column_name || '_fk_', 52)
      || substr(md5(foreign_key.constraint_name), 1, 8);
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.indexed_columns
    );
  end loop;
end;
$$;
