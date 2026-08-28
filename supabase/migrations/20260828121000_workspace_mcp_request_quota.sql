-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Private-beta MCP protection. The quota is scoped to one resolved
-- owner Workspace and OAuth client, so one customer cannot consume another
-- customer's allowance. It runs before connection registration/tool execution.

create table if not exists workspace_private.mcp_request_quota_windows (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 500),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, client_id, window_started_at)
);

alter table workspace_private.mcp_request_quota_windows enable row level security;
revoke all on table workspace_private.mcp_request_quota_windows from public, anon, authenticated;

create index if not exists mcp_request_quota_windows_cleanup_idx
  on workspace_private.mcp_request_quota_windows (window_started_at);

create or replace function workspace.mcp_consume_request_quota()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  token_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  current_window timestamptz := date_trunc('minute', now());
  next_count integer;
begin
  if token_client_id is null then
    raise exception 'This assistant connection is missing its registered client identity.' using errcode = '42501';
  end if;

  insert into workspace_private.mcp_request_quota_windows (
    workspace_id, client_id, window_started_at, request_count
  ) values (
    target_workspace_id, token_client_id, current_window, 1
  ) on conflict (workspace_id, client_id, window_started_at) do update
    set request_count = workspace_private.mcp_request_quota_windows.request_count + 1,
        updated_at = now()
  returning request_count into next_count;

  return pg_catalog.jsonb_build_object(
    'allowed', next_count <= 60,
    'remaining', greatest(0, 60 - next_count),
    'reset_at', current_window + interval '1 minute'
  );
end;
$$;

revoke all on function workspace.mcp_consume_request_quota() from public, anon;
grant execute on function workspace.mcp_consume_request_quota() to authenticated;

create or replace function workspace_private.purge_expired_mcp_request_quotas()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Trusted server identity is required.' using errcode = '42501';
  end if;
  delete from workspace_private.mcp_request_quota_windows
  where window_started_at < now() - interval '24 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function workspace_private.purge_expired_mcp_request_quotas() from public, anon, authenticated;
grant execute on function workspace_private.purge_expired_mcp_request_quotas() to service_role;