import { z } from "zod";

const text = (max: number) => z.string().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().uuid();
const date = z.iso.date().nullable();
const instant = z.iso.datetime({ offset: true });
export const executiveKinds = ["commitment", "decision", "meeting", "daily_brief", "weekly_review"] as const;
export const executiveKind = z.enum(executiveKinds);
export type ExecutiveKind = z.infer<typeof executiveKind>;
export const executiveCapabilities: Record<ExecutiveKind, string> = {
  commitment: "executive.coordination", decision: "executive.coordination", meeting: "executive.coordination",
  daily_brief: "executive.brief", weekly_review: "executive.review"
};
export const executiveLabels: Record<ExecutiveKind, string> = {
  commitment: "Commitments", decision: "Decisions", meeting: "Meetings",
  daily_brief: "Daily briefs", weekly_review: "Weekly reviews"
};
export const executiveReviewState = z.enum(["user_stated", "inferred", "confirmed", "stale", "rejected"]);
export const executivePriority = z.enum(["high", "normal", "low"]);
export const namedTimeZone = required(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Use a supported named time zone.");

// The complete allowlist is an authorization input contract, not an authorization decision.
// The host must also check native user consent and current source entitlements per request.
export const executiveSources = {
  "writer.resource.library": { bundleKey: "writer_editor", kinds: ["resource"], label: "Writing resource status" },
  "ministry.research": { bundleKey: "ministry", kinds: ["research"], label: "Ministry research dates" },
  "ministry.archive": { bundleKey: "ministry", kinds: ["archive"], label: "Ministry teaching dates" },
  "nonprofit.roadmap": { bundleKey: "nonprofit_founder", kinds: ["plan"], label: "Nonprofit roadmap tasks" },
  "nonprofit.partners": { bundleKey: "nonprofit_founder", kinds: ["partner"], label: "Nonprofit follow-up dates" },
  "nonprofit.meetings": { bundleKey: "nonprofit_founder", kinds: ["meeting"], label: "Nonprofit meeting dates" },
  "nonprofit.regulatory_research": { bundleKey: "nonprofit_founder", kinds: ["research"], label: "Nonprofit research review dates" },
  "investor.company_research": { bundleKey: "investor", kinds: ["watchlist", "brief"], label: "Investor watchlist and brief review dates" },
  "investor.thesis": { bundleKey: "investor", kinds: ["thesis"], label: "Investor thesis review dates" },
  "investor.filings": { bundleKey: "investor", kinds: ["filing"], label: "Investor filing review dates" }
} as const;
export type ExecutiveSourceCapability = keyof typeof executiveSources;
export const executiveSourceCapability = z.enum(Object.keys(executiveSources) as [ExecutiveSourceCapability, ...ExecutiveSourceCapability[]]);
// Optional item targets are separately permissioned; record sharing never grants them.
export const executiveTaskKinds: Record<string, Record<string, readonly string[]>> = {
  "executive.coordination": { meeting: ["action"] },
  "executive.brief": { daily_brief: ["action"] },
  "executive.review": { weekly_review: ["action"] },
  "nonprofit.roadmap": { plan: ["milestone"] },
  "nonprofit.partners": { partner: ["followup"] },
  "nonprofit.meetings": { meeting: ["action"] },
  "investor.company_research": { watchlist: ["watch_item"], brief: ["catalyst"] },
  "investor.thesis": { thesis: ["catalyst"] },
  "investor.filings": { filing: ["catalyst"] }
};
export const executiveItemTarget = z.object({
  kind: z.enum(["action", "milestone", "followup", "watch_item", "catalyst"]), id
}).strict();
export const executiveReferenceBase = z.object({
  capabilityId: z.enum(["executive.coordination", "executive.brief", "executive.review", ...Object.keys(executiveSources)]),
  kind: required(40), documentId: id, revision: z.number().int().positive(), item: executiveItemTarget.optional()
}).strict();
export type ExecutiveReference = z.infer<typeof executiveReferenceBase>;
export function referenceCapabilityMatches(ref: ExecutiveReference): boolean {
  if (ref.item) {
    const kinds = Object.hasOwn(executiveTaskKinds, ref.capabilityId) ? executiveTaskKinds[ref.capabilityId] : undefined;
    if (!kinds || !Object.hasOwn(kinds, ref.kind) || !kinds[ref.kind].includes(ref.item.kind)) return false;
    return ref.item.kind !== "followup" || ref.item.id.toLowerCase() === ref.documentId.toLowerCase();
  }
  if (Object.hasOwn(executiveCapabilities, ref.kind) && executiveCapabilities[ref.kind as ExecutiveKind] === ref.capabilityId) return true;
  if (!Object.hasOwn(executiveSources, ref.capabilityId)) return false;
  const source = executiveSources[ref.capabilityId as ExecutiveSourceCapability];
  return !!source && (source.kinds as readonly string[]).includes(ref.kind);
}
export const executiveReference = executiveReferenceBase.refine(referenceCapabilityMatches, "Use the source's matching record kind and capability.");
export function referenceKey(ref: ExecutiveReference): string {
  return ref.capabilityId + ":" + ref.kind + ":" + ref.documentId.toLowerCase()
    + (ref.item ? ":" + ref.item.kind + ":" + ref.item.id.toLowerCase() : "");
}
const references = z.array(executiveReferenceBase).max(20);
const action = z.object({
  id, title: required(240), owner: text(240), dueDate: date,
  state: z.enum(["open", "waiting", "blocked", "completed", "cancelled"]),
  nextAction: text(2000), evidence: text(2000), reviewState: executiveReviewState
}).strict();
export type ExecutiveAction = z.infer<typeof action>;
const common = {
  title: required(240), notes: text(12000), priority: executivePriority,
  reviewState: executiveReviewState, reviewDate: date, references
};
export const executiveBaseSchemas = {
  commitment: z.object({
    ...common, recordType: z.literal("commitment"), state: z.enum(["open", "waiting", "blocked", "completed", "cancelled"]),
    owner: text(240), outcome: required(4000), nextAction: text(2000), dueDate: date,
    followupDate: date, completedOn: date, blocker: text(2000)
  }).strict(),
  decision: z.object({
    ...common, recordType: z.literal("decision"), state: z.enum(["open", "decided", "deferred", "reversed"]),
    question: required(4000), owner: text(240), dueDate: date, nextAction: text(2000),
    options: z.array(z.object({ id, title: required(240), upside: text(2000), downside: text(2000), evidence: text(4000) }).strict()).max(12),
    selectedOptionId: id.nullable(), decidedOn: date, rationale: text(4000), revisitTrigger: text(2000)
  }).strict(),
  meeting: z.object({
    ...common, recordType: z.literal("meeting"), state: z.enum(["planned", "held", "cancelled"]),
    objective: required(4000), participants: z.array(z.object({ name: required(240), role: text(240) }).strict()).max(30),
    agenda: text(8000), startsAt: instant.nullable(), timeZone: required(100), durationMinutes: z.number().int().min(5).max(480),
    agreement: z.enum(["not_agreed", "user_reported_agreed"]), location: text(1000), outcome: text(8000),
    actions: z.array(action).max(30)
  }).strict(),
  daily_brief: z.object({
    ...common, recordType: z.literal("daily_brief"), state: z.enum(["draft", "reviewed", "archived"]),
    periodStart: z.iso.date(), periodEnd: z.iso.date(), focus: required(2000), summary: text(8000),
    observations: z.array(z.object({ id, text: required(3000), classification: z.enum(["observation", "interpretation", "suggestion"]),
      evidence: required(2000), reviewState: executiveReviewState }).strict()).max(20),
    actions: z.array(action).max(10), reflection: text(8000)
  }).strict(),
  weekly_review: z.object({
    ...common, recordType: z.literal("weekly_review"), state: z.enum(["draft", "reviewed", "archived"]),
    periodStart: z.iso.date(), periodEnd: z.iso.date(), focus: required(2000), summary: text(8000),
    observations: z.array(z.object({ id, text: required(3000), classification: z.enum(["observation", "interpretation", "suggestion"]),
      evidence: required(2000), reviewState: executiveReviewState }).strict()).max(20),
    actions: z.array(action).max(10), reflection: text(8000)
  }).strict()
};
export type ExecutiveData = z.infer<(typeof executiveBaseSchemas)[ExecutiveKind]>;
export function checkExecutiveData(data: ExecutiveData, ctx: z.RefinementCtx) {
  const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
  if (data.references.some(ref => !referenceCapabilityMatches(ref))) issue("A linked record does not match its source capability.", ["references"]);
  if (new Set(data.references.map(referenceKey)).size !== data.references.length) issue("Link each source record or task once.", ["references"]);
  for (const name of ["options", "observations", "actions"] as const) {
    const entries = name in data ? (data as unknown as Record<string, { id: string }[]>)[name] : [];
    if (new Set(entries.map(x => x.id.toLowerCase())).size !== entries.length) issue("Use each item identifier once.", [name]);
  }
  if (data.recordType === "commitment") {
    if (data.state === "completed" && !data.completedOn) issue("Record when the commitment was completed.", ["completedOn"]);
    if (data.state !== "completed" && data.completedOn) issue("Only completed commitments have a completion date.", ["completedOn"]);
    if (data.state === "blocked" && !data.blocker.trim()) issue("Name what is blocking this commitment.", ["blocker"]);
  } else if (data.recordType === "decision") {
    if (data.selectedOptionId && !data.options.some(o => o.id.toLowerCase() === data.selectedOptionId?.toLowerCase())) issue("The selected option must belong to this decision.", ["selectedOptionId"]);
    if (["decided", "reversed"].includes(data.state) && (!data.selectedOptionId || !data.decidedOn || !data.rationale.trim()))
      issue("A recorded decision needs the chosen option, date and rationale.");
    if (data.state === "open" && (data.selectedOptionId || data.decidedOn)) issue("Keep an open decision undecided.");
  } else if (data.recordType === "meeting") {
    if (!namedTimeZone.safeParse(data.timeZone).success) issue("Use a supported named time zone.", ["timeZone"]);
    if (data.agreement === "user_reported_agreed" && !data.startsAt) issue("An agreed time needs an explicit instant.", ["startsAt"]);
    if (data.state === "held" && (!data.startsAt || !data.outcome.trim())) issue("A held meeting needs its time and recorded outcome.");
  } else {
    const days = (Date.parse(data.periodEnd + "T00:00:00Z") - Date.parse(data.periodStart + "T00:00:00Z")) / 86400000;
    if (data.recordType === "daily_brief" ? days !== 0 : days < 0 || days > 6) issue("Daily briefs cover one date; weekly reviews cover at most seven inclusive dates.");
  }
}
export const executiveSchemas = {
  commitment: executiveBaseSchemas.commitment.superRefine(checkExecutiveData),
  decision: executiveBaseSchemas.decision.superRefine(checkExecutiveData),
  meeting: executiveBaseSchemas.meeting.superRefine(checkExecutiveData),
  daily_brief: executiveBaseSchemas.daily_brief.superRefine(checkExecutiveData),
  weekly_review: executiveBaseSchemas.weekly_review.superRefine(checkExecutiveData)
};
export const executiveData = z.discriminatedUnion("recordType", [
  executiveBaseSchemas.commitment, executiveBaseSchemas.decision, executiveBaseSchemas.meeting,
  executiveBaseSchemas.daily_brief, executiveBaseSchemas.weekly_review
]).superRefine(checkExecutiveData);
const kindMatches = (value: { kind: ExecutiveKind; data: ExecutiveData }, ctx: z.RefinementCtx) => {
  if (value.kind !== value.data.recordType) ctx.addIssue({ code: "custom", message: "Record kind does not match its content.", path: ["data"] });
};
const request = { kind: executiveKind, documentId: id.nullable(), expectedRevision: z.number().int().nonnegative(), requestId: id, data: executiveData };
const exactBase = (d: { documentId: string | null; expectedRevision: number }) => d.documentId ? d.expectedRevision > 0 : d.expectedRevision === 0;
export const executiveSave = z.object({ ...request, confirmExactRecord: z.literal(true) }).strict().superRefine(kindMatches).refine(exactBase, "Use the exact saved revision.");
export const executiveProposalInput = z.object({
  ...request, reason: required(2000), evidence: required(4000), scope: z.literal("executive_coordination_only")
}).strict().superRefine(kindMatches).refine(exactBase, "Use the exact proposal base revision.");
export const executiveDocument = z.object({
  id, kind: executiveKind, revision: z.number().int().positive(), data: executiveData,
  origin: z.enum(["user", "assistant"]), createdAt: instant, updatedAt: instant
}).strict().superRefine(kindMatches);
export type ExecutiveDocument = z.infer<typeof executiveDocument>;
export const executiveResult = z.object({ document: executiveDocument.nullable() }).strict();
export const executiveProposal = z.object({
  id, kind: executiveKind, documentId: id.nullable(), baseRevision: z.number().int().nonnegative(), data: executiveData,
  reason: z.string(), evidence: z.string(), origin: z.enum(["user", "assistant"]), status: z.enum(["pending", "approved", "rejected"]),
  createdAt: instant, appliedDocumentId: id.nullable(), appliedRevision: z.number().int().positive().nullable()
}).strict().superRefine(kindMatches);
export type ExecutiveProposal = z.infer<typeof executiveProposal>;
export const executiveDecision = z.object({
  proposalId: id, expectedRevision: z.number().int().nonnegative(), decision: z.enum(["approve", "reject"]), confirmExactRecord: z.boolean()
}).strict().refine(d => d.decision === "reject" || d.confirmExactRecord, "Review and confirm this exact proposal.");
export const executiveDecisionResult = z.object({ document: executiveDocument.nullable(), proposal: executiveProposal }).strict();
export const executiveHistory = z.object({ revisions: z.array(executiveDocument).max(10) }).strict();
export const executiveSearch = z.object({
  search: text(200).default(""), offset: z.number().int().min(0).max(10000).default(0), limit: z.number().int().min(1).max(50).default(25)
}).strict();
export const executiveSummary = z.object({
  id, kind: executiveKind, title: z.string(), revision: z.number().int().positive(), state: z.string(), reviewState: executiveReviewState,
  summary: z.string(), dueDate: date, updatedAt: instant
}).strict();
export const executiveSearchResult = z.object({ total: z.number().int().nonnegative(), documents: z.array(executiveSummary).max(50) }).strict();
export const executiveProposalsResult = z.object({ total: z.number().int().nonnegative(), proposals: z.array(executiveProposal).max(25) }).strict();

export const executiveSharingInput = z.object({
  sourceCapabilities: z.array(executiveSourceCapability).max(10).refine(xs => new Set(xs).size === xs.length, "Choose each source once."),
  expectedRevision: z.number().int().nonnegative(), requestId: id, confirmTaskMetadataOnly: z.literal(true)
}).strict();
export const executiveSharing = z.object({
  revision: z.number().int().nonnegative(), sourceCapabilities: z.array(executiveSourceCapability).max(10),
  updatedAt: instant.nullable()
}).strict();
export const executiveSignal = z.object({
  id: required(180), source: executiveReference, title: required(240), priority: executivePriority, dueDate: date,
  reason: required(1000), evidence: required(500), action: required(240),
  sourceUpdatedAt: instant, sourceReviewState: executiveReviewState.nullable()
}).strict();
export type ExecutiveSignal = z.infer<typeof executiveSignal>;
export const executiveAttention = z.object({
  asOfDate: z.iso.date(), retrievedAt: instant, items: z.array(executiveSignal).max(50), total: z.number().int().nonnegative(),
  coverage: z.array(z.object({ capabilityId: required(100), state: z.enum(["current", "not_shared", "unavailable"]),
    total: z.number().int().nonnegative().nullable() }).strict()).max(13)
}).strict().superRefine((snapshot, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (snapshot.total < snapshot.items.length) issue("Attention count cannot be smaller than its result page.");
  if (new Set(snapshot.items.map(item => item.id)).size !== snapshot.items.length) issue("Attention item identifiers must be unique.");
  if (new Set(snapshot.coverage.map(c => c.capabilityId)).size !== snapshot.coverage.length) issue("Each capability has one coverage state.");
  if (snapshot.coverage.some(c => c.state === "current" ? c.total === null : c.total !== null)) issue("Only checked sources may expose counts.");
  if (snapshot.items.some(item => !snapshot.coverage.some(c => c.capabilityId === item.source.capabilityId && c.state === "current"))) issue("Every attention item needs a checked source.");
});

export function emptyExecutiveData(kind: ExecutiveKind, today: string): ExecutiveData {
  const common = { title: "", notes: "", priority: "normal" as const, reviewState: "user_stated" as const, reviewDate: null, references: [] };
  if (kind === "commitment") return { ...common, recordType: kind, state: "open", owner: "", outcome: "", nextAction: "", dueDate: null, followupDate: null, completedOn: null, blocker: "" };
  if (kind === "decision") return { ...common, recordType: kind, state: "open", question: "", owner: "", dueDate: null, nextAction: "", options: [], selectedOptionId: null, decidedOn: null, rationale: "", revisitTrigger: "" };
  if (kind === "meeting") return { ...common, recordType: kind, state: "planned", objective: "", participants: [], agenda: "", startsAt: null,
    timeZone: "", durationMinutes: 30, agreement: "not_agreed", location: "", outcome: "", actions: [] };
  return { ...common, recordType: kind, state: "draft", periodStart: today, periodEnd: today, focus: "", summary: "", observations: [], actions: [], reflection: "" };
}
