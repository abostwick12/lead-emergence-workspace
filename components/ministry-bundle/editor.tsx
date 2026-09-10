"use client";
import Link from "next/link";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "@/components/workspace-provider";
import {documentSave,emptyProfile,emptyProject,emptyArchive,type MinistryDocument,type TheologicalProfile,type ResearchProject,type TeachingArchive} from "@/lib/ministry-bundle/contracts";
import {ministryHandoff} from "@/lib/ministry-bundle/presentation";
import {useMinistryRead} from "./use-ministry";
import {MinistryFrame,AccessState,ReadState,Validation,styles} from "./common";
import {ProfileFields} from "./profile-fields";
import {ResearchFields} from "./research-fields";
import {ArchiveFields} from "./archive-fields";
import {MinistryHistory} from "./history";
import {useNativeEditorDraft} from "@/components/bundles/use-native-editor-draft";
import {EditorDraftRecovery} from "@/components/bundles/editor-draft-recovery";
type Kind=MinistryDocument["kind"];
const initial=(kind:Kind)=>kind==="profile"?emptyProfile:kind==="research"?emptyProject:emptyArchive;
export function MinistryEditorPage({kind,documentId}:{kind:Kind;documentId?:string}) {
 const {user,bundleExperience}=useWorkspace();
 const isNew=documentId==="new";
 const read=useMinistryRead<{document:MinistryDocument|null}>("/api/ministry/"+kind+(documentId&&!isNew?"/"+documentId:""),isNew?"__no_read__":"ministry."+kind);
 const allowed=bundleExperience?.capabilityIds.includes("ministry."+kind)===true;
 if(!allowed)return <AccessState/>;
 if(!isNew&&(read.loading||read.error))return <MinistryFrame title="Open your Ministry work" description="Retrieving the current saved revision."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></MinistryFrame>;
 return <Editor key={user?.id+":"+bundleExperience?.revision+":"+kind+":"+documentId+":"+(read.data?.document?.revision??0)} kind={kind} document={isNew?null:read.data?.document??null} reload={read.retry}/>;
}
function Editor({kind,document,reload}:{kind:Kind;document:MinistryDocument|null;reload:()=>void}) {
 const router=useRouter();const {bundleExperience}=useWorkspace(),base=document;
 const canWrite=kind!=="research"||bundleExperience?.capabilityIds.includes("ministry.teaching")===true;
 const draft=useNativeEditorDraft({domain:"ministry",kind,documentId:base?.id??null},(base?.data??structuredClone(initial(kind))) as NonNullable<MinistryDocument["data"]>,base?.revision??0,kind==="profile"?{unsetProfile:false}:{},canWrite);
 const value=draft.data as NonNullable<MinistryDocument["data"]>,restoreUnset=draft.ui.unsetProfile===true;
 const [confirm,setConfirm]=useState(false),[validation,setValidation]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[formKey,setFormKey]=useState(0);
 const dirty=draft.dirty;
 const accept=()=>{setConfirm(false);setValidation(null);reload();};
 const save=async(clear=false)=>{
  const input={kind,documentId:base?.id??null,expectedRevision:base?.revision??0,data:clear||restoreUnset?null:value,confirmProfile:confirm};
  const checked=documentSave.safeParse({...input,requestId:crypto.randomUUID()});
  if(!checked.success){setValidation(checked.error.issues.map(i=>i.message).slice(0,3).join(" "));return;}
  setValidation(null);setNotice(null);
  const result=await draft.commit();
  if(result?.receipt?.committedDocumentId){setConfirm(false);if(!base&&kind!=="profile")router.replace("/workspace/ministry/"+kind+"/"+result.receipt.committedDocumentId);else reload();}
 };
 return <MinistryFrame title={kind==="profile"?"Your theology. Your confirmation.":kind==="research"?"From a good question to grounded teaching.":"Give earlier teaching a useful next life."} description={kind==="profile"?"Tell your assistant how to work with you without borrowing someone else's convictions.":kind==="research"?"Keep the question, evidence, interpretation and teaching outline together, with every source in view.":"Recover what you have already written, including its source and historical context."}>
 <div className={styles.actions} role="status"><span className={styles.tag}>{base?"Saved revision "+base.revision:"Not saved yet"}</span><span className={styles.muted}>{dirty?"Working changes are being protected.":"No on-screen changes."}</span></div>
 {canWrite&&<EditorDraftRecovery {...draft} data={value as unknown as Record<string,unknown>} onOpenLatest={reload} onOpenCommitted={id=>kind==="profile"?reload():router.push("/workspace/ministry/"+kind+"/"+id)}/>}
 {kind==="research"&&<p className={styles.notice}>Connected research tools are available through an authorized assistant connection. This workspace does not automatically search a licensed library or verify links. <Link href="/workspace/integrations/assistant">Manage assistant connections</Link>.</p>}
 <form onSubmit={event=>{event.preventDefault();void save();}}>
 <fieldset disabled={!canWrite||draft.editingBlocked} key={formKey}>
 {kind==="profile"?<ProfileFields value={value as TheologicalProfile} onChange={v=>{draft.updateData(v);draft.updateUi({unsetProfile:false});setConfirm(false);}}/>:kind==="research"?<ResearchFields value={value as ResearchProject} onChange={draft.updateData}/>:<ArchiveFields value={value as TeachingArchive} onChange={draft.updateData}/>}
 {kind==="profile"&&<label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I confirm this exact configuration and the status recorded for each position. Inferred positions remain inferred.</span></label>}
 <div className={styles.sticky}><span>{canWrite?"Confirming saves an official recoverable revision; working drafts remain separate.":"Research editing is not included in your access."}</span><button type="submit" disabled={!canWrite||draft.committing||draft.staleSource||(kind==="profile"&&!confirm)}>{draft.committing?"Saving official revision…":kind==="profile"?"Confirm and save preferences":"Save "+(kind==="research"?"research":"teaching")}</button></div>
 {kind==="profile"&&base?.data&&<div className={styles.actions}><button type="button" disabled={!confirm||draft.committing} onClick={()=>{if(window.confirm("Unset the current theological profile? Earlier saved versions remain recoverable.")){draft.updateUi({unsetProfile:true});void save(true);}}}>Unset current preferences</button></div>}
 </fieldset></form>
 <Validation message={validation}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 {base&&kind!=="profile"&&<section className={styles.section}><h2>Take the saved work with you</h2><p className={styles.muted}>Download saved revision {base.revision}, including recorded sources and review cautions. Unsaved edits and pending proposals are excluded. Nothing is published.</p><button type="button" onClick={()=>{
  const blob=new Blob([ministryHandoff(base)],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),anchor=window.document.createElement("a");
  anchor.href=url;anchor.download="ministry-"+kind+"-revision-"+base.revision+".txt";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download saved {kind==="research"?"research & bibliography":"teaching"}</button></section>}
 {base&&<MinistryHistory key={base.revision} current={base} dirty={dirty} onDecide={accept} onRestore={d=>{draft.updateData(d.data??structuredClone(initial(kind)));if(kind==="profile")draft.updateUi({unsetProfile:d.data===null});setFormKey(n=>n+1);setConfirm(false);setNotice("A copy of revision "+d.revision+" is ready for review. "+(d.data===null?"This revision unsets the profile. ":"")+"Save to create a new revision; nothing has been overwritten.");}}/>}
 </MinistryFrame>;
}
