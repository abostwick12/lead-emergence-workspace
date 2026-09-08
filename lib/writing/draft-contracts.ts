import { z } from "zod";
export const draftValues = z.object({
  title:z.string().max(240),author:z.string().max(240),resource_type:z.string().max(30),audience:z.string().max(300),topics:z.string().max(3630),
  abstract:z.string().max(3000),body_text:z.string().max(100000),website_summary:z.string().max(3000),seo_description:z.string().max(320),
  publication_state:z.string().max(30),reason:z.string().max(2000),evidence:z.string().max(4000),source_label:z.string().max(240),
  source_url:z.string().max(2000),source_date:z.string().max(10),source_file:z.string().max(500)
}).partial().strict();
export type DraftValues = z.infer<typeof draftValues>;
export const workingDraft = z.object({
  version:z.number().int().nonnegative(),baseRevision:z.number().int().positive().nullable(),requestId:z.string().uuid().nullable(),
  values:draftValues.nullable(),savedAt:z.string().nullable()
}).strict();
export type WorkingDraft = z.infer<typeof workingDraft>;
export const saveDraftInput = z.object({
  resourceId:z.string().uuid().nullable(),expectedVersion:z.number().int().nonnegative(),baseRevision:z.number().int().positive().nullable(),
  requestId:z.string().uuid(),values:draftValues
}).strict();
export const clearDraftInput = saveDraftInput.pick({resourceId:true,expectedVersion:true});
