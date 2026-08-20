"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { listIntegrationConnections } from "@/lib/workspace/repository";
import type { IntegrationConnection } from "@/lib/workspace/types";

const catalog = [
  ["google_calendar", "Google Calendar", "Schedule context and user-triggered event actions"],
  ["gmail", "Gmail", "Read/triage and draft-only workflow"],
  ["google_drive", "Google Drive", "Search, read, and organize permitted files"],
  ["slack", "Slack", "Explicit outbound briefing delivery"],
  ["firecrawl", "Firecrawl", "Manual curated briefing refresh"],
  ["monday", "Monday.com", "Approved one-way task import"],
  ["linkedin", "LinkedIn", "Drafting only; never post automatically"]
] as const;

export default function IntegrationsPage() {
  const { workspace } = useWorkspace(); const [connections, setConnections] = useState<IntegrationConnection[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (workspace) void listIntegrationConnections(workspace.id).then(setConnections).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load integrations.")); }, [workspace]);
  return <><h1 className="page-title">Integrations</h1><p className="page-lede">Connections are Workspace-specific. Tokens are never stored in exposed application tables.</p>{error ? <p className="error">{error}</p> : null}<section className="grid two">{catalog.map(([provider, label, description]) => { const connection = connections.find((item) => item.provider === provider); const status = connection?.status ?? "reconnect_required"; return <article className="card" key={provider}><div className="row"><h2>{label}</h2><span className={`pill ${status}`}>{status.replaceAll("_", " ")}</span></div><p className="muted">{description}</p><p className="notice">{connection ? "Connection metadata is present. Reconnection and secret handling are gated pending the approved private secret store." : "Reconnect required after cutover. No existing token has been copied."}</p></article>; })}</section></>;
}
