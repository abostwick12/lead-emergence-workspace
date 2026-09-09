"use client";
import {taskTargetId} from "@/lib/bundles/task-target";
import {useState} from "react";
import type {ExecutiveData,ExecutiveAction} from "@/lib/executive-bundle/contracts";
import {executiveReviewState} from "@/lib/executive-bundle/contracts";
import {localTimeCandidates,localMeetingTime} from "@/lib/executive-bundle/presentation";
import {supportedTimeZoneOptions} from "@/lib/workspace/timezones";
import {Field,Choice,NumberField,Disclosure,styles} from "./common";
type Change=(value:ExecutiveData)=>void;
export function ActionFields({actions,onChange,max=10}:{actions:ExecutiveAction[];onChange:(actions:ExecutiveAction[])=>void;max?:number}) {
 const update=(index:number,patch:Partial<ExecutiveAction>)=>onChange(actions.map((a,i)=>i===index?{...a,...patch}:a));
 return <section className={styles.section}><h2>Actions with an owner and a next move</h2>
 {actions.map((a,i)=><Disclosure key={a.id} id={taskTargetId("action",a.id)} initialOpen={!a.title} summary={<>{a.title||"New action"} · {a.state} · {a.reviewState.replaceAll("_"," ")}</>}>
  <Field label="Action" value={a.title} max={240} required onChange={title=>update(i,{title})}/>
  <div className={styles.grid}><Field label="Action owner" value={a.owner} max={240} onChange={owner=>update(i,{owner})}/>
   <Field label="Action due date" type="date" value={a.dueDate??""} onChange={dueDate=>update(i,{dueDate:dueDate||null})}/></div>
  <Choice label="Action state" value={a.state} values={["open","waiting","blocked","completed","cancelled"]} onChange={state=>update(i,{state:state as ExecutiveAction["state"]})}/>
  <Field label="Next action step" value={a.nextAction} max={2000} onChange={nextAction=>update(i,{nextAction})}/>
  <Field label="Action evidence or agreement" value={a.evidence} max={2000} multiline onChange={evidence=>update(i,{evidence})}/>
  <Choice label="Action review state" value={a.reviewState} values={executiveReviewState.options} onChange={reviewState=>update(i,{reviewState:reviewState as ExecutiveAction["reviewState"]})}/>
  <button type="button" onClick={()=>onChange(actions.filter((_,index)=>index!==i))}>Remove action</button>
 </Disclosure>)}
 <button type="button" disabled={actions.length>=max} onClick={()=>onChange([...actions,{id:crypto.randomUUID(),title:"",owner:"",dueDate:null,state:"open",nextAction:"",evidence:"",reviewState:"user_stated"}])}>Add action</button></section>;
}
type Meeting=Extract<ExecutiveData,{recordType:"meeting"}>;
function MeetingTime({value,onChange,onPending}:{value:Meeting;onChange:(value:Meeting)=>void;onPending:(pending:boolean)=>void}) {
 const [local,setLocal]=useState(()=>localMeetingTime(value.startsAt,value.timeZone)),[selection,setSelection]=useState(value.startsAt??""),[pending,setPending]=useState(false);
 const candidates=localTimeCandidates(local,value.timeZone);
 const edit=()=>{setPending(true);onPending(true);setSelection("");};
 const applyTime=(instant:string|null)=>{onChange({...value,startsAt:instant,agreement:"not_agreed"});setSelection(instant??"");setPending(false);onPending(false);};
 return <section className={styles.section}><h2>Meeting time and agreement</h2><p className={styles.muted}>Choose the local time and zone explicitly. A saved time is not a calendar booking.</p>
 <div className={styles.grid}><Field label="Meeting local date and time" type="datetime-local" value={local} onChange={v=>{setLocal(v);edit();}}/>
 <Choice label="Meeting time zone *" value={value.timeZone} values={["",...supportedTimeZoneOptions(["UTC",...(value.timeZone?[value.timeZone]:[])])]} labels={{"":"Choose a time zone"}} onChange={timeZone=>{onChange({...value,timeZone,startsAt:null,agreement:"not_agreed"});edit();}}/></div>
 {pending&&<div className={styles.notice} role="status">{local&&!candidates.length?<p>This local time does not exist in the selected zone, or the date/zone is incomplete. Choose a valid time; daylight-saving gaps are not guessed.</p>:candidates.length>1?<><p>This local hour occurs twice. Choose the intended instant.</p>{candidates.map(at=><label className={styles.check} key={at}><input type="radio" name="meeting-instant" checked={selection===at} onChange={()=>setSelection(at)}/><span>{new Intl.DateTimeFormat("en-US",{timeZone:value.timeZone,dateStyle:"medium",timeStyle:"long"}).format(new Date(at))} · UTC {at}</span></label>)}</>:<p>Apply this time below before saving the record. Changing a time clears reported agreement.</p>}
 <button type="button" disabled={!!local&&(candidates.length===0||candidates.length>1&&!candidates.includes(selection))} onClick={()=>applyTime(local?(candidates.length===1?candidates[0]:selection):null)}>{local?"Use this meeting time":"Keep meeting time unassigned"}</button></div>}
 {value.startsAt&&!pending&&<p className={styles.muted}>Recorded instant: {value.startsAt} · displayed in {value.timeZone}</p>}
 <div className={styles.grid}><NumberField label="Duration in minutes" value={value.durationMinutes} min={5} max={480} onChange={durationMinutes=>onChange({...value,durationMinutes:durationMinutes??0,agreement:"not_agreed"})}/>
 <Choice label="Meeting agreement" value={value.agreement} values={["not_agreed","user_reported_agreed"]} onChange={agreement=>onChange({...value,agreement:agreement as Meeting["agreement"]})}/></div>
 <p className={styles.muted}>“User reported agreed” records your confirmation of an actual agreement. It does not send invitations or check anyone’s availability.</p>
 </section>;
}
export function RecordFields({value,onChange,onTimePending}:{value:ExecutiveData;onChange:Change;onTimePending:(pending:boolean)=>void}) {
 return <>
 <section className={styles.section}><h2>{value.recordType==="commitment"?"What needs to happen?":value.recordType==="decision"?"What needs to be decided?":value.recordType==="meeting"?"What should this meeting achieve?":"Make the next move clear"}</h2>
 <Field label="Title" value={value.title} max={240} required onChange={title=>onChange({...value,title})}/>
 {value.recordType==="commitment"&&<><Field label="Desired outcome" value={value.outcome} max={4000} multiline required onChange={outcome=>onChange({...value,outcome})}/>
 <Field label="Highest-value next action" value={value.nextAction} max={2000} onChange={nextAction=>onChange({...value,nextAction})}/>
 <div className={styles.grid}><Field label="Owner" value={value.owner} max={240} onChange={owner=>onChange({...value,owner})}/><Choice label="Commitment state" value={value.state} values={["open","waiting","blocked","completed","cancelled"]} onChange={state=>onChange({...value,state:state as typeof value.state,completedOn:state==="completed"?value.completedOn:null})}/></div>
 <div className={styles.grid}><Field label="Due date" value={value.dueDate??""} type="date" onChange={dueDate=>onChange({...value,dueDate:dueDate||null})}/><Field label="Follow-up date" value={value.followupDate??""} type="date" onChange={followupDate=>onChange({...value,followupDate:followupDate||null})}/></div>
 {(value.state==="blocked"||value.blocker)&&<Field label="What is blocking this?" value={value.blocker} max={2000} required={value.state==="blocked"} multiline onChange={blocker=>onChange({...value,blocker})}/>}
 {value.state==="completed"&&<Field label="Actual completion date" value={value.completedOn??""} type="date" required onChange={completedOn=>onChange({...value,completedOn:completedOn||null})}/>}</>}
 {value.recordType==="decision"&&<><Field label="Decision question" value={value.question} multiline required onChange={question=>onChange({...value,question})}/>
 <div className={styles.grid}><Field label="Decision owner" value={value.owner} max={240} onChange={owner=>onChange({...value,owner})}/><Field label="Decision due date" value={value.dueDate??""} type="date" onChange={dueDate=>onChange({...value,dueDate:dueDate||null})}/></div>
 <Choice label="Decision state" value={value.state} values={["open","decided","deferred","reversed"]} onChange={state=>onChange({...value,state:state as typeof value.state,...(state==="open"?{selectedOptionId:null,decidedOn:null}:{})})}/>
 <Field label="Next decision step" value={value.nextAction} max={2000} onChange={nextAction=>onChange({...value,nextAction})}/></>}
 {value.recordType==="meeting"&&<><Field label="Meeting objective" value={value.objective} multiline required onChange={objective=>onChange({...value,objective})}/>
 <Choice label="Meeting state" value={value.state} values={["planned","held","cancelled"]} onChange={state=>onChange({...value,state:state as typeof value.state})}/>
 <Field label="Agenda" value={value.agenda} max={8000} multiline onChange={agenda=>onChange({...value,agenda})}/>
 <Field label="Location or meeting link" value={value.location} max={1000} onChange={location=>onChange({...value,location})}/></>}
 {(value.recordType==="daily_brief"||value.recordType==="weekly_review")&&<><Field label="Focus" value={value.focus} max={2000} required onChange={focus=>onChange({...value,focus})}/>
 <div className={styles.grid}><Field label="Period start" value={value.periodStart} type="date" required onChange={periodStart=>onChange({...value,periodStart,...(value.recordType==="daily_brief"?{periodEnd:periodStart}:{})})}/>
 {value.recordType==="weekly_review"&&<Field label="Period end" value={value.periodEnd} type="date" required onChange={periodEnd=>onChange({...value,periodEnd})}/>}</div>
 <Field label="Brief summary" value={value.summary} max={8000} multiline onChange={summary=>onChange({...value,summary})}/>
 <Choice label="Brief state" value={value.state} values={["draft","reviewed","archived"]} onChange={state=>onChange({...value,state:state as typeof value.state})}/></>}
 </section>
 {value.recordType==="decision"&&<section className={styles.section}><h2>Options and tradeoffs</h2>{value.options.map((o,i)=>{
 const update=(patch:Partial<typeof o>)=>onChange({...value,options:value.options.map((old,index)=>index===i?{...old,...patch}:old)});
 return <Disclosure key={o.id} initialOpen={!o.title} summary={o.title||"New option"}><Field label="Option" value={o.title} max={240} required onChange={title=>update({title})}/>
 <div className={styles.grid}><Field label="Upside" value={o.upside} max={2000} multiline onChange={upside=>update({upside})}/><Field label="Downside" value={o.downside} max={2000} multiline onChange={downside=>update({downside})}/></div>
 <Field label="Option evidence" value={o.evidence} max={4000} multiline onChange={evidence=>update({evidence})}/>
 <button type="button" disabled={value.selectedOptionId===o.id} onClick={()=>onChange({...value,options:value.options.filter((_,index)=>index!==i)})}>Remove option</button></Disclosure>;
 })}<button type="button" disabled={value.options.length>=12} onClick={()=>onChange({...value,options:[...value.options,{id:crypto.randomUUID(),title:"",upside:"",downside:"",evidence:""}]})}>Add option</button>
 {value.state!=="open"&&<><Choice label="Chosen option" value={value.selectedOptionId??""} values={["",...value.options.map(o=>o.id)]} labels={{"":"Not decided",...Object.fromEntries(value.options.map(o=>[o.id,o.title||"Untitled option"]))}} onChange={selectedOptionId=>onChange({...value,selectedOptionId:selectedOptionId||null})}/>
 <Field label="Decision date" type="date" value={value.decidedOn??""} onChange={decidedOn=>onChange({...value,decidedOn:decidedOn||null})}/>
 <Field label="Decision rationale" value={value.rationale} max={4000} multiline required={["decided","reversed"].includes(value.state)} onChange={rationale=>onChange({...value,rationale})}/></>}
 <Field label="What would make you revisit this?" value={value.revisitTrigger} max={2000} multiline onChange={revisitTrigger=>onChange({...value,revisitTrigger})}/></section>}
 {value.recordType==="meeting"&&<><MeetingTime value={value} onChange={onChange} onPending={onTimePending}/>
 <section className={styles.section}><h2>People and outcomes</h2>{value.participants.map((p,i)=><div className={styles.grid} key={i}><Field label={"Participant "+(i+1)} value={p.name} max={240} required onChange={name=>onChange({...value,agreement:"not_agreed",participants:value.participants.map((old,index)=>index===i?{...old,name}:old)})}/><Field label={"Role "+(i+1)} value={p.role} max={240} onChange={role=>onChange({...value,agreement:"not_agreed",participants:value.participants.map((old,index)=>index===i?{...old,role}:old)})}/><button type="button" onClick={()=>onChange({...value,agreement:"not_agreed",participants:value.participants.filter((_,index)=>index!==i)})}>Remove participant {i+1}</button></div>)}
 <button type="button" disabled={value.participants.length>=30} onClick={()=>onChange({...value,agreement:"not_agreed",participants:[...value.participants,{name:"",role:""}]})}>Add participant</button>
 <Field label="Recorded meeting outcome" value={value.outcome} max={8000} required={value.state==="held"} multiline onChange={outcome=>onChange({...value,outcome})}/></section></>}
 {(value.recordType==="daily_brief"||value.recordType==="weekly_review")&&<section className={styles.section}><h2>Observations, interpretation and reflection</h2><p className={styles.muted}>Classification and review state are separate. Name the evidence; do not turn a suggestion into an established fact.</p>
 {value.observations.map((o,i)=>{
 const update=(patch:Partial<typeof o>)=>onChange({...value,observations:value.observations.map((old,index)=>index===i?{...old,...patch}:old)});
 return <Disclosure key={o.id} initialOpen={!o.text} summary={<>{o.text.slice(0,100)||"New observation"} · {o.classification} · {o.reviewState.replaceAll("_"," ")}</>}>
 <Field label="Observation or interpretation" value={o.text} max={3000} multiline required onChange={text=>update({text})}/>
 <Choice label="Classification" value={o.classification} values={["observation","interpretation","suggestion"]} onChange={classification=>update({classification:classification as typeof o.classification})}/>
 <Field label="Supporting evidence and limits" value={o.evidence} max={2000} multiline required onChange={evidence=>update({evidence})}/>
 <Choice label="Observation review state" value={o.reviewState} values={executiveReviewState.options} onChange={reviewState=>update({reviewState:reviewState as typeof o.reviewState})}/>
 <button type="button" onClick={()=>onChange({...value,observations:value.observations.filter((_,index)=>index!==i)})}>Remove observation</button></Disclosure>;
 })}<button type="button" disabled={value.observations.length>=20} onClick={()=>onChange({...value,observations:[...value.observations,{id:crypto.randomUUID(),text:"",classification:"observation",evidence:"",reviewState:"user_stated"}]})}>Add observation</button>
 <Field label={value.recordType==="weekly_review"?"What changed, what did you learn, and what will you do differently?":"Reflection and unresolved questions"} value={value.reflection} max={8000} multiline onChange={reflection=>onChange({...value,reflection})}/></section>}
 {"actions" in value&&<ActionFields actions={value.actions} max={value.recordType==="meeting"?30:10} onChange={actions=>onChange({...value,actions})}/>}
 <section className={styles.section}><h2>Priority and review</h2><div className={styles.grid}><Choice label="Priority" value={value.priority} values={["high","normal","low"]} onChange={priority=>onChange({...value,priority:priority as ExecutiveData["priority"]})}/>
 <Choice label="Record review state" value={value.reviewState} values={executiveReviewState.options} onChange={reviewState=>onChange({...value,reviewState:reviewState as ExecutiveData["reviewState"]})}/></div>
 <p className={styles.muted}>Confirmed means you reviewed the record; it is not independent verification or permission to act externally.</p>
 <Field label="Next review date" value={value.reviewDate??""} type="date" onChange={reviewDate=>onChange({...value,reviewDate:reviewDate||null})}/>
 <Field label="Notes" value={value.notes} max={12000} multiline onChange={notes=>onChange({...value,notes})}/></section>
 </>;
}
