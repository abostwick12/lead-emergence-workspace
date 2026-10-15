import { NextRequest, NextResponse } from "next/server";
import { calendarAccountConnected } from "@/lib/calendar/credentials";
import { CALENDAR_FLOW_COOKIE, CALENDAR_FLOW_TTL_MS, createCalendarFlow, isCalendarSlot, revokeCalendarAccount } from "@/lib/calendar/oauth";
import { verifyWorkspaceOwner } from "@/lib/integrations/server";

export const runtime = "nodejs";

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

function workspaceIdFrom(url: URL): string | null {
  return url.searchParams.get("workspaceId");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (!isCalendarSlot(slot)) return NextResponse.json({ message: "Unknown Calendar account." }, { status: 404 });
  const accessToken = bearer(request);
  const workspaceId = workspaceIdFrom(request.nextUrl);
  if (!accessToken || !workspaceId) return NextResponse.json({ message: "Sign in to review Calendar accounts." }, { status: 401 });
  try {
    await verifyWorkspaceOwner(accessToken, workspaceId);
    const connected = await calendarAccountConnected(workspaceId, slot);
    return NextResponse.json({ slot, connected }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Calendar account status is unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (!isCalendarSlot(slot)) return NextResponse.json({ message: "Unknown Calendar account." }, { status: 404 });
  const accessToken = bearer(request);
  if (!accessToken) return NextResponse.json({ message: "Sign in to connect a Calendar account." }, { status: 401 });
  try {
    const body = await request.json() as { workspaceId?: unknown };
    if (typeof body.workspaceId !== "string") throw new Error("Missing Workspace.");
    await verifyWorkspaceOwner(accessToken, body.workspaceId);
    const flow = createCalendarFlow({ accessToken, slot, workspaceId: body.workspaceId });
    const response = NextResponse.json({ authorizationUrl: flow.authorizationUrl });
    response.cookies.set(CALENDAR_FLOW_COOKIE, flow.sealedFlow, {
      httpOnly: true,
      maxAge: CALENDAR_FLOW_TTL_MS / 1000,
      path: "/api/calendar/accounts",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ message: "Could not start Calendar connection." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (!isCalendarSlot(slot)) return NextResponse.json({ message: "Unknown Calendar account." }, { status: 404 });
  const accessToken = bearer(request);
  if (!accessToken) return NextResponse.json({ message: "Sign in to disconnect a Calendar account." }, { status: 401 });
  try {
    const body = await request.json() as { workspaceId?: unknown };
    if (typeof body.workspaceId !== "string") throw new Error("Missing Workspace.");
    await verifyWorkspaceOwner(accessToken, body.workspaceId);
    await revokeCalendarAccount(accessToken, body.workspaceId, slot);
    return NextResponse.json({ slot, connected: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Could not disconnect Calendar account." }, { status: 400 });
  }
}
