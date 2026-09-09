"use client";
import {TaskLinkNavigation} from "@/components/bundles/task-link-navigation";
import {taskTargetId} from "@/lib/bundles/task-target";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "@/components/workspace-provider";
import {investorSave,investorCapabilities,investorLabels,emptyInvestorData,type InvestorKind,type InvestorData,type InvestorDocument} from "@/lib/investor-bundle/contracts";
import {investorHandoff,describeInvestor} from "@/lib/investor-bundle/presentation";
import {useInvestorRead,useInvestorAction,useUnsavedInvestor} from "./use-investor";
import {InvestorFrame,AccessState,ReadState,ResearchNotice,Disclosure,Validation,styles} from "./common";
import {RecordFields} from "./record-fields";
export function InvestorEditorPage({kind,documentId}:{kind:InvestorKind;documentId:string}){
 const {user,bundleExperience}=useWorkspace(),isNew=documentId==="new";
 const read=useInvestorRead<{document:InvestorDocument}>("/api/investor/"+kind+"/"+documentId,isNew?"__no_read__":investorCapabilities[kind]);
 if(!user||!bundleExperience?.capabilityIds.includes(investorCapabilities[kind]))return <AccessState/>;
 if(!isNew&&(read.loading||read.error))return <InvestorFrame title="Open your research" description="Retrieving the current saved revision."><ReadState loading={read.loading} error={read.error} retry={read.retry}/></InvestorFrame>;
 if(!isNew&&!read.data?.document)return <InvestorFrame title="Research record unavailable" description="This record may no longer be available to your current access."><ReadState loading={false} error="Return to the research desk or try opening the record again." retry={read.retry}/></InvestorFrame>;
 return <Editor key={user?.id+":"+bundleExperience.workspaceId+":"+bundleExperience.revision+":"+kind+":"+documentId+":"+(read.data?.document.revision??0)} kind={kind} document={isNew?null:read.data?.document??null} reload={read.retry}/>;
}
function Editor({kind,document,reload}:{kind:InvestorKind;document:InvestorDocument|null;reload:()=>void}){
 const router=useRouter(),[initial]=useState(()=>emptyInvestorData(kind,new Date().toISOString().slice(0,10))),[base,setBase]=useState(document),[value,setValue]=useState<InvestorData>(document?.data??initial);
 const [confirm,setConfirm]=useState(false),[validation,setValidation]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[formKey,setFormKey]=useState(0);
 const action=useInvestorAction(),dirty=JSON.stringify(value)!==JSON.stringify(base?.data??initial);
 useUnsavedInvestor(dirty);
 const change=(next:InvestorData)=>{setValue(next);setConfirm(false);setNotice(null);};
 const save=async()=>{
  const input={kind,documentId:base?.id??null,expectedRevision:base?.revision??0,data:value,confirmResearchOnly:confirm};
  const checked=investorSave.safeParse({...input,requestId:crypto.randomUUID()});
  if(!checked.success){setValidation(checked.error.issues.map(i=>i.path.join(".").replace(/^data\./,"")+": "+i.message).slice(0,4).join(" "));return;}
  setValidation(null);setNotice(null);
  const result=await action.run<{document:InvestorDocument}>("/api/investor/"+kind,input,true);
  if(result){setBase(result.document);setValue(result.document.data);setConfirm(false);setFormKey(n=>n+1);setNotice("Saved revision "+result.document.revision+". Earlier saved work is preserved.");if(!base)router.replace("/workspace/investing/"+kind+"/"+result.document.id);}
 };
 return <InvestorFrame title={base?base.data.title:"Start "+(kind==="watchlist"?"a watchlist":kind==="thesis"?"a company thesis":kind==="filing"?"a filing review":"a market brief")} description={investorLabels[kind]+" · Keep the question, its evidence and what would change your mind together."}>
 <div className={styles.actions}><span className={styles.tag}>{base?"Saved revision "+base.revision:"Not saved yet"}</span><span className={styles.muted}>{dirty?"Unsaved changes — save before leaving.":"No unsaved changes."}</span></div><ResearchNotice/>
 <form noValidate onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={action.busy} key={formKey}><TaskLinkNavigation targets={("entries" in value?value.entries.map(a=>taskTargetId("watch_item",a.id)):"catalysts" in value?value.catalysts.map(a=>taskTargetId("catalyst",a.id)):[])}>
 <RecordFields kind={kind} value={value} onChange={change}/>
 <label className={styles.check}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I reviewed this exact record. It contains public-research-only content, not personal account details or material nonpublic information. Saving does not verify claims, monitor markets or place a trade.</span></label>
 <Validation message={validation??action.error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}
 <div className={styles.saveBar}><span>Save a recoverable revision.</span><button type="submit" disabled={!confirm||action.busy}>{action.busy?"Saving…":"Confirm and save "+kind}</button></div></TaskLinkNavigation></fieldset></form>
 {action.error&&<button onClick={()=>{if(!dirty||window.confirm("Discard unsaved edits and open the latest saved revision?"))reload();}}>Open latest saved revision</button>}
 {base&&<><section className={styles.section}><h2>Take the saved work with you</h2><p className={styles.muted}>Download saved revision {base.revision}, including its sources, uncertainty and research cautions. Unsaved edits and pending proposals are excluded.</p><button onClick={()=>{
  const url=URL.createObjectURL(new Blob([investorHandoff(base)],{type:"text/plain;charset=utf-8"})),anchor=window.document.createElement("a");anchor.href=url;anchor.download="investor-"+kind+"-revision-"+base.revision+".txt";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download saved record</button></section>
 <History key={base.id+":"+base.revision} current={base} onRestore={d=>{if(dirty&&!window.confirm("Replace unsaved edits with a copy of this saved revision?"))return;setValue(structuredClone(d.data));setConfirm(false);setFormKey(n=>n+1);setNotice("A copy of revision "+d.revision+" is ready for review. Confirm and save to create a new revision; nothing has been overwritten.");}}/></>}
 </InvestorFrame>;
}
function History({current,onRestore}:{current:InvestorDocument;onRestore:(d:InvestorDocument)=>void}){
 const read=useInvestorRead<{revisions:InvestorDocument[]}>("/api/investor/"+current.kind+"/"+current.id+"/history",investorCapabilities[current.kind]);
 return <section className={styles.section}><h2>Your earlier saved work</h2><p className={styles.muted}>The original and nine latest revisions are available here. All saved versions are retained privately. Restoring makes an editable copy, never an immediate overwrite.</p>
 {read.loading||read.error?<ReadState loading={read.loading} error={read.error} retry={read.retry}/>:read.data?.revisions.map(d=><Disclosure key={d.revision} summary={<>Revision {d.revision} · {d.updatedAt.slice(0,10)} · {d.origin}{d.revision===current.revision?" · current":""}</>}><pre className={styles.preview}>{describeInvestor(d.data,d.kind)}</pre>{d.revision!==current.revision&&<button onClick={()=>onRestore(d)}>Review a copy of revision {d.revision}</button>}</Disclosure>)}</section>;
}
