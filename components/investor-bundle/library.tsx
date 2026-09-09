"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {investorCapabilities,investorLabels,investorSearchResult,investorProposalsResult,type InvestorKind} from "@/lib/investor-bundle/contracts";
import {useInvestorRead} from "./use-investor";
import {InvestorFrame,AccessState,ReadState,Field,styles} from "./common";
export function InvestorLibrary({kind}:{kind:InvestorKind}){
 const [search,setSearch]=useState(""),[draft,setDraft]=useState(""),[offset,setOffset]=useState(0);
 const read=useInvestorRead<z.infer<typeof investorSearchResult>>("/api/investor/"+kind+"?"+new URLSearchParams({search,offset:String(offset),limit:"25"}),investorCapabilities[kind]);
 const proposals=useInvestorRead<z.infer<typeof investorProposalsResult>>("/api/investor/"+kind+"/proposals",investorCapabilities[kind]);
 if(!read.enabled)return <AccessState/>;
 return <InvestorFrame title={investorLabels[kind]} description={kind==="watchlist"?"Keep a focused list with a reason to watch and a question worth answering.":kind==="thesis"?"Make the working thesis, counterevidence and invalidation conditions easy to review.":kind==="filing"?"Read public disclosures in context: who filed, which period, what changed, and what remains uncertain.":"Preserve the research window, source coverage and implications without turning assumptions into facts."}>
 <div className={styles.actions}><Link className={styles.button} href={"/workspace/investing/"+kind+"/new"}>Add {kind==="watchlist"?"a watchlist":kind==="thesis"?"a thesis":kind==="filing"?"a filing review":"a market brief"}</Link><Link href={"/workspace/investing/"+kind+"/proposals"}>Review proposals{proposals.data?" ("+proposals.data.total+" pending)":""}</Link></div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setSearch(draft.trim());setOffset(0);}}><Field label={"Search "+investorLabels[kind].toLowerCase()} value={draft} onChange={setDraft} max={200} type="search"/><button type="submit">Search</button></form>
 <p className={styles.muted}>Search includes saved research text and recorded sources in this area only. Quoted phrases, OR and excluded terms are supported. {read.data?read.data.total+" matching records.":""}</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.documents.length?<div className={styles.empty}><h2>{search?"No matches in this view":"Start with one useful "+(kind==="watchlist"?"watchlist":kind==="thesis"?"thesis":kind==="filing"?"filing review":"market brief")}</h2><p>{search?"Try fewer words or clear the search.":"Save the essentials now. Add detail as the work develops, or ask your authorized assistant to prepare a proposal for review."}</p>{search&&<button onClick={()=>{setSearch("");setDraft("");setOffset(0);}}>Clear search</button>}</div>:
 <ul className={styles.list}>{read.data.documents.map(d=><li key={d.id}><Link className={styles.row} href={"/workspace/investing/"+kind+"/"+d.id}><h2>{d.title}</h2><p>{d.summary||"Add the next question or context when you open this record."}</p><span className={styles.tag}>{d.status.replaceAll("_"," ")}</span><span className={styles.tag}>Revision {d.revision}</span>{d.dueDate&&<span className={styles.tag}>{d.dueDate}</span>}</Link></li>)}</ul>}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Investor record pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next</button></nav>}
 </InvestorFrame>;
}
