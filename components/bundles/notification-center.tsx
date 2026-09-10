"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {notificationDefinitions,notificationSnapshot,notificationReceipt,type NotificationSnapshot,type NotificationChange,type NotificationItem,type NotificationQuery} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-notifications";
import "./notification-center.css";
const label=(id:string)=>notificationDefinitions.find(t=>t.id===id)?.label??"Saved work";
const views=["inbox","unread","later","dismissed","muted"] as const;
const viewLabel={inbox:"Inbox",unread:"Unread",later:"Later",dismissed:"Dismissed",muted:"Muted"};
export function NotificationCenter({workspaceId,authorityRevision}:{workspaceId:string;authorityRevision:string}){
 const [data,setData]=useState<NotificationSnapshot|null>(null),[query,setQuery]=useState<NotificationQuery>({view:"inbox",offset:0});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const [pending,setPending]=useState<NotificationChange|null>(null),[preferencesOpen,setPreferencesOpen]=useState(false);
 const preferenceSummary=useRef<HTMLElement>(null),requestedFocus=useRef<"preferences"|"heading"|null>(null);
 const generation=useRef(0),abort=useRef<AbortController|null>(null),alive=useRef(true),busy=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 async function request(path:string,init?:RequestInit){
  const {data:auth}=await getWorkspaceClient().auth.getSession();if(!auth.session)throw new Error("Sign in to review notifications.");
  return fetch(path,{...init,cache:"no-store",headers:{"Content-Type":"application/json",Authorization:"Bearer "+auth.session.access_token}});
 }
 function clear(){requestedFocus.current=null;generation.current++;abort.current?.abort();setData(null);setPending(null);setError(null);setNotice(null);}
 async function load(next:NotificationQuery={view:"inbox",offset:0},focus:"preferences"|"heading"|null=null){
  clear();requestedFocus.current=focus;setQuery(next);setLoading(true);const current=generation.current,controller=new AbortController();abort.current=controller;
  try{
   const params=new URLSearchParams({view:next.view,offset:String(next.offset)});if(next.typeId)params.set("typeId",next.typeId);
   const r=await request("/api/bundles/notifications?"+params,{signal:controller.signal}),raw=await r.json();
   if(!r.ok)throw new Error(raw.message||"Notifications unavailable.");
   const checked=notificationSnapshot.parse(raw);
   if(checked.workspaceId!==workspaceId||checked.authorityRevision!==authorityRevision||checked.view!==next.view
    ||checked.typeId!==(next.typeId??null)||checked.offset!==next.offset)throw new Error("Workspace access changed. Refresh workspace access before continuing.");
   if(alive.current&&current===generation.current)setData(checked);
  }catch(e){if(alive.current&&current===generation.current)setError(e instanceof Error?e.message:"Notifications unavailable.");}
  finally{if(alive.current&&current===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;void load();
  const away=()=>{if(document.visibilityState==="hidden"){clear();setLoading(false);setNotice("Notifications cleared while away. Refresh to check current saved work.");}};
  document.addEventListener("visibilitychange",away);
  // Invalidate the live request generation, not a captured earlier generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return()=>{alive.current=false;generation.current++;abort.current?.abort();document.removeEventListener("visibilitychange",away);};
  // Identity and entitlement revision key this component in the parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  if(data&&requestedFocus.current){(requestedFocus.current==="preferences"?preferenceSummary.current:heading.current)?.focus();requestedFocus.current=null;}
 },[data]);
 async function save(change:NotificationChange){
  if(busy.current)return;busy.current=true;setSaving(true);setPending(change);setError(null);setNotice(null);
  const current=generation.current;
  try{
   const r=await request("/api/bundles/notifications",{method:"POST",body:JSON.stringify(change)}),raw=await r.json();
   if(!r.ok){
    if(r.status===403||r.status===409){
     if(alive.current&&current===generation.current){const next=current+1;await load({...query,offset:0});if(alive.current&&generation.current===next)setError(raw.message);}
     return;
    }
    throw new Error("The change outcome is not verified. Retry the same change, or refresh to check its saved state.");
   }
   const result=notificationReceipt.parse(raw);
   if(result.requestId!==change.requestId||result.changed!==(change.kind==="items"?change.items.length:1))throw new Error("The change response could not be verified. Refresh to check saved state.");
   if(alive.current&&current===generation.current){
    const next=current+1;await load({...query,offset:0},change.kind==="preference"?"preferences":"heading");
    if(alive.current&&generation.current===next){setNotice(change.kind==="preference"?"Notification preference saved.":change.action==="snooze"?"Set aside for 24 hours. It can return when you next check Workspace.":"Notification choice saved. Source work is unchanged.");}
   }
  }catch(e){if(alive.current&&current===generation.current)setError(e instanceof Error?e.message:"Change outcome unverified. Retry the same change.");}
  finally{busy.current=false;if(alive.current)setSaving(false);}
 }
 function items(action:"read"|"unread"|"dismiss"|"snooze",selected:NotificationItem[]){
  if(!data||!selected.length)return;
  void save({kind:"items",requestId:crypto.randomUUID(),expectedVersion:data.version,action,items:selected.map(({id,revision})=>({id,revision}))});
 }
 const disabled=loading||saving||pending!==null;
 return <section className="notification-center" aria-label="Notification center">
  <header><p className="eyebrow">A quieter way to stay on top of saved work</p><h1 className="page-title" ref={heading} tabIndex={-1}>Notifications</h1>
   <p className="page-lede">See what needs a look. Keep the useful updates, set others aside, and go straight to the work.</p>
   <p className="muted">Current saved conditions, checked when you open or refresh this page. No email, push, background monitoring or reminders are sent.</p>
   <button className="button secondary" disabled={loading||saving} onClick={()=>void load({...query,offset:0})}>Refresh notifications</button>
  </header>
  {saving&&<p aria-live="polite">Saving your notification choice…</p>}
  {loading&&<p role="status">Checking saved work and your notification choices…</p>}
  {error&&<div className="panel notification-feedback"><p role="alert">{error}</p>
   {pending&&!saving&&<button className="button" onClick={()=>void save(pending)}>Retry same change</button>}
   {!pending&&!loading&&<button className="button secondary" onClick={()=>void load({...query,offset:0})}>Retry notifications</button>}
  </div>}
  {notice&&<p className="panel notification-feedback" role="status">{notice}</p>}
  {data&&<>
   <div className="notification-summary"><strong>{data.counts.unread} unread</strong><span>Checked {new Date(data.retrievedAt).toLocaleTimeString()} · Dates use {data.timeZone} ({data.asOfDate})</span></div>
   <nav className="notification-views" aria-label="Notification views">{views.map(view=><button key={view} className="button secondary" aria-current={query.view===view?"page":undefined} disabled={disabled} onClick={()=>void load({...query,view,offset:0})}>{viewLabel[view]} <span>{data.counts[view]}</span></button>)}</nav>
   <div className="notification-tools"><div className="notification-filter"><label htmlFor="notification-type">Update type</label><select id="notification-type" value={query.typeId??""} disabled={disabled} onChange={e=>void load({view:query.view,offset:0,...(e.target.value?{typeId:e.target.value as NonNullable<NotificationQuery["typeId"]>}:{})})}><option value="">All available types</option>{data.types.map(t=><option key={t.id} value={t.id}>{label(t.id)}{t.enabled?"":" · muted"}</option>)}</select></div>
    <button className="button secondary" disabled={disabled||!data.items.some(i=>i.status==="unread")} onClick={()=>items("read",data.items.filter(i=>i.status==="unread"))}>Mark this page read</button>
   </div>
   <p className="muted notification-scope">Counts cover all available types; the list follows your filter. Opening this page or a source does not mark it read. “Mark this page read” affects only the unread items shown.</p>
   {!data.total&&<div className="panel notification-empty"><h2>{query.view==="inbox"||query.view==="unread"?"Nothing matching this view":"Nothing set aside here"}</h2>
    <p>No matching updates is not an all-clear. You can review your saved work or change the filter. Muted, dismissed and snoozed updates have their own views.</p><Link href="/workspace">Open your workspace →</Link></div>}
   {data.items.map(item=><article className="panel notification-card" key={item.id} aria-label={item.title} data-status={item.status}>
    <div className="notification-card-top"><p className="eyebrow">{label(item.typeId)}</p><span className="notification-status">{item.status==="later"?"Snoozed":item.status}</span></div>
    <h2>{item.title}</h2><p>{item.reason}</p>
    <p className="muted">{item.sourceLabel}{item.dueDate?" · Recorded date: "+item.dueDate:""}{item.snoozedUntil?" · Set aside until "+new Date(item.snoozedUntil).toLocaleString():""}</p>
    <div className="notification-card-actions"><Link className="button secondary" href={item.sourceHref}>Open source →</Link>
     {item.status==="muted"?<span className="muted">Enable this type below to bring its current updates back.</span>:<>
      <button className="button secondary" disabled={disabled} onClick={()=>items(item.status==="unread"?"read":"unread",[item])}>{item.status==="unread"?"Mark read":item.status==="read"?"Mark unread":"Restore to unread"}</button>
      {item.status!=="later"&&<button className="button secondary" disabled={disabled} onClick={()=>items("snooze",[item])}>Later · 24 hours</button>}
      {item.status!=="dismissed"&&<button className="button secondary" disabled={disabled} onClick={()=>items("dismiss",[item])}>Dismiss</button>}
     </>}
    </div>
   </article>)}
   {data.total>25&&<div className="notification-pagination"><button className="button secondary" disabled={disabled||query.offset===0} onClick={()=>void load({...query,offset:query.offset-25})}>Previous updates</button>
    <p role="status">Showing {data.items.length?query.offset+1:0}–{query.offset+data.items.length} of {data.total}</p>
    <button className="button secondary" disabled={disabled||query.offset+25>=data.total||query.offset>=2147483000} onClick={()=>void load({...query,offset:query.offset+25})}>Next updates</button></div>}
   {data.total>0&&!data.items.length&&<p>This page has no remaining updates. Refresh from the first page.</p>}
   <details className="panel notification-preferences" open={preferencesOpen} onToggle={e=>setPreferencesOpen(e.currentTarget.open)}><summary ref={preferenceSummary}>Choose which updates you receive here</summary>
    <p>These preferences affect this in-app inbox only. Muting does not remove access, resolve work, change assistant permissions or stop any separately configured service.</p>
    {data.types.map(t=><label key={t.id}><input type="checkbox" checked={t.enabled} disabled={disabled} onChange={e=>void save({kind:"preference",requestId:crypto.randomUUID(),expectedVersion:data.version,typeId:t.id,enabled:e.target.checked})}/><span>{label(t.id)}</span></label>)}
   </details>
   <details className="panel"><summary>What this inbox includes—and what it does not</summary><p>It surfaces selected current conditions from your assigned bundles: resources marked ready, approaching research dates, due partner follow-ups, recorded thesis concerns, due or blocked Executive commitments and actions, and unfinished or expired saved access.</p>
    <p>Read, dismiss and snooze choices are saved for the current condition. Changed dates, date categories or recorded concerns may appear as unread again. Routine title edits do not. Conditions that disappear and later return unchanged retain their earlier choice. This is not a historical activity log.</p>
    <p>Resolved, deleted or no-longer-authorized sources leave this view. There is no live market verification, provider health check, or review of underlying document content here. Dismissing an update does not complete its source task.</p></details>
  </>}
 </section>;
}
