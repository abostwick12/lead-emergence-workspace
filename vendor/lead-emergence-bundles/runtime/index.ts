import type { BundleArtifact, EntitlementSnapshot } from "../bundle-registry/index";
import { BundleRegistry } from "../bundle-registry/index";
import { CapabilityRegistry } from "../capability-registry/index";
import type { UiPreferences } from "../ui-manifest/index";
import { composeUiManifests } from "../ui-manifest/index";

export function composeExperience(
  artifacts: BundleArtifact[],
  entitlementSnapshot: EntitlementSnapshot,
  preferences: UiPreferences = {},
  now = new Date()
) {
  const bundles = new BundleRegistry();
  const capabilities = new CapabilityRegistry();
  for (const artifact of artifacts) {
    bundles.register(artifact);
    capabilities.registerBundle(artifact.manifest);
  }
  const entitledBundles = bundles.resolve(entitlementSnapshot, now);
  const bundleKeys = entitledBundles.map((bundle) => bundle.manifest.identity.key);
  return {
    entitlementRevision: entitlementSnapshot.revision,
    bundles: entitledBundles,
    capabilities: capabilities.resolveForBundles(bundleKeys),
    ui: composeUiManifests(entitledBundles.map((bundle) => bundle.uiManifest), preferences)
  };
}
