"use client";
import {newFounderAction,type FounderPlan,type Milestone} from "@/lib/nonprofit-bundle/contracts";
import {Field,Choice,Disclosure,styles} from "./common";
import {ActionFields} from "./action-fields";
export function PlanFields({value,onChange}:{value:FounderPlan;onChange:(value:FounderPlan)=>void}){
 const put=(key:string,v:unknown)=>onChange({...value,[key]:v});
 const starter=()=>{
  const items:[string,Milestone["category"],string][]=[
   ["Clarify the mission and operating boundaries","formation","Write the intended community benefit and what the initiative will not do."],
   ["Identify formation authorities and professional review","formation","Research the applicable jurisdiction and ask a qualified adviser what applies."],
   ["Agree on governance and accountability","governance","Identify board responsibilities, decision rights and unresolved questions."],
   ["Define partner and volunteer roles","volunteers","Describe the administrative roles and commitments to discuss."],
   ["Build the funding case","funding","Draft a funding story and verify grantmaker eligibility from primary sources."],
   ["Review policies and data boundaries","policy","Identify policies needing professional review; exclude clinical records from this workspace."],
   ["Choose a reviewable launch milestone","launch","Name the evidence and approvals needed for a launch decision."]
  ];
  put("milestones",items.map(([title,category,nextAction])=>({...newFounderAction(crypto.randomUUID()),title,category,nextAction,evidence:"Suggested planning step — not a verified legal requirement.",dependsOn:[]})));
 };
 return <><section className={styles.section}><h2>The initiative in a few words</h2>
 <Field label="Roadmap title" value={value.title} max={240} required onChange={v=>put("title",v)}/>
 <Field label="Mission and operating boundaries" value={value.mission} multiline onChange={v=>put("mission",v)} hint="Describe the administrative initiative. Do not include patient information."/>
 <div className={styles.grid}><Field label="Jurisdiction" value={value.jurisdiction} max={500} onChange={v=>put("jurisdiction",v)} hint="Record the relevant state, country or service area; no jurisdiction is assumed."/><Field label="Target launch or review date" type="date" value={value.targetDate??""} onChange={v=>put("targetDate",v||null)}/></div>
 <Choice label="Roadmap status" value={value.status} values={["active","paused","archived"]} onChange={v=>put("status",v)}/></section>
 <section className={styles.section}><h2>Make the next moves manageable</h2><p className={styles.muted}>Keep a short, owned sequence. Suggested checklist items are not legal requirements. {value.milestones.filter(m=>m.status==="done").length} of {value.milestones.length} marked done.</p>
 {!value.milestones.length&&<div className={styles.empty}><h3>Begin with a practical starting checklist</h3><p>Seven editable planning prompts cover mission, formation, governance, people, funding, policies and launch. No owners or deadlines are invented.</p><button type="button" onClick={starter}>Use the suggested starting checklist</button></div>}
 {value.milestones.map((m,i)=><Disclosure key={m.id} initialOpen={!m.title} summary={<><span className={styles.pill}>{i+1}</span><strong>{m.title||"Name this milestone"}</strong><span className={styles.tag}>{m.status.replaceAll("_"," ")}</span>{m.dueDate&&<span>{m.dueDate}</span>}</>}>
 <ActionFields value={m} milestones={value.milestones} onChange={next=>put("milestones",value.milestones.map(x=>x.id===m.id?next:x))}/>
 <button type="button" onClick={()=>{if(!m.title||window.confirm("Remove this milestone and remove it from other milestones' dependencies? Earlier saved revisions remain recoverable."))put("milestones",value.milestones.filter(x=>x.id!==m.id).map(x=>({...x,dependsOn:x.dependsOn.filter(id=>id!==m.id)})));}}>Remove milestone {i+1}</button></Disclosure>)}
 <div className={styles.actions}><button type="button" disabled={value.milestones.length>=50} onClick={()=>put("milestones",[...value.milestones,{...newFounderAction(crypto.randomUUID()),category:"other",dependsOn:[]}])}>Add a milestone</button></div></section></>;
}
