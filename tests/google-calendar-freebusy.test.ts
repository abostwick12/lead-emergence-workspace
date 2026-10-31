import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { readCredential } = vi.hoisted(() => ({ readCredential: vi.fn() }));
vi.mock("@/lib/calendar/credentials", () => ({ readCalendarCredential: readCredential }));

import { googleCalendarReadAdapter } from "@/lib/calendar/google-freebusy";
import { requireBothCalendarReads, type TimeWindow } from "@/lib/sotf/scheduling";

const workspaceId = "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const window: TimeWindow = { start: "2026-10-20T14:00:00Z", end: "2026-10-20T18:00:00Z" };
const personalBusy = { start: "2026-10-20T14:00:00Z", end: "2026-10-20T15:00:00Z" };
const businessBusy = { start: "2026-10-20T17:00:00Z", end: "2026-10-20T18:00:00Z" };

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("Google Calendar free/busy adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    readCredential.mockReset();
    delete process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("refreshes each exact-slot credential and combines the two primary calendars", async () => {
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
    readCredential.mockImplementation(async (_workspace: string, slot: string) => `refresh-${slot}`);
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/token")) {
        const form = options.body as URLSearchParams;
        return response({ access_token: `access-${form.get("refresh_token")}` });
      }
      const auth = (options.headers as Record<string, string>).Authorization;
      return response({ calendars: { primary: { busy: [auth.includes("personal") ? personalBusy : businessBusy] } } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requireBothCalendarReads(
      googleCalendarReadAdapter(workspaceId, "personal"),
      googleCalendarReadAdapter(workspaceId, "business")
    ).readBusy(window);

    expect(readCredential.mock.calls).toEqual([[workspaceId, "personal"], [workspaceId, "business"]]);
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("Both calendars must be available.");
    expect(result.busy).toEqual([
      { start: "2026-10-20T14:00:00.000Z", end: "2026-10-20T15:00:00.000Z" },
      { start: "2026-10-20T17:00:00.000Z", end: "2026-10-20T18:00:00.000Z" }
    ]);
    expect(result.source).toBe("Both calendars checked");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(options.cache).toBe("no-store");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      if (url.endsWith("/freeBusy")) {
        expect(JSON.parse(options.body as string)).toEqual({ timeMin: window.start, timeMax: window.end, timeZone: "UTC", items: [{ id: "primary" }] });
      }
    }
  });

  it("fails closed when configuration or either credential is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await googleCalendarReadAdapter(workspaceId, "personal").readBusy(window)).status).toBe("unavailable");
    expect(readCredential).not.toHaveBeenCalled();
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
    readCredential.mockRejectedValueOnce(new Error("private credential detail"));
    expect(await googleCalendarReadAdapter(workspaceId, "business").readBusy(window)).toEqual({ status: "unavailable", reason: "Calendar availability could not be checked." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects provider errors and malformed or out-of-window busy intervals", async () => {
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
    readCredential.mockResolvedValue("synthetic-refresh");
    for (const busyBody of [
      { calendars: { primary: { errors: [{ reason: "notFound" }], busy: [] } } },
      { calendars: { primary: { errors: "provider-error", busy: [] } } },
      { calendars: { primary: { busy: [{ start: "bad", end: window.end }] } } },
      { calendars: { primary: { busy: [{ start: "2026-10-20T13:00:00Z", end: window.end }] } } },
      { calendars: { primary: { busy: "not-an-array" } } }
    ]) {
      const fetchMock = vi.fn().mockResolvedValueOnce(response({ access_token: "synthetic-access" })).mockResolvedValueOnce(response(busyBody));
      vi.stubGlobal("fetch", fetchMock);
      expect((await googleCalendarReadAdapter(workspaceId, "personal").readBusy(window)).status).toBe("unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it("does not call Google for an invalid requested window or a failed token refresh", async () => {
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
    process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
    readCredential.mockResolvedValue("synthetic-refresh");
    const fetchMock = vi.fn().mockResolvedValue(response({ error: "invalid_grant" }, false));
    vi.stubGlobal("fetch", fetchMock);
    expect((await googleCalendarReadAdapter(workspaceId, "personal").readBusy({ start: window.end, end: window.start })).status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await googleCalendarReadAdapter(workspaceId, "personal").readBusy(window)).status).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
