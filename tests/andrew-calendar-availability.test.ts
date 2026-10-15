import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calendar = vi.hoisted(() => ({
  slots: [] as string[],
  fail: null as string | null
}));

vi.mock("@/lib/calendar/google-freebusy", () => ({
  googleCalendarReadAdapter: (_workspaceId: string, slot: string) => ({
    async readBusy() {
      calendar.slots.push(slot);
      if (calendar.fail === slot) return { status: "unavailable", reason: "Calendar unavailable" };
      const busy = slot === "personal"
        ? [{ start: "2026-10-19T14:00:00.000Z", end: "2026-10-19T14:30:00.000Z" }]
        : [{ start: "2026-10-19T14:30:00.000Z", end: "2026-10-19T15:00:00.000Z" }];
      return { status: "available", busy, checkedAt: new Date().toISOString(), source: "Google Calendar busy time" };
    }
  })
}));

import { GET } from "@/app/api/meet/andrew/availability/route";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const endpoint = "http://localhost/api/meet/andrew/availability";

function request(date = "2026-10-19", meetingType = "networking_30") {
  return new Request(`${endpoint}?date=${date}&meetingType=${meetingType}`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  vi.stubEnv("WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID", workspaceId);
  calendar.slots = [];
  calendar.fail = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("public Andrew availability", () => {
  it("excludes busy times from both accounts and returns candidate times only", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(calendar.slots).toEqual(["personal", "business"]);
    const result = await response.json();
    expect(result.status).toBe("available");
    expect(result.slots).not.toContainEqual({ start: "2026-10-19T14:00:00.000Z", end: "2026-10-19T14:30:00.000Z" });
    expect(result.slots).not.toContainEqual({ start: "2026-10-19T14:30:00.000Z", end: "2026-10-19T15:00:00.000Z" });
    expect(result.slots).toContainEqual({ start: "2026-10-19T15:00:00.000Z", end: "2026-10-19T15:30:00.000Z" });
    expect(JSON.stringify(result)).not.toMatch(/personal|business|busy|workspace/i);
  });

  it("returns no slots when either account cannot be checked", async () => {
    calendar.fail = "business";
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(calendar.slots).toEqual(["personal", "business"]);
  });

  it("uses the selected meeting length when returning candidate times", async () => {
    const response = await GET(request("2026-10-19", "networking_60"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.slots).toContainEqual({ start: "2026-10-19T15:00:00.000Z", end: "2026-10-19T16:00:00.000Z" });
    expect(result.slots).not.toContainEqual({ start: "2026-10-19T15:00:00.000Z", end: "2026-10-19T15:30:00.000Z" });
    expect(calendar.slots).toEqual(["personal", "business"]);
  });

  it("does not read accounts without a valid private owner Workspace setting", async () => {
    vi.stubEnv("WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID", "wrong-workspace");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(calendar.slots).toEqual([]);
  });

  it("rejects invalid meeting types and dates before reading accounts", async () => {
    const wrongType = await GET(request("2026-10-19", "consulting_30"));
    const wrongDate = await GET(request("2026-10-40"));
    const pastDate = await GET(request("2026-10-14"));
    expect([wrongType.status, wrongDate.status, pastDate.status]).toEqual([400, 400, 400]);
    expect(calendar.slots).toEqual([]);
  });
});
