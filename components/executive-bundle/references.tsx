"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveResolutionResult,executiveKinds,executiveCapabilities,executiveAllCapabilities,executiveTaskKinds,
 executiveSourceSearchResult,referenceKey,type ExecutiveReference} from "@/lib/executive-bundle/contracts";
import {sourceLabel,sourceRoute} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead} from "./use-executive";
import {Disclosure,ReadState,Field,Choice,styles} from "./common";
export function ReferenceFields({references,onChange}:{references:ExecutiveReference[];onChange?:(refs:ExecutiveReference[])=>void}) {
 const {bundleExperience}=useWorkspace(),capability=executiveKinds.map(k=>executiveCapabilities[k]).find(c=>bundleExperience?.capabilityIds.includes(c))??"__no_read__";
 const read=useExecutiveRead<z.infer<typeof executiveResolutionResult>>("/api/executive/references",references.length?capability:"__no_read__",{references},true);
 return <section className={styles.section}><h2>Linked work, with live source access</h2><p className={styles.muted}>Only selected record or task metadata is shown here. A link does not copy its underlying private content. Refresh to check source changes; switching back to this window also refreshes.</p>
 {references.length?(read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.references.map(item=>{
 const key=referenceKey(item.reference),route=sourceRoute(item.reference);
 return <div className={styles.row} key={key}><p className={styles.eyebrow}>{sourceLabel(item.reference.capabilityId)} · {item.reference.item?"individual task":"record"} · {item.state}</p>
 <h3>{item.metadata?.title??"Source unavailable"}</h3>
 <p>{item.metadata?"Saved state: "+(item.metadata.state??"not recorded")+" · linked parent revision "+item.reference.revision+" · current revision "+item.metadata.revision:"No source title or content is returned. Remove this link before saving, or restore authorized source access."}</p>
 {item.metadata&&"owner" in item.metadata&&<><p className={styles.muted}>From: {item.metadata.parentTitle} · Owner: {item.metadata.owner||"not recorded"}</p>
 <p>Next step: {item.metadata.nextAction||"not recorded"}</p><p className={styles.muted}>{item.metadata.dueDate?"Recorded date: "+item.metadata.dueDate:"No date recorded"}
 {item.metadata.dateState?" · saved date certainty: "+item.metadata.dateState:""}{item.metadata.openPrerequisites>0?" · "+item.metadata.openPrerequisites+" unfinished prerequisites":""}</p></>}
 {item.state==="changed"&&<p className={styles.notice}>This source changed after it was linked. Open the source to review the difference; refreshing the link does not verify its contents.</p>}
 <div className={styles.actions}>{route&&item.metadata&&<Link href={route}>Open source workspace</Link>}
 {onChange&&item.state==="changed"&&item.metadata&&<button type="button" onClick={()=>onChange(references.map(ref=>referenceKey(ref)===key?{...ref,revision:item.metadata!.revision}:ref))}>Use current source revision</button>}
 {onChange&&<button type="button" onClick={()=>onChange(references.filter(ref=>referenceKey(ref)!==key))}>Remove link</button>}</div></div>;
 })): <p>No source records or tasks linked. You can use Executive on its own.</p>}
 {read.data&&<p className={styles.muted}>Source access checked: {new Date(read.data.retrievedAt).toLocaleString()}.</p>}
 {references.length>0&&<button type="button" onClick={read.retry}>Refresh linked sources</button>}
 {onChange&&<Disclosure summary="Find a record or individual task to link"><ReferencePicker references={references} onChange={onChange} capability={capability}/></Disclosure>}
 </section>;
}
function ReferencePicker({references,onChange,capability}:{references:ExecutiveReference[];onChange:(refs:ExecutiveReference[])=>void;capability:string}) {
 const [source,setSource]=useState(capability),[level,setLevel]=useState("task"),[draft,setDraft]=useState(""),[search,setSearch]=useState("");
 const [after,setAfter]=useState<string|null>(null);
 const params=new URLSearchParams({capabilityId:source,level,search,limit:"20"});if(after)params.set("after",after);
 const read=useExecutiveRead<z.infer<typeof executiveSourceSearchResult>>("/api/executive/source-search?"+params.toString(),capability,undefined,true);
 const labels=Object.fromEntries(executiveAllCapabilities.map(cap=>[cap,sourceLabel(cap)]));
 const apply=()=>{setSearch(draft.trim());setAfter(null);read.retry();};
 return <><p className={styles.muted}>Browse permitted saved work, including future and completed tasks outside attention. Only titles are searched. Each page checks current access; edits may change results between pages. Up to twenty exact links per record.</p>
 <Choice label="Source workspace" value={source} values={executiveAllCapabilities} labels={labels} onChange={value=>{
  setSource(value);if(!Object.hasOwn(executiveTaskKinds,value))setLevel("record");setAfter(null);
 }}/>
 <Choice label="Link level" value={level} values={Object.hasOwn(executiveTaskKinds,source)?["record","task"]:["record"]}
 labels={{record:"Whole record",task:"Individual task"}} onChange={value=>{setLevel(value);setAfter(null);}}/>
 <div onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();apply();}}}><Field label="Find by title" value={draft} onChange={setDraft} max={200}/></div>
 <div className={styles.actions}><button type="button" onClick={apply}>Find sources</button>
 <button type="button" onClick={()=>{setAfter(null);read.retry();}}>Refresh from first page</button></div>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data&&<>
 {read.data.state!=="current"?<p className={styles.notice}>{read.data.state==="not_shared"?"This source level is not shared. Individual tasks require a separate choice in Attention sources.":"Source access is unavailable. It was not checked."}</p>:<>
 <p className={styles.muted}>{read.data.total} matching permitted {level==="task"?"tasks":"records"}. {after?"Later page":"First page"} · {read.data.items.length} returned.</p>
 {read.data.items.map(item=>{
 const key=referenceKey(item.reference),linked=references.some(ref=>referenceKey(ref)===key);
 return <div key={key} className={styles.row}><h3>{item.metadata.title}</h3><p className={styles.muted}>
 {"parentTitle" in item.metadata?item.metadata.parentTitle+" · ":""}{item.metadata.state??"State not recorded"} · revision {item.reference.revision}</p>
 <button type="button" disabled={linked||references.length>=20} onClick={()=>onChange([...references,item.reference])}>{linked?"Already linked":"Link "+item.metadata.title}</button></div>;
 })}
 {read.data.items.length===0&&<p>No sources matched this page. Refine the title or return to the first page.</p>}
 {read.data.nextCursor&&<button type="button" onClick={()=>setAfter(read.data!.nextCursor)}>Next source page</button>}
 </>}
 <p className={styles.muted}>Access checked: {new Date(read.data.retrievedAt).toLocaleString()}.</p></>}
 </>;
}
