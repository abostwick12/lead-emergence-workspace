-- Local-only environment alignment. Hosted and Preview authorities must set
-- their own exact provider and MCP resource values through reviewed config.
update workspace_private.trusted_identity_providers
set enabled = environment = 'development';

update workspace_private.product_settings
set setting_value = 'http://localhost:3000/api/mcp', updated_at = now()
where setting_key = 'mcp_resource_uri';
