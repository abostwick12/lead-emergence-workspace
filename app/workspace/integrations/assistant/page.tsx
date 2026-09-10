"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {capabilityEnabled} from "@/lib/workspace/capabilities";
import {prepareAssistantConnection} from "@/lib/workspace/repository";
import type {AssistantProvider} from "@/lib/workspace/types";
export default function AssistantConnectionPage(){
 const {user,workspace,plan,capabilities,refreshProductState}=useWorkspace();
 const [assistant,setAssistant]=useState<AssistantProvider>("chatgpt"),[address,setAddress]=useState("");
 const [copied,setCopied]=useState(false),[pending,setPending]=useState(false),[prepared,setPrepared]=useState(false),[error,setError]=useState<string|null>(null);
 const enabled=capabilityEnabled(capabilities,"workspace_mcp",plan?.status);
 useEffect(()=>{setAssistant(new URLSearchParams(window.location.search).get("provider")==="claude"?"claude":"chatgpt");setAddress(new URL("/api/mcp",window.location.origin).toString());},[]);
 async function prepare(){
  if(!user||!workspace||!enabled||pending)return;setPending(true);setError(null);
  try{await prepareAssistantConnection({workspaceId:workspace.id,userId:user.id,assistant});await refreshProductState();setPrepared(true);}
  catch{setError("Setup could not be prepared. No assistant authorization has been confirmed.");}finally{setPending(false);}
 }
 async function copy(){setCopied(false);setError(null);try{await navigator.clipboard.writeText(address);setCopied(true);}catch{setError("Copy was not available. Select and copy the address manually.");}}
 const name=assistant==="chatgpt"?"ChatGPT":"Claude";
 return <section className="workflow-page">
  <Link href="/workspace/integrations">← Connection center</Link>
  <p className="eyebrow">Optional AI assistant access</p><h1 className="page-title">Set up {name}</h1>
  <p className="page-lede">Preparation saves your assistant choice. It does not connect an account, approve consent or prove that tools work.</p>
  <article className="panel" style={{padding:"1.25rem"}}>
   {!enabled?<p>New assistant setup is unavailable under the current plan. You can still inspect and disconnect saved access in the connection center.</p>:<>
    <h2>1. Prepare your choice</h2><p>Save {name} as the assistant you intend to connect. Nothing is saved merely by opening this page.</p>
    <button className="button" disabled={pending||prepared} onClick={()=>void prepare()}>{pending?"Preparing…":prepared?"Choice saved":"Prepare "+name+" setup"}</button>
    {prepared&&<p role="status">Your setup choice is saved. Authorization is still required in the assistant.</p>}
    <h2>2. Add the connection in your assistant</h2>
    <p>Workspace connection address:</p><div className="copy-field"><code style={{overflowWrap:"anywhere",whiteSpace:"normal"}}>{address}</code><button className="button secondary" disabled={!address} onClick={()=>void copy()}>Copy connection address</button></div>
    {copied&&<p role="status">Address copied</p>}
    {assistant==="chatgpt"?<p>In ChatGPT, enable Developer Mode in Settings → Security and login. Open Plugins, use the plus button to add a connection, and review the discovered tools. Use your approved public HTTPS address or Secure MCP Tunnel for development. <a href="https://developers.openai.com/plugins/deploy/connect-chatgpt" target="_blank" rel="noreferrer">Official connection and testing guide</a>.</p>:<p>Use Claude’s supported custom-connection flow to add this address, then review the requested permissions in its consent screen. Availability depends on your assistant account.</p>}
    <p>A localhost address is for this development environment and is not a public release endpoint. Approve only the expected Workspace consent screen and permissions.</p>
    <a className="button secondary" href={assistant==="chatgpt"?"https://chatgpt.com":"https://claude.ai/new"} target="_blank" rel="noreferrer">Open {name}</a>
   </>}
  </article>
  <article className="panel" style={{padding:"1.25rem"}}><h2>3. Verify permission and useful work separately</h2>
   <p>Return to the connection center to check current grants and registration. Then test a permitted read and a preview-before-confirmation workflow in the installed assistant. A saved authorization alone does not establish client readiness.</p>
   <p>Current plan, bundle assignments and explicit source-sharing permissions limit each tool. External accounts are not made available by connecting an assistant. After tool changes, refresh discovery and start a new conversation.</p>
   <Link className="button" href="/workspace/integrations">Check access in connection center</Link>
  </article>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
