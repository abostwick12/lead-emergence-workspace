import { NextResponse } from "next/server";
import { getIntegrationProvider, isIntegrationProviderId } from "@/lib/integrations/providers";
import { saveIntegrationCredential, verifyWorkspaceOwner } from "@/lib/integrations/server";

export const runtime = "nodejs";

function accessToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() || null : null;
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await context.params;
  const provider = getIntegrationProvider(providerId);
  if (!provider || !isIntegrationProviderId(providerId)) return NextResponse.json({ message: "Unknown connection." }, { status: 404 });
  if (provider.connectionMethod !== "api_key") return NextResponse.json({ message: "This connection uses provider authorization." }, { status: 400 });
  const token = accessToken(request);
  if (!token) return NextResponse.json({ message: "Sign in before connecting an integration." }, { status: 401 });

  try {
    const body = await request.json() as { apiKey?: unknown; workspaceId?: unknown };
    if (typeof body.workspaceId !== "string" || typeof body.apiKey !== "string" || body.apiKey.trim().length < 8) {
      return NextResponse.json({ message: "Enter a valid API key." }, { status: 400 });
    }
    await verifyWorkspaceOwner(token, body.workspaceId);
    await saveIntegrationCredential({
      accessToken: token,
      credential: { api_key: body.apiKey.trim() },
      provider: providerId,
      workspaceId: body.workspaceId
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not save this connection.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
