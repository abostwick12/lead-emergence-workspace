begin;

-- Keep the Workspace Auth hook entry point configured in supabase/config.toml,
-- but make the shared project classifier the only authority claim builder.
-- A Workspace-only checkout does not own that classifier, so absence must emit
-- no product authority rather than recreating or guessing the shared contract.
create or replace function workspace_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  original_claims jsonb := event -> 'claims';
  claims jsonb;
  delegated_event jsonb;
begin
  if jsonb_typeof(original_claims) is distinct from 'object' then
    raise exception 'Invalid hook claims.' using errcode = '22023';
  end if;

  if to_regprocedure('private.custom_access_token_hook(jsonb)') is null then
    claims := original_claims - array[
      'le_session_class',
      'le_product',
      'le_binding_version',
      'resource',
      'workspace_mcp'
    ];
    return jsonb_set(event, '{claims}', claims, true);
  end if;

  execute 'select private.custom_access_token_hook($1)'
    into delegated_event
    using event;
  return delegated_event;
end;
$$;

-- PostgREST exposes only the workspace schema. This self-only, read-only probe
-- lets the HTTP bearer verifier require the same Stage 2 durable binding and
-- Workspace-local resource grant predicate used by every Workspace MCP RPC.
create or replace function workspace.mcp_verify_current_authority()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(workspace_private.is_valid_mcp_request(), false);
$$;

revoke all on function workspace_private.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema workspace_private to supabase_auth_admin;
grant execute on function workspace_private.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke all on function workspace.mcp_verify_current_authority()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function workspace.mcp_verify_current_authority()
  to authenticated;

comment on function workspace_private.custom_access_token_hook(jsonb) is
  'Workspace Auth hook entry point. Delegates exclusively to the shared OAuth product classifier and emits no product authority when that classifier is absent.';
comment on function workspace.mcp_verify_current_authority() is
  'Read-only current-token check for the shared Stage 2 binding and Workspace-local MCP resource grant.';

notify pgrst, 'reload schema';
commit;
