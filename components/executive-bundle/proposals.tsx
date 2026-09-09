"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {executiveCapabilities,executiveLabels,executiveProposalsResult,type ExecutiveKind,type ExecutiveProposal,type ExecutiveDocument} from "@/lib/executive-bundle/contracts";
import {describeExecutive,changedExecutiveFields} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead,useExecutiveAction} from "./use-executive";
import {ReferenceFields} from "./references";
import {ExecutiveFrame,AccessState,ReadState,Choice,Disclosure,Validation,styles} from "./common";
export function ExecutiveProposals({kind}:{kind:ExecutiveKind}){
 const [status,setStatus]=useState("pending"),[offset,setOffset]=useState(0),[notice,setNotice]=useState<string|null>(null);
 const read=useExecutiveRead<z.infer<typeof executiveProposalsResult>>("/api/executive/"+kind+"/proposals?"+new URLSearchParams({status,offset:String(offset)}),executiveCapabilities[kind]);
 if(!read.enabled)return <AccessState/>;
 return <ExecutiveFrame title={"Review "+executiveLabels[kind].toLowerCase()+" proposals"} description="A proposal is not a saved coordination record. Inspect the exact result and its evidence before you decide. Originals and prior decisions stay recoverable.">
 <Choice label="Proposal status" value={status} values={["pending","approved","rejected"]} onChange={v=>{setStatus(v);setOffset(0);setNotice(null);}}/>
 {notice&&<p className={styles.notice} role="status">{notice}</p>}
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.proposals.length?<div className={styles.empty}><h2>No {status} proposals</h2><p>Ask your authorized assistant to prepare a commitment, decision, meeting plan or brief. It will appear here for your review; no record changes until you approve.</p><Link href={"/workspace/executive/"+kind}>Return to {executiveLabels[kind].toLowerCase()}</Link></div>:
 read.data.proposals.map(p=><Proposal key={read.key+":"+p.id} proposal={p} onDecide={decision=>{setNotice(decision==="approve"?"Approved and saved as a recoverable revision. No meeting was booked, message sent or recurring automation started.":"Proposal rejected. The proposed text remains available under Rejected; canonical records were not changed.");read.retry();}}/>)}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Proposal pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous proposals</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next proposals</button></nav>}
 </ExecutiveFrame>;
}
function Proposal({proposal:p,onDecide}:{proposal:ExecutiveProposal;onDecide:(decision:string)=>void}){
 const [confirm,setConfirm]=useState(false),action=useExecutiveAction();
 const read=useExecutiveRead<{document:ExecutiveDocument}>("/api/executive/"+p.kind+"/"+(p.documentId??""),p.documentId&&p.status==="pending"?executiveCapabilities[p.kind]:"__no_read__");
 const current=read.data?.document,stale=!!p.documentId&&current?.revision!==p.baseRevision;
 const ready=p.documentId?!!current&&!read.error&&!read.loading:true;
 const decide=async(decision:"approve"|"reject")=>{
  const result=await action.run("/api/executive/proposals/decision",{proposalId:p.id,expectedRevision:p.baseRevision,decision,confirmExactRecord:decision==="approve"&&confirm});
  if(result)onDecide(decision);
 };
 return <section className={styles.section}><p className={styles.eyebrow}>{p.origin} proposal · {p.status} · {p.documentId?"Based on revision "+p.baseRevision:"New record"}</p><h2>{p.data.title}</h2><p><strong>Reason:</strong> {p.reason}</p><p><strong>Evidence:</strong> {p.evidence}</p>
 {p.status==="pending"&&p.documentId&&(read.loading||read.error)&&<ReadState loading={read.loading} error={read.error} retry={read.retry}/>}
 {p.status==="pending"&&ready&&<p className={styles.notice}>{stale?"This record changed since the proposal. Approval is disabled. Open the latest record and ask for an updated proposal, or reject this one.":"Review the complete proposed record. "+(current?"Changed fields: "+changedExecutiveFields(current.data,p.data).join(", "):"This creates a new record only after you approve.")}</p>}
 <ReferenceFields references={p.data.references}/>
 <Disclosure initialOpen={p.status==="pending"} summary="Compare the complete proposal"><div className={styles.compare}>{current&&<div><h3>Current saved revision {current.revision}</h3><pre className={styles.preview}>{describeExecutive(current.data)}</pre></div>}<div><h3>Exact proposed record</h3><pre className={styles.preview}>{describeExecutive(p.data)}</pre></div></div></Disclosure>
 {p.status==="pending"?<><label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} disabled={action.busy||!ready||stale}/><span>I reviewed the exact proposal and its evidence. The linked source access and evidence are appropriate. Inferred content remains inferred; approval does not verify facts, establish a meeting agreement or authorize external actions.</span></label>
 <Validation message={action.error}/><div className={styles.actions}><button disabled={!confirm||!ready||stale||action.busy} onClick={()=>void decide("approve")}>{action.busy?"Recording decision…":"Approve and save proposal"}</button><button disabled={action.busy} onClick={()=>void decide("reject")}>Reject proposal</button>{p.documentId&&<Link href={"/workspace/executive/"+p.kind+"/"+p.documentId}>Open latest saved record</Link>}</div></>:
 p.appliedDocumentId&&<Link href={"/workspace/executive/"+p.kind+"/"+p.appliedDocumentId}>Open the resulting saved record</Link>}
 </section>;
}
