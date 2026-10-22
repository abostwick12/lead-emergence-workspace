import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { networkingSlotsForDate, type NetworkingMeetingType } from "@/lib/calendar/availability-slots";
import { claimCalendarAvailabilityRead } from "@/lib/calendar/availability-budget";
import { claimCalendarBooking, findCalendarBooking, finishCalendarBooking, type CalendarBookingReceipt } from "@/lib/calendar/booking-reservations";
import { insertGoogleCalendarEvent, readGoogleCalendarEvent, type GoogleEventInput } from "@/lib/calendar/google-events";
import { googleCalendarReadAdapter } from "@/lib/calendar/google-freebusy";
import { requireBothCalendarReads } from "@/lib/sotf/scheduling";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, max-age=0" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chicago = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
});

type BookingInput = {
  date: string;
  meetingType: NetworkingMeetingType;
  start: string;
  end: string;
  guestName: string;
  guestEmail: string;
  requestToken: string;
};

function result(status: "confirmed" | "unavailable" | "pending", httpStatus: number) {
  return NextResponse.json({ status }, { status: httpStatus, headers });
}

function chicagoToday(now: Date): string {
  const parts = Object.fromEntries(chicago.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseInput(value: unknown, now: Date): BookingInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    || (item.meetingType !== "networking_30" && item.meetingType !== "networking_60")
    || typeof item.start !== "string" || !utc.test(item.start)
    || typeof item.end !== "string" || !utc.test(item.end)
    || typeof item.guestName !== "string" || typeof item.guestEmail !== "string"
    || typeof item.requestToken !== "string" || !token.test(item.requestToken)) return null;
  const selected = Date.parse(`${item.date}T00:00:00Z`);
  const today = Date.parse(`${chicagoToday(now)}T00:00:00Z`);
  const start = Date.parse(item.start);
  const end = Date.parse(item.end);
  const name = item.guestName.trim();
  const guestEmail = item.guestEmail.trim().toLowerCase();
  if (!Number.isFinite(selected) || new Date(selected).toISOString().slice(0, 10) !== item.date
    || selected < today || selected - today > 60 * 24 * 60 * 60_000
    || !Number.isFinite(start) || !Number.isFinite(end)
    || new Date(start).toISOString() !== new Date(item.start).toISOString()
    || new Date(end).toISOString() !== new Date(item.end).toISOString()
    || end - start !== (item.meetingType === "networking_30" ? 30 : 60) * 60_000
    || name.length < 1 || name.length > 120 || /[\x00-\x1f\x7f]/.test(name)
    || guestEmail.length > 254 || !email.test(guestEmail)) return null;
  return {
    date: item.date,
    meetingType: item.meetingType,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    guestName: name,
    guestEmail,
    requestToken: item.requestToken.toLowerCase()
  };
}

async function slotIsStillFree(workspaceId: string, input: BookingInput): Promise<boolean> {
  if (!await claimCalendarAvailabilityRead(workspaceId).catch(() => false)) return false;
  const selected = Date.parse(`${input.date}T00:00:00Z`);
  const window = {
    start: new Date(selected - 12 * 60 * 60_000).toISOString(),
    end: new Date(selected + 36 * 60 * 60_000).toISOString()
  };
  const calendar = requireBothCalendarReads(
    googleCalendarReadAdapter(workspaceId, "personal"),
    googleCalendarReadAdapter(workspaceId, "business")
  );
  const calendarRead = await calendar.readBusy(window).catch(() => null);
  if (!calendarRead) return false;
  const grid = networkingSlotsForDate({
    date: input.date, meetingType: input.meetingType,
    now: new Date().toISOString(), calendarRead
  });
  return grid.status === "available" && grid.slots.some(slot => slot.start === input.start && slot.end === input.end);
}

function matchesReceipt(receipt: CalendarBookingReceipt, input: BookingInput): boolean {
  return receipt.meetingType === input.meetingType
    && receipt.startsAt === input.start && receipt.endsAt === input.end;
}

function eventInput(workspaceId: string, reservationId: string, input: BookingInput): GoogleEventInput {
  return {
    workspaceId, accountSlot: "personal", reservationId,
    start: input.start, end: input.end,
    title: `${input.meetingType === "networking_30" ? 30 : 60}-minute networking meeting with ${input.guestName}`,
    guestEmail: input.guestEmail, notificationPolicy: "all"
  };
}

/** Disabled-by-default public booking boundary; no confirmation without a stored event receipt. */
export async function POST(request: Request) {
  if (process.env.WORKSPACE_CALENDAR_BOOKING_ENABLED !== "true") return result("unavailable", 503);
  const workspaceId = process.env.WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID?.trim();
  if (!workspaceId || !uuid.test(workspaceId)) return result("unavailable", 503);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return result("unavailable", 400);
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 2048)) {
    return result("unavailable", 400);
  }
  let input: BookingInput | null;
  try {
    const reader = request.body?.getReader();
    if (!reader) return result("unavailable", 400);
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > 2048) {
        void reader.cancel().catch(() => {});
        return result("unavailable", 400);
      }
      chunks.push(value);
    }
    input = parseInput(JSON.parse(Buffer.concat(chunks).toString("utf8")), new Date());
  } catch {
    input = null;
  }
  if (!input) return result("unavailable", 400);

  const digest = createHash("sha256").update(JSON.stringify([
    workspaceId, input.requestToken, input.date, input.meetingType,
    input.start, input.end, input.guestName, input.guestEmail
  ])).digest("hex");
  let receipt: CalendarBookingReceipt | null;
  try {
    receipt = await findCalendarBooking({ workspaceId, requestDigest: digest });
  } catch {
    return result("pending", 503);
  }
  if (receipt && !matchesReceipt(receipt, input)) return result("unavailable", 409);
  if (receipt?.state === "confirmed") return result("confirmed", 200);
  if (receipt?.state === "released" || (receipt?.state === "held" && Date.parse(receipt.holdExpiresAt) <= Date.now())) {
    return result("unavailable", 409);
  }
  if (receipt?.state === "writing") {
    if (!await claimCalendarAvailabilityRead(workspaceId).catch(() => false)) return result("pending", 503);
    const existing = await readGoogleCalendarEvent(eventInput(workspaceId, receipt.reservationId, input)).catch(() => null);
    if (existing?.status !== "confirmed") return result("pending", 202);
    try {
      await finishCalendarBooking({ workspaceId, requestDigest: digest, reservationId: receipt.reservationId,
        expectedState: "writing", outcome: "confirmed", providerEventId: existing.eventId });
      return result("confirmed", 200);
    } catch {
      return result("pending", 202);
    }
  }

  if (!await slotIsStillFree(workspaceId, input)) {
    return receipt?.state === "held" ? result("pending", 202) : result("unavailable", 409);
  }
  let reservation;
  try {
    reservation = await claimCalendarBooking({
      workspaceId, requestDigest: digest, meetingType: input.meetingType,
      startsAt: input.start, endsAt: input.end
    });
  } catch {
    return result("unavailable", 409);
  }
  if (reservation.state === "confirmed") return result("confirmed", 200);
  if (reservation.state === "writing") return result("pending", 202);
  if (!await slotIsStillFree(workspaceId, input)) {
    try {
      await finishCalendarBooking({
        workspaceId, requestDigest: digest, reservationId: reservation.reservationId,
        expectedState: "held", outcome: "released"
      });
      return result("unavailable", 409);
    } catch {
      return result("pending", 202);
    }
  }

  let writer;
  try {
    writer = await claimCalendarBooking({
      workspaceId, requestDigest: digest, meetingType: input.meetingType,
      startsAt: input.start, endsAt: input.end, beginWrite: true
    });
  } catch {
    return result("pending", 202);
  }
  if (writer.state === "confirmed") return result("confirmed", 200);
  if (!writer.writeStarted) return result("pending", 202);

  const inserted = await insertGoogleCalendarEvent(eventInput(workspaceId, writer.reservationId, input))
    .catch(() => null);
  if (!inserted || inserted.status === "ambiguous") return result("pending", 202);
  try {
    const outcome = inserted.status === "confirmed" ? "confirmed" : "released";
    await finishCalendarBooking({
      workspaceId, requestDigest: digest, reservationId: writer.reservationId, outcome,
      expectedState: "writing",
      providerEventId: outcome === "confirmed" ? inserted.eventId : null
    });
    return outcome === "confirmed" ? result("confirmed", 200) : result("unavailable", 409);
  } catch {
    return result("pending", 202);
  }
}
