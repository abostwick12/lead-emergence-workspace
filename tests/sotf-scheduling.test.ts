import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { commandEnvelopeSchema } from '@/lib/sotf/contracts';
import { applyCommand } from '@/lib/sotf/engine';
import { createPreviewState } from '@/lib/sotf/preview';
import { invitationDraft, manualCalendarAdapter, proposeConversationTimes, requireBothCalendarReads, type CalendarReadAdapter, type SchedulingInput, type TimeWindow } from '@/lib/sotf/scheduling';
const now = '2026-09-06T12:00:00.000Z';
const input: SchedulingInput = { offered: [{ start: '2026-09-07T09:00:00-05:00', end: '2026-09-07T12:00:00-05:00' }], available: [{ start: '2026-09-07T08:30:00-05:00', end: '2026-09-07T12:30:00-05:00' }], busy: [{ start: '2026-09-07T09:30:00-05:00', end: '2026-09-07T10:00:00-05:00' }], calendarChecked: true, checkedAt: now, source: 'Synthetic calendars explicitly checked', timeZone: 'America/Chicago', durationMinutes: 30, bufferMinutes: 15 };
describe('reviewed scheduling', () => {
  it('intersects both peoples availability and respects busy buffers without claiming booking', async () => {
    const result = proposeConversationTimes(input, now);
    expect(result.slots[0]).toEqual({ start: '2026-09-07T15:15:00.000Z', end: '2026-09-07T15:45:00.000Z' });
    expect(result.requiresAgreement).toBe(true); expect(result.slots).toHaveLength(2);
    expect((await manualCalendarAdapter.readBusy(input.offered[0])).status).toBe('unavailable');
  });
  it('keeps unknown availability and stale checks unresolved, and handles daylight-saving offsets', () => {
    expect(() => proposeConversationTimes({ ...input, calendarChecked: false } as never, now)).toThrow();
    expect(() => proposeConversationTimes({ ...input, checkedAt: '2026-09-01T12:00:00Z' }, now)).toThrow('Check your calendar');
    expect(proposeConversationTimes({ ...input, busy: input.available }, now).status).toBe('no_overlap');
    const fall = proposeConversationTimes({ ...input, offered: [{ start: '2026-11-01T01:00:00-05:00', end: '2026-11-01T01:30:00-06:00' }], available: [{ start: '2026-11-01T00:30:00-05:00', end: '2026-11-01T02:00:00-06:00' }], busy: [], checkedAt: '2026-11-01T04:00:00Z' }, '2026-11-01T04:00:00Z');
    expect(fall.slots[0].start).toBe('2026-11-01T06:00:00.000Z'); expect(fall.slots[1].start).toBe('2026-11-01T06:45:00.000Z');
  });
  it('supersedes an old invitation approval after a reschedule and reconciles uncertain sends first', () => {
    let state = createPreviewState();
    const run = (command: unknown) => { state = applyCommand(state, commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: 'ordinary_transition_operations', command }), now); };
    const meeting = state.meetings.find((item) => item.status === 'accepted' && item.personId)!;
    run(invitationDraft(state, meeting.id)); const original = state.actions.at(-1)!;
    run({ type: 'approve_action', actionId: original.id, exactRevision: 1 });
    const { debrief: _debrief, ...value } = meeting; void _debrief;
    run({ type: 'record_meeting', meeting: { ...value, startsAt: '2026-09-08T14:00:00Z', endsAt: '2026-09-08T14:30:00Z' } });
    expect(state.actions.find(item => item.id === original.id)?.state).toBe('superseded');
    expect(() => run({ type: 'record_action_result', actionId: original.id, outcome: 'manually_completed', receipt: 'Stale draft' })).toThrow('approved action');
    run(invitationDraft(state, meeting.id)); const second = state.actions.at(-1)!;
    run({ type: 'approve_action', actionId: second.id, exactRevision: 1 });
    run({ type: 'record_action_result', actionId: second.id, outcome: 'uncertain', receipt: 'Provider did not confirm' });
    run({ type: 'record_meeting', meeting: { ...value, status: 'cancelled' } });
    expect(state.actions.find(item => item.id === second.id)?.state).toBe('uncertain');
    run({ type: 'retry_action', actionId: second.id, confirmedNotExecuted: true });
    expect(state.actions.find(item => item.id === second.id)?.state).toBe('superseded');
    expect(() => invitationDraft(state, meeting.id)).toThrow('agreed meeting');
  });
});

describe('required dual-calendar read', () => {
  const start = Math.ceil((Date.now() + 86400000) / 3600000) * 3600000;
  const window: TimeWindow = { start: new Date(start).toISOString(), end: new Date(start + 7200000).toISOString() };
  const personalBusy: TimeWindow = { start: window.start, end: new Date(start + 3600000).toISOString() };
  const businessBusy: TimeWindow = { start: personalBusy.end, end: window.end };
  const available = (busy: TimeWindow[], checkedAt = new Date().toISOString()): CalendarReadAdapter => ({
    async readBusy() { return { status: 'available', busy, checkedAt, source: 'Private calendar details' }; },
  });

  it('reads the same window from both accounts and combines their conflicts without account details', async () => {
    const seen: TimeWindow[] = [];
    const olderCheck = new Date(Date.now() - 30000).toISOString();
    const personal: CalendarReadAdapter = { async readBusy(requested) { seen.push(requested); return available([personalBusy], olderCheck).readBusy(requested); } };
    const business: CalendarReadAdapter = { async readBusy(requested) { seen.push(requested); return available([businessBusy]).readBusy(requested); } };
    const result = await requireBothCalendarReads(personal, business).readBusy(window);
    expect(seen).toEqual([window, window]);
    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('Both calendars must be available.');
    expect(result.busy).toEqual([personalBusy, businessBusy]);
    expect(result.checkedAt).toBe(olderCheck);
    expect(result.source).toBe('Both calendars checked');
    expect(JSON.stringify(result)).not.toContain('Private calendar details');
    expect(proposeConversationTimes({ ...input, offered: [window], available: [window], busy: result.busy, checkedAt: result.checkedAt, bufferMinutes: 0 }, result.checkedAt).status).toBe('no_overlap');
  });

  it.each(['personal', 'business'] as const)('fails closed when the %s account is unavailable or throws', async missing => {
    const unavailable: CalendarReadAdapter = { async readBusy() { return { status: 'unavailable', reason: 'Account-specific detail' }; } };
    const throwing: CalendarReadAdapter = { readBusy() { throw new Error('Account-specific detail'); } };
    const rejecting: CalendarReadAdapter = { async readBusy() { throw new Error('Account-specific detail'); } };
    for (const failed of [unavailable, throwing, rejecting]) {
      const personal = missing === 'personal' ? failed : available([]);
      const business = missing === 'business' ? failed : available([]);
      expect(await requireBothCalendarReads(personal, business).readBusy(window)).toEqual({ status: 'unavailable', reason: 'Calendar availability could not be checked.' });
    }
  });

  it('fails closed on stale, missing, invalid, or out-of-window account evidence', async () => {
    const stale = available([], new Date(Date.now() - 61000).toISOString());
    const missingCheck: CalendarReadAdapter = { async readBusy() { return { status: 'available', busy: [], source: 'missing time' } as never; } };
    const invalidBusy = available([{ start: 'not-a-date', end: window.end }]);
    const outsideBusy = available([{ start: new Date(start - 1800000).toISOString(), end: new Date(start + 1800000).toISOString() }]);
    for (const bad of [stale, missingCheck, invalidBusy, outsideBusy]) {
      expect((await requireBothCalendarReads(available([]), bad).readBusy(window)).status).toBe('unavailable');
    }
    expect((await requireBothCalendarReads(available([]), available([])).readBusy({ start: window.end, end: window.start })).status).toBe('unavailable');
  });

  it('returns unavailable at the common deadline when one calendar never settles', async () => {
    vi.useFakeTimers();
    try {
      const pending: CalendarReadAdapter = { readBusy: () => new Promise(() => {}) };
      const result = requireBothCalendarReads(available([]), pending).readBusy(window);
      await vi.advanceTimersByTimeAsync(5000);
      expect(await result).toEqual({ status: 'unavailable', reason: 'Calendar availability could not be checked.' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns promptly when one calendar fails and the other never settles', async () => {
    const pending: CalendarReadAdapter = { readBusy: () => new Promise(() => {}) };
    const failed: CalendarReadAdapter = { async readBusy() { return { status: 'unavailable', reason: 'Private failure' }; } };
    const result = await Promise.race([
      requireBothCalendarReads(failed, pending).readBusy(window),
      new Promise(resolve => setTimeout(() => resolve('Still waiting'), 100)),
    ]);
    expect(result).toEqual({ status: 'unavailable', reason: 'Calendar availability could not be checked.' });
  });

  it('rejects one future check even if the other check is current', async () => {
    const future = available([], new Date(Date.now() + 61000).toISOString());
    expect((await requireBothCalendarReads(available([]), future).readBusy(window)).status).toBe('unavailable');
  });

  it('measures check freshness when both reads complete', async () => {
    vi.useFakeTimers();
    try {
      const base = Date.now();
      vi.setSystemTime(base);
      const checkedAt = new Date(base - 59000).toISOString();
      const delayed: CalendarReadAdapter = {
        readBusy: () => new Promise(resolve => setTimeout(() => resolve({ status: 'available', busy: [], checkedAt, source: 'Synthetic' }), 2000)),
      };
      const result = requireBothCalendarReads(available([], checkedAt), delayed).readBusy(window);
      await vi.advanceTimersByTimeAsync(2000);
      expect((await result).status).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });
});
