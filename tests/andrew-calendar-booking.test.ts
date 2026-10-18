import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const model = vi.hoisted(() => ({
  budgetAllowed: true,
  budgetClaims: [] as string[],
  calendarReads: [] as string[],
  busy: [] as { start: string; end: string }[],
  calendarFailure: null as string | null,
  failReadAt: null as number | null,
  claimFailure: false,
  finishFailure: false,
  raceToWritingOnHeldFinish: false,
  receipt: null as null | {
    reservationId: string; state: "held" | "writing" | "confirmed" | "released";
    meetingType: "networking_30" | "networking_60"; startsAt: string; endsAt: string; holdExpiresAt: string;
  },
  claims: [] as boolean[],
  finishes: [] as string[],
  finishExpectedStates: [] as string[],
  insertCalls: 0,
  insertStatus: "confirmed" as "confirmed" | "failed" | "ambiguous",
  readCalls: 0,
  readStatus: "absent" as "confirmed" | "absent" | "ambiguous"
}));

vi.mock("@/lib/calendar/availability-budget", () => ({
  claimCalendarAvailabilityRead: async (workspaceId: string) => {
    model.budgetClaims.push(workspaceId);
    return model.budgetAllowed;
  }
}));

vi.mock("@/lib/calendar/google-freebusy", () => ({
  googleCalendarReadAdapter: (_workspaceId: string, accountSlot: string) => ({
    async readBusy() {
      model.calendarReads.push(accountSlot);
      if (model.calendarFailure === accountSlot || model.failReadAt === model.calendarReads.length) {
        return { status: "unavailable", reason: "private Google error" };
      }
      return { status: "available", busy: model.busy, checkedAt: new Date().toISOString(), source: "Google Calendar busy time" };
    }
  })
}));

vi.mock("@/lib/calendar/booking-reservations", () => ({
  findCalendarBooking: async () => model.receipt,
  claimCalendarBooking: async (input: { beginWrite?: boolean; meetingType: "networking_30" | "networking_60"; startsAt: string; endsAt: string }) => {
    model.claims.push(input.beginWrite === true);
    if (model.claimFailure) throw new Error("private database error");
    if (!model.receipt) model.receipt = {
      reservationId: "b1111111-1111-4111-8111-111111111111", state: "held",
      meetingType: input.meetingType, startsAt: input.startsAt, endsAt: input.endsAt,
      holdExpiresAt: "2026-10-19T16:00:00.000Z"
    };
    const writeStarted = input.beginWrite === true && model.receipt.state === "held";
    if (writeStarted) model.receipt.state = "writing";
    return { ...model.receipt, writeStarted };
  },
  finishCalendarBooking: async (input: { expectedState: "held" | "writing"; outcome: "confirmed" | "released" }) => {
    model.finishes.push(input.outcome);
    model.finishExpectedStates.push(input.expectedState);
    if (model.raceToWritingOnHeldFinish && input.expectedState === "held" && model.receipt?.state === "held") {
      model.receipt.state = "writing";
    }
    if (model.finishFailure) throw new Error("private database error");
    if (!model.receipt || model.receipt.state !== input.expectedState) throw new Error("claim state changed");
    model.receipt.state = input.outcome;
    return input.outcome;
  }
}));

vi.mock("@/lib/calendar/google-events", () => ({
  insertGoogleCalendarEvent: async () => {
    model.insertCalls += 1;
    return { status: model.insertStatus, eventId: "synthetic-event-id" };
  },
  readGoogleCalendarEvent: async () => {
    model.readCalls += 1;
    return { status: model.readStatus, eventId: "synthetic-event-id" };
  }
}));

import { POST } from "@/app/api/meet/andrew/book/route";

const workspaceId = "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const booking = {
  date: "2026-10-19", meetingType: "networking_30",
  start: "2026-10-19T15:00:00.000Z", end: "2026-10-19T15:30:00.000Z",
  guestName: "  Test Guest  ", guestEmail: " Guest@Example.com ",
  requestToken: "b1111111-1111-4111-8111-111111111111"
};

function request(value: unknown = booking) {
  return new Request("http://localhost/api/meet/andrew/book", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value)
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  vi.stubEnv("WORKSPACE_CALENDAR_BOOKING_ENABLED", "true");
  vi.stubEnv("WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID", workspaceId);
  model.budgetAllowed = true;
  model.budgetClaims = [];
  model.calendarReads = [];
  model.busy = [];
  model.calendarFailure = null;
  model.failReadAt = null;
  model.claimFailure = false;
  model.finishFailure = false;
  model.raceToWritingOnHeldFinish = false;
  model.receipt = null;
  model.claims = [];
  model.finishes = [];
  model.finishExpectedStates = [];
  model.insertCalls = 0;
  model.insertStatus = "confirmed";
  model.readCalls = 0;
  model.readStatus = "absent";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("disabled-by-default Andrew booking", () => {
  it("never reads Calendar or reservations when the release switch is off", async () => {
    vi.stubEnv("WORKSPACE_CALENDAR_BOOKING_ENABLED", "false");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(model.budgetClaims).toEqual([]);
    expect(model.claims).toEqual([]);
    expect(model.insertCalls).toBe(0);
  });

  it("rejects malformed or stale input before any Calendar call", async () => {
    for (const value of [
      { ...booking, requestToken: "guessable" },
      { ...booking, date: "2026-10-14" },
      { ...booking, guestEmail: "bad-email" },
      { ...booking, guestName: "Bad\nName" },
      { ...booking, meetingType: "consulting_30" }
    ]) {
      expect((await POST(request(value))).status).toBe(400);
    }
    expect(model.budgetClaims).toEqual([]);
    expect(model.claims).toEqual([]);
  });

  it("rejects declared and streamed oversized bodies before any Calendar call", async () => {
    const declared = new Request("http://localhost/api/meet/andrew/book", {
      method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "2049" }, body: "{}"
    });
    expect((await POST(declared)).status).toBe(400);

    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(2049));
      }
    }, { highWaterMark: 0 });
    const streamed = new Request("http://localhost/api/meet/andrew/book", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half"
    } as RequestInit & { duplex: "half" });
    expect((await POST(streamed)).status).toBe(400);
    expect(pulls).toBe(1);
    expect(model.budgetClaims).toEqual([]);
    expect(model.claims).toEqual([]);
    expect(model.insertCalls).toBe(0);
  });

  it("checks both calendars twice and confirms only after the event receipt is stored", async () => {
    expect(process.env.WORKSPACE_CALENDAR_BOOKING_ENABLED).toBe("true");
    expect(process.env.WORKSPACE_CALENDAR_OWNER_WORKSPACE_ID).toBe(workspaceId);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "confirmed" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(model.budgetClaims).toEqual([workspaceId, workspaceId]);
    expect(model.calendarReads).toEqual(["personal", "business", "personal", "business"]);
    expect(model.claims).toEqual([false, true]);
    expect(model.insertCalls).toBe(1);
    expect(model.finishes).toEqual(["confirmed"]);
  });

  it("releases a held slot when the second Calendar check fails before provider write", async () => {
    model.failReadAt = 4;
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(model.claims).toEqual([false]);
    expect(model.finishes).toEqual(["released"]);
    expect(model.finishExpectedStates).toEqual(["held"]);
    expect(model.receipt?.state).toBe("released");
    expect(model.insertCalls).toBe(0);
  });

  it("keeps a failed hold release pending instead of claiming the slot is free", async () => {
    model.failReadAt = 4;
    model.finishFailure = true;
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(model.claims).toEqual([false]);
    expect(model.finishes).toEqual(["released"]);
    expect(model.receipt?.state).toBe("held");
    expect(model.insertCalls).toBe(0);
  });

  it("keeps a writing claim pending when another exact retry wins the pre-write release race", async () => {
    model.failReadAt = 4;
    model.raceToWritingOnHeldFinish = true;
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(model.claims).toEqual([false]);
    expect(model.finishExpectedStates).toEqual(["held"]);
    expect(model.receipt?.state).toBe("writing");
    expect(model.insertCalls).toBe(0);
  });

  it("returns an existing confirmation after a lost HTTP response without another Google call", async () => {
    expect((await POST(request())).status).toBe(200);
    const retry = await POST(request());
    expect(await retry.json()).toEqual({ status: "confirmed" });
    expect(model.insertCalls).toBe(1);
    expect(model.budgetClaims).toHaveLength(2);
    expect(model.claims).toEqual([false, true]);
  });

  it("resolves a writing receipt by read-only exact-event check", async () => {
    model.receipt = {
      reservationId: "b1111111-1111-4111-8111-111111111111", state: "writing",
      meetingType: "networking_30", startsAt: booking.start, endsAt: booking.end,
      holdExpiresAt: "2026-10-19T16:00:00.000Z"
    };
    model.readStatus = "confirmed";
    const response = await POST(request());
    expect(await response.json()).toEqual({ status: "confirmed" });
    expect(model.readCalls).toBe(1);
    expect(model.insertCalls).toBe(0);
    expect(model.finishes).toEqual(["confirmed"]);
    expect(model.calendarReads).toEqual([]);
  });

  it("keeps an ambiguous write pending and never starts a second provider write", async () => {
    model.insertStatus = "ambiguous";
    const first = await POST(request());
    expect(first.status).toBe(202);
    expect(model.receipt?.state).toBe("writing");
    const retry = await POST(request());
    expect(await retry.json()).toEqual({ status: "pending" });
    expect(model.insertCalls).toBe(1);
    expect(model.readCalls).toBe(1);
    expect(model.finishes).toEqual([]);
  });

  it("stops before claiming when either Calendar fails, budget is denied, or the slot is stale", async () => {
    model.calendarFailure = "business";
    expect((await POST(request())).status).toBe(409);
    expect(model.claims).toEqual([]);
    model.calendarFailure = null;
    model.budgetAllowed = false;
    expect((await POST(request())).status).toBe(409);
    expect(model.calendarReads).toEqual(["personal", "business"]);
    model.budgetAllowed = true;
    model.busy = [{ start: booking.start, end: booking.end }];
    expect((await POST(request())).status).toBe(409);
    expect(model.claims).toEqual([]);
  });

  it("does not issue an event when the reservation conflicts or Google definitely rejects it", async () => {
    model.claimFailure = true;
    expect((await POST(request())).status).toBe(409);
    expect(model.insertCalls).toBe(0);
    model.claimFailure = false;
    model.insertStatus = "failed";
    expect((await POST(request())).status).toBe(409);
    expect(model.finishes).toEqual(["released"]);
  });

  it("returns only a sanitized status on every response", async () => {
    const response = await POST(request());
    expect(JSON.stringify(await response.json())).not.toMatch(/Test Guest|Guest@Example|caaaaaaa|synthetic-event-id/);
  });
});
