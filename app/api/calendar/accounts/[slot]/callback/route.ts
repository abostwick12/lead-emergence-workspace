import { NextRequest, NextResponse } from "next/server";
import {
  CALENDAR_FLOW_COOKIE, calendarApplicationOrigin, calendarStateHash, exchangeAndVerifyCalendarCode, finishCalendarAccount,
  isCalendarSlot, readCalendarFlow
} from "@/lib/calendar/oauth";
import { readCalendarAttemptToken } from "@/lib/calendar/credentials";
import { verifyWorkspaceOwner } from "@/lib/integrations/server";

export const runtime = "nodejs";

function finish(slot: string, status: "connected" | "error") {
  const url = new URL("/workspace/integrations", calendarApplicationOrigin());
  url.searchParams.set("calendar", slot);
  url.searchParams.set("status", status);
  const response = NextResponse.redirect(url);
  response.cookies.set(CALENDAR_FLOW_COOKIE, "", {
    httpOnly: true, maxAge: 0, path: "/api/calendar/accounts",
    sameSite: "lax", secure: process.env.NODE_ENV === "production"
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (!isCalendarSlot(slot)) return finish(slot, "error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const sealed = request.cookies.get(CALENDAR_FLOW_COOKIE)?.value;
  try {
    if (!code || !state || !sealed || request.nextUrl.searchParams.has("error")) throw new Error("Authorization was not completed.");
    const flow = readCalendarFlow(sealed, slot, state);
    const stateHash = calendarStateHash(state);
    const accessToken = await readCalendarAttemptToken(flow.workspaceId, slot, stateHash);
    await verifyWorkspaceOwner(accessToken, flow.workspaceId);
    // Google authorization codes are single-use; replayed callbacks cannot exchange the code again.
    const credential = await exchangeAndVerifyCalendarCode({ code, flow });
    await finishCalendarAccount({ accessToken, workspaceId: flow.workspaceId, slot, stateHash, ...credential });
    return finish(slot, "connected");
  } catch {
    return finish(slot, "error");
  }
}
