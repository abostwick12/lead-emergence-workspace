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
      if (!records.some((record) => record.assistant_provider === assistant && record.status === "connected")) setError("No active authorization was found yet. Complete consent in your assistant, then try again.");
    } catch { setError("Connection status is temporarily unavailable."); }
    finally { setPending(false); }
  }

  const authorization = connections.find((record) => record.assistant_provider === assistant && record.status === "connected");
  const authorized = Boolean(authorization);
  const name = assistant === "chatgpt" ? "ChatGPT" : "Claude";
  if (!enabled) return <CapabilityLockedState title="AI assistant connection" benefit="An AI assistant connection lets you use controlled Workspace tools from ChatGPT or Claude." suspended={plan?.status === "suspended"} />;

  return <section className="workflow-page">
    <p className="eyebrow workflow-kicker">Connections / AI assistant</p>
    <h1 className="page-title">Connect {name}</h1>
    <p className="page-lede">Authorize {name} to use the Lewis tools that are currently available for your Workspace. Authorization and tool availability are reported separately.</p>
    <div className="assistant-connect-grid">
      <article className="card">
        <div className="connection-status" data-connected={authorized}><span />{authorized ? "Authorization active" : "Authorization required"}</div>
        <p className="muted">Authorization confirms consent and account access. After a Lewis update, refresh this connection and start a new chat so your assistant discovers the current tool list.</p>
        <ol className="connection-steps">
          <li><strong>Copy the Workspace connection address.</strong><div className="copy-field"><code>{mcpUrl}</code><button className="icon-button" aria-label="Copy Workspace connection address" onClick={() => { void navigator.clipboard.writeText(mcpUrl); setCopied(true); }}><Clipboard size={16} /></button></div>{copied ? <small className="success-copy"><Check size={13} /> Copied</small> : null}</li>
          {assistant === "chatgpt" ? <li><strong>In ChatGPT, open Apps &amp; Connectors.</strong> Enable developer mode, create a connection, and paste the address.</li> : <li><strong>In Claude, open Connectors.</strong> Choose Add custom connector and paste the address.</li>}
          <li><strong>Approve the Lewis consent screen.</strong> The connection becomes usable only after explicit authorization.</li>
        </ol>
        <div className="setup-inline-actions"><a className="button" href={assistant === "chatgpt" ? "https://chatgpt.com" : "https://claude.ai/new"} target="_blank" rel="noreferrer">Open {name} <ExternalLink size={15} /></a><button className="button secondary" disabled={pending} onClick={() => void refresh()}><RefreshCw size={15} />Refresh authorization</button></div>
      </article>
      <aside className="card"><ShieldCheck size={22} color="var(--success)" /><h2>Controlled access</h2><p className="page-lede">Lewis can read and manage approved Workspace records, including tasks, captures, personal memory, career opportunities, and confirmed setup. Destructive changes require explicit confirmation. External accounts are not yet available to Lewis.</p><p className="muted">The assistant sees only what authorized tools return. Disconnecting in Settings disables privileged calls even if an old access token has not yet expired.</p><Link className="button secondary" href="/workspace/settings#assistant">Manage assistant access</Link></aside>
    </div>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </section>;
}
