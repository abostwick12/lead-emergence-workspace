import { z } from 'zod';
import type { Command, PilotState } from './contracts';
import { requireRecord } from './intelligence';

const instant = z.string().datetime({ offset: true });
const windowSchema = z.object({ start: instant, end: instant }).refine(value => Date.parse(value.end) > Date.parse(value.start) && Date.parse(value.end) - Date.parse(value.start) <= 31 * 86400000, 'Use a positive time window no longer than 31 days.');
export const schedulingSchema = z.object({ offered: z.array(windowSchema).min(1).max(20), available: z.array(windowSchema).min(1).max(20), busy: z.array(windowSchema).max(200), calendarChecked: z.literal(true), checkedAt: instant, source: z.string().trim().min(1).max(240), timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Use a named time zone.'), durationMinutes: z.number().int().min(15).max(180), bufferMinutes: z.number().int().min(0).max(60).default(15) });
export type SchedulingInput = z.infer<typeof schedulingSchema>;
export type TimeWindow = z.infer<typeof windowSchema>;

/** A proposal from explicit availability, never a claim that a calendar invitation exists. */
export function proposeConversationTimes(input: SchedulingInput, now = new Date().toISOString()) {
  const value = schedulingSchema.parse(input);
  const current = Date.parse(now); const checked = Date.parse(value.checkedAt);
  if (checked > current + 60000 || current - checked > 86400000) throw new Error('Check your calendar again before proposing times.');
  const duration = value.durationMinutes * 60000; const buffer = value.bufferMinutes * 60000;
  const candidates = new Map<number,TimeWindow>();
  for (const offered of value.offered) for (const free of value.available) {
    const start = Math.max(Date.parse(offered.start), Date.parse(free.start) + buffer, current);
    const end = Math.min(Date.parse(offered.end), Date.parse(free.end) - buffer);
    // Five-minute alignment makes proposals useful while keeping explicit instants through DST changes.
    let found = 0;
    for (let at = Math.ceil(start / 300000) * 300000; at + duration <= end && found < 3;) {
      const conflict = value.busy.find(item => at < Date.parse(item.end) + buffer && at + duration > Date.parse(item.start) - buffer);
      if (conflict) { at = Math.ceil((Date.parse(conflict.end) + buffer) / 300000) * 300000; continue; }
      candidates.set(at, { start: new Date(at).toISOString(), end: new Date(at + duration).toISOString() }); found += 1; at += duration + buffer;
    }
  }
  const slots: TimeWindow[] = [];
  for (const slot of [...candidates.values()].sort((a,b) => Date.parse(a.start) - Date.parse(b.start))) {
    if (slots.every(existing => Date.parse(slot.start) >= Date.parse(existing.end) + buffer)) slots.push(slot);
    if (slots.length === 3) break;
  }
  return { slots, source: value.source, checkedAt: value.checkedAt, timeZone: value.timeZone, status: slots.length ? 'proposal' as const : 'no_overlap' as const, requiresAgreement: true as const };
}
export function formatSlot(slot: TimeWindow, timeZone: string) {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
  return format.format(new Date(slot.start)) + ' to ' + format.format(new Date(slot.end)) + ' (' + timeZone + ')';
}
export function invitationDraft(state: PilotState, meetingId: string): Command {
  const meeting = requireRecord(state.meetings, meetingId, 'Meeting');
  if (meeting.status !== 'accepted') throw new Error('Record the agreed meeting time before preparing its invitation.');
  if (!meeting.personId) throw new Error('Link the person before preparing an invitation.');
  const person = requireRecord(state.people, meeting.personId, 'Person');
  return { type: 'prepare_action', kind: 'calendar_invite', recipient: person.email ?? person.name, subject: meeting.title, personId: person.id, meetingId: meeting.id, body: 'Agreed conversation: ' + meeting.title + '\nStarts: ' + meeting.startsAt + '\nEnds: ' + meeting.endsAt + '\nTimes above are UTC.\nPurpose: ' + meeting.objective + '\n\nReview the recipient, local time, and meeting location/link in your calendar before sending. This draft has not created an event.' };
}

/** Future providers supply narrow operational results through the existing connection owner. No credentials live here. */
export interface CalendarReadAdapter {
  readBusy(window: TimeWindow): Promise<{ status: 'available'; busy: TimeWindow[]; checkedAt: string; source: string } | { status: 'unavailable'; reason: string }>;
}
export const manualCalendarAdapter: CalendarReadAdapter = { async readBusy() { return { status: 'unavailable', reason: 'Calendar reading is not connected in this pilot. Check availability in your calendar and enter it explicitly.' }; } };
export type ProviderExecutionReceipt = { status: 'completed'; providerRecordId: string; idempotencyKey: string } | { status: 'not_executed'; reason: string } | { status: 'uncertain'; reconciliationReference: string };
