"use client";
import {TaskLinkNavigation} from "@/components/bundles/task-link-navigation";
import {taskTargetId} from "@/lib/bundles/task-target";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "@/components/workspace-provider";
import {executiveSave,executiveCapabilities,executiveLabels,emptyExecutiveData,prepareExecutiveFocusBrief,type ExecutiveKind,type ExecutiveData,type ExecutiveDocument,type ExecutiveReference} from "@/lib/executive-bundle/contracts";
import {executiveHandoff,describeExecutive,browserDate} from "@/lib/executive-bundle/presentation";
import {useExecutiveRead,useExecutiveAction,useUnsavedExecutive} from "./use-executive";
import {ExecutiveFrame,AccessState,ReadState,CoordinationNotice,Disclosure,Validation,styles} from "./common";
import {RecordFields} from "./record-fields";
import {ReferenceFields} from "./references";
export function ExecutiveEditorPage({kind,documentId}:{kind:ExecutiveKind;documentId:string}) {
 const {user,bundleExperience}=useWorkspace(),isNew=documentId==="new";
 const read=useExecutiveRead<{document:ExecutiveDocument}>("/api/executive/"+kind+"/"+documentId,isNew?"__no_read__":executiveCapabilities[kind]);
 if(!user||!bundleExperience?.capabilityIds.includes(executiveCapabilities[kind]))return <AccessState/>;
 if(!isNew&&(read.loading||read.error))return <ExecutiveFrame title="Open your saved work" description="Retrieving the current revision."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></ExecutiveFrame>;
 if(!isNew&&!read.data?.document)return <ExecutiveFrame title="Record unavailable" description="This record is not available to your current access."><ReadState loading={false} error="Return to Executive or try opening this record again." retry={read.retry}/></ExecutiveFrame>;
 return <Editor key={user.id+":"+bundleExperience.workspaceId+":"+bundleExperience.revision+":"+kind+":"+documentId+":"+(read.data?.document.revision??0)} kind={kind} document={isNew?null:read.data?.document??null} reload={read.retry}/>;
}
function Editor({kind,document,reload}:{kind:ExecutiveKind;document:ExecutiveDocument|null;reload:()=>void}) {
 const router=useRouter(),[initial]=useState(()=>emptyExecutiveData(kind,browserDate())),[base,setBase]=useState(document),[value,setValue]=useState<ExecutiveData>(document?.data??initial);
 const [confirm,setConfirm]=useState(false),[validation,setValidation]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[formKey,setFormKey]=useState(0),[timePending,setTimePending]=useState(false);
 const action=useExecutiveAction(),dirty=timePending||JSON.stringify(value)!==JSON.stringify(base?.data??initial);
 useUnsavedExecutive(dirty);
 const change=(next:ExecutiveData)=>{setValue(next);setConfirm(false);setNotice(null);};
 const referencesChanged=(references:ExecutiveReference[])=>{
  const next={...value,references,reviewState:value.reviewState==="confirmed"?"stale" as const:value.reviewState};
  if("actions" in next)next.actions=next.actions.map(a=>({...a,reviewState:a.reviewState==="confirmed"?"stale":a.reviewState}));
  if("observations" in next)next.observations=next.observations.map(o=>({...o,reviewState:o.reviewState==="confirmed"?"stale":o.reviewState}));
  change(next);
 };
 const save=async()=>{
  if(timePending){setValidation("Apply or clear the edited meeting time before saving.");return;}
  const input={kind,documentId:base?.id??null,expectedRevision:base?.revision??0,data:value,confirmExactRecord:confirm};
  const checked=executiveSave.safeParse({...input,requestId:crypto.randomUUID()});
  if(!checked.success){setValidation(checked.error.issues.map(i=>i.path.join(".").replace(/^data\./,"")+": "+i.message).slice(0,4).join(" "));return;}
  setValidation(null);setNotice(null);
  const result=await action.run<{document:ExecutiveDocument}>("/api/executive/"+kind,input,true);
  if(result){setBase(result.document);setValue(result.document.data);setConfirm(false);setFormKey(n=>n+1);setNotice("Saved revision "+result.document.revision+". Earlier saved work is preserved.");if(!base)router.replace("/workspace/executive/"+kind+"/"+result.document.id);}
 };
 const prepare=async()=>{
  if(value.recordType!=="daily_brief"&&value.recordType!=="weekly_review")return;
  if((dirty||base)&&!window.confirm("Replace the on-screen draft with a new attention-based draft? Saved revisions will stay unchanged until you confirm and save."))return;
  const result=await action.run("/api/executive/attention/v2?limit=50&offset=0&asOfDate="+encodeURIComponent(value.periodEnd),null);
  if(!result)return;
  try {
   const next=prepareExecutiveFocusBrief(value.recordType,value.periodEnd,result);
   change(next);setFormKey(n=>n+1);setValidation(null);setNotice("Unsaved brief prepared from current permitted attention. Review the linked work and choose your own next actions.");
  }catch{setValidation("The attention response could not be verified for this date. Refresh before preparing a brief.");}
 };
 return <ExecutiveFrame title={base?base.data.title:"Start a "+kind.replaceAll("_"," ")} description={executiveLabels[kind]+" · Keep the intended outcome, evidence and next move together."}>
 <div className={styles.actions}><span className={styles.tag}>{base?"Saved revision "+base.revision:"Not saved yet"}</span><span className={styles.muted}>{dirty?"Unsaved changes — save before leaving.":"No unsaved changes."}</span></div>
 {(kind==="daily_brief"||kind==="weekly_review")&&<section className={styles.section}><h2>A useful starting point</h2><p>Prepare an unsaved brief from current permitted attention. It links the source records without copying private source text. Then choose your next actions and add the evidence behind your conclusions.</p><button disabled={action.busy} onClick={()=>void prepare()}>Prepare from current attention</button></section>}
 <form noValidate onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={action.busy} key={formKey}><TaskLinkNavigation targets={("actions" in value?value.actions.map(a=>taskTargetId("action",a.id)):[])}>
 <RecordFields value={value} onChange={change} onTimePending={pending=>{setTimePending(pending);setConfirm(false);}}/>
 <ReferenceFields references={value.references} onChange={referencesChanged}/>
 <CoordinationNotice/><label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I reviewed this exact record and its source links. Saving preserves my stated review and agreement states; it does not verify facts, book meetings, send messages or start recurring work.</span></label>
 <Validation message={validation??action.error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.saveBar}><span>Save a recoverable revision.</span><button type="submit" disabled={!confirm||action.busy||timePending}>{action.busy?"Saving…":"Confirm and save "+kind.replaceAll("_"," ")}</button></div></TaskLinkNavigation></fieldset></form>
 {action.error&&<button onClick={()=>{if(!dirty||window.confirm("Discard unsaved edits and open the latest saved revision?"))reload();}}>Open latest saved revision</button>}
 {base&&<><section className={styles.section}><h2>Take the saved work with you</h2><p className={styles.muted}>Download saved revision {base.revision}. Unsaved changes, pending proposals and live linked-source metadata are excluded. User-authored notes are not redacted.</p>
 <button onClick={()=>{const url=URL.createObjectURL(new Blob([executiveHandoff(base)],{type:"text/plain;charset=utf-8"})),anchor=window.document.createElement("a");anchor.href=url;anchor.download="executive-"+kind+"-revision-"+base.revision+".txt";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download saved record</button></section>
 <History key={base.id+":"+base.revision} current={base} onRestore={d=>{if(dirty&&!window.confirm("Replace unsaved edits with a copy of this saved revision?"))return;setValue(structuredClone(d.data));setConfirm(false);setTimePending(false);setFormKey(n=>n+1);setNotice("A copy of revision "+d.revision+" is ready for review. Confirm and save to create a new revision; nothing has been overwritten.");}}/></>}
 </ExecutiveFrame>;
}
function History({current,onRestore}:{current:ExecutiveDocument;onRestore:(d:ExecutiveDocument)=>void}) {
 const read=useExecutiveRead<{revisions:ExecutiveDocument[]}>("/api/executive/"+current.kind+"/"+current.id+"/history",executiveCapabilities[current.kind]);
 return <section className={styles.section}><h2>Your earlier saved work</h2><p className={styles.muted}>The original and nine latest revisions are available here. All versions remain privately retained. Restoring creates an editable copy, never an immediate overwrite.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.revisions.map(d=><Disclosure key={d.revision} summary={<>Revision {d.revision} · {d.updatedAt.slice(0,10)} · {d.origin}{d.revision===current.revision?" · current":""}</>}><pre className={styles.preview}>{describeExecutive(d.data)}</pre>{d.revision!==current.revision&&<button onClick={()=>onRestore(d)}>Review a copy of revision {d.revision}</button>}</Disclosure>)}</section>;
}
