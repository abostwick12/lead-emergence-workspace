"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {useWorkspace} from "@/components/workspace-provider";
class ReadError extends Error {constructor(message:string,readonly status:number){super(message);}}
async function request(path:string,subject:string|undefined,signal:AbortSignal,input?:object) {
 signal.throwIfAborted();
 let stop:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{const abort=()=>reject(new DOMException("Request timed out or was cancelled.","AbortError"));signal.addEventListener("abort",abort,{once:true});stop=()=>signal.removeEventListener("abort",abort);});
 const {data,error}=await Promise.race([getWorkspaceClient().auth.getSession(),cancelled]).finally(stop);
 signal.throwIfAborted();
 if(error||!data.session||data.session.user.id!==subject)throw new ReadError("Your sign-in changed. Refresh before continuing.",401);
 const response=await fetch(path,{cache:"no-store",signal,method:input?"POST":"GET",headers:{Authorization:"Bearer "+data.session.access_token,...(input?{"Content-Type":"application/json"}:{})},...(input?{body:JSON.stringify(input)}:{})});
 const result=await response.json();
 if(!response.ok)throw new ReadError(typeof result.message==="string"?result.message:"Ministry is unavailable. Please retry.",response.status);
 return result;
}
export function useMinistryRead<T>(path:string,capability:string) {
 const {user,bundleExperience,refreshBundleExperience}=useWorkspace();
 const enabled=!!user&&bundleExperience?.capabilityIds.includes(capability)===true;
 const key=enabled?user.id+":"+bundleExperience.workspaceId+":"+bundleExperience.revision+":"+path:null;
 const [attempt,setAttempt]=useState(0),[state,setState]=useState<{key:string;data:T|null;error:string|null}|null>(null);
 useEffect(()=>{
  if(!key)return;
  const controller=new AbortController();let live=true;
  const timer=setTimeout(()=>controller.abort(),20000);
  void request(path,user?.id,controller.signal).then(data=>{if(live)setState({key,data,error:null});}).catch(error=>{
   if(!live)return;
   setState({key,data:null,error:controller.signal.aborted?"This request took too long. Try again; no saved work was changed.":error instanceof Error?error.message:"Ministry is unavailable."});
   if(error instanceof ReadError&&[401,403].includes(error.status))refreshBundleExperience();
  }).finally(()=>clearTimeout(timer));
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[key,path,user?.id,attempt,refreshBundleExperience]);
 const matching=key!==null&&state?.key===key;
 return {enabled,key,data:matching?state.data:null,error:matching?state.error:null,loading:enabled&&!matching,retry:useCallback(()=>{setState(null);setAttempt(n=>n+1);},[])};
}
export function useMinistryAction() {
 const {user,bundleExperience,refreshBundleExperience}=useWorkspace();
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const flight=useRef(false),controller=useRef<AbortController|null>(null),alive=useRef(true);
 const attempt=useRef({payload:"",requestId:""});
 const scope=user?.id+":"+bundleExperience?.workspaceId+":"+bundleExperience?.revision;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[scope]);
 const run=async<T,>(path:string,input:object,idempotent=false):Promise<T|null>=>{
  if(flight.current)return null;
  flight.current=true;setBusy(true);setError(null);
  const control=new AbortController();controller.current=control;
  const timer=setTimeout(()=>control.abort(),20000);
  try {
   const payload=JSON.stringify({scope,path,input});
   if(attempt.current.payload!==payload)attempt.current={payload,requestId:crypto.randomUUID()};
   const result=await request(path,user?.id,control.signal,idempotent?{...input,requestId:attempt.current.requestId}:input);
   return alive.current&&!control.signal.aborted?result as T:null;
  }catch(error){
   if(alive.current)setError(control.signal.aborted?"The response took too long. Your changes are still here. Retry the same save safely.":error instanceof Error?error.message:"Couldn't save. You can safely retry.");
   if(error instanceof ReadError&&[401,403].includes(error.status))refreshBundleExperience();
   return null;
  }finally{clearTimeout(timer);flight.current=false;if(alive.current)setBusy(false);}
 };
 return {run,busy,error};
}
export function useUnsavedMinistry(dirty:boolean) {
 useEffect(()=>{
  if(!dirty)return;
  const before=(event:BeforeUnloadEvent)=>{event.preventDefault();};
  const click=(event:MouseEvent)=>{
   const link=(event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement|null;
   if(link&&link.href!==window.location.href&&!window.confirm("Leave without saving your Ministry changes?")){event.preventDefault();event.stopPropagation();}
  };
  window.addEventListener("beforeunload",before);document.addEventListener("click",click,true);
  return()=>{window.removeEventListener("beforeunload",before);document.removeEventListener("click",click,true);};
 },[dirty]);
}
