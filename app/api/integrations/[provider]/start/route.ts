import { NextResponse } from "next/server";
import { createGitHubAppFlow, createOAuthFlow, oauthStateHash, OAUTH_FLOW_COOKIE, OAUTH_FLOW_TTL_MS } from "@/lib/integrations/oauth";
import { getIntegrationProvider, isIntegrationProviderId } from "@/lib/integrations/providers";
import { createOAuthAttempt, verifyWorkspaceOwner } from "@/lib/integrations/server";

export const runtime = "nodejs";

function accessToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() || null : null;
}
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isIntegrationProviderId(provider)) return NextResponse.json({ message: "Unknown connection." }, { status: 404 });
  const token = accessToken(request);
  if (!token) return NextResponse.json({ message: "Sign in before connecting an integration." }, { status: 401 });

  try {
    const body = await request.json() as { workspaceId?: unknown };
    if (typeof body.workspaceId !== "string") return NextResponse.json({ message: "Invalid Workspace connection request." }, { status: 400 });
    await verifyWorkspaceOwner(token, body.workspaceId);
    const providerConfiguration = getIntegrationProvider(provider);
    const flow = providerConfiguration?.connectionMethod === "github_app"
      ? createGitHubAppFlow({ accessToken: token, workspaceId: body.workspaceId })
      : createOAuthFlow({ accessToken: token, provider, workspaceId: body.workspaceId });
    await createOAuthAttempt({
      accessToken: token,
      expiresAt: new Date(Date.now() + OAUTH_FLOW_TTL_MS).toISOString(),
      provider,
      stateHash: oauthStateHash(flow.state),
      workspaceId: body.workspaceId
    });
    const response = NextResponse.json({ authorizationUrl: flow.authorizationUrl });
    response.cookies.set(OAUTH_FLOW_COOKIE, flow.sealedFlow, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/api/integrations",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not start this connection.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
