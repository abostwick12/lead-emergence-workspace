export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive-analysis";
export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive-scheduling";
export * from "@/vendor/lead-emergence-bundles/domain-contracts/executive-attention";
export { executiveResolutionV2 as executiveResolutionResult } from "@/vendor/lead-emergence-bundles/domain-contracts/executive-attention";
import { z } from "zod";
import { executiveReference, referenceKey } from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
import { executiveAttention as attentionBase, executiveSources, executiveCapabilities } from "@/vendor/lead-emergence-bundles/domain-contracts/executive";
export const executiveAttention = attentionBase.superRefine((value,ctx)=>{
  const allowed=new Set([...Object.values(executiveCapabilities),...Object.keys(executiveSources)]);
  if(value.coverage.length!==allowed.size||value.coverage.some(c=>!allowed.has(c.capabilityId))
    ||value.total!==value.coverage.reduce((total,c)=>total+(c.state==="current"?(c.total??0):0),0))
    ctx.addIssue({code:"custom",message:"Attention coverage or matching counts could not be verified."});
});
export const executiveAttentionInput = z.object({ asOfDate: z.iso.date().optional() }).strict();
export const executiveResolveInput = z.object({ references: z.array(executiveReference).max(20)
  .refine(refs => new Set(refs.map(referenceKey)).size === refs.length, "Link each source record or task once.") }).strict();
