-- Phase 2.2 forward-only cleanup. The dedicated projection writer now reaches
-- these objects only through workspace.apply_personal_authority_projection.

revoke usage on schema workspace from service_role;

revoke all privileges
on workspace_private.personal_billing_projections,
   workspace_private.personal_access_authority_projections
from service_role;

revoke all privileges on function
workspace_private.apply_personal_billing_projection(
  uuid,
  workspace_private.personal_billing_effective_state,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  boolean,
  bigint,
  text,
  timestamptz
)
from service_role;

revoke all privileges on function
workspace_private.apply_personal_access_authority_projection(
  uuid,
  workspace_private.personal_access_authority_kind,
  workspace_private.personal_access_authority_status,
  text,
  bigint,
  uuid,
  timestamptz
)
from service_role;
