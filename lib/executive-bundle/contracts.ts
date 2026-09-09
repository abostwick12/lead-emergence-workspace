export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive-analysis";
export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive-scheduling";
import { z } from "zod";
import { executiveReference, executiveReviewState, referenceKey } from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
import { executiveAttention as attentionBase, executiveSources, executiveCapabilities } from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
export const executiveAttention = attentionBase.superRefine((value,ctx)=>{
  const allowed=new Set([...Object.values(executiveCapabilities),...Object.keys(executiveSources)]);
  if(value.coverage.length!==allowed.size||value.coverage.some(c=>!allowed.has(c.capabilityId))
    ||value.total!==value.coverage.reduce((total,c)=>total+(c.state==="current"?(c.total??0):0),0))
    ctx.addIssue({code:"custom",message:"Attention coverage or matching counts could not be verified."});
});
export const executiveAttentionInput = z.object({ asOfDate: z.iso.date().optional() }).strict();
export const executiveResolveInput = z.object({ references: z.array(executiveReference).max(20)
  .refine(refs => new Set(refs.map(referenceKey)).size === refs.length, "Link each source record once.") }).strict();
const metadata = z.object({
  title: z.string(), state: z.string().nullable(), reviewState: executiveReviewState.nullable(),
  revision: z.number().int().positive(), dueDate: z.iso.date().nullable(), sourceUpdatedAt: z.iso.datetime({offset:true})
}).strict();
export const executiveResolutionResult = z.object({
  references: z.array(z.object({
    reference: executiveReference, state: z.enum(["current","changed","unavailable"]), metadata: metadata.nullable()
  }).strict().superRefine((item,ctx) => {
    if (item.state === "unavailable" ? item.metadata !== null : item.metadata === null
      || item.metadata.revision < item.reference.revision
      || (item.state === "current") !== (item.metadata.revision === item.reference.revision))
      ctx.addIssue({code:"custom",message:"Source status does not match its current metadata."});
  })).max(20), retrievedAt: z.iso.datetime({offset:true})
}).strict();
