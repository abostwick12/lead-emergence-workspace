import type { ExecutiveData, ExecutiveDocument, ExecutiveReference } from "./contracts";
import { taskTargetId } from "@/lib/bundles/task-target";
import { executiveSources, executiveReference } from "./contracts";
const words=(key:string)=>key.replace(/([A-Z])/g," $1").replaceAll("_"," ").toLowerCase();
export function describeExecutive(data:ExecutiveData):string {
 // Traverse every saved field rather than silently omitting newer contract fields.
 const describe=(value:unknown,indent=""):string=>{
  if(value===null||value==="")return "Not recorded";
  if(Array.isArray(value))return value.length?value.map((entry,i)=>"\n"+indent+(i+1)+". "+describe(entry,indent+"  ")).join(""):"None recorded";
  if(value&&typeof value==="object")return Object.entries(value).map(([key,child])=>"\n"+indent+words(key)+": "+describe(child,indent+"  ")).join("");
  return String(value);
 };
 return describe(data).trim();
}
export function changedExecutiveFields(before:ExecutiveData,after:ExecutiveData):string[] {
 const a=before as unknown as Record<string,unknown>,b=after as unknown as Record<string,unknown>;
 return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(words);
}
export function executiveHandoff(document:ExecutiveDocument):string {
 return ["LEAD EMERGENCE — SAVED EXECUTIVE RECORD","Revision "+document.revision+" · "+document.updatedAt,
 "Saved work only. Unsaved edits, pending proposals and live linked-source metadata are excluded.",
 "User-authored text is not privacy-redacted. Downloaded copies cannot be retroactively revoked.",
 "This is not a calendar booking, sent message, verified fact or recurring automation.","",describeExecutive(document.data)].join("\n");
}
export function sourceLabel(capability:string):string {
 if(capability==="executive.coordination")return "Executive commitments, decisions and meetings";
 if(capability==="executive.brief")return "Executive daily briefs";
 if(capability==="executive.review")return "Executive weekly reviews";
 return Object.hasOwn(executiveSources,capability)?executiveSources[capability as keyof typeof executiveSources].label:"Unavailable source";
}
export function sourceRoute(ref:ExecutiveReference):string|null {
 if(!executiveReference.safeParse(ref).success)return null;
 const fragment=ref.item?"#"+taskTargetId(ref.item.kind,ref.item.id):"";
 if(ref.capabilityId.startsWith("executive."))return "/workspace/executive/"+ref.kind+"/"+ref.documentId+fragment;
 if(ref.capabilityId==="writer.resource.library")return "/workspace/writing/"+ref.documentId;
 const area=ref.capabilityId.startsWith("ministry.")?"ministry":ref.capabilityId.startsWith("nonprofit.")?"nonprofit":
  ref.capabilityId.startsWith("investor.")?"investing":null;
 return area?"/workspace/"+area+"/"+ref.kind+"/"+ref.documentId+fragment:null;
}
export function browserDate(now=new Date()):string {
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
}
function wallParts(date:Date,timeZone:string):string {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const get=(name:string)=>parts.find(p=>p.type===name)?.value??"";
 return get("year").padStart(4,"0")+"-"+get("month")+"-"+get("day")+"T"+get("hour")+":"+get("minute")+":"+get("second");
}
export function localTimeCandidates(local:string,timeZone:string):string[] {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))return [];
 const naive=Date.parse(local+":00Z");
 if(!Number.isFinite(naive)||new Date(naive).toISOString().slice(0,16)!==local)return [];
 try {
  const offsets=new Set<number>();
  for(let hours=-48;hours<=48;hours+=6){
   const at=naive+hours*3600000;
   offsets.add(Date.parse(wallParts(new Date(at),timeZone)+"Z")-at);
  }
  return [...offsets].map(offset=>new Date(naive-offset).toISOString()).filter(instant=>wallParts(new Date(instant),timeZone)===local+":00").sort();
 }catch{return [];}
}
export function localMeetingTime(instant:string|null,timeZone:string):string {
 if(!instant||!timeZone)return "";try{return wallParts(new Date(instant),timeZone).slice(0,16);}catch{return "";}
}
