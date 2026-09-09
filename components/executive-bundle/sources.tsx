"use client";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveSources,executiveSharing} from "@/lib/executive-bundle/contracts";
import {useExecutiveRead,useExecutiveAction,useUnsavedExecutive} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,Validation,styles} from "./common";
type Sharing=z.infer<typeof executiveSharing>;
export function ExecutiveSources() {
 const read=useExecutiveRead<Sharing>("/api/executive/sources","executive.coordination");
 if(!read.enabled)return <AccessState/>;
 if(read.loading||read.error||!read.data)return <ExecutiveFrame title="Choose what Executive may see" description="Source sharing starts off."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></ExecutiveFrame>;
 return <SourceForm key={read.key+":"+read.data.revision} initial={read.data} refresh={read.retry}/>;
}
function SourceForm({initial,refresh}:{initial:Sharing;refresh:()=>void}) {
 const {bundleExperience}=useWorkspace(),[base,setBase]=useState(initial),[selected,setSelected]=useState<string[]>(initial.sourceCapabilities);
 const [confirm,setConfirm]=useState(false),[notice,setNotice]=useState<string|null>(null),action=useExecutiveAction();
 const sorted=(xs:readonly string[])=>[...xs].sort().join("|"),dirty=sorted(selected)!==sorted(base.sourceCapabilities);
 useUnsavedExecutive(dirty);
 const unavailable=selected.filter(cap=>!bundleExperience?.capabilityIds.includes(cap));
 const save=async()=>{
  const result=await action.run<Sharing>("/api/executive/sources",{sourceCapabilities:selected,expectedRevision:base.revision,confirmTaskMetadataOnly:confirm},true);
  if(result){setBase(result);setSelected(result.sourceCapabilities);setConfirm(false);setNotice("Source permissions saved. Future Executive reads use this selection and current source access.");}
 };
 return <ExecutiveFrame title="Choose what Executive may see" description="Bring useful task context together without opening every private workspace. You can change or withdraw these choices at any time.">
 <section className={styles.section}><h2>Your control, source by source</h2><p>Sharing permits Executive’s native views and your authorized Executive assistant to read record titles, saved status, review state where available, revision, due or review date, and the last update time.</p>
 <p>Titles can be sensitive. Manuscripts, theological profiles, research findings, contact details, source excerpts and underlying notes are not automatically retrieved. This does not connect an inbox, calendar or personal account.</p>
 <form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={action.busy}>
 {Object.entries(executiveSources).map(([cap,source])=>{
 const available=bundleExperience?.capabilityIds.includes(cap),checked=selected.includes(cap);
 return <label className={styles.check} key={cap}><input type="checkbox" checked={checked} disabled={!available&&!checked} onChange={e=>{setSelected(old=>e.target.checked?[...old,cap]:old.filter(x=>x!==cap));setConfirm(false);setNotice(null);}}/><span>{source.label}{!available?" — source access unavailable":""}</span></label>;
 })}
 <p className={styles.muted}>Saved permission revision {base.revision}. Executive’s own admitted records need no cross-bundle sharing. Ministry archive sharing allows explicit reference resolution; it does not generate attention cues from teaching bodies.</p>
 {unavailable.length>0&&<p className={styles.error}>Remove unavailable selections before saving. Keeping a selected source does not override revoked access.</p>}
 <label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I reviewed this exact selection. I permit the task metadata described above—not full private source content—to appear in Executive and its authorized assistant tools.</span></label>
 <Validation message={action.error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.actions}><button type="submit" disabled={!confirm||action.busy||unavailable.length>0}>{action.busy?"Saving permissions…":"Confirm source permissions"}</button>
 <button type="button" onClick={()=>{setSelected([]);setConfirm(false);setNotice(null);}}>Clear all selections</button>
 <button type="button" onClick={()=>{if(!dirty||window.confirm("Discard this unsaved selection and reload current source permissions?"))refresh();}}>Reload saved permissions</button></div>
 </fieldset></form></section><p className={styles.notice}>Removing access stops future source reads. It cannot retract text already read by a person or downloaded outside this workspace. Executive’s own saved notes remain your work.</p>
 </ExecutiveFrame>;
}
