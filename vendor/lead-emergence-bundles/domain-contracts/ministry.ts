import { z } from "zod";

export const sourceLayers = ["biblical_text", "textual_language", "academic_interpretation", "historical_theology", "reformed_presbyterian", "pcusa", "prior_writing", "ai_synthesis"] as const;
export const sourceLayerLabels: Record<(typeof sourceLayers)[number], string> = {
  biblical_text: "Biblical text", textual_language: "Textual / original-language evidence",
  academic_interpretation: "Academic interpretation", historical_theology: "Historical theology",
  reformed_presbyterian: "Reformed / Presbyterian traditions", pcusa: "PC(USA) sources",
  prior_writing: "Prior writing", ai_synthesis: "AI synthesis"
};
const text = (max: number) => z.string().max(max);
const labels = (count: number, max: number) => z.array(z.string().trim().min(1).max(max)).max(count)
  .refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, "Use each label once.");
const date = z.iso.date().nullable();
export const recordedUrl = z.string().max(2000).url().refine(raw => {
  try { const u = new URL(raw); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
}, "Use a recorded HTTP(S) source URL without credentials.").nullable();
export const theologicalPosition = z.object({
  id: z.string().uuid(), statement: z.string().trim().min(1).max(2000),
  epistemicState: z.enum(["inferred", "user_stated", "confirmed", "rejected"]),
  sourceReference: text(2000)
}).strict();
export const theologicalProfile = z.object({
  traditionContext: text(4000), preferredTranslations: labels(20, 120),
  interpretiveNotes: text(6000), dialoguePreferences: text(3000),
  positions: z.array(theologicalPosition).max(30)
}).strict().refine(p => new Set(p.positions.map(x => x.id)).size === p.positions.length, "Use distinct position identifiers.");
export type TheologicalProfile = z.infer<typeof theologicalProfile>;
export const emptyProfile: TheologicalProfile = { traditionContext: "", preferredTranslations: [], interpretiveNotes: "", dialoguePreferences: "", positions: [] };

export const researchSource = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(500),
  layer: z.enum(sourceLayers), reference: z.string().trim().min(1).max(2000),
  author: text(300), url: recordedUrl, sourceDate: date, retrievedDate: date,
  excerpt: text(8000), comment: text(3000)
}).strict();
export const researchNote = z.object({
  id: z.string().uuid(), kind: z.enum(["observation", "interpretation", "question", "application", "ai_synthesis"]),
  text: z.string().trim().min(1).max(8000), sourceIds: z.array(z.string().uuid()).max(40),
  epistemicState: z.enum(["user_stated", "inferred", "rejected"])
}).strict().refine(n => n.kind !== "ai_synthesis" || n.epistemicState === "inferred", "AI synthesis remains inferred.")
  .refine(n => new Set(n.sourceIds).size === n.sourceIds.length, "Use each source reference once.");
export const researchFields = z.object({
  title: z.string().trim().min(1).max(240), question: z.string().trim().min(1).max(4000),
  passage: text(500), audience: text(300), dueDate: date,
  status: z.enum(["draft", "researching", "ready", "archived"]),
  sources: z.array(researchSource).max(40), notes: z.array(researchNote).max(40),
  teachingOutline: text(60000)
}).strict();
export const researchProject = researchFields.superRefine((p, ctx) => {
  const ids = new Set(p.sources.map(s => s.id));
  if (ids.size !== p.sources.length || new Set(p.notes.map(n => n.id)).size !== p.notes.length)
    ctx.addIssue({ code: "custom", message: "Source and note identifiers must be distinct within each list." });
  if (p.notes.some(n => n.sourceIds.some(id => !ids.has(id))))
    ctx.addIssue({ code: "custom", message: "Every note citation must refer to a source in this project." });
});
export const researchPatch = researchFields.partial().refine(p => Object.keys(p).length > 0, "Choose a change.");
export type ResearchProject = z.infer<typeof researchProject>;
export type ResearchSource = z.infer<typeof researchSource>;
export type ResearchNote = z.infer<typeof researchNote>;
export const emptyProject: ResearchProject = { title: "", question: "", passage: "", audience: "", dueDate: null, status: "researching", sources: [], notes: [], teachingOutline: "" };

export const teachingArchive = z.object({
  title: z.string().trim().min(1).max(240), author: text(300),
  resourceType: z.enum(["sermon", "teaching", "study_guide", "other"]),
  deliveredDate: date, scriptureReferences: labels(40, 240), topics: labels(40, 120),
  audience: text(300), summary: text(3000), bodyText: text(100000),
  sourceLabel: z.string().trim().min(1).max(500), sourceUrl: recordedUrl,
  status: z.enum(["active", "archived"])
}).strict();
export type TeachingArchive = z.infer<typeof teachingArchive>;
export const emptyArchive: TeachingArchive = { title: "", author: "", resourceType: "sermon", deliveredDate: null, scriptureReferences: [], topics: [], audience: "", summary: "", bodyText: "", sourceLabel: "", sourceUrl: null, status: "active" };

export const ministryDocumentKind = z.enum(["profile", "research", "archive"]);
export const ministryDocument = z.object({
  id: z.string().uuid(), kind: ministryDocumentKind, revision: z.number().int().positive(),
  data: z.union([theologicalProfile, researchProject, teachingArchive]).nullable(),
  origin: z.enum(["user", "assistant"]), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true })
}).strict().superRefine((d, ctx) => {
  const schema = d.kind === "profile" ? theologicalProfile.nullable() : d.kind === "research" ? researchProject : teachingArchive;
  if (!schema.safeParse(d.data).success) ctx.addIssue({ code: "custom", message: "Document kind and content must match." });
  if (d.kind === "profile" && d.origin !== "user") ctx.addIssue({ code: "custom", message: "Only a client can confirm a profile." });
});
export type MinistryDocument = z.infer<typeof ministryDocument>;
export const documentResult = z.object({ document: ministryDocument.nullable() }).strict();
export const documentSave = z.object({
  kind: ministryDocumentKind, documentId: z.string().uuid().nullable(), expectedRevision: z.number().int().nonnegative(),
  requestId: z.string().uuid(), data: z.union([theologicalProfile, researchProject, teachingArchive]).nullable(),
  confirmProfile: z.boolean().default(false)
}).strict().superRefine((d, ctx) => {
  const schema = d.kind === "profile" ? theologicalProfile.nullable() : d.kind === "research" ? researchProject : teachingArchive;
  if (!schema.safeParse(d.data).success) ctx.addIssue({ code: "custom", message: "Document kind and content must match." });
  if (d.kind === "profile" && !d.confirmProfile) ctx.addIssue({ code: "custom", message: "Confirm your exact theological preferences." });
});
export const documentSearch = z.object({
  search: text(200).default(""), status: text(20).optional(), offset: z.number().int().min(0).max(10000).default(0),
  limit: z.number().int().min(1).max(50).default(25)
}).strict();
export const documentSummary = z.object({
  id: z.string().uuid(), kind: z.enum(["research", "archive"]), title: z.string(), revision: z.number().int().positive(),
  status: z.string(), passage: z.string(), summary: z.string(), dueDate: date, updatedAt: z.iso.datetime({ offset: true })
}).strict();
export const searchResult = z.object({ total: z.number().int().nonnegative(), documents: z.array(documentSummary) }).strict();
export const researchProposalInput = z.object({
  documentId: z.string().uuid(), expectedRevision: z.number().int().positive(), requestId: z.string().uuid(),
  patch: researchPatch, reason: z.string().trim().min(1).max(2000), evidence: z.string().trim().min(1).max(4000)
}).strict();
export const researchProposal = z.object({
  id: z.string().uuid(), documentId: z.string().uuid(), baseRevision: z.number().int().positive(),
  patch: researchPatch, reason: z.string(), evidence: z.string(), origin: z.enum(["user", "assistant"]),
  status: z.enum(["pending", "approved", "rejected"]), createdAt: z.iso.datetime({ offset: true }),
  appliedRevision: z.number().int().positive().nullable()
}).strict();
export const historyResult = z.object({ revisions: z.array(ministryDocument).max(10), proposals: z.array(researchProposal).max(50) }).strict();
export const decideResearch = z.object({ proposalId: z.string().uuid(), expectedRevision: z.number().int().positive(), decision: z.enum(["approve", "reject"]) }).strict();
