export const DEFAULT_CLOCK_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles"
] as const;

export type ClockTimeZones = [string, string, string];

export type WorkspaceClockValue = {
  time: string;
  abbreviation: string;
};

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const abbreviationFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(timeZone: string) {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function abbreviationFormatter(timeZone: string) {
  let formatter = abbreviationFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    abbreviationFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeClockTimeZones(value: unknown): ClockTimeZones {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isSupportedTimeZone)) {
    return [...DEFAULT_CLOCK_TIMEZONES];
  }
  return [value[0], value[1], value[2]];
}

export function formatWorkspaceClock(date: Date, timeZone: string): WorkspaceClockValue {
  if (!isSupportedTimeZone(timeZone)) throw new Error(`Unsupported time zone: ${timeZone}`);
  const time = timeFormatter(timeZone).format(date);
  const abbreviation = abbreviationFormatter(timeZone).formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return { time, abbreviation };
}

export function timeZoneDisplayName(timeZone: string): string {
  return timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;
}

export function supportedTimeZoneOptions(selected: readonly string[] = []): string[] {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  }).supportedValuesOf;
  const systemTimeZones = supportedValuesOf ? supportedValuesOf("timeZone") : [];
  return Array.from(new Set([...DEFAULT_CLOCK_TIMEZONES, ...selected, ...systemTimeZones]))
    .filter(isSupportedTimeZone)
    .sort((left, right) => left.localeCompare(right));
}
