"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceRead } from "@/lib/bundles/client";
import {
  sourceBatchItems, sourceBatchSnapshot, type SourceBatchCommit, type SourceBatchItem, type SourceBatchReview, type SourceBatchSnapshot
} from "@/lib/writing/batch-contracts";
import { useWritingAction } from "./use-writing-action";

export function useSourceBatch() {
  const {run,error:actionError}=useWritingAction();
  const live=useRef(true),initialized=useRef(false),latest=useRef<SourceBatchItem[]>([]),savedSignature=useRef("");
  const versionRef=useRef(0),receipt=useRef<SourceBatchSnapshot|null>(null),pending=useRef<Promise<SourceBatchSnapshot|null>|null>(null);
  const attempt=useRef({signature:"",requestId:""});
  const [items,setItemsState]=useState<SourceBatchItem[]>([]),[version,setVersion]=useState(0),[savedAt,setSavedAt]=useState<string|null>(null);
  const [savedSignatureState,setSavedSignatureState]=useState("");
  const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState<string|null>(null),[saving,setSaving]=useState(false),[fault,setFault]=useState(false);
  const [review,setReview]=useState<SourceBatchReview|null>(null),[reviewing,setReviewing]=useState(false),[committing,setCommitting]=useState(false),[tick,setTick]=useState(0);

  useEffect(()=>{
    live.current=true;const controller=new AbortController();
    void workspaceRead<unknown>("/api/writing/bulk",controller.signal).then(raw=>{
      if(controller.signal.aborted)return;
      const result=sourceBatchSnapshot.parse(raw),next=result.items??[];
      latest.current=next;versionRef.current=result.version;receipt.current=result;savedSignature.current=JSON.stringify(next);setSavedSignatureState(savedSignature.current);initialized.current=true;
      setItemsState(next);setVersion(result.version);setSavedAt(result.savedAt);setLoaded(true);setLoadError(null);setFault(false);setReview(null);
    }).catch(()=>{if(!controller.signal.aborted)setLoadError("Your staged library could not be loaded. Retry before adding files.");});
    return()=>{live.current=false;controller.abort();};
  },[tick]);

  const update=useCallback((next:SourceBatchItem[]|((current:SourceBatchItem[])=>SourceBatchItem[]))=>{
    const value=typeof next==="function"?next(latest.current):next;
    latest.current=value;setItemsState(value);setReview(null);setFault(false);
  },[]);

  const flush=useCallback(async():Promise<SourceBatchSnapshot|null>=>{
    if(!initialized.current||latest.current.length===0||!sourceBatchItems.safeParse(latest.current).success)return receipt.current;
    if(pending.current)await pending.current;
    const snapshot=latest.current,signature=JSON.stringify(snapshot);
    if(signature===savedSignature.current&&receipt.current?.items)return receipt.current;
    if(attempt.current.signature!==signature)attempt.current={signature,requestId:crypto.randomUUID()};
    setSaving(true);setFault(false);
    const task=run<SourceBatchSnapshot>("/api/writing/bulk",{expectedVersion:versionRef.current,requestId:attempt.current.requestId,items:snapshot});
    pending.current=task;const result=await task;pending.current=null;
    if(!live.current)return null;
    setSaving(false);
    if(result){
      const unchanged=JSON.stringify(latest.current)===signature;
      const persisted=unchanged&&result.items?result.items:snapshot,persistedSignature=JSON.stringify(persisted);
      if(unchanged&&result.items){latest.current=result.items;setItemsState(result.items);}
      versionRef.current=result.version;receipt.current=result;savedSignature.current=persistedSignature;setSavedSignatureState(persistedSignature);setVersion(result.version);setSavedAt(result.savedAt);
    }
    else setFault(true);
    return result;
  },[run]);

  const signature=JSON.stringify(items),dirty=loaded&&signature!==savedSignatureState;
  const valid=sourceBatchItems.safeParse(items).success;
  useEffect(()=>{
    if(!dirty||saving||fault||items.length===0||!valid)return;
    const timer=setTimeout(()=>{void flush();},900);return()=>clearTimeout(timer);
  },[dirty,signature,saving,fault,items.length,valid,flush]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);

  const clear=useCallback(async()=>{
    if(pending.current)await pending.current;
    const result=await run<SourceBatchSnapshot>("/api/writing/bulk/clear",{expectedVersion:versionRef.current});
    if(result){latest.current=[];setItemsState([]);versionRef.current=result.version;setVersion(result.version);receipt.current=result;savedSignature.current="[]";setSavedSignatureState("[]");setSavedAt(null);setReview(null);setFault(false);}
    else setFault(true);
    return result;
  },[run]);
  const reviewNow=useCallback(async()=>{
    if(dirty||saving||pending.current||latest.current.length===0)return null;
    setReviewing(true);const result=await run<SourceBatchReview>("/api/writing/bulk/review",{expectedVersion:versionRef.current});
    if(result)setReview(result);setReviewing(false);return result;
  },[dirty,saving,run]);
  const commit=useCallback(async(current:SourceBatchReview)=>{
    if(dirty||saving||pending.current||current.version!==versionRef.current)return null;
    setCommitting(true);const result=await run<SourceBatchCommit>("/api/writing/bulk/commit",{
      expectedVersion:current.version,reviewToken:current.reviewToken,confirm:true
    },true);
    if(result){const nextVersion=result.batchVersion+1;latest.current=[];setItemsState([]);versionRef.current=nextVersion;setVersion(nextVersion);receipt.current=null;savedSignature.current="[]";setSavedSignatureState("[]");setSavedAt(null);setReview(null);setFault(false);}
    setCommitting(false);return result;
  },[dirty,saving,run]);
  function reload(){if(pending.current)return;initialized.current=false;setLoaded(false);setTick(value=>value+1);}
  return {items,version,savedAt,loaded,loadError,actionError,saveError:fault?actionError:null,saving,dirty,valid,review,reviewing,committing,update,flush,clear,reviewNow,commit,reload};
}
