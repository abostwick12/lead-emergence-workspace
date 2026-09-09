"use client";
import Link from "next/link";
import {useState,type FormEvent} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {profileLabels,writingProfile,type WritingProfile,type ProfileResult} from "@/lib/writing/profile-contracts";
import {useWritingRead} from "./use-writing-read";
import {useWritingAction} from "./use-writing-action";
import {useUnsavedWriting} from "./use-unsaved-writing";
import {WritingAccessState} from "./writing-library";
import styles from "./writing.module.css";
const textFields=[["voice_notes","Your voice","What should remain recognizably yours?",4000],["audience_notes","Your readers","Who do you usually write for?",1000],
 ["editing_boundaries","Editing boundaries","What should an editor preserve or ask before changing?",2000],["website_notes","Publication preferences","Preferred presentation, attribution or destination requirements.",2000]] as const;
const listFields=[["preferred_terms","Preferred wording",120],["avoid_terms","Wording to avoid",120],["topics","Preferred topics",120],["themes","Preferred themes",240]] as const;
function formValues(p:WritingProfile|null){return {voice_notes:p?.voice_notes||"",audience_notes:p?.audience_notes||"",editing_boundaries:p?.editing_boundaries||"",website_notes:p?.website_notes||"",
 preferred_terms:p?.preferred_terms?.join("\n")||"",avoid_terms:p?.avoid_terms?.join("\n")||"",topics:p?.topics?.join("\n")||"",themes:p?.themes?.join("\n")||""};}
export function WritingPreferencesPage(){
 const {user,bundleExperience}=useWorkspace();
 const current=useWritingRead<ProfileResult>("/api/writing/profile","writer.profile");
 if(!current.enabled){
  if(bundleExperience?.capabilityIds.includes("writer.resource.library"))return <section className={styles.empty}><h1>Writing preferences are not included in your current access</h1><Link href="/workspace/writing">Return to your library</Link></section>;
  return <WritingAccessState/>;
 }
 if(current.loading)return <p className={styles.empty} role="status">Opening your confirmed writing preferences…</p>;
 if(current.error||!current.data)return <section className={styles.empty} role="alert"><p>{current.error}</p><button onClick={current.retry} className={styles.secondary}>Retry preferences</button></section>;
 return <PreferencesForm key={user?.id+":"+bundleExperience?.revision+":"+current.data.revision} initial={current.data} reload={current.retry}/>;
}
function PreferencesForm({initial,reload}:{initial:ProfileResult;reload:()=>void}){
 const [values,setValues]=useState(()=>formValues(initial.profile)),[revision,setRevision]=useState(initial.revision);
 const [signature,setSignature]=useState(()=>JSON.stringify(formValues(initial.profile))),[confirmed,setConfirmed]=useState(false);
 const [notice,setNotice]=useState(""),[validation,setValidation]=useState<string|null>(null);
 const {run,busy,error}=useWritingAction();
 const history=useWritingRead<{revisions:{revision:number;profile:WritingProfile|null;confirmedAt:string}[]}>("/api/writing/profile/history","writer.profile");
 const dirty=JSON.stringify(values)!==signature;useUnsavedWriting(dirty);
 function update(key:keyof typeof values,value:string){setValues(v=>({...v,[key]:value}));setConfirmed(false);setNotice("");setValidation(null);}
 async function save(event:FormEvent){
  event.preventDefault();setValidation(null);
  if(!confirmed)return;
  let profile:WritingProfile;
  try{profile=writingProfile.parse({...Object.fromEntries(textFields.map(([key])=>[key,values[key].trim()])),...Object.fromEntries(listFields.map(([key])=>[key,profileLabels(values[key])]))});}
  catch{setValidation("Keep each list to 100 labels and stay within the field lengths shown.");return;}
  const nonempty=Object.values(profile).some(v=>Boolean(v?.length));
  const result=await run<ProfileResult>("/api/writing/profile",{expectedRevision:revision,profile:nonempty?profile:null,confirmPreferences:true},true);
  if(result){const next=formValues(result.profile);setValues(next);setSignature(JSON.stringify(next));setRevision(result.revision);setConfirmed(false);setNotice(result.profile?"Your writing preferences are confirmed and saved.":"No writing preferences are active. Earlier versions remain in your private history.");history.retry();}
 }
 function loadCurrent(){if(dirty&&!window.confirm("Replace your unconfirmed changes with the current saved preferences?"))return;reload();}
 return <section className={styles.workspace}>
  <Link className={styles.back} href="/workspace/writing"><span aria-hidden="true">← </span>Resource library</Link>
  <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Client-owned context</p><h1>Keep what makes the writing yours.</h1>
   <p>Tell your editor what matters once. Only preferences you confirm here become reusable Writing context.</p></div></header>
  <p className={styles.method}>Current saved revision: {revision||"none"}. These are writing preferences, not a theological profile or permission to publish. Your connected Writer assistant may read the current confirmed profile, but cannot confirm or edit it.</p>
  <form className={styles.editorForm} onSubmit={e=>void save(e)}>
   <fieldset className={styles.formFields} disabled={busy}>
    <h2>Voice, readers and boundaries</h2>
    {textFields.map(([key,label,help,max])=><label key={key}>{label}<span className={styles.method}>{help} Up to {max.toLocaleString()} characters.</span>
     <textarea rows={3} maxLength={max} value={values[key]} onChange={e=>update(key,e.target.value)}/></label>)}
    <h2>A consistent vocabulary for your library</h2>
    <p className={styles.method}>One label per line, up to 100 per list. These guide editorial decisions; they do not silently reclassify your resources.</p>
    <div className={styles.formGrid}>{listFields.map(([key,label,max])=><label key={key}>{label}<span className={styles.method}>Up to {max} characters per label.</span>
     <textarea rows={5} maxLength={(max+2)*100} value={values[key]} onChange={e=>update(key,e.target.value)}/></label>)}</div>
    <p className={styles.method}>An empty profile stops using earlier preferences; saved history remains private in Workspace.</p>
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these are my writing preferences.</label>
    <div className={styles.actionRow}><button className={styles.secondary} type="submit" disabled={!confirmed}>{busy?"Saving confirmed preferences…":"Confirm and save preferences"}</button>
     <button className={styles.secondary} type="button" onClick={loadCurrent}>Reload saved preferences</button>
     <button className={styles.secondary} type="button" onClick={()=>{setValues(formValues(null));setConfirmed(false);setNotice("All fields are cleared on screen. Confirm and save to stop using the profile.");}}>Clear all fields</button></div>
   </fieldset>
   {(error||validation)&&<p role="alert">{error||validation}</p>}
   {notice&&<p role="status">{notice}</p>}
   {dirty&&<p className={styles.method}>Unconfirmed edits are only on this screen. Save before leaving; they are not supplied to the assistant.</p>}
  </form>
  <details className={styles.history}><summary>Earlier confirmed preferences</summary>
   <p className={styles.method}>The latest ten saved versions are available here. Loading an earlier version only fills the editor; it requires a new confirmation to apply. This is recovery history, not permanent data erasure.</p>
   {history.loading?<p role="status">Loading preference history…</p>:history.error?<p role="alert">{history.error} <button onClick={history.retry}>Retry history</button></p>:history.data?.revisions.map(item=><div key={item.revision} className={styles.reviewCard}>
    <p>Revision {item.revision} · {new Date(item.confirmedAt).toLocaleString()} · {item.profile?"Confirmed preferences":"No active preferences"}</p>
    <button className={styles.secondary} disabled={busy} onClick={()=>{if(dirty&&!window.confirm("Replace your unconfirmed on-screen edits with this earlier version?"))return;setValues(formValues(item.profile));setConfirmed(false);setNotice("Earlier preferences loaded for review. They have not been applied.");}}>Review revision {item.revision}</button>
   </div>)}
  </details>
 </section>;
}
