"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {layoutRecordSchema,type LayoutRecord} from "@/lib/bundles/layout";
import {emptyWorkspaceLayout,layoutIdentityFor,workspaceLayoutCatalog,type WorkspaceLayout} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
type Catalog=ReturnType<typeof workspaceLayoutCatalog>;
type Payload={record:LayoutRecord;catalog:Catalog};
export function WorkspaceLayoutEditor({workspaceId}:{workspaceId:string}){
 const {refreshBundleExperience}=useWorkspace();
 const [saved,setSaved]=useState<Payload|null>(null),[draft,setDraft]=useState<WorkspaceLayout|null>(null);
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const [preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false),[historyChoice,setHistoryChoice]=useState("");
 const generation=useRef(0),alive=useRef(true),attempt=useRef<{key:string;id:string}|null>(null);
 async function call(method:"GET"|"POST",body?:unknown){
  const {data}=await getWorkspaceClient().auth.getSession();
  if(!data.session)throw new Error("Sign in to manage your workspace layout.");
  const response=await fetch("/api/bundles/layout",{method,cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok)throw new Error(typeof result.message==="string"?result.message:"Layout unavailable. Retry or reload the saved layout.");
  const record=layoutRecordSchema.parse(result.record);
  if(record.workspaceId!==workspaceId)throw new Error("Workspace layout could not be verified.");
  return {...result,record} as Payload;
 }
 async function load(){
  const request=++generation.current;setLoading(true);setError(null);
  try{const result=await call("GET");if(!alive.current||request!==generation.current)return;setSaved(result);setDraft(result.record.preferences);setPreview(false);setConfirmed(false);setHistoryChoice("");attempt.current=null;}
  catch(e){if(alive.current&&request===generation.current)setError(e instanceof Error?e.message:"Layout unavailable.");}
  finally{if(alive.current&&request===generation.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};
 // The parent is keyed to the verified user/workspace; reload is explicitly user-controlled.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function change(next:WorkspaceLayout){setDraft(next);setPreview(false);setConfirmed(false);setMessage(null);attempt.current=null;}
 async function save(){
  if(!saved||!draft||!confirmed||pending)return;
  setPending(true);setError(null);setMessage(null);
  const key=JSON.stringify({draft,revision:saved.record.revision,authority:saved.record.authorityRevision});
  if(attempt.current?.key!==key)attempt.current={key,id:crypto.randomUUID()};
  try{
   const result=await call("POST",{preferences:draft,expectedRevision:saved.record.revision,expectedAuthorityRevision:saved.record.authorityRevision,requestId:attempt.current.id,confirmed:true});
   if(!alive.current)return;
   setSaved({...saved,record:result.record});setDraft(result.record.preferences);setPreview(false);setConfirmed(false);attempt.current=null;
   setMessage("Layout saved. Your open work and permissions are unchanged.");refreshBundleExperience();
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:"Save could not be verified. Retry the same save or reload to check.");}
  finally{if(alive.current)setPending(false);}
 }
 if(loading&&!saved)return <p role="status">Loading your saved layout…</p>;
 if(!saved||!draft)return <section className="panel"><h1>Workspace layout</h1><p role="alert">{error}</p><button className="button" onClick={()=>void load()}>Retry layout</button></section>;
 const catalog=saved.catalog,hidden=new Set(draft.hiddenItemIds);
 const active=new Set([...catalog.navigation,...catalog.widgets].map(layoutIdentityFor));
 const dormant=new Set([...draft.hiddenItemIds,...draft.pinnedNavigationIds,...draft.pinnedWidgetIds,...Object.keys(draft.orderOverrides)].filter(id=>!active.has(id))).size;
 const defaultItem=catalog.defaultWorkspaces.find(x=>x.route===draft.defaultWorkspaceRoute);
 const ordered=(kind:"navigation"|"widgets")=>catalog[kind].map((item,index)=>({item,index,id:layoutIdentityFor(item)})).sort((a,b)=>{
  const pins=kind==="navigation"?draft.pinnedNavigationIds:draft.pinnedWidgetIds;
  return Number(pins.includes(b.id))-Number(pins.includes(a.id))||(draft.orderOverrides[a.id]??a.index*10)-(draft.orderOverrides[b.id]??b.index*10)||a.index-b.index;
 });
 function move(kind:"navigation"|"widgets",id:string,direction:number){
  const items=ordered(kind),index=items.findIndex(x=>x.id===id),other=index+direction;
  if(other<0||other>=items.length)return;
  const pins=kind==="navigation"?draft!.pinnedNavigationIds:draft!.pinnedWidgetIds;
  if(pins.includes(id)!==pins.includes(items[other].id))return;
  [items[index],items[other]]=[items[other],items[index]];
  change({...draft!,orderOverrides:{...draft!.orderOverrides,...Object.fromEntries(items.map((x,i)=>[x.id,i*10]))}});
 }
 function group(kind:"navigation"|"widgets",title:string){
  const items=ordered(kind),pins=kind==="navigation"?draft!.pinnedNavigationIds:draft!.pinnedWidgetIds,pinKey=kind==="navigation"?"pinnedNavigationIds":"pinnedWidgetIds";
  return <fieldset className="layout-group" disabled={pending||loading}><legend>{title}</legend>{!items.length?<p className="muted">No assigned contributions in this section yet.</p>:items.map(({item,id},index)=><div className="layout-row" key={id}>
   <strong>{item.label}</strong><div className="layout-row-controls">
    <label><input type="checkbox" aria-label={"Show "+item.label} checked={!hidden.has(id)} onChange={e=>change({...draft!,hiddenItemIds:e.target.checked?draft!.hiddenItemIds.filter(x=>x!==id):[...draft!.hiddenItemIds,id],pinnedNavigationIds:draft!.pinnedNavigationIds.filter(x=>x!==id),pinnedWidgetIds:draft!.pinnedWidgetIds.filter(x=>x!==id)})}/>Show</label>
    <label><input type="checkbox" aria-label={"Pin "+item.label} checked={pins.includes(id)} onChange={e=>change({...draft!,[pinKey]:e.target.checked?[...pins,id]:pins.filter(x=>x!==id),hiddenItemIds:draft!.hiddenItemIds.filter(x=>x!==id)})}/>Pin</label>
    <button className="button secondary" aria-label={"Move "+item.label+" up"} disabled={index===0||pins.includes(id)!==pins.includes(items[index-1]?.id)} onClick={()=>move(kind,id,-1)}>↑</button>
    <button className="button secondary" aria-label={"Move "+item.label+" down"} disabled={index===items.length-1||pins.includes(id)!==pins.includes(items[index+1]?.id)} onClick={()=>move(kind,id,1)}>↓</button>
   </div>
  </div>)}</fieldset>;
 }
 return <div className="layout-editor">
  <header><p className="pill">Your workspace, your choice</p><h1 className="page-title">Workspace layout</h1><p className="page-lede">Keep the work you reach for close. Preview every change before it becomes your saved layout.</p></header>
  <section className="panel"><p>Hiding a link or card does not delete work, change permissions, stop notifications, or share information. Home, Settings and this page remain available.</p><p className="muted">Saved version {saved.record.revision}. Pins appear first; use the arrows to order items within each group.</p>
   {dormant>0?<p role="status">{dormant} saved choices are unavailable under your current access. They are retained without exposing unavailable bundle details.</p>:null}
   {!defaultItem?<p role="status">Your saved starting workspace is unavailable. Home will open until access returns or you confirm another choice.</p>:null}
  </section>
  {group("navigation","Navigation")}{group("widgets","Home attention cards")}
  <section className="panel form-grid"><label>Starting workspace<select disabled={pending||loading} value={defaultItem?draft.defaultWorkspaceRoute:"unavailable"} onChange={e=>change({...draft,defaultWorkspaceRoute:e.target.value})}>
   {!defaultItem?<option value="unavailable" disabled>Saved choice unavailable — opens Home</option>:null}
   {catalog.defaultWorkspaces.map(x=><option key={x.route} value={x.route}>{x.label}</option>)}
  </select></label><p className="muted">Used after sign-in without a specific destination. Home and direct links still open where you expect.</p></section>
  <section className="panel form-grid"><h2>Recover a layout</h2><label>Earlier saved version<select disabled={pending||loading} value={historyChoice} onChange={e=>setHistoryChoice(e.target.value)}><option value="">Choose a version</option>
   {saved.record.history.map(x=><option key={x.revision} value={x.revision}>Version {x.revision} · {new Date(x.savedAt).toLocaleString()}</option>)}
  </select></label><div className="layout-actions"><button className="button secondary" disabled={!historyChoice||pending||loading} onClick={()=>{const previous=saved.record.history.find(x=>x.revision===Number(historyChoice));if(previous)change(previous.preferences);}}>Load version as draft</button><button className="button secondary" disabled={pending||loading} onClick={()=>change(emptyWorkspaceLayout())}>Restore default layout as draft</button></div><p className="muted">Recovery never changes your layout until you preview and confirm. The latest 20 saved versions are available here.</p></section>
  <section className="panel"><div className="layout-actions"><button className="button" disabled={pending||loading} onClick={()=>{setPreview(true);setConfirmed(false);}}>Preview layout</button><button className="button secondary" disabled={pending||loading} onClick={()=>{setMessage(null);void load();}}>Discard draft and reload saved layout</button><Link className="button secondary" href="/workspace">Go to Home</Link></div>
   {preview?<div className="layout-preview" aria-label="Layout preview"><h2>Preview — not saved yet</h2><p>Navigation: Home{ordered("navigation").filter(x=>!hidden.has(x.id)).map(x=>" → "+x.item.label).join("")}</p><p>Home attention cards: {ordered("widgets").filter(x=>!hidden.has(x.id)).map(x=>x.item.label).join(" → ")||"None shown"}</p><p>Starting workspace: {defaultItem?.label??"Home (saved choice unavailable)"}</p><label><input type="checkbox" disabled={pending} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this preview and confirm these layout changes.</label><button className="button" disabled={!confirmed||pending||loading} onClick={()=>void save()}>{pending?"Saving…":"Confirm and save layout"}</button></div>:null}
   {error?<p className="error" role="alert">{error} Your draft remains here; discard and reload only when you are ready.</p>:null}
   {message?<p role="status">{message}</p>:null}
  </section>
 </div>;
}
