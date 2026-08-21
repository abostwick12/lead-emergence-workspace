"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { createCapture, dismissCapture, listCaptures, resolveCapture } from "@/lib/workspace/repository";
import { DOMAIN_LABELS, type CaptureRecord, type WorkspaceDomain } from "@/lib/workspace/types";

export default function CapturePage() {
  const { workspace, user } = useWorkspace();
  const [entries, setEntries] = useState<CaptureRecord[]>([]); const [rawText, setRawText] = useState("");
  const [domain, setDomain] = useState<WorkspaceDomain>("general"); const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { if (workspace) setEntries(await listCaptures(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load captures.")); }, [reload]);
  async function capture(event: FormEvent) { event.preventDefault(); if (!workspace || !user || !rawText.trim()) return; try { await createCapture(workspace.id, user.id, rawText); setRawText(""); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save capture."); } }
  async function resolve(entry: CaptureRecord) { if (!workspace || !user) return; try { await resolveCapture({ captureId: entry.id, workspaceId: workspace.id, userId: user.id, rawText: entry.raw_text, domain }); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not resolve capture."); } }
  return <><p className="eyebrow workflow-kicker">Signals</p><h1 className="page-title">Quick capture</h1><p className="page-lede">Catch an idea now, then deliberately turn it into a task or discard it.</p>
    <section className="grid two"><article className="card"><h2>Capture thought</h2><form className="form-grid" onSubmit={capture}><label>What needs your attention?<textarea required value={rawText} onChange={(event) => setRawText(event.target.value)} /></label><button className="button">Save to inbox</button></form></article><article className="card"><h2>Resolution domain</h2><label>New tasks from this inbox<select value={domain} onChange={(event) => setDomain(event.target.value as WorkspaceDomain)}>{(Object.keys(DOMAIN_LABELS) as WorkspaceDomain[]).map((value) => <option value={value} key={value}>{DOMAIN_LABELS[value]}</option>)}</select></label><p className="muted">Choose where this next action belongs when you are ready to process it.</p></article></section>
    <section className="card" style={{ marginTop: 18 }}><h2>Inbox</h2>{error ? <p className="error">{error}</p> : null}{entries.filter((entry) => entry.status === "unprocessed").length ? entries.filter((entry) => entry.status === "unprocessed").map((entry) => <article className="item" key={entry.id}><p>{entry.raw_text}</p><div className="row"><span className="muted">Captured {new Date(entry.created_at).toLocaleDateString()}</span><div className="row"><button className="button" onClick={() => void resolve(entry)}>Make task</button><button className="button secondary" onClick={() => void dismissCapture(entry.id).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not discard capture."))}>Discard</button></div></div></article>) : <p className="empty">Your inbox is clear.</p>}</section>
  </>;
}
