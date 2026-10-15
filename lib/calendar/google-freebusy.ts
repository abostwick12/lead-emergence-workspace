import "server-only";

import { readCalendarCredential, type CalendarAccountSlot } from "@/lib/calendar/credentials";
import type { CalendarReadAdapter, TimeWindow } from "@/lib/sotf/scheduling";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FREE_BUSY_ENDPOINT = "https://www.googleapis.com/calendar/v3/freeBusy";
const READ_DEADLINE_MS = 4500;
const MAX_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

function isWindow(value: unknown): value is TimeWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as Partial<TimeWindow>;
  if (typeof window.start !== "string" || typeof window.end !== "string") return false;
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= MAX_WINDOW_MS;
}

function requiredGoogleConfiguration(): { clientId: string; clientSecret: string } {
  const clientId = process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google Calendar is not configured.");
  return { clientId, clientSecret };
}

function busyWindows(value: unknown, requested: TimeWindow): TimeWindow[] {
  if (!value || typeof value !== "object") throw new Error("Calendar response is unavailable.");
  const calendars = (value as { calendars?: unknown }).calendars;
  if (!calendars || typeof calendars !== "object" || Array.isArray(calendars)) throw new Error("Calendar response is unavailable.");
  const entries = Object.values(calendars);
  if (entries.length !== 1) throw new Error("Calendar response is unavailable.");
  const calendar = entries[0];
  if (!calendar || typeof calendar !== "object" || Array.isArray(calendar)) throw new Error("Calendar response is unavailable.");
  const result = calendar as { busy?: unknown; errors?: unknown };
  if ((result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length > 0)) ||
    !Array.isArray(result.busy) || result.busy.length > 200) {
    throw new Error("Calendar response is unavailable.");
  }
  const start = Date.parse(requested.start);
  const end = Date.parse(requested.end);
  return result.busy.map((item: unknown) => {
    if (!isWindow(item)) throw new Error("Calendar response is unavailable.");
    const busyStart = Date.parse(item.start);
    const busyEnd = Date.parse(item.end);
    if (busyStart < start || busyEnd > end) throw new Error("Calendar response is unavailable.");
    return { start: new Date(busyStart).toISOString(), end: new Date(busyEnd).toISOString() };
  });
}

/** Reads only busy windows from the authenticated account's primary calendar. */
export function googleCalendarReadAdapter(workspaceId: string, accountSlot: CalendarAccountSlot): CalendarReadAdapter {
  return {
    async readBusy(window) {
      const unavailable = { status: "unavailable" as const, reason: "Calendar availability could not be checked." };
      if (!isWindow(window)) return unavailable;
      try {
        const { clientId, clientSecret } = requiredGoogleConfiguration();
        const refreshToken = await readCalendarCredential(workspaceId, accountSlot);
        if (!refreshToken.trim()) return unavailable;
        const signal = AbortSignal.timeout(READ_DEADLINE_MS);
        const tokenResponse = await fetch(TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
          cache: "no-store",
          signal
        });
        if (!tokenResponse.ok) return unavailable;
        const token: unknown = await tokenResponse.json();
        const accessToken = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
        if (typeof accessToken !== "string" || !accessToken.trim()) return unavailable;

        const busyResponse = await fetch(FREE_BUSY_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ timeMin: window.start, timeMax: window.end, timeZone: "UTC", items: [{ id: "primary" }] }),
          cache: "no-store",
          signal
        });
        if (!busyResponse.ok) return unavailable;
        const busy = busyWindows(await busyResponse.json(), window);
        return { status: "available" as const, busy, checkedAt: new Date().toISOString(), source: "Google Calendar busy time" };
      } catch {
        return unavailable;
      }
    }
  };
}
