"use client";
import Link from "next/link";
import {useState} from "react";
import {executiveWeeklyQuery,weeklyOutcomeLabel,type ExecutiveWeeklyReport} from "@/lib/executive-bundle/contracts";
import {sourceRoute,sourceLabel} from "@/lib/executive-bundle/presentation";
import {supportedTimeZoneOptions} from "@/lib/workspace/timezones";
import {useExecutiveRead} from "./use-executive";
import {Choice,Disclosure,ReadState,styles} from "./common";

export function WeeklyOutcomes({periodStart,periodEnd,timeZone:savedZone,onTimeZone,onPrepare}:{periodStart:string;periodEnd:string;timeZone?:string;onTimeZone:(zone:string)=>void;onPrepare:(report:ExecutiveWeeklyReport)=>void}) {
 const [browserZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);
 const timeZone=savedZone??browserZone;
 return <section className={styles.section} aria-label="Recorded weekly outcomes">
  <h2>Outcomes recorded during this period</h2>
  {!savedZone&&<p className={styles.notice}>This earlier review has no saved time zone. Its history currently uses your browser’s zone; choose a zone below to include it in your next confirmed save.</p>}
  <p>Review what the saved history says before writing your conclusions. This uses the period dates above and the time zone below.</p>
  <Choice label="Weekly history time zone" value={timeZone} values={supportedTimeZoneOptions([timeZone,"UTC"])} onChange={onTimeZone}/>
  <WeeklyPage key={periodStart+":"+periodEnd+":"+timeZone} periodStart={periodStart} periodEnd={periodEnd} timeZone={timeZone} onPrepare={onPrepare}/>
 </section>;
}
function WeeklyPage({periodStart,periodEnd,timeZone,onPrepare}:{periodStart:string;periodEnd:string;timeZone:string;onPrepare:(report:ExecutiveWeeklyReport)=>void}) {
 const [page,setPage]=useState<{offset:number;through?:string}>({offset:0});
 const valid=executiveWeeklyQuery.safeParse({periodStart,periodEnd,timeZone}).success;
 const params=new URLSearchParams({periodStart,periodEnd,timeZone,offset:String(page.offset),limit:"25"});
 if(page.through)params.set("recordedThrough",page.through);
 const read=useExecutiveRead<ExecutiveWeeklyReport>("/api/executive/weekly-outcomes?"+params.toString(),valid?"executive.review":"__no_read__",undefined,true);
 if(!valid)return <p role="status">Choose one to seven inclusive, valid period dates above.</p>;
 if(read.loading||read.error)return <ReadState loading={read.loading} error={read.error} retry={read.retry}/>;
 const report=read.data;if(!report)return null;
 const format=(instant:string)=>new Intl.DateTimeFormat(undefined,{timeZone,dateStyle:"medium",timeStyle:"short"}).format(new Date(instant));
 const move=(offset:number)=>setPage({offset,through:report.recordedThrough});
 return <>
  <p className={styles.notice}>These are recorded changes, not a count of unique accomplishments. A completion can be backdated, corrected or reopened. Saving or approving a record does not independently verify it.</p>
  <p>{report.periodStart}–{report.periodEnd} · {report.timeZone} · {report.total} recorded outcome changes.</p>
  {!report.events.length&&<p>{report.total?"This page has no remaining changes. Return to the first page.":"No outcome changes were recorded in the checked window. This does not establish that no work happened or that everything is complete."}</p>}
  <ul className={styles.list}>{report.events.map(event=>{
   const route=sourceRoute({...event.source,...(!event.currentTargetPresent?{item:undefined}:{})});
   return <li key={event.id}><article className={styles.row}>
    <p className={styles.eyebrow}>{weeklyOutcomeLabel(event)}</p><h3>{event.title}</h3>
    {event.source.item&&<p className={styles.muted}>From: {event.parentTitle}</p>}
    <p>Recorded <time dateTime={event.recordedAt} title={event.recordedAt}>{format(event.recordedAt)}</time> · revision {event.source.revision} · {event.reviewState.replaceAll("_"," ")}.</p>
    <p>State then: {event.previousState??"not recorded"} → {event.state??"removed"}.</p>
    <p>{event.reportedDate?"User-recorded completion/decision date: "+event.reportedDate+". This date may be outside the review period.":"No actual completion or decision date is recorded for this change."}</p>
    {event.previousReportedDate&&event.previousReportedDate!==event.reportedDate&&<p>Previously recorded date: {event.previousReportedDate}.</p>}
    <p className={styles.muted}>Current revision {event.currentRevision}: {event.currentTargetPresent?event.currentState:"task no longer present"}.
     {event.currentRevision!==event.source.revision?" Current work has changed since this historical revision.":""}</p>
    {route&&<Link href={route}>{event.currentTargetPresent?"Review current source":"Review parent and saved history"}</Link>}
   </article></li>;
  })}</ul>
  <p className={styles.muted}>Showing {report.events.length?report.offset+1:0}–{report.offset+report.events.length} of {report.total} changes.
   Recorded-time cutoff: {format(report.recordedThrough)}. Access checked: {format(report.retrievedAt)}.</p>
  <div className={styles.actions}>
   <button type="button" disabled={page.offset===0} onClick={()=>move(Math.max(0,page.offset-25))}>Previous outcome page</button>
   <button type="button" disabled={page.offset+report.events.length>=report.total} onClick={()=>move(page.offset+25)}>Next outcome page</button>
   <button type="button" onClick={()=>{setPage({offset:0});read.retry();}}>Refresh full period</button>
  </div>
  <Disclosure summary="What this history includes">
   <ul>{report.coverage.map(c=><li key={c.capabilityId}>{sourceLabel(c.capabilityId)} — {c.state==="current"?c.total+" recorded changes":"unavailable; not checked"}</li>)}</ul>
   <p>Only retained Executive revisions are checked. Other bundles’ history, pending proposals, calendars and inboxes are excluded. Full private audit bodies are not returned.</p>
   <p>Pages reuse a recorded-time cutoff, but access and current status are checked again. This is not a frozen snapshot; late commits or removed access can change counts. A held meeting’s scheduled time is not proof of its actual occurrence.</p>
  </Disclosure>
  <p>Start an unsaved review with current parent links from this first page, then add your interpretation and next moves. At most twenty parent records are linked; no private outcome titles are copied into the draft.</p>
  <button type="button" disabled={page.offset!==0} onClick={()=>onPrepare(report)}>Prepare review from saved outcomes</button>
  {page.offset!==0&&<p className={styles.muted}>Return to the first page or refresh the full period to prepare a review.</p>}
 </>;
}
