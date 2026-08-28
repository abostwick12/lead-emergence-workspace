-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Make MCP resource configuration verifiable by the runtime and bound
-- private idempotency receipt retention. This migration is additive and does
-- not enable any provider or production client.

create or replace function workspace.mcp_get_resource_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_uri text;
begin
  select setting_value into resource_uri
  from workspace_private.product_settings
  where setting_key = 'mcp_resource_uri';

  if resource_uri is null then
    raise exception 'Workspace MCP resource configuration is unavailable.' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object('resource_uri', resource_uri);
end;
$$;

revoke all on function workspace.mcp_get_resource_configuration() from public, anon;
grant execute on function workspace.mcp_get_resource_configuration() to authenticated;

alter table workspace_private.mcp_action_receipts
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists completed_at timestamptz,
  add column if not exists outcome text not null default 'pending'
    check (outcome in ('pending', 'succeeded', 'failed'));

create index if not exists mcp_action_receipts_expiry_idx
  on workspace_private.mcp_action_receipts (expires_at);

comment on table workspace_private.mcp_action_receipts is
  'Private idempotency state only. Receipt rows expire after 30 days. Future action functions must store deterministic request fingerprints and result references rather than user content.';

comment on column workspace_private.mcp_action_receipts.request_payload is
  'Legacy compatibility field. Do not add user content, credentials, OAuth values, or arbitrary tool results in new receipt writers.';

comment on column workspace_private.mcp_action_receipts.result is
  'Legacy compatibility field. Do not add user content, credentials, OAuth values, or arbitrary tool results in new receipt writers.';

create or replace function workspace_private.purge_expired_mcp_action_receipts()
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

  delete from workspace_private.mcp_action_receipts
  where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function workspace_private.purge_expired_mcp_action_receipts() from public, anon, authenticated;
grant execute on function workspace_private.purge_expired_mcp_action_receipts() to service_role;