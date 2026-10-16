import "server-only";

import { createHash } from "node:crypto";
import { readCalendarCredential, type CalendarAccountSlot } from "@/lib/calendar/credentials";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEADLINE_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORGANIZER: Record<CalendarAccountSlot, string> = {
  personal: "andrew.w.bostwick12@gmail.com",
  business: "andrew@leademergence.com"
};

export type GoogleEventInput = {
  workspaceId: string;
  accountSlot: CalendarAccountSlot;
  reservationId: string;
  start: string;
  end: string;
  title: string;
  guestEmail: string;
  notificationPolicy: "all" | "externalOnly" | "none";
};

export type GoogleEventResult = {
  status: "confirmed" | "failed" | "ambiguous";
  eventId: string;
};

/** A retry for the same reservation addresses one Google event ID. */
export function googleEventId(reservationId: string): string {
  if (!UUID.test(reservationId)) throw new Error("Invalid Calendar reservation.");
  return `le${createHash("sha256").update(reservationId.toLowerCase()).digest("hex")}`;
}

function validateInput(input: GoogleEventInput): void {
  const start = Date.parse(input.start);
  const end = Date.parse(input.end);
  if (!UUID.test(input.workspaceId) || !Object.hasOwn(ORGANIZER, input.accountSlot)
    || !input.start.endsWith("Z") || !input.end.endsWith("Z")
    || !Number.isFinite(start) || !Number.isFinite(end)
    || ![30, 60].includes((end - start) / 60000)
    || input.title !== input.title.trim() || !input.title || input.title.length > 200
    || /[\r\n]/.test(input.title) || !EMAIL.test(input.guestEmail)
    || !["all", "externalOnly", "none"].includes(input.notificationPolicy)) {
    throw new Error("Invalid Calendar event request.");
  }
}

function matchesEvent(value: unknown, input: GoogleEventInput, eventId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const event = value as {
    id?: unknown; summary?: unknown; status?: unknown; location?: unknown;
    organizer?: { email?: unknown }; start?: { dateTime?: unknown }; end?: { dateTime?: unknown };
    attendees?: unknown;
  };
  const start = typeof event.start?.dateTime === "string" ? Date.parse(event.start.dateTime) : NaN;
  const end = typeof event.end?.dateTime === "string" ? Date.parse(event.end.dateTime) : NaN;
  if (event.id !== eventId || event.summary !== input.title || event.status === "cancelled"
    || (event.location !== undefined && event.location !== "")
    || typeof event.organizer?.email !== "string"
    || event.organizer.email.toLowerCase() !== ORGANIZER[input.accountSlot]
    || start !== Date.parse(input.start) || end !== Date.parse(input.end)
    || !Array.isArray(event.attendees) || event.attendees.length !== 1) return false;
  const guest = event.attendees[0] as { email?: unknown } | null;
  return typeof guest?.email === "string" && guest.email.toLowerCase() === input.guestEmail.toLowerCase();
}

async function readBack(accessToken: string, input: GoogleEventInput, eventId: string): Promise<GoogleEventResult> {
  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(DEADLINE_MS)
    });
    if (response.ok && matchesEvent(await response.json(), input, eventId)) {
      return { status: "confirmed", eventId };
    }
  } catch {
    // A failed read cannot prove that the insert did not happen.
  }
  return { status: "ambiguous", eventId };
}

/** Server-only event write. No caller may release a reservation after an ambiguous result. */
export async function insertGoogleCalendarEvent(input: GoogleEventInput): Promise<GoogleEventResult> {
  validateInput(input);
  const eventId = googleEventId(input.reservationId);
  const clientId = process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { status: "failed", eventId };

  let accessToken: string;
  try {
    const refreshToken = await readCalendarCredential(input.workspaceId, input.accountSlot);
    if (!refreshToken.trim()) return { status: "failed", eventId };
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      cache: "no-store",
      signal: AbortSignal.timeout(DEADLINE_MS)
    });
    if (!response.ok) return { status: "failed", eventId };
    const token: unknown = await response.json();
    const value = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
    if (typeof value !== "string" || !value.trim()) return { status: "failed", eventId };
    accessToken = value;
  } catch {
    return { status: "failed", eventId };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}?sendUpdates=${input.notificationPolicy}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: eventId,
        summary: input.title,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
        attendees: [{ email: input.guestEmail }]
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DEADLINE_MS)
    });
    if (response.ok && matchesEvent(await response.json(), input, eventId)) return { status: "confirmed", eventId };
    if (response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status)) {
      return { status: "failed", eventId };
    }
  } catch {
    // A timeout or malformed success response may follow a completed insert.
  }
  return readBack(accessToken, input, eventId);
}
