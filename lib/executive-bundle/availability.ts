import {executiveMeetingAvailability,type ExecutiveData,type ExecutiveMeetingAvailability} from "./contracts";
import {localMeetingTime,localTimeCandidates} from "./presentation";
export type Meeting=Extract<ExecutiveData,{recordType:"meeting"}>;
export type WindowDraft={id:string;start:string;end:string;startInstant:string;endInstant:string};
export type AvailabilityDraft={zone:string;offered:WindowDraft[];available:WindowDraft[];busy:WindowDraft[];source:string;bufferMinutes:number;checkedAt:string|null;context:string};
export const meetingAvailabilityContext=(meeting:Pick<Meeting,"timeZone"|"durationMinutes"|"participants">)=>JSON.stringify([meeting.timeZone,meeting.durationMinutes,meeting.participants.map(p=>[p.name,p.role])]);
export const blankAvailabilityWindow=(id:string):WindowDraft=>({id,start:"",end:"",startInstant:"",endInstant:""});
export function availabilityDraft(meeting:Meeting):AvailabilityDraft{
 const saved=meeting.availability,input=saved?.input,zone=input?.timeZone??meeting.timeZone;
 const windows=(name:"offered"|"available"|"busy")=>(input?.[name]??[]).map((w,i)=>({id:name+"-"+i,start:localMeetingTime(w.start,zone),end:localMeetingTime(w.end,zone),startInstant:w.start,endInstant:w.end}));
 return {zone,offered:input?windows("offered"):[blankAvailabilityWindow("offered-0")],available:input?windows("available"):[blankAvailabilityWindow("available-0")],
  busy:windows("busy"),source:input?.source??"",bufferMinutes:input?.bufferMinutes??15,checkedAt:input?.checkedAt??null,
  context:saved?meetingAvailabilityContext({timeZone:saved.input.timeZone,durationMinutes:saved.input.durationMinutes,participants:saved.participants}):meetingAvailabilityContext(meeting)};
}
export function resolveAvailabilityBoundary(local:string,zone:string,selected:string,label:string):string{
 const candidates=localTimeCandidates(local,zone);
 if(!candidates.length)throw new Error(label+": choose a valid local date, time and zone. Nonexistent daylight-saving times cannot be used.");
 // A retained instant can include seconds/submilliseconds not editable in the minute-level field.
 if(selected&&localMeetingTime(selected,zone)===local)return selected;
 if(candidates.length===1)return candidates[0];
 if(!candidates.includes(selected))throw new Error(label+": this local time occurs twice. Choose the intended instant.");
 return selected;
}
export function reviewedAvailability(draft:AvailabilityDraft,meeting:Meeting):ExecutiveMeetingAvailability{
 if(!draft.checkedAt||draft.context!==meetingAvailabilityContext(meeting))
  throw new Error("Confirm a fresh availability check for the current participants, duration and meeting zone.");
 const windows=(name:"offered"|"available"|"busy")=>draft[name].map((w,i)=>({
  start:resolveAvailabilityBoundary(w.start,draft.zone,w.startInstant,name+" window "+(i+1)+" start"),
  end:resolveAvailabilityBoundary(w.end,draft.zone,w.endInstant,name+" window "+(i+1)+" end")
 }));
 return executiveMeetingAvailability.parse({input:{offered:windows("offered"),available:windows("available"),busy:windows("busy"),
  source:draft.source,checkedAt:draft.checkedAt,confirmAvailabilityChecked:true,timeZone:meeting.timeZone,
  durationMinutes:meeting.durationMinutes,bufferMinutes:draft.bufferMinutes},participants:structuredClone(meeting.participants)});
}
