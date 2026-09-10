import { z } from "zod";
import { composeExperience } from "@/vendor/lead-emergence-bundles/runtime";
import { parseBundleManifest } from "@/vendor/lead-emergence-bundles/bundle-contract";
import { uiManifestSchema } from "@/vendor/lead-emergence-bundles/ui-manifest";
import { valuePilotBundleKeys, valuePilotDefinition } from "@/vendor/lead-emergence-bundles/domain-contracts/value-pilot";
import writerBundle from "@/vendor/lead-emergence-bundles/bundles/writer-editor/bundle.json";
import writerUi from "@/vendor/lead-emergence-bundles/bundles/writer-editor/ui-manifest.json";
import ministryBundle from "@/vendor/lead-emergence-bundles/catalog/ministry-bundle.json";
import ministryUi from "@/vendor/lead-emergence-bundles/catalog/ministry-ui.json";
import nonprofitBundle from "@/vendor/lead-emergence-bundles/catalog/nonprofit-bundle.json";
import nonprofitUi from "@/vendor/lead-emergence-bundles/catalog/nonprofit-ui.json";
import investorBundle from "@/vendor/lead-emergence-bundles/catalog/investor-bundle.json";
import investorUi from "@/vendor/lead-emergence-bundles/catalog/investor-ui.json";
import executiveBundle from "@/vendor/lead-emergence-bundles/catalog/executive-bundle.json";
import executiveUi from "@/vendor/lead-emergence-bundles/catalog/executive-ui.json";
import experienceBundle from "@/vendor/lead-emergence-bundles/catalog/workspace-experience-bundle.json";
import experienceUi from "@/vendor/lead-emergence-bundles/catalog/workspace-experience-ui.json";

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
  { manifest: parseBundleManifest(nonprofitBundle), uiManifest: uiManifestSchema.parse(nonprofitUi), entryCapabilityId: "nonprofit.roadmap" },
  { manifest: parseBundleManifest(investorBundle), uiManifest: uiManifestSchema.parse(investorUi), entryCapabilityId: "investor.company_research", alternateEntryCapabilityIds: ["investor.thesis", "investor.filings"] },
  { manifest: parseBundleManifest(executiveBundle), uiManifest: uiManifestSchema.parse(executiveUi), entryCapabilityId: "executive.coordination", alternateEntryCapabilityIds: ["executive.brief", "executive.review"] },
  { manifest: parseBundleManifest(experienceBundle), uiManifest: uiManifestSchema.parse(experienceUi), entryCapabilityId: "workspace.compose" }
];
const valuePilotEntryCapabilities: Record<(typeof valuePilotBundleKeys)[number], string[]> = {
  executive: ["executive.brief", "executive.coordination", "executive.review"],
  writer_editor: ["writer.resource.review", "writer.resource.library"],
  ministry: ["ministry.research", "ministry.teaching"],
  nonprofit_founder: ["nonprofit.roadmap"],
  investor: ["investor.thesis", "investor.company_research", "investor.filings"],
  workspace_experience: ["workspace.compose"]
};

export function bundleValuePilotDefinitions(capabilityIds: string[]) {
  const available = new Set(capabilityIds);
  const byKey = new Map(artifacts.map(artifact => [artifact.manifest.identity.key, artifact]));
  return valuePilotBundleKeys.map(bundleKey => {
    const artifact = byKey.get(bundleKey);
    if (!artifact) throw new Error("A bundle value definition is missing.");
    if (!artifact.uiManifest.workspaceRoute) throw new Error("A bundle value route is missing.");
    return valuePilotDefinition.parse({
      schemaVersion: "1.0", bundleKey, manifestVersion: artifact.manifest.identity.version,
      displayName: artifact.manifest.identity.displayName, promise: artifact.manifest.experience.promise,
      firstRunOutcome: artifact.manifest.experience.firstRunOutcome,
      targetMinutes: artifact.manifest.experience.timeToFirstValueMinutes,
      successSignals: artifact.manifest.experience.successSignals,
      qualityGates: artifact.manifest.experience.qualityGates,
      workspaceRoute: artifact.uiManifest.workspaceRoute.route,
      available: valuePilotEntryCapabilities[bundleKey].some(capability => available.has(capability))
    });
  });
}

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
  const navigableBundles = new Set(artifacts.filter((item) => allowed.has(item.entryCapabilityId) || item.alternateEntryCapabilityIds?.some(id => allowed.has(id))).map((item) => item.manifest.identity.key));
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
// Presentation guidance only: it never asserts provider access or starts setup.
export function bundleConnectionGuidance(bundleKeys: string[]) {
  return artifacts.filter(a => bundleKeys.includes(a.manifest.identity.key)).map(a => ({
    key: a.manifest.identity.key, name: a.manifest.identity.displayName,
    providers: a.manifest.providerRequirements, apps: a.manifest.appRequirements
  })).filter(a => a.providers.length || a.apps.length);
}
export type BaseBundleExperience = ReturnType<typeof composeBundleExperience>;
export type BundleExperience = BaseBundleExperience & { layout?: { status: "ready" | "unavailable"; revision: number | null; defaultUnavailable?: boolean } };
