import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { readCredential } = vi.hoisted(() => ({ readCredential: vi.fn() }));
vi.mock("@/lib/calendar/credentials", () => ({ readCalendarCredential: readCredential }));

import { googleEventId, insertGoogleCalendarEvent, readGoogleCalendarEvent, type GoogleEventInput } from "@/lib/calendar/google-events";

const input: GoogleEventInput = {
  workspaceId: "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  accountSlot: "personal",
  reservationId: "b1111111-1111-4111-8111-111111111111",
  start: "2026-10-20T14:00:00Z",
  end: "2026-10-20T14:30:00Z",
  title: "Networking conversation",
  guestEmail: "guest@example.com",
  notificationPolicy: "all"
};

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function event(forInput: GoogleEventInput = input, changes: Record<string, unknown> = {}) {
  return {
    id: googleEventId(forInput.reservationId),
    summary: forInput.title,
    organizer: { email: forInput.accountSlot === "personal" ? "andrew.w.bostwick12@gmail.com" : "andrew@leademergence.com" },
    start: { dateTime: forInput.start },
    end: { dateTime: forInput.end },
    attendees: [{ email: forInput.guestEmail }],
    ...changes
  };
}

describe("Google Calendar event adapter", () => {
  beforeEach(() => {
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
    readCredential.mockResolvedValue("synthetic-refresh");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    readCredential.mockReset();
    delete process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("uses the exact organizer slot, stable ID, explicit notification policy, and no location", async () => {
    const business: GoogleEventInput = { ...input, accountSlot: "business", notificationPolicy: "externalOnly" };
    const fetchMock = vi.fn(async (url: string, _options: RequestInit) => url.endsWith("/token")
      ? response(200, { access_token: "synthetic-access" }) : response(200, event(business)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await insertGoogleCalendarEvent(business);
    expect(result).toEqual({ status: "confirmed", eventId: googleEventId(input.reservationId) });
    expect(googleEventId(input.reservationId.toUpperCase())).toBe(result.eventId);
    expect(result.eventId).toMatch(/^le[0-9a-f]{64}$/);
    expect(readCredential).toHaveBeenCalledWith(input.workspaceId, "business");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=externalOnly");
    expect(options.method).toBe("POST");
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body as string)).toEqual({
      id: result.eventId, summary: input.title,
      start: { dateTime: input.start }, end: { dateTime: input.end },
      attendees: [{ email: input.guestEmail }]
    });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-(?:access|refresh|secret)/);
  });

  it("recovers a matching duplicate with an exact-ID read", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(409, { error: "duplicate" }))
      .mockResolvedValueOnce(response(200, event()));
    vi.stubGlobal("fetch", fetchMock);
    expect(await insertGoogleCalendarEvent(input)).toEqual({ status: "confirmed", eventId: googleEventId(input.reservationId) });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId(input.reservationId)}`);
    expect(fetchMock.mock.calls[2][1].method).toBeUndefined();
  });

  it("checks an uncertain event by exact ID without inserting again", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(200, event()));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readGoogleCalendarEvent(input)).toEqual({ status: "confirmed", eventId: googleEventId(input.reservationId) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId(input.reservationId)}`);
    expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
  });

  it("distinguishes an absent event from an uncertain or mismatched read", async () => {
    const absent = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(404, {}));
    vi.stubGlobal("fetch", absent);
    expect((await readGoogleCalendarEvent(input)).status).toBe("absent");

    const mismatch = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(200, event(input, { organizer: { email: "wrong@example.com" } })));
    vi.stubGlobal("fetch", mismatch);
    expect((await readGoogleCalendarEvent(input)).status).toBe("ambiguous");

    const timeout = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockRejectedValueOnce(new Error("private timeout detail"));
    vi.stubGlobal("fetch", timeout);
    expect((await readGoogleCalendarEvent(input)).status).toBe("ambiguous");
  });

  it("keeps a duplicate or timeout ambiguous when the read-back does not match", async () => {
    for (const wrong of [
      { organizer: { email: "another@example.com" } },
      { end: { dateTime: "2026-10-20T15:00:00Z" } },
      { attendees: [{ email: "another@example.com" }] },
      { location: "A different place" }
    ]) {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
        .mockResolvedValueOnce(response(409, { error: "duplicate" }))
        .mockResolvedValueOnce(response(200, event(input, wrong)));
      vi.stubGlobal("fetch", fetchMock);
      expect((await insertGoogleCalendarEvent(input)).status).toBe("ambiguous");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }
    const timedOut = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockRejectedValueOnce(new Error("synthetic timeout with secret detail"))
      .mockResolvedValueOnce(response(404, {}));
    vi.stubGlobal("fetch", timedOut);
    expect(await insertGoogleCalendarEvent(input)).toEqual({ status: "ambiguous", eventId: googleEventId(input.reservationId) });
    expect(timedOut).toHaveBeenCalledTimes(3);
  });

  it("reads back a malformed success and does not blindly insert twice", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(200, { id: "wrong" }))
      .mockResolvedValueOnce(response(200, event()));
    vi.stubGlobal("fetch", fetchMock);
    expect((await insertGoogleCalendarEvent(input)).status).toBe("confirmed");
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(2); // token + one insert
  });

  it("fails before insert on missing credentials or definite provider rejection", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    readCredential.mockRejectedValueOnce(new Error("private token detail"));
    expect((await insertGoogleCalendarEvent(input)).status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(200, { access_token: "synthetic-access" }))
      .mockResolvedValueOnce(response(403, { error: "forbidden" }));
    expect((await insertGoogleCalendarEvent(input)).status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid requests before credential access or network calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const change of [
      { reservationId: "bad" }, { workspaceId: "bad" }, { guestEmail: "not-an-email" },
      { end: input.start }, { start: "not-a-date" }, { title: "  padded" },
      { notificationPolicy: undefined }, { accountSlot: "unknown" }
    ]) {
      await expect(insertGoogleCalendarEvent({ ...input, ...change } as GoogleEventInput)).rejects.toThrow();
    }
    expect(readCredential).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
