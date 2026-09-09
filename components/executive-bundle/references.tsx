"use client";
import Link from "next/link";
import {z} from "zod";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveAttention,executiveResolutionResult,executiveKinds,executiveCapabilities,referenceKey,type ExecutiveReference} from "@/lib/executive-bundle/contracts";
import {sourceLabel,sourceRoute,browserDate} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead} from "./use-executive";
import {Disclosure,ReadState,styles} from "./common";
export function ReferenceFields({references,onChange}:{references:ExecutiveReference[];onChange?:(refs:ExecutiveReference[])=>void}) {
 const {bundleExperience}=useWorkspace(),capability=executiveKinds.map(k=>executiveCapabilities[k]).find(c=>bundleExperience?.capabilityIds.includes(c))??"__no_read__";
 const read=useExecutiveRead<z.infer<typeof executiveResolutionResult>>("/api/executive/references",references.length?capability:"__no_read__",{references},true);
 return <section className={styles.section}><h2>Linked work, with live source access</h2><p className={styles.muted}>Only selected task metadata is shown here. A link does not copy its underlying private content. Refresh to check source changes; switching back to this window also refreshes.</p>
 {references.length?(read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.references.map(item=>{
 const key=referenceKey(item.reference),route=sourceRoute(item.reference);
 return <div className={styles.row} key={key}><p className={styles.eyebrow}>{sourceLabel(item.reference.capabilityId)} · {item.state}</p>
 <h3>{item.metadata?.title??"Source unavailable"}</h3>
 <p>{item.metadata?"Saved state: "+(item.metadata.state??"not recorded")+" · linked revision "+item.reference.revision+" · current revision "+item.metadata.revision:"No source title or content is returned. Remove this link before saving, or restore authorized source access."}</p>
 {item.state==="changed"&&<p className={styles.notice}>This source changed after it was linked. Open the source to review the difference; refreshing the link does not verify its contents.</p>}
 <div className={styles.actions}>{route&&item.metadata&&<Link href={route}>Open source workspace</Link>}
 {onChange&&item.state==="changed"&&item.metadata&&<button type="button" onClick={()=>onChange(references.map(ref=>referenceKey(ref)===key?{...ref,revision:item.metadata!.revision}:ref))}>Use current source revision</button>}
 {onChange&&<button type="button" onClick={()=>onChange(references.filter(ref=>referenceKey(ref)!==key))}>Remove link</button>}</div></div>;
 })): <p>No source records linked. You can use Executive on its own.</p>}
 {read.data&&<p className={styles.muted}>Source access checked: {new Date(read.data.retrievedAt).toLocaleString()}.</p>}
 {references.length>0&&<button type="button" onClick={read.retry}>Refresh linked sources</button>}
 {onChange&&<Disclosure summary="Link a current attention item"><ReferencePicker references={references} onChange={onChange} capability={capability}/></Disclosure>}
 </section>;
}
function ReferencePicker({references,onChange,capability}:{references:ExecutiveReference[];onChange:(refs:ExecutiveReference[])=>void;capability:string}) {
 const read=useExecutiveRead<z.infer<typeof executiveAttention>>("/api/executive/attention?asOfDate="+browserDate(),capability,undefined,true);
 if(read.loading||read.error)return <ReadState loading={read.loading} error={read.error} retry={read.retry}/>;
 return <><p className={styles.muted}>Choose from the first fifty current attention matches. Unshared sources and full private source content are excluded. Up to twenty links per record.</p>
 {read.data?.items.filter(item=>!references.some(ref=>referenceKey(ref)===referenceKey(item.source))).map(item=><div key={item.id} className={styles.row}><p>{item.title} · {sourceLabel(item.source.capabilityId)}</p><button type="button" disabled={references.length>=20} onClick={()=>onChange([...references,item.source])}>Link {item.title}</button></div>)}
 <button type="button" onClick={read.retry}>Refresh available links</button></>;
}
