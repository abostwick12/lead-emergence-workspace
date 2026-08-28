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
  if (provider.connectionMethod === "mcp_oauth") return NextResponse.json({ message: "Assistant connections are managed from Workspace settings." }, { status: 400 });
  const token = accessToken(request);
  if (!token) return NextResponse.json({ message: "Sign in before changing an integration." }, { status: 401 });

  try {
    const body = await request.json() as { workspaceId?: unknown };
    if (typeof body.workspaceId !== "string") return NextResponse.json({ message: "Invalid Workspace connection request." }, { status: 400 });
    await verifyWorkspaceOwner(token, body.workspaceId);
    await saveIntegrationCredential({
      accessToken: token,
      credential: {},
      provider: providerId,
      status: "disconnected",
      workspaceId: body.workspaceId
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Could not disconnect this provider from Workspace." }, { status: 400 });
  }
}
