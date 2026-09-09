import { z } from "zod";

const text = (max: number) => z.string().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().uuid();
const date = z.iso.date().nullable();
const labels = (count: number, max: number) => z.array(required(max)).max(count)
  .refine(xs => new Set(xs.map(x => x.toLowerCase())).size === xs.length, "Use each entry once.");
export const nonprofitKinds = ["plan", "partner", "meeting", "research"] as const;
export const nonprofitKind = z.enum(nonprofitKinds);
export type NonprofitKind = z.infer<typeof nonprofitKind>;
export const nonprofitCapabilities: Record<NonprofitKind, string> = {
  plan: "nonprofit.roadmap", partner: "nonprofit.partners", meeting: "nonprofit.meetings", research: "nonprofit.regulatory_research"
};
export const nonprofitLabels: Record<NonprofitKind, string> = {
  plan: "Roadmaps", partner: "People & partnerships", meeting: "Meetings", research: "Research"
};
export const actionStates = ["planned", "in_progress", "blocked", "done", "skipped"] as const;
export const milestoneCategories = ["formation", "governance", "partnerships", "volunteers", "funding", "policy", "launch", "other"] as const;
const actionFields = {
  id, title: required(240), owner: text(200), dueDate: date, status: z.enum(actionStates),
  nextAction: text(2000), evidence: text(2000), priority: z.enum(["high", "normal"])
};
export const founderAction = z.object(actionFields).strict();
export const milestone = z.object({ ...actionFields, category: z.enum(milestoneCategories),
  dependsOn: z.array(id).max(20).refine(xs => new Set(xs).size === xs.length, "Use each dependency once.")
}).strict();
export type FounderAction = z.infer<typeof founderAction>;
export type Milestone = z.infer<typeof milestone>;
export const planFields = z.object({
  title: required(240), mission: text(4000), jurisdiction: text(500),
  status: z.enum(["active", "paused", "archived"]), targetDate: date, milestones: z.array(milestone).max(50)
}).strict();
export const founderPlan = planFields.superRefine((p, ctx) => {
  const items = new Map(p.milestones.map(m => [m.id, m]));
  if (items.size !== p.milestones.length) ctx.addIssue({ code: "custom", message: "Milestones need distinct identifiers." });
  const visited = new Set<string>(), visiting = new Set<string>();
  const walk = (key: string): boolean => {
    if (visiting.has(key)) return false;
    if (visited.has(key)) return true;
    const item = items.get(key);
    if (!item) return false;
    visiting.add(key);
    if (item.dependsOn.some(dep => !walk(dep))) return false;
    visiting.delete(key); visited.add(key); return true;
  };
  if (p.milestones.some(m => !walk(m.id))) ctx.addIssue({ code: "custom", message: "Dependencies must belong to this roadmap and cannot form a cycle." });
});
export const partnerRecord = z.object({
  title: required(240), role: z.enum(["partner", "volunteer", "donor", "grantmaker", "board", "other"]),
  contactName: text(200), contactEmail: z.union([z.literal(""), z.email().max(320)]),
  stage: z.enum(["identified", "contacted", "conversation", "committed", "closed"]),
  owner: text(200), nextAction: text(2000), followupDate: date, lastContactDate: date,
  notes: text(12000), outreachDraft: text(8000)
}).strict();
export const meetingRecord = z.object({
  title: required(240), scheduledDate: date, localTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
  timeZone: text(80), location: text(500), participants: labels(40, 240),
  status: z.enum(["scheduled", "completed", "cancelled"]), agenda: text(8000), notes: text(20000),
  decisions: labels(30, 2000), actions: z.array(founderAction).max(40)
}).strict().superRefine((m, ctx) => {
  if (new Set(m.actions.map(a => a.id)).size !== m.actions.length) ctx.addIssue({ code: "custom", message: "Meeting actions need distinct identifiers." });
  if (m.localTime && (!m.scheduledDate || !m.timeZone.trim())) ctx.addIssue({ code: "custom", message: "A meeting time needs a date and time zone." });
  if (m.timeZone) {
    try { new Intl.DateTimeFormat("en", {timeZone: m.timeZone}); }
    catch { ctx.addIssue({ code: "custom", message: "Use an IANA time zone, such as America/Chicago." }); }
  }
});
export const sourceUrl = z.string().url().max(2000).refine(raw => {
  try { const u = new URL(raw); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
}, "Use an HTTP(S) source URL without credentials.");
export const nonprofitSource = z.object({
  id, title: required(500), authority: required(500), authorityType: z.enum(["government", "grantmaker", "primary_organization", "secondary"]),
  url: sourceUrl, reference: text(2000), jurisdiction: required(500), retrievedDate: z.iso.date(),
  effectiveDate: date, sourceDate: date, finding: required(8000)
}).strict();
export const researchFields = z.object({
  title: required(240), category: z.enum(["formation", "governance", "fundraising", "grant", "regulatory", "policy"]),
  jurisdiction: required(500), question: required(4000), status: z.enum(["open", "researching", "review_required", "reviewed", "archived"]),
  reviewDate: date, owner: text(200), sources: z.array(nonprofitSource).max(30),
  interpretation: text(8000), uncertainty: required(4000), requiredAction: text(4000),
  professionalReview: required(2000), epistemicState: z.enum(["user_stated", "inferred", "stale", "rejected"])
}).strict();
export const nonprofitResearch = researchFields.superRefine((r, ctx) => {
  if (new Set(r.sources.map(s => s.id)).size !== r.sources.length) ctx.addIssue({ code: "custom", message: "Sources need distinct identifiers." });
  if (r.status === "reviewed" && !r.sources.length) ctx.addIssue({ code: "custom", message: "Reviewed research needs recorded sources; this does not certify compliance." });
});
export type FounderPlan = z.infer<typeof founderPlan>;
export type PartnerRecord = z.infer<typeof partnerRecord>;
export type MeetingRecord = z.infer<typeof meetingRecord>;
export type NonprofitResearch = z.infer<typeof nonprofitResearch>;
export type NonprofitSource = z.infer<typeof nonprofitSource>;
export const nonprofitData = z.union([founderPlan, partnerRecord, meetingRecord, nonprofitResearch]);
export type NonprofitData = z.infer<typeof nonprofitData>;
export const nonprofitSchemas = {plan: founderPlan, partner: partnerRecord, meeting: meetingRecord, research: nonprofitResearch};
export const emptyNonprofitData = {
  plan: { title: "", mission: "", jurisdiction: "", status: "active", targetDate: null, milestones: [] } satisfies FounderPlan,
  partner: { title: "", role: "partner", contactName: "", contactEmail: "", stage: "identified", owner: "", nextAction: "", followupDate: null, lastContactDate: null, notes: "", outreachDraft: "" } satisfies PartnerRecord,
  meeting: { title: "", scheduledDate: null, localTime: "", timeZone: "", location: "", participants: [], status: "scheduled", agenda: "", notes: "", decisions: [], actions: [] } satisfies MeetingRecord,
  research: { title: "", category: "regulatory", jurisdiction: "", question: "", status: "open", reviewDate: null, owner: "", sources: [], interpretation: "", uncertainty: "Not yet researched. Applicability and current requirements need verification.", requiredAction: "", professionalReview: "Identify the appropriate qualified professional to review applicability before acting.", epistemicState: "inferred" } satisfies NonprofitResearch
};
export const newFounderAction = (actionId: string): FounderAction => ({ id: actionId, title: "", owner: "", dueDate: null, status: "planned", nextAction: "", evidence: "", priority: "normal" });
const checkKind = (d: {kind: NonprofitKind; data: NonprofitData}, ctx: z.RefinementCtx) => {
  const parsed = nonprofitSchemas[d.kind].safeParse(d.data);
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({code: "custom", message: issue.message, path: ["data", ...issue.path]});
};
export const nonprofitDocument = z.object({
  id, kind: nonprofitKind, revision: z.number().int().positive(), data: nonprofitData,
  origin: z.enum(["user", "assistant"]), createdAt: z.iso.datetime({offset: true}), updatedAt: z.iso.datetime({offset: true})
}).strict().superRefine(checkKind);
export type NonprofitDocument = z.infer<typeof nonprofitDocument>;
export const nonprofitResult = z.object({document: nonprofitDocument.nullable()}).strict();
export const nonprofitSave = z.object({
  kind: nonprofitKind, documentId: id.nullable(), expectedRevision: z.number().int().nonnegative(), requestId: id,
  data: nonprofitData, confirmAdministrative: z.literal(true)
}).strict().superRefine(checkKind).refine(d => d.documentId ? d.expectedRevision > 0 : d.expectedRevision === 0, "Read the current revision before changing an existing record.");
export const nonprofitProposalInput = z.object({
  kind: nonprofitKind, documentId: id.nullable(), expectedRevision: z.number().int().nonnegative(), requestId: id,
  data: nonprofitData, reason: required(2000), evidence: required(4000), scope: z.literal("administrative_only")
}).strict().superRefine(checkKind).refine(d => d.documentId ? d.expectedRevision > 0 : d.expectedRevision === 0, "A proposal must identify its exact base revision.");
export const nonprofitProposal = z.object({
  id, kind: nonprofitKind, documentId: id.nullable(), baseRevision: z.number().int().nonnegative(), data: nonprofitData,
  reason: z.string(), evidence: z.string(), origin: z.enum(["user", "assistant"]),
  status: z.enum(["pending", "approved", "rejected"]), createdAt: z.iso.datetime({offset: true}),
  appliedDocumentId: id.nullable(), appliedRevision: z.number().int().positive().nullable()
}).strict().superRefine(checkKind);
export type NonprofitProposal = z.infer<typeof nonprofitProposal>;
export const nonprofitDecision = z.object({
  proposalId: id, expectedRevision: z.number().int().nonnegative(), decision: z.enum(["approve", "reject"]), confirmAdministrative: z.boolean()
}).strict().refine(d => d.decision === "reject" || d.confirmAdministrative, "Confirm administrative-only content before approving.");
export const nonprofitDecisionResult = z.object({document: nonprofitDocument.nullable(), proposal: nonprofitProposal}).strict();
export const nonprofitHistory = z.object({revisions: z.array(nonprofitDocument).max(10)}).strict();
export const nonprofitSearch = z.object({
  search: text(200).default(""), offset: z.number().int().min(0).max(10000).default(0), limit: z.number().int().min(1).max(50).default(25)
}).strict();
export const nonprofitSummary = z.object({
  id, kind: nonprofitKind, title: z.string(), revision: z.number().int().positive(), status: z.string(),
  summary: z.string(), dueDate: date, updatedAt: z.iso.datetime({offset: true})
}).strict();
export const nonprofitSearchResult = z.object({total: z.number().int().nonnegative(), documents: z.array(nonprofitSummary).max(50)}).strict();
export const nonprofitProposalsResult = z.object({total: z.number().int().nonnegative(), proposals: z.array(nonprofitProposal).max(25)}).strict();
export const nonprofitAttention = z.object({items: z.array(z.object({
  id: z.string(), documentId: id, kind: nonprofitKind, title: z.string(), owner: z.string(), dueDate: date,
  revision: z.number().int().positive(), reason: z.string(), evidence: z.string(), priority: z.enum(["high", "normal"])
}).strict()).max(30), total: z.number().int().nonnegative(), asOfDate: z.iso.date()}).strict();
