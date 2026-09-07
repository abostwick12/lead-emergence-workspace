import { bundleEntitlementRevocationInput } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const input = bundleEntitlementRevocationInput.parse(await request.json());
    const { client } = await authenticatedBundleClient(accessToken);
    const entitlement = await bundleRpc<Record<string, unknown>>(client, "revoke_bundle_entitlement", {
      target_entitlement_id: input.entitlementId,
      revocation_reason: input.reason
    }, "Could not revoke this bundle entitlement.");
    return Response.json({ entitlement });
  } catch (error) {
    return bundleErrorResponse(error, "Could not revoke this bundle entitlement.");
  }
}
