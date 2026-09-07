'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Command, Person } from '@/lib/sotf/contracts';
import { formatSlot, proposeConversationTimes, type TimeWindow } from '@/lib/sotf/scheduling';
import styles from './sotf.module.css';

export function ScheduleConversation({ person, onSave, onClose }: { person: Person; onSave: (command: Command) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<ReturnType<typeof proposeConversationTimes> | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setProposal(null);
    try {
      const data = new FormData(event.currentTarget);
      const iso = (key: string) => new Date(String(data.get(key))).toISOString();
      if (data.get('checked') !== 'on') throw new Error('Check your calendar before proposing times.');
      const conflicts: TimeWindow[] = data.get('busyStart') ? [{ start: iso('busyStart'), end: iso('busyEnd') }] : [];
      setProposal(proposeConversationTimes({ offered: [{ start: iso('offeredStart'), end: iso('offeredEnd') }], available: [{ start: iso('availableStart'), end: iso('availableEnd') }], busy: conflicts, calendarChecked: true, checkedAt: new Date().toISOString(), source: String(data.get('source')), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, durationMinutes: Number(data.get('duration')), bufferMinutes: Number(data.get('buffer')) }));
    } catch (caught) { setError(caught instanceof Error && !('issues' in caught) ? caught.message : 'Review the times and confirm your calendar check.'); }
  }
  async function save() {
    if (!proposal?.slots.length) return; setBusy(true); setError('');
    try {
      await onSave({ type: 'prepare_action', kind: 'email', recipient: person.email ?? person.name, personId: person.id, subject: 'Times for our conversation', body: 'Hi ' + person.name + ',\n\nThank you for being open to a conversation about ' + person.objective + '. Would one of these times work?\n\n' + proposal.slots.map(slot => formatSlot(slot, proposal.timeZone)).join('\n') + '\n\nPlease confirm the time that works for you. I will then prepare the invitation.\n\nAvailability checked: ' + proposal.source + ' at ' + proposal.checkedAt });
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not verify this draft.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="schedule-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}><header className={styles.dialogHeader}><h2 id="schedule-title">Find a time with {person.name}</h2><button onClick={onClose} disabled={busy} aria-label="Close scheduling">×</button></header><p>Start with a positive reply. Check your calendar, then enter a window you can offer. Times use your device&apos;s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Nothing is sent or booked.</p><form className={styles.form} onSubmit={review} onChange={() => setProposal(null)}>
    <label>Availability source<input name="source" required maxLength={240} placeholder="Their reply and my calendar, checked today" /></label>
    <fieldset><legend>The window they offered</legend><label>Offered start<input name="offeredStart" type="datetime-local" required /></label><label>Offered end<input name="offeredEnd" type="datetime-local" required /></label></fieldset>
    <fieldset><legend>Your available window</legend><label>I can start<input name="availableStart" type="datetime-local" required /></label><label>I must finish<input name="availableEnd" type="datetime-local" required /></label><label>Busy from (optional)<input name="busyStart" type="datetime-local" /></label><label>Busy until (optional)<input name="busyEnd" type="datetime-local" /></label></fieldset>
    <label>Conversation minutes<input name="duration" type="number" min="15" max="180" defaultValue="30" required /></label><label>Buffer minutes<input name="buffer" type="number" min="0" max="60" defaultValue="15" required /></label>
    <label><input name="checked" type="checkbox" required />I checked all my calendars and personal boundaries. This window is available apart from the busy time entered.</label><button className={styles.primary} disabled={busy}>Find useful times</button>
  </form>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{proposal ? <section><h3>{proposal.slots.length ? 'Review these proposed times' : 'No shared time within these boundaries'}</h3>{proposal.slots.map(slot => <p key={slot.start}>{formatSlot(slot, proposal.timeZone)}</p>)}{proposal.slots.length ? <button className={styles.primary} disabled={busy} onClick={() => void save()}>Save scheduling draft for review</button> : <p>Ask for another window or adjust your availability deliberately.</p>}</section> : null}</dialog>;
}
