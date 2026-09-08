import type { BundleManifest, CapabilityDefinition } from "../bundle-contract/index";
import { parseBundleManifest } from "../bundle-contract/index";

export type RegisteredCapability = CapabilityDefinition & {
  bundleKey: string;
};

export class CapabilityRegistryError extends Error {
  readonly code = "CAPABILITY_REGISTRY_ERROR";
}

export class CapabilityRegistry {
  readonly #capabilities = new Map<string, RegisteredCapability>();

  registerBundle(input: BundleManifest): void {
    const bundle = parseBundleManifest(input);
    for (const capability of bundle.capabilities) {
      if (this.#capabilities.has(capability.id)) {
        throw new CapabilityRegistryError(`Capability already registered: ${capability.id}`);
      }
      this.#capabilities.set(capability.id, {
        ...capability,
        bundleKey: bundle.identity.key
      });
    }
  }

  get(capabilityId: string): RegisteredCapability | undefined {
    return this.#capabilities.get(capabilityId);
  }

  list(): RegisteredCapability[] {
    return [...this.#capabilities.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  resolveForBundles(bundleKeys: Iterable<string>): RegisteredCapability[] {
    const entitled = new Set(bundleKeys);
    return this.list().filter((capability) => entitled.has(capability.bundleKey));
  }
}
