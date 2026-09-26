import { createHash } from "node:crypto";
import manifest from "@/lib/workspace/releases/sotf-transition/bundle.json";
import uiManifest from "@/lib/workspace/releases/sotf-transition/ui-manifest.json";
import release from "@/lib/workspace/releases/sotf-transition/1.0.0.json";

const SOTF_BUNDLE_KEY = "sotf_transition";
const SOTF_RELEASE_VERSION = "1.0.0";
const SOTF_RELEASE_DIGEST = "sha256:ab62f775b6662b1d4e9d15390aed41aaa6aeb6efd0cd8b965b255177609d0323";
const SOTF_SOURCE_REVISION = "70f6d14f25b391ea319080e6701e5fe74d1785a5";

// Match the canonical JSON digest used by @lead-emergence/bundle-release.
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export function resolveSotfRelease() {
  if (
    release.bundleKey !== SOTF_BUNDLE_KEY
    || release.version !== SOTF_RELEASE_VERSION
    || manifest.identity.key !== release.bundleKey
    || manifest.identity.version !== release.version
    || uiManifest.bundleKey !== release.bundleKey
    || release.validation.state !== "passed"
    || !release.validation.deterministic
    || release.artifactDigest !== SOTF_RELEASE_DIGEST
    || release.sourceRevision !== SOTF_SOURCE_REVISION
    || release.compatibility.bundleContractMajor !== 1
    || release.compatibility.minimumWorkspaceHostContract !== "1.0.0"
    || !release.compatibility.persistedStateCompatible
    || !release.compatibility.hostAdapterCompatible
  ) {
    throw new Error("SOTF release snapshot is invalid.");
  }

  const artifactDigest = `sha256:${createHash("sha256")
    .update(canonicalJson({ manifest, uiManifest }))
    .digest("hex")}`;
  if (artifactDigest !== release.artifactDigest) {
    throw new Error("SOTF release artifact digest does not match its validated record.");
  }

  return {
    bundleKey: release.bundleKey,
    version: release.version,
    artifactDigest: release.artifactDigest,
    sourceRevision: release.sourceRevision,
    manifest,
    uiManifest
  };
}
