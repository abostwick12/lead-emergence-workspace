import "server-only";

import type { CalendarReadAdapter, TimeWindow } from "@/lib/sotf/scheduling";

export type NetworkingMeetingType = "networking_30" | "networking_60";
type CalendarRead = Awaited<ReturnType<CalendarReadAdapter["readBusy"]>>;
type SlotGrid = { status: "available"; slots: TimeWindow[] } | { status: "unavailable"; slots: [] };

const CHICAGO = "America/Chicago";
const MIN_NOTICE_MS = 4 * 60 * 60 * 1000;
const MAX_HORIZON_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_BUSY_MS = 31 * 24 * 60 * 60 * 1000;
const unavailable: SlotGrid = { status: "unavailable", slots: [] };

const chicagoFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23"
});

function chicagoWallTime(instant: number): number {
  const parts = Object.fromEntries(chicagoFormatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

function chicagoInstant(year: number, month: number, day: number, hour: number, minute: number): number {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const difference = wallTime - chicagoWallTime(instant);
    instant += difference;
    if (difference === 0) break;
  }
  return chicagoWallTime(instant) === wallTime ? instant : Number.NaN;
}

function chicagoDate(value: string): { year: number; month: number; day: number; weekday: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) return null;
  return { year, month, day, weekday: date.getUTCDay() };
}

function validBusyWindow(value: unknown): value is TimeWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as Partial<TimeWindow>;
  if (typeof window.start !== "string" || typeof window.end !== "string") return false;
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= MAX_BUSY_MS;
}

/** Candidate times only. A booking must check both calendars again before any provider write. */
export function networkingSlotsForDate(input: {
  date: string;
  meetingType: NetworkingMeetingType;
  now: string;
  calendarRead: CalendarRead;
}): SlotGrid {
  const date = chicagoDate(input.date);
  const now = Date.parse(input.now);
  const read = input.calendarRead;
  if (!date || !Number.isFinite(now) || !read || read.status !== "available"
    || read.source !== "Both calendars checked" || !Array.isArray(read.busy) || read.busy.length > 200
    || read.busy.some(window => !validBusyWindow(window))) return unavailable;

  const checked = Date.parse(read.checkedAt);
  if (!Number.isFinite(checked) || checked < now - 60000 || checked > now + 60000) return unavailable;
  if (input.meetingType !== "networking_30" && input.meetingType !== "networking_60") return unavailable;
  if (date.weekday === 0 || date.weekday === 6) return { status: "available", slots: [] };

  const minutes = input.meetingType === "networking_30" ? 30 : 60;
  const starts = minutes === 30 ? [0, 30] : [0];
  const slots: TimeWindow[] = [];
  for (let hour = 9; hour < 17; hour += 1) {
    for (const minute of starts) {
      const start = chicagoInstant(date.year, date.month, date.day, hour, minute);
      if (!Number.isFinite(start)) return unavailable;
      const end = start + minutes * 60000;
      if (start < now + MIN_NOTICE_MS || start > now + MAX_HORIZON_MS) continue;
      if (read.busy.some(window => start < Date.parse(window.end) && end > Date.parse(window.start))) continue;
      slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
  }
  return { status: "available", slots };
}
