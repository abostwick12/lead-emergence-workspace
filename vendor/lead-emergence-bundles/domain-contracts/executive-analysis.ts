import { executiveAttention, emptyExecutiveData, referenceKey, type ExecutiveData, type ExecutiveSignal } from "./executive";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child)).join(",") + "}";
  return JSON.stringify(value);
}
export function normalizeAssistantExecutive<T extends ExecutiveData>(proposed: T, base: ExecutiveData | null): T {
  const result = structuredClone(proposed);
  if (canonical(proposed) === canonical(base)) return result;
  result.reviewState = "inferred";
  for (const collection of ["actions", "observations"] as const) {
    if (!(collection in result)) continue;
    const entries = (result as unknown as Record<string, { id: string; reviewState: string }[]>)[collection];
    const originals = base && collection in base ? (base as unknown as Record<string, { id: string }[]>)[collection] : [];
    for (const entry of entries) {
      if (canonical(proposed.references) !== canonical(base?.references)
        || canonical(entry) !== canonical(originals.find(old => old.id.toLowerCase() === entry.id.toLowerCase()))) entry.reviewState = "inferred";
    }
  }
  if ((result.recordType === "daily_brief" || result.recordType === "weekly_review") && result.state === "reviewed") result.state = "draft";
  if (result.recordType === "meeting" && result.agreement === "user_reported_agreed"
    && (!base || base.recordType !== "meeting" || result.startsAt !== base.startsAt
      || result.durationMinutes !== base.durationMinutes || result.timeZone !== base.timeZone
      || canonical(result.participants) !== canonical(base.participants))) result.agreement = "not_agreed";
  return result;
}
export function sortExecutiveSignals(items: ExecutiveSignal[]): ExecutiveSignal[] {
  const rank = { high: 0, normal: 1, low: 2 };
  return [...items].sort((a, b) => rank[a.priority] - rank[b.priority]
    || (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
    || a.id.localeCompare(b.id));
}
// This returns an unsaved draft. Source titles, private excerpts and source bodies
// are not copied into durable brief text. The native view resolves references live.
export function prepareExecutiveBrief(kind: "daily_brief" | "weekly_review", today: string, raw: unknown): ExecutiveData {
  const snapshot = executiveAttention.parse(raw);
  if (snapshot.asOfDate !== today) throw new Error("Refresh attention for the requested date before preparing this brief.");
  const brief = emptyExecutiveData(kind, today);
  if (brief.recordType !== "daily_brief" && brief.recordType !== "weekly_review") throw new Error("Expected a brief.");
  const seen = new Set<string>();
  brief.references = sortExecutiveSignals(snapshot.items).filter(item => {
    const key = referenceKey(item.source); if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, 20).map(item => item.source);
  const checked = snapshot.coverage.filter(c => c.state === "current").length;
  const unavailable = snapshot.coverage.filter(c => c.state === "unavailable").length;
  brief.title = (kind === "daily_brief" ? "Daily brief" : "Weekly review") + " — " + today;
  brief.focus = kind === "daily_brief" ? "What deserves my attention today?" : "What did I learn, what remains open, and what should change next week?";
  brief.summary = snapshot.total
    ? snapshot.total + " saved attention item(s) across " + checked + " checked capability source(s). Review the linked records before choosing your next actions."
    : "No attention items matched the checked saved-record rules. This does not establish that all work is complete or that nothing changed.";
  if (snapshot.total > snapshot.items.length) brief.summary += " The view is limited to " + snapshot.items.length + " items; open source workspaces for full coverage.";
  if (unavailable) brief.summary += " " + unavailable + " source(s) are unavailable; no no-change conclusion can be made about them.";
  brief.summary += " Unshared sources and external calendars, inboxes and live market information are not included.";
  brief.reviewState = "inferred";
  if (kind === "weekly_review") brief.periodStart = new Date(Date.parse(today + "T00:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);
  return brief;
}
export function attentionChange(previousRaw: unknown, currentRaw: unknown) {
  const previous = executiveAttention.parse(previousRaw), current = executiveAttention.parse(currentRaw);
  const coverage = (snapshot: typeof current) => snapshot.coverage.map(c => [c.capabilityId, c.state]).sort(([a], [b]) => a.localeCompare(b));
  if (canonical(coverage(previous)) !== canonical(coverage(current))) return { status: "coverage_changed" as const, added: 0, changed: 0, removed: 0 };
  // A bounded view cannot establish that a missing item was resolved.
  if (previous.total > previous.items.length || current.total > current.items.length
    || current.coverage.some(c => c.state === "unavailable"))
    return { status: "incomplete" as const, added: 0, changed: 0, removed: 0 };
  const fingerprint = (item: ExecutiveSignal) => canonical({ source: item.source, title: item.title, priority: item.priority,
    dueDate: item.dueDate, reason: item.reason, action: item.action, sourceReviewState: item.sourceReviewState });
  const before = new Map(previous.items.map(item => [item.id, fingerprint(item)]));
  const after = new Map(current.items.map(item => [item.id, fingerprint(item)]));
  const added = [...after.keys()].filter(key => !before.has(key)).length;
  const removed = [...before.keys()].filter(key => !after.has(key)).length;
  const changed = [...after.keys()].filter(key => before.has(key) && before.get(key) !== after.get(key)).length;
  return { status: added || removed || changed ? "changed" as const : "unchanged" as const, added, changed, removed };
}
