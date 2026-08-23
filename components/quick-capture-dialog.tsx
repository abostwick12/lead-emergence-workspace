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
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => field.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

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

  return <div className="capture-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="capture-dialog-header"><div><p className="eyebrow">Quick capture</p><h2 id="quick-capture-title">What needs your attention?</h2></div><button className="icon-button" aria-label="Close quick capture" onClick={onClose}><X size={18} /></button></div>
      {enabled ? <form className="form-grid" onSubmit={submit}>
        <label className="sr-only" htmlFor="quick-capture-text">Capture text</label>
        <textarea id="quick-capture-text" ref={field} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Capture an idea, commitment, or follow-up…" required />
        {error ? <p className="error">{error}</p> : null}
        <div className="capture-dialog-actions"><p className="muted">Saved privately to this Workspace inbox.</p><button className="button" disabled={saving}>{saving ? "Saving…" : <>Save capture <ArrowRight size={15} /></>}</button></div>
      </form> : <p className="notice">Quick Capture is unavailable for the current plan. Existing captures remain private and retained.</p>}
    </section>
  </div>;
}
