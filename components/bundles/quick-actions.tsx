"use client";
import Link from "next/link";
import "@/app/workspace/search/search.css";
import {useEffect,useRef,useState} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {nativeQuickActions,type NativeQuickAction} from "@/lib/bundles/quick-actions";
function ActionDialog({actions,search,onClose}:{actions:NativeQuickAction[];search:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),field=useRef<HTMLInputElement>(null),[query,setQuery]=useState("");
 useEffect(()=>{const previous=document.activeElement,element=dialog.current;element?.showModal();field.current?.focus();return()=>{element?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 const matches=actions.filter(a=>(a.label+" "+a.description).toLowerCase().includes(query.trim().toLowerCase()));
 return <dialog ref={dialog} className="native-command-dialog" aria-labelledby="native-command-title" onCancel={onClose} onClose={onClose} onKeyDownCapture={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose();}}}>
  <header className="layout-actions"><h2 id="native-command-title">Quick actions</h2><button className="button secondary" onClick={onClose}>Close actions</button></header>
  <p>Open a workflow without saving, sending or publishing anything.</p>
  <label>Find an action<input ref={field} type="search" value={query} autoComplete="off" maxLength={120} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="command-options">{matches.map(a=><Link key={a.id} href={a.route} onClick={onClose}><strong>{a.label}</strong><span>{a.description}</span></Link>)}</div>
  {!matches.length?<p role="status">No matching actions under your current access. Try fewer words.</p>:null}
  {search?<Link className="button secondary" href="/workspace/search" onClick={onClose}>Search saved records instead</Link>:null}
 </dialog>;
}
export function QuickActions({blocked}:{blocked:boolean}){
 const {bundleExperience}=useWorkspace(),[open,setOpen]=useState(false);
 const actions=bundleExperience?nativeQuickActions(bundleExperience):[],search=bundleExperience?.capabilityIds.includes("workspace.search")??false;
 const enabled=actions.length>0;
 useEffect(()=>{
  function shortcut(event:KeyboardEvent){
   if(enabled&&!blocked&&(event.metaKey||event.ctrlKey)&&event.shiftKey&&!event.altKey&&event.key.toLowerCase()==="k"&&!document.querySelector('dialog[open], [role="dialog"]')){
    event.preventDefault();setOpen(true);
   }
  }
  window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut);
 },[enabled,blocked]);
 if(!enabled)return null;
 return <><button className="quick-actions-trigger button secondary" disabled={blocked} aria-keyshortcuts="Control+Shift+K Meta+Shift+K" title="Quick actions (Ctrl or Command + Shift + K)" onClick={()=>setOpen(true)}>Quick actions</button>
 {open&&!blocked?<ActionDialog actions={actions} search={search} onClose={()=>setOpen(false)}/>:null}</>;
}
