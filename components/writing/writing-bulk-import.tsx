"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, FileUp, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { getWorkspaceClient } from "@/lib/supabase/client";
import {
  inspectSourceIntakeDescriptor, sourceBatchItems, sourceBatchLimits, sourceIntakeExtraction,
  type SourceBatchCommit, type SourceBatchItem, type SourceIntakeExtraction
} from "@/lib/source-intake/contracts";
import { WritingAccessState } from "./writing-library";
import { useSourceBatch } from "./use-source-batch";
import styles from "./writing.module.css";

const accepts=".txt,.md,.markdown,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const warningText:Record<string,string>={
  formatting_not_preserved:"Formatting is not preserved.",images_not_imported:"Images are not imported.",
  pdf_reading_order_may_differ:"PDF reading order can differ from the page.",review_extracted_text:"Review the extracted text before importing."
};
const descriptorErrors:Record<string,string>={
  unsupported_type:"Use a .txt, .md, .docx, or .pdf file.",empty_document:"The file is empty.",file_too_large:"The file exceeds 4 MB."
};
const duplicateSignal:Record<string,string>={
  same_text_ignoring_whitespace:"same recorded text, ignoring whitespace",
  same_title_ignoring_case_and_whitespace:"same title, ignoring case and whitespace"
};
type Job={id:string;name:string;state:"queued"|"extracting"|"ready"|"error";message:string};

export function WritingBulkImportPage(){
  const {user,bundleExperience}=useWorkspace();
  if(!bundleExperience?.capabilityIds.includes("writer.resource.manage")||!bundleExperience.capabilityIds.includes("writer.resource.review"))return <WritingAccessState/>;
  return <BulkImportForm key={user?.id+":"+bundleExperience.workspaceId+":"+bundleExperience.revision}/>;
}

function BulkImportForm(){
  const {user,refreshBundleExperience}=useWorkspace(),batch=useSourceBatch();
  const [jobs,setJobs]=useState<Job[]>([]),[processing,setProcessing]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [completed,setCompleted]=useState<SourceBatchCommit|null>(null),[copied,setCopied]=useState(false);
  const controllers=useRef(new Map<string,AbortController>());
  useEffect(()=>()=>{for(const controller of controllers.current.values())controller.abort();},[]);
  useEffect(()=>setConfirmed(false),[batch.review?.reviewToken]);

  function change(next:SourceBatchItem[]|((items:SourceBatchItem[])=>SourceBatchItem[])){setConfirmed(false);setCompleted(null);batch.update(next);}
  function setJob(id:string,patch:Partial<Job>){setJobs(current=>current.map(job=>job.id===id?{...job,...patch}:job));}
  async function extract(file:File,job:Job,token:string):Promise<SourceIntakeExtraction|null>{
    const controller=new AbortController();controllers.current.set(job.id,controller);setJob(job.id,{state:"extracting",message:"Extracting readable text…"});
    const timer=window.setTimeout(()=>controller.abort(),45_000);
    try{
      const form=new FormData();form.set("purpose","writer_resource");form.set("file",file,file.name);
      const response=await fetch("/api/source-intake/extract",{method:"POST",headers:{Authorization:"Bearer "+token},body:form,cache:"no-store",signal:controller.signal});
      const raw:unknown=await response.json();
      if(!response.ok){if([401,403].includes(response.status))refreshBundleExperience();throw new Error(raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string"?raw.message:"Workspace could not extract this document.");}
      const result=sourceIntakeExtraction.parse(raw);setJob(job.id,{state:"ready",message:`${result.wordCount.toLocaleString()} words ready for review`});return result;
    }catch(caught){const message=controller.signal.aborted?"Extraction took too long or was cancelled. Try a smaller file or text export.":caught instanceof Error?caught.message:"Workspace could not extract this document.";setJob(job.id,{state:"error",message});return null;
    }finally{window.clearTimeout(timer);controllers.current.delete(job.id);}
  }
  async function addFiles(files:File[]){
    const remaining=sourceBatchLimits.maximumItems-batch.items.length;
    if(files.length===0)return;
    const accepted=files.slice(0,remaining),overflow=files.slice(remaining);
    const nextJobs:Job[]=files.map((file,index)=>({id:crypto.randomUUID(),name:file.name,state:index<remaining?"queued":"error",message:index<remaining?"Waiting to extract…":`Only ${sourceBatchLimits.maximumItems} resources can be staged at once.`}));
    setJobs(nextJobs);setProcessing(true);setCompleted(null);
    const valid:{file:File;job:Job}[]=[];
    for(let index=0;index<accepted.length;index++){
      const file=accepted[index],job=nextJobs[index];
      try{inspectSourceIntakeDescriptor({fileName:file.name,mediaType:file.type,byteSize:file.size});valid.push({file,job});}
      catch(caught){setJob(job.id,{state:"error",message:descriptorErrors[caught instanceof Error?caught.message:"unsupported_type"]??descriptorErrors.unsupported_type});}
    }
    void overflow;
    try{
      const {data,error}=await getWorkspaceClient().auth.getSession();
      if(error||!data.session||data.session.user.id!==user?.id)throw new Error("Your sign-in changed. Refresh before importing.");
      const results=new Array<SourceIntakeExtraction|null>(valid.length).fill(null);let cursor=0;
      async function worker(){for(;;){const index=cursor++;if(index>=valid.length)return;results[index]=await extract(valid[index].file,valid[index].job,data.session!.access_token);}}
      await Promise.all(Array.from({length:Math.min(3,valid.length)},()=>worker()));
      const additions:SourceBatchItem[]=[];
      for(let index=0;index<results.length;index++){
        const extraction=results[index];if(!extraction)continue;
        const candidate={itemId:valid[index].job.id,extraction,title:extraction.titleSuggestion,sourceLabel:"Imported from "+extraction.file.name,resourceType:"article",included:true} as SourceBatchItem;
        const proposed=[...batch.items,...additions,candidate];
        if(!sourceBatchItems.safeParse(proposed).success){setJob(valid[index].job.id,{state:"error",message:"Adding this file would exceed the 500,000-character staging limit. Start another batch for it."});continue;}
        additions.push(candidate);
      }
      if(additions.length)change(current=>[...current,...additions]);
    }catch(caught){for(const entry of valid)setJob(entry.job.id,{state:"error",message:caught instanceof Error?caught.message:"Workspace could not start extraction."});}
    finally{setProcessing(false);}
  }
  async function discard(){if(!window.confirm("Discard this entire staged library? Imported resources already in your library will not change."))return;await batch.clear();setJobs([]);setConfirmed(false);}
  async function remove(itemId:string){
    if(batch.items.length===1){await discard();return;}
    change(current=>current.filter(item=>item.itemId!==itemId));
  }
  async function review(){setConfirmed(false);await batch.reviewNow();}
  async function commit(){if(!batch.review||!confirmed)return;const result=await batch.commit(batch.review);if(result){setCompleted(result);setJobs([]);setConfirmed(false);}}
  const included=batch.items.filter(item=>item.included),characters=batch.items.reduce((sum,item)=>sum+item.extraction.characterCount,0);
  const reviewById=new Map(batch.review?.items.map(item=>[item.itemId,item.candidates])??[]);

  if(completed)return <section className={styles.workspace}>
    <Link className={styles.back} href="/workspace/writing">← Resource library</Link>
    <div className={styles.completionPanel}><CheckCircle2 size={30}/><p className={styles.eyebrow}>Library import complete</p><h1>{completed.resources.length} {completed.resources.length===1?"resource":"resources"} ready for review.</h1>
      <p>The imported resources are private drafts. Nothing was published, and the staging copy of their extracted text was retired.</p>
      <ul>{completed.resources.map(resource=><li key={resource.resourceId}><Link href={"/workspace/writing/"+resource.resourceId}>{resource.title}<ArrowRight size={15}/></Link></li>)}</ul>
      <div className={styles.actionRow}><button className={styles.secondary} onClick={()=>setCompleted(null)}>Stage another batch</button><Link className={styles.textLink} href="/workspace/writing">Return to library</Link></div>
    </div>
  </section>;

  return <section className={styles.workspace} aria-label="Bulk library import">
    <Link className={styles.back} href="/workspace/writing">← Resource library</Link>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Writer &amp; Editor · Library setup</p><h1>Turn a folder of work into a useful library.</h1>
      <p>Bring in up to 20 documents, fix their titles and types, check exact duplicate signals, then add the reviewed set as private drafts in one step.</p></div></header>

    <div className={styles.batchStatus} aria-live="polite">
      <span>{batch.loadError||(!batch.loaded?"Checking for an unfinished library import…":!batch.valid&&batch.items.length?"Complete every title and source label before this list can save.":batch.saveError||(batch.saving?"Saving the private staging list…":batch.dirty?"Unsaved changes · saving shortly":batch.savedAt?"Staging list saved · "+new Date(batch.savedAt).toLocaleTimeString():"Your staging list will save privately as documents are added."))}</span>
      {batch.items.length>0&&<span>{batch.items.length} staged · {included.length} included · {characters.toLocaleString()} / {sourceBatchLimits.maximumAggregateCharacters.toLocaleString()} characters</span>}
      {batch.loadError&&<button className={styles.secondary} onClick={batch.reload}>Retry loading</button>}
      {batch.saveError&&<><button className={styles.secondary} onClick={()=>void batch.flush()}>Retry saving</button><button className={styles.secondary} onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(batch.items,null,2));setCopied(true);}catch{setCopied(false);}}}>Copy staged list</button></>}
      {copied&&<span>Staged list copied.</span>}
    </div>

    <section className={styles.batchPicker} aria-labelledby="bulk-source-heading">
      <div><FileUp size={21}/><div><h2 id="bulk-source-heading">Choose source documents</h2><p>.txt, .md, .docx, or text-based .pdf · 4 MB per file · three files processed at a time</p></div></div>
      <label><span>{processing?"Extracting selected documents…":batch.items.length>=sourceBatchLimits.maximumItems?"This batch is full":"Choose documents"}</span>
        <input type="file" multiple accept={accepts} disabled={!batch.loaded||processing||batch.items.length>=sourceBatchLimits.maximumItems} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value="";void addFiles(files);}}/></label>
      <p><ShieldCheck size={15}/>Files are sent only for bounded text extraction. Original files are not retained, fetched again, or published.</p>
      {jobs.length>0&&<ul className={styles.extractionJobs}>{jobs.map(job=><li key={job.id} data-state={job.state}><span>{job.state==="extracting"?<LoaderCircle className={styles.spin} size={16}/>:job.state==="ready"?<CheckCircle2 size={16}/>:job.state==="error"?<AlertTriangle size={16}/>:<FileText size={16}/>}</span><strong>{job.name}</strong><small>{job.message}</small></li>)}</ul>}
    </section>

    {batch.items.length===0?<div className={styles.empty}><FileText size={30}/><h2>Your staging table is ready</h2><p>Select a manageable group of documents. Each successful extraction will appear here; one failed file will not discard the others.</p></div>:
    <section className={styles.stagingSection} aria-labelledby="staging-heading">
      <div className={styles.libraryHeading}><div><h2 id="staging-heading">Review the staging table</h2><p>Changes save automatically. Uncheck anything that should wait for another batch.</p></div><button className={styles.textButton} onClick={()=>void discard()}>Discard staging list</button></div>
      <ol className={styles.stagingList}>{batch.items.map((item,index)=>{
        const candidates=reviewById.get(item.itemId);
        return <li key={item.itemId} className={styles.stagingCard} data-included={item.included}>
          <div className={styles.stagingCardHeading}><label className={styles.includeChoice}><input type="checkbox" checked={item.included} onChange={event=>change(current=>current.map(entry=>entry.itemId===item.itemId?{...entry,included:event.target.checked}:entry))}/><span>Include resource {index+1}</span></label>
            <button className={styles.iconTextButton} type="button" onClick={()=>void remove(item.itemId)}><Trash2 size={15}/>Remove</button></div>
          <div className={styles.formGrid}>
            <label htmlFor={"title-"+item.itemId}>Title<input id={"title-"+item.itemId} required maxLength={240} value={item.title} onChange={event=>change(current=>current.map(entry=>entry.itemId===item.itemId?{...entry,title:event.target.value}:entry))}/></label>
            <label htmlFor={"type-"+item.itemId}>Resource type<select id={"type-"+item.itemId} value={item.resourceType} onChange={event=>change(current=>current.map(entry=>entry.itemId===item.itemId?{...entry,resourceType:event.target.value as SourceBatchItem["resourceType"]}:entry))}><option value="article">Article</option><option value="sermon">Sermon</option><option value="teaching">Teaching</option><option value="study_guide">Study guide</option><option value="other">Other</option></select></label>
            <label htmlFor={"source-"+item.itemId}>Source label<input id={"source-"+item.itemId} required maxLength={240} value={item.sourceLabel} onChange={event=>change(current=>current.map(entry=>entry.itemId===item.itemId?{...entry,sourceLabel:event.target.value}:entry))}/></label>
            <div className={styles.fileFact}><span>Extracted source</span><strong>{item.extraction.file.name}</strong><small>{item.extraction.wordCount.toLocaleString()} words · {item.extraction.characterCount.toLocaleString()} characters{item.extraction.pageCount?` · ${item.extraction.pageCount} pages`:""}</small></div>
          </div>
          <details className={styles.sourcePreview}><summary>Preview extracted text and limitations</summary><p>{item.extraction.text.slice(0,1000)}{item.extraction.text.length>1000?"…":""}</p><ul>{item.extraction.warnings.map(warning=><li key={warning}>{warningText[warning]}</li>)}</ul></details>
          {batch.review&&<div className={candidates?.length?styles.duplicateWarning:styles.duplicateClear}>
            <strong>{candidates?.length?`${candidates.length} exact duplicate ${candidates.length===1?"candidate":"candidates"}`:"No exact title or text match found"}</strong>
            {candidates?.length?<ul>{candidates.map(candidate=><li key={candidate.candidateType+candidate.candidateId}><span>{candidate.title}</span><small>{candidate.candidateType==="staged_item"?"Also staged":"Already in your library"} · {candidate.signals.map(signal=>duplicateSignal[signal]).join("; ")}</small></li>)}</ul>:<p>This is not a semantic or plagiarism check.</p>}
          </div>}
        </li>;
      })}</ol>
      <div className={styles.batchReviewPanel}>
        <div><p className={styles.eyebrow}>Final review</p><h2>{batch.review?"Choose what belongs in this import.":"Check exact duplicates before importing."}</h2>
          <p>{batch.review?"Duplicate candidates are warnings, not automatic deletions. Uncheck an item to hold it back; any edit requires a fresh review.":"Workspace compares normalized titles and recorded text within this private staging list and your current library. It does not claim semantic similarity."}</p></div>
        {!batch.review?<button className={styles.secondary} disabled={!batch.valid||batch.dirty||batch.saving||batch.reviewing||included.length===0} onClick={()=>void review()}>{batch.reviewing?"Checking exact matches…":"Review duplicate signals"}</button>:
        <><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I reviewed the titles, sources, extracted text limitations, and exact duplicate signals. Import {included.length} {included.length===1?"resource":"resources"} as private drafts.</span></label>
          <button className={styles.primaryAction} disabled={!confirmed||included.length===0||batch.committing} onClick={()=>void commit()}>{batch.committing?"Importing the complete batch…":`Import ${included.length} reviewed ${included.length===1?"resource":"resources"}`}</button></>}
        {batch.actionError&&<p role="alert">{batch.actionError}</p>}
      </div>
    </section>}
    <footer className={styles.footer}>This workflow creates private draft resources only. It does not publish to a website, merge suspected duplicates, or connect an external provider.</footer>
  </section>;
}
