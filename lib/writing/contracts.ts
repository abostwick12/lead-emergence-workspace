import { z } from "zod";
export const publicationState = z.enum(["draft", "in_review", "ready", "published", "archived"]);
export const resourceSearch = z.object({
  search: z.string().trim().max(200).default(""), state: publicationState.optional(),
  offset: z.number().int().min(0).max(10000).default(0), limit: z.number().int().min(1).max(50).default(25)
}).strict();
export const resourceSummary = z.object({
  id: z.string().uuid(), title: z.string(), author: z.string().nullable(), resource_type: z.string(),
  audience: z.string().nullable(), topics: z.array(z.string()), abstract: z.string().nullable(),
  source_url: z.string().nullable(), source_label: z.string(), source_date: z.string().nullable(),
  retrieved_at: z.string(), epistemic_state: z.enum(["observed","user_stated","inferred","suggested","hypothesized","confirmed","rejected","stale"]),
  publication_state: publicationState, updated_at: z.string()
}).strict();
export const resourceDetail = resourceSummary.extend({ body_text: z.string() });
export const libraryResult = z.object({
  workspaceId: z.string().uuid(), retrievedAt: z.string(),
  total: z.number().int().nonnegative(), awaitingPublication: z.number().int().nonnegative(),
  matchingCount: z.number().int().nonnegative(), resources: z.array(resourceSummary)
}).strict();
export const resourceResult = z.object({
  workspaceId: z.string().uuid(), retrievedAt: z.string(), resource: resourceDetail
}).strict();
export type WritingResource = z.infer<typeof resourceDetail>;
export type WritingLibrary = z.infer<typeof libraryResult>;
export function safeSourceUrl(raw: string | null): string | null {
  try {
    const url = new URL(raw || "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
