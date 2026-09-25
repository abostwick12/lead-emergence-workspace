import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { networkingBookingConfiguration, networkingSchedulingHandoff } from "@/lib/sotf/booking";

describe("SOTF branded networking booking configuration", () => {
  it("accepts Google Appointment Schedule URLs and returns only the branded URL to networking", () => {
    const short = networkingBookingConfiguration(
      "https://calendar.app.google/syntheticBookingPage",
      "https://workspace.leademergence.com"
    );
    expect(short).toEqual({
      status: "ready",
      publicUrl: "https://workspace.leademergence.com/meet/andrew",
      targetUrl: "https://calendar.app.google/syntheticBookingPage"
    });
    expect(networkingSchedulingHandoff(short)).toEqual({
      status: "ready",
      publicUrl: "https://workspace.leademergence.com/meet/andrew"
    });

    expect(networkingBookingConfiguration(
      "https://calendar.google.com/calendar/appointments/schedules/synthetic",
      "http://127.0.0.1:3100"
    )).toMatchObject({ status: "ready", publicUrl: "http://127.0.0.1:3100/meet/andrew" });
  });

  it("fails clearly and safely when the booking target is absent or invalid", () => {
    expect(networkingBookingConfiguration(undefined, "https://workspace.leademergence.com")).toEqual({
      status: "unavailable",
      message: expect.stringContaining("not configured")
    });
    expect(networkingBookingConfiguration("http://calendar.app.google/not-secure", "https://workspace.leademergence.com")).toEqual({
      status: "unavailable",
      message: expect.stringContaining("HTTPS")
    });
    expect(networkingBookingConfiguration("https://example.org/not-google", "https://workspace.leademergence.com")).toEqual({
      status: "unavailable",
      message: expect.stringContaining("Google Calendar Appointment Schedule")
    });
  });
});
