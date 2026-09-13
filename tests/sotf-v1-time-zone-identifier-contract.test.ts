import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dailyBriefOutcomeSchema, dailyBriefStateInputSchema, dailyBriefWindow } from "@/lib/sotf/daily-brief-v1";
import canonicalTimeZoneContract from "@/lib/sotf/v1-canonical-time-zones.json";
import {
  isSotfV1CanonicalTimeZone,
  SOTF_V1_CANONICAL_TIME_ZONES,
  SOTF_V1_TIME_ZONE_TZDB_VERSION,
} from "@/lib/sotf/v1-time-zones";

const dbTest = readFileSync("supabase/tests/database/sotf_v1_time_zone_identifier_contract.sql", "utf8");
const corpus = JSON.parse(dbTest.split("$time_zone_corpus$")[1]) as Array<{
  id: string;
  description: string;
  raw: string;
  accepted: boolean;
}>;

function outcome(timeZone: string) {
  return {
    schema_version: "1",
    request_id: "82300000-0000-4000-8000-000000000001",
    run_id: "82400000-0000-4000-8000-000000000001",
    workflow_id: "transition.daily_brief",
    workflow_version: "1.0.0",
    expected_state_revision: 1,
    brief_date: "2026-09-13",
    time_zone: timeZone,
    host: "chatgpt",
    execution_mode: "A",
    data_class: "ordinary_transition_operations",
    user_confirmed: true,
    status: "degraded",
    connector_results: { calendar_read: "not_requested", email_read: "not_requested" },
    degradation_reasons: [],
    selected_le_refs: [],
    priority_count: 0,
    usefulness: "not_rated",
    provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
  };
}

function localDateAt(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

describe("SOTF v1 canonical time-zone identifier contract", () => {
  it("freezes one 418-identifier IANA 2025b runtime-intersection contract", () => {
    expect(SOTF_V1_TIME_ZONE_TZDB_VERSION).toBe("2025b");
    expect(SOTF_V1_CANONICAL_TIME_ZONES).toEqual(canonicalTimeZoneContract.time_zones);
    expect(SOTF_V1_CANONICAL_TIME_ZONES).toHaveLength(418);
    expect(new Set(SOTF_V1_CANONICAL_TIME_ZONES).size).toBe(418);
    expect(canonicalTimeZoneContract.excluded_unavailable_identifiers).toEqual(["America/Coyhaique"]);
    expect(SOTF_V1_CANONICAL_TIME_ZONES).toContain("UTC");
  });

  it("keeps every frozen primary identifier executable by the JavaScript runtime", () => {
    for (const timeZone of SOTF_V1_CANONICAL_TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone }).format(0), timeZone).not.toThrow();
    }
  });

  it("uses the same attack corpus as the database authority", () => {
    expect(corpus).toHaveLength(43);
    expect(new Set(corpus.map((row) => row.id)).size).toBe(corpus.length);
    expect(corpus.find((row) => row.raw === "posix/America/Chicago")?.accepted).toBe(false);
    for (const row of corpus) {
      expect(isSotfV1CanonicalTimeZone(row.raw), row.id).toBe(row.accepted);
      expect(dailyBriefStateInputSchema.safeParse({
        workflow_id: "transition.daily_brief",
        workflow_version: "1.0.0",
        brief_date: "2026-09-13",
        time_zone: row.raw,
      }).success, row.id).toBe(row.accepted);
      expect(dailyBriefOutcomeSchema.safeParse(outcome(row.raw)).success, row.id).toBe(row.accepted);
    }
  });

  it("enforces canonical membership before time-zone window calculation", () => {
    const now = new Date("2026-09-13T12:00:00.000Z");
    for (const row of corpus) {
      if (row.accepted) {
        const briefDate = localDateAt(now, row.raw);
        expect(() => dailyBriefWindow(briefDate, row.raw, now), row.id).not.toThrow();
      } else {
        expect(() => dailyBriefWindow("2026-09-13", row.raw, now), row.id).toThrow("canonical SOTF v1");
      }
    }
  });

  it("accepts modern IANA primaries without rewriting them to runtime aliases", () => {
    for (const timeZone of ["Asia/Kolkata", "Europe/Kyiv", "America/Nuuk", "Africa/Asmara", "Pacific/Chuuk", "Pacific/Kanton"]) {
      const parsed = dailyBriefOutcomeSchema.parse(outcome(timeZone));
      expect(parsed.time_zone).toBe(timeZone);
    }
  });
});
