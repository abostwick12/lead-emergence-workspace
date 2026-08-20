# Threat model

Primary threats are cross-tenant record UUID guessing, membership escalation,
Workspace-only users reading ministry data, ministry-only users reading
Workspace data, integration token exposure, and cross-workspace file access.

Mitigations: Workspace membership checks are enforced in Postgres RLS; writes
use `WITH CHECK`, immutable tenancy/creator triggers, and owner-only mutation
policies. Private helpers are unexposed, security-definer functions pin an
empty search path, Storage is private/RLS-scoped, and the application has no
service-role client. Cross-product denials require execution against the
shared project's complete policy metadata before onboarding external users.
