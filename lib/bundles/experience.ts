import { z } from "zod";
import { composeExperience } from "@/vendor/lead-emergence-bundles/runtime";
import { parseBundleManifest } from "@/vendor/lead-emergence-bundles/bundle-contract";
import { uiManifestSchema } from "@/vendor/lead-emergence-bundles/ui-manifest";
import writerBundle from "@/vendor/lead-emergence-bundles/bundles/writer-editor/bundle.json";
import writerUi from "@/vendor/lead-emergence-bundles/bundles/writer-editor/ui-manifest.json";
import ministryBundle from "@/vendor/lead-emergence-bundles/catalog/ministry-bundle.json";
import ministryUi from "@/vendor/lead-emergence-bundles/catalog/ministry-ui.json";
import nonprofitBundle from "@/vendor/lead-emergence-bundles/catalog/nonprofit-bundle.json";
import nonprofitUi from "@/vendor/lead-emergence-bundles/catalog/nonprofit-ui.json";

const assignment = z.object({
  bundleKey: z.string(), status: z.enum(["active", "revoked", "expired", "unavailable"]),
  startsAt: z.string().datetime({ offset: true }), expiresAt: z.string().datetime({ offset: true }).nullable()
}).strict();
export const bundleAuthoritySchema = z.object({
  schemaVersion: z.literal("1.0"), subjectId: z.string().uuid(), workspaceId: z.string().uuid(),
  resolvedAt: z.string().datetime({ offset: true }), revision: z.string().min(1),
  assignments: z.array(assignment),
  capabilities: z.array(z.object({ bundleKey: z.string(), capabilityId: z.string() }).strict())
}).strict();
export type BundleAuthority = z.infer<typeof bundleAuthoritySchema>;
// Host registration declares the capability needed to enter each implemented
// workspace. It is product configuration, never a user-specific conditional.
const artifacts = [
  { manifest: parseBundleManifest(writerBundle), uiManifest: uiManifestSchema.parse(writerUi), entryCapabilityId: "writer.resource.library" },
  { manifest: parseBundleManifest(ministryBundle), uiManifest: uiManifestSchema.parse(ministryUi), entryCapabilityId: "ministry.research" },
  { manifest: parseBundleManifest(nonprofitBundle), uiManifest: uiManifestSchema.parse(nonprofitUi), entryCapabilityId: "nonprofit.roadmap" }
];

export function composeBundleExperience(raw: unknown) {
  const authority = bundleAuthoritySchema.parse(raw);
  // This adapter is called only with RPC data from a verified bearer-bound client.
  // Neither the browser nor a model may supply a trusted principal.
  const snapshot = {
    principal: { subjectId: authority.subjectId, tenantId: authority.workspaceId,
      workspaceId: authority.workspaceId, source: "verified_session" as const, serverBound: true as const },
    revision: authority.revision, resolvedAt: authority.resolvedAt,
    assignments: authority.assignments.map((item) => ({ ...item, expiresAt: item.expiresAt ?? undefined }))
  };
  const composed = composeExperience(artifacts, snapshot, {}, new Date(authority.resolvedAt));
  const admitted = new Set(authority.capabilities.map((item) => item.bundleKey + ":" + item.capabilityId));
  const capabilities = composed.capabilities.filter((item) => admitted.has(item.bundleKey + ":" + item.id));
  const allowed = new Set(capabilities.map((item) => item.id));
  const admittedBundles = new Set(capabilities.map((item) => item.bundleKey));
  const navigableBundles = new Set(artifacts.filter((item) => allowed.has(item.entryCapabilityId)).map((item) => item.manifest.identity.key));
  const ui = composed.ui;
  return {
    workspaceId: authority.workspaceId, revision: authority.revision, resolvedAt: authority.resolvedAt,
    expiresAt: authority.assignments.filter((item) => item.status === "active" && item.expiresAt)
      .map((item) => item.expiresAt!).sort()[0] ?? null,
    bundleKeys: composed.bundles.map((item) => item.manifest.identity.key).filter((key) => admittedBundles.has(key)),
    capabilityIds: [...allowed],
    ui: {
      ...ui,
      primaryNavigation: ui.primaryNavigation.filter((item) => navigableBundles.has(item.sourceBundleKey) && (!item.capabilityId || allowed.has(item.capabilityId))),
      secondaryNavigation: ui.secondaryNavigation.filter((item) => navigableBundles.has(item.sourceBundleKey) && (!item.capabilityId || allowed.has(item.capabilityId))),
      dashboardWidgets: ui.dashboardWidgets.filter((item) => allowed.has(item.capabilityId)),
      quickActions: ui.quickActions.filter((item) => allowed.has(item.capabilityId)),
      commandPaletteActions: ui.commandPaletteActions.filter((item) => allowed.has(item.capabilityId)),
      searchProviders: ui.searchProviders.filter((item) => allowed.has(item.capabilityId)),
      notificationTypes: ui.notificationTypes.filter((item) => allowed.has(item.capabilityId)),
      emptyStates: ui.emptyStates.filter((item) => admittedBundles.has(item.sourceBundleKey)),
      bundleSettings: ui.bundleSettings.filter((item) => admittedBundles.has(item.sourceBundleKey)),
      defaultWorkspaceRoute: ui.primaryNavigation.find((item) => navigableBundles.has(item.sourceBundleKey))?.route
    }
  };
}
export type BundleExperience = ReturnType<typeof composeBundleExperience>;
