import { NextRequest, NextResponse } from "next/server";
import { oauthStateHash, OAUTH_FLOW_COOKIE, readOAuthFlow, workspaceApplicationOrigin } from "@/lib/integrations/oauth";
import { consumeOAuthAttempt, saveIntegrationCredential } from "@/lib/integrations/server";

export const runtime = "nodejs";

function redirect(status: "connected" | "error") {
  const url = new URL("/workspace/integrations", workspaceApplicationOrigin());
  url.searchParams.set("connection", "github");
  url.searchParams.set("status", status);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_FLOW_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/api/integrations", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}

export async function GET(request: NextRequest) {
  const installationId = request.nextUrl.searchParams.get("installation_id");
  const state = request.nextUrl.searchParams.get("state");
  const sealedFlow = request.cookies.get(OAUTH_FLOW_COOKIE)?.value;
  try {
    if (!installationId || !state || !sealedFlow || !/^\d+$/.test(installationId)) throw new Error("GitHub installation was not completed.");
    const flow = readOAuthFlow(sealedFlow, "github", state);
    await consumeOAuthAttempt({ accessToken: flow.accessToken, provider: "github", stateHash: oauthStateHash(state), workspaceId: flow.workspaceId });
    await saveIntegrationCredential({
      accessToken: flow.accessToken,
      credential: { installation_id: installationId },
      provider: "github",
      workspaceId: flow.workspaceId
    });
    return redirect("connected");
  } catch {
    return redirect("error");
  }
}
