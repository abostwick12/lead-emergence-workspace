"use client";
import {taskTargetId} from "@/lib/bundles/task-target";
import {newFounderAction,type MeetingRecord} from "@/lib/nonprofit-bundle/contracts";
import {Field,Choice,Lines,Disclosure,styles} from "./common";
import {ActionFields} from "./action-fields";
export function MeetingFields({value,onChange}:{value:MeetingRecord;onChange:(value:MeetingRecord)=>void}){
 const put=(key:string,v:unknown)=>onChange({...value,[key]:v});
 return <><section className={styles.section}><h2>A meeting worth following through</h2>
 <Field label="Meeting title" value={value.title} max={240} required onChange={v=>put("title",v)}/>
 <div className={styles.grid}><Field label="Meeting date" type="date" value={value.scheduledDate??""} onChange={v=>put("scheduledDate",v||null)}/><Field label="Local meeting time" type="time" value={value.localTime} max={5} onChange={v=>put("localTime",v)}/></div>
 <Field label="Meeting time zone" value={value.timeZone} max={80} onChange={v=>put("timeZone",v)} hint="Use an IANA zone, such as America/Chicago. A recorded plan does not book a calendar or send invitations."/>
 <button type="button" onClick={()=>put("timeZone",Intl.DateTimeFormat().resolvedOptions().timeZone)}>Use my device time zone</button>
 <div className={styles.grid}><Field label="Meeting location" value={value.location} max={500} onChange={v=>put("location",v)}/><Choice label="Meeting status" value={value.status} values={["scheduled","completed","cancelled"]} onChange={v=>put("status",v)}/></div>
 <Lines label="Administrative participants" values={value.participants} onChange={v=>put("participants",v)} max={9640} hint="One name per line, up to 40. Do not list patients or clinical case participants."/>
 <Field label="Meeting agenda" value={value.agenda} multiline max={8000} onChange={v=>put("agenda",v)}/></section>
 <section className={styles.section}><h2>What was decided, and who follows through</h2>
 <Field label="Administrative meeting notes" value={value.notes} multiline max={20000} onChange={v=>put("notes",v)}/>
 <Lines label="Recorded decisions" values={value.decisions} onChange={v=>put("decisions",v)} max={60030} hint="One decision per line. Keep proposed decisions distinct from what participants actually agreed."/>
 {value.actions.map((a,i)=><Disclosure key={a.id} id={taskTargetId("action",a.id)} initialOpen={!a.title} summary={<><strong>{a.title||"Name this meeting action"}</strong><span className={styles.tag}>{a.status.replaceAll("_"," ")}</span></>}>
 <ActionFields value={a} onChange={next=>put("actions",value.actions.map(x=>x.id===a.id?next:x))}/>
 <button type="button" onClick={()=>{if(!a.title||window.confirm("Remove this meeting action from the draft?"))put("actions",value.actions.filter(x=>x.id!==a.id));}}>Remove meeting action {i+1}</button></Disclosure>)}
 <div className={styles.actions}><button type="button" disabled={value.actions.length>=40} onClick={()=>put("actions",[...value.actions,newFounderAction(crypto.randomUUID())])}>Add a meeting action</button></div></section></>;
}
