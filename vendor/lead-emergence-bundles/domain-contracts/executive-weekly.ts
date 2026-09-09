import { z } from "zod";
import { executiveReference, executiveReviewState, executiveCapabilities, emptyExecutiveData, referenceKey } from "./executive";

export const executiveHistoryCapabilities = ["executive.coordination", "executive.brief", "executive.review"] as const;
export const executiveOutcomeRules = {
  commitment: { outcomes: ["completed"], corrections: ["completedOn", "outcome"], retainOn: [] },
  decision: { outcomes: ["decided", "reversed"], corrections: ["decidedOn", "selectedOptionId", "rationale"], retainOn: [] },
  meeting: { outcomes: ["held"], corrections: ["startsAt", "outcome"], retainOn: [] },
  daily_brief: { outcomes: ["reviewed"], corrections: ["summary", "reflection", "observations"], retainOn: ["archived"] },
  weekly_review: { outcomes: ["reviewed"], corrections: ["summary", "reflection", "observations"], retainOn: ["archived"] },
  action: { outcomes: ["completed"], corrections: ["title", "evidence"], retainOn: [] }
} as const;
type OutcomeSubject = keyof typeof executiveOutcomeRules;
type Fields = Record<string, unknown> | null;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value ?? null);
}
/** Reference semantics, mirrored by the private SQL projection using the pinned rule table. */
export function classifyExecutiveOutcome(kind: OutcomeSubject, before: Fields, after: Fields) {
  const rule = executiveOutcomeRules[kind], previousState = before?.state ?? null, state = after?.state ?? null;
  const outcomes: readonly unknown[] = rule.outcomes, retained: readonly unknown[] = rule.retainOn;
  if (outcomes.includes(state) && state !== previousState) return { change: "recorded" as const, outcome: state };
  if (outcomes.includes(previousState) && !outcomes.includes(state) && !retained.includes(state)) return { change: "withdrawn" as const, outcome: previousState };
  if (outcomes.includes(state) && rule.corrections.some(key => canonical(before?.[key]) !== canonical(after?.[key])))
    return { change: "corrected" as const, outcome: state };
  return null;
}

const date = z.iso.date();
const instant = z.iso.datetime({ offset: true }).refine(value => (value.match(/\.(\d+)/)?.[1].length ?? 0) <= 6, "Use at most microsecond precision.");
export function weeklyInstantMicros(value: string): bigint {
  const fraction = (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0");
  return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.slice(3, 6));
}
const zone = z.string().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}, "Use a supported named time zone.");
export const executiveWeeklyQuery = z.object({
  periodStart: date, periodEnd: date, timeZone: zone,
  recordedThrough: instant.optional(), offset: z.number().int().min(0).max(2147483000).default(0),
  limit: z.number().int().min(1).max(50).default(25)
}).strict().refine(value => {
  const days = (Date.parse(value.periodEnd + "T00:00:00Z") - Date.parse(value.periodStart + "T00:00:00Z")) / 86400000;
  return days >= 0 && days <= 6;
}, "Choose one to seven inclusive local dates.");
export function weeklyEventKey(source: z.infer<typeof executiveReference>): string {
  return source.documentId.toLowerCase() + ":" + String(source.revision).padStart(10, "0") + ":" + (source.item?.id.toLowerCase() ?? "record");
}
export const executiveWeeklyEvent = z.object({
  id: z.string().max(100), source: executiveReference,
  change: z.enum(["recorded", "corrected", "withdrawn"]),
  outcome: z.enum(["completed", "decided", "reversed", "held", "reviewed"]),
  title: z.string().min(1).max(240), parentTitle: z.string().min(1).max(240),
  previousState: z.string().nullable(), state: z.string().nullable(),
  reportedDate: date.nullable(), previousReportedDate: date.nullable(),
  recordedAt: instant, origin: z.enum(["user", "assistant"]), reviewState: executiveReviewState,
  currentRevision: z.number().int().positive(), currentState: z.string().nullable(),
  currentTargetPresent: z.boolean()
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!executiveHistoryCapabilities.includes(value.source.capabilityId as typeof executiveHistoryCapabilities[number])
    || (value.source.item && value.source.item.kind !== "action")) issue("Weekly history is limited to admitted Executive records and actions.");
  const kind = value.source.item ? "action" : value.source.kind;
  if (!Object.hasOwn(executiveOutcomeRules, kind)) { issue("Unsupported outcome subject."); return; }
  const rule = executiveOutcomeRules[kind as OutcomeSubject];
  if (!(rule.outcomes as readonly string[]).includes(value.outcome)) issue("Outcome does not match its source kind.");
  if (value.change === "withdrawn" ? value.outcome !== value.previousState || (rule.outcomes as readonly (string | null)[]).includes(value.state) || (rule.retainOn as readonly (string | null)[]).includes(value.state)
    : value.outcome !== value.state || (value.change === "corrected" ? value.previousState !== value.state : value.previousState === value.state))
    issue("Outcome transition could not be verified.");
  if (value.id !== weeklyEventKey(value.source) || value.currentRevision < value.source.revision) issue("Outcome identity or revision is inconsistent.");
  if (!value.source.item && (!value.currentTargetPresent || value.currentState === null)) issue("An outcome requires a retained parent record.");
  if (value.currentRevision === value.source.revision && value.currentState !== value.state) issue("The latest event must match its current state.");
  if (value.currentTargetPresent !== (value.currentState !== null)) issue("Current target presence does not match its state.");
  if ((value.reportedDate || value.previousReportedDate) && (value.source.item || !["commitment", "decision"].includes(kind)))
    issue("Only completion and decision dates are reported event dates; meeting times are not actual occurrence proof.");
});
export type ExecutiveWeeklyEvent = z.infer<typeof executiveWeeklyEvent>;
const coverage = z.object({
  capabilityId: z.enum(executiveHistoryCapabilities), state: z.enum(["current", "unavailable"]),
  total: z.number().int().nonnegative().nullable()
}).strict();
export function dateInZone(instantValue: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instantValue));
  const field = (name: string) => parts.find(part => part.type === name)!.value;
  return field("year").padStart(4, "0") + "-" + field("month") + "-" + field("day");
}
export const executiveWeeklyReport = z.object({
  schemaVersion: z.literal("1.0"), periodStart: date, periodEnd: date, timeZone: zone,
  windowStart: instant, windowEndExclusive: instant, recordedThrough: instant, retrievedAt: instant,
  consistency: z.literal("recorded_time_cutoff_live_access"),
  coverage: z.array(coverage).length(3), total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(), limit: z.number().int().min(1).max(50),
  events: z.array(executiveWeeklyEvent).max(50)
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (![value.windowStart, value.windowEndExclusive, value.recordedThrough, value.retrievedAt, ...value.events.map(e => e.recordedAt)].every(v => instant.safeParse(v).success) || !zone.safeParse(value.timeZone).success) return;
  if (!executiveWeeklyQuery.safeParse({ periodStart: value.periodStart, periodEnd: value.periodEnd, timeZone: value.timeZone }).success)
    issue("Invalid review period.");
  if (Date.parse(value.windowStart) >= Date.parse(value.windowEndExclusive) || weeklyInstantMicros(value.recordedThrough) > weeklyInstantMicros(value.retrievedAt))
    issue("Invalid recorded-time window.");
  if (new Set(value.coverage.map(c => c.capabilityId)).size !== 3 || value.coverage.some(c => c.state === "current" ? c.total === null : c.total !== null))
    issue("Each Executive source needs honest current coverage.");
  if (!value.coverage.some(c => c.capabilityId === "executive.review" && c.state === "current")) issue("Weekly review access is required.");
  if (value.total !== value.coverage.reduce((sum, c) => sum + (c.total ?? 0), 0)
    || value.events.length !== Math.min(value.limit, Math.max(0, value.total - value.offset))) issue("Outcome paging or counts are inconsistent.");
  if (new Set(value.events.map(e => e.id)).size !== value.events.length) issue("Repeated outcome event.");
  for (const [index, event] of value.events.entries()) {
    const at = weeklyInstantMicros(event.recordedAt), localDate = dateInZone(event.recordedAt, value.timeZone), previous = value.events[index - 1];
    if (at < weeklyInstantMicros(value.windowStart) || at >= weeklyInstantMicros(value.windowEndExclusive) || at > weeklyInstantMicros(value.recordedThrough)
      || localDate < value.periodStart || localDate > value.periodEnd) issue("An outcome is outside the requested recorded period.");
    if (!value.coverage.some(c => c.capabilityId === event.source.capabilityId && c.state === "current")) issue("An outcome belongs to an unchecked source.");
    if (previous && (weeklyInstantMicros(previous.recordedAt) < at || (weeklyInstantMicros(previous.recordedAt) === at && previous.id <= event.id))) issue("Outcome order is inconsistent.");
  }
});
export type ExecutiveWeeklyReport = z.infer<typeof executiveWeeklyReport>;
export function weeklyOutcomeLabel(event: Pick<ExecutiveWeeklyEvent, "change" | "outcome" | "source">): string {
  if (event.change === "withdrawn") return "Earlier " + event.outcome + " state withdrawn";
  if (event.change === "corrected") return "Recorded " + event.outcome + " details corrected";
  return event.outcome === "completed" ? (event.source.item ? "Action" : "Commitment") + " marked completed"
    : event.outcome === "decided" ? "Decision recorded" : event.outcome === "reversed" ? "Decision marked reversed"
    : event.outcome === "held" ? "Meeting marked held" : "Brief marked reviewed";
}
export function prepareExecutiveWeeklyReview(raw: unknown) {
  const report = executiveWeeklyReport.parse(raw);
  if (report.offset !== 0) throw new Error("Return to the first outcome page before preparing the review.");
  const draft = emptyExecutiveData("weekly_review", report.periodEnd);
  if (draft.recordType !== "weekly_review") throw new Error("Expected a weekly review.");
  draft.periodStart = report.periodStart;
  draft.timeZone = report.timeZone;
  draft.title = "Weekly review — " + report.periodEnd;
  draft.focus = "What changed, what did I learn, and what should happen next?";
  const parents = new Map<string, z.infer<typeof executiveReference>>();
  for (const event of report.events) {
    const ref = { capabilityId: executiveCapabilities[event.source.kind as keyof typeof executiveCapabilities], kind: event.source.kind, documentId: event.source.documentId, revision: event.currentRevision };
    parents.set(referenceKey(ref), ref);
  }
  draft.references = [...parents.values()].slice(0, 20);
  draft.summary = report.total + " recorded outcome changes across " + report.coverage.filter(c => c.state === "current").length
    + " checked Executive scopes during " + report.periodStart + "–" + report.periodEnd + " (" + report.timeZone + ")."
    + " Recorded-time cutoff: " + report.recordedThrough + ". These are saved status changes, not independently verified accomplishments or proof that events happened during this period."
    + " Corrections, reversals and withdrawn outcomes are included. Repeated changes can refer to the same work."
    + " " + draft.references.length + " current parent records linked from the first " + report.events.length + " changes; inspect all outcome pages and current attention before drawing conclusions."
    + " Unavailable Executive scopes, other bundles' history, calendars and inboxes are not checked. Access is rechecked per page; a recorded-time cutoff is not a frozen snapshot.";
  draft.reviewState = "inferred";
  return draft;
}
