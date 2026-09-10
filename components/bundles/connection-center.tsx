"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {bundleConnectionGuidance} from "@/lib/bundles/experience";
import {MCP_CATALOG} from "@/lib/workspace/mcp-catalog";
import {getIntegrationProvider} from "@/lib/integrations/providers";
import {assistantStateLabels,connectionSnapshot,connectionReceipt,type ConnectionSnapshot,type ConnectionItem,type ConnectionReview,type ConnectionReceipt} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-connections";
import "./connection-center.css";
const name=(id:string)=>MCP_CATALOG.find(p=>p.id===id)?.name??({google:"Google",microsoft:"Microsoft",other:"AI assistant",wix:"Wix",public_markets:"Public market sources",public_authorities:"Public authority sources"}[id]??id.replaceAll("_"," "));
const time=(value:string|null)=>value?new Date(value).toLocaleString():"Not recorded";
const itemName=(item:ConnectionItem)=>item.kind==="assistant"?name(item.provider)+" · "+item.id.slice(0,8):name(item.family);
export function ConnectionCenter({workspaceId,bundleKeys}:{workspaceId:string;bundleKeys:string[]}){
 const [data,setData]=useState<ConnectionSnapshot|null>(null),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[receipt,setReceipt]=useState<ConnectionReceipt|null>(null);
 const [review,setReview]=useState<{item:ConnectionItem;input:ConnectionReview}|null>(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState<string|null>(null);
 const generation=useRef(0),controller=useRef<AbortController|null>(null),alive=useRef(true),reviewHeading=useRef<HTMLHeadingElement>(null),returnFocus=useRef<HTMLButtonElement|null>(null);
 function clear(){generation.current++;controller.current?.abort();setData(null);setReview(null);setError(null);setNotice(null);setReceipt(null);setSaveError(null);}
 async function request(path:string,init?:RequestInit){
  const {data:auth}=await getWorkspaceClient().auth.getSession();
  if(!auth.session)throw new Error("Sign in to manage your connections.");
  return fetch(path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+auth.session.access_token,"Content-Type":"application/json"}});
 }
 async function load(page=0){
  clear();setOffset(page);setLoading(true);const current=generation.current,abort=new AbortController();controller.current=abort;
  try{
   const response=await request("/api/bundles/connections?offset="+page,{signal:abort.signal}),raw=await response.json();
   if(!response.ok)throw new Error(raw.message||"Connection status unavailable.");
   const checked=connectionSnapshot.parse(raw);
   if(checked.workspaceId!==workspaceId||checked.offset!==page)throw new Error("Connection context changed. Refresh the page.");
   if(alive.current&&current===generation.current)setData(checked);
  }catch(e){if(alive.current&&current===generation.current)setError(e instanceof Error?e.message:"Connections unavailable.");}
  finally{if(alive.current&&current===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;void load();
  const away=()=>{if(document.visibilityState==="hidden"){clear();setLoading(false);setNotice("Connection status cleared while away. Refresh to check current access.");}};
  document.addEventListener("visibilitychange",away);
  // Invalidate the live generation so late responses cannot repopulate cleared status.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return()=>{alive.current=false;generation.current++;controller.current?.abort();document.removeEventListener("visibilitychange",away);};
  // Parent keys this view by verified account and workspace identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(review)reviewHeading.current?.focus();},[review]);
 function beginReview(item:ConnectionItem,button:HTMLButtonElement){
  returnFocus.current=button;setReceipt(null);setSaveError(null);
  setReview({item,input:{kind:item.kind,id:item.id,revision:item.revision,requestId:crypto.randomUUID(),confirmed:true}});
 }
 function cancel(){setReview(null);setSaveError(null);returnFocus.current?.focus();}
 async function disconnect(){
  if(!review||saving)return;
  setSaving(true);setSaveError(null);const current=generation.current,reviewed=review;
  try{
   const response=await request("/api/bundles/connections",{method:"POST",body:JSON.stringify(reviewed.input)}),raw=await response.json();
   if(!response.ok){
    if(response.status===409||response.status===403){if(alive.current&&current===generation.current){const refreshed=generation.current+1;await load();if(alive.current&&generation.current===refreshed)setError(raw.message);}return;}
    throw new Error("The disconnect outcome is not verified. Retry this same reviewed request, or cancel and refresh to check current access.");
   }
   const result=connectionReceipt.parse(raw);
   if(result.requestId!==reviewed.input.requestId||result.id!==reviewed.item.id||result.kind!==reviewed.item.kind)throw new Error("The response did not match your review. Refresh to check current access.");
   if(alive.current&&current===generation.current){const refreshed=generation.current+1;await load();if(alive.current&&generation.current===refreshed)setReceipt(result);}
  }catch(e){if(alive.current&&current===generation.current)setSaveError(e instanceof Error?e.message:"Disconnect outcome unverified. Retry this same review.");}
  finally{if(alive.current)setSaving(false);}
 }
 const guidance=bundleConnectionGuidance(bundleKeys);
 const externalCatalog=MCP_CATALOG.filter(p=>!["chatgpt","claude"].includes(p.id));
 return <section className="connection-center">
  <header><p className="eyebrow">Your access, clearly accounted for</p><h1 className="page-title">Connections</h1>
   <p className="page-lede">Know what has permission, what still needs setup, and what is available later.</p>
   <p className="muted">Your native bundles work without optional external accounts. This view checks saved access records, not live inboxes, provider health or installed-plugin quality.</p>
   <button className="button secondary" disabled={saving||loading} onClick={()=>void load()}>Refresh connections</button>
  </header>
  {loading&&<p role="status">Checking current connection records…</p>}
  {error&&<div className="panel"><p role="alert">{error}</p><button className="button" disabled={saving} onClick={()=>void load()}>Retry connections</button></div>}
  {notice&&<p role="status" className="panel">{notice}</p>}
  {receipt&&<div className="panel connection-receipt" role="status"><h2>Workspace disconnect confirmed</h2><p>{receipt.scope==="workspace_assistant_access"?"Workspace access for this assistant is disabled. Any active Workspace resource grant was revoked.":"Workspace access for this credential family is disabled. Its saved credentials and pending setup attempts have been cleared."}</p><p>Scope: {receipt.affectedProviders.map(name).join(", ")}. Saved bundle work is unchanged. This does not revoke the provider’s own grant or remove the connection from the assistant. Manage those in that service’s account settings.</p></div>}
  {review&&<section className="panel connection-review" aria-label="Review disconnect">
   <h2 ref={reviewHeading} tabIndex={-1}>Review disconnect</h2><p>{itemName(review.item)}</p>
   <p>{review.item.kind==="assistant"?"Revoke this assistant's Workspace access, including unfinished consent. An existing token will no longer authorize privileged Workspace calls.":"Remove this credential family and cancel its pending Workspace setup attempts."}</p>
   {review.item.kind==="external"&&<p><strong>Affects every shared-family connection:</strong> {review.item.providers.map(name).join(", ")}. Other credential families are unchanged.</p>}
   <p>Saved bundle work is unchanged. The provider’s own authorization is separate; remove that grant in its account settings if needed.</p>
   <div className="connection-actions"><button className="button" disabled={saving} onClick={()=>void disconnect()}>{saving?"Confirming…":saveError?"Retry same disconnect":"Confirm Workspace disconnect"}</button><button className="button secondary" disabled={saving} onClick={cancel}>Cancel disconnect</button></div>
   {saveError&&<p role="alert">{saveError}</p>}
  </section>}
  {data&&<>
   <div className="connection-metrics"><div><strong>{data.authorizedTotal}</strong><span>assistant registrations authorized</span></div><div><strong>{data.activeGrantTotal}</strong><span>active Workspace grants on file</span></div><div><strong>{data.external.length}</strong><span>saved external credential families</span></div></div>
   <p className="muted">Checked {time(data.retrievedAt)}. A grant may be blocked or unfinished; authorization alone does not prove that a tool works in your assistant.</p>
   <section aria-label="AI assistant access"><div className="connection-section-title"><h2>AI assistant access</h2>
    {data.assistantAccessIncluded&&data.assistantAdmissionEnabled&&<div className="connection-actions"><Link className="button secondary" href="/workspace/integrations/assistant?provider=chatgpt">Set up ChatGPT</Link><Link className="button secondary" href="/workspace/integrations/assistant?provider=claude">Set up Claude</Link></div>}
   </div>
   {(!data.assistantAccessIncluded||!data.assistantAdmissionEnabled)&&<p className="panel">New assistant access is not currently available for this Workspace. You can still review and disconnect saved access below.</p>}
   {!data.assistantTotal&&<div className="panel"><h3>No assistant access saved</h3><p>Use the bundles directly now. Connecting an assistant is optional and requires its own explicit consent.</p></div>}
   {data.assistants.map(item=><article className="panel connection-item" key={item.id}><div className="connection-item-heading"><h3>{itemName(item)}</h3><span className="connection-state" data-ready={item.state==="authorized"}>{assistantStateLabels[item.state]}</span></div>
    <p>{item.state==="authorized"?"Saved grant and registration allow Workspace access under the current plan. Individual requests still require valid tokens and authorized tools.":item.state==="setup_required"?"Consent exists, but no completed usable registration is recorded. Finish setup in the assistant, or revoke this unfinished access.":item.state==="blocked"?"A grant is on file, but registration, client status, current plan or the Workspace admission gate prevents access.":"A saved label is not evidence of current access. Reconnect through explicit consent if you want to use this assistant."}</p>
    <details><summary>Access evidence and limits</summary><p>Workspace grant: {item.grantActive?"active":"not active"}. Registered state: {item.registered?"recorded":"not recorded"}. Consent recorded: {time(item.authorizedAt)}. Last registration recorded: {time(item.registeredAt)}.</p><p>Granted identity scopes: {item.scopes.join(", ")||"none recorded"}. These scopes do not grant access to every bundle. Current capabilities and source-sharing permissions still apply. This is not a live token test or an installed-plugin acceptance test.</p><p className="muted">The assistant name comes from setup selection, not verified provider identity. The short reference distinguishes separate consent records.</p></details>
    {item.canDisconnect&&<button className="button secondary" disabled={saving} onClick={e=>beginReview(item,e.currentTarget)}>Review disconnect for {itemName(item)}</button>}
   </article>)}
   {data.assistantTotal>25&&<div className="connection-pages"><button className="button secondary" disabled={offset===0||saving} onClick={()=>void load(offset-25)}>Previous connections</button><p role="status">Showing {data.assistants.length?offset+1:0}–{offset+data.assistants.length} of {data.assistantTotal}</p><button className="button secondary" disabled={offset+25>=data.assistantTotal||offset>=2147483000||saving} onClick={()=>void load(offset+25)}>Next connections</button></div>}
   {data.assistantTotal>0&&!data.assistants.length&&<p>No records remain on this page. Refresh connections from the first page.</p>}
   </section>
   <section aria-label="Saved external access"><h2>Saved external access</h2><p className="muted">Credentials are never displayed here. A stored credential or past activity timestamp does not establish a successful live connection.</p>
    {!data.external.length&&<p className="panel">No external credentials or setup records saved. Nothing needs to be connected to start your native bundle work.</p>}
    {data.external.map(item=>{
     const released=item.providers.every(id=>getIntegrationProvider(id)?.consumerConnectionReady&&data.releasedProviders.includes(id));
     return <article className="panel connection-item" key={item.id}><div className="connection-item-heading"><h3>{name(item.family)}</h3><span className="connection-state">{released?"Adapter released · live status unverified":"Adapter not available here"}</span></div>
      <p>Saved credential: {item.credentialState==="recorded"?"present · not live-verified":item.credentialState}. Stored connection label: {item.metadataState.replaceAll("_"," ")}.</p>
      <p>Shared scope: {item.providers.map(name).join(", ")}.</p><details><summary>Saved credential evidence</summary><p>Last recorded activity: {time(item.lastRecordedAt)}. Recorded credential expiry: {time(item.expiresAt)}. No refresh attempt or provider check is performed here. Setup also requires current plan access and an implemented adapter.</p></details>
      {item.canDisconnect&&<button className="button secondary" disabled={saving} onClick={e=>beginReview(item,e.currentTarget)}>Review disconnect for {name(item.family)}</button>}
     </article>;
    })}
   </section>
   <section aria-label="Optional bundle connections"><h2>Optional connections for your bundles</h2><p>Native work is available independently. These catalog requirements describe future options, not connected accounts.</p>
    {!guidance.length&&<p className="panel">No optional provider requirements are listed for your currently composed bundles.</p>}
    {guidance.map(g=><article className="panel connection-guidance" key={g.key}><h3>{g.name}</h3>
     {g.providers.map(p=><div key={p.id}><h4>{name(p.provider)} · {p.authorization.required?"Optional integration · not available here":"Public-source workflow · no account connection required"}</h4><p>{p.dataBoundary}</p></div>)}
     {g.apps.map(a=><div key={a.id}><p><strong>{a.id.split(".").at(-1)?.replaceAll("_"," ")} · {a.status}</strong></p><p>{a.purpose}</p></div>)}
    </article>)}
   </section>
   <details className="panel connection-catalog"><summary>Other planned provider options</summary><p>These entries are product plans, not usable connections. No credentials are requested until an adapter is released and account access is verified.</p><ul>{externalCatalog.map(p=><li key={p.id}><strong>{p.name}</strong> — {p.detail}</li>)}</ul></details>
  </>}
 </section>;
}
