"use client";

import { useEffect, useState } from "react";

type ConfirmationPreview = {
  confirmation_request_id: string;
  status: "pending" | "completed" | "denied" | "stale" | "expired" | "revoked";
  action: string;
  requested_at: string;
  expires_at: string;
  operation?: Record<string, unknown>;
  reviewed_state?: Record<string, unknown>;
  editable_fields?: string[];
  result?: Record<string, unknown>;
};

type LoadResult = { confirmation: ConfirmationPreview; csrfToken: string };

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function ProfessionalContextConfirmation({ confirmationId }: { confirmationId: string }) {
  const [confirmation, setConfirmation] = useState<ConfirmationPreview | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [correctedLabel, setCorrectedLabel] = useState("");
  const [correctedSummary, setCorrectedSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"confirm" | "deny" | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/workspace/professional-context/confirmations/${confirmationId}`, {
      credentials: "same-origin",
      cache: "no-store",
    }).then(async (response) => {
      const result = await response.json() as LoadResult & { message?: string };
      if (!response.ok) throw new Error(result.message || "Could not load this confirmation.");
      if (!active) return;
      setConfirmation(result.confirmation);
      setCsrfToken(result.csrfToken);
      setCorrectedLabel(String(result.confirmation.operation?.corrected_label || ""));
      setCorrectedSummary(String(result.confirmation.operation?.corrected_summary || ""));
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load this confirmation.");
    });
    return () => { active = false; };
  }, [confirmationId]);

  async function submit(action: "confirm" | "deny") {
    if (!confirmation || submitting) return;
    setError(null);
    setSubmitting(action);
    try {
      const editable = confirmation.action === "correct";
      const response = await fetch(`/api/workspace/professional-context/confirmations/${confirmationId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          csrfToken,
          correctedLabel: editable ? correctedLabel || null : null,
          correctedSummary: editable ? correctedSummary || null : null,
        }),
      });
      const result = await response.json() as { confirmation?: ConfirmationPreview; message?: string };
      if (!response.ok || !result.confirmation) throw new Error(result.message || "Could not complete this review.");
      setConfirmation(result.confirmation);
      setCsrfToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete this review.");
    } finally {
      setSubmitting(null);
    }
  }

  if (error && !confirmation) return <div className="card"><p className="error" role="alert">{error}</p></div>;
  if (!confirmation) return <div className="card"><p className="muted">Loading the canonical Workspace operation…</p></div>;

  const pending = confirmation.status === "pending";
  return <div className="card confirmation-review">
    <div className="row">
      <div><p className="eyebrow">Request status</p><h2>{confirmation.action.replaceAll("_", " ")}</h2></div>
      <span className={`pill ${confirmation.status}`}>{confirmation.status}</span>
    </div>
    {pending ? <>
      <p className="notice">Confirm executes this exact database-derived operation immediately. Deny leaves Professional Context unchanged.</p>
      <section>
        <h3>Canonical operation</h3>
        <pre className="confirmation-json">{pretty(confirmation.operation)}</pre>
      </section>
      <section>
        <h3>State reviewed</h3>
        <pre className="confirmation-json">{pretty(confirmation.reviewed_state)}</pre>
      </section>
      {confirmation.action === "correct" ? <div className="form-grid">
        <label>Corrected label<input value={correctedLabel} maxLength={240} onChange={(event) => setCorrectedLabel(event.target.value)} /></label>
        <label>Corrected summary<textarea value={correctedSummary} maxLength={5000} onChange={(event) => setCorrectedSummary(event.target.value)} /></label>
      </div> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="confirmation-actions">
        <button className="button" disabled={Boolean(submitting)} onClick={() => void submit("confirm")}>{submitting === "confirm" ? "Confirming…" : "Confirm and execute"}</button>
        <button className="button secondary" disabled={Boolean(submitting)} onClick={() => void submit("deny")}>{submitting === "deny" ? "Denying…" : "Deny request"}</button>
      </div>
      <p className="muted">Expires {new Date(confirmation.expires_at).toLocaleString()}.</p>
    </> : <div className="notice">
      <strong>This request is {confirmation.status}.</strong>
      <p>{confirmation.status === "stale" ? "Lewis must create a new request so you can review current state." : "No further action is available for this request."}</p>
      {confirmation.result ? <pre className="confirmation-json">{pretty(confirmation.result)}</pre> : null}
    </div>}
  </div>;
}
