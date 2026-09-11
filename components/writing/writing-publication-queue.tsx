"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, ListChecks, ShieldCheck } from "lucide-react";
import type { PublicationQueueItem, PublicationQueueReceipt, PublicationQueueResult } from "@/lib/writing/publication-readiness";
import { useWritingAction } from "./use-writing-action";
import { useWritingRead } from "./use-writing-read";
import { WritingAccessState } from "./writing-library";
import styles from "./writing.module.css";

const emptyConfirmations={accuracyAndQuotesReviewed:false,voiceReviewed:false,rightsConfirmed:false};
type LinkResult="working"|"redirected"|"broken"|"access_limited";
const stageCopy={queued:"Queued",blocked:"Blocked",ready_for_handoff:"Ready for handoff",handed_off:"Handoff recorded",removed:"Removed"} as const;
const evidenceCopy={unchecked:"Unchecked",checked:"Checked",stale:"Stale",error:"Needs attention"} as const;

export function WritingPublicationQueuePage(){
  const [stage,setStage]=useState("");
  const params=new URLSearchParams({limit:"25"});if(stage)params.set("stage",stage);
  const queue=useWritingRead<PublicationQueueResult>("/api/writing/publication?"+params,"writer.publication.queue");
  if(!queue.enabled)return <WritingAccessState/>;
  return <section className={styles.workspace} aria-label="Writing publication queue">
    <Link className={styles.back} href="/workspace/writing"><ArrowLeft size={16}/> Resource library</Link>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Writer & Editor · Publication readiness</p><h1>Know exactly what is ready—and why.</h1>
      <p>Carry one saved revision from editorial review through destination checking and a recorded handoff. Workspace never opens or publishes to a website for you.</p></div>
      <span className={styles.readOnly}><ShieldCheck size={15}/>User-controlled handoff</span>
    </header>
    {queue.data&&<div className={styles.queueSummary} aria-label="Publication queue summary">
      <div><strong>{queue.data.total}</strong><span>active</span></div><div><strong>{queue.data.counts.readyForHandoff}</strong><span>ready now</span></div>
      <div><strong>{queue.data.counts.blocked}</strong><span>blocked</span></div><div><strong>{queue.data.counts.handedOff}</strong><span>handed off</span></div>
    </div>}
    <div className={styles.queueToolbar}><div><h2>Publication plans</h2><p>Readiness always reflects the current resource, confirmations, and link evidence.</p></div>
      <label className={styles.filter}>Queue stage<select value={stage} onChange={event=>setStage(event.target.value)}>
        <option value="">All active items</option><option value="queued">Queued</option><option value="blocked">Blocked</option>
        <option value="ready_for_handoff">Ready for handoff</option><option value="handed_off">Handoff recorded</option>
      </select></label></div>
    {queue.loading?<div className={styles.empty} role="status">Checking current publication evidence…</div>:
      queue.error?<div className={styles.empty} role="alert"><h2>We couldn’t load the queue</h2><p>{queue.error}</p><button className={styles.secondary} onClick={queue.retry}>Try again</button></div>:
      !queue.data?.items.length?<div className={styles.empty}><ListChecks size={30}/><h2>{queue.data?.total?"Nothing matches this stage":"Nothing is waiting for a handoff"}</h2>
        <p>{queue.data?.total?"Choose another stage to see the rest of the queue.":"Open a reviewed resource, prepare its saved publication packet, and add that exact revision here."}</p>
        <Link className={styles.textLink} href="/workspace/writing">Choose a resource <ArrowRight size={16}/></Link></div>:
      <div className={styles.queueList}>{queue.data.items.map(item=><PublicationQueueCard key={item.id} value={item} onChanged={queue.refresh}/>)}</div>}
    <footer className={styles.footer}>A checked link is a dated user observation, not continuous monitoring. Handoff is not publication, provider confirmation, or website approval.</footer>
  </section>;
}

function PublicationQueueCard({value,onChanged}:{value:PublicationQueueItem;onChanged:()=>void}){
  const [item,setItem]=useState(value),[destination,setDestination]=useState(value.destinationUrl??""),[note,setNote]=useState(value.note),
    [confirmations,setConfirmations]=useState(value.confirmations),[notice,setNotice]=useState(""),[linkResult,setLinkResult]=useState<LinkResult>("working"),
    [finalUrl,setFinalUrl]=useState(""),[evidenceNote,setEvidenceNote]=useState(""),[observed,setObserved]=useState(false),[handoffConfirmed,setHandoffConfirmed]=useState(false);
  const saveAction=useWritingAction(),evidenceAction=useWritingAction();
  useEffect(()=>{setItem(value);setDestination(value.destinationUrl??"");setNote(value.note);setConfirmations(value.confirmations);},[value]);
  const drifted=item.resourceRevision!==item.currentResourceRevision;
  const destinationChanged=(destination.trim()||null)!==item.destinationUrl;
  async function save(stage:PublicationQueueItem["stage"],rebase=false){
    setNotice("");
    const result=await saveAction.run<PublicationQueueReceipt>("/api/writing/publication",{
      resourceId:item.resourceId,expectedResourceRevision:rebase?item.currentResourceRevision:item.resourceRevision,expectedVersion:item.version,
      destinationUrl:destination.trim()||null,note,stage,confirmations:rebase?emptyConfirmations:confirmations,confirmQueueChange:true
    },true);
    if(result){setItem(result.item);setDestination(result.item.destinationUrl??"");setNote(result.item.note);setConfirmations(result.item.confirmations);
      setNotice(result.replayed?"Your earlier queue decision was recovered safely.":stage==="removed"?"Removed from the active queue. The resource and queue history remain intact.":stage==="handed_off"?"Handoff recorded for this exact revision. It is not marked published.":"Publication review saved.");onChanged();}
  }
  async function recordEvidence(){
    setNotice("");
    const result=await evidenceAction.run<PublicationQueueReceipt>("/api/writing/publication/evidence",{
      queueId:item.id,expectedVersion:item.version,result:linkResult,finalUrl:linkResult==="redirected"?(finalUrl.trim()||null):null,note:evidenceNote,confirmObservation:observed
    },true);
    if(result){setItem(result.item);setObserved(false);setEvidenceNote("");setFinalUrl("");setNotice(result.replayed?"Your earlier link observation was recovered safely.":"Your dated link observation was recorded.");onChanged();}
  }
  function confirmation(key:keyof typeof confirmations,value:boolean){setConfirmations(current=>({...current,[key]:value}));}
  return <article className={styles.queueCard} aria-label={"Publication plan: "+item.title} data-stage={item.stage}>
    <div className={styles.queueCardHeading}><div><p className={styles.eyebrow}>Revision {item.resourceRevision} · queue version {item.version}</p><h2><Link href={"/workspace/writing/"+item.resourceId}>{item.title}</Link></h2></div>
      <div className={styles.queueBadges}><span className={styles.badge} data-state={item.stage}>{stageCopy[item.stage]}</span><span className={styles.evidenceBadge} data-state={item.evidenceStatus}>{evidenceCopy[item.evidenceStatus]}</span></div></div>
    {drifted&&<div className={styles.queueWarning}><AlertTriangle size={19}/><div><strong>Revision {item.currentResourceRevision} is now current.</strong><p>This plan and its confirmations cover revision {item.resourceRevision}. Rebase to continue; every human check will reset.</p></div>
      <button className={styles.secondary} disabled={saveAction.busy} onClick={()=>void save("queued",true)}>Use revision {item.currentResourceRevision}</button></div>}
    <div className={styles.queueColumns}>
      <section className={styles.queueSection} aria-label="Plan details"><h3>1 · Record the plan</h3>
        <label>Public destination<span>Use the exact page you intend to review. Public HTTPS websites only.</span><input type="url" inputMode="url" maxLength={2000} value={destination} placeholder="https://resources.example.org/article" onChange={event=>setDestination(event.target.value)}/></label>
        <label>Handoff note<span>Optional context for the person publishing this revision.</span><textarea rows={3} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/></label>
        <fieldset className={styles.queueChecks}><legend>Human review</legend>
          <label><input type="checkbox" checked={confirmations.accuracyAndQuotesReviewed} onChange={event=>confirmation("accuracyAndQuotesReviewed",event.target.checked)}/><span><strong>Accuracy and quotations reviewed</strong>Claims, citations, and quotations were checked against their sources.</span></label>
          <label><input type="checkbox" checked={confirmations.voiceReviewed} onChange={event=>confirmation("voiceReviewed",event.target.checked)}/><span><strong>Author voice reviewed</strong>The final copy matches the intended meaning and confirmed voice.</span></label>
          <label><input type="checkbox" checked={confirmations.rightsConfirmed} onChange={event=>confirmation("rightsConfirmed",event.target.checked)}/><span><strong>Rights confirmed</strong>The necessary rights and permissions are recorded.</span></label>
        </fieldset>
        <div className={styles.actionRow}><button className={styles.secondary} disabled={saveAction.busy||drifted} onClick={()=>void save(item.stage==="blocked"?"blocked":"queued")}>Save review progress</button>
          <button className={styles.textButton} disabled={saveAction.busy||drifted||item.stage==="blocked"} onClick={()=>void save("blocked")}>Mark blocked</button></div>
      </section>
      <section className={styles.queueSection} aria-label="Destination evidence"><h3>2 · Check the destination</h3>
        <p className={styles.queueExplainer}>Workspace does not fetch this URL. Open the saved destination yourself, inspect it, then record only what you observed.</p>
        {item.destinationUrl&&!drifted&&!destinationChanged?<a className={styles.destinationLink} href={item.destinationUrl} target="_blank" rel="noopener noreferrer">Open saved destination <ExternalLink size={16}/></a>:
          <p className={styles.queueHint}>{drifted?"Rebase the resource before checking its destination.":destinationChanged?"Save the exact destination before recording evidence.":"Add and save a destination first."}</p>}
        {item.lastEvidence&&<div className={styles.lastEvidence}><strong>Last observation · {evidenceCopy[item.evidenceStatus]}</strong><span>{item.lastEvidence.result.replaceAll("_"," ")} · {new Date(item.lastEvidence.checkedAt).toLocaleString()}</span>{item.lastEvidence.note&&<p>{item.lastEvidence.note}</p>}</div>}
        <label>What did you observe?<select value={linkResult} onChange={event=>setLinkResult(event.target.value as LinkResult)}><option value="working">Page worked</option><option value="redirected">Redirected to another page</option><option value="broken">Page was broken or missing</option><option value="access_limited">Access was limited</option></select></label>
        {linkResult==="redirected"&&<label>Final destination<span>Record the public HTTPS page where you arrived.</span><input type="url" maxLength={2000} value={finalUrl} onChange={event=>setFinalUrl(event.target.value)}/></label>}
        <label>Observation note<span>Optional; do not include credentials or private client information.</span><textarea rows={2} maxLength={1000} value={evidenceNote} onChange={event=>setEvidenceNote(event.target.value)}/></label>
        <label className={styles.confirm}><input type="checkbox" checked={observed} onChange={event=>setObserved(event.target.checked)}/>I opened the saved destination and confirm this is what I observed.</label>
        <button className={styles.secondary} disabled={evidenceAction.busy||!observed||!item.destinationUrl||destinationChanged||drifted} onClick={()=>void recordEvidence()}>Record dated link check</button>
      </section>
    </div>
    <section className={styles.readinessPanel} aria-label="Current readiness">
      <div><p className={styles.eyebrow}>3 · Current decision</p><h3>{item.readyForHandoff?"This revision has complete handoff evidence.":item.blockers.length+(item.blockers.length===1?" item needs":" items need")+" attention."}</h3>
        <p>{item.readyForHandoff?"You can deliberately mark this exact revision ready. Nothing will be sent or published.":"The list updates only from saved resource facts, confirmations, and dated evidence."}</p></div>
      {item.blockers.length>0&&<ul className={styles.blockerList}>{item.blockers.map(blocker=><li key={blocker.code}><strong>{blocker.label}</strong><span>{blocker.detail}</span></li>)}</ul>}
      <div className={styles.actionRow}>
        {item.readyForHandoff&&!['ready_for_handoff','handed_off'].includes(item.stage)&&<button className={styles.primaryAction} disabled={saveAction.busy||drifted} onClick={()=>void save("ready_for_handoff")}>Mark this revision ready for handoff</button>}
        {item.stage==="ready_for_handoff"&&item.readyForHandoff&&<><label className={styles.confirm}><input type="checkbox" checked={handoffConfirmed} onChange={event=>setHandoffConfirmed(event.target.checked)}/>I exported and handed off this exact saved revision.</label><button className={styles.primaryAction} disabled={saveAction.busy||!handoffConfirmed} onClick={()=>void save("handed_off")}>Record handoff</button></>}
        {item.stage==="handed_off"&&<span className={styles.handoffState}><CheckCircle2 size={18}/>Handoff recorded—not published.</span>}
        <button className={styles.textButton} disabled={saveAction.busy} onClick={()=>void save("removed")}>Remove from active queue</button>
      </div>
    </section>
    {(saveAction.error||evidenceAction.error)&&<p className={styles.queueError} role="alert">{saveAction.error||evidenceAction.error}</p>}
    {notice&&<p className={styles.queueNotice} role="status">{notice}</p>}
  </article>;
}
