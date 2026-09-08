"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { WritingAccessState } from "./writing-library";
import { useWritingAction } from "./use-writing-action";
import { useWorkingDraft } from "./use-working-draft";
import { DraftStatus } from "./draft-status";
import styles from "./writing.module.css";
export function WritingImportPage() {
  const { user, bundleExperience } = useWorkspace();
  if (!bundleExperience?.capabilityIds.includes("writer.resource.manage") || !bundleExperience.capabilityIds.includes("writer.resource.review")) return <WritingAccessState />;
  return <ImportForm key={user?.id + ":" + bundleExperience.workspaceId + ":" + bundleExperience.revision} />;
}
function ImportForm() {
  const router=useRouter(),{error,run}=useWritingAction();
  const draft=useWorkingDraft(null,{title:"",author:"",resource_type:"article",source_label:"",source_url:"",source_date:"",source_file:"",body_text:""},null);
  const [fileError,setFileError]=useState<string|null>(null),[submitting,setSubmitting]=useState(false);
  const values=draft.values,body=values.body_text||"";
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setSubmitting(true);
    try {
      const saved=await draft.flush();
      if(!saved?.values||!saved.requestId)return;
      const v=saved.values;
      const result=await run<{resourceId:string}>("/api/writing/import",{
        requestId:saved.requestId,
        resource:{title:v.title,author:v.author||null,body_text:v.body_text,resource_type:v.resource_type,source_label:v.source_label,
          source_url:v.source_url||null,source_date:v.source_date||null,...(v.source_file?{metadata:{source_file:v.source_file}}:{})}
      });
      if(result){await draft.clear(saved.version);router.push("/workspace/writing/"+result.resourceId);}
    } finally {setSubmitting(false);}
  }
  return <section className={styles.workspace}>
    <Link className={styles.back} href="/workspace/writing">← Resource library</Link>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>A useful first step</p><h1>Bring your work into view.</h1>
      <p>Add a resource once. Keep its source, review what it needs, and compare improvements before you approve them.</p></div></header>
    <DraftStatus draft={draft} />
    <form className={styles.editorForm} onSubmit={(event)=>void submit(event)}>
      <fieldset className={styles.formFields} disabled={submitting||!draft.loaded||draft.clearing}>
      <div className={styles.formGrid}>
        <label>Title<input name="title" required maxLength={240} value={values.title||""} onChange={e=>draft.update({title:e.target.value})} /></label>
        <label>Author <span>Optional</span><input name="author" maxLength={240} value={values.author||""} onChange={e=>draft.update({author:e.target.value})} /></label>
        <label>Resource type<select name="resource_type" value={values.resource_type||"article"} onChange={e=>draft.update({resource_type:e.target.value})}><option value="article">Article</option><option value="sermon">Sermon</option><option value="teaching">Teaching</option><option value="study_guide">Study guide</option><option value="other">Other</option></select></label>
        <label>Source label<input name="source_label" required maxLength={240} placeholder="For example: My teaching manuscript" value={values.source_label||""} onChange={e=>draft.update({source_label:e.target.value})} /></label>
        <label>Recorded source URL <span>Optional; not fetched or verified</span><input name="source_url" type="url" maxLength={2000} placeholder="https://" value={values.source_url||""} onChange={e=>draft.update({source_url:e.target.value})} /></label>
        <label>Source date <span>Optional</span><input name="source_date" type="date" value={values.source_date||""} onChange={e=>draft.update({source_date:e.target.value})} /></label>
      </div>
      <label>Load a text file <span>Optional · .txt or .md · replaces the text below; the original file is not uploaded</span>
        <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async(event)=>{
          const file=event.target.files?.[0];setFileError(null);
          if(!file)return;
          if(!/\.(txt|md)$/i.test(file.name)||file.size>400000){setFileError("Choose a .txt or .md file up to 400 KB. For Word or PDF, paste the text below.");return;}
          try {
            const text=await file.text();
            if(text.length>100000||text.includes("\u0000"))throw new Error("Use plain text up to 100,000 characters.");
            draft.update({body_text:text,source_file:file.name});
          } catch {setFileError("This file couldn't be read as plain text. Paste the text below.");}
        }} />
      </label>
      {fileError&&<p role="alert">{fileError}</p>}
      <label>Source text<textarea required rows={15} maxLength={100000} value={body} onChange={e=>draft.update({body_text:e.target.value,source_file:""})} /></label>
      {values.source_file&&<p className={styles.method}>Recorded file: {values.source_file}</p>}
      <p className={styles.method}>{body.length.toLocaleString()} / 100,000 characters · Import saves a private resource with “user stated” evidence status. It does not publish or verify its claims.</p>
      {error&&<p role="alert">{error}</p>}
      <div className={styles.actionRow}><button className={styles.secondary} type="submit" disabled={Boolean(draft.saveError)}>{submitting?"Saving your original…":"Save resource and review"}</button><Link className={styles.textLink} href="/workspace/writing">Return to library</Link></div>
      </fieldset>
    </form>
  </section>;
}
