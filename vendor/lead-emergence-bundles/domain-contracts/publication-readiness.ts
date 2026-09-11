import { z } from "zod";

export const publicationReadinessLimits = Object.freeze({
  maximumDestinationCharacters: 2_000,
  maximumNoteCharacters: 1_000,
  evidenceFreshnessDays: 30,
  maximumQueuePageSize: 50
});

const publicDnsName = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;
const reservedSuffix = /\.(?:internal|intranet|local|localhost|home|lan|test|invalid|onion)$/;

/**
 * Normalize a publication destination without contacting it. Requiring a DNS
 * hostname (rather than an IP literal or local name) keeps every host from
 * accidentally turning this contract into a private-network request target.
 */
export function normalizePublicationDestination(raw: string): string {
  const input = raw.trim();
  if (!input || input.length > publicationReadinessLimits.maximumDestinationCharacters) throw new Error("invalid_publication_destination");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("invalid_publication_destination"); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || !publicDnsName.test(hostname) || reservedSuffix.test(hostname))
    throw new Error("invalid_publication_destination");
  url.hostname = hostname;
  return url.toString();
}

export const publicationDestination = z.string().transform((value, context) => {
  try { return normalizePublicationDestination(value); }
  catch { context.addIssue({ code: "custom", message: "Use a public HTTPS destination with no credentials or custom port." }); return z.NEVER; }
});

export const publicationQueueStage = z.enum(["queued", "blocked", "ready_for_handoff", "handed_off", "removed"]);
export const publicationEvidenceResult = z.enum(["working", "redirected", "broken", "access_limited"]);
export const publicationEvidenceStatus = z.enum(["unchecked", "checked", "stale", "error"]);
export const publicationReviewConfirmations = z.object({
  accuracyAndQuotesReviewed: z.boolean(),
  voiceReviewed: z.boolean(),
  rightsConfirmed: z.boolean()
}).strict();

export const publicationQueueSaveInput = z.object({
  resourceId: z.string().uuid(),
  expectedResourceRevision: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  requestId: z.string().uuid(),
  destinationUrl: publicationDestination.nullable(),
  note: z.string().trim().max(publicationReadinessLimits.maximumNoteCharacters),
  stage: publicationQueueStage,
  confirmations: publicationReviewConfirmations,
  confirmQueueChange: z.literal(true)
}).strict();

export const publicationEvidenceInput = z.object({
  queueId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  requestId: z.string().uuid(),
  result: publicationEvidenceResult,
  finalUrl: publicationDestination.nullable(),
  note: z.string().trim().max(publicationReadinessLimits.maximumNoteCharacters),
  confirmObservation: z.literal(true)
}).strict().superRefine((value, context) => {
  if ((value.result === "redirected") !== (value.finalUrl !== null))
    context.addIssue({ code: "custom", path: ["finalUrl"], message: "A redirected observation needs its final public HTTPS destination; other results do not." });
});

export const publicationLinkEvidence = z.object({
  id: z.string().uuid(),
  resourceRevision: z.number().int().positive(),
  targetUrl: publicationDestination,
  result: publicationEvidenceResult,
  finalUrl: publicationDestination.nullable(),
  note: z.string().max(publicationReadinessLimits.maximumNoteCharacters),
  checkedAt: z.string().datetime({ offset: true })
}).strict();

export const publicationBlockerCode = z.enum([
  "revision_changed", "resource_not_ready", "pending_proposals", "source_uncertain",
  "source_text_missing", "author_missing", "audience_missing", "summary_missing",
  "seo_missing", "topics_missing", "accuracy_review_missing", "voice_review_missing",
  "rights_confirmation_missing", "destination_missing", "link_unchecked", "link_stale", "link_error"
]);
export const publicationBlocker = z.object({
  code: publicationBlockerCode,
  label: z.string().min(1).max(100),
  detail: z.string().min(1).max(500)
}).strict();

export const publicationQueueItem = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  title: z.string().min(1).max(240),
  resourceRevision: z.number().int().positive(),
  currentResourceRevision: z.number().int().positive(),
  version: z.number().int().positive(),
  stage: publicationQueueStage,
  publicationState: z.enum(["draft", "in_review", "ready", "published", "archived"]),
  destinationUrl: publicationDestination.nullable(),
  note: z.string().max(publicationReadinessLimits.maximumNoteCharacters),
  confirmations: publicationReviewConfirmations,
  pendingProposals: z.number().int().nonnegative(),
  evidenceStatus: publicationEvidenceStatus,
  lastEvidence: publicationLinkEvidence.nullable(),
  blockers: z.array(publicationBlocker),
  readyForHandoff: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
}).strict().superRefine((value, context) => {
  if (value.readyForHandoff !== (value.blockers.length === 0))
    context.addIssue({ code: "custom", path: ["readyForHandoff"], message: "Readiness must match the current blocker evidence." });
  if (value.lastEvidence && value.lastEvidence.targetUrl !== value.destinationUrl && value.evidenceStatus !== "stale")
    context.addIssue({ code: "custom", path: ["evidenceStatus"], message: "Evidence for another destination must be stale." });
});
export type PublicationQueueItem = z.infer<typeof publicationQueueItem>;

export const publicationQueueResult = z.object({
  schemaVersion: z.literal("1.0"),
  retrievedAt: z.string().datetime({ offset: true }),
  total: z.number().int().nonnegative(),
  counts: z.object({ queued: z.number().int().nonnegative(), blocked: z.number().int().nonnegative(), readyForHandoff: z.number().int().nonnegative(), handedOff: z.number().int().nonnegative() }).strict(),
  items: z.array(publicationQueueItem).max(publicationReadinessLimits.maximumQueuePageSize)
}).strict();
export type PublicationQueueResult = z.infer<typeof publicationQueueResult>;

export const publicationQueueReceipt = z.object({ item: publicationQueueItem, replayed: z.boolean() }).strict();
export type PublicationQueueReceipt = z.infer<typeof publicationQueueReceipt>;
