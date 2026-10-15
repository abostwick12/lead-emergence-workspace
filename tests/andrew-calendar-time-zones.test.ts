import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AndrewCalendar } from "@/app/meet/andrew/andrew-calendar";

describe("Andrew calendar time zones", () => {
  it("offers zones beyond the four US defaults while leaving booking unavailable", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-10-13T18:00:00.000Z"
    }));

    expect(markup).toContain('value="America/Chicago"');
    expect(markup).toContain('value="Europe/London"');
    expect(markup).toContain('value="Asia/Tokyo"');
    expect(markup).toContain("Select a date to see available times.");
    expect(markup).toContain("This page doesn&#x27;t book meetings yet.");
    expect(markup).toContain("Your time zone");
  });

  it("opens in the owner's Chicago schedule month at a UTC month boundary", () => {
    const markup = renderToStaticMarkup(createElement(AndrewCalendar, {
      currentBookingUrl: null,
      todayIso: "2026-11-01T02:00:00.000Z"
    }));

    expect(markup).toContain("October 2026");
  });
});
