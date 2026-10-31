import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AndrewCalendar } from "@/app/meet/andrew/andrew-calendar";

describe("Andrew calendar time zones", () => {
  it("offers zones beyond the four US defaults while the booking switch is off", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-10-13T18:00:00.000Z",
      bookingEnabled: false
    }));

    expect(markup).toContain('value="America/Chicago"');
    expect(markup).toContain('value="Europe/London"');
    expect(markup).toContain('value="Asia/Tokyo"');
    expect(markup).toContain("Select a date to see available times.");
    expect(markup).toContain("This page doesn’t book meetings yet.");
    expect(markup).not.toContain("Your details");
    expect(markup).toContain("Your time zone");
  });

  it("shows a gated booking choice without asking for guest details before a time is selected", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-10-13T18:00:00.000Z",
      bookingEnabled: true
    }));

    expect(markup).toContain("Choose a time to continue.");
    expect(markup).not.toContain("This page doesn’t book meetings yet.");
    expect(markup).not.toContain("Your details");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Continue/);
  });

  it("opens in the owner's Chicago schedule month at a UTC month boundary", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-11-01T02:00:00.000Z",
      bookingEnabled: false
    }));

    expect(markup).toContain("October 2026");
  });

  it("disables past Chicago dates while keeping the current date selectable", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-10-13T18:00:00.000Z",
      bookingEnabled: false
    }));
    const pastDay = markup.match(/<button[^>]*aria-label="Monday, October 12, 2026"[^>]*>/)?.[0];
    const currentDay = markup.match(/<button[^>]*aria-label="Tuesday, October 13, 2026"[^>]*>/)?.[0];

    expect(pastDay).toContain("disabled");
    expect(currentDay).toBeDefined();
    expect(currentDay).not.toContain("disabled");
  });
});
