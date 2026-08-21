"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { formatWorkspaceClock, timeZoneDisplayName } from "@/lib/workspace/timezones";

const headerDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

function useCurrentTime(refreshMilliseconds: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const timer = window.setInterval(updateNow, refreshMilliseconds);
    return () => window.clearInterval(timer);
  }, [refreshMilliseconds]);
  return now;
}

export function WorkspaceHeaderDate() {
  const now = useCurrentTime(60_000);
  return <p className="header-date">{now
    ? headerDateFormatter.format(now)
    : "Loading local date…"}</p>;
}

export function WorkspaceClocks() {
  const { clockTimeZones } = useWorkspace();
  const now = useCurrentTime(1_000);
  const clocks = useMemo(() => clockTimeZones.map((timeZone) => ({
    timeZone,
    label: timeZoneDisplayName(timeZone),
    value: now ? formatWorkspaceClock(now, timeZone) : null
  })), [clockTimeZones, now]);

  return <div className="workspace-clocks" aria-label="Configured Workspace clocks">
    {clocks.map(({ timeZone, label, value }, index) => <div className="workspace-clock" key={`${index}-${timeZone}`}>
      <span className="clock-zone" title={timeZone}>{label}</span>
      <strong><time dateTime={now?.toISOString()}>{value?.time ?? "--:--:--"}</time></strong>
      <abbr className="clock-abbreviation" title={timeZone}>{value?.abbreviation ?? "---"}</abbr>
    </div>)}
  </div>;
}
