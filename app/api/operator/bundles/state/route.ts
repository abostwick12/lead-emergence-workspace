import { bundleOperatorStateInput, type BundleOperatorState } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const workspaceId = new URL(request.url).searchParams.get("workspaceId") || undefined;
    const input = bundleOperatorStateInput.parse({ workspaceId });
    const { client } = await authenticatedBundleClient(accessToken);
    const state = await bundleRpc<BundleOperatorState>(client, "get_bundle_operator_state", {
      target_workspace_id: input.workspaceId ?? null
    }, "Could not review bundle access.");
    return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return bundleErrorResponse(error, "Could not review bundle access.");
  }
}
