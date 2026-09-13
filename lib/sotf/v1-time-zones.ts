import { z } from "zod";
import canonicalTimeZoneContract from "./v1-canonical-time-zones.json";
import { sotfV1AuthorityIdentifierSchema } from "./v1-text";

export const SOTF_V1_TIME_ZONE_TZDB_VERSION = canonicalTimeZoneContract.tzdb_version;
export const SOTF_V1_CANONICAL_TIME_ZONES = Object.freeze([...canonicalTimeZoneContract.time_zones]);

const canonicalTimeZones = new Set<string>(SOTF_V1_CANONICAL_TIME_ZONES);

export function isSotfV1CanonicalTimeZone(value: string) {
  return canonicalTimeZones.has(value);
}

// The fixed SOTF v1 set is exact and versioned. Runtime acceptance is not the
// contract because ICU and PostgreSQL also expose different compatibility links.
export const sotfV1CanonicalTimeZoneSchema = sotfV1AuthorityIdentifierSchema(80)
  .refine(isSotfV1CanonicalTimeZone, "Use a canonical SOTF v1 IANA time zone.");

export type SotfV1CanonicalTimeZone = z.infer<typeof sotfV1CanonicalTimeZoneSchema>;
