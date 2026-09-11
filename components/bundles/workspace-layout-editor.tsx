"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {layoutRecordSchema,type LayoutRecord} from "@/lib/bundles/layout";
import {emptyWorkspaceLayout,layoutIdentityFor,workspaceLayoutCatalog,type WorkspaceLayout} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
import {layoutProposalDecisionResult,layoutProposalList,type LayoutProposalRecord} from "@/vendor/lead-emergence-bundles/domain-contracts/layout-proposal";
type Catalog=ReturnType<typeof workspaceLayoutCatalog>;
type Payload={record:LayoutRecord;catalog:Catalog;proposals:ReturnType<typeof layoutProposalList.parse>};
export function WorkspaceLayoutEditor({workspaceId}:{workspaceId:string}){
 const {refreshBundleExperience}=useWorkspace();
 const [saved,setSaved]=useState<Payload|null>(null),[draft,setDraft]=useState<WorkspaceLayout|null>(null);
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const [preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false),[historyChoice,setHistoryChoice]=useState(""),[selectedProposalId,setSelectedProposalId]=useState<string|null>(null);
 const generation=useRef(0),alive=useRef(true),attempt=useRef<{key:string;id:string}|null>(null);
 async function call(method:"GET"):Promise<Payload>;
 async function call(method:"POST",body:unknown):Promise<{record:LayoutRecord}>;
 async function call(method:"GET"|"POST",body?:unknown){
  const {data}=await getWorkspaceClient().auth.getSession();
  if(!data.session)throw new Error("Sign in to manage your workspace layout.");
  const response=await fetch("/api/bundles/layout",{method,cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok)throw new Error(typeof result.message==="string"?result.message:"Layout unavailable. Retry or reload the saved layout.");
  const record=layoutRecordSchema.parse(result.record);
  if(record.workspaceId!==workspaceId)throw new Error("Workspace layout could not be verified.");
  if(method==="GET")return {...result,record,proposals:layoutProposalList.parse(result.proposals)} as Payload;
  return {record};
 }
 async function proposalDecision(body:unknown){
  const {data}=await getWorkspaceClient().auth.getSession();if(!data.session)throw new Error("Sign in to decide a workspace recommendation.");
  const response=await fetch("/api/bundles/layout/proposals/decision",{method:"POST",cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(typeof result.message==="string"?result.message:"The recommendation decision could not be verified.");
  return layoutProposalDecisionResult.parse(result);
 }
 async function load(){
  const request=++generation.current;setLoading(true);setError(null);
  try{const result=await call("GET");if(!alive.current||request!==generation.current)return;setSaved(result);setDraft(result.record.preferences);setPreview(false);setConfirmed(false);setHistoryChoice("");setSelectedProposalId(null);attempt.current=null;}
  catch(e){if(alive.current&&request===generation.current)setError(e instanceof Error?e.message:"Layout unavailable.");}
  finally{if(alive.current&&request===generation.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};
 // The parent is keyed to the verified user/workspace; reload is explicitly user-controlled.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function change(next:WorkspaceLayout){setDraft(next);setPreview(false);setConfirmed(false);setSelectedProposalId(null);setMessage(null);attempt.current=null;}
 async function save(){
  if(!saved||!draft||!confirmed||pending)return;
  setPending(true);setError(null);setMessage(null);
  const selected=saved.proposals.items.find(item=>item.proposalId===selectedProposalId);
  const exactProposal=selected&&JSON.stringify(selected.proposedPreferences)===JSON.stringify(draft)?selected:null;
  const key=JSON.stringify({draft,revision:saved.record.revision,authority:saved.record.authorityRevision,proposalId:exactProposal?.proposalId??null});
  if(attempt.current?.key!==key)attempt.current={key,id:crypto.randomUUID()};
  try{
   if(exactProposal)await proposalDecision({proposalId:exactProposal.proposalId,expectedProposalVersion:exactProposal.version,expectedLayoutRevision:saved.record.revision,expectedAuthorityRevision:saved.record.authorityRevision,requestId:attempt.current.id,decision:"accept",confirmed:true,note:"Accepted after reviewing the exact Workspace preview."});
   else await call("POST",{preferences:draft,expectedRevision:saved.record.revision,expectedAuthorityRevision:saved.record.authorityRevision,requestId:attempt.current.id,confirmed:true});
   if(!alive.current)return;
   await load();if(!alive.current)return;setMessage(exactProposal?"Recommendation accepted and saved. Your permissions and open work are unchanged.":"Layout saved. Your open work and permissions are unchanged.");refreshBundleExperience();
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:"Save could not be verified. Retry the same save or reload to check.");}
  finally{if(alive.current)setPending(false);}
 }
 async function reject(proposal:LayoutProposalRecord){
  if(!saved||pending)return;setPending(true);setError(null);setMessage(null);
  const key=JSON.stringify({proposalId:proposal.proposalId,version:proposal.version,revision:saved.record.revision,authority:saved.record.authorityRevision,decision:"reject"});
  if(attempt.current?.key!==key)attempt.current={key,id:crypto.randomUUID()};
  try{await proposalDecision({proposalId:proposal.proposalId,expectedProposalVersion:proposal.version,expectedLayoutRevision:saved.record.revision,expectedAuthorityRevision:saved.record.authorityRevision,requestId:attempt.current.id,decision:"reject",confirmed:true,note:"Rejected from Workspace layout review."});
   if(!alive.current)return;await load();if(alive.current)setMessage("Recommendation rejected. Your saved layout did not change.");}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:"The rejection could not be verified. Retry the same decision or reload.");}
  finally{if(alive.current)setPending(false);}
 }
 if(loading&&!saved)return <p role="status">Loading your saved layout…</p>;
 if(!saved||!draft)return <section className="panel"><h1>Workspace layout</h1><p role="alert">{error}</p><button className="button" onClick={()=>void load()}>Retry layout</button></section>;
 const catalog=saved.catalog,hidden=new Set(draft.hiddenItemIds);
 const active=new Set([...catalog.navigation,...catalog.widgets].map(layoutIdentityFor));
 const dormant=new Set([...draft.hiddenItemIds,...draft.pinnedNavigationIds,...draft.pinnedWidgetIds,...Object.keys(draft.orderOverrides)].filter(id=>!active.has(id))).size;
 const defaultItem=catalog.defaultWorkspaces.find(x=>x.route===draft.defaultWorkspaceRoute);
 const itemLabels=new Map([...catalog.navigation,...catalog.widgets].map(item=>[layoutIdentityFor(item),item.label]));
 const routeLabels=new Map(catalog.defaultWorkspaces.map(item=>[item.route,item.label]));
 const activeProposals=saved.proposals.items.filter(item=>item.status==="pending"||item.status==="stale"),decidedProposals=saved.proposals.items.filter(item=>item.status==="accepted"||item.status==="rejected");
 const operationLabel=(operation:LayoutProposalRecord["operations"][number])=>operation.kind==="set_default_workspace"?"Start in "+(routeLabels.get(operation.route)??operation.route):
  operation.kind==="set_visibility"?(operation.visible?"Show ":"Hide ")+(itemLabels.get(operation.itemId)??operation.itemId):
  operation.kind==="set_pin"?(operation.pinned?"Pin ":"Unpin ")+(itemLabels.get(operation.itemId)??operation.itemId):
  "Move "+(itemLabels.get(operation.itemId)??operation.itemId)+" to position "+operation.order;
 const proposalCard=(proposal:LayoutProposalRecord)=><article className="layout-proposal-card" key={proposal.proposalId} data-status={proposal.status} aria-label={"Layout recommendation: "+proposal.title}>
  <div className="layout-proposal-card-heading"><div><p className="pill">{proposal.goalSource==="user_stated"?"User-stated goal":"Inferred goal — review carefully"}</p><h3>{proposal.title}</h3></div><span>{proposal.status}</span></div>
  <p>{proposal.summary}</p><p className="muted"><strong>Goal:</strong> {proposal.goal}</p>
  <ul>{proposal.operations.map(operation=><li key={operation.kind+("itemId" in operation?operation.itemId:operation.route)}><strong>{operationLabel(operation)}</strong><span>{operation.reason}</span><small>Grounded in {operation.basis.map(value=>value.replaceAll("_"," ")).join(", ")}</small></li>)}</ul>
  {proposal.status==="stale"?<p role="status">Your layout or access changed after this was proposed. Reject it or ask for a fresh recommendation; it cannot be accepted.</p>:null}
  <div className="layout-actions">{proposal.status==="pending"?<button className="button" disabled={pending||loading} onClick={()=>{setDraft(proposal.proposedPreferences);setSelectedProposalId(proposal.proposalId);setPreview(true);setConfirmed(false);setMessage(null);attempt.current=null;}}>Preview this recommendation</button>:null}
   {proposal.status==="pending"||proposal.status==="stale"?<button className="button secondary" disabled={pending||loading} onClick={()=>void reject(proposal)}>Reject recommendation</button>:null}</div>
 </article>;
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
  <section className="panel layout-proposals" aria-label="Workspace layout recommendations"><div className="layout-proposal-heading"><div><p className="pill">Grounded recommendations</p><h2>Ideas waiting for your decision</h2></div><span>{activeProposals.length} open</span></div>
   <p className="muted">A recommendation can suggest only items included in your current access. It never changes the saved layout until you preview and confirm it here.</p>
   {!activeProposals.length?<div className="layout-proposal-empty"><strong>No layout recommendations are waiting.</strong><span>A connected assistant can prepare one from your enabled workspace choices and stated priorities.</span></div>:<div className="layout-proposal-list">{activeProposals.map(proposalCard)}</div>}
   {decidedProposals.length?<details className="layout-proposal-history"><summary>Recent decisions ({decidedProposals.length})</summary><div className="layout-proposal-list">{decidedProposals.map(proposalCard)}</div></details>:null}
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
   {preview?<div className="layout-preview" aria-label="Layout preview"><h2>{selectedProposalId?"Recommendation preview — not saved yet":"Preview — not saved yet"}</h2><p>Navigation: Home{ordered("navigation").filter(x=>!hidden.has(x.id)).map(x=>" → "+x.item.label).join("")}</p><p>Home attention cards: {ordered("widgets").filter(x=>!hidden.has(x.id)).map(x=>x.item.label).join(" → ")||"None shown"}</p><p>Starting workspace: {defaultItem?.label??"Home (saved choice unavailable)"}</p><label><input type="checkbox" disabled={pending} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this preview and confirm these layout changes.</label><button className="button" disabled={!confirmed||pending||loading} onClick={()=>void save()}>{pending?"Saving…":selectedProposalId?"Confirm and accept recommendation":"Confirm and save layout"}</button></div>:null}
   {error?<p className="error" role="alert">{error} Your draft remains here; discard and reload only when you are ready.</p>:null}
   {message?<p role="status">{message}</p>:null}
  </section>
 </div>;
}
