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
    expect(markup).toContain("Live availability is not connected yet.");
    expect(markup).toContain("No time is being held or booked.");
    expect(markup).toContain("Your time zone");
  });
});
