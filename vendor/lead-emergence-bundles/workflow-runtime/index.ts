import type { BundleRegistry, EntitlementSnapshot } from "../bundle-registry/index";
import type { AuthenticatedPrincipal, DomainAccessRequest, Approval } from "../policy/index";
import { assertDomainAccess, assertMutationBoundary, PolicyDeniedError } from "../policy/index";
import type { ProviderConnection, ProviderOperation } from "../provider-contracts/index";
import { assertProviderAuthorized } from "../provider-contracts/index";

export type PrepareWorkflowInput = {
  snapshot: EntitlementSnapshot;
  bundleKey: string;
  workflowId: string;
  principal: AuthenticatedPrincipal;
  domainRequest: Omit<DomainAccessRequest, "principal" | "operation">;
  providerConnections: ProviderConnection[];
  approval?: Approval;
};

export class WorkflowRuntimeError extends Error {
  readonly code = "WORKFLOW_RUNTIME_ERROR";
}

export class WorkflowRuntime {
  constructor(private readonly bundles: BundleRegistry) {}

  prepare(input: PrepareWorkflowInput, now = new Date()) {
    if (input.snapshot.principal.subjectId !== input.principal.subjectId) {
      throw new PolicyDeniedError("Entitlement and request principals must match.");
    }
    const entitled = this.bundles.resolve(input.snapshot, now);
    const artifact = entitled.find((bundle) => bundle.manifest.identity.key === input.bundleKey);
    if (!artifact) throw new WorkflowRuntimeError("The requested bundle is not entitled.");
    const workflow = artifact.manifest.workflows.find((candidate) => candidate.id === input.workflowId);
    if (!workflow) throw new WorkflowRuntimeError("The requested workflow is not registered.");
    assertDomainAccess({
      ...input.domainRequest,
      principal: input.principal,
      operation: workflow.mode
    });
    assertMutationBoundary(workflow.mode, workflow.id, input.principal, input.approval, now);
    for (const requirementId of workflow.providerRequirementIds) {
      const requirement = artifact.manifest.providerRequirements.find((candidate) => candidate.id === requirementId);
      if (!requirement) throw new WorkflowRuntimeError(`Missing provider requirement ${requirementId}.`);
      const connection = input.providerConnections.find((candidate) => candidate.provider === requirement.provider);
      assertProviderAuthorized(
        requirement,
        connection,
        workflow.mode as ProviderOperation,
        input.principal.subjectId,
        now
      );
    }
    return {
      bundleKey: artifact.manifest.identity.key,
      workflow,
      capabilityIds: [...workflow.capabilityIds],
      entitlementRevision: input.snapshot.revision
    };
  }
}
