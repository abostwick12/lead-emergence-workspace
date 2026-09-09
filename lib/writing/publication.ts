import {z} from "zod";
import {resourceDetail,safeSourceUrl} from "./contracts";
export const publicationInput=z.object({resourceId:z.string().uuid(),expectedRevision:z.number().int().positive()}).strict();
export const publicationContext=z.object({resource:resourceDetail,preparedAt:z.string(),pendingProposals:z.number().int().nonnegative()}).strict();
const checklistItem=z.object({id:z.string(),label:z.string(),status:z.enum(["present","needs_attention","human_review"]),detail:z.string()}).strict();
export const publicationPacket=z.object({
 schemaVersion:z.literal("1.0"),resourceId:z.string().uuid(),revision:z.number().int().positive(),preparedAt:z.string(),
 content:z.object({title:z.string(),author:z.string().nullable(),audience:z.string().nullable(),bodyText:z.string(),summary:z.string(),seoDescription:z.string(),
  topics:z.array(z.string()),themes:z.array(z.string()),keywords:z.array(z.string()),scriptureReferences:z.array(z.string()),series:z.string()}).strict(),
 source:z.object({label:z.string(),url:z.string().nullable(),sourceDate:z.string().nullable(),evidenceStatus:z.string()}).strict(),
 recordedState:z.string(),pendingProposals:z.number().int().nonnegative(),checklist:z.array(checklistItem),
 publicationDecision:z.literal("Human review and separate publication authorization are required. This packet is not published.")
}).strict();
export type PublicationPacket=z.infer<typeof publicationPacket>;
export function preparePublication(raw:z.infer<typeof publicationContext>):PublicationPacket {
 const {resource:r,preparedAt,pendingProposals}=publicationContext.parse(raw);
 const checks:z.infer<typeof checklistItem>[]=[];
 const present=(id:string,label:string,value:boolean,detail:string)=>checks.push({id,label,status:value?"present":"needs_attention",detail:value?"Recorded information is present; its accuracy is not verified.":detail});
 present("body","Source text",Boolean(r.body_text.trim()),"Add and review the source text.");
 present("author","Author",Boolean(r.author?.trim()),"Confirm the author.");
 present("audience","Intended reader",Boolean(r.audience?.trim()),"Record the intended reader.");
 present("summary","Website summary",Boolean(r.metadata.website_summary?.trim()),"Prepare a reader-facing website summary.");
 present("seo","SEO description",Boolean(r.metadata.seo_description?.trim()),"Prepare a description; the actual website's field limits still need checking.");
 present("topics","Findable topics",r.topics.length>0,"Choose useful topics from your taxonomy or record a new label.");
 if(pendingProposals)checks.push({id:"proposals",label:"Unresolved proposals",status:"needs_attention",detail:pendingProposals+" proposals are pending. This packet includes only the current saved revision, never those suggestions."});
 if(r.publication_state==="archived")checks.push({id:"archived",label:"Archived resource",status:"needs_attention",detail:"This resource is archived. Confirm whether it should return to an active workflow."});
 if(["inferred","suggested","hypothesized","rejected","stale"].includes(r.epistemic_state))checks.push({id:"source_status",label:"Source uncertainty",status:"needs_attention",detail:"The source is marked "+r.epistemic_state+". Resolve the uncertainty before relying on it."});
 for(const [id,label,detail] of [
  ["accuracy","Accuracy and quotations","Review claims, citations and quotations against their sources."],
  ["voice","Author voice","Compare the final copy with the author's confirmed preferences and intended meaning."],
  ["rights","Rights and permissions","Confirm rights for text, quotations and other included material."],
  ["links","Links and destination","Open and verify links and destination requirements separately. No link or website was fetched for this packet."],
  ["approval","Publication decision","Review the exact final copy and obtain separate authorization before publishing anywhere."]
 ])checks.push({id,label,status:"human_review",detail});
 return publicationPacket.parse({schemaVersion:"1.0",resourceId:r.id,revision:r.revision,preparedAt,
 content:{title:r.title,author:r.author,audience:r.audience,bodyText:r.body_text,summary:r.metadata.website_summary||"",seoDescription:r.metadata.seo_description||"",
 topics:r.topics,themes:r.metadata.themes||[],keywords:r.metadata.keywords||[],scriptureReferences:r.metadata.scripture_references||[],series:r.metadata.series||""},
 source:{label:r.source_label,url:safeSourceUrl(r.source_url),sourceDate:r.source_date,evidenceStatus:r.epistemic_state},recordedState:r.publication_state,pendingProposals,checklist:checks,
 publicationDecision:"Human review and separate publication authorization are required. This packet is not published."});
}
export function publicationText(packet:PublicationPacket){
 const p=publicationPacket.parse(packet),c=p.content;
 return [c.title,c.author?"By "+c.author:"Author not recorded","",c.bodyText,"","--- PUBLICATION HANDOFF ---",
  "Resource: "+p.resourceId+" · revision "+p.revision,"Prepared: "+p.preparedAt,"Recorded source: "+p.source.label,p.source.url?"Recorded URL (not verified): "+p.source.url:"",
  "Source date: "+(p.source.sourceDate||"Not recorded"),"Evidence status: "+p.source.evidenceStatus,"Recorded library state: "+p.recordedState,
  "Intended reader: "+(c.audience||"Not recorded"),"Pending proposals excluded: "+p.pendingProposals,"","Website summary: "+(c.summary||"Not prepared"),"SEO description: "+(c.seoDescription||"Not prepared"),
  "Topics: "+c.topics.join(", "),"Themes: "+c.themes.join(", "),"Keywords: "+c.keywords.join(", "),"Scripture labels: "+c.scriptureReferences.join("; "),"Series: "+c.series,
  "","REVIEW CHECKLIST",...p.checklist.map(x=>x.status.toUpperCase()+" · "+x.label+": "+x.detail),"",p.publicationDecision].join("\n");
}
