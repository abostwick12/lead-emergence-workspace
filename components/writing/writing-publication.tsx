"use client";
import {useEffect,useRef,useState} from "react";
import {workspaceRead,WorkspaceReadError} from "@/lib/bundles/client";
import {useWorkspace} from "@/components/workspace-provider";
import {publicationPacket,publicationText,type PublicationPacket} from "@/lib/writing/publication";
import {useWritingRead} from "./use-writing-read";
import styles from "./writing.module.css";
export function WritingPublication({resourceId,revision}:{resourceId:string;revision:number}){
 const [opened,setOpened]=useState(false);
 return <section className={styles.revisions} aria-label="Publication preparation">
  <div className={styles.sectionHeading}><h2>A handoff you can actually use.</h2><button className={styles.secondary} onClick={()=>setOpened(!opened)}>{opened?"Close publication packet":"Prepare publication packet"}</button></div>
  <p className={styles.method}>Prepare web copy and a source-backed checklist from saved revision {revision}. This does not publish, verify links, certify accuracy or change your library.</p>
  {opened&&<PublicationPanel resourceId={resourceId} revision={revision}/>}
 </section>;
}
function PublicationPanel({resourceId,revision}:{resourceId:string;revision:number}){
 const live=useRef(true);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const {refreshBundleExperience}=useWorkspace();
 const path="/api/writing/resources/"+resourceId+"/publication?revision="+revision;
 const packet=useWritingRead<PublicationPacket>(path,"writer.resource.review");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function output(kind:"body"|"summary"|"text"|"json"){
  setBusy(true);setNotice("");
  try{
   // Re-authorize and check the exact revision immediately before exporting.
   const current=publicationPacket.parse(await workspaceRead<PublicationPacket>(path));
   if(!live.current)return;
   if(kind==="body"||kind==="summary"){await navigator.clipboard.writeText(kind==="body"?current.content.bodyText:current.content.summary);setNotice(kind==="body"?"Saved source text copied.":"Website summary copied.");}
   else {
    const blob=new Blob([kind==="json"?JSON.stringify(current,null,2):publicationText(current)],{type:kind==="json"?"application/json":"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download="writing-"+resourceId+"-r"+revision+(kind==="json"?".json":".txt");anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("Publication packet downloaded. It has not been published; downloaded copies remain outside Workspace.");
   }
  }catch(e){if(e instanceof WorkspaceReadError&&[401,403].includes(e.status))refreshBundleExperience();
   if(live.current)setNotice(e instanceof WorkspaceReadError&&e.status===409?"This saved revision changed. Reload the resource and prepare its latest version before exporting.":e instanceof Error?e.message:"Could not prepare the output. Retry after checking your access.");}
  finally{if(live.current)setBusy(false);}
 }
 if(packet.loading)return <p role="status">Preparing the saved revision and review checklist…</p>;
 if(packet.error||!packet.data)return <div role="alert"><p>{packet.error}</p><button className={styles.secondary} onClick={packet.retry}>Retry packet</button></div>;
 const p=packet.data;
 return <div className={styles.publicationPanel}>
  <p>Revision {p.revision} · Prepared {new Date(p.preparedAt).toLocaleString()} · {p.pendingProposals} pending proposals excluded</p>
  <div className={styles.actionRow}>
   <button className={styles.secondary} disabled={busy} onClick={()=>void output("body")}>Copy saved text</button>
   <button className={styles.secondary} disabled={busy||!p.content.summary} onClick={()=>void output("summary")}>Copy website summary</button>
   <button className={styles.secondary} disabled={busy} onClick={()=>void output("text")}>Download handoff text</button>
   <button className={styles.secondary} disabled={busy} onClick={()=>void output("json")}>Download structured packet</button>
  </div>
  {notice&&<p role="status">{notice}</p>}
  <div className={styles.formGrid}><div><h3>Website summary</h3><p className={styles.prose}>{p.content.summary||"Not prepared in the current revision."}</p></div><div><h3>SEO description</h3><p className={styles.prose}>{p.content.seoDescription||"Not prepared in the current revision."}</p></div></div>
  <ul className={styles.findings}>{p.checklist.map(check=><li key={check.id}><h3>{check.label} · {check.status.replaceAll("_"," ")}</h3><p>{check.detail}</p></li>)}</ul>
  <p className={styles.method}>Source: {p.source.label} · Evidence status: {p.source.evidenceStatus}. Private draft/profile fields and stored file/provider identifiers are not added. Review the source text for private information before sharing.</p>
  <p>{p.publicationDecision}</p>
 </div>;
}
