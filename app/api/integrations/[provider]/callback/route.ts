import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode, oauthStateHash, OAUTH_FLOW_COOKIE, readOAuthFlow, workspaceApplicationOrigin } from "@/lib/integrations/oauth";
import { connectedProviders, getIntegrationProvider, isIntegrationProviderId } from "@/lib/integrations/providers";
import { consumeOAuthAttempt, saveIntegrationCredential, saveOAuthIntegrationCredential } from "@/lib/integrations/server";

export const runtime = "nodejs";

function integrationLocation(provider: string, status: "connected" | "error"): URL {
  const url = new URL("/workspace/integrations", workspaceApplicationOrigin());
  url.searchParams.set("connection", provider);
  url.searchParams.set("status", status);
  return url;
}

function completeRedirect(provider: string, status: "connected" | "error") {
  const response = NextResponse.redirect(integrationLocation(provider, status));
  response.cookies.set(OAUTH_FLOW_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/api/integrations", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await context.params;
  if (!isIntegrationProviderId(providerId)) return NextResponse.redirect(new URL("/workspace/integrations", request.url));
  const provider = getIntegrationProvider(providerId);
  if (!provider?.consumerConnectionReady) return completeRedirect(providerId, "error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const sealedFlow = request.cookies.get(OAUTH_FLOW_COOKIE)?.value;
  let claimedFlow: ReturnType<typeof readOAuthFlow> | null = null;

  try {
    if (!provider || !code || !state || !sealedFlow || request.nextUrl.searchParams.has("error")) throw new Error("Authorization was not completed.");
    const flow = readOAuthFlow(sealedFlow, providerId, state);
    const stateHash = oauthStateHash(state);
    await consumeOAuthAttempt({ accessToken: flow.accessToken, provider: providerId, stateHash, workspaceId: flow.workspaceId });
    claimedFlow = flow;
    const token = await exchangeOAuthCode({ code, codeVerifier: flow.codeVerifier, provider: providerId });
    for (const providerIdToSave of connectedProviders(providerId)) {
      await saveOAuthIntegrationCredential({ accessToken: flow.accessToken, credential: token, provider: providerIdToSave, stateHash, workspaceId: flow.workspaceId });
    }
    return completeRedirect(provider.id, "connected");
  } catch {
    try {
      if (provider && claimedFlow) {
        await saveIntegrationCredential({ accessToken: claimedFlow.accessToken, credential: {}, provider: providerId, status: "error", workspaceId: claimedFlow.workspaceId });
      }
    } catch {
      // A failed authorization must not expose provider or token details to the browser.
    }
    return completeRedirect(providerId, "error");
  }
}
