"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceRead } from "@/lib/bundles/client";
import type { DraftValues, WorkingDraft } from "@/lib/writing/draft-contracts";
import { useWritingAction } from "./use-writing-action";
export function useWorkingDraft(resourceId:string|null,initial:DraftValues,currentRevision:number|null) {
  const {run,error:saveError}=useWritingAction();
  const initialRef=useRef(initial);
  const live=useRef(true), initialized=useRef(false), saved=useRef(""), version=useRef(0);
  const latest=useRef({values:initial,baseRevision:currentRevision});
  const pending=useRef<Promise<WorkingDraft|null>|null>(null);
  const attempt=useRef({signature:"",requestId:""});
  const receipt=useRef<WorkingDraft|null>(null);
  const clearingRef=useRef(false);
  const [clearing,setClearing]=useState(false);
  const [values,setValuesState]=useState(initial),[baseRevision,setBaseState]=useState(currentRevision);
  const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState<string|null>(null),[fault,setFault]=useState(false);
  const [saving,setSaving]=useState(false),[savedAt,setSavedAt]=useState<string|null>(null),[restored,setRestored]=useState(false),[tick,setTick]=useState(0);
  const [savedSignature,setSavedSignature]=useState("");
  const path="/api/writing/drafts"+(resourceId?"?resourceId="+resourceId:"");
  useEffect(()=>{
    live.current=true;
    const controller=new AbortController();
    void workspaceRead<WorkingDraft>(path,controller.signal).then(d=>{
      if(controller.signal.aborted)return;
      const next={values:d.values?{...initialRef.current,...d.values}:initialRef.current,baseRevision:d.values?d.baseRevision:currentRevision};
      latest.current=next;version.current=d.version;receipt.current=d;saved.current=JSON.stringify(next);setSavedSignature(saved.current);initialized.current=true;
      setValuesState(next.values);setBaseState(next.baseRevision);setSavedAt(d.values?d.savedAt:null);setRestored(Boolean(d.values));setLoaded(true);setLoadError(null);setFault(false);
    }).catch(()=>{if(!controller.signal.aborted)setLoadError("Your saved draft could not be loaded. Retry before editing.");});
    return()=>{live.current=false;controller.abort();};
  },[path,currentRevision,tick]);
  const update=useCallback((patch:Partial<DraftValues>)=>{
    if(clearingRef.current)return;
    const next={...latest.current,values:{...latest.current.values,...patch}};
    latest.current=next;setValuesState(next.values);
  },[]);
  const rebase=useCallback(()=>{
    latest.current={...latest.current,baseRevision:currentRevision};setBaseState(currentRevision);
  },[currentRevision]);
  const flush=useCallback(async():Promise<WorkingDraft|null>=>{
    if(!initialized.current||clearingRef.current)return null;
    if(pending.current)await pending.current;
    const snapshot=latest.current,signature=JSON.stringify(snapshot);
    if(signature===saved.current && receipt.current?.values)return receipt.current;
    if(attempt.current.signature!==signature)attempt.current={signature,requestId:crypto.randomUUID()};
    setSaving(true);setFault(false);
    const task=run<WorkingDraft>("/api/writing/drafts",{
      resourceId,expectedVersion:version.current,baseRevision:snapshot.baseRevision,requestId:attempt.current.requestId,values:snapshot.values
    });
    pending.current=task;
    const result=await task;
    pending.current=null;
    if(!live.current)return null;
    setSaving(false);
    if(result) {version.current=result.version;receipt.current=result;saved.current=signature;setSavedSignature(signature);setSavedAt(result.savedAt);}
    else setFault(true);
    return result;
  },[run,resourceId]);
  const signature=JSON.stringify({values,baseRevision});
  const dirty=loaded && signature!==savedSignature;
  useEffect(()=>{
    if(!dirty||saving||fault)return;
    const timer=setTimeout(()=>{void flush();},1200);
    return()=>clearTimeout(timer);
  },[dirty,signature,saving,fault,flush]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    const warnLink=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
      const anchor=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!(anchor instanceof HTMLAnchorElement)||anchor.target==="_blank"||anchor.hasAttribute("download"))return;
      const destination=new URL(anchor.href);
      if(destination.pathname===location.pathname&&destination.search===location.search)return;
      if(!window.confirm("Some draft edits have not finished saving. Leave without saving those edits?")) {event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener("beforeunload",warn);document.addEventListener("click",warnLink,true);
    return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",warnLink,true);};
  },[dirty]);
  const clear=useCallback(async(expectedVersion:number)=>{
    clearingRef.current=true;setClearing(true);
    const result=await run<WorkingDraft>("/api/writing/drafts/clear",{resourceId,expectedVersion});
    if(result){
      attempt.current={signature:"",requestId:""};
      version.current=result.version;receipt.current=result;latest.current={values:initialRef.current,baseRevision:currentRevision};
      saved.current=JSON.stringify(latest.current);setSavedSignature(saved.current);setValuesState(initialRef.current);setBaseState(currentRevision);setSavedAt(null);setRestored(false);setFault(false);
    } else setFault(true);
    clearingRef.current=false;setClearing(false);
    return result;
  },[run,resourceId,currentRevision]);
  async function discard() {
    if(!window.confirm("Discard this working draft? Your saved resources and submitted proposals will not change."))return;
    clearingRef.current=true;setClearing(true);
    if(pending.current)await pending.current;
    await clear(version.current);
  }
  function reload() {
    if(pending.current||clearingRef.current)return;
    if(dirty&&!window.confirm("Replace your on-screen edits with the saved draft? Copy your work first if you need to keep both."))return;
    initialized.current=false;setLoaded(false);setTick(t=>t+1);
  }
  return {values,baseRevision,update,rebase,loaded,loadError,saveError: fault?saveError:null,saving:saving||clearing,clearing,savedAt,restored,dirty,flush,clear,reload,discard};
}
