"use client";
import Link from "next/link";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {nonprofitAttention,nonprofitKinds,nonprofitCapabilities,nonprofitLabels} from "@/lib/nonprofit-bundle/contracts";
import {useNonprofitRead} from "./use-nonprofit";
import {NonprofitFrame,AccessState,ReadState,styles} from "./common";
type Attention=z.infer<typeof nonprofitAttention>;
function Moves({data,limit=30}:{data:Attention;limit?:number}){
 return <><ul className={styles.list}>{data.items.slice(0,limit).map(item=><li key={item.id}><Link className={styles.row+" "+(item.priority==="high"?styles.priority:"")} href={"/workspace/nonprofit/"+item.kind+"/"+item.documentId}>
 <p className={styles.eyebrow}>{nonprofitLabels[item.kind]} · {item.priority==="high"?"Needs attention":"Next move"}</p><h3>{item.title}</h3><p>{item.reason}</p><p>{item.owner||"Owner not yet assigned"}{item.dueDate?" · "+item.dueDate:" · Date not yet recorded"}</p><small className={styles.muted}>Evidence: {item.evidence.slice(0,240)} · Revision {item.revision}</small></Link></li>)}</ul>
 <p className={styles.muted}>As of {data.asOfDate} (server date). Showing {Math.min(data.items.length,limit)} of {data.total} recorded next moves. No messages or reminders are sent automatically.</p></>;
}
export function NonprofitAttention({label}:{label:string}){
 const read=useNonprofitRead<Attention>("/api/nonprofit/attention","nonprofit.roadmap");
 if(!read.enabled)return null;
 return <article className={styles.workspace} aria-label="Nonprofit founder attention"><div className={styles.section}><p className={styles.eyebrow}>Nonprofit Founder · {label}</p><h2>{read.loading?"Checking founder next moves…":read.error?"Founder work couldn't be checked":read.data?.items.length?"Keep the important work moving.":"No recorded founder work needs attention."}</h2>
 {read.error?<button onClick={read.retry}>Try again</button>:read.data&&<Moves data={read.data} limit={3}/>}<Link href="/workspace/nonprofit">Open founder next moves</Link></div></article>;
}
export function NonprofitHome(){
 const {bundleExperience}=useWorkspace(),read=useNonprofitRead<Attention>("/api/nonprofit/attention","nonprofit.roadmap");
 if(!read.enabled)return <AccessState/>;
 return <NonprofitFrame title="What moves the mission forward?" description="A focused view of the work that needs an owner, a follow-up, a decision or better evidence. Start with what matters today.">
 <div className={styles.overview}><div>{read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.items.length?<Moves data={read.data}/>:<div className={styles.empty}><p className={styles.eyebrow}>Your first useful step</p><h2>Turn the idea into a short, workable roadmap.</h2><p>Start with the mission and jurisdiction. An editable checklist gives you a starting point without inventing commitments or legal requirements.</p><Link className={styles.button} href="/workspace/nonprofit/plan/new">Build the first roadmap</Link><p className={styles.muted}>No recorded work needs attention yet. This does not verify an inbox, calendar, funding pipeline or compliance status.</p></div>}</div>
 <aside className={styles.rail}><h2>A useful founder rhythm</h2><ol><li>Name the next consequential move.</li><li>Give it an owner and a realistic date.</li><li>Keep the decision or source behind it.</li><li>Review what changed before adding more.</li></ol><p className={styles.muted}>Keep this administrative. Do not include patient or clinical information.</p><h3>Review assistant proposals</h3>{nonprofitKinds.filter(k=>bundleExperience?.capabilityIds.includes(nonprofitCapabilities[k])).map(k=><p key={k}><Link href={"/workspace/nonprofit/"+k+"/proposals"}>{nonprofitLabels[k]} proposals</Link></p>)}<p><Link href="/workspace/integrations/assistant">Manage assistant connections</Link></p></aside></div>
 </NonprofitFrame>;
}
