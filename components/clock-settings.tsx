"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  DEFAULT_CLOCK_TIMEZONES,
  supportedTimeZoneOptions,
  timeZoneDisplayName,
  type ClockTimeZones
} from "@/lib/workspace/timezones";

const CLOCK_LABELS = ["First clock", "Second clock", "Third clock"] as const;

export function ClockSettings() {
  const { clockTimeZones, clockPreferencesError, saveClockPreferences } = useWorkspace();
  const [draft, setDraft] = useState<ClockTimeZones>(clockTimeZones);
  const [options, setOptions] = useState<string[]>([...DEFAULT_CLOCK_TIMEZONES]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(clockTimeZones), [clockTimeZones]);
  useEffect(() => setOptions(supportedTimeZoneOptions(clockTimeZones)), [clockTimeZones]);

  const updateClock = (index: number, timeZone: string) => {
    setSaved(false);
    setDraft((current) => current.map((value, clockIndex) => clockIndex === index ? timeZone : value) as ClockTimeZones);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveClockPreferences(draft);
      setSaved(true);
    } catch {
      // The provider exposes the safe, user-facing persistence error below.
    } finally {
      setSaving(false);
    }
  };

  return <article className="card clock-settings-card">
    <h2>Header clocks</h2>
    <p className="muted">Choose three independent IANA time zones. These clocks do not change your primary Workspace timezone or any stored timestamp.</p>
    <form className="form-grid clock-settings-form" onSubmit={(event) => void handleSave(event)}>
      {CLOCK_LABELS.map((label, index) => <label key={label}>{label}
        <select value={draft[index]} onChange={(event) => updateClock(index, event.target.value)}>
          {options.map((timeZone) => <option value={timeZone} key={timeZone}>{timeZoneDisplayName(timeZone)} — {timeZone}</option>)}
        </select>
      </label>)}
      <div className="clock-settings-actions">
        <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save clocks"}</button>
        {saved ? <span className="success-copy" role="status">Clock preferences saved.</span> : null}
      </div>
      {clockPreferencesError ? <p className="error" role="alert">{clockPreferencesError}</p> : null}
    </form>
  </article>;
}
