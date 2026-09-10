import { z } from "zod";
import {
  sourceBatchCommit, sourceBatchItems, sourceBatchReview, sourceBatchSnapshot
} from "@/lib/source-intake/contracts";

export { sourceBatchCommit, sourceBatchItems, sourceBatchReview, sourceBatchSnapshot };
export type { SourceBatchCommit, SourceBatchItem, SourceBatchReview, SourceBatchSnapshot } from "@/lib/source-intake/contracts";

export const saveSourceBatchInput = z.object({
  expectedVersion: z.number().int().nonnegative(), requestId: z.string().uuid(), items: sourceBatchItems
}).strict();
export const clearSourceBatchInput = z.object({ expectedVersion: z.number().int().nonnegative() }).strict();
export const reviewSourceBatchInput = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const commitSourceBatchInput = z.object({
  expectedVersion: z.number().int().positive(), requestId: z.string().uuid(),
  reviewToken: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal(true)
}).strict();
