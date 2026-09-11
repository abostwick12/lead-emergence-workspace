"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {z} from "zod";
import {executiveDeliveryDefinition,executiveDeliveryList,executiveDeliverySchedule} from "@/lib/executive-bundle/contracts";
import {Choice,Disclosure,Field,ReadState,Validation,styles} from "./common";
import {useExecutiveAction,useExecutiveRead} from "./use-executive";

type DeliveryList=z.infer<typeof executiveDeliveryList>;
type Schedule=z.infer<typeof executiveDeliverySchedule>;
type Kind="daily_brief"|"weekly_review";
const kindLabels:Record<Kind,string>={daily_brief:"Daily brief",weekly_review:"Weekly review"};
const dayLabels=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function browserZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch{return "UTC";}}
function timeLabel(value:string|null,zone:string){if(!value)return "Not scheduled";try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:zone}).format(new Date(value));}catch{return new Date(value).toLocaleString();}}

export function ExecutiveDeliverySchedules({capability,availableKinds}:{capability:string;availableKinds:Kind[]}){
 const read=useExecutiveRead<DeliveryList>("/api/executive/deliveries",capability,undefined,true),action=useExecutiveAction();
 const [editing,setEditing]=useState<Schedule|null>(null),[kind,setKind]=useState<Kind>(availableKinds[0]??"daily_brief"),
  [label,setLabel]=useState("Morning daily brief"),[zone,setZone]=useState(browserZone),[localTime,setLocalTime]=useState("07:30"),
  [policy,setPolicy]=useState("when_attention_summary_changes"),[weekdays,setWeekdays]=useState<number[]>([5]),[confirmed,setConfirmed]=useState(false),[validation,setValidation]=useState<string|null>(null);
 const current=read.data?.schedules.filter(schedule=>schedule.status!=="cancelled")??[];
 const creatable=availableKinds.filter(candidate=>!current.some(schedule=>schedule.definition.deliveryKind===candidate));
 const creatableKey=creatable.join(",");
 const formKind=editing?kind:creatable.includes(kind)?kind:creatable[0]??kind,kindPending=formKind!==kind;
 const formLabel=kindPending?(formKind==="daily_brief"?"Morning daily brief":"Friday weekly review"):label;
 const formLocalTime=kindPending?(formKind==="daily_brief"?"07:30":"16:00"):localTime,formWeekdays=kindPending?[5]:weekdays;
 const reset=(preferred?:Kind)=>{const next=preferred??creatable[0]??availableKinds[0]??"daily_brief";setEditing(null);setKind(next);setLabel(next==="daily_brief"?"Morning daily brief":"Friday weekly review");setZone(browserZone());setLocalTime(next==="daily_brief"?"07:30":"16:00");setPolicy("when_attention_summary_changes");setWeekdays([5]);setConfirmed(false);setValidation(null);};
 const edit=(schedule:Schedule)=>{const definition=schedule.definition;setEditing(schedule);setKind(definition.deliveryKind);setLabel(definition.label);setZone(definition.timeZone);setLocalTime(definition.cadence.localTime);setPolicy(definition.changePolicy);setWeekdays(definition.cadence.kind==="weekly"?definition.cadence.weekdays:[5]);setConfirmed(false);setValidation(null);};
 const changeKind=(value:string)=>{const next=value as Kind;setKind(next);setLabel(next==="daily_brief"?"Morning daily brief":"Friday weekly review");setLocalTime(next==="daily_brief"?"07:30":"16:00");setWeekdays([5]);setConfirmed(false);};
 useEffect(()=>{const choices=creatableKey.split(",").filter(Boolean) as Kind[],next=choices[0];if(!editing&&next&&!choices.includes(kind))changeKind(next);},[creatableKey,editing,kind]);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();const definition={schemaVersion:"1.0",deliveryKind:formKind,label:formLabel,timeZone:zone,cadence:formKind==="daily_brief"?{kind:"daily",localTime:formLocalTime}:{kind:"weekly",localTime:formLocalTime,weekdays:formWeekdays},changePolicy:policy,deliveryTarget:"native_executive_inbox"};
  const parsed=executiveDeliveryDefinition.safeParse(definition);if(!confirmed){setValidation("Confirm the exact schedule, destination, and delivery boundary.");return;}if(!parsed.success){setValidation(parsed.error.issues[0]?.message??"Review the schedule.");return;}
  const result=await action.run<Schedule>("/api/executive/deliveries",{scheduleId:editing?.scheduleId??null,expectedVersion:editing?.version??0,operation:editing?"update":"create",definition:parsed.data,confirmExactSchedule:true},true);
  if(result){reset();read.retry();}
 };
 const lifecycle=async(schedule:Schedule,operation:"pause"|"resume"|"cancel")=>{
  if(operation==="cancel"&&!window.confirm("Cancel this schedule? Its delivery history will remain visible, but this schedule cannot be resumed."))return;
  const result=await action.run<Schedule>("/api/executive/deliveries",{scheduleId:schedule.scheduleId,expectedVersion:schedule.version,operation,definition:null,confirmExactSchedule:true},true);
  if(result){if(editing?.scheduleId===schedule.scheduleId)reset();read.retry();}
 };
 if(!read.enabled)return null;
 return <section className={styles.section} aria-labelledby="executive-delivery-heading"><p className={styles.eyebrow}>Native review rhythm</p><h2 id="executive-delivery-heading">Bring the right review back at the right time</h2>
  <p>These schedules create a review cue inside Executive. They do not send email, post messages, book calendar time, run through an assistant connection, or save a brief or review record.</p>
  <p className={styles.notice}>This installed version has no background runner. A due schedule is evaluated when you open Executive while signed in. If you do not open it, nothing is delivered off-session.</p>
  {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data&&<>
   <div className={styles.scheduleGrid}>{read.data.schedules.map(schedule=><article className={styles.scheduleCard} key={schedule.scheduleId}>
    <p className={styles.eyebrow}>{kindLabels[schedule.definition.deliveryKind]} · {schedule.status}</p><h3>{schedule.definition.label}</h3>
    <p>{schedule.definition.cadence.kind==="daily"?"Every day":"Every "+schedule.definition.cadence.weekdays.map(day=>dayLabels[day-1]).join(", ")} at {schedule.definition.cadence.localTime} · {schedule.definition.timeZone}</p>
    <p className={styles.muted}>Next evaluation: {timeLabel(schedule.nextOccurrence,schedule.definition.timeZone)} · {schedule.definition.changePolicy==="always"?"Always create a native cue":"Create a cue only when the bounded attention summary changes"}</p>
    {!schedule.capabilityAvailable&&<p className={styles.notice}>This schedule is retained, but its {kindLabels[schedule.definition.deliveryKind].toLowerCase()} capability is unavailable. It will not be evaluated unless access returns.</p>}
    <div className={styles.actions}>{schedule.status!=="cancelled"&&schedule.capabilityAvailable&&<button type="button" onClick={()=>edit(schedule)}>Edit</button>}
     {schedule.status==="active"&&<button type="button" disabled={action.busy} onClick={()=>lifecycle(schedule,"pause")}>Pause</button>}
     {schedule.status==="paused"&&schedule.capabilityAvailable&&<button type="button" disabled={action.busy} onClick={()=>lifecycle(schedule,"resume")}>Resume</button>}
     {schedule.status!=="cancelled"&&<button type="button" disabled={action.busy} onClick={()=>lifecycle(schedule,"cancel")}>Cancel</button>}</div>
    <Disclosure summary="Schedule evidence"><p className={styles.muted}>Version {schedule.version} · created {new Date(schedule.createdAt).toLocaleString()} · updated {new Date(schedule.updatedAt).toLocaleString()}</p><p className={styles.muted}>Last evaluated: {schedule.lastEvaluatedAt?new Date(schedule.lastEvaluatedAt).toLocaleString():"not yet"} · last ready cue: {schedule.lastDeliveredAt?new Date(schedule.lastDeliveredAt).toLocaleString():"not yet"}</p></Disclosure>
   </article>)}</div>
   {!read.data.schedules.length&&<p className={styles.empty}>No native review schedules yet. Choose a useful rhythm below; nothing is created until you confirm it.</p>}
   {(editing||creatable.length>0)&&<form onSubmit={submit} className={styles.scheduleEditor}><h3>{editing?"Edit "+kindLabels[formKind].toLowerCase():"Add a native review schedule"}</h3>
    {!editing&&creatable.length>1&&<Choice label="Review" value={formKind} values={creatable} onChange={changeKind} labels={kindLabels}/>}<div className={styles.grid}><Field label="Schedule name" value={formLabel} onChange={value=>{setKind(formKind);setLabel(value);}} max={120} required/><Field label="Named time zone" value={zone} onChange={setZone} max={100} hint="Use a named zone such as America/Chicago so daylight-saving changes are handled." required/><Field label="Local time" type="time" value={formLocalTime} onChange={value=>{setKind(formKind);setLocalTime(value);}} required/><Choice label="When to create a cue" value={policy} values={["when_attention_summary_changes","always"]} onChange={setPolicy} labels={{when_attention_summary_changes:"Only when attention changes",always:"At every occurrence"}}/></div>
    {formKind==="weekly_review"&&<fieldset><legend>Review weekdays</legend><div className={styles.weekdayGrid}>{dayLabels.map((day,index)=><label className={styles.check} key={day}><input type="checkbox" checked={formWeekdays.includes(index+1)} onChange={event=>{setKind(formKind);setWeekdays(days=>event.target.checked?[...days,index+1].sort():days.filter(value=>value!==index+1));}}/>{day}</label>)}</div></fieldset>}
    <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm this exact local schedule and understand it creates only an in-app Executive review cue when I open Executive. It does not send externally or save a finished record.</span></label>
    <Validation message={validation||action.error}/><div className={styles.actions}><button type="submit" disabled={action.busy}>{action.busy?"Saving…":editing?"Save schedule":"Create schedule"}</button>{editing&&<button type="button" onClick={()=>reset()} disabled={action.busy}>Stop editing</button>}</div>
   </form>}
   <h3>Recent schedule activity</h3>{read.data.deliveries.length?<ul className={styles.list}>{read.data.deliveries.map(delivery=><li key={delivery.deliveryId}><article className={styles.row}><p className={styles.eyebrow}>{kindLabels[delivery.deliveryKind]} · {delivery.outcome==="ready"?"review ready":"unchanged; skipped"}</p><h3>{delivery.label}</h3><p>{delivery.reason}</p><p className={styles.muted}>{delivery.currentAttentionCount} total matching cues; {delivery.inspectedHighPriorityCount} high priority in the first {delivery.inspectedAttentionCount} inspected. Evaluated {new Date(delivery.evaluatedAt).toLocaleString()} for the occurrence due {new Date(delivery.dueAt).toLocaleString()}.</p>{delivery.outcome==="ready"&&<Link href={delivery.route}>Open an unsaved {kindLabels[delivery.deliveryKind].toLowerCase()}</Link>}</article></li>)}</ul>:<p className={styles.muted}>No schedule occurrences have been evaluated yet.</p>}
  </>}
 </section>;
}
