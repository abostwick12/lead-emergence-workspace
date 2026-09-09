import { z } from "zod";
import { namedTimeZone } from "./executive";

const instant = z.iso.datetime({ offset: true });
export const executiveTimeWindow = z.object({ start: instant, end: instant }).strict().refine(
  w => Date.parse(w.end) > Date.parse(w.start) && Date.parse(w.end) - Date.parse(w.start) <= 31 * 86400000,
  "Use a positive window no longer than 31 days.");
export const executiveSchedulingInput = z.object({
  offered: z.array(executiveTimeWindow).min(1).max(20),
  available: z.array(executiveTimeWindow).min(1).max(20),
  busy: z.array(executiveTimeWindow).max(200),
  checkedAt: instant, source: z.string().trim().min(1).max(240), confirmAvailabilityChecked: z.literal(true),
  timeZone: namedTimeZone, durationMinutes: z.number().int().min(5).max(480), bufferMinutes: z.number().int().min(0).max(120)
}).strict();
export const executiveSchedulingResult = z.object({
  status: z.enum(["proposal", "no_overlap"]), slots: z.array(executiveTimeWindow).max(3),
  source: z.string(), checkedAt: instant, timeZone: z.string(), requiresAgreement: z.literal(true), calendarBooked: z.literal(false)
}).strict();
export function proposeExecutiveTimes(raw: unknown, now = new Date().toISOString()) {
  const input = executiveSchedulingInput.parse(raw), current = Date.parse(instant.parse(now)), checked = Date.parse(input.checkedAt);
  if (checked > current + 60000 || current - checked > 86400000) throw new Error("Recheck availability before proposing times.");
  const duration = input.durationMinutes * 60000, buffer = input.bufferMinutes * 60000;
  const candidates = new Set<number>();
  for (const offered of input.offered) for (const available of input.available) {
    const start = Math.max(Date.parse(offered.start), Date.parse(available.start) + buffer, current);
    const end = Math.min(Date.parse(offered.end), Date.parse(available.end) - buffer);
    let found = 0;
    for (let at = Math.ceil(start / 300000) * 300000; at + duration <= end && found < 3;) {
      const conflict = input.busy.find(w => at < Date.parse(w.end) + buffer && at + duration > Date.parse(w.start) - buffer);
      if (conflict) { at = Math.ceil((Date.parse(conflict.end) + buffer) / 300000) * 300000; continue; }
      candidates.add(at); found++; at += duration + buffer;
    }
  }
  const slots: { start: string; end: string }[] = [];
  for (const at of [...candidates].sort((a, b) => a - b)) {
    if (slots.every(s => at >= Date.parse(s.end) + buffer)) slots.push({ start: new Date(at).toISOString(), end: new Date(at + duration).toISOString() });
    if (slots.length === 3) break;
  }
  return executiveSchedulingResult.parse({ status: slots.length ? "proposal" : "no_overlap", slots,
    source: input.source, checkedAt: input.checkedAt, timeZone: input.timeZone, requiresAgreement: true, calendarBooked: false });
}
