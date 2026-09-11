"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveAttentionV2,executiveAttentionGroupForCapability,executiveKinds,executiveCapabilities,executiveLabels} from "@/lib/executive-bundle/contracts";
import {sourceLabel,sourceRoute,browserDate} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,Field,Disclosure,styles} from "./common";
import {ExecutiveDeliverySchedules} from "./delivery-schedules";
type Attention=z.infer<typeof executiveAttentionV2>;
function useAttention(date:string,offset=0) {
 const {bundleExperience}=useWorkspace(),capability=executiveKinds.map(k=>executiveCapabilities[k]).find(c=>bundleExperience?.capabilityIds.includes(c))??"__no_read__";
 return useExecutiveRead<Attention>("/api/executive/attention/v2?limit=25&offset="+offset+"&asOfDate="+encodeURIComponent(date),capability,undefined,true);
}
function Coverage({data}:{data:Attention}) {
 return <Disclosure summary={"Source coverage · "+data.coverage.filter(c=>c.state==="current").length+" checked"}>
 <p className={styles.muted}>Counts are matching attention cues, not all tasks or all activity. These are current saved records, even when you choose another comparison date.</p>
 <ul>{data.coverage.map(c=><li key={c.capabilityId+":"+c.level}>{sourceLabel(c.capabilityId)} · {c.level==="task"?"individual tasks":"records"} — {c.state==="current"?"metadata checked · "+c.total+" matches":c.state==="not_shared"?"not shared":"access unavailable; not checked"}</li>)}</ul>
 <p className={styles.muted}>Only separately permitted individual-task fields are read. The query does not inspect underlying manuscript text, theological profiles, research evidence or a full week’s activity. External calendars, inboxes and live markets are not checked.</p>
 </Disclosure>;
}
function Moves({data,limit=50}:{data:Attention;limit?:number}) {
 const labels={executive:"Executive",writer_editor:"Writer & Editor",ministry:"Ministry",nonprofit_founder:"Nonprofit Founder",investor:"Investor"} as const;
 const visible=data.items.slice(0,limit);
 return <>{data.groups.length>0&&<div className={styles.metrics} aria-label="Attention by source workspace">{data.groups.map(group=><div className={styles.metric} key={group.groupKey}><strong>{group.total}</strong>{labels[group.groupKey]} cue{group.total===1?"":"s"}</div>)}</div>}
 {data.groups.map(group=>{const items=visible.filter(item=>executiveAttentionGroupForCapability(item.source.capabilityId)===group.groupKey);return items.length?<section key={group.groupKey} aria-labelledby={"attention-group-"+group.groupKey}><h2 id={"attention-group-"+group.groupKey}>{labels[group.groupKey]} sources</h2><p className={styles.muted}>{group.total} matching cue{group.total===1?"":"s"} across the complete checked source scopes; {items.length} shown on this page.</p><ul className={styles.list}>{items.map(item=>{
 const route=sourceRoute(item.source);
 return <li key={item.id}><article className={styles.row+" "+(item.priority==="high"?styles.priority:"")}><p className={styles.eyebrow}>{sourceLabel(item.source.capabilityId)} · {item.priority} priority</p>
 <h3>{item.title}</h3>{item.source.item&&<><p className={styles.muted}>From: {item.parentTitle} · Owner: {item.owner||"not recorded"}</p><p>Next step: {item.nextAction||"not recorded"}</p></>}<p>{item.reason}</p><p className={styles.muted}>{item.dueDate?"Recorded date: "+item.dueDate:"No due or review date recorded"}{item.dateState?" · saved catalyst date certainty: "+item.dateState:""} · source revision {item.source.revision}{item.sourceReviewState?" · "+item.sourceReviewState.replaceAll("_"," "):""}</p>
 <Disclosure summary="Why this appears"><p>{item.evidence}</p><p className={styles.muted}>Source last updated: {new Date(item.sourceUpdatedAt).toLocaleString()}. A cue is not an independently verified conclusion.</p></Disclosure>
 {route&&<Link href={route}>{item.action}</Link>}</article></li>;
 })}</ul></section>:null})}<p className={styles.muted}>Showing {data.items.length?data.offset+1:0}–{data.offset+Math.min(limit,data.items.length)} of {data.total} matching cues. Date comparison: {data.asOfDate}. Access checked: {new Date(data.retrievedAt).toLocaleString()}.</p>
 {data.total>Math.min(limit,data.items.length)&&<p className={styles.notice}>This page is bounded. Review the remaining attention pages or source workspaces; missing items are not evidence of completion.</p>}</>;
}
export function ExecutiveAttention({label}:{label:string}) {
 const [date]=useState(browserDate),read=useAttention(date);
 if(!read.enabled)return null;
 return <article className={styles.workspace} aria-label="Executive attention"><section className={styles.section}><p className={styles.eyebrow}>Executive · {label}</p>
 <h2>{read.loading?"Checking permitted saved work…":read.error?"Attention could not be checked":read.data?.items.length?"Your next consequential moves":"No cues matched the checked rules"}</h2>
 {read.error?<ReadState loading={false} error={read.error} retry={read.retry}/>:read.data&&<><Moves data={read.data} limit={3}/><p className={styles.muted}>Unshared or unavailable sources are not checked. An empty view does not establish that nothing needs attention.</p></>}
 <Link href="/workspace/executive">Open Executive</Link></section></article>;
}
export function ExecutiveHome() {
 const {bundleExperience}=useWorkspace(),[date,setDate]=useState(browserDate),[draftDate,setDraftDate]=useState(date),[dateError,setDateError]=useState(false),[offset,setOffset]=useState(0),read=useAttention(date,offset);
 const allowed=executiveKinds.filter(k=>bundleExperience?.capabilityIds.includes(executiveCapabilities[k]));
 if(!read.enabled)return <AccessState/>;
 const coordination=allowed.includes("commitment"),first=coordination?"commitment":allowed[0];
 return <ExecutiveFrame title="What deserves your attention?" description="Keep commitments moving, decisions grounded, and the next step clear. Start with your own work; bring in other task context only when you choose.">
 <div className={styles.actions}>{coordination&&<Link className={styles.button} href="/workspace/executive/commitment/new">Capture a commitment</Link>}
 {allowed.includes("daily_brief")&&<Link href="/workspace/executive/daily_brief/new">Prepare a daily brief</Link>}
 {allowed.includes("weekly_review")&&<Link href="/workspace/executive/weekly_review/new">Start a weekly review</Link>}</div>
 <div className={styles.overview}><div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();const valid=z.iso.date().safeParse(draftDate).success;setDateError(!valid);if(valid){setDate(draftDate);setOffset(0);}}}>
 <Field label="Compare due dates against" type="date" value={draftDate} onChange={setDraftDate}/><button type="submit">Apply date</button><button type="button" onClick={()=>{setOffset(0);read.retry();}}>Refresh attention</button></form>
 {dateError&&<p className={styles.error} role="alert">Choose a valid comparison date.</p>}
 <p className={styles.muted}>The starting date uses this browser’s local date. Changing it compares deadlines; it does not retrieve a historical snapshot.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.items.length?<Moves data={read.data}/>:offset>0?<p className={styles.notice}>This page is now empty. Saved work may have changed; refresh from the first page.</p>:<div className={styles.empty}><p className={styles.eyebrow}>Your first useful step</p><h2>{coordination?"Get one important commitment out of your head.":"Give your next review a clear focus."}</h2>
 <p>{coordination?"Name the outcome and the next move. Add an owner or date if known—no other account connection is needed.":"Record the question you want the brief to answer. Add actual evidence and choose your next actions."}</p>
 <Link className={styles.button} href={"/workspace/executive/"+first+"/new"}>{coordination?"Start one commitment":"Start a "+first.replaceAll("_"," ")}</Link>
 <p className={styles.muted}>No cues matched the checked saved-record rules. This does not establish that all work is complete or that nothing changed.</p></div>}
 {read.data&&<><div className={styles.actions} aria-label="Attention pages">
 <button type="button" disabled={read.loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous attention page</button>
 <button type="button" disabled={read.loading||offset+read.data.items.length>=read.data.total} onClick={()=>setOffset(offset+25)}>Next attention page</button>
 </div><p className={styles.muted}>Each page reads current saved work. Changes between pages can move items; refresh to start again. These cues are not a complete activity history.</p><Coverage data={read.data}/></>}
 </div><aside className={styles.rail}><h2>A practical daily rhythm</h2><ol><li>Review the highest-priority saved cues.</li><li>Open the source when you need the evidence.</li><li>Choose one next move and give it an owner.</li><li>Record outcomes and review what changed.</li></ol>
 {coordination&&<p><Link href="/workspace/executive/sources">Choose attention sources</Link></p>}
 <h3>Review assistant proposals</h3>{allowed.map(k=><p key={k}><Link href={"/workspace/executive/"+k+"/proposals"}>{executiveLabels[k]}</Link></p>)}
 <p className={styles.muted}>Proposals wait for your exact review. Only your native confirmation changes a saved record.</p>
 <p><Link href="/workspace/integrations/assistant">Manage assistant connections</Link></p>
 <p className={styles.notice}>Assistant connections cannot create or manage recurring schedules. Native review schedules remain under your direct control and never send or book externally.</p>
 </aside></div>
 <ExecutiveDeliverySchedules capability={executiveCapabilities[first]} availableKinds={allowed.filter((kind):kind is "daily_brief"|"weekly_review"=>kind==="daily_brief"||kind==="weekly_review")}/>
 </ExecutiveFrame>;
}
