"use client";
import Link from "next/link";
import {useState} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import type {ProfileResult} from "@/lib/writing/profile-contracts";
import type {WritingResource} from "@/lib/writing/contracts";
import {useWritingRead} from "./use-writing-read";
import {useWritingAction} from "./use-writing-action";
import styles from "./writing.module.css";
export function WritingProfileGuide({resource,onProposalSaved}:{resource:WritingResource;onProposalSaved:()=>void}){
 const profile=useWritingRead<ProfileResult>("/api/writing/profile","writer.profile");
 const {bundleExperience}=useWorkspace(),{run,busy,error}=useWritingAction();
 const [topic,setTopic]=useState(""),[theme,setTheme]=useState(""),[notice,setNotice]=useState("");
 if(!profile.enabled)return null;
 const p=profile.data?.profile,canPropose=bundleExperience?.capabilityIds.includes("writer.resource.metadata");
 async function propose(kind:"topics"|"themes",value:string){
  if(!value||!p)return;
  const existing=kind==="topics"?resource.topics:resource.metadata.themes||[];
  if(existing.length>=30||existing.some(v=>v.toLowerCase()===value.toLowerCase()))return;
  const patch=kind==="topics"?{topics:[...existing,value]}:{metadata:{...resource.metadata,themes:[...existing,value]}};
  const result=await run("/api/writing/proposals",{resourceId:resource.id,baseRevision:resource.revision,patch,
   reason:"Classify with a preferred "+(kind==="topics"?"topic: ":"theme: ")+value,
   evidence:"The user selected this label from confirmed Writing profile revision "+profile.data?.revision+" for resource revision "+resource.revision+". It is a classification proposal, not an automated source interpretation."},true);
  if(result){setNotice("Classification proposal saved in Revisions & proposals below.");onProposalSaved();}
 }
 return <section className={styles.revisions} aria-label="Confirmed writing guidance">
  <div className={styles.sectionHeading}><h2>Review with your preferences in view.</h2><Link href="/workspace/writing/preferences" className={styles.textLink}>Writing preferences</Link></div>
  {profile.loading?<p role="status">Loading confirmed writing guidance…</p>:profile.error?<p role="alert">{profile.error} <button onClick={profile.retry}>Retry guidance</button></p>:!p?<p>No writing preferences are confirmed yet. Add your voice, editorial boundaries and preferred labels when you are ready.</p>:
   <><details className={styles.history}><summary>Confirmed profile · revision {profile.data?.revision}</summary>
    <dl className={styles.profileFacts}>{[["Voice",p.voice_notes],["Readers",p.audience_notes],["Editing boundaries",p.editing_boundaries],["Preferred wording",p.preferred_terms?.join(", ")],["Avoid",p.avoid_terms?.join(", ")],["Publication preferences",p.website_notes]].filter(([,value])=>Boolean(value)).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   </details>
   {canPropose&&<><p className={styles.method}>Choose a label only when it fits this source. Nothing is reclassified until you approve its saved proposal.</p>
    <div className={styles.taxonomyControls}>{[{kind:"topics" as const,label:"Preferred topic",value:topic,set:setTopic,labels:p.topics||[],existing:resource.topics},
      {kind:"themes" as const,label:"Preferred theme",value:theme,set:setTheme,labels:p.themes||[],existing:resource.metadata.themes||[]}].map(item=><div key={item.kind}>
      <label>{item.label}<select aria-label={item.label} value={item.value} disabled={busy} onChange={e=>item.set(e.target.value)}><option value="">Choose a label</option>
       {item.labels.map(value=><option key={value} value={value} disabled={item.existing.some(v=>v.toLowerCase()===value.toLowerCase())}>{value}</option>)}</select></label>
      <button className={styles.secondary} disabled={busy||!item.value||item.existing.length>=30||item.existing.some(v=>v.toLowerCase()===item.value.toLowerCase())} onClick={()=>void propose(item.kind,item.value)}>Propose {item.kind==="topics"?"topic":"theme"}</button>
     </div>)}</div></>}
   </>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
