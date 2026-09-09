"use client";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveSources,executiveSharingV2,executiveTaskKinds,taskMetadataVersion} from "@/lib/executive-bundle/contracts";
import {useExecutiveRead,useExecutiveAction,useUnsavedExecutive} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,Validation,styles} from "./common";
type Sharing=z.infer<typeof executiveSharingV2>;
export function ExecutiveSources() {
 const read=useExecutiveRead<Sharing>("/api/executive/sources/v2","executive.coordination");
 if(!read.enabled)return <AccessState/>;
 if(read.loading||read.error||!read.data)return <ExecutiveFrame title="Choose what Executive may see" description="Source sharing starts off."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></ExecutiveFrame>;
 return <SourceForm key={read.key+":"+read.data.revision} initial={read.data} refresh={read.retry}/>;
}
function SourceForm({initial,refresh}:{initial:Sharing;refresh:()=>void}) {
 const {bundleExperience}=useWorkspace(),[base,setBase]=useState(initial),[selected,setSelected]=useState<string[]>(initial.sourceCapabilities);
 const [tasks,setTasks]=useState<string[]>(initial.taskCapabilities),[confirm,setConfirm]=useState(false),[confirmTasks,setConfirmTasks]=useState(false);
 const [notice,setNotice]=useState<string|null>(null),action=useExecutiveAction();
 const sorted=(xs:readonly string[])=>[...xs].sort().join("|");
 const dirty=sorted(selected)!==sorted(base.sourceCapabilities)||sorted(tasks)!==sorted(base.taskCapabilities);
 useUnsavedExecutive(dirty);
 const unavailable=selected.filter(cap=>!bundleExperience?.capabilityIds.includes(cap));
 const resetConfirmation=()=>{setConfirm(false);setConfirmTasks(false);setNotice(null);};
 const save=async()=>{
  const result=await action.run<Sharing>("/api/executive/sources/v2",{sourceCapabilities:selected,taskCapabilities:tasks,taskMetadataVersion,
   expectedRevision:base.revision,confirmTaskMetadataOnly:confirm,confirmExpandedTaskMetadata:confirmTasks},true);
  if(result){setBase(result);setSelected(result.sourceCapabilities);setTasks(result.taskCapabilities);resetConfirmation();
   setNotice("Source permissions saved. Future Executive reads use this selection and current source access.");}
 };
 return <ExecutiveFrame title="Choose what Executive may see" description="Bring useful task context together without opening every private workspace. You can change or withdraw these choices at any time.">
 <section className={styles.section}><h2>Your control, source by source</h2>
 <p>Record sharing permits Executive’s native views and your authorized Executive assistant to read record titles, saved status, review state where available, revision, due or review date, and the last update time.</p>
 <p>Individual tasks are a separate choice. They add the parent title, task owner, next action, priority, catalyst date certainty and a count of unfinished prerequisite milestones. Only supported roadmap milestones, follow-ups, meeting actions, watchlist entries and catalysts are included.</p>
 <p>Titles, owners and next actions can be sensitive. Manuscripts, theological profiles, research findings, contact details, source excerpts and underlying notes are not automatically retrieved. This does not connect an inbox, calendar or personal account.</p>
 <form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={action.busy}>
 {Object.entries(executiveSources).map(([cap,source])=>{
 const available=bundleExperience?.capabilityIds.includes(cap),checked=selected.includes(cap);
 return <div className={styles.row} key={cap}>
 <label className={styles.check}><input type="checkbox" checked={checked} disabled={!available&&!checked} onChange={e=>{
  setSelected(old=>e.target.checked?[...old,cap]:old.filter(x=>x!==cap));
  if(!e.target.checked)setTasks(old=>old.filter(x=>x!==cap));resetConfirmation();
 }}/><span>{source.label}{!available?" — source access unavailable":""}</span></label>
 {Object.hasOwn(executiveTaskKinds,cap)&&<label className={styles.check}>
 <input type="checkbox" checked={tasks.includes(cap)} disabled={!checked||(!available&&!tasks.includes(cap))} onChange={e=>{
  setTasks(old=>e.target.checked?[...old,cap]:old.filter(x=>x!==cap));resetConfirmation();
 }}/><span>Include individual tasks — {source.label}</span></label>}
 </div>;
 })}
 <p className={styles.muted}>Saved permission revision {base.revision}. Task permission format: {taskMetadataVersion}. Old record sharing does not grant individual-task access. Removing a record source clears its task grant; re-adding the record does not restore tasks automatically.</p>
 <p className={styles.muted}>Executive’s own admitted records and actions need no cross-bundle sharing. Ministry archive sharing allows explicit reference resolution; it does not generate attention cues from teaching bodies.</p>
 {unavailable.length>0&&<p className={styles.error}>Remove unavailable selections before saving. Keeping a selected source does not override revoked access.</p>}
 <label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I reviewed this exact selection. I permit the record metadata described above—not full private source content—to appear in Executive and its authorized assistant tools.</span></label>
 {tasks.length>0&&<label className={styles.check}><input type="checkbox" checked={confirmTasks} onChange={e=>setConfirmTasks(e.target.checked)}/><span>I separately permit the selected individual-task fields: parent title, task owner, next action, priority, date certainty and unfinished-prerequisite count, alongside record metadata.</span></label>}
 <Validation message={action.error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.actions}><button type="submit" disabled={!confirm||(tasks.length>0&&!confirmTasks)||action.busy||unavailable.length>0}>{action.busy?"Saving permissions…":"Confirm source permissions"}</button>
 <button type="button" onClick={()=>{setSelected([]);setTasks([]);resetConfirmation();}}>Clear all selections</button>
 <button type="button" onClick={()=>{if(!dirty||window.confirm("Discard this unsaved selection and reload current source permissions?"))refresh();}}>Reload saved permissions</button></div>
 </fieldset></form></section><p className={styles.notice}>Removing access stops future source reads. It cannot retract text already read by a person or downloaded outside this workspace. Executive’s own saved notes remain your work.</p>
 </ExecutiveFrame>;
}
