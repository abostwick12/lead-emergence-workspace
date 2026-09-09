"use client";
import Link from "next/link";
import {useState} from "react";
import {z} from "zod";
import {nonprofitCapabilities,nonprofitLabels,nonprofitProposalsResult,type NonprofitKind,type NonprofitProposal,type NonprofitDocument} from "@/lib/nonprofit-bundle/contracts";
import {describeNonprofit,changedNonprofitFields} from "@/lib/nonprofit-bundle/presentation";
import {useNonprofitRead,useNonprofitAction} from "./use-nonprofit";
import {NonprofitFrame,AccessState,ReadState,Choice,Disclosure,Validation,styles} from "./common";
export function NonprofitProposals({kind}:{kind:NonprofitKind}){
 const [status,setStatus]=useState("pending"),[offset,setOffset]=useState(0),[notice,setNotice]=useState<string|null>(null);
 const read=useNonprofitRead<z.infer<typeof nonprofitProposalsResult>>("/api/nonprofit/"+kind+"/proposals?"+new URLSearchParams({status,offset:String(offset)}),nonprofitCapabilities[kind]);
 if(!read.enabled)return <AccessState/>;
 return <NonprofitFrame title={"Review "+nonprofitLabels[kind].toLowerCase()+" proposals"} description="A proposal is not a saved founder record. Inspect the exact result and its evidence before you decide. Originals and prior decisions stay recoverable.">
 <Choice label="Proposal status" value={status} values={["pending","approved","rejected"]} onChange={v=>{setStatus(v);setOffset(0);setNotice(null);}}/>
 {notice&&<p className={styles.notice} role="status">{notice}</p>}
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:!read.data?.proposals.length?<div className={styles.empty}><h2>No {status} proposals</h2><p>Ask your authorized assistant to prepare a roadmap, relationship, meeting or source-first research proposal. It will appear here for your review; no record changes until you approve.</p><Link href={"/workspace/nonprofit/"+kind}>Return to {nonprofitLabels[kind].toLowerCase()}</Link></div>:
 read.data.proposals.map(p=><Proposal key={read.key+":"+p.id} proposal={p} onDecide={decision=>{setNotice(decision==="approve"?"Approved and saved as a recoverable revision. Nothing was sent, booked or certified.":"Proposal rejected. The proposed text remains available under Rejected; canonical records were not changed.");read.retry();}}/>)}
 {read.data&&read.data.total>25&&<nav className={styles.actions} aria-label="Proposal pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous proposals</button><span>{offset+1}–{Math.min(offset+25,read.data.total)} of {read.data.total}</span><button disabled={offset+25>=read.data.total} onClick={()=>setOffset(offset+25)}>Next proposals</button></nav>}
 </NonprofitFrame>;
}
function Proposal({proposal:p,onDecide}:{proposal:NonprofitProposal;onDecide:(decision:string)=>void}){
 const [confirm,setConfirm]=useState(false),action=useNonprofitAction();
 const read=useNonprofitRead<{document:NonprofitDocument}>("/api/nonprofit/"+p.kind+"/"+(p.documentId??""),p.documentId&&p.status==="pending"?nonprofitCapabilities[p.kind]:"__no_read__");
 const current=read.data?.document,stale=!!p.documentId&&current?.revision!==p.baseRevision;
 const ready=p.documentId?!!current&&!read.error&&!read.loading:true;
 const decide=async(decision:"approve"|"reject")=>{
  const result=await action.run("/api/nonprofit/proposals/decision",{proposalId:p.id,expectedRevision:p.baseRevision,decision,confirmAdministrative:decision==="approve"&&confirm});
  if(result)onDecide(decision);
 };
 return <section className={styles.section}><p className={styles.eyebrow}>{p.origin} proposal · {p.status} · {p.documentId?"Based on revision "+p.baseRevision:"New record"}</p><h2>{p.data.title}</h2><p><strong>Reason:</strong> {p.reason}</p><p><strong>Evidence:</strong> {p.evidence}</p>
 {p.status==="pending"&&p.documentId&&(read.loading||read.error)&&<ReadState loading={read.loading} error={read.error} retry={read.retry}/>}
 {p.status==="pending"&&ready&&<p className={styles.notice}>{stale?"This record changed since the proposal. Approval is disabled. Open the latest record and ask for an updated proposal, or reject this one.":"Review the complete proposed record. "+(current?"Changed fields: "+changedNonprofitFields(current.data,p.data).join(", "):"This creates a new record only after you approve.")}</p>}
 <Disclosure initialOpen={p.status==="pending"} summary="Compare the complete proposal"><div className={styles.compare}>{current&&<div><h3>Current saved revision {current.revision}</h3><pre className={styles.preview}>{describeNonprofit(current.data,p.kind)}</pre></div>}<div><h3>Exact proposed record</h3><pre className={styles.preview}>{describeNonprofit(p.data,p.kind)}</pre></div></div></Disclosure>
 {p.status==="pending"?<><label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} disabled={action.busy||!ready||stale}/><span>I reviewed the exact proposal and its evidence. It contains administrative information only, not patient or clinical information. Inferred interpretations remain inferred.</span></label>
 <Validation message={action.error}/><div className={styles.actions}><button disabled={!confirm||!ready||stale||action.busy} onClick={()=>void decide("approve")}>{action.busy?"Recording decision…":"Approve and save proposal"}</button><button disabled={action.busy} onClick={()=>void decide("reject")}>Reject proposal</button>{p.documentId&&<Link href={"/workspace/nonprofit/"+p.kind+"/"+p.documentId}>Open latest saved record</Link>}</div></>:
 p.appliedDocumentId&&<Link href={"/workspace/nonprofit/"+p.kind+"/"+p.appliedDocumentId}>Open the resulting saved record</Link>}
 </section>;
}
