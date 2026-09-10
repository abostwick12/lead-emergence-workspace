"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {useWorkspace} from "@/components/workspace-provider";
import type {EditorDraftReceipt,EditorDraftSnapshot,EditorDraftValues,EditorTarget} from "@/vendor/lead-emergence-bundles/domain-contracts/editor-recovery";
export type DraftUi=EditorDraftValues["ui"];
type Values<T>={data:T;ui:DraftUi};
class DraftRequestError extends Error{constructor(message:string,readonly status:number){super(message);}}
const clone=<T,>(value:T):T=>structuredClone(value);
const signature=<T,>(state:{values:Values<T>;baseRevision:number})=>JSON.stringify(state);
async function request<T>(path:string,subject:string|undefined,input?:object,signal?:AbortSignal):Promise<T>{
 const control=signal??new AbortController().signal;control.throwIfAborted();
 const session=await getWorkspaceClient().auth.getSession();control.throwIfAborted();
 if(session.error||!session.data.session||session.data.session.user.id!==subject)throw new DraftRequestError("Your sign-in changed. Refresh before continuing.",401);
 const response=await fetch(path,{method:input?"POST":"GET",cache:"no-store",signal:control,headers:{Authorization:"Bearer "+session.data.session.access_token,...(input?{"Content-Type":"application/json"}:{})},...(input?{body:JSON.stringify(input)}:{})});
 let body:unknown;try{body=await response.json();}catch{body=null;}
 if(!response.ok)throw new DraftRequestError(body&&typeof body==="object"&&"message"in body&&typeof body.message==="string"?body.message:"Working draft recovery is unavailable.",response.status);
 return body as T;
}
export function useNativeEditorDraft<T extends Record<string,unknown>>(target:EditorTarget,initialData:T,currentRevision:number,initialUi:DraftUi={},enabled=true){
 const {user,bundleExperience,refreshBundleExperience}=useWorkspace(),userId=user?.id;
 const [initial]=useState<Values<T>>(()=>({data:clone(initialData),ui:clone(initialUi)}));
 const [values,setValuesState]=useState<Values<T>>(()=>clone(initial));
 const [baseRevision,setBaseRevision]=useState(currentRevision),[savedSignature,setSavedSignature]=useState(""),[ready,setReady]=useState(false);
 const latest=useRef({values:clone(initial),baseRevision:currentRevision});
 const version=useRef(0),hasValues=useRef(false),initialized=useRef(false),flight=useRef<Promise<EditorDraftSnapshot|null>|null>(null),generation=useRef(0);
 const attempt=useRef({payload:"",requestId:""});
 const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState<string|null>(null),[recovery,setRecovery]=useState<EditorDraftSnapshot|null>(null);
 const [sourceRevision,setSourceRevision]=useState(currentRevision),[restored,setRestored]=useState(false);
 const [saving,setSaving]=useState(false),[committing,setCommitting]=useState(false),[savedAt,setSavedAt]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[conflict,setConflict]=useState(false),[receipt,setReceipt]=useState<EditorDraftReceipt|null>(null),[tick,setTick]=useState(0);
 const targetInput=useMemo<EditorTarget>(()=>({domain:target.domain,kind:target.kind,documentId:target.documentId}),[target.domain,target.kind,target.documentId]);
 const targetKey=JSON.stringify(targetInput),scope=userId+":"+bundleExperience?.workspaceId+":"+bundleExperience?.revision+":"+targetKey;
 const path=useMemo(()=>{const p=new URLSearchParams({domain:targetInput.domain,kind:targetInput.kind});if(targetInput.documentId)p.set("documentId",targetInput.documentId);return "/api/bundles/editor-drafts?"+p;},[targetInput]);
 const handleError=useCallback((problem:unknown,fallback:string)=>{
  const message=problem instanceof Error?problem.message:fallback;setError(message);
  if(problem instanceof DraftRequestError&&problem.status===409)setConflict(true);
  if(problem instanceof DraftRequestError&&[401,403].includes(problem.status))void refreshBundleExperience();
 },[refreshBundleExperience]);
 useEffect(()=>{
  const current=++generation.current;let active=true;initialized.current=false;setReady(false);setLoaded(false);setLoadError(null);setRecovery(null);setError(null);setConflict(false);setRestored(false);
  if(!enabled){setLoaded(true);return()=>{active=false;};}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  void request<EditorDraftSnapshot>(path,userId,undefined,controller.signal).then(snapshot=>{
   if(!active||current!==generation.current)return;
   version.current=snapshot.version;hasValues.current=!!snapshot.values;setSourceRevision(snapshot.currentRevision);setReceipt(snapshot.receipt);setSavedAt(snapshot.savedAt);
   if(snapshot.currentRevision!==currentRevision){setLoadError("The saved record changed while this editor was opening. Open the latest saved revision before editing.");setLoaded(true);return;}
   if(snapshot.values)setRecovery(snapshot);
   else{const state={values:clone(initial),baseRevision:currentRevision};latest.current=state;setValuesState(clone(state.values));setBaseRevision(currentRevision);setSavedSignature(signature(state));initialized.current=true;setReady(true);}
   setLoaded(true);
  }).catch(problem=>{if(active&&current===generation.current)setLoadError(controller.signal.aborted?"The recovery check took too long. Retry before editing; no saved record was changed.":problem instanceof Error?problem.message:"Your working draft could not be checked. Retry before editing.");})
   .finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[scope,path,userId,currentRevision,tick,initial,enabled]);
 const updateData=useCallback((next:T)=>{if(!initialized.current)return;const state={...latest.current,values:{...latest.current.values,data:next}};latest.current=state;setValuesState(clone(state.values));setError(null);},[]);
 const updateUi=useCallback((patch:Partial<DraftUi>)=>{if(!initialized.current)return;const state={...latest.current,values:{...latest.current.values,ui:{...latest.current.values.ui,...patch}}};latest.current=state;setValuesState(clone(state.values));setError(null);},[]);
 const mutate=useCallback(async(input:object):Promise<EditorDraftSnapshot|null>=>{
  const payload=JSON.stringify(input);if(attempt.current.payload!==payload)attempt.current={payload,requestId:crypto.randomUUID()};
  const exact={...input,requestId:attempt.current.requestId},current=generation.current;setSaving(true);setError(null);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const result=await request<EditorDraftSnapshot>("/api/bundles/editor-drafts",userId,exact,controller.signal);
   if(current!==generation.current)return null;version.current=result.version;hasValues.current=!!result.values;setReceipt(result.receipt);setSavedAt(result.savedAt);setSourceRevision(result.currentRevision);setConflict(false);return result;
  }catch(problem){if(current===generation.current)handleError(problem,controller.signal.aborted?"The response took too long. Your work is still on screen; retry the exact change safely.":"Working draft recovery is unavailable.");return null;}
  finally{clearTimeout(timer);if(current===generation.current)setSaving(false);}
 },[userId,handleError]);
 const saveSnapshot=useCallback(async(state:{values:Values<T>;baseRevision:number})=>{
  const sig=signature(state);if(sig===savedSignature&&hasValues.current)return true;
  const task=mutate({target:targetInput,operation:"save",expectedVersion:version.current,schemaVersion:1,baseRevision:state.baseRevision,values:state.values});
  flight.current=task;const result=await task;flight.current=null;
  if(result?.values){setSavedSignature(sig);setSavedAt(result.savedAt);}return !!result;
 },[mutate,targetInput,savedSignature]);
 const currentSignature=signature({values,baseRevision}),dirty=loaded&&ready&&currentSignature!==savedSignature;
 const staleSource=loaded&&ready&&baseRevision!==sourceRevision;
 const flush=useCallback(async()=>{if(!initialized.current)return false;if(flight.current)await flight.current;return saveSnapshot({values:clone(latest.current.values),baseRevision:latest.current.baseRevision});},[saveSnapshot]);
 useEffect(()=>{if(!dirty||saving||error||staleSource)return;const timer=setTimeout(()=>{void flush();},800);return()=>clearTimeout(timer);},[dirty,saving,error,staleSource,flush,currentSignature]);
 useEffect(()=>{if(!dirty&&!saving)return;const before=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const anchor=event.target instanceof Element?event.target.closest("a[href]"):null;if(!(anchor instanceof HTMLAnchorElement)||anchor.target==="_blank"||anchor.hasAttribute("download"))return;const destination=new URL(anchor.href);if(destination.pathname===location.pathname&&destination.search===location.search)return;if(!window.confirm("Some working-draft edits have not finished saving. Leave without those edits?")){event.preventDefault();event.stopPropagation();}};window.addEventListener("beforeunload",before);document.addEventListener("click",click,true);return()=>{window.removeEventListener("beforeunload",before);document.removeEventListener("click",click,true);};},[dirty,saving]);
 const restore=useCallback(()=>{if(!recovery?.values)return;const state={values:clone(recovery.values as Values<T>),baseRevision:recovery.baseRevision??currentRevision};latest.current=state;setValuesState(clone(state.values));setBaseRevision(state.baseRevision);setSavedSignature(signature(state));hasValues.current=true;initialized.current=true;setReady(true);setRecovery(null);setRestored(true);setError(null);},[recovery,currentRevision]);
 const discard=useCallback(async()=>{if(!window.confirm("Discard this private working draft? Saved records and submitted proposals will not change."))return false;if(flight.current)await flight.current;const result=await mutate({target:targetInput,operation:"discard",expectedVersion:version.current});if(!result)return false;const state={values:clone(initial),baseRevision:result.currentRevision};latest.current=state;setValuesState(clone(initial));setBaseRevision(result.currentRevision);setSavedSignature(signature(state));hasValues.current=false;initialized.current=true;setReady(true);setRecovery(null);setRestored(false);setReceipt(result.receipt);return true;},[mutate,targetInput,initial]);
 const rebase=useCallback(async()=>{if(!window.confirm("Base this recovered draft on the latest saved revision? Review every listed changed section first. This keeps an unfinished draft; it does not save the official record."))return false;const state={values:clone(latest.current.values),baseRevision:sourceRevision},ok=await saveSnapshot(state);if(ok){latest.current=state;setBaseRevision(sourceRevision);setSavedSignature(signature(state));setError(null);setConflict(false);}return ok;},[sourceRevision,saveSnapshot]);
 const commit=useCallback(async()=>{setCommitting(true);try{if(staleSource){setError("The saved record changed. Compare and base this draft on the latest revision before confirming it.");setConflict(true);return null;}if(flight.current)await flight.current;if(!(await flush()))return null;const result=await mutate({target:targetInput,operation:"commit",expectedVersion:version.current,confirm:true});if(result){setSavedSignature(signature(latest.current));setReceipt(result.receipt);}return result;}finally{setCommitting(false);}},[staleSource,flush,mutate,targetInput]);
 const reload=useCallback(()=>{if((dirty||error)&&!window.confirm("Replace your on-screen edits with the working draft currently saved on the server? Copy your work first if you need both versions."))return;initialized.current=false;setReady(false);setTick(n=>n+1);},[dirty,error]);
 const changedSections=useMemo(()=>{const recovered=(recovery?.values?.data??(restored?values.data:null))as Record<string,unknown>|null;if(!recovered)return[];return [...new Set([...Object.keys(initial.data),...Object.keys(recovered)].filter(k=>JSON.stringify(initial.data[k])!==JSON.stringify(recovered[k])))].sort();},[recovery,restored,values.data,initial]);
 return {data:values.data,ui:values.ui,updateData,updateUi,loaded,loadError,recovery,restore,discard,rebase,commit,reload,flush,saving,committing,dirty,error,conflict,savedAt,restored,staleSource,sourceRevision,baseRevision,receipt,changedSections,editingBlocked:!loaded||!ready||!!loadError||!!recovery};
}
