import {sourceLayerLabels,type MinistryDocument,type ResearchProject,type TeachingArchive,type TheologicalProfile} from "./contracts";
const shown=(v:string|null|undefined)=>v?.trim()||"Not recorded";
export function describeMinistry(data:MinistryDocument["data"],kind:MinistryDocument["kind"]):string {
 if(data===null)return "No theological profile is set.";
 if(kind==="profile"){
  const p=data as TheologicalProfile;
  return ["Tradition and context: "+shown(p.traditionContext),"Preferred translations: "+(p.preferredTranslations.join("; ")||"Not recorded"),"Interpretive preferences:\n"+shown(p.interpretiveNotes),"Dialogue preferences:\n"+shown(p.dialoguePreferences),...p.positions.map((x,i)=>"Position "+(i+1)+" ["+x.epistemicState.replaceAll("_"," ")+"]\n"+x.statement+"\nSource/context: "+shown(x.sourceReference))].join("\n\n");
 }
 if(kind==="archive"){
  const a=data as TeachingArchive;
  return [a.title,"Author: "+shown(a.author),"Type: "+a.resourceType,"Delivered: "+shown(a.deliveredDate),"Audience: "+shown(a.audience),"Scripture: "+(a.scriptureReferences.join("; ")||"Not recorded"),"Topics: "+(a.topics.join("; ")||"Not recorded"),"Status: "+a.status,"Source: "+a.sourceLabel+"\n"+shown(a.sourceUrl),"Summary:\n"+shown(a.summary),"Teaching text:\n"+shown(a.bodyText),"Historical writing is not confirmation of current theological belief."].join("\n\n");
 }
 const p=data as ResearchProject;
 return [p.title,"Research question: "+p.question,"Passage: "+shown(p.passage),"Audience: "+shown(p.audience),"Teaching date: "+shown(p.dueDate),"Status: "+p.status,
 "RECORDED SOURCES — citations are not independent verification",
 ...p.sources.map((s,i)=>"["+ (i+1)+"] "+s.title+"\nLayer: "+sourceLayerLabels[s.layer]+"\nAuthor: "+shown(s.author)+"\nReference: "+s.reference+"\nURL: "+shown(s.url)+"\nPublication date: "+shown(s.sourceDate)+"\nDate consulted: "+shown(s.retrievedDate)+"\nEvidence:\n"+shown(s.excerpt)+"\nLimitations/context:\n"+shown(s.comment)),
 "RESEARCH NOTES",
 ...p.notes.map((n,i)=>"Note "+(i+1)+" • "+n.kind.replaceAll("_"," ")+" ["+n.epistemicState.replaceAll("_"," ")+"]\n"+n.text+"\nSources: "+(n.sourceIds.map(id=>"["+(p.sources.findIndex(s=>s.id===id)+1)+"]").join(", ")||"None linked — not source-supported in this project")),
 "TEACHING OUTLINE\n"+shown(p.teachingOutline),
 "REVIEW BEFORE TEACHING\n"+(p.sources.length?"Check every source in its original context.":"No sources are recorded.")+"\n"+p.notes.filter(n=>!n.sourceIds.length).length+" note(s) have no linked source. AI synthesis remains inferred. Ready status is not factual or theological verification. Record unresolved interpretations and seek relevant human review."
 ].join("\n\n");
}
export function ministryHandoff(document:MinistryDocument):string {
 if(document.kind==="profile")throw new Error("Theological profiles are not teaching handoffs.");
 return "LEAD EMERGENCE · MINISTRY\nSaved revision "+document.revision+" · "+document.updatedAt+"\nThis handoff contains saved work only. Pending proposals and unsaved changes are excluded.\n\n"+describeMinistry(document.data,document.kind);
}
