import { z } from "zod";
const labels = z.array(z.string().min(1).max(240)).max(30);
export const writingMetadata = z.object({
  themes: labels.optional(), scripture_references: labels.optional(), keywords: labels.optional(),
  series: z.string().max(500).optional(), website_summary: z.string().max(3000).optional(),
  seo_description: z.string().max(320).optional(), source_file: z.string().max(500).optional(),
  canonical_file: z.string().max(500).optional(), provider_record_id: z.string().max(500).optional(),
  related_resource_ids: z.array(z.string().uuid()).max(30).optional(),
  duplicate_candidate_ids: z.array(z.string().uuid()).max(30).optional()
}).strict();
export const editableFields = z.object({
  title: z.string().trim().min(1).max(240), author: z.string().max(240).nullable(),
  resource_type: z.enum(["article","sermon","teaching","study_guide","other"]),
  audience: z.string().max(300).nullable(), topics: z.array(z.string().trim().min(1).max(120)).max(30),
  abstract: z.string().max(3000).nullable(), body_text: z.string().max(100000),
  metadata: writingMetadata, publication_state: z.enum(["draft","in_review","ready","archived"])
}).strict();
export const writingPatch = editableFields.partial().refine((value) => Object.keys(value).length > 0, "Choose at least one change.");
export const importResourceInput = z.object({
  requestId: z.string().uuid(),
  resource: editableFields.omit({ publication_state: true }).partial().required({ title: true, body_text: true }).extend({
    source_label: z.string().trim().min(1).max(240),
    source_url: z.string().max(2000).url().refine((raw) => {
      const url = new URL(raw);
      return ["http:","https:"].includes(url.protocol) && !url.username && !url.password;
    }).nullable().optional(),
    source_date: z.iso.date().nullable().optional()
  }).strict()
}).strict();
export const proposeRevisionInput = z.object({
  requestId: z.string().uuid(), resourceId: z.string().uuid(), baseRevision: z.number().int().positive(),
  patch: writingPatch, reason: z.string().trim().min(1).max(2000), evidence: z.string().trim().min(1).max(4000)
}).strict();
export const decideProposalInput = z.object({
  proposalId: z.string().uuid(), expectedRevision: z.number().int().positive(), decision: z.enum(["approve","reject"])
}).strict();
export const importReceipt = z.object({ resourceId: z.string().uuid(), revision: z.number().int().positive(), replayed: z.boolean() }).strict();
export const proposalReceipt = z.object({ proposalId: z.string().uuid(), status: z.enum(["pending","approved","rejected"]), baseRevision: z.number().int().positive() }).strict();
export const decisionReceipt = z.object({ proposalId: z.string().uuid(), status: z.enum(["approved","rejected"]), revision: z.number().int().positive().nullable(), replayed: z.boolean() }).strict();
export const savedProposal = z.object({
  id: z.string().uuid(), resource_id: z.string().uuid(), base_revision: z.number().int().positive(),
  patch: writingPatch, reason: z.string(), evidence: z.string(), origin: z.enum(["user","assistant"]),
  status: z.enum(["pending","approved","rejected"]), created_at: z.string(), decided_at: z.string().nullable(),
  applied_revision: z.number().int().nullable()
}).strict();
export type WritingPatch = z.infer<typeof writingPatch>;
export type SavedProposal = z.infer<typeof savedProposal>;
