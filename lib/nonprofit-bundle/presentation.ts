import {nonprofitDocument,nonprofitSchemas,type NonprofitKind,type NonprofitData,type NonprofitDocument,type FounderPlan,type PartnerRecord,type MeetingRecord,type NonprofitResearch,type FounderAction} from "./contracts";
const line=(label:string,value:string|null|undefined)=>label+": "+(value?.trim()||"Not recorded");
const readable=(value:string)=>value.replaceAll("_"," ");
function action(a:FounderAction){return [a.title,line("Owner",a.owner),line("Due",a.dueDate),line("Status",readable(a.status)),line("Priority",a.priority),line("Next action",a.nextAction),line("Evidence / decision",a.evidence)].join("\n");}
export function describeNonprofit(raw:NonprofitData,kind:NonprofitKind):string{
 const data=nonprofitSchemas[kind].parse(raw);
 if(kind==="plan"){
  const p=data as FounderPlan;
  return [p.title,line("Mission",p.mission),line("Jurisdiction",p.jurisdiction),line("Status",p.status),line("Target",p.targetDate),"MILESTONES",
   ...p.milestones.map((m,i)=>(i+1)+". "+action(m)+"\nCategory: "+readable(m.category)+"\nDepends on: "+(m.dependsOn.map(id=>p.milestones.find(x=>x.id===id)?.title??"Unavailable").join("; ")||"None recorded"))].join("\n\n");
 }
 if(kind==="partner"){
  const p=data as PartnerRecord;
  return [p.title,line("Role",p.role),line("Stage",p.stage),line("Contact",p.contactName),line("Administrative email",p.contactEmail),line("Owner",p.owner),line("Last contact",p.lastContactDate),line("Follow-up",p.followupDate),line("Next action",p.nextAction),line("Administrative notes",p.notes),"OUTREACH DRAFT — NOT SENT\n"+(p.outreachDraft||"No draft recorded.")].join("\n\n");
 }
 if(kind==="meeting"){
  const m=data as MeetingRecord;
  return [m.title,line("Date",m.scheduledDate),line("Local time",m.localTime),line("Time zone",m.timeZone),line("Location",m.location),line("Status",m.status),
   "This is a recorded meeting plan, not a calendar booking or invitation.",line("Administrative participants",m.participants.join("; ")),line("Agenda",m.agenda),
   line("Administrative notes",m.notes),"RECORDED DECISIONS\n"+(m.decisions.map((d,i)=>(i+1)+". "+d).join("\n")||"None recorded."),"FOLLOW-UP ACTIONS",
   ...m.actions.map((a,i)=>(i+1)+". "+action(a))].join("\n\n");
 }
 const r=data as NonprofitResearch;
 return [r.title,line("Category",r.category),line("Jurisdiction",r.jurisdiction),line("Question",r.question),line("Status",readable(r.status)),line("Owner",r.owner),line("Review date",r.reviewDate),
  "SOURCE FINDINGS — RECORDED, NOT INDEPENDENTLY VERIFIED",
  ...(r.sources.length?r.sources.map((s,i)=>["Source "+(i+1)+": "+s.title,line("Authority",s.authority),line("Authority type",readable(s.authorityType)),line("Jurisdiction",s.jurisdiction),line("URL",s.url),line("Reference",s.reference),line("Retrieved",s.retrievedDate),line("Effective",s.effectiveDate),line("Published",s.sourceDate),line("Authority finding",s.finding)].join("\n")):["No sources are recorded. This question is not yet evidence-backed."]),
  "INTERPRETATION ["+r.epistemicState+"]\n"+(r.interpretation||"Not recorded"),line("Uncertainty",r.uncertainty),line("Required next action",r.requiredAction),line("Professional review recommendation",r.professionalReview),
  "Decision support only. A reviewed record does not certify compliance, eligibility or professional approval."
 ].join("\n\n");
}
export function nonprofitHandoff(raw:NonprofitDocument):string{
 const d=nonprofitDocument.parse(raw);
 return ["LEAD EMERGENCE · NONPROFIT FOUNDER", "Saved revision "+d.revision+" · "+d.updatedAt+" · Origin: "+d.origin,
 "Administrative information only. Pending proposals and unsaved changes are excluded. Nothing is sent, booked, published or certified.",
 describeNonprofit(d.data,d.kind)].join("\n\n");
}
const labels:Record<string,string>={title:"Title",mission:"Mission",jurisdiction:"Jurisdiction",status:"Status",targetDate:"Target date",milestones:"Milestones",role:"Relationship role",contactName:"Contact name",contactEmail:"Contact email",stage:"Relationship stage",owner:"Owner",nextAction:"Next action",followupDate:"Follow-up date",lastContactDate:"Last contact",notes:"Notes",outreachDraft:"Outreach draft",scheduledDate:"Meeting date",localTime:"Local time",timeZone:"Time zone",location:"Location",participants:"Participants",agenda:"Agenda",decisions:"Decisions",actions:"Meeting actions",category:"Research category",question:"Question",reviewDate:"Review date",sources:"Sources",interpretation:"Interpretation",uncertainty:"Uncertainty",requiredAction:"Required action",professionalReview:"Professional review",epistemicState:"Interpretation evidence state"};
export function changedNonprofitFields(before:NonprofitData|null,after:NonprofitData):string[]{
 return Object.entries(after).filter(([key,value])=>!before||JSON.stringify((before as Record<string,unknown>)[key])!==JSON.stringify(value)).map(([key])=>labels[key]??key);
}
