import { z } from "zod";

export const provenanceOriginSchema = z.enum([
  "user",
  "authoritative_source",
  "public_source",
  "connected_app",
  "system",
  "ai"
]);

export const epistemicStateSchema = z.enum([
  "observed",
  "user_stated",
  "inferred",
  "suggested",
  "hypothesized",
  "confirmed",
  "rejected",
  "stale"
]);

export const provenanceSchema = z.object({
  origin: provenanceOriginSchema,
  epistemicState: epistemicStateSchema,
  source: z.string().trim().min(1).max(2048).optional(),
  sourceDate: z.string().datetime({ offset: true }).optional(),
  retrievedAt: z.string().datetime({ offset: true }),
  confidence: z.number().min(0).max(1).optional(),
  reviewedBy: z.string().trim().min(1).max(200).optional(),
  reviewedAt: z.string().datetime({ offset: true }).optional()
}).strict().superRefine((value, context) => {
  if ((value.reviewedBy && !value.reviewedAt) || (!value.reviewedBy && value.reviewedAt)) {
    context.addIssue({
      code: "custom",
      message: "reviewedBy and reviewedAt must be recorded together"
    });
  }
  if ((value.epistemicState === "confirmed" || value.epistemicState === "rejected") && !value.reviewedBy) {
    context.addIssue({
      code: "custom",
      message: "confirmed and rejected claims require an accountable reviewer"
    });
  }
});

export type ProvenanceOrigin = z.infer<typeof provenanceOriginSchema>;
export type EpistemicState = z.infer<typeof epistemicStateSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;

export function createProvenance(
  input: Omit<Provenance, "retrievedAt"> & { retrievedAt?: string }
): Provenance {
  return provenanceSchema.parse({
    ...input,
    retrievedAt: input.retrievedAt ?? new Date().toISOString()
  });
}

export function reviewClaim(
  input: Provenance,
  decision: "confirmed" | "rejected",
  reviewedBy: string,
  reviewedAt = new Date().toISOString()
): Provenance {
  return provenanceSchema.parse({
    ...input,
    epistemicState: decision,
    reviewedBy,
    reviewedAt
  });
}

export function isDurableFact(input: Provenance): boolean {
  const provenance = provenanceSchema.parse(input);
  return provenance.epistemicState === "observed"
    || provenance.epistemicState === "user_stated"
    || provenance.epistemicState === "confirmed";
}
