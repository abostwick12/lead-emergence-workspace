"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ExternalLink } from "lucide-react";
import styles from "./scheduling.module.css";

const meetingTypes = [
  { value: "networking_30", label: "30-minute networking meeting", minutes: 30 },
  { value: "networking_60", label: "60-minute networking meeting", minutes: 60 }
] as const;

const baseTimeZones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];

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

export function AndrewCalendar({ currentBookingUrl, todayIso }: { currentBookingUrl: string | null; todayIso: string }) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const [month, setMonth] = useState(() => ownerScheduleMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<(typeof meetingTypes)[number]["value"]>("networking_30");
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const timeZones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return [...new Set([timeZone, ...baseTimeZones, ...supported])].sort((a, b) => a.localeCompare(b));
  }, [timeZone]);
  const days = useMemo(() => monthDays(month.getUTCFullYear(), month.getUTCMonth()), [month]);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const selectedMeeting = meetingTypes.find(type => type.value === meetingType) ?? meetingTypes[0];

  function changeMonth(delta: number) {
    setMonth(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
    setSelectedDate(null);
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
          <p className={styles.before}>You can share more context when you book.</p>
        </section>
        <section className={styles.scheduler} aria-label="Choose a meeting time">
          <div className={styles.controls}>
            <label>Meeting type
              <select value={meetingType} onChange={event => setMeetingType(event.target.value as (typeof meetingTypes)[number]["value"])}>
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
                return <button key={key} type="button" className={selectedDate === key ? styles.selectedDay : undefined} data-outside-month={!inMonth} aria-label={new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(day)} aria-pressed={selectedDate === key} onClick={() => { setSelectedDate(key); if (!inMonth) setMonth(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))); }}>{day.getUTCDate()}</button>;
              })}</div>
            </div>
            <div className={styles.times}>
              <h3>Available times</h3>
              <p className={styles.selectedDate}>{selectedDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedDate}T12:00:00Z`)) : "Select a date"}</p>
              <div className={styles.unavailable} role="status">Live availability is not connected yet. No time is being held or booked.</div>
            </div>
          </div>
          <div className={styles.footer}>
            <p>Booking will open here once the calendar connection is ready.</p>
            <button type="button" disabled>Continue <ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          {currentBookingUrl ? <p className={styles.fallback}>Need to book now? <a href={currentBookingUrl} target="_blank" rel="noreferrer">Use the current Google booking page <ExternalLink size={14} aria-hidden="true" /></a></p> : null}
        </section>
      </div>
    </div>
  </main>;
}
