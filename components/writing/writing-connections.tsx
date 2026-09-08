"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import type { WritingResource } from "@/lib/writing/contracts";
import type { WritingConnections as Connections } from "@/lib/writing/discovery-contracts";
import { useWritingRead } from "./use-writing-read";
import { useWritingAction } from "./use-writing-action";
import styles from "./writing.module.css";
const signals:Record<string,string>={
  same_text_ignoring_whitespace:"Same recorded text (ignoring whitespace)",
  same_title_ignoring_case_and_whitespace:"Same title (ignoring case and whitespace)",
  same_recorded_url:"Same recorded source URL"
};
export function WritingConnections({resource,onProposalSaved}:{resource:WritingResource;onProposalSaved:()=>void}) {
  const {bundleExperience}=useWorkspace();
  const canRead=bundleExperience?.capabilityIds.includes("writer.resource.library")===true;
  const canPropose=bundleExperience?.capabilityIds.includes("writer.resource.metadata")===true;
  const {data,loading,error,retry}=useWritingRead<Connections>("/api/writing/resources/"+resource.id+"/connections","writer.resource.library");
  const {run,busy,error:saveError}=useWritingAction();
  if(!canRead)return null;
  async function propose(id:string,kind:"related_resource_ids"|"duplicate_candidate_ids",title:string,basis:string[],candidateRevision:number) {
    const recorded=resource.metadata[kind]||[];
    const result=await run("/api/writing/proposals",{
      resourceId:resource.id,baseRevision:resource.revision,
      patch:{metadata:{...resource.metadata,[kind]:[...new Set([...recorded,id])]}},
      reason:(kind==="related_resource_ids"?"Connect a related resource: ":"Record a duplicate candidate: ")+title.slice(0,240),
      evidence:"Comparison retrieved "+data?.retrievedAt+" between this resource at revision "+data?.baseRevision+" and resource "+id+" at revision "+candidateRevision+": "+basis.join("; ").slice(0,3000)+". Candidate only; no source was merged, deleted, or verified externally. Recheck both sources before approval."
    },true);
    if(result)onProposalSaved();
  }
  return <section className={styles.revisions} aria-label="Related and duplicate candidates">
    <div className={styles.sectionHeading}><h2>Find the work this connects to.</h2></div>
    <p className={styles.method}>Matches use your recorded text, titles, source URLs, topics and scripture labels. Similarity is not an instruction to merge or remove a resource.</p>
    {loading?<p role="status">Comparing your library…</p>:error?<p role="alert">{error} <button className={styles.secondary} onClick={retry}>Retry comparison</button></p>:
      !data?.candidates.length?<p>No matching signals were found in the current library. Adding consistent topics and scripture references can reveal more connections.</p>:
      <><p>{data.candidates.length} of {data.matchingCount} candidates · {new Date(data.retrievedAt).toLocaleString()}</p>
      <div className={styles.connectionList}>{data.candidates.map(candidate=>{
        const basis=[...candidate.duplicate_signals.map(signal=>signals[signal]),...candidate.shared_topics.map(topic=>"Shared topic: "+topic),...candidate.shared_scripture.map(ref=>"Shared scripture label: "+ref)];
        const alreadyRelated=resource.metadata.related_resource_ids?.includes(candidate.id);
        const alreadyDuplicate=resource.metadata.duplicate_candidate_ids?.includes(candidate.id);
        return <article className={styles.reviewCard} key={candidate.id}>
          <p className={styles.eyebrow}>{candidate.duplicate_signals.length?"Possible duplicate":"Related by recorded labels"}</p>
          <h3><Link className={styles.textLink} href={"/workspace/writing/"+candidate.id}>{candidate.title}</Link></h3>
          <p>{candidate.abstract||"No summary recorded."}</p><p className={styles.method}>Source: {candidate.source_label} · Revision {candidate.revision}</p>
          <ul>{basis.map(item=><li key={item}>{item}</li>)}</ul>
          {canPropose&&<div className={styles.actionRow}>
            <button className={styles.secondary} disabled={busy||alreadyRelated||(resource.metadata.related_resource_ids?.length||0)>=30} onClick={()=>void propose(candidate.id,"related_resource_ids",candidate.title,basis,candidate.revision)}>{alreadyRelated?"Related resource recorded":"Propose as related"}</button>
            {candidate.duplicate_signals.length>0&&<button className={styles.secondary} disabled={busy||alreadyDuplicate||(resource.metadata.duplicate_candidate_ids?.length||0)>=30} onClick={()=>void propose(candidate.id,"duplicate_candidate_ids",candidate.title,basis,candidate.revision)}>{alreadyDuplicate?"Duplicate candidate recorded":"Propose duplicate label"}</button>}
          </div>}
        </article>;
      })}</div></>}
    {saveError&&<p role="alert">{saveError}</p>}
    <p className={styles.method}>Saved proposals appear in Revisions & proposals below. Your library stays unchanged until you approve.</p>
  </section>;
}
