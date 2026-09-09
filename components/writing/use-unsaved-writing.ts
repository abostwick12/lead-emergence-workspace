"use client";
import {useEffect} from "react";
export function useUnsavedWriting(dirty:boolean){
 useEffect(()=>{
  if(!dirty)return;
  const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
  const link=(e:MouseEvent)=>{
   if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
   const a=e.target instanceof Element?e.target.closest("a[href]"):null;
   if(!(a instanceof HTMLAnchorElement)||a.target==="_blank"||a.hasAttribute("download"))return;
   const url=new URL(a.href);if(url.pathname===location.pathname&&url.search===location.search)return;
   if(!window.confirm("You have unconfirmed writing preferences. Leave without saving them?")){e.preventDefault();e.stopPropagation();}
  };
  window.addEventListener("beforeunload",unload);document.addEventListener("click",link,true);
  return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",link,true);};
 },[dirty]);
}
