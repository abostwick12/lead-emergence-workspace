import { z } from "zod";
import {executiveSchedulingInput,executiveTimeWindow,executiveMeetingAvailability,namedTimeZone,type ExecutiveData,type ExecutiveSchedulingInput,type ExecutiveMeetingAvailability} from "./executive";
export {executiveSchedulingInput,executiveTimeWindow} from "./executive";

const instant=z.iso.datetime({offset:true});
export const executiveSchedulingResult=z.object({
 status:z.enum(["proposal","no_overlap"]),slots:z.array(executiveTimeWindow).max(3),
 source:z.string().min(1).max(240),checkedAt:instant,timeZone:namedTimeZone,requiresAgreement:z.literal(true),calendarBooked:z.literal(false)
}).strict().superRefine((result,ctx)=>{
 if((result.status==="proposal")!==(result.slots.length>0)||result.slots.some((slot,i)=>i>0&&Date.parse(slot.start)<Date.parse(result.slots[i-1].end)))
  ctx.addIssue({code:"custom",message:"Scheduling results must be ordered, nonoverlapping and consistent with their status."});
});
type Interval={start:number;end:number};
function merge(windows:Interval[]):Interval[]{
 const result:Interval[]=[];
 for(const window of [...windows].sort((a,b)=>a.start-b.start||a.end-b.end)){
  const last=result.at(-1);
  if(last&&window.start<=last.end)last.end=Math.max(last.end,window.end);else result.push({...window});
 }
 return result;
}
const milliseconds=(raw:string,roundUp:boolean)=>Date.parse(raw)+(roundUp&&/[1-9]/.test((raw.match(/\.(\d+)/)?.[1]??"").slice(3))?1:0);
const intervals=(windows:ExecutiveSchedulingInput["offered"],outward=false)=>merge(windows.map(w=>({
 start:milliseconds(w.start,!outward),end:milliseconds(w.end,outward)
})).filter(w=>w.start<w.end));
function checkFresh(input:ExecutiveSchedulingInput,now:string){
 const current=Date.parse(instant.parse(now)),checked=Date.parse(input.checkedAt);
 if(checked>current+60000||current-checked>86400000)throw new Error("Recheck availability before proposing times.");
 return current;
}
function possible(input:ExecutiveSchedulingInput,now:string):Interval[]{
 const current=checkFresh(input,now),buffer=input.bufferMinutes*60000;
 // Merge alternative offered/available windows BEFORE applying a boundary buffer.
 // Offered windows are valid meeting bounds; buffers protect the user's free time and known conflicts.
 const offered=intervals(input.offered),available=intervals(input.available).map(w=>({start:w.start+buffer,end:w.end-buffer})).filter(w=>w.start<w.end);
 const busy=merge(intervals(input.busy,true).map(w=>({start:w.start-buffer,end:w.end+buffer})));
 const common=merge(offered.flatMap(o=>available.map(a=>({start:Math.max(o.start,a.start,current),end:Math.min(o.end,a.end)})).filter(w=>w.start<w.end)));
 const free:Interval[]=[];
 for(const window of common){
  let start=window.start;
  for(const conflict of busy){
   if(conflict.end<=start)continue;if(conflict.start>=window.end)break;
   if(conflict.start>start)free.push({start,end:Math.min(conflict.start,window.end)});
   start=Math.max(start,conflict.end);if(start>=window.end)break;
  }
  if(start<window.end)free.push({start,end:window.end});
 }
 return free;
}
export function proposeExecutiveTimes(raw:unknown,now=new Date().toISOString()){
 const input=executiveSchedulingInput.parse(raw),duration=input.durationMinutes*60000,buffer=input.bufferMinutes*60000;
 const slots:{start:string;end:string}[]=[];let after=-Infinity;
 for(const window of possible(input,now)){
  let at=Math.ceil(Math.max(window.start,after)/300000)*300000;
  while(at+duration<=window.end&&slots.length<3){
   slots.push({start:new Date(at).toISOString(),end:new Date(at+duration).toISOString()});
   after=at+duration+buffer;at=Math.ceil(after/300000)*300000;
  }
  if(slots.length===3)break;
 }
 return executiveSchedulingResult.parse({status:slots.length?"proposal":"no_overlap",slots,source:input.source,
  checkedAt:input.checkedAt,timeZone:input.timeZone,requiresAgreement:true,calendarBooked:false});
}
type Meeting=Extract<ExecutiveData,{recordType:"meeting"}>;
export function executiveAvailabilityMatches(meeting:Meeting,availability:ExecutiveMeetingAvailability):boolean{
 return meeting.timeZone===availability.input.timeZone&&meeting.durationMinutes===availability.input.durationMinutes
  &&JSON.stringify(meeting.participants.map(p=>[p.name,p.role]))===JSON.stringify(availability.participants.map(p=>[p.name,p.role]));
}
export function chooseExecutiveMeetingTime(meeting:Meeting,raw:unknown,start:string,now=new Date().toISOString()):Meeting{
 const availability=executiveMeetingAvailability.parse(raw),input=availability.input,at=Date.parse(instant.parse(start)),end=at+input.durationMinutes*60000;
 if(!executiveAvailabilityMatches(meeting,availability))
  throw new Error("The participants, duration or time zone changed. Review availability again.");
 if(!possible(input,now).some(w=>at>=w.start&&end<=w.end))throw new Error("This time no longer fits the reviewed availability. Find times again.");
 return {...meeting,startsAt:new Date(at).toISOString(),agreement:"not_agreed",reviewState:"inferred",
  availability:{input,participants:structuredClone(meeting.participants)}};
}
