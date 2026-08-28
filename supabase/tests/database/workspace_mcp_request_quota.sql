begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(6);

select has_function('workspace', 'mcp_consume_request_quota', array[]::text[], 'MCP request quota is a controlled Workspace RPC');
select ok((select relrowsecurity from pg_class where oid = 'workspace_private.mcp_request_quota_windows'::regclass), 'Quota windows have RLS enabled');
select ok(not has_table_privilege('authenticated', 'workspace_private.mcp_request_quota_windows', 'select'), 'Customers cannot read quota rows directly');
select ok(has_function_privilege('authenticated', 'workspace.mcp_consume_request_quota()', 'execute'), 'MCP bearer role can consume its own quota through the guarded RPC');
select ok(not has_function_privilege('authenticated', 'workspace_private.purge_expired_mcp_request_quotas()', 'execute'), 'Customers cannot purge quotas');
select ok(has_function_privilege('service_role', 'workspace_private.purge_expired_mcp_request_quotas()', 'execute'), 'Trusted maintenance can purge old quota windows');

select * from finish();
rollback;