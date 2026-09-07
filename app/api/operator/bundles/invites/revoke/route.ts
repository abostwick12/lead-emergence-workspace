import { bundleInviteRevocationInput } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const input = bundleInviteRevocationInput.parse(await request.json());
    const { client } = await authenticatedBundleClient(accessToken);
    const invite = await bundleRpc<Record<string, unknown>>(client, "revoke_bundle_invite", {
      target_invite_id: input.inviteId,
      revocation_reason: input.reason
    }, "Could not revoke this bundle invite.");
    return Response.json({ invite });
  } catch (error) {
    return bundleErrorResponse(error, "Could not revoke this bundle invite.");
  }
}
