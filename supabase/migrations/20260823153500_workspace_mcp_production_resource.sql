-- Keep the Personal project's token audience aligned with the canonical
-- production Workspace MCP resource. Preview uses its own isolated project.
update workspace_private.product_settings
set setting_value = 'https://workspace.leademergence.com/api/mcp',
    updated_at = now()
where setting_key = 'mcp_resource_uri';
