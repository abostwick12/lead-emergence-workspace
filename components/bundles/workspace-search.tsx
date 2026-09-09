"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {getWorkspaceClient} from "@/lib/supabase/client";
import {admittedSearchProviders,nativeSearchProviders,searchResultRoute,workspaceSearchCatalogSchema,workspaceSearchResultSchema,type WorkspaceSearchResult} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-discovery";
import {nativeQuickActions} from "@/lib/bundles/quick-actions";
import type {BaseBundleExperience} from "@/lib/bundles/experience";
type ProviderId=typeof nativeSearchProviders[number]["id"];
export function WorkspaceSearch({experience}:{experience:BaseBundleExperience}){
 const [catalog,setCatalog]=useState<ProviderId[]|null>(null),[selected,setSelected]=useState<ProviderId[]>([]);
 const [query,setQuery]=useState(""),[result,setResult]=useState<WorkspaceSearchResult|null>(null);
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const generation=useRef(0),request=useRef<AbortController|null>(null),alive=useRef(true);
 async function call(body?:unknown){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const {data}=await getWorkspaceClient().auth.getSession();
  if(controller.signal.aborted)throw new Error("Search cancelled.");
  if(!data.session)throw new Error("Sign in to search your saved work.");
  const response=await fetch("/api/bundles/search",{method:body?"POST":"GET",cache:"no-store",signal:controller.signal,headers:{Authorization:"Bearer "+data.session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await response.json();
  if(!response.ok)throw new Error(typeof payload.message==="string"?payload.message:"Search unavailable.");
  return payload;
 }
 function clear(message?:string){++generation.current;request.current?.abort();setResult(null);setPending(false);setError(null);setNotice(message??null);}
 async function loadCatalog(){
  clear();const id=generation.current;setLoading(true);setCatalog(null);
  try{
   const parsed=workspaceSearchCatalogSchema.parse(await call());
   if(!alive.current||id!==generation.current)return;
   const expected=admittedSearchProviders(experience.capabilityIds).map(p=>p.id).sort();
   if(parsed.workspaceId!==experience.workspaceId || parsed.authorityRevision!==experience.revision || JSON.stringify([...parsed.providerIds].sort())!==JSON.stringify(expected))
    throw new Error("Your access changed. Refresh this page to verify search scopes.");
   setCatalog(parsed.providerIds);setSelected(parsed.providerIds);
  }catch(e){if(alive.current&&id===generation.current)setError(e instanceof Error?e.message:"Search scopes unavailable.");}
  finally{if(alive.current&&id===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;void loadCatalog();
  const away=()=>{if(document.visibilityState==="hidden"){clear("Results cleared while away. Search again for current results.");setLoading(false);}};
  document.addEventListener("visibilitychange",away);
  // Increment the request generation on disposal, not a captured render value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return()=>{alive.current=false;++generation.current;request.current?.abort();document.removeEventListener("visibilitychange",away);};
 // Parent remounts immediately on verified identity, workspace or authority change.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function search(offset=0){
  const normalized=query.trim();if(pending||normalized.length<2||normalized.length>200||!selected.length)return;
  clear();const id=generation.current;setPending(true);
  try{
   const parsed=workspaceSearchResultSchema.parse(await call({query:normalized,providerIds:selected,authorityRevision:experience.revision,offset}));
   if(!alive.current||id!==generation.current)return;
   if(parsed.workspaceId!==experience.workspaceId||parsed.authorityRevision!==experience.revision||parsed.query!==normalized||parsed.offset!==offset
    ||JSON.stringify(parsed.coverage.map(c=>c.providerId).sort())!==JSON.stringify([...selected].sort()))
    throw new Error("Search scope could not be verified. Reload scopes and try again.");
   setResult(parsed);
  }catch(e){if(alive.current&&id===generation.current)setError(e instanceof Error?e.message:"Search unavailable. Please retry.");}
  finally{if(alive.current&&id===generation.current)setPending(false);}
 }
 const scopes=nativeSearchProviders.filter(p=>catalog?.includes(p.id)),actions=nativeQuickActions(experience);
 return <div className="saved-search">
  <header><p className="pill">Find it. Pick up where you left off.</p><h1 className="page-title">Search your saved work</h1><p className="page-lede">One search across the work you choose, with a clear path back to every original.</p></header>
  <section className="panel search-disclosure"><p>This is your native Workspace search, not an assistant sharing permission. Only your currently assigned, selected scopes are searched.</p><p className="muted">Saved records only. Excludes private profiles, unsaved recovery drafts, pending proposals, earlier versions, provider accounts and general Workspace tasks. Writing requires both library and resource-reading access. Search text is not saved in your URL or a search history.</p></section>
  {loading?<p role="status">Checking search scopes…</p>:null}
  {!loading&&!catalog&&!error?<button className="button" onClick={()=>void loadCatalog()}>Reload search scopes</button>:null}
  {!loading&&catalog?.length===0?<section className="panel"><h2>No searchable bundles assigned yet</h2><p>Your Workspace Experience access is ready. Search will become useful when a saved-work bundle is assigned. Nothing has been connected or shared.</p><Link href="/workspace">Return to Home</Link></section>:null}
  {scopes.length>0?<form className="panel form-grid" onSubmit={e=>{e.preventDefault();void search();}}>
   <label htmlFor="saved-work-query">Find saved work<input id="saved-work-query" type="search" autoComplete="off" maxLength={200} value={query} placeholder="A title, phrase, company or topic" onChange={e=>{clear();setQuery(e.target.value);}} aria-describedby="search-method"/></label>
   <p id="search-method" className="muted">Use 2–200 characters. Matches saved words and phrases; exact titles appear first. This is not semantic search or a verification of recorded claims.</p>
   <details className="search-scope"><summary>Search scope · {selected.length} of {scopes.length} selected</summary>
    <div className="search-scope-controls"><button type="button" className="button secondary" onClick={()=>{clear();setSelected(catalog??[]);}}>Select all scopes</button><button type="button" className="button secondary" onClick={()=>{clear();setSelected([]);}}>Clear scopes</button></div>
    <div className="search-scope-grid">{[...new Set(scopes.map(p=>p.bundleKey))].map(bundle=><fieldset key={bundle}><legend>{scopes.find(p=>p.bundleKey===bundle)?.bundleLabel}</legend>{scopes.filter(p=>p.bundleKey===bundle).map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>{clear();setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id));}}/>{p.label}</label>)}</fieldset>)}</div>
   </details>
   <div className="layout-actions"><button className="button" disabled={pending||query.trim().length<2||!selected.length}>{pending?"Searching…":"Search saved work"}</button><button type="button" className="button secondary" onClick={()=>void loadCatalog()}>Reload search scopes</button></div>
   {!selected.length?<p role="status">Choose at least one scope to search.</p>:null}
  </form>:null}
  {error?<section className="panel"><p role="alert">{error}</p>{!catalog?<button className="button" onClick={()=>void loadCatalog()}>Retry search scopes</button>:null}</section>:null}
  {notice?<p role="status">{notice}</p>:null}
  {pending?<p role="status">Searching selected saved work. No partial results are shown.</p>:null}
  {result?<section className="search-results" aria-label="Saved work results">
   <div className="panel"><h2>{result.matchingCount===0?"No matches in the selected scopes":result.matchingCount+" saved records found"}</h2><p role="status">{result.matchingCount>0?"Showing "+(result.offset+1)+"–"+(result.offset+result.results.length)+". ":""}Searched {result.coverage.length} scopes at {new Date(result.retrievedAt).toLocaleTimeString()}.</p>
    <p className="muted">Results are current reads, not a frozen snapshot. New saves can change page order. Narrow your scope or query if there are too many matches.</p>
    <details><summary>What was searched</summary><ul>{result.coverage.map(c=>{const p=nativeSearchProviders.find(p=>p.id===c.providerId)!;return <li key={c.providerId}>{p.bundleLabel} · {p.label}: {c.matchingCount}</li>;})}</ul></details>
    {!result.matchingCount?<p>Try a shorter phrase, a recorded title, or another assigned scope. No results does not mean your other work is missing.</p>:null}
   </div>
   {result.results.map(r=>{const p=nativeSearchProviders.find(p=>p.id===r.providerId)!;return <article className="panel search-result" key={r.providerId+":"+r.id}>
    <p className="eyebrow">{p.bundleLabel} · {p.label}</p><h3><Link href={searchResultRoute(r.providerId,r.id)}>{r.title}</Link></h3>
    <p className="search-snippet">{r.snippet}</p><p className="muted">{r.matchReason==="exact_title"?"Exact title":r.matchReason==="title_contains"?"Title contains your phrase":"Saved text match"} · Version {r.revision} · Updated {new Date(r.updatedAt).toLocaleDateString()}</p>
    <Link href={searchResultRoute(r.providerId,r.id)}>Open original record →</Link>
   </article>;})}
   <div className="layout-actions"><button className="button secondary" disabled={pending||result.offset===0} onClick={()=>void search(result.offset-25)}>Previous results</button><button className="button secondary" disabled={pending||result.offset+25>=result.matchingCount||result.offset>=10000} onClick={()=>void search(result.offset+25)}>Next results</button></div>
   {result.matchingCount>10025?<p className="muted">The first 10,025 matches are pageable. Narrow your search to reach a more specific result.</p>:null}
  </section>:!pending&&!error&&catalog&&catalog.length>0?<section className="panel"><h2>Your next useful result starts here</h2><p>Search for a title you remember or a topic you need. Every result shows where it came from and opens the saved original.</p></section>:null}
  {actions.length>0?<section className="panel"><h2>Quick actions</h2><p className="muted">Open the right workflow. Nothing is saved, sent or published by these shortcuts.</p><div className="search-action-grid">{actions.map(a=><Link className="search-action" key={a.id} href={a.route}><strong>{a.label}</strong><span>{a.description}</span></Link>)}</div></section>:null}
 </div>;
}
