import { z } from "zod";
import { workspaceLayoutSchema, applyWorkspaceLayout } from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
import type { BaseBundleExperience, BundleExperience } from "./experience";
export const layoutRecordSchema=z.object({
 workspaceId:z.string().uuid(),revision:z.number().int().min(0),authorityRevision:z.string().min(1),
 preferences:workspaceLayoutSchema,updatedAt:z.string().datetime({offset:true}).nullable(),
 history:z.array(z.object({revision:z.number().int().positive(),preferences:workspaceLayoutSchema,savedAt:z.string().datetime({offset:true})}).strict()).max(20)
}).strict();
export type LayoutRecord=z.infer<typeof layoutRecordSchema>;
export const layoutSaveSchema=z.object({
 preferences:workspaceLayoutSchema,expectedRevision:z.number().int().min(0),
 expectedAuthorityRevision:z.string().min(1).max(200),requestId:z.string().uuid(),confirmed:z.literal(true)
}).strict();
export function personalizeBundleExperience(base:BaseBundleExperience,raw:unknown):BundleExperience {
 const parsed=layoutRecordSchema.safeParse(raw);
 if(!parsed.success || parsed.data.workspaceId!==base.workspaceId || parsed.data.authorityRevision!==base.revision) {
  // Authority survives a preference outage; open editors must not remount.
  // Never silently display an unconfirmed fallback arrangement.
  return {...base,ui:{...base.ui,primaryNavigation:[],dashboardWidgets:[],defaultWorkspaceRoute:"/workspace"},layout:{status:"unavailable",revision:null}};
 }
 const ui=applyWorkspaceLayout(base.ui,parsed.data.preferences);
 return {...base,ui:{...ui,defaultWorkspaceRoute:ui.defaultWorkspaceRoute},layout:{status:"ready",revision:parsed.data.revision,
  defaultUnavailable:ui.defaultWorkspaceRoute!==parsed.data.preferences.defaultWorkspaceRoute}};
}
