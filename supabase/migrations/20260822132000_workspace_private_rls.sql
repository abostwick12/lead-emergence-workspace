-- Defense in depth for server-owned Personal configuration. These tables are
-- intentionally absent from the Data API schema list and expose no privileges
-- to browser roles; RLS adds a second fail-closed boundary without policies.

alter table workspace_private.product_settings enable row level security;
alter table workspace_private.trusted_identity_providers enable row level security;
alter table workspace_private.plan_assignment_audit enable row level security;

comment on table workspace_private.product_settings is
  'Server-owned Workspace settings. Unexposed, grant-revoked, and RLS protected with no client policies.';
comment on table workspace_private.trusted_identity_providers is
  'Server-owned Entry provider allowlist. Unexposed, grant-revoked, and RLS protected with no client policies.';
comment on table workspace_private.plan_assignment_audit is
  'Server-owned Personal plan audit. Unexposed, grant-revoked, and RLS protected with no client policies.';
