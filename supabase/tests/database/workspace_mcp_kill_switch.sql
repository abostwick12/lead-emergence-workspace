begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(9);

select has_function('workspace_private', 'set_mcp_execution_enabled', array['boolean','text'], 'Trusted operators have a non-destructive MCP switch');
select ok(not has_function_privilege('authenticated', 'workspace_private.set_mcp_execution_enabled(boolean,text)', 'execute'), 'Customers cannot operate the MCP switch');
select ok(has_function_privilege('service_role', 'workspace_private.set_mcp_execution_enabled(boolean,text)', 'execute'), 'Trusted operators can operate the MCP switch');
select has_function('workspace_private', 'begin_mcp_action_receipt', array['uuid','text','text','uuid','text'], 'Metadata-only receipt start helper exists');
select has_function('workspace_private', 'complete_mcp_action_receipt', array['uuid','text','text','uuid','uuid','text'], 'Metadata-only receipt completion helper exists');
select has_column('workspace_private', 'mcp_action_receipts', 'request_hash', 'Receipts retain a hash rather than action body for new writers');
select has_column('workspace_private', 'mcp_action_receipts', 'affected_record_id', 'Receipts retain a canonical record reference');
select has_column('workspace_private', 'mcp_action_receipts', 'result_kind', 'Receipts retain a normalized outcome kind');
select ok((select setting_value = 'true' from workspace_private.product_settings where setting_key = 'mcp_execution_enabled'), 'MCP execution defaults enabled after migration');

select * from finish();
rollback;