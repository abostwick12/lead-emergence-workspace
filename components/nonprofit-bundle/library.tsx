"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {nonprofitCapabilities,nonprofitLabels,nonprofitSearchResult,nonprofitProposalsResult,type NonprofitKind} from "@/lib/nonprofit-bundle/contracts";
import {useNonprofitRead} from "./use-nonprofit";
import {NonprofitFrame,AccessState,ReadState,Field,styles} from "./common";
export function NonprofitLibrary({kind}:{kind:NonprofitKind}){
 const [search,setSearch]=useState(""),[draft,setDraft]=useState(""),[offset,setOffset]=useState(0);
 const read=useNonprofitRead<z.infer<typeof nonprofitSearchResult>>("/api/nonprofit/"+kind+"?"+new URLSearchParams({search,offset:String(offset),limit:"25"}),nonprofitCapabilities[kind]);
 const proposals=useNonprofitRead<z.infer<typeof nonprofitProposalsResult>>("/api/nonprofit/"+kind+"/proposals",nonprofitCapabilities[kind]);
 if(!read.enabled)return <AccessState/>;
 return <NonprofitFrame title={nonprofitLabels[kind]} description={kind==="plan"?"Move from a broad ambition to a short sequence with owners, dependencies and clear evidence.":kind==="partner"?"Keep partner, volunteer, donor and board relationships connected to a useful next follow-up.":kind==="meeting"?"Prepare the conversation, preserve the decisions, and keep agreed actions from disappearing.":"Know what the authority says, what you infer, and what still needs review."}>
 <div className={styles.actions}><Link className={styles.button} href={"/workspace/nonprofit/"+kind+"/new"}>Add {kind==="plan"?"a roadmap":kind==="partner"?"a relationship":kind==="meeting"?"a meeting":"a research question"}</Link><Link href={"/workspace/nonprofit/"+kind+"/proposals"}>Review proposals{proposals.data?" ("+proposals.data.total+" pending)":""}</Link></div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setSearch(draft.trim());setOffset(0);}}><Field label={"Search "+nonprofitLabels[kind].toLowerCase()} value={draft} onChange={setDraft} max={200} type="search"/><button type="submit">Search</button></form>
 <p className={styles.muted}>Search includes saved administrative text and recorded sources in this area only. Quoted phrases, OR and excluded terms are supported. {read.data?read.data.total+" matching records.":""}</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.documents.length?<div className={styles.empty}><h2>{search?"No matches in this view":"Start with one useful "+(kind==="plan"?"roadmap":kind==="partner"?"relationship":kind==="meeting"?"meeting":"question")}</h2><p>{search?"Try fewer words or clear the search.":"Save the essentials now. Add detail as the work develops, or ask your authorized assistant to prepare a proposal for review."}</p>{search&&<button onClick={()=>{setSearch("");setDraft("");setOffset(0);}}>Clear search</button>}</div>:
 <ul className={styles.list}>{read.data.documents.map(d=><li key={d.id}><Link className={styles.row} href={"/workspace/nonprofit/"+kind+"/"+d.id}><h2>{d.title}</h2><p>{d.summary||"Add the next action or context when you open this record."}</p><span className={styles.tag}>{d.status.replaceAll("_"," ")}</span><span className={styles.tag}>Revision {d.revision}</span>{d.dueDate&&<span className={styles.tag}>{d.dueDate}</span>}</Link></li>)}</ul>}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Founder record pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next</button></nav>}
 </NonprofitFrame>;
}
