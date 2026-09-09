"use client";
import {TaskLinkNavigation} from "@/components/bundles/task-link-navigation";
import {taskTargetId} from "@/lib/bundles/task-target";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "@/components/workspace-provider";
import {nonprofitSave,nonprofitCapabilities,nonprofitLabels,emptyNonprofitData,type NonprofitKind,type NonprofitData,type NonprofitDocument,type FounderPlan,type PartnerRecord,type MeetingRecord,type NonprofitResearch} from "@/lib/nonprofit-bundle/contracts";
import {nonprofitHandoff,describeNonprofit} from "@/lib/nonprofit-bundle/presentation";
import {useNonprofitRead,useNonprofitAction,useUnsavedNonprofit} from "./use-nonprofit";
import {NonprofitFrame,AccessState,ReadState,AdministrativeNotice,Disclosure,Validation,styles} from "./common";
import {PlanFields} from "./plan-fields";
import {PartnerFields} from "./partner-fields";
import {MeetingFields} from "./meeting-fields";
import {ResearchFields} from "./research-fields";
export function NonprofitEditorPage({kind,documentId}:{kind:NonprofitKind;documentId:string}){
 const {user,bundleExperience}=useWorkspace(),isNew=documentId==="new";
 const read=useNonprofitRead<{document:NonprofitDocument}>("/api/nonprofit/"+kind+"/"+documentId,isNew?"__no_read__":nonprofitCapabilities[kind]);
 if(!bundleExperience?.capabilityIds.includes(nonprofitCapabilities[kind]))return <AccessState/>;
 if(!isNew&&(read.loading||read.error))return <NonprofitFrame title="Open your founder work" description="Retrieving the current saved revision."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></NonprofitFrame>;
 return <Editor key={user?.id+":"+bundleExperience.revision+":"+kind+":"+documentId+":"+(read.data?.document.revision??0)} kind={kind} document={isNew?null:read.data?.document??null} reload={read.retry}/>;
}
function Editor({kind,document,reload}:{kind:NonprofitKind;document:NonprofitDocument|null;reload:()=>void}){
 const router=useRouter(),[base,setBase]=useState(document),[value,setValue]=useState<NonprofitData>(document?.data??structuredClone(emptyNonprofitData[kind]));
 const [confirm,setConfirm]=useState(false),[validation,setValidation]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[formKey,setFormKey]=useState(0);
 const action=useNonprofitAction(),dirty=JSON.stringify(value)!==JSON.stringify(base?.data??emptyNonprofitData[kind]);
 useUnsavedNonprofit(dirty);
 const change=(next:NonprofitData)=>{setValue(next);setConfirm(false);setNotice(null);};
 const save=async()=>{
  const input={kind,documentId:base?.id??null,expectedRevision:base?.revision??0,data:value,confirmAdministrative:confirm};
  const checked=nonprofitSave.safeParse({...input,requestId:crypto.randomUUID()});
  if(!checked.success){setValidation(checked.error.issues.map(i=>i.path.join(".").replace(/^data\./,"")+": "+i.message).slice(0,4).join(" "));return;}
  setValidation(null);setNotice(null);
  const result=await action.run<{document:NonprofitDocument}>("/api/nonprofit/"+kind,input,true);
  if(result){setBase(result.document);setValue(result.document.data);setConfirm(false);setFormKey(n=>n+1);setNotice("Saved revision "+result.document.revision+". Earlier saved work is preserved.");if(!base)router.replace("/workspace/nonprofit/"+kind+"/"+result.document.id);}
 };
 return <NonprofitFrame title={base?base.data.title:"Start a "+(kind==="plan"?"founder roadmap":kind==="partner"?"useful relationship":kind==="meeting"?"meeting plan":"research question")} description={nonprofitLabels[kind]+" · Keep the next action, its context and the evidence together."}>
 <div className={styles.actions}><span className={styles.tag}>{base?"Saved revision "+base.revision:"Not saved yet"}</span><span className={styles.muted}>{dirty?"Unsaved changes — save before leaving.":"No unsaved changes."}</span></div><AdministrativeNotice/>
 <form noValidate onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={action.busy} key={formKey}><TaskLinkNavigation targets={("milestones" in value?value.milestones.map(a=>taskTargetId("milestone",a.id)):"actions" in value?value.actions.map(a=>taskTargetId("action",a.id)):kind==="partner"&&base?[taskTargetId("followup",base.id)]:[])}>
 {kind==="plan"?<PlanFields value={value as FounderPlan} onChange={change}/>:kind==="partner"?<PartnerFields documentId={base?.id} value={value as PartnerRecord} onChange={change}/>:kind==="meeting"?<MeetingFields value={value as MeetingRecord} onChange={change}/>:<ResearchFields value={value as NonprofitResearch} onChange={change}/>}
 <label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I reviewed this exact record. It contains administrative information only, not patient or clinical information. Saving does not send outreach, book a calendar or certify compliance.</span></label>
 <Validation message={validation??action.error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.sticky}><span>Save a recoverable revision.</span><button type="submit" disabled={!confirm||action.busy}>{action.busy?"Saving…":"Confirm and save "+kind}</button></div></TaskLinkNavigation></fieldset></form>
 {action.error&&<button onClick={()=>{if(!dirty||window.confirm("Discard unsaved edits and open the latest saved revision?"))reload();}}>Open latest saved revision</button>}
 {base&&<><section className={styles.section}><h2>Take the saved work with you</h2><p className={styles.muted}>Download saved revision {base.revision}, including its context and research cautions. Unsaved edits and pending proposals are excluded.</p><button onClick={()=>{
  const url=URL.createObjectURL(new Blob([nonprofitHandoff(base)],{type:"text/plain;charset=utf-8"})),anchor=window.document.createElement("a");anchor.href=url;anchor.download="nonprofit-"+kind+"-revision-"+base.revision+".txt";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download saved record</button></section>
 <History key={base.id+":"+base.revision} current={base} onRestore={d=>{if(dirty&&!window.confirm("Replace unsaved edits with a copy of this saved revision?"))return;setValue(structuredClone(d.data));setConfirm(false);setFormKey(n=>n+1);setNotice("A copy of revision "+d.revision+" is ready for review. Confirm and save to create a new revision; nothing has been overwritten.");}}/></>}
 </NonprofitFrame>;
}
function History({current,onRestore}:{current:NonprofitDocument;onRestore:(d:NonprofitDocument)=>void}){
 const read=useNonprofitRead<{revisions:NonprofitDocument[]}>("/api/nonprofit/"+current.kind+"/"+current.id+"/history",nonprofitCapabilities[current.kind]);
 return <section className={styles.section}><h2>Your earlier saved work</h2><p className={styles.muted}>The original and nine latest revisions are available here. All saved versions are retained privately. Restoring makes an editable copy, never an immediate overwrite.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.revisions.map(d=><Disclosure key={d.revision} summary={<>Revision {d.revision} · {d.updatedAt.slice(0,10)} · {d.origin}{d.revision===current.revision?" · current":""}</>}><pre className={styles.preview}>{describeNonprofit(d.data,d.kind)}</pre>{d.revision!==current.revision&&<button onClick={()=>onRestore(d)}>Review a copy of revision {d.revision}</button>}</Disclosure>)}</section>;
}
