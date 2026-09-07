import type { BundleEntitlementResolution } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string; bundleKey: string }> }
) {
  try {
    const accessToken = readBearerToken(request);
    const { workspaceId, bundleKey } = await context.params;
    const { client } = await authenticatedBundleClient(accessToken);
    const entitlement = await bundleRpc<BundleEntitlementResolution>(client, "resolve_bundle_entitlement", {
      target_workspace_id: workspaceId,
      target_bundle_key: bundleKey
    }, "Could not resolve this bundle.");
    return Response.json({ entitlement });
  } catch (error) {
    return bundleErrorResponse(error, "Could not resolve this bundle.");
  }
}
