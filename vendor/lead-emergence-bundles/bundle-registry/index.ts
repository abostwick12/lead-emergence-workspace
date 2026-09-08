import { z } from "zod";
import type { BundleManifest } from "../bundle-contract/index";
import { bundleKeySchema, parseBundleManifest } from "../bundle-contract/index";
import type { AuthenticatedPrincipal } from "../policy/index";
import { authenticatedPrincipalSchema } from "../policy/index";
import type { UiManifest } from "../ui-manifest/index";
import { uiManifestSchema } from "../ui-manifest/index";

export const entitlementAssignmentSchema = z.object({
  bundleKey: bundleKeySchema,
  status: z.enum(["active", "revoked", "expired", "unavailable"]),
  startsAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional()
}).strict();

export const entitlementSnapshotSchema = z.object({
  principal: authenticatedPrincipalSchema,
  revision: z.string().trim().min(1).max(200),
  resolvedAt: z.string().datetime({ offset: true }),
  assignments: z.array(entitlementAssignmentSchema)
}).strict();

export type EntitlementAssignment = z.infer<typeof entitlementAssignmentSchema>;
export type EntitlementSnapshot = {
  principal: AuthenticatedPrincipal;
  revision: string;
  resolvedAt: string;
  assignments: EntitlementAssignment[];
};

export type BundleArtifact = {
  manifest: BundleManifest;
  uiManifest: UiManifest;
};

export class BundleRegistryError extends Error {
  readonly code = "BUNDLE_REGISTRY_ERROR";
}

export class BundleRegistry {
  readonly #bundles = new Map<string, BundleArtifact>();

  register(input: BundleArtifact): void {
    const manifest = parseBundleManifest(input.manifest);
    const uiManifest = uiManifestSchema.parse(input.uiManifest);
    if (manifest.identity.key !== uiManifest.bundleKey) {
      throw new BundleRegistryError("Bundle and UI manifest keys must match.");
    }
    if (this.#bundles.has(manifest.identity.key)) {
      throw new BundleRegistryError(`Bundle already registered: ${manifest.identity.key}`);
    }
    const capabilityIds = new Set(manifest.capabilities.map((item) => item.id));
    const workflowIds = new Set(manifest.workflows.map((item) => item.id));
    const attentionTypeIds = new Set(manifest.attentionTypes.map((item) => item.id));
    const actionIds = new Set(uiManifest.quickActions.map((item) => item.id));
    const capabilityReferences = [
      ...uiManifest.dashboardWidgets.map((item) => item.capabilityId),
      ...uiManifest.quickActions.map((item) => item.capabilityId),
      ...uiManifest.searchProviders.map((item) => item.capabilityId),
      ...uiManifest.commandPaletteActions.map((item) => item.capabilityId),
      ...uiManifest.notificationTypes.map((item) => item.capabilityId)
    ];
    for (const capabilityId of capabilityReferences) {
      if (!capabilityIds.has(capabilityId)) {
        throw new BundleRegistryError(`UI references unknown capability: ${capabilityId}`);
      }
    }
    for (const action of [...uiManifest.quickActions, ...uiManifest.commandPaletteActions]) {
      if (!workflowIds.has(action.workflowId)) {
        throw new BundleRegistryError(`UI action references unknown workflow: ${action.workflowId}`);
      }
    }
    for (const widget of uiManifest.dashboardWidgets) {
      for (const attentionType of widget.attentionTypes) {
        if (!attentionTypeIds.has(attentionType)) {
          throw new BundleRegistryError(`UI widget references unknown attention type: ${attentionType}`);
        }
      }
    }
    for (const emptyState of uiManifest.emptyStates) {
      if (emptyState.actionId && !actionIds.has(emptyState.actionId)) {
        throw new BundleRegistryError(`Empty state references unknown quick action: ${emptyState.actionId}`);
      }
    }
    this.#bundles.set(manifest.identity.key, { manifest, uiManifest });
  }

  get(bundleKey: string): BundleArtifact | undefined {
    return this.#bundles.get(bundleKey);
  }

  list(): BundleArtifact[] {
    return [...this.#bundles.values()].sort((left, right) =>
      left.manifest.identity.key.localeCompare(right.manifest.identity.key)
    );
  }

  resolve(snapshotInput: EntitlementSnapshot, now = new Date()): BundleArtifact[] {
    const snapshot = entitlementSnapshotSchema.parse(snapshotInput);
    const entitled = new Set(snapshot.assignments.filter((assignment) =>
      assignment.status === "active"
      && new Date(assignment.startsAt) <= now
      && (!assignment.expiresAt || new Date(assignment.expiresAt) > now)
    ).map((assignment) => assignment.bundleKey));
    return this.list().filter((bundle) => entitled.has(bundle.manifest.identity.key));
  }
}
