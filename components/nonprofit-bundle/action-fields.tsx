"use client";
import {actionStates,milestoneCategories,type FounderAction,type Milestone} from "@/lib/nonprofit-bundle/contracts";
import {Field,Choice,styles} from "./common";
export function ActionFields({value,onChange,milestones}:{value:FounderAction|Milestone;onChange:(value:FounderAction|Milestone)=>void;milestones?:Milestone[]}){
 const put=(key:string,v:unknown)=>onChange({...value,[key]:v});
 return <><Field label="Action title" value={value.title} onChange={v=>put("title",v)} max={240} required/>
 <div className={styles.grid}><Field label="Owner" value={value.owner} onChange={v=>put("owner",v)} max={200} hint="Leave blank if nobody has agreed to own this."/><Field label="Due date" type="date" value={value.dueDate??""} onChange={v=>put("dueDate",v||null)}/></div>
 <div className={styles.grid}><Choice label="Action status" value={value.status} values={actionStates} onChange={v=>put("status",v)}/><Choice label="Priority" value={value.priority} values={["normal","high"]} onChange={v=>put("priority",v)}/></div>
 <Field label="Next action" value={value.nextAction} onChange={v=>put("nextAction",v)} max={2000} multiline hint="What concrete step moves this forward?"/>
 <Field label="Evidence or decision behind this action" value={value.evidence} onChange={v=>put("evidence",v)} max={2000} multiline/>
 {"dependsOn" in value&&<><Choice label="Milestone category" value={value.category} values={milestoneCategories} onChange={v=>put("category",v)}/>
 {(milestones?.length??0)>1&&<details className={styles.step}><summary>Dependencies · {value.dependsOn.length} selected</summary><p className={styles.muted}>Choose the milestones that need to finish first. Cycles are not allowed.</p><div className={styles.checklist}>{milestones?.filter(m=>m.id!==value.id).map(m=><label key={m.id}><input type="checkbox" checked={value.dependsOn.includes(m.id)} onChange={e=>put("dependsOn",e.target.checked?[...value.dependsOn,m.id]:value.dependsOn.filter(id=>id!==m.id))}/><span>{m.title||"Untitled milestone"}</span></label>)}</div></details>}</>}
 </>;
}
