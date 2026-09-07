import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { commandEnvelopeSchema } from '@/lib/sotf/contracts';
import { applyCommand } from '@/lib/sotf/engine';
import { createPreviewState } from '@/lib/sotf/preview';
import { invitationDraft, manualCalendarAdapter, proposeConversationTimes, type SchedulingInput } from '@/lib/sotf/scheduling';
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
    const meeting = state.meetings[0];
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
