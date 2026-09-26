import customerReleaseIndex from "@/lib/workspace/releases/customer.v1.json";

export const CUSTOMER_RELEASE_SOURCE_REVISION = "b1c5ada91949877c3591128b406a01f8e1daf65e";

export const CUSTOMER_RELEASE_INDEX = customerReleaseIndex as {
  readonly schemaVersion: "1.0";
  readonly channel: "customer";
  readonly approvedBundleManifests: readonly string[];
};
