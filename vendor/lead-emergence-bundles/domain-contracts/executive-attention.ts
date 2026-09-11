import { z } from "zod";
import {
  executiveCapabilities, executiveSources, executiveTaskKinds,
  executiveReference, executiveReviewState, executivePriority, executiveSharing,
  executiveSharingInput, executiveSignal, emptyExecutiveData, referenceKey, type ExecutiveData
} from "./executive";

export const taskMetadataVersion = "task-metadata-v1" as const;
export const executiveTaskSourceCapabilities = [
  "nonprofit.roadmap", "nonprofit.partners", "nonprofit.meetings",
  "investor.company_research", "investor.thesis", "investor.filings"
] as const;
export const executiveTaskSourceCapability = z.enum(executiveTaskSourceCapabilities);
export const executiveAllCapabilities = [...new Set([...Object.values(executiveCapabilities), ...Object.keys(executiveSources)])];
export const executiveSourceScope = z.object({
  capabilityId: z.enum(executiveAllCapabilities as [string, ...string[]]), level: z.enum(["record", "task"])
}).strict().refine(scope => scope.level === "record" || Object.hasOwn(executiveTaskKinds, scope.capabilityId),
  "This source does not expose a task collection.");
export const executiveSharingV2Input = executiveSharingInput.extend({
  taskCapabilities: z.array(executiveTaskSourceCapability).max(6)
    .refine(xs => new Set(xs).size === xs.length, "Choose each task source once."),
  taskMetadataVersion: z.literal(taskMetadataVersion), confirmExpandedTaskMetadata: z.boolean()
}).superRefine((value, ctx) => {
  if (value.taskCapabilities.some(cap => !value.sourceCapabilities.includes(cap)))
    ctx.addIssue({ code: "custom", message: "Task sharing also needs its parent record source." });
  if (value.taskCapabilities.length && !value.confirmExpandedTaskMetadata)
    ctx.addIssue({ code: "custom", message: "Confirm the exact expanded task metadata selection." });
});
export const executiveSharingV2 = executiveSharing.extend({
  taskCapabilities: z.array(executiveTaskSourceCapability).max(6),
  taskMetadataVersion: z.literal(taskMetadataVersion)
}).superRefine((value, ctx) => {
  if (new Set(value.taskCapabilities).size !== value.taskCapabilities.length
    || value.taskCapabilities.some(cap => !value.sourceCapabilities.includes(cap)))
    ctx.addIssue({ code: "custom", message: "Task permissions do not match their record permissions." });
});
export const executiveRecordMetadata = z.object({
  title: z.string(), state: z.string().nullable(), reviewState: executiveReviewState.nullable(),
  revision: z.number().int().positive(), dueDate: z.iso.date().nullable(),
  sourceUpdatedAt: z.iso.datetime({ offset: true })
}).strict();
export const executiveTaskMetadata = executiveRecordMetadata.extend({
  parentTitle: z.string().max(240), owner: z.string().max(240), nextAction: z.string().max(2000),
  priority: executivePriority, dateState: z.enum(["unknown", "estimated", "announced", "occurred"]).nullable(),
  openPrerequisites: z.number().int().nonnegative().max(50)
}).strict();
export const executiveMetadata = z.union([executiveRecordMetadata, executiveTaskMetadata]);
export const executiveResolvedReference = z.object({
  reference: executiveReference, state: z.enum(["current", "changed", "unavailable"]), metadata: executiveMetadata.nullable()
}).strict().superRefine((item, ctx) => {
  const m = item.metadata;
  if (item.state === "unavailable" ? m !== null : !m || m.revision < item.reference.revision
    || (item.state === "current") !== (m.revision === item.reference.revision)
    || Boolean(item.reference.item) !== ("owner" in m))
    ctx.addIssue({ code: "custom", message: "Source state or metadata scope could not be verified." });
});
export const executiveResolutionV2 = z.object({
  references: z.array(executiveResolvedReference).max(20), retrievedAt: z.iso.datetime({ offset: true })
}).strict();

export const executiveAttentionItem = executiveSignal.extend({
  parentTitle: z.string().max(240).nullable(), state: z.string(),
  owner: z.string().max(240).nullable(), nextAction: z.string().max(2000).nullable(),
  dateState: z.enum(["unknown", "estimated", "announced", "occurred"]).nullable(),
  openPrerequisites: z.number().int().nonnegative().max(50)
}).strict();
export const executiveAttentionQuery = z.object({
  asOfDate: z.iso.date().optional(), offset: z.number().int().min(0).max(2147483000).default(0),
  limit: z.number().int().min(1).max(50).default(25)
}).strict();
const coverage = z.object({
  capabilityId: z.string(), level: z.enum(["record", "task"]),
  state: z.enum(["current", "not_shared", "unavailable"]), total: z.number().int().nonnegative().nullable()
}).strict();
export const executiveAttentionGroupKey=z.enum(["executive","writer_editor","ministry","nonprofit_founder","investor"]);
export function executiveAttentionGroupForCapability(capabilityId:string):z.infer<typeof executiveAttentionGroupKey>{
 if(capabilityId.startsWith("executive."))return "executive";
 if(capabilityId.startsWith("writer."))return "writer_editor";
 if(capabilityId.startsWith("ministry."))return "ministry";
 if(capabilityId.startsWith("nonprofit."))return "nonprofit_founder";
 if(capabilityId.startsWith("investor."))return "investor";
 throw new Error("Unsupported Executive attention capability.");
}
export const executiveAttentionGroup=z.object({
 groupKey:executiveAttentionGroupKey,total:z.number().int().positive()
}).strict();
export const executiveAttentionV2 = z.object({
  schemaVersion: z.literal("2.0"), asOfDate: z.iso.date(), retrievedAt: z.iso.datetime({ offset: true }),
  items: z.array(executiveAttentionItem).max(50), total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(), limit: z.number().int().min(1).max(50),
  coverage: z.array(coverage).length(22),groups:z.array(executiveAttentionGroup).max(15)
}).strict().superRefine((value, ctx) => {
  const keys = new Set([
    ...executiveAllCapabilities.map(cap => cap + ":record"),
    ...Object.keys(executiveTaskKinds).map(cap => cap + ":task")
  ]);
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(value.coverage.map(c => c.capabilityId + ":" + c.level)).size !== keys.size
    || value.coverage.some(c => !keys.has(c.capabilityId + ":" + c.level)))
    issue("Each supported source scope needs exactly one coverage entry.");
  if (value.coverage.some(c => c.state === "current" ? c.total === null : c.total !== null))
    issue("Only checked source scopes may expose counts.");
  if (value.total !== value.coverage.reduce((sum, c) => sum + (c.total ?? 0), 0)
    || value.items.length !== Math.min(value.limit, Math.max(0, value.total - value.offset)))
    issue("Attention counts or paging could not be verified.");
  if(value.groups.reduce((sum,group)=>sum+group.total,0)!==value.total
    ||new Set(value.groups.map(group=>group.groupKey)).size!==value.groups.length)
    issue("Attention group totals could not be verified.");
  if (new Set(value.items.map(item => item.id)).size !== value.items.length
    || value.items.some(item => item.id !== referenceKey(item.source)))
    issue("Attention targets must be unique.");
  if (value.items.some(item => item.source.item ? item.parentTitle === null || item.owner === null || item.nextAction === null
    : item.parentTitle !== null || item.owner !== null || item.nextAction !== null || item.dateState !== null || item.openPrerequisites !== 0))
    issue("Attention fields must match the permitted metadata level.");
  if (value.items.some(item => !value.coverage.some(c => c.capabilityId === item.source.capabilityId
    && c.level === (item.source.item ? "task" : "record") && c.state === "current")))
    issue("Every item must belong to a currently checked scope.");
  if(value.items.some(item=>!value.groups.some(group=>group.groupKey===executiveAttentionGroupForCapability(item.source.capabilityId))))
    issue("Every attention item needs its source group.");
});

// Cursors contain only a stable record/item identity, never a source title.
// A cursor is a traversal boundary, not an authorization token.
const cursorId = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const executiveSourceCursor = z.string().max(180).regex(new RegExp(
  "^[a-z_]+:" + cursorId + "(?::(?:action|milestone|followup|watch_item|catalyst):" + cursorId + ")?$"
));
export const executiveSourceSearchInput = z.object({
  capabilityId: z.enum(executiveAllCapabilities as [string, ...string[]]), level: z.enum(["record", "task"]),
  search: z.string().trim().max(200).default(""), after: executiveSourceCursor.nullable().default(null),
  limit: z.number().int().min(1).max(50).default(20)
}).strict().superRefine((value, ctx) => {
  if (value.level === "task" && !Object.hasOwn(executiveTaskKinds, value.capabilityId))
    ctx.addIssue({ code: "custom", message: "This source does not expose tasks." });
});
export const executiveSourceSearchResult = z.object({
  scope: executiveSourceScope, state: z.enum(["current", "not_shared", "unavailable"]),
  total: z.number().int().nonnegative().nullable(),
  items: z.array(z.object({ reference: executiveReference, metadata: executiveMetadata }).strict()).max(50),
  nextCursor: executiveSourceCursor.nullable(), retrievedAt: z.iso.datetime({ offset: true })
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.state !== "current" && (value.total !== null || value.items.length || value.nextCursor !== null))
    issue("Unavailable source scopes cannot return metadata or counts.");
  if (value.state === "current" && (value.total === null || value.total < value.items.length))
    issue("Current source counts could not be verified.");
  if (value.nextCursor !== null && (!value.items.length
    || value.nextCursor !== sourceCursorKey(value.items[value.items.length - 1].reference)))
    issue("The next page must continue from the last returned source.");
  if (new Set(value.items.map(x => referenceKey(x.reference))).size !== value.items.length
    || value.items.some(x => x.reference.capabilityId !== value.scope.capabilityId
      || Boolean(x.reference.item) !== (value.scope.level === "task")
      || Boolean(x.reference.item) !== ("owner" in x.metadata)
      || x.reference.revision !== x.metadata.revision))
    issue("Source results do not match the requested scope.");
});
export function sourceCursorKey(ref: z.infer<typeof executiveReference>) {
  return ref.kind + ":" + ref.documentId.toLowerCase() + (ref.item ? ":" + ref.item.kind + ":" + ref.item.id.toLowerCase() : "");
}
export function prepareExecutiveFocusBrief(kind: "daily_brief" | "weekly_review", today: string, raw: unknown): ExecutiveData {
  const snapshot = executiveAttentionV2.parse(raw);
  if (snapshot.asOfDate !== today || snapshot.offset !== 0)
    throw new Error("Refresh the first attention page for this date before preparing a brief.");
  const brief = emptyExecutiveData(kind, today);
  if (brief.recordType !== "daily_brief" && brief.recordType !== "weekly_review") throw new Error("Expected a brief.");
  brief.title = (kind === "daily_brief" ? "Daily brief" : "Weekly review") + " — " + today;
  brief.focus = kind === "daily_brief" ? "What deserves my attention today?" : "What changed, what did I learn, and what should happen next?";
  const seen = new Set<string>();
  brief.references = snapshot.items.filter(item => {
    const key = referenceKey(item.source); if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, 20).map(item => item.source);
  brief.summary = snapshot.total
    ? snapshot.total + " saved record/task cues across " + snapshot.coverage.filter(c => c.state === "current").length
      + " checked scopes. Review the linked work and choose a small next-action list."
    : "No cues matched the checked saved-work rules. This does not establish that all work is complete.";
  if (snapshot.total > snapshot.items.length) brief.summary += " Only the first " + snapshot.items.length + " cues were used; review later pages for the rest.";
  const missing = snapshot.coverage.filter(c => c.state === "unavailable").length;
  if (missing) brief.summary += " " + missing + " scopes are unavailable and were not checked.";
  brief.summary += " Unshared record or task scopes, calendars, inboxes and live markets are not checked.";
  if (kind === "weekly_review") {
    brief.periodStart = new Date(Date.parse(today + "T00:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);
    brief.summary += " This is current attention, not a complete record of activity during the period. Add actual outcomes and evidence.";
  }
  brief.reviewState = "inferred";
  return brief;
}
