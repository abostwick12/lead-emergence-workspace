"use client";
import type { useWorkingDraft } from "./use-working-draft";
import styles from "./writing.module.css";
import { useState } from "react";
export function DraftStatus({draft}: {draft:ReturnType<typeof useWorkingDraft>}) {
  const [copied,setCopied]=useState<string|null>(null);
  return <div className={styles.draftStatus} aria-live="polite">
    <span>{draft.loadError || (!draft.loaded?"Checking for unfinished work…":draft.saveError || (draft.saving?"Saving working draft…":draft.dirty?"Unsaved changes · saving shortly":draft.savedAt?"Working draft saved · "+new Date(draft.savedAt).toLocaleTimeString():"Working draft saves privately as you type."))}</span>
    {draft.restored&&!draft.dirty&&<span>Your unfinished work was restored.</span>}
    {(draft.savedAt||draft.dirty)&&<button type="button" className={styles.secondary} disabled={draft.saving} onClick={()=>void draft.discard()}>Discard working draft</button>}
    {draft.loadError&&<button type="button" className={styles.secondary} onClick={draft.reload}>Retry loading draft</button>}
    {draft.saveError&&<><button type="button" className={styles.secondary} onClick={()=>void draft.flush()}>Retry saving draft</button><button type="button" className={styles.secondary} onClick={draft.reload}>Load saved draft</button></>}
    {draft.saveError&&<button type="button" className={styles.secondary} onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(draft.values,null,2));setCopied("Your on-screen draft was copied.");}catch{setCopied("Copy unavailable. Select your text before loading another draft.");}}}>Copy my draft</button>}
    {copied&&<span>{copied}</span>}
    <span className={styles.method}>Not submitted to your assistant, not applied to a resource, and not published.</span>
  </div>;
}
