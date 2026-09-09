"use client";
import {useState} from "react";
import type {TeachingArchive} from "@/lib/ministry-bundle/contracts";
import {Field,Choice,Lines,Validation,styles} from "./common";
export function ArchiveFields({value,onChange}:{value:TeachingArchive;onChange:(v:TeachingArchive)=>void}) {
 const update=(patch:Partial<TeachingArchive>)=>onChange({...value,...patch});
 const [fileError,setFileError]=useState<string|null>(null);
 return <>
 <div className={styles.notice}>Keep prior teaching available without treating it as a statement of your current beliefs. Files are read as plain text; links are recorded, not fetched.</div>
 <section className={styles.section}><h2>Identify the teaching</h2>
 <Field label="Teaching title" value={value.title} required max={240} onChange={title=>update({title})}/>
 <div className={styles.grid}><Field label="Author" value={value.author} max={300} onChange={author=>update({author})}/><Choice label="Teaching type" value={value.resourceType} values={["sermon","teaching","study_guide","other"]} onChange={resourceType=>update({resourceType:resourceType as TeachingArchive["resourceType"]})}/>
 <Field label="Date delivered" value={value.deliveredDate??""} type="date" onChange={v=>update({deliveredDate:v||null})}/><Field label="Audience" value={value.audience} max={300} onChange={audience=>update({audience})}/>
 <Lines label="Scripture references" values={value.scriptureReferences} onChange={scriptureReferences=>update({scriptureReferences})} max={10000}/><Lines label="Topics" values={value.topics} onChange={topics=>update({topics})} max={5000}/></div>
 <Field label="Teaching summary" value={value.summary} max={3000} multiline onChange={summary=>update({summary})}/>
 <Choice label="Archive status" value={value.status} values={["active","archived"]} onChange={status=>update({status:status as TeachingArchive["status"]})}/>
 </section>
 <section className={styles.section}><h2>Preserve the source</h2>
 <Field label="Source description" value={value.sourceLabel} required max={500} onChange={sourceLabel=>update({sourceLabel})} hint="Where did this text come from? For example, your original sermon manuscript."/>
 <Field label="Recorded source URL" value={value.sourceUrl??""} max={2000} type="url" onChange={v=>update({sourceUrl:v||null})}/>
 <label className={styles.field}><span>Import a plain-text file</span><input aria-label="Import a plain-text file" type="file" accept=".txt,text/plain" onChange={async e=>{
  const file=e.target.files?.[0];e.target.value="";if(!file)return;setFileError(null);
  if(!file.name.toLowerCase().endsWith(".txt")||file.size>450000){setFileError("Choose a .txt file under 450 KB. Word and PDF import are not available here.");return;}
  if(value.bodyText&&!window.confirm("Replace the unsaved teaching text with this file? Saved revisions will be preserved."))return;
  try{const bodyText=await file.text();if(bodyText.length>100000||bodyText.includes("\0"))throw new Error("Use readable plain text with no more than 100,000 characters.");update({bodyText});}catch(error){setFileError(error instanceof Error?error.message:"Could not read this file.");}
 }}/><small>No filename, local path, or modification date is saved automatically. Record the source description yourself.</small></label>
 <Validation message={fileError}/>
 <Field label="Teaching text" value={value.bodyText} max={100000} multiline onChange={bodyText=>update({bodyText})} hint={value.bodyText.length.toLocaleString()+" / 100,000 characters. Original saved text remains in revision history."}/>
 </section></>;
}
