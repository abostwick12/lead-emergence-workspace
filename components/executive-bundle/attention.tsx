"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveAttention,executiveKinds,executiveCapabilities,executiveLabels} from "@/lib/executive-bundle/contracts";
import {sourceLabel,sourceRoute,browserDate} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,Field,Disclosure,styles} from "./common";
type Attention=z.infer<typeof executiveAttention>;
function useAttention(date:string) {
 const {bundleExperience}=useWorkspace(),capability=executiveKinds.map(k=>executiveCapabilities[k]).find(c=>bundleExperience?.capabilityIds.includes(c))??"__no_read__";
 return useExecutiveRead<Attention>("/api/executive/attention?asOfDate="+encodeURIComponent(date),capability,undefined,true);
}
function Coverage({data}:{data:Attention}) {
 return <Disclosure summary={"Source coverage · "+data.coverage.filter(c=>c.state==="current").length+" checked"}>
 <p className={styles.muted}>Counts are matching attention cues, not all tasks or all activity. These are current saved records, even when you choose another comparison date.</p>
 <ul>{data.coverage.map(c=><li key={c.capabilityId}>{sourceLabel(c.capabilityId)} — {c.state==="current"?"metadata checked · "+c.total+" matches":c.state==="not_shared"?"not shared":"access unavailable; not checked"}</li>)}</ul>
 <p className={styles.muted}>The query does not inspect underlying manuscript text, nested roadmap tasks, theological profiles, research evidence or a full week’s activity. External calendars, inboxes and live markets are not checked.</p>
 </Disclosure>;
}
function Moves({data,limit=50}:{data:Attention;limit?:number}) {
 return <><ul className={styles.list}>{data.items.slice(0,limit).map(item=>{
 const route=sourceRoute(item.source);
 return <li key={item.id}><article className={styles.row+" "+(item.priority==="high"?styles.priority:"")}><p className={styles.eyebrow}>{sourceLabel(item.source.capabilityId)} · {item.priority} priority</p>
 <h3>{item.title}</h3><p>{item.reason}</p><p className={styles.muted}>{item.dueDate?"Recorded date: "+item.dueDate:"No due or review date recorded"} · source revision {item.source.revision}{item.sourceReviewState?" · "+item.sourceReviewState.replaceAll("_"," "):""}</p>
 <Disclosure summary="Why this appears"><p>{item.evidence}</p><p className={styles.muted}>Source last updated: {new Date(item.sourceUpdatedAt).toLocaleString()}. A cue is not an independently verified conclusion.</p></Disclosure>
 {route&&<Link href={route}>{item.action}</Link>}</article></li>;
 })}</ul><p className={styles.muted}>Showing {Math.min(limit,data.items.length)} of {data.total} matching cues. Date comparison: {data.asOfDate}. Access checked: {new Date(data.retrievedAt).toLocaleString()}.</p>
 {data.total>Math.min(limit,data.items.length)&&<p className={styles.notice}>This view is bounded. Open the source workspaces for the remaining records; missing items are not evidence of completion.</p>}</>;
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
 const {bundleExperience}=useWorkspace(),[date,setDate]=useState(browserDate),[draftDate,setDraftDate]=useState(date),[dateError,setDateError]=useState(false),read=useAttention(date);
 const allowed=executiveKinds.filter(k=>bundleExperience?.capabilityIds.includes(executiveCapabilities[k]));
 if(!read.enabled)return <AccessState/>;
 const coordination=allowed.includes("commitment"),first=coordination?"commitment":allowed[0];
 return <ExecutiveFrame title="What deserves your attention?" description="Keep commitments moving, decisions grounded, and the next step clear. Start with your own work; bring in other task context only when you choose.">
 <div className={styles.actions}>{coordination&&<Link className={styles.button} href="/workspace/executive/commitment/new">Capture a commitment</Link>}
 {allowed.includes("daily_brief")&&<Link href="/workspace/executive/daily_brief/new">Prepare a daily brief</Link>}
 {allowed.includes("weekly_review")&&<Link href="/workspace/executive/weekly_review/new">Start a weekly review</Link>}</div>
 <div className={styles.overview}><div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();const valid=z.iso.date().safeParse(draftDate).success;setDateError(!valid);if(valid)setDate(draftDate);}}>
 <Field label="Compare due dates against" type="date" value={draftDate} onChange={setDraftDate}/><button type="submit">Apply date</button><button type="button" onClick={read.retry}>Refresh attention</button></form>
 {dateError&&<p className={styles.error} role="alert">Choose a valid comparison date.</p>}
 <p className={styles.muted}>The starting date uses this browser’s local date. Changing it compares deadlines; it does not retrieve a historical snapshot.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.items.length?<Moves data={read.data}/>:<div className={styles.empty}><p className={styles.eyebrow}>Your first useful step</p><h2>{coordination?"Get one important commitment out of your head.":"Give your next review a clear focus."}</h2>
 <p>{coordination?"Name the outcome and the next move. Add an owner or date if known—no other account connection is needed.":"Record the question you want the brief to answer. Add actual evidence and choose your next actions."}</p>
 <Link className={styles.button} href={"/workspace/executive/"+first+"/new"}>{coordination?"Start one commitment":"Start a "+first.replaceAll("_"," ")}</Link>
 <p className={styles.muted}>No cues matched the checked saved-record rules. This does not establish that all work is complete or that nothing changed.</p></div>}
 {read.data&&<Coverage data={read.data}/>}
 </div><aside className={styles.rail}><h2>A practical daily rhythm</h2><ol><li>Review the highest-priority saved cues.</li><li>Open the source when you need the evidence.</li><li>Choose one next move and give it an owner.</li><li>Record outcomes and review what changed.</li></ol>
 {coordination&&<p><Link href="/workspace/executive/sources">Choose attention sources</Link></p>}
 <h3>Review assistant proposals</h3>{allowed.map(k=><p key={k}><Link href={"/workspace/executive/"+k+"/proposals"}>{executiveLabels[k]}</Link></p>)}
 <p className={styles.muted}>Proposals wait for your exact review. Only your native confirmation changes a saved record.</p>
 <p><Link href="/workspace/integrations/assistant">Manage assistant connections</Link></p>
 <p className={styles.notice}>No recurring brief, notification, calendar booking or outgoing message is created here. Scheduling and automation controls are still being completed.</p>
 </aside></div>
 </ExecutiveFrame>;
}
