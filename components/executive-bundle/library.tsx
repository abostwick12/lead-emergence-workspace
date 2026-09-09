"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {executiveCapabilities,executiveLabels,executiveSearchResult,executiveProposalsResult,type ExecutiveKind} from "@/lib/executive-bundle/contracts";
import {useExecutiveRead} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,Field,styles} from "./common";
const purpose:Record<ExecutiveKind,string>={commitment:"Keep the outcome, owner and next move together. Follow up before commitments drift.",
 decision:"Keep the question, options and rationale close enough to review when circumstances change.",
 meeting:"Prepare for a useful conversation and preserve its actual outcomes. A meeting record is not an invitation.",
 daily_brief:"Choose today's highest-value moves from saved work, with coverage and uncertainty visible.",
 weekly_review:"Reflect on progress and unfinished work. A current attention snapshot is not a complete history of the week."};
export function ExecutiveLibrary({kind}:{kind:ExecutiveKind}) {
 const [search,setSearch]=useState(""),[draft,setDraft]=useState(""),[offset,setOffset]=useState(0);
 const read=useExecutiveRead<z.infer<typeof executiveSearchResult>>("/api/executive/"+kind+"?"+new URLSearchParams({search,offset:String(offset),limit:"25"}),executiveCapabilities[kind]);
 const proposals=useExecutiveRead<z.infer<typeof executiveProposalsResult>>("/api/executive/"+kind+"/proposals",executiveCapabilities[kind]);
 if(!read.enabled)return <AccessState/>;
 return <ExecutiveFrame title={executiveLabels[kind]} description={purpose[kind]}>
 <div className={styles.actions}><Link className={styles.button} href={"/workspace/executive/"+kind+"/new"}>New {kind.replaceAll("_"," ")}</Link><Link href={"/workspace/executive/"+kind+"/proposals"}>Review proposals{proposals.data?" ("+proposals.data.total+" pending)":""}</Link></div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setSearch(draft.trim());setOffset(0);}}><Field label={"Search "+executiveLabels[kind].toLowerCase()} value={draft} onChange={setDraft} max={200} type="search"/><button type="submit">Search</button></form>
 <p className={styles.muted}>Search saved text in this Executive area only. Linked private source bodies are not searched. {read.data?read.data.total+" matching records.":""}</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.documents.length?<div className={styles.empty}><h2>{search?"No matches in this view":"Start with one useful record"}</h2><p>{search?"Try fewer words or clear the search.":"Save the essential outcome or question now. Add supporting detail as the work develops."}</p>{search&&<button onClick={()=>{setSearch("");setDraft("");setOffset(0);}}>Clear search</button>}</div>:
 <ul className={styles.list}>{read.data.documents.map(d=><li key={d.id}><Link className={styles.row} href={"/workspace/executive/"+kind+"/"+d.id}><h2>{d.title}</h2><p>{d.summary||"Open this record to choose its next move."}</p><span className={styles.tag}>{d.state.replaceAll("_"," ")}</span><span className={styles.tag}>{d.reviewState.replaceAll("_"," ")}</span><span className={styles.tag}>Revision {d.revision}</span>{d.dueDate&&<span className={styles.tag}>{d.dueDate}</span>}</Link></li>)}</ul>}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Executive record pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next</button></nav>}
 </ExecutiveFrame>;
}
