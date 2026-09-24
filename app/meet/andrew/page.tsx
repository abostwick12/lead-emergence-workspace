import type { Metadata } from "next";
import { CalendarDays, ExternalLink } from "lucide-react";
import { networkingBookingConfiguration } from "@/lib/sotf/booking";
import styles from "./scheduling.module.css";

export const metadata: Metadata = {
  title: "Conversation with Andrew Bostwick · Lead Emergence",
  description: "Choose a time for an informal conversation with Andrew Bostwick.",
  robots: { index: false, follow: false }
};

export default function AndrewSchedulingPage() {
  const booking = networkingBookingConfiguration();
  return <main className={styles.page}>
    <section className={styles.card}>
      <header className={styles.brand}><span className={styles.mark}>LE</span><span>Lead Emergence</span></header>
      <p className={styles.eyebrow}>Informal conversation</p>
      <h1>Conversation with Andrew Bostwick</h1>
      <p className={styles.lede}>A chance to learn about your work, experience, and perspective—without a formal agenda or sales pitch.</p>
      <div className={styles.timezone}><CalendarDays aria-hidden="true" size={20} /><p>Google will show available times in your local timezone and handle the booking.</p></div>
      {booking.status === "ready" ? <a className={styles.action} href={booking.targetUrl} target="_blank" rel="noreferrer">View available times in Google Calendar <ExternalLink aria-hidden="true" size={18} /></a> : <p className={styles.unavailable} role="status">Scheduling is temporarily unavailable. Please return to the conversation and arrange a time directly.</p>}
      <p className={styles.note}>Availability, conflicts, confirmation, and the calendar invitation are managed by Google Calendar.</p>
    </section>
  </main>;
}
