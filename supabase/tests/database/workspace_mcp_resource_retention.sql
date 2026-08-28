begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(8);

select has_function('workspace', 'mcp_get_resource_configuration', array[]::text[], 'MCP runtime can read the persisted resource through a narrow RPC');
select has_column('workspace_private', 'mcp_action_receipts', 'expires_at', 'Receipts have an expiry timestamp');
select has_column('workspace_private', 'mcp_action_receipts', 'completed_at', 'Receipts can record completion without result content');
select has_column('workspace_private', 'mcp_action_receipts', 'outcome', 'Receipts have a normalized outcome');
select ok(to_regclass('workspace_private.mcp_action_receipts_expiry_idx') is not null, 'Receipt expiry is indexed');
select ok(not has_function_privilege('authenticated', 'workspace_private.purge_expired_mcp_action_receipts()', 'execute'), 'Customers cannot purge receipts');
select ok(has_function_privilege('service_role', 'workspace_private.purge_expired_mcp_action_receipts()', 'execute'), 'Trusted scheduled maintenance can purge expired receipts');
select is(
  (select resource_uri from jsonb_to_record(workspace.mcp_get_resource_configuration()) as value(resource_uri text)),
  (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),
  'Resource RPC reflects the persisted configured resource'
);

select * from finish();
rollback;