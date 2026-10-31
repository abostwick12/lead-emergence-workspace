import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { networkingSlotsForDate } from "../lib/calendar/availability-slots";

const now = "2026-10-12T12:00:00.000Z";
const checked = "2026-10-12T11:59:30.000Z";
const clear = { status: "available" as const, busy: [], checkedAt: checked, source: "Both calendars checked" };

describe("Networking calendar slot grid", () => {
  it("matches the approved half-hour and hourly Chicago starts", () => {
    const short = networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_30", now, calendarRead: clear });
    const long = networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_60", now, calendarRead: clear });
    expect(short.status).toBe("available");
    expect(short.slots).toHaveLength(16);
    expect(short.slots[0]).toEqual({ start: "2026-10-15T14:00:00.000Z", end: "2026-10-15T14:30:00.000Z" });
    expect(short.slots.at(-1)).toEqual({ start: "2026-10-15T21:30:00.000Z", end: "2026-10-15T22:00:00.000Z" });
    expect(long.slots).toHaveLength(8);
    expect(long.slots.at(-1)).toEqual({ start: "2026-10-15T21:00:00.000Z", end: "2026-10-15T22:00:00.000Z" });
  });

  it("uses Chicago winter time and excludes weekends", () => {
    const winterNow = "2027-01-11T12:00:00.000Z";
    const winterRead = { ...clear, checkedAt: winterNow };
    const weekday = networkingSlotsForDate({ date: "2027-01-15", meetingType: "networking_30", now: winterNow, calendarRead: winterRead });
    expect(weekday.slots[0].start).toBe("2027-01-15T15:00:00.000Z");
    expect(networkingSlotsForDate({ date: "2027-01-16", meetingType: "networking_30", now: winterNow, calendarRead: winterRead })).toEqual({ status: "available", slots: [] });
  });

  it("omits overlapping slots without a buffer or daily cap", () => {
    const busy = [{ start: "2026-10-15T14:45:00.000Z", end: "2026-10-15T15:15:00.000Z" }];
    const short = networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_30", now, calendarRead: { ...clear, busy } });
    const long = networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_60", now, calendarRead: { ...clear, busy } });
    expect(short.slots).toHaveLength(14);
    expect(short.slots.some(slot => slot.start === "2026-10-15T14:30:00.000Z")).toBe(false);
    expect(short.slots.some(slot => slot.start === "2026-10-15T15:00:00.000Z")).toBe(false);
    expect(long.slots).toHaveLength(6);
  });

  it("applies four-hour notice and a rolling 60-day horizon", () => {
    const sameDayNow = "2026-10-15T14:00:00.000Z";
    const sameDayRead = { ...clear, checkedAt: sameDayNow };
    const sameDay = networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_30", now: sameDayNow, calendarRead: sameDayRead });
    expect(sameDay.slots[0].start).toBe("2026-10-15T18:00:00.000Z");
    const horizonNow = "2026-10-12T18:00:00.000Z";
    const boundary = networkingSlotsForDate({ date: "2026-12-11", meetingType: "networking_30", now: horizonNow, calendarRead: { ...clear, checkedAt: horizonNow } });
    expect(boundary.slots).toHaveLength(7);
    expect(boundary.slots.at(-1)?.start).toBe("2026-12-11T18:00:00.000Z");
    expect(networkingSlotsForDate({ date: "2026-12-15", meetingType: "networking_30", now, calendarRead: clear })).toEqual({ status: "available", slots: [] });
  });

  it("fails closed on missing, stale, malformed, or single-account reads", () => {
    for (const calendarRead of [
      { status: "unavailable" as const, reason: "Missing account" },
      { ...clear, source: "Google Calendar busy time" },
      { ...clear, checkedAt: "2026-10-12T11:58:59.000Z" },
      { ...clear, busy: [{ start: "bad", end: "2026-10-15T15:00:00.000Z" }] }
    ]) {
      expect(networkingSlotsForDate({ date: "2026-10-15", meetingType: "networking_30", now, calendarRead })).toEqual({ status: "unavailable", slots: [] });
    }
    expect(networkingSlotsForDate({ date: "2026-02-30", meetingType: "networking_30", now, calendarRead: clear })).toEqual({ status: "unavailable", slots: [] });
  });
});
