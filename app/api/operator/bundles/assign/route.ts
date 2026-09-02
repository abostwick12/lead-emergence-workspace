import { bundleAssignmentInput } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const input = bundleAssignmentInput.parse(await request.json());
    const { client } = await authenticatedBundleClient(accessToken);
    const entitlement = await bundleRpc<Record<string, unknown>>(client, "issue_bundle_assignment", {
      target_workspace_id: input.workspaceId,
      target_bundle_key: input.bundleKey,
      idempotency_key: input.idempotencyKey,
      target_expires_at: input.expiresAt ?? null
    }, "Could not assign this bundle.");
    return Response.json({ entitlement });
  } catch (error) {
    return bundleErrorResponse(error, "Could not assign this bundle.");
  }
}
