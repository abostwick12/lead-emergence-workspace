import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOCK_TIMEZONES,
  formatWorkspaceClock,
  normalizeClockTimeZones,
  supportedTimeZoneOptions,
  timeZoneDisplayName
} from "@/lib/workspace/timezones";

describe("Workspace clocks", () => {
  it("uses the approved three-clock defaults", () => {
    expect(DEFAULT_CLOCK_TIMEZONES).toEqual([
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles"
    ]);
  });

  it("accepts exactly three supported IANA time zones and rejects malformed preferences", () => {
    expect(normalizeClockTimeZones(["Europe/London", "Asia/Tokyo", "Australia/Sydney"]))
      .toEqual(["Europe/London", "Asia/Tokyo", "Australia/Sydney"]);
    expect(normalizeClockTimeZones(["Europe/London", "Not/AZone", "Australia/Sydney"]))
      .toEqual(DEFAULT_CLOCK_TIMEZONES);
    expect(normalizeClockTimeZones(["Europe/London", "Asia/Tokyo"]))
      .toEqual(DEFAULT_CLOCK_TIMEZONES);
  });

  it("derives United States daylight-saving abbreviations locally", () => {
    const winter = new Date("2026-01-15T18:00:00.000Z");
    const summer = new Date("2026-07-15T18:00:00.000Z");

    expect(formatWorkspaceClock(winter, "America/New_York").abbreviation).toBe("EST");
    expect(formatWorkspaceClock(summer, "America/New_York").abbreviation).toBe("EDT");
    expect(formatWorkspaceClock(winter, "America/Chicago").abbreviation).toBe("CST");
    expect(formatWorkspaceClock(summer, "America/Chicago").abbreviation).toBe("CDT");
    expect(formatWorkspaceClock(winter, "America/Los_Angeles").abbreviation).toBe("PST");
    expect(formatWorkspaceClock(summer, "America/Los_Angeles").abbreviation).toBe("PDT");
  });

  it("keeps configured zones available and presents readable labels", () => {
    expect(supportedTimeZoneOptions(["Pacific/Honolulu"])).toEqual(expect.arrayContaining([
      ...DEFAULT_CLOCK_TIMEZONES,
      "Pacific/Honolulu"
    ]));
    expect(timeZoneDisplayName("America/Los_Angeles")).toBe("Los Angeles");
  });
});
