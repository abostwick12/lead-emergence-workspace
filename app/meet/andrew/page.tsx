import type { Metadata } from "next";
import { connection } from "next/server";
import { networkingBookingConfiguration } from "@/lib/sotf/booking";
import { AndrewCalendar } from "./andrew-calendar";

export const metadata: Metadata = {
  title: "Book time with Andrew · Lead Emergence",
  description: "Choose a time to talk with Andrew Bostwick.",
  robots: { index: false, follow: false }
};

export default async function AndrewSchedulingPage() {
  await connection();
  const booking = networkingBookingConfiguration();
  return <AndrewCalendar currentBookingUrl={booking.status === "ready" ? booking.targetUrl : null} todayIso={new Date().toISOString()} />;
}
