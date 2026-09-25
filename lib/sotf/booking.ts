import "server-only";

export const NETWORKING_SCHEDULING_PATH = "/meet/andrew";

export type NetworkingBookingConfiguration =
  | { status: "ready"; publicUrl: string; targetUrl: string }
  | { status: "unavailable"; message: string };

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function googleAppointmentUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Use the approved HTTPS Google Appointment Schedule URL.");
  }
  const shortBookingPage = url.hostname === "calendar.app.google" && url.pathname !== "/";
  const fullBookingPage = url.hostname === "calendar.google.com" && url.pathname.startsWith("/calendar/appointments/schedules/");
  if (!shortBookingPage && !fullBookingPage) {
    throw new Error("Use a Google Calendar Appointment Schedule booking-page URL.");
  }
  return url.toString();
}

function workspaceOrigin(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Workspace scheduling origin must be an origin without credentials or a path.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new Error("Workspace scheduling origin must use HTTPS outside local development.");
  }
  return url.origin;
}

export function networkingBookingConfiguration(
  target = process.env.SOTF_NETWORKING_BOOKING_URL,
  origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://workspace.leademergence.com"
): NetworkingBookingConfiguration {
  if (!target?.trim()) {
    return { status: "unavailable", message: "Networking scheduling is not configured. Add the approved Google Appointment Schedule URL before preparing a scheduling reply." };
  }
  try {
    return {
      status: "ready",
      publicUrl: new URL(NETWORKING_SCHEDULING_PATH, workspaceOrigin(origin.trim())).toString(),
      targetUrl: googleAppointmentUrl(target.trim())
    };
  } catch (error) {
    return { status: "unavailable", message: error instanceof Error ? error.message : "Networking scheduling configuration is invalid." };
  }
}

export function networkingSchedulingHandoff(configuration: NetworkingBookingConfiguration) {
  return configuration.status === "ready"
    ? { status: "ready" as const, publicUrl: configuration.publicUrl }
    : configuration;
}
