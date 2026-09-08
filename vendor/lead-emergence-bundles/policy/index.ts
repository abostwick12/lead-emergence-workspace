import { z } from "zod";

export const domainSchema = z.enum([
  "executive",
  "writing",
  "ministry",
  "nonprofit",
  "investing",
  "workspace"
]);

export const authenticatedPrincipalSchema = z.object({
  subjectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  source: z.enum(["verified_session", "verified_mcp_token"]),
  serverBound: z.literal(true)
}).strict();

export const crossDomainGrantSchema = z.object({
  from: domainSchema,
  to: domainSchema,
  dataClass: z.enum(["task_metadata", "full_content"]),
  operations: z.array(z.enum(["read", "propose", "execute"])).min(1)
}).strict();

export type Domain = z.infer<typeof domainSchema>;
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
export type CrossDomainGrant = z.infer<typeof crossDomainGrantSchema>;

export type DomainAccessRequest = {
  principal: AuthenticatedPrincipal | null;
  sourceDomain: Domain;
  targetDomain: Domain;
  targetTenantId: string;
  targetWorkspaceId: string;
  dataClass: "task_metadata" | "full_content";
  operation: "read" | "propose" | "execute";
  crossDomainGrants?: CrossDomainGrant[];
};

export class PolicyDeniedError extends Error {
  readonly code = "POLICY_DENIED";
}

export function assertDomainAccess(request: DomainAccessRequest): void {
  if (!request.principal) throw new PolicyDeniedError("Authentication is required.");
  const principal = authenticatedPrincipalSchema.parse(request.principal);
  if (
    principal.tenantId !== request.targetTenantId
    || principal.workspaceId !== request.targetWorkspaceId
  ) {
    throw new PolicyDeniedError("Cross-tenant or cross-workspace access is denied.");
  }
  if (request.sourceDomain === request.targetDomain) return;
  const grant = (request.crossDomainGrants ?? []).find((candidate) =>
    candidate.from === request.sourceDomain
    && candidate.to === request.targetDomain
    && candidate.operations.includes(request.operation)
    && (candidate.dataClass === "full_content" || request.dataClass === "task_metadata")
  );
  if (!grant) throw new PolicyDeniedError("An explicit cross-domain grant is required.");
}

export type Approval = {
  id: string;
  operation: string;
  authorizedBySubjectId: string;
  expiresAt: string;
};

export function assertMutationBoundary(
  mode: "read" | "propose" | "execute",
  operation: string,
  principal: AuthenticatedPrincipal,
  approval?: Approval,
  now = new Date()
): void {
  authenticatedPrincipalSchema.parse(principal);
  if (mode !== "execute") return;
  if (
    !approval
    || approval.operation !== operation
    || approval.authorizedBySubjectId !== principal.subjectId
    || new Date(approval.expiresAt) <= now
  ) {
    throw new PolicyDeniedError("Execution requires a current, operation-specific user approval.");
  }
}
