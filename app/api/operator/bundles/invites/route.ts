import { bundleInviteInput } from "@/lib/workspace/bundle-contract";
import {
  authenticatedBundleClient,
  bundleErrorResponse,
  bundleInviteUrl,
  bundleRpc,
  readBearerToken,
  stableBundleInviteToken
} from "@/lib/workspace/bundle-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const input = bundleInviteInput.parse(await request.json());
    const { client, user } = await authenticatedBundleClient(accessToken);
    const inviteToken = stableBundleInviteToken({
      operatorUserId: user.id,
      recipientEmail: input.recipientEmail,
      bundleKey: input.bundleKey,
      idempotencyKey: input.idempotencyKey
    });
    const invite = await bundleRpc<Record<string, unknown>>(client, "issue_bundle_invite", {
      target_bundle_key: input.bundleKey,
      target_recipient_email: input.recipientEmail,
      invite_token: inviteToken,
      idempotency_key: input.idempotencyKey,
      target_expires_at: input.expiresAt ?? null
    }, "Could not issue this bundle invite.");
    return Response.json({ invite, inviteUrl: bundleInviteUrl(inviteToken) });
  } catch (error) {
    return bundleErrorResponse(error, "Could not issue this bundle invite.");
  }
}
