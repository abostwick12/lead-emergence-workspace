"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [canDefer, setCanDefer] = useState(false);
  const [discardMessage, setDiscardMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ captureId: string; task: TaskRecord; alreadyProcessed: boolean } | null>(null);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  const validationRejected = useRef<string | null>(null);
  const settledIds = useRef(new Map<string, Set<string>>());
  const workspaceId = workspace?.id;
  const storageKey = workspaceId && user ? `workspace:capture-to-task:${user.id}:${workspaceId}` : null;
  const scope = useMemo(() => ({ key: storageKey }), [storageKey]);
  const activeScope = useRef<typeof scope | null>(scope);
  const reload = useCallback(async () => {
    if (!workspaceId || !storageKey) return;
    const captures = await listCaptures(workspaceId);
    if (activeScope.current === scope) {
      setEntries(captures.filter((entry) => !settledIds.current.get(storageKey)?.has(entry.id)));
    }
  }, [workspaceId, storageKey, scope]);

  const rememberPending = useCallback((captureId: string | null) => {
    if (activeScope.current !== scope) return;
    pending.current = captureId;
    setPendingId(captureId);
    try {
      if (storageKey) {
        if (captureId) sessionStorage.setItem(storageKey, captureId);
        else sessionStorage.removeItem(storageKey);
      }
    } catch { /* The server capture ID still protects retries when storage is unavailable. */ }
  }, [storageKey, scope]);

  const checkStatus = useCallback(async (captureId: string) => {
    if (!workspaceId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setCanDefer(false);
    try {
      const [capture] = await listCaptures(workspaceId, captureId);
      if (activeScope.current !== scope) return;
      if (capture) setEntries((current) => [...current.filter((entry) => entry.id !== captureId), capture].filter((entry) => !settledIds.current.get(storageKey!)?.has(entry.id)));
      if (capture?.status === "processed" && capture.routed_task_id) {
        const [task] = await listTasks(workspaceId, capture.routed_task_id);
        if (activeScope.current !== scope) return;
        if (task) {
          const ids = settledIds.current.get(storageKey!) ?? new Set<string>();
          ids.add(captureId);
          settledIds.current.set(storageKey!, ids);
          setEntries((current) => current.filter((entry) => entry.id !== captureId));
          setConfirmed({ captureId, task, alreadyProcessed: true });
          setRecoveryMessage(null);
          rememberPending(null);
          try { await reload(); } catch { if (activeScope.current === scope) setError("The task is confirmed, but the inbox could not refresh. Refresh the page to update the inbox."); }
          return;
        }
      }
      setCanDefer(capture?.status === "unprocessed" && validationRejected.current === captureId);
      setRecoveryMessage(capture?.status === "unprocessed"
        ? "This capture is still in your inbox. Retry this capture when you are ready; its content is unchanged."
        : "We couldn't confirm the linked task. Restore normal access and check this capture's status again.");
      try { await reload(); } catch { /* Exact status remains authoritative if the inbox cannot refresh. */ }
    } catch {
      if (activeScope.current === scope) setRecoveryMessage("We couldn't check this capture's status. Restore normal access, then check its status or retry this capture.");
    } finally {
      if (activeScope.current === scope) { inFlight.current = false; setBusy(false); }
    }
  }, [workspaceId, storageKey, scope, rememberPending, reload]);

  useEffect(() => {
    activeScope.current = scope;
    inFlight.current = false;
    setBusy(false);
    let captureId: string | null = null;
    try { if (storageKey) captureId = sessionStorage.getItem(storageKey); } catch { /* Recovery can still use the inbox when storage is unavailable. */ }
    pending.current = captureId;
    setPendingId(captureId);
    setConfirmed(null);
    setEntries([]);
    setError(null);
    setDiscardMessage(null);
    setCanDefer(false);
    validationRejected.current = null;
    if (captureId) {
      setRecoveryMessage("Checking your pending capture. No new task will be created while checking.");
      void checkStatus(captureId);
    } else {
      setRecoveryMessage(null);
      void reload().catch(() => { if (activeScope.current === scope) setError("Could not load captures."); });
    }
    return () => { if (activeScope.current === scope) activeScope.current = null; };
  }, [storageKey, scope, checkStatus, reload]);

  async function capture(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !user || !rawText.trim()) return;
    try { await createCapture(workspace.id, user.id, rawText); if (activeScope.current !== scope) return; setRawText(""); await reload(); }
    catch (caught) { if (activeScope.current === scope) setError(caught instanceof Error ? caught.message : "Could not save capture."); }
  }

  async function resolve(captureId: string) {
    if (!workspaceId || !user || inFlight.current || (pending.current && pending.current !== captureId)) return;
    const retrying = pending.current === captureId;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDiscardMessage(null);
    setCanDefer(false);
    validationRejected.current = null;
    setConfirmed(null);
    rememberPending(captureId);
    setRecoveryMessage("Making this capture a task…");
    try {
      const result = await resolveCapture({ captureId, workspaceId, domain });
      if (activeScope.current !== scope) return;
      if (result.status === "confirmed") {
        // Confirmation survives a subsequent inbox refresh failure.
        const ids = settledIds.current.get(storageKey!) ?? new Set<string>();
        ids.add(captureId);
        settledIds.current.set(storageKey!, ids);
        setEntries((current) => current.filter((entry) => entry.id !== captureId));
        setConfirmed({ captureId, task: result.task, alreadyProcessed: result.alreadyProcessed });
        setRecoveryMessage(null);
        rememberPending(null);
        try { await reload(); } catch { if (activeScope.current === scope) setError("The task is confirmed, but the inbox could not refresh. Refresh the page to update the inbox."); }
      } else if (result.status === "rejected" && !retrying) {
        rememberPending(null);
        setRecoveryMessage(null);
        setError(result.message);
      } else {
        // A rejected retry does not establish the earlier uncertain attempt's result.
        setRecoveryMessage(result.status === "rejected" ? `${result.message} The earlier attempt is still unconfirmed; check its status.` : result.message);
        if (result.status === "rejected" && result.reason === "validation") {
          validationRejected.current = captureId;
          try {
            const [capture] = await listCaptures(workspaceId, captureId);
            if (activeScope.current === scope && capture?.status === "unprocessed") {
              setCanDefer(true);
              setRecoveryMessage(`${result.message} The status check found this capture still in your inbox. You can leave it here and return to the inbox.`);
            }
          } catch { /* Keep the earlier uncertainty until a reliable status check. */ }
        }
      }
    } finally {
      if (activeScope.current === scope) { inFlight.current = false; setBusy(false); }
    }
  }

  async function discard(captureId: string) {
    if (!workspaceId || inFlight.current || pending.current === captureId) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDiscardMessage(null);
    try {
      const current = await dismissCapture(workspaceId, captureId);
      if (activeScope.current !== scope) return;
      if (current?.status === "discarded" || current?.status === "processed") {
        // A late inbox response cannot restore a capture whose terminal state is known.
        const ids = settledIds.current.get(storageKey!) ?? new Set<string>();
        ids.add(captureId);
        settledIds.current.set(storageKey!, ids);
        setEntries((entries) => entries.filter((entry) => entry.id !== captureId));
        setDiscardMessage(current.status === "discarded" ? "This capture is discarded." : "This capture already became a task and was not discarded.");
      } else setError("This capture could not be discarded. Its current state is unavailable; refresh the inbox and check again.");
    } catch (caught) {
      if (activeScope.current === scope) setError(caught instanceof Error ? caught.message : "Could not discard capture.");
    } finally {
      if (activeScope.current === scope) { inFlight.current = false; setBusy(false); }
    }
  }

  if (!capabilityEnabled(capabilities, "quick_capture", plan?.status)) return <CapabilityLockedState title="Quick Capture" benefit="Quick Capture keeps a signal until you decide what it means and what to do next." suspended={plan?.status === "suspended"} />;
  const inbox = entries.filter((entry) => entry.status === "unprocessed" && entry.id !== confirmed?.captureId);
  return <><p className="eyebrow workflow-kicker">Signals</p><h1 className="page-title">Quick capture</h1><p className="page-lede">Catch an idea now, then deliberately turn it into a task or discard it.</p>
    <section className="grid two"><article className="card"><h2>Capture thought</h2><form className="form-grid" onSubmit={capture}><label>What needs your attention?<textarea required value={rawText} onChange={(event) => setRawText(event.target.value)} /></label><button className="button">Save to inbox</button></form></article><article className="card"><h2>Resolution domain</h2><label>New tasks from this inbox<select value={domain} onChange={(event) => setDomain(event.target.value as WorkspaceDomain)}>{(Object.keys(DOMAIN_LABELS) as WorkspaceDomain[]).map((value) => <option value={value} key={value}>{DOMAIN_LABELS[value]}</option>)}</select></label><p className="muted">Choose where this next action belongs when you are ready to process it.</p></article></section>
    <section className="card" style={{ marginTop: 18 }}><h2>Inbox</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {discardMessage ? <p role="status">{discardMessage}</p> : null}
      {confirmed ? <div role="status"><p>{confirmed.alreadyProcessed ? "This capture already became a task. Your current selection was not applied; the existing task is unchanged." : "Your capture became a task."}</p><p>Confirmed task: {confirmed.task.title}</p><p><Link href="/workspace/tasks">Open task board</Link></p></div> : null}
      {pendingId ? <div role="status"><p>{recoveryMessage}</p><div className="row"><button className="button secondary" disabled={busy} onClick={() => void checkStatus(pendingId)}>Check status</button><button className="button" disabled={busy} onClick={() => void resolve(pendingId)}>Retry this capture</button>{canDefer ? <button className="button secondary" disabled={busy} onClick={() => { rememberPending(null); setCanDefer(false); setRecoveryMessage(null); void reload().catch(() => { if (activeScope.current === scope) setError("Could not load captures."); }); }}>Return to inbox</button> : null}</div></div> : null}
      {inbox.length ? inbox.map((entry) => <article className="item" key={entry.id}><p>{entry.raw_text}</p><div className="row"><span className="muted">Captured {new Date(entry.created_at).toLocaleDateString()}</span><div className="row"><button className="button" disabled={busy || Boolean(pendingId)} onClick={() => void resolve(entry.id)}>Make task</button><button className="button secondary" disabled={busy || pendingId === entry.id} onClick={() => void discard(entry.id)}>Discard</button></div></div></article>) : <p className="empty">Capture a signal before deciding what it means. Write the thought above; you can turn it into a task or discard it when you review the inbox.</p>}
    </section>
  </>;
}
