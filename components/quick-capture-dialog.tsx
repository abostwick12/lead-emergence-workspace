"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { createCapture } from "@/lib/workspace/repository";

type QuickCaptureDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickCaptureDialog({ open, onClose }: QuickCaptureDialogProps) {
  const { workspace, user, plan, capabilities } = useWorkspace();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    if (!modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.showModal();
    field.current?.focus();
    return () => {
      modal.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  const enabled = capabilityEnabled(capabilities, "quick_capture", plan?.status);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || !enabled || !rawText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCapture(workspace.id, user.id, rawText);
      setRawText("");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the capture.");
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} className="capture-dialog-backdrop" aria-labelledby="quick-capture-title" aria-modal="true"
    style={{ margin: 0, width: "100%", maxWidth: "none", height: "100%", maxHeight: "none", border: 0, color: "inherit" }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) { event.preventDefault(); onClose(); } }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <section className="capture-dialog">
      <div className="capture-dialog-header"><div><p className="eyebrow">Quick capture</p><h2 id="quick-capture-title">What needs your attention?</h2></div><button className="icon-button" aria-label="Close quick capture" onClick={onClose}><X size={18} /></button></div>
      {enabled ? <form className="form-grid" onSubmit={submit}>
        <label className="sr-only" htmlFor="quick-capture-text">Capture text</label>
        <textarea id="quick-capture-text" ref={field} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Capture an idea, commitment, or follow-up…" required />
        {error ? <p className="error">{error}</p> : null}
        <div className="capture-dialog-actions"><p className="muted">Saved privately to this Workspace inbox.</p><button className="button" disabled={saving}>{saving ? "Saving…" : <>Save capture <ArrowRight size={15} /></>}</button></div>
      </form> : <p className="notice">Quick Capture is unavailable for the current plan. Existing captures remain private and retained.</p>}
    </section>
  </dialog>;
}
