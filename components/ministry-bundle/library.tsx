"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {searchResult} from "@/lib/ministry-bundle/contracts";
import {useMinistryRead} from "./use-ministry";
import {MinistryFrame,AccessState,ReadState,Field,Choice,styles} from "./common";
export function MinistryLibrary({kind}:{kind:"research"|"archive"}) {
 const [search,setSearch]=useState(""),[draft,setDraft]=useState(""),[status,setStatus]=useState(""),[offset,setOffset]=useState(0);
 const {bundleExperience}=useWorkspace();const canWrite=kind==="archive"||bundleExperience?.capabilityIds.includes("ministry.teaching")===true;
 const params=new URLSearchParams({search,offset:String(offset),limit:"25"});if(status)params.set("status",status);
 const read=useMinistryRead<z.infer<typeof searchResult>>("/api/ministry/"+kind+"?"+params,"ministry."+kind);
 if(!read.enabled)return <AccessState/>;
 return <MinistryFrame title={kind==="research"?"A thoughtful question deserves grounded teaching.":"Your past work, ready to help again."} description={kind==="research"?"Bring evidence, interpretation and the next teaching commitment into one place. Start with the question that matters, then preserve how you reached your answer.":"Find an earlier sermon, study or teaching by its text, topic, passage or source. Its historical voice stays separate from your current theological preferences."}>
 <div className={styles.actions}>{canWrite&&<Link className={styles.button} href={"/workspace/ministry/"+kind+"/new"}>{kind==="research"?"Start a research project":"Add prior teaching"}</Link>}
 {kind==="research"&&bundleExperience?.capabilityIds.includes("ministry.profile")&&<Link href="/workspace/ministry/profile">Review your theological preferences</Link>}</div>
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setSearch(draft.trim());setOffset(0);}}><Field label={kind==="research"?"Search research":"Search prior teaching"} value={draft} onChange={setDraft} max={200} type="search"/><button type="submit">Search</button>
 <Choice label="Show status" value={status} values={kind==="research"?["","draft","researching","ready","archived"]:["","active","archived"]} onChange={v=>{setStatus(v);setOffset(0);}}/></form>
 <p className={styles.muted}>Search includes saved text and recorded sources. Quoted phrases, OR, and excluded terms are supported. {read.data?read.data.total+" matching records.":""}</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.documents.length?<div className={styles.empty}><h2>{search||status?"No matches in this view":kind==="research"?"Begin with one meaningful question":"Keep a useful piece of your earlier work"}</h2><p>{kind==="research"?"Name the question and a title. Add sources and an outline as your research develops.":"Add the teaching text and where it came from. You can enrich its summary and references later."}</p>{(search||status)&&<button onClick={()=>{setSearch("");setDraft("");setStatus("");setOffset(0);}}>Clear filters</button>}</div>:
 <ul className={styles.list}>{read.data.documents.map(d=><li key={d.id}><Link className={styles.row} href={"/workspace/ministry/"+kind+"/"+d.id}><h2>{d.title}</h2><p>{d.summary.slice(0,280)||"Summary not recorded."}</p><span className={styles.tag}>{d.status}</span><span className={styles.tag}>Revision {d.revision}</span>{d.passage&&<span className={styles.tag}>{d.passage}</span>}{d.dueDate&&<span className={styles.tag}>Teaching · {d.dueDate}</span>}</Link></li>)}</ul>}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Ministry record pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next</button></nav>}
 </MinistryFrame>;
}
