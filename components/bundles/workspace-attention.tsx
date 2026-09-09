"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {z} from "zod";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {useWorkspace} from "@/components/workspace-provider";
import {admittedAttentionScopes,attentionSources,attentionSourceRoute,nativeAttentionInput,nativeAttentionResult,type NativeAttentionResult} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-attention";
import type {BaseBundleExperience} from "@/lib/bundles/experience";
import "./workspace-attention.css";
type Query=z.infer<typeof nativeAttentionInput>;
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const count=(n:number)=>n.toLocaleString();
export function WorkspaceAttention({experience,compact=false}:{experience:BaseBundleExperience;compact?:boolean}){
 const [query,setQuery]=useState<Query>(()=>({asOfDate:today(),authorityRevision:experience.revision,bundleKey:null,priority:null,offset:0}));
 const [date,setDate]=useState(query.asOfDate),[data,setData]=useState<NativeAttentionResult|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const generation=useRef(0),request=useRef<AbortController|null>(null),alive=useRef(true);
 const expected=admittedAttentionScopes(experience.capabilityIds),sources=attentionSources.filter(s=>experience.capabilityIds.includes(s.capabilityId));
 const bundles=[...new Map(sources.map(s=>[s.bundleKey,s.bundleLabel])).entries()];
 function clear(){++generation.current;request.current?.abort();setData(null);setLoading(false);setError(null);setNotice(null);}
 async function load(next:Query){
  clear();const id=generation.current;setQuery(next);setLoading(true);
  const controller=new AbortController();request.current=controller;
  try{
   const {data:auth}=await getWorkspaceClient().auth.getSession();if(controller.signal.aborted)return;
   if(!auth.session)throw new Error("Sign in to review your attention.");
   const r=await fetch("/api/bundles/attention",{method:"POST",cache:"no-store",signal:controller.signal,headers:{Authorization:"Bearer "+auth.session.access_token,"Content-Type":"application/json"},body:JSON.stringify(next)});
   const raw=await r.json();if(!r.ok)throw new Error(typeof raw.message==="string"?raw.message:"Attention unavailable.");
   const parsed=nativeAttentionResult.parse(raw),keys=(ss:{capabilityId:string;level:string}[])=>ss.map(s=>s.capabilityId+":"+s.level).sort().join("|");
   if(parsed.workspaceId!==experience.workspaceId||parsed.authorityRevision!==experience.revision
    ||parsed.asOfDate!==next.asOfDate||parsed.offset!==next.offset||parsed.bundleKey!==next.bundleKey||parsed.priority!==next.priority
    ||keys(parsed.coverage)!==keys(expected))throw new Error("Attention sources changed. Refresh this page to verify access.");
   if(alive.current&&id===generation.current)setData(parsed);
  }catch(e){if(alive.current&&id===generation.current)setError(e instanceof Error?e.message:"Attention unavailable.");}
  finally{if(alive.current&&id===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;void load(query);
  const away=()=>{if(document.visibilityState==="hidden"){clear();setNotice("Attention cleared while away. Refresh for current saved work.");}};
  document.addEventListener("visibilitychange",away);
  // Invalidate the current request generation; a captured old value would allow stale responses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return()=>{alive.current=false;++generation.current;request.current?.abort();document.removeEventListener("visibilitychange",away);};
  // Identity, workspace and authority are keyed by the parent. Filters call load directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function choose(patch:Partial<Query>){void load({...query,...patch,offset:0});}
 const items=data?.items.slice(0,compact?3:25)??[],high=data?.groups.filter(g=>g.priority==="high").reduce((n,g)=>n+g.total,0)??0;
 return <section className={"native-attention"+(compact?" native-attention-compact":"")} aria-label="Shared saved-work attention">
  <header><p className="eyebrow">A clear next move</p>{compact?<h2>What deserves attention</h2>:<h1 className="page-title">What deserves attention</h1>}
   <p className="page-lede">{compact?"Three current cues from your assigned saved work.":"Your saved work, brought into focus—with the reason and the original close at hand."}</p>
   {!compact&&<p className="muted">This is your native view, not permission for an assistant to read across bundles. No reminders are sent or source records changed here.</p>}
  </header>
  {!compact&&<form className="panel attention-controls" onSubmit={e=>{e.preventDefault();const p=nativeAttentionInput.safeParse({...query,asOfDate:date,offset:0});if(p.success)void load(p.data);else{clear();setError("Choose a valid comparison date.");}}}>
   <label>Compare dates against<input type="date" value={date} onChange={e=>{clear();setDate(e.target.value);setQuery(q=>({...q,asOfDate:e.target.value,offset:0}));}}/></label>
   <button className="button" type="submit">Apply date</button>
   <label>Saved-work source<select value={query.bundleKey??""} onChange={e=>choose({bundleKey:(e.target.value||null) as Query["bundleKey"]})}><option value="">All assigned sources</option>{bundles.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Priority<select value={query.priority??""} onChange={e=>choose({priority:(e.target.value||null) as Query["priority"]})}><option value="">All priorities</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select></label>
   <button className="button secondary" type="button" onClick={()=>void load({...query,offset:0})}>Refresh attention</button>
  </form>}
  {loading?<p role="status">Checking current saved work…</p>:null}
  {error?<div className="panel"><p role="alert">{error}</p><button className="button secondary" onClick={()=>void load({...query,offset:0})}>Retry attention</button></div>:null}
  {notice?<div className="panel"><p role="status">{notice}</p><button className="button secondary" onClick={()=>void load({...query,offset:0})}>Refresh attention</button></div>:null}
  {data&&<>{!compact&&<><div className="attention-overview">
   <div><span className="attention-number">{count(data.overallTotal)}</span><span>saved-work {data.overallTotal===1?"cue":"cues"}</span></div>
   <div><span className="attention-number">{count(high)}</span><span>high priority by saved status or date</span></div>
   <div><span className="attention-number">{data.coverage.length}</span><span>checked record/task scopes</span></div>
  </div><p className="muted">High priority means a saved block, high priority or past recorded date—not verified urgency. Other cues follow recorded dates and saved priorities.</p></>}
  {!compact&&<details className="panel attention-coverage"><summary>What was checked</summary><p>Only currently assigned saved-work metadata. Counts are cues, not unique projects or completed work. A parent record and its individual tasks can each need attention.</p>
   <ul>{data.coverage.map(s=><li key={s.capabilityId+s.level}>{attentionSources.find(p=>p.capabilityId===s.capabilityId)?.label} · {s.level==="task"?"individual tasks":"records"}: {count(s.total)}</li>)}</ul>
   <p>Private profiles, draft recovery, pending proposals, full source bodies, calendars, inboxes and live markets are not checked. An empty result is not an all-clear.</p>
  </details>}
  {!compact?<div className="attention-result-heading"><h2>{data.total?count(data.total)+(data.total===1?" matching cue":" matching cues"):data.coverage.length?"No cues match these filters":"No saved-work sources assigned yet"}</h2>
   <p className="muted">Date comparison: {data.asOfDate}. Checked {new Date(data.retrievedAt).toLocaleTimeString()}. This is a current read, not a historical snapshot.</p></div>:<p className="muted attention-compact-summary">{count(data.overallTotal)} saved-work cues · {count(high)} high priority by saved status or date. Not verified urgency or an all-clear.</p>}
  {data.total>0&&!items.length?<p className="panel" role="status">This page is now empty. Saved work may have changed; refresh attention from the first page.</p>:null}
  {!data.total?<div className="panel"><p>{!data.coverage.length?"Attention is ready. Assign a functional bundle to bring its saved work here.":"Try another priority or assigned source, or open the original workspace. No matching cues does not establish that everything is complete."}</p><Link href={experience.capabilityIds.includes("workspace.search")?"/workspace/search":"/workspace"}>Find your next useful step</Link></div>:null}
  {items.map(item=>{const source=attentionSources.find(s=>s.capabilityId===item.source.capabilityId)!;return <article className="panel attention-cue" data-priority={item.priority} key={item.id}>
   <p className="eyebrow">{source.bundleLabel} · {item.source.item?"Individual task":"Saved record"} · {item.priority} priority</p><h3>{item.title}</h3>
   {!compact&&item.parentTitle!==null&&<p className="muted">From {item.parentTitle} · Owner: {item.owner||"not recorded"}</p>}
   {!compact&&<p>{item.reason}</p>}{!compact&&item.nextAction&&<p><strong>Next move:</strong> {item.nextAction}</p>}
   <p className="muted">{item.dueDate?"Recorded date: "+item.dueDate:"No date recorded"}{item.dateState?" · Date certainty: "+item.dateState:""} · Revision {item.source.revision}</p>
   <details><summary>Why this appears</summary>{compact&&<><p>{item.reason}</p>{item.parentTitle&&<p>From {item.parentTitle} · Owner: {item.owner||"not recorded"}</p>}{item.nextAction&&<p>Next move: {item.nextAction}</p>}</>}<p>{item.evidence}</p><p className="muted">Saved state: {item.state}. Source updated {new Date(item.sourceUpdatedAt).toLocaleString()}{item.sourceReviewState?" · "+item.sourceReviewState:""}. This rule-based cue is not an independently verified conclusion.</p></details>
   <Link className="attention-source-link" href={attentionSourceRoute(item.source)}>{item.source.item?"Open exact task":"Open original record"} →</Link>
  </article>;})}
  {!compact&&<><div className="attention-pages"><button className="button secondary" disabled={query.offset===0} onClick={()=>void load({...query,offset:query.offset-25})}>Previous attention page</button>
   <p role="status">Showing {items.length?data.offset+1:0}–{data.offset+items.length} of {count(data.total)}</p>
   <button className="button secondary" disabled={query.offset>=2147483000||query.offset+25>=data.total} onClick={()=>void load({...query,offset:query.offset+25})}>Next attention page</button></div>
   <p className="muted">Every page rechecks access and current work. New saves may move cues between pages. Narrow source or priority to focus the review.</p></>}
  </>}
  {compact&&<><Link className="button secondary" href="/workspace/attention">Review all attention →</Link><p className="muted attention-compact-note">Native view only. No reminders sent or source records changed.</p></>}
 </section>;
}
export function WorkspaceAttentionWidget(){
 const {user,workspace,bundleExperience}=useWorkspace();
 return bundleExperience?<WorkspaceAttention key={user?.id+":"+workspace?.id+":"+bundleExperience.revision} experience={bundleExperience} compact/>:null;
}
