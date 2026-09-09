"use client";
import {useState} from "react";
import {z} from "zod";
import type {MinistryDocument} from "@/lib/ministry-bundle/contracts";
import {historyResult} from "@/lib/ministry-bundle/contracts";
import {describeMinistry} from "@/lib/ministry-bundle/presentation";
import {useMinistryRead,useMinistryAction} from "./use-ministry";
import {ReadState,Validation,styles} from "./common";
export function MinistryHistory({current,dirty,onRestore,onDecide}:{current:MinistryDocument;dirty:boolean;onRestore:(document:MinistryDocument)=>void;onDecide:(document:MinistryDocument)=>void}) {
 const read=useMinistryRead<z.infer<typeof historyResult>>("/api/ministry/"+current.kind+"/"+current.id+"/history","ministry."+current.kind);
 const action=useMinistryAction();const [compared,setCompared]=useState<string|null>(null);
 return <section className={styles.section}><h2>Saved revisions & proposals</h2><p className={styles.muted}>Your original and the nine most recent saved revisions stay available here. Restoring loads a copy for review; it never overwrites immediately.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:<>
 {read.data?.revisions.map(d=><details className={styles.source} key={d.revision}><summary>Revision {d.revision}{d.revision===1?" · Original":""}{d.revision===current.revision?" · Current":""} · {d.origin==="assistant"?"Approved assistant proposal":"User saved"}</summary>
 <p className={styles.muted}>{new Date(d.updatedAt).toLocaleString()}</p><div className={styles.preview}>{describeMinistry(d.data,d.kind)}</div>
 {d.revision!==current.revision&&<div className={styles.actions}><button type="button" onClick={()=>{if(!dirty||window.confirm("Replace your unsaved edits with a copy of this saved revision?"))onRestore(d);}}>Review a copy of revision {d.revision}</button></div>}</details>)}
 {read.data?.proposals.map(p=><article className={styles.source} key={p.id}><h3>{p.origin==="assistant"?"Assistant":"Your"} proposal · {p.status}</h3><p>{p.reason}</p><p className={styles.muted}>Evidence: {p.evidence}</p><p>Based on revision {p.baseRevision}{p.baseRevision!==current.revision&&p.status==="pending"?" · Out of date; approval is disabled.":""}</p>
 {p.status==="pending"&&<><button type="button" onClick={()=>setCompared(p.id)}>Compare this proposal</button>
 {compared===p.id&&<><div className={styles.compare}><div><h4>Current saved research</h4><div className={styles.preview}>{describeMinistry(current.data,"research")}</div></div><div><h4>Proposed result{p.baseRevision!==current.revision?" (out of date)":""}</h4><div className={styles.preview}>{p.baseRevision===current.revision?describeMinistry({...current.data,...p.patch} as MinistryDocument["data"],"research"):"This proposal used an older revision. It cannot be safely compared with current work or approved. Reject it and ask for a fresh proposal. Proposed fields: "+Object.keys(p.patch).join(", ")}</div></div></div>
 <p className={styles.notice}>Approval saves a new revision of this research only. It does not confirm inferred notes or theological positions.</p>
 <div className={styles.actions}>{(["approve","reject"] as const).map(decision=><button key={decision} type="button" disabled={action.busy||(decision==="approve"&&(dirty||p.baseRevision!==current.revision))} onClick={async()=>{
  if(!window.confirm(decision==="approve"?"Approve these exact proposed changes as a new saved research revision?":"Reject this proposal without changing your saved research?"))return;
  const result=await action.run<{document:MinistryDocument}>("/api/ministry/proposals/decision",{proposalId:p.id,expectedRevision:current.revision,decision});
  if(result){if(decision==="approve")onDecide(result.document);read.retry();setCompared(null);}
 }}>{decision==="approve"?"Approve compared changes":"Reject proposal"}</button>)}</div>{dirty&&<p className={styles.muted}>Save or discard your unsaved changes before approving a proposal.</p>}</>}</>}</article>)}
 {!read.data?.proposals.length&&current.kind==="research"&&<p className={styles.muted}>No research proposals yet. A connected assistant can suggest a revision; you compare and approve it here.</p>}
 </>}
 <Validation message={action.error}/>
 </section>;
}
