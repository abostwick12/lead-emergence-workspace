"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { createCapture, dismissCapture, listCaptures, listTasks, resolveCapture } from "@/lib/workspace/repository";
import { DOMAIN_LABELS, type CaptureRecord, type TaskRecord, type WorkspaceDomain } from "@/lib/workspace/types";

export default function CapturePage() {
  const { workspace, user, plan, capabilities } = useWorkspace();
  const [entries, setEntries] = useState<CaptureRecord[]>([]);
  const [rawText, setRawText] = useState("");
  const [domain, setDomain] = useState<WorkspaceDomain>("general");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ captureId: string; task: TaskRecord; alreadyProcessed: boolean } | null>(null);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  const workspaceId = workspace?.id;
  const storageKey = workspaceId && user ? `workspace:capture-to-task:${user.id}:${workspaceId}` : null;
  const reload = useCallback(async () => { if (workspaceId) setEntries(await listCaptures(workspaceId)); }, [workspaceId]);

  const rememberPending = useCallback((captureId: string | null) => {
    pending.current = captureId;
    setPendingId(captureId);
    try {
      if (storageKey) {
        if (captureId) sessionStorage.setItem(storageKey, captureId);
        else sessionStorage.removeItem(storageKey);
      }
    } catch { /* The server capture ID still protects retries when storage is unavailable. */ }
  }, [storageKey]);

  const checkStatus = useCallback(async (captureId: string) => {
    if (!workspaceId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const captures = await listCaptures(workspaceId);
      setEntries(captures);
      const capture = captures.find((entry) => entry.id === captureId);
      if (capture?.status === "processed" && capture.routed_task_id) {
        const task = (await listTasks(workspaceId)).find((entry) => entry.id === capture.routed_task_id && entry.workspace_id === workspaceId);
        if (task) {
          setConfirmed({ captureId, task, alreadyProcessed: true });
          setRecoveryMessage(null);
          rememberPending(null);
          return;
        }
      }
      setRecoveryMessage(capture?.status === "unprocessed"
        ? "This capture is still in your inbox. Retry this capture when you are ready; its content is unchanged."
        : "We couldn't confirm the linked task. Restore normal access and check this capture's status again.");
    } catch {
      setRecoveryMessage("We couldn't check this capture's status. Restore normal access, then check its status or retry this capture.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [workspaceId, rememberPending]);

  useEffect(() => {
    let captureId: string | null = null;
    try { if (storageKey) captureId = sessionStorage.getItem(storageKey); } catch { /* Recovery can still use the inbox when storage is unavailable. */ }
    pending.current = captureId;
    setPendingId(captureId);
    setConfirmed(null);
    if (captureId) {
      setRecoveryMessage("Checking your pending capture. No new task will be created while checking.");
      void checkStatus(captureId);
    } else {
      setRecoveryMessage(null);
      void reload().catch(() => setError("Could not load captures."));
    }
  }, [storageKey, checkStatus, reload]);

  async function capture(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !user || !rawText.trim()) return;
    try { await createCapture(workspace.id, user.id, rawText); setRawText(""); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save capture."); }
  }

  async function resolve(captureId: string) {
    if (!workspaceId || !user || inFlight.current || (pending.current && pending.current !== captureId)) return;
    const retrying = pending.current === captureId;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setConfirmed(null);
    rememberPending(captureId);
    setRecoveryMessage("Making this capture a task…");
    try {
      const result = await resolveCapture({ captureId, workspaceId, domain });
      if (result.status === "confirmed") {
        // Confirmation survives a subsequent inbox refresh failure.
        setConfirmed({ captureId, task: result.task, alreadyProcessed: result.alreadyProcessed });
        setRecoveryMessage(null);
        rememberPending(null);
        try { await reload(); } catch { setError("The task is confirmed, but the inbox could not refresh. Refresh the page to update the inbox."); }
      } else if (result.status === "rejected" && !retrying) {
        rememberPending(null);
        setRecoveryMessage(null);
        setError(result.message);
      } else {
        // A rejected retry does not establish the earlier uncertain attempt's result.
        setRecoveryMessage(result.status === "rejected" ? `${result.message} The earlier attempt is still unconfirmed; check its status.` : result.message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!capabilityEnabled(capabilities, "quick_capture", plan?.status)) return <CapabilityLockedState title="Quick Capture" benefit="Quick Capture keeps a signal until you decide what it means and what to do next." suspended={plan?.status === "suspended"} />;
  const inbox = entries.filter((entry) => entry.status === "unprocessed" && entry.id !== confirmed?.captureId);
  return <><p className="eyebrow workflow-kicker">Signals</p><h1 className="page-title">Quick capture</h1><p className="page-lede">Catch an idea now, then deliberately turn it into a task or discard it.</p>
    <section className="grid two"><article className="card"><h2>Capture thought</h2><form className="form-grid" onSubmit={capture}><label>What needs your attention?<textarea required value={rawText} onChange={(event) => setRawText(event.target.value)} /></label><button className="button">Save to inbox</button></form></article><article className="card"><h2>Resolution domain</h2><label>New tasks from this inbox<select value={domain} onChange={(event) => setDomain(event.target.value as WorkspaceDomain)}>{(Object.keys(DOMAIN_LABELS) as WorkspaceDomain[]).map((value) => <option value={value} key={value}>{DOMAIN_LABELS[value]}</option>)}</select></label><p className="muted">Choose where this next action belongs when you are ready to process it.</p></article></section>
    <section className="card" style={{ marginTop: 18 }}><h2>Inbox</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {confirmed ? <div role="status"><p>{confirmed.alreadyProcessed ? "This capture already became a task. Your current selection was not applied; the existing task is unchanged." : "Your capture became a task."}</p><p><Link href="/workspace/tasks">View task: {confirmed.task.title}</Link></p></div> : null}
      {pendingId ? <div role="status"><p>{recoveryMessage}</p><div className="row"><button className="button secondary" disabled={busy} onClick={() => void checkStatus(pendingId)}>Check status</button><button className="button" disabled={busy} onClick={() => void resolve(pendingId)}>Retry this capture</button></div></div> : null}
      {inbox.length ? inbox.map((entry) => <article className="item" key={entry.id}><p>{entry.raw_text}</p><div className="row"><span className="muted">Captured {new Date(entry.created_at).toLocaleDateString()}</span><div className="row"><button className="button" disabled={Boolean(pendingId) || confirmed?.task.id === entry.routed_task_id} onClick={() => void resolve(entry.id)}>Make task</button><button className="button secondary" disabled={pendingId === entry.id} onClick={() => void dismissCapture(entry.id).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not discard capture."))}>Discard</button></div></div></article>) : <p className="empty">Capture a signal before deciding what it means. Write the thought above; you can turn it into a task or discard it when you review the inbox.</p>}
    </section>
  </>;
}
