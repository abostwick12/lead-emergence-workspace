"use client";
import {useMemo,useState} from "react";
import {proposeExecutiveTimes,chooseExecutiveMeetingTime,executiveAvailabilityMatches,type ExecutiveMeetingAvailability} from "@/lib/executive-bundle/contracts";
import {availabilityDraft,blankAvailabilityWindow,reviewedAvailability,meetingAvailabilityContext,type Meeting,type WindowDraft,type AvailabilityDraft} from "@/lib/executive-bundle/availability";
import {localTimeCandidates} from "@/lib/executive-bundle/presentation";
import {supportedTimeZoneOptions} from "@/lib/workspace/timezones";
import {Choice,Field,NumberField,styles} from "./common";

type Prepared={availability:ExecutiveMeetingAvailability;result:ReturnType<typeof proposeExecutiveTimes>};
export function AvailabilityPlanner({meeting,onStage,onChoose,onRemove,onPending}:{meeting:Meeting;onStage:(snapshot:ExecutiveMeetingAvailability)=>void;
 onChoose:(meeting:Meeting)=>boolean;onRemove:()=>void;onPending:(pending:boolean)=>void}){
 const [draft,setDraft]=useState(()=>availabilityDraft(meeting)),[pending,setPending]=useState(false),
  [prepared,setPrepared]=useState<Prepared|null>(null),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const context=meetingAvailabilityContext(meeting),contextMatches=draft.context===context;
 const changed=(next:AvailabilityDraft,keepCheck=false)=>{
  setDraft({...next,...(keepCheck?{}:{checkedAt:null})});setPending(true);onPending(true);setPrepared(null);setError(null);setNotice(null);
 };
 const format=(instant:string)=>new Intl.DateTimeFormat(undefined,{timeZone:meeting.timeZone,dateStyle:"medium",timeStyle:"short"}).format(new Date(instant));
 const calculate=()=>{
  try{const availability=reviewedAvailability(draft,meeting),result=proposeExecutiveTimes(availability.input);
   setPrepared({availability,result});setError(null);setNotice(null);
  }catch(caught){setPrepared(null);setError(caught instanceof Error?caught.message:"Review the availability fields.");}
 };
 const stage=(start?:string)=>{
  if(!prepared)return;
  try{
   if(!executiveAvailabilityMatches(meeting,prepared.availability))throw new Error("The participants, duration or time zone changed. Review availability again.");
   // Recheck on click; leaving the page open never makes an old choice fresh.
   proposeExecutiveTimes(prepared.availability.input);
   if(start){if(!onChoose(chooseExecutiveMeetingTime(meeting,prepared.availability,start)))return;}
   else onStage(prepared.availability);
   setPending(false);onPending(false);setNotice(start?"Proposed time and reviewed availability added to the unsaved meeting. Confirm and save; agreement is still needed.":"Reviewed availability added to the unsaved meeting. Confirm and save to keep it.");
  }catch(caught){setPrepared(null);setError(caught instanceof Error?caught.message:"Recheck availability before using it.");}
 };
 const discard=()=>{
  if(pending&&!window.confirm("Discard unapplied availability edits? Your on-screen meeting and saved revisions stay unchanged."))return;
  setDraft(availabilityDraft(meeting));setPrepared(null);setPending(false);onPending(false);setError(null);setNotice(null);
 };
 const active=prepared&&executiveAvailabilityMatches(meeting,prepared.availability)?prepared:null;
 return <details className={styles.detail}>
  <summary>Find times from reviewed availability</summary>
  <section aria-label="Meeting availability planner">
   <p>Find up to three options from availability you have checked. No calendar is connected, and no invitation will be sent.</p>
   <details><summary>What is saved and shared?</summary><p>Availability is saved with this private meeting only after exact confirmation. Authorized Executive assistants and saved-record downloads include it. Cross-bundle attention and weekly outcome metadata exclude it. Review any download before sharing.</p></details>
   {meeting.availability&&<details><summary>Previously reviewed availability</summary><p>{meeting.availability.input.source} · checked {new Date(meeting.availability.input.checkedAt).toISOString()}.
    {!executiveAvailabilityMatches(meeting,meeting.availability)&&" This snapshot was for different participants, duration or meeting zone; review it again."}</p></details>}
   <p>Planning for {meeting.participants.length?meeting.participants.map(p=>p.name||"Unnamed participant").join(", "):"no recorded participants"} · {meeting.durationMinutes} minutes · {meeting.timeZone||"choose a meeting zone above"}.</p>
   <Choice label="Availability entry time zone" value={draft.zone} values={supportedTimeZoneOptions([draft.zone,meeting.timeZone,"UTC"].filter(Boolean))}
    onChange={zone=>changed({...draft,zone,offered:draft.offered.map(clearSelections),available:draft.available.map(clearSelections),busy:draft.busy.map(clearSelections)})}/>
   <p className={styles.muted}>Changing this zone reinterprets the clock times below and requires a fresh check. Suggestions use the meeting’s zone.</p>
   {(["offered","available","busy"] as const).map(kind=><section key={kind} aria-label={kind+" windows"}>
    <h3>{kind==="offered"?"Times offered for this meeting":kind==="available"?"Your available windows":"Known conflicts"}</h3>
    {kind==="offered"&&<p className={styles.muted}>Each window must work for all required attendees. Separate people’s offers are not shared availability.</p>}
    {draft[kind].map((value,index)=><WindowFields key={value.id} label={kind+" window "+(index+1)} value={value} zone={draft.zone}
     onChange={next=>changed({...draft,[kind]:draft[kind].map(w=>w.id===value.id?next:w)})}
     onRemove={()=>changed({...draft,[kind]:draft[kind].filter(w=>w.id!==value.id)})}/>)}
    {!draft[kind].length&&<p>{kind==="busy"?"No conflicts entered. This is not a calendar check.":"Add at least one explicit window."}</p>}
    <button type="button" disabled={draft[kind].length>=(kind==="busy"?200:20)} onClick={()=>changed({...draft,[kind]:[...draft[kind],blankAvailabilityWindow(crypto.randomUUID())]})}>Add {kind} window</button>
    {kind==="available"&&<button type="button" onClick={()=>{if(draft.available.some(w=>w.start||w.end)&&!window.confirm("Replace your entered available windows with copies of the offered windows?"))return;
     changed({...draft,available:draft.offered.map(w=>({...w,id:crypto.randomUUID()}))});}}>I am available throughout the offered windows</button>}
   </section>)}
   <NumberField label="Buffer before and after busy time, in minutes" value={draft.bufferMinutes} min={0} max={120} onChange={bufferMinutes=>changed({...draft,bufferMinutes:bufferMinutes??-1})}/>
   <p className={styles.muted}>The buffer also protects the start and end of your available time. Suggested alternatives are at least this far apart; they are options for one meeting, not multiple bookings.</p>
   <Field label="Where and with whom availability was checked" value={draft.source} max={240} required onChange={source=>changed({...draft,source})}/>
   <button type="button" onClick={()=>changed({...draft,checkedAt:new Date().toISOString(),context},true)}>Confirm I rechecked these windows now</button>
   <p role="status">{draft.checkedAt&&contextMatches?"User-reported availability check: "+draft.checkedAt+". This is not independently verified.":"A fresh check is needed after editing windows, source, buffer, participants, duration or meeting zone."}</p>
   <div className={styles.actions}><button type="button" disabled={!draft.checkedAt||!contextMatches||!meeting.timeZone} onClick={calculate}>Find proposed meeting times</button>
    <button type="button" onClick={discard}>Discard unapplied availability edits</button></div>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   {active&&<section aria-label="Proposed meeting times">
    <h3>{active.result.status==="no_overlap"?"No suitable overlap found":"Proposed times to agree together"}</h3>
    {active.result.status==="no_overlap"&&<p>No meeting fits the entered windows, duration, conflicts and buffers. Ask for new windows or review those constraints; no availability has been invented.</p>}
    <ol>{active.result.slots.map((slot,index)=><li key={slot.start}><p><time dateTime={slot.start}>{format(slot.start)}</time>–<time dateTime={slot.end}>{format(slot.end)}</time> · {meeting.timeZone}</p>
     <p className={styles.muted}>{slot.start} to {slot.end} · UTC</p>
     <button type="button" onClick={()=>stage(slot.start)}>Use proposed time {index+1}</button></li>)}</ol>
    <p>At most three earliest nonoverlapping alternatives on a five-minute grid. Not an exhaustive list. No invitation, booking or agreement is created.</p>
    <button type="button" onClick={()=>stage()}>Keep reviewed availability without choosing a time</button>
   </section>}
   {prepared&&!active&&<p role="status">Meeting details changed. Confirm a fresh check and find times again.</p>}
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
   {pending&&<p className={styles.notice}>Unapplied availability edits: choose a time, keep the reviewed availability, or discard these edits before saving the meeting.</p>}
   {meeting.availability&&<button type="button" onClick={()=>{if(!window.confirm("Remove retained availability from the on-screen meeting? Earlier saved revisions keep their original copy."))return;
    onRemove();setDraft(availabilityDraft({...meeting,availability:undefined}));setPrepared(null);setPending(false);onPending(false);setNotice("Availability removed from the unsaved meeting. Confirm and save to keep that change.");}}>Remove retained availability from this meeting</button>}
  </section>
 </details>;
}
const clearSelections=(window:WindowDraft)=>({...window,startInstant:"",endInstant:""});
function WindowFields({label,value,zone,onChange,onRemove}:{label:string;value:WindowDraft;zone:string;onChange:(value:WindowDraft)=>void;onRemove:()=>void}){
 const starts=useMemo(()=>localTimeCandidates(value.start,zone),[value.start,zone]),ends=useMemo(()=>localTimeCandidates(value.end,zone),[value.end,zone]);
 const choice=(side:"start"|"end",candidates:string[])=>{
  const field=side==="start"?"startInstant":"endInstant";
  return candidates.length>1?<div role="group" aria-label={label+" "+side+" occurrence"}>
   <p>This local time occurs twice. Choose the {side} instant.</p>{candidates.map(at=><label className={styles.check} key={at}>
    <input type="radio" name={value.id+"-"+side} checked={value[field]===at} onChange={()=>onChange({...value,[field]:at})}/>
    <span>{new Intl.DateTimeFormat(undefined,{timeZone:zone,timeStyle:"long"}).format(new Date(at))} · {at}</span></label>)}
  </div>:value[side]&&!candidates.length?<p role="status">The {side} time is incomplete or does not exist in this zone.</p>:null;
 };
 return <div className={styles.row}><div className={styles.grid}>
  <Field label={label+" start"} value={value.start} type="datetime-local" onChange={start=>onChange({...value,start,startInstant:""})}/>
  <Field label={label+" end"} value={value.end} type="datetime-local" onChange={end=>onChange({...value,end,endInstant:""})}/></div>
  {choice("start",starts)}{choice("end",ends)}
  <button type="button" onClick={onRemove}>Remove {label}</button>
 </div>;
}
