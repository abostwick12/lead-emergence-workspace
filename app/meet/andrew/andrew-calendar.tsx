"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ExternalLink } from "lucide-react";
import styles from "./scheduling.module.css";

const meetingTypes = [
  { value: "networking_30", label: "30-minute networking meeting", minutes: 30 },
  { value: "networking_60", label: "60-minute networking meeting", minutes: 60 }
] as const;

const baseTimeZones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
type AvailableSlot = { start: string; end: string };
type Availability = { key: string; status: "loading" | "available" | "unavailable"; slots: AvailableSlot[] };
type BookingResult = "confirmed" | "unavailable" | "pending" | null;

function isAvailableSlots(value: unknown): value is AvailableSlot[] {
  return Array.isArray(value) && value.length <= 16 && value.every(slot =>
    slot && typeof slot === "object" && typeof slot.start === "string" && typeof slot.end === "string" &&
    Number.isFinite(Date.parse(slot.start)) && Number.isFinite(Date.parse(slot.end)) &&
    Date.parse(slot.end) > Date.parse(slot.start)
  );
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthDays(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstDay + dayCount) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => new Date(Date.UTC(year, month, index - firstDay + 1)));
}

function timeZoneLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("/", " / ");
}

function ownerScheduleMonth(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "numeric" }).formatToParts(instant);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function AndrewCalendar({ currentBookingUrl, todayIso, bookingEnabled }: {
  currentBookingUrl: string | null;
  todayIso: string;
  bookingEnabled: boolean;
}) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const chicagoTodayParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(today).map(part => [part.type, part.value]));
  const todayKey = `${chicagoTodayParts.year}-${chicagoTodayParts.month}-${chicagoTodayParts.day}`;
  const lastDateKey = dateKey(new Date(Date.parse(`${todayKey}T00:00:00Z`) + 60 * 24 * 60 * 60 * 1000));
  const [month, setMonth] = useState(() => ownerScheduleMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<(typeof meetingTypes)[number]["value"]>("networking_30");
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult>(null);
  const submission = useRef<{ key: string; token: string } | null>(null);
  const timeZones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return [...new Set([timeZone, ...baseTimeZones, ...supported])].sort((a, b) => a.localeCompare(b));
  }, [timeZone]);
  const days = useMemo(() => monthDays(month.getUTCFullYear(), month.getUTCMonth()), [month]);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const selectedMeeting = meetingTypes.find(type => type.value === meetingType) ?? meetingTypes[0];
  const availabilityKey = selectedDate ? `${selectedDate}:${meetingType}` : null;
  const visibleAvailability = availability?.key === availabilityKey ? availability : null;
  const slotFormatter = useMemo(() => new Intl.DateTimeFormat("en-US", {
    timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }), [timeZone]);

  useEffect(() => {
    if (!selectedDate || !availabilityKey) return;
    const controller = new AbortController();
    setAvailability({ key: availabilityKey, status: "loading", slots: [] });
    const query = new URLSearchParams({ date: selectedDate, meetingType });
    void fetch(`/api/meet/andrew/availability?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload: unknown = await response.json();
        if (!response.ok || !payload || typeof payload !== "object") throw new Error("Availability unavailable");
        const result = payload as { status?: unknown; slots?: unknown };
        if (result.status !== "available" || !isAvailableSlots(result.slots)) throw new Error("Availability unavailable");
        if (!controller.signal.aborted) setAvailability({ key: availabilityKey, status: "available", slots: result.slots });
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability({ key: availabilityKey, status: "unavailable", slots: [] });
      });
    return () => controller.abort();
  }, [availabilityKey, meetingType, selectedDate]);

  function clearSelection() {
    setSelectedSlot(null);
    setShowGuestForm(false);
    setBookingResult(null);
    submission.current = null;
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingEnabled || !selectedDate || !selectedSlot || submitting || bookingResult === "confirmed") return;
    const name = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    if (!name || !email) return;
    const key = JSON.stringify([selectedDate, meetingType, selectedSlot.start, selectedSlot.end, name, email]);
    if (submission.current?.key !== key) submission.current = { key, token: crypto.randomUUID() };
    setSubmitting(true);
    setBookingResult(null);
    try {
      const response = await fetch("/api/meet/andrew/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          date: selectedDate, meetingType, start: selectedSlot.start, end: selectedSlot.end,
          guestName: name, guestEmail: email, requestToken: submission.current.token
        })
      });
      const payload: unknown = await response.json();
      const status = payload && typeof payload === "object" ? (payload as { status?: unknown }).status : null;
      setBookingResult(status === "confirmed" || status === "unavailable" || status === "pending" ? status : "pending");
    } catch {
      // The request may have reached the server. Keep the same token for a retry.
      setBookingResult("pending");
    } finally {
      setSubmitting(false);
    }
  }

  function changeMonth(delta: number) {
    setMonth(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
    setSelectedDate(null);
    clearSelection();
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.brand}>
        <span className={styles.mark}>LE</span><span>Lead Emergence</span><span className={styles.path}>/meet/andrew</span>
      </header>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="booking-title">
          <p className={styles.eyebrow}>Conversation</p>
          <h1 id="booking-title">Book time<br />with Andrew</h1>
          <p className={styles.lede}>Pick 30 or 60 minutes, then choose a time that works.</p>
          <div className={styles.introRule} />
          <div className={styles.detail}><Clock3 aria-hidden="true" size={21} /><div><strong>{selectedMeeting.minutes} minutes</strong><span>{selectedMeeting.label}</span></div></div>
          <div className={styles.detail}><CalendarDays aria-hidden="true" size={21} /><div><strong>Your time zone</strong><span>Times will appear in {timeZoneLabel(timeZone)}.</span></div></div>
        </section>
        <section className={styles.scheduler} aria-label="Choose a meeting time">
          <div className={styles.controls}>
            <label>Meeting type
              <select value={meetingType} onChange={event => { setMeetingType(event.target.value as (typeof meetingTypes)[number]["value"]); clearSelection(); }}>
                {meetingTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>Time zone
              <select value={timeZone} onChange={event => setTimeZone(event.target.value)}>
                {timeZones.map(zone => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.calendarHeader}>
            <h2>{monthLabel}</h2>
            <div className={styles.monthActions}>
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ArrowLeft size={18} /></button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ArrowRight size={18} /></button>
            </div>
          </div>
          <div className={styles.calendarAndTimes}>
            <div className={styles.calendar}>
              <div className={styles.weekdays}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}</div>
              <div className={styles.days}>{days.map(day => {
                const key = dateKey(day);
                const inMonth = day.getUTCMonth() === month.getUTCMonth();
                return <button key={key} type="button" disabled={key < todayKey || key > lastDateKey || submitting} className={selectedDate === key ? styles.selectedDay : undefined} data-outside-month={!inMonth} aria-label={new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(day)} aria-pressed={selectedDate === key} onClick={() => { setSelectedDate(key); clearSelection(); if (!inMonth) setMonth(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))); }}>{day.getUTCDate()}</button>;
              })}</div>
            </div>
            <div className={styles.times}>
              <h3>Available times</h3>
              <p className={styles.selectedDate}>{selectedDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedDate}T12:00:00Z`)) : "Select a date"}</p>
              {!selectedDate ? <div className={styles.unavailable} role="status">Select a date to see available times.</div>
                : !visibleAvailability || visibleAvailability.status === "loading" ? <div className={styles.unavailable} role="status">Checking availability…</div>
                : visibleAvailability.status === "unavailable" ? <div className={styles.unavailable} role="status">Availability cannot be checked right now.</div>
                : visibleAvailability.slots.length === 0 ? <div className={styles.unavailable} role="status">No times available on this date.</div>
                : <ul className={styles.slotList} aria-label="Available times">{visibleAvailability.slots.map(slot =>
                    <li key={slot.start} className={bookingEnabled ? styles.selectableSlot : undefined}>{bookingEnabled
                      ? <button type="button" disabled={submitting || bookingResult === "confirmed"} className={selectedSlot?.start === slot.start ? styles.selectedSlot : undefined} aria-pressed={selectedSlot?.start === slot.start} onClick={() => { setSelectedSlot(slot); setShowGuestForm(false); setBookingResult(null); submission.current = null; }}>{slotFormatter.formatRange(new Date(slot.start), new Date(slot.end))}</button>
                      : slotFormatter.formatRange(new Date(slot.start), new Date(slot.end))}</li>
                  )}</ul>}
            </div>
          </div>
          {bookingEnabled && showGuestForm && selectedSlot ? <form className={styles.guestForm} onSubmit={event => void submitBooking(event)}>
            <h3>Your details</h3>
            <p>{slotFormatter.formatRange(new Date(selectedSlot.start), new Date(selectedSlot.end))} · {selectedMeeting.minutes} minutes</p>
            <div className={styles.guestFields}>
              <label>Name<input required maxLength={120} autoComplete="name" value={guestName} onChange={event => setGuestName(event.target.value)} disabled={submitting || bookingResult === "confirmed"} /></label>
              <label>Email<input required type="email" maxLength={254} autoComplete="email" value={guestEmail} onChange={event => setGuestEmail(event.target.value)} disabled={submitting || bookingResult === "confirmed"} /></label>
            </div>
            <button type="submit" disabled={submitting || bookingResult === "confirmed" || bookingResult === "unavailable"}>{submitting ? "Checking this time…" : bookingResult === "pending" ? "Check booking again" : "Book this time"}</button>
            {bookingResult === "confirmed" ? <p className={styles.bookingResult} role="status">Your meeting is booked.</p> : null}
            {bookingResult === "unavailable" ? <p className={styles.bookingResult} role="status">That time is no longer available. Choose another time.</p> : null}
            {bookingResult === "pending" ? <p className={styles.bookingResult} role="status">We couldn&apos;t confirm the booking yet. Use the same details to check again.</p> : null}
          </form> : null}
          <div className={styles.footer}>
            <p>{bookingEnabled ? selectedSlot ? "Add your details to book this time." : "Choose a time to continue." : "This page doesn’t book meetings yet."}</p>
            <button type="button" disabled={!bookingEnabled || !selectedSlot || showGuestForm || submitting || bookingResult === "confirmed"} onClick={() => setShowGuestForm(true)}>Continue <ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          {currentBookingUrl ? <p className={styles.fallback}>Need to book now? <a href={currentBookingUrl} target="_blank" rel="noreferrer">Use the current Google booking page <ExternalLink size={14} aria-hidden="true" /></a></p> : null}
        </section>
      </div>
    </div>
  </main>;
}
