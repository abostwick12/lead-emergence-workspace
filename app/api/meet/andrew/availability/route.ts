import { NextResponse } from "next/server";
import { networkingSlotsForDate, type NetworkingMeetingType } from "@/lib/calendar/availability-slots";
import { googleCalendarReadAdapter } from "@/lib/calendar/google-freebusy";
import { requireBothCalendarReads } from "@/lib/sotf/scheduling";

export const dynamic = "force-dynamic";

const ownerWorkspacePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dayMs = 24 * 60 * 60 * 1000;
const headers = { "Cache-Control": "no-store, max-age=0" };
const chicagoDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
});

function chicagoDateKey(now: Date): string {
  const parts = Object.fromEntries(chicagoDateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDateKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const instant = Date.UTC(year, month - 1, day);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

function validMeetingType(value: string | null): value is NetworkingMeetingType {
  return value === "networking_30" || value === "networking_60";
}

/** Public candidate times only; a later booking must recheck both calendars. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const meetingType = params.get("meetingType");
  if (!validDateKey(date) || !validMeetingType(meetingType)) {
    return NextResponse.json({ status: "unavailable" }, { status: 400, headers });
  }

  const now = new Date();
  const today = Date.parse(`${chicagoDateKey(now)}T00:00:00Z`);
  const selected = Date.parse(`${date}T00:00:00Z`);
  if (selected < today || selected - today > 60 * dayMs) {
    return NextResponse.json({ status: "unavailable" }, { status: 400, headers });
  }

  const workspaceId = process.env.WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID?.trim();
  if (!workspaceId || !ownerWorkspacePattern.test(workspaceId)) {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }

  // This UTC window fully contains the selected Chicago day, including DST changes.
  const window = {
    start: new Date(selected - 12 * 60 * 60 * 1000).toISOString(),
    end: new Date(selected + 36 * 60 * 60 * 1000).toISOString()
  };
  const calendar = requireBothCalendarReads(
    googleCalendarReadAdapter(workspaceId, "personal"),
    googleCalendarReadAdapter(workspaceId, "business")
  );
  const calendarRead = await calendar.readBusy(window);
  const result = networkingSlotsForDate({ date, meetingType, now: new Date().toISOString(), calendarRead });
  if (result.status !== "available") {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
  return NextResponse.json({ status: "available", slots: result.slots }, { headers });
}
