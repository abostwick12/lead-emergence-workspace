-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- Restore only the advertised Memory reader missing from the hosted catalog.
-- Preserve the existing parity reader contract and current capability guard.
create or replace function workspace.mcp_list_memory(
  target_domain text default null,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_capability('memory');
begin
  if page_size is null or page_size not between 1 and 50 then
    raise exception 'Page size must be between 1 and 50.' using errcode = '22023';
  end if;
  if target_domain is not null and target_domain not in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership') then
    raise exception 'Memory domain is not supported.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'memory', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', memory.id,
        'memory_type', memory.memory_type,
        'content', memory.content,
        'domain', memory.domain,
        'created_at', memory.created_at,
        'updated_at', memory.updated_at
      ) order by memory.created_at desc, memory.id desc)
      from (
        select *
        from workspace.memory_entries
        where workspace_id = target_workspace_id
          and created_by = auth.uid()
          and (target_domain is null or domain = target_domain)
        order by created_at desc, id desc
        limit page_size
      ) as memory
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function workspace.mcp_list_memory(text, integer) from public, anon;
grant execute on function workspace.mcp_list_memory(text, integer) to authenticated;

notify pgrst, 'reload schema';
