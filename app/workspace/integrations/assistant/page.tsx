"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clipboard, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { listMcpAuthorizations, prepareAssistantConnection } from "@/lib/workspace/repository";
import type { AssistantProvider, McpAuthorizationRecord } from "@/lib/workspace/types";

export default function AssistantConnectionPage() {
  const { user, workspace, plan, capabilities, refreshProductState } = useWorkspace();
  const [assistant, setAssistant] = useState<AssistantProvider>("chatgpt");
  const [connections, setConnections] = useState<McpAuthorizationRecord[]>([]);
  const [mcpUrl, setMcpUrl] = useState("https://workspace.leademergence.com/api/mcp");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = capabilityEnabled(capabilities, "workspace_mcp", plan?.status);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAssistant(params.get("provider") === "claude" ? "claude" : "chatgpt");
    setMcpUrl(new URL("/api/mcp", window.location.origin).toString());
  }, []);

  useEffect(() => {
    if (!workspace || !user || !enabled) return;
    void prepareAssistantConnection({ workspaceId: workspace.id, userId: user.id, assistant })
      .then(() => Promise.all([listMcpAuthorizations(workspace.id), refreshProductState()]))
      .then(([records]) => setConnections(records))
      .catch(() => setError("Workspace could not prepare this assistant connection."));
  }, [workspace, user, assistant, enabled, refreshProductState]);

  async function refresh() {
    if (!workspace) return;
    setPending(true); setError(null);
    try {
      const records = await listMcpAuthorizations(workspace.id);
      setConnections(records);
      if (!records.some((record) => record.assistant_provider === assistant && record.status === "connected")) setError("No active connection was found yet. Complete consent in your assistant, then try again.");
    } catch { setError("Connection status is temporarily unavailable."); }
    finally { setPending(false); }
  }

  const connected = connections.some((record) => record.assistant_provider === assistant && record.status === "connected");
  const name = assistant === "chatgpt" ? "ChatGPT" : "Claude";
  if (!enabled) return <CapabilityLockedState title="AI assistant connection" benefit="An AI assistant connection lets you use controlled Workspace tools from ChatGPT or Claude." suspended={plan?.status === "suspended"} />;

  return <section className="workflow-page"><p className="eyebrow workflow-kicker">Connections / AI assistant</p><h1 className="page-title">Connect {name}</h1><p className="page-lede">Use {name} as an authorized interface to the same Personal Workspace configuration, tasks, commitments, and captures.</p>
    <div className="assistant-connect-grid"><article className="card"><div className="connection-status" data-connected={connected}><span />{connected ? "Connected" : "Connection required"}</div><ol className="connection-steps"><li><strong>Copy the Workspace connection address.</strong><div className="copy-field"><code>{mcpUrl}</code><button className="icon-button" aria-label="Copy Workspace connection address" onClick={() => { void navigator.clipboard.writeText(mcpUrl); setCopied(true); }}><Clipboard size={16} /></button></div>{copied ? <small className="success-copy"><Check size={13} /> Copied</small> : null}</li>{assistant === "chatgpt" ? <li><strong>In ChatGPT, open Apps &amp; Connectors.</strong> Enable developer mode, create a connection, and paste the address.</li> : <li><strong>In Claude, open Connectors.</strong> Choose Add custom connector and paste the address.</li>}<li><strong>Approve the Lead Emergence consent screen.</strong> The connection becomes usable only after explicit authorization.</li></ol><div className="setup-inline-actions"><a className="button" href={assistant === "chatgpt" ? "https://chatgpt.com" : "https://claude.ai/new"} target="_blank" rel="noreferrer">Open {name} <ExternalLink size={15} /></a><button className="button secondary" disabled={pending} onClick={() => void refresh()}><RefreshCw size={15} />Refresh status</button></div></article><aside className="card"><ShieldCheck size={22} color="var(--success)" /><h2>Controlled access</h2><p className="page-lede">The assistant sees only what authorized tools return. Important interpretation remains suggestive until you confirm it. Disconnecting in Settings disables privileged calls even if an old access token has not yet expired.</p><Link className="button secondary" href="/workspace/settings#assistant">Manage assistant access</Link></aside></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </section>;
}
