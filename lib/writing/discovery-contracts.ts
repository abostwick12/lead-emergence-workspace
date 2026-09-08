import { z } from "zod";
export const connectionInput = z.object({resourceId:z.string().uuid(),limit:z.number().int().min(1).max(20).default(12)}).strict();
export const writingConnections = z.object({
  resourceId:z.string().uuid(),baseRevision:z.number().int().positive(),retrievedAt:z.string(),matchingCount:z.number().int().nonnegative(),method:z.string(),
  candidates:z.array(z.object({
    id:z.string().uuid(),title:z.string(),author:z.string().nullable(),abstract:z.string().nullable(),source_label:z.string(),source_url:z.string().nullable(),
    revision:z.number().int().positive(),updated_at:z.string(),duplicate_signals:z.array(z.enum(["same_text_ignoring_whitespace","same_title_ignoring_case_and_whitespace","same_recorded_url"])),
    shared_topics:z.array(z.string()),shared_scripture:z.array(z.string())
  }).strict())
}).strict();
export type WritingConnections = z.infer<typeof writingConnections>;
