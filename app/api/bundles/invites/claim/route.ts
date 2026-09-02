import { bundleInviteClaimInput } from "@/lib/workspace/bundle-contract";
import { authenticatedBundleClient, bundleErrorResponse, bundleRpc, readBearerToken } from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const input = bundleInviteClaimInput.parse(await request.json());
    const { client } = await authenticatedBundleClient(accessToken);
    await bundleRpc(client, "ensure_personal_workspace", {}, "Could not resolve your Personal Workspace.");
    const claim = await bundleRpc<Record<string, unknown>>(client, "claim_bundle_invite", {
      invite_token: input.token
    }, "This bundle invite is invalid or unavailable.");
    return Response.json({ claim });
  } catch (error) {
    return bundleErrorResponse(error, "This bundle invite is invalid or unavailable.");
  }
}
