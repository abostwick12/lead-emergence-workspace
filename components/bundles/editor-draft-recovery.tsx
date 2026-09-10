"use client";
import {useState} from "react";
import type {EditorDraftSnapshot} from "@/vendor/lead-emergence-bundles/domain-contracts/editor-recovery";
import styles from "./editor-draft-recovery.module.css";
type Props={
 loaded:boolean;loadError:string|null;recovery:EditorDraftSnapshot|null;saving:boolean;dirty:boolean;error:string|null;conflict:boolean;
 savedAt:string|null;restored:boolean;staleSource:boolean;sourceRevision:number;baseRevision:number;receipt:{operation:string;committedDocumentId:string|null;committedRevision:number|null}|null;
 changedSections:string[];editingBlocked:boolean;data:Record<string,unknown>;
 restore:()=>void;discard:()=>Promise<boolean>;rebase:()=>Promise<boolean>;flush:()=>Promise<boolean>;reload:()=>void;onOpenLatest:()=>void;onOpenCommitted?:(id:string)=>void;
};
const label=(value:string)=>value.replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,c=>c.toUpperCase());
export function EditorDraftRecovery(props:Props){
 const [copied,setCopied]=useState<string|null>(null);
 const recoveryData=props.recovery?.values?.data;
 const copy=async()=>{
  try{await navigator.clipboard.writeText(JSON.stringify(recoveryData??props.data,null,2));setCopied("A private copy of the on-screen draft is on your clipboard.");}
  catch{setCopied("Copy is unavailable. Keep this page open while you select the text you need.");}
 };
 if(!props.loaded)return <section className={styles.card} aria-live="polite"><strong>Checking for unfinished work…</strong><span>The editor stays closed until its private recovery state is known.</span></section>;
 if(props.loadError)return <section className={styles.card} role="alert"><strong>Pause before editing</strong><span>{props.loadError}</span><div className={styles.actions}><button type="button" onClick={props.reload}>Retry recovery check</button><button type="button" onClick={props.onOpenLatest}>Open latest saved revision</button></div></section>;
 if(props.recovery?.values)return <section className={styles.card} role="alert">
  <strong>Unfinished work is available</strong>
  <span>Saved privately {props.recovery.savedAt?new Date(props.recovery.savedAt).toLocaleString():"during an earlier visit"}. It is separate from the official record and has not been approved, sent or published.</span>
  {props.recovery.baseRevision!==props.recovery.currentRevision&&<span className={styles.warning}>It began on saved revision {props.recovery.baseRevision}; the official record is now revision {props.recovery.currentRevision}. Restore it to compare, but it cannot replace the latest record until you explicitly rebase and confirm.</span>}
  {!!props.changedSections.length&&<details><summary>Sections that differ from the latest saved record</summary><ul>{props.changedSections.map(k=><li key={k}>{label(k)}</li>)}</ul></details>}
  <div className={styles.actions}><button type="button" onClick={props.restore}>Restore unfinished work</button><button type="button" className={styles.secondary} disabled={props.saving} onClick={()=>void props.discard()}>Discard it</button><button type="button" className={styles.secondary} onClick={()=>void copy()}>Copy it</button></div>{copied&&<span aria-live="polite">{copied}</span>}
 </section>;
 return <section className={styles.card} aria-live="polite">
  <div className={styles.status}><strong>{props.saving?"Saving private working draft…":props.error?"Working draft needs attention":props.dirty?"Unsaved changes · saving shortly":props.savedAt?"Working draft saved":"Private recovery is ready"}</strong>
   <span>{props.savedAt&&!props.dirty?"Last saved "+new Date(props.savedAt).toLocaleTimeString():"Unfinished work stays separate from official saved revisions."}</span></div>
  {props.restored&&<span>Your unfinished work is restored on screen. Review it before confirming an official save.</span>}
  {props.staleSource&&<><span className={styles.warning}>This recovered draft began on revision {props.baseRevision}, while the official record is revision {props.sourceRevision}. Changed sections: {props.changedSections.map(label).join(", ")||"record structure"}.</span>
   <div className={styles.actions}><button type="button" disabled={props.saving} onClick={()=>void props.rebase()}>Base draft on revision {props.sourceRevision}</button><button type="button" className={styles.secondary} onClick={props.onOpenLatest}>Open latest saved revision</button></div></>}
  {props.error&&<><span role="alert" className={styles.warning}>{props.error}</span><div className={styles.actions}><button type="button" disabled={props.saving||props.staleSource} onClick={()=>void props.flush()}>Retry same draft save</button><button type="button" className={styles.secondary} onClick={props.reload}>Check server draft</button><button type="button" className={styles.secondary} onClick={()=>void copy()}>Copy my work</button></div></>}
  {props.receipt?.operation==="commit"&&props.receipt.committedDocumentId&&<div className={styles.completed} role="status"><strong>Official save completed as revision {props.receipt.committedRevision}.</strong>{props.onOpenCommitted&&<button type="button" onClick={()=>props.onOpenCommitted?.(props.receipt!.committedDocumentId!)}>Open saved record</button>}</div>}
  {(props.savedAt||props.dirty||props.restored)&&<div className={styles.actions}><button type="button" className={styles.secondary} disabled={props.saving} onClick={()=>void props.discard()}>Discard working draft</button></div>}
  {copied&&<span>{copied}</span>}<span className={styles.method}>Only the signed-in owner’s native editor can recover this draft. It is not an assistant proposal or an approved record.</span>
 </section>;
}
