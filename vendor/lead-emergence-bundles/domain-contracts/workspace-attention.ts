import {z} from "zod";
import {nativeSearchProviders} from "./workspace-discovery";

// Native-user presentation contract. It never grants Executive/model sharing.
export const attentionTaskKinds=["action","milestone","followup","watch_item","catalyst"] as const;
const taskSources:Record<string,Record<string,typeof attentionTaskKinds[number]>>={
 "executive.coordination":{meeting:"action"},"executive.brief":{daily_brief:"action"},"executive.review":{weekly_review:"action"},
 "nonprofit.roadmap":{plan:"milestone"},"nonprofit.partners":{partner:"followup"},"nonprofit.meetings":{meeting:"action"},
 "investor.company_research":{watchlist:"watch_item",brief:"catalyst"},"investor.thesis":{thesis:"catalyst"},"investor.filings":{filing:"catalyst"}
};
export const attentionSources=[...new Set(nativeSearchProviders.map(p=>p.capabilityIds[0]))].map(capabilityId=>{
 const providers=nativeSearchProviders.filter(p=>p.capabilityIds[0]===capabilityId);
 return {capabilityId,bundleKey:providers[0].bundleKey,bundleLabel:providers[0].bundleLabel,
  label:providers.map(p=>p.label).join(" / "),levels:taskSources[capabilityId]?["record","task"] as const:["record"] as const};
});
export const attentionBundleKey=z.enum(["writer_editor","ministry","nonprofit_founder","investor","executive"]);
export const attentionPriority=z.enum(["high","normal","low"]);
const isoDate=z.iso.date().refine(s=>s<="9999-12-24","Choose a date with room for the seven-day window.");
const scope=z.object({capabilityId:z.string(),level:z.enum(["record","task"])}).strict();
export const nativeAttentionInput=z.object({
 asOfDate:isoDate,authorityRevision:z.string().min(1).max(200),
 bundleKey:attentionBundleKey.nullable().default(null),priority:attentionPriority.nullable().default(null),
 offset:z.number().int().min(0).max(2147483000).multipleOf(25).default(0)
}).strict();
const reference=z.object({capabilityId:z.string(),kind:z.string(),documentId:z.string().uuid(),revision:z.number().int().positive(),
 item:z.object({kind:z.enum(attentionTaskKinds),id:z.string().uuid()}).strict().optional()}).strict().superRefine((r,ctx)=>{
 const provider=nativeSearchProviders.find(p=>p.capabilityIds[0]===r.capabilityId&&p.kind===r.kind);
 if(!provider || r.item&&(taskSources[r.capabilityId]?.[r.kind]!==r.item.kind
  || r.item.kind==="followup"&&r.item.id!==r.documentId))ctx.addIssue({code:"custom",message:"Unknown attention source target."});
});
export const attentionReferenceKey=(r:z.infer<typeof reference>)=>r.capabilityId+":"+r.kind+":"+r.documentId+(r.item?":"+r.item.kind+":"+r.item.id:"");
export function attentionSourceRoute(input:z.infer<typeof reference>){
 const r=reference.parse(input),provider=nativeSearchProviders.find(p=>p.capabilityIds[0]===r.capabilityId&&p.kind===r.kind)!;
 return provider.route+"/"+r.documentId+(r.item?"#task-"+r.item.kind+"-"+r.item.id:"");
}
export const nativeAttentionItem=z.object({
 id:z.string().max(250),source:reference,title:z.string().max(500),priority:attentionPriority,
 dueDate:z.iso.date().nullable(),reason:z.string().max(1500),state:z.string().max(100),
 evidence:z.string().max(1500),action:z.string().max(300),sourceUpdatedAt:z.iso.datetime({offset:true}),
 sourceReviewState:z.enum(["inferred","user_stated","confirmed","rejected","stale"]).nullable(),
 parentTitle:z.string().max(500).nullable(),owner:z.string().max(240).nullable(),nextAction:z.string().max(2000).nullable(),
 dateState:z.enum(["unknown","estimated","announced","occurred"]).nullable(),openPrerequisites:z.number().int().min(0).max(50)
}).strict().superRefine((item,ctx)=>{
 if(item.id!==attentionReferenceKey(item.source) || (item.source.item
  ? item.parentTitle===null||item.owner===null||item.nextAction===null
  : item.parentTitle!==null||item.owner!==null||item.nextAction!==null||item.dateState!==null||item.openPrerequisites!==0))
  ctx.addIssue({code:"custom",message:"Attention metadata does not match its source level."});
});
export const admittedAttentionScopes=(caps:readonly string[])=>caps.includes("workspace.attention")
 ?attentionSources.filter(s=>caps.includes(s.capabilityId)).flatMap(s=>s.levels.map(level=>({capabilityId:s.capabilityId,level}))):[];
const scopeKey=(s:z.infer<typeof scope>)=>s.capabilityId+":"+s.level;
const scopes=z.array(scope).max(22).superRefine((ss,ctx)=>{
 if(new Set(ss.map(scopeKey)).size!==ss.length||ss.some(s=>!attentionSources.some(p=>p.capabilityId===s.capabilityId&&p.levels.some(l=>l===s.level))))
  ctx.addIssue({code:"custom",message:"Attention scope is unsupported or duplicated."});
});
export const nativeAttentionCatalog=z.object({workspaceId:z.string().uuid(),authorityRevision:z.string().min(1).max(200),scopes}).strict();
export const nativeAttentionResult=z.object({
 schemaVersion:z.literal("1.0"),workspaceId:z.string().uuid(),authorityRevision:z.string().min(1).max(200),
 asOfDate:isoDate,retrievedAt:z.iso.datetime({offset:true}),bundleKey:attentionBundleKey.nullable(),priority:attentionPriority.nullable(),
 offset:z.number().int().min(0).max(2147483000).multipleOf(25),total:z.number().int().nonnegative(),overallTotal:z.number().int().nonnegative(),
 coverage:z.array(scope.extend({total:z.number().int().nonnegative()}).strict()).max(22),
 groups:z.array(z.object({bundleKey:attentionBundleKey,priority:attentionPriority,total:z.number().int().positive()}).strict()).max(15),
 items:z.array(nativeAttentionItem).max(25)
}).strict().superRefine((v,ctx)=>{
 const invalid=()=>ctx.addIssue({code:"custom",message:"Attention coverage, counts or filters could not be verified."});
 if(!scopes.safeParse(v.coverage.map(({capabilityId,level})=>({capabilityId,level}))).success)return invalid();
 if(v.coverage.reduce((n,s)=>n+s.total,0)!==v.overallTotal||v.groups.reduce((n,g)=>n+g.total,0)!==v.overallTotal
  || new Set(v.groups.map(g=>g.bundleKey+":"+g.priority)).size!==v.groups.length
  || v.groups.filter(g=>(v.bundleKey===null||g.bundleKey===v.bundleKey)&&(v.priority===null||g.priority===v.priority)).reduce((n,g)=>n+g.total,0)!==v.total
  || v.items.length!==Math.min(25,Math.max(0,v.total-v.offset))||new Set(v.items.map(i=>i.id)).size!==v.items.length)return invalid();
 for(const bundle of attentionBundleKey.options){
  const caps=new Set<string>(attentionSources.filter(s=>s.bundleKey===bundle).map(s=>s.capabilityId));
  if(v.coverage.filter(s=>caps.has(s.capabilityId)).reduce((n,s)=>n+s.total,0)!==v.groups.filter(g=>g.bundleKey===bundle).reduce((n,g)=>n+g.total,0))return invalid();
 }
 for(const item of v.items){
  const src=attentionSources.find(s=>s.capabilityId===item.source.capabilityId);
  if(!src || !v.coverage.some(s=>s.capabilityId===src.capabilityId&&s.level===(item.source.item?"task":"record")&&s.total>0)
   || v.bundleKey!==null&&src.bundleKey!==v.bundleKey || v.priority!==null&&item.priority!==v.priority)return invalid();
 }
});
export type NativeAttentionResult=z.infer<typeof nativeAttentionResult>;
