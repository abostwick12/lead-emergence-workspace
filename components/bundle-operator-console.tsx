"use client";

import { useState, type FormEvent } from "react";
import { getWorkspaceClient } from "@/lib/supabase/client";

type OperatorResult = { kind: "success" | "error"; message: string; inviteUrl?: string } | null;

function newRequestKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function accessToken() {
  const { data, error } = await getWorkspaceClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again before managing bundle access.");
  return data.session.access_token;
}

export function BundleOperatorConsole() {
  const [assignmentKey, setAssignmentKey] = useState(() => newRequestKey("assignment"));
  const [inviteKey, setInviteKey] = useState(() => newRequestKey("invite"));
  const [assignmentResult, setAssignmentResult] = useState<OperatorResult>(null);
  const [inviteResult, setInviteResult] = useState<OperatorResult>(null);
  const [submitting, setSubmitting] = useState<"assignment" | "invite" | null>(null);

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting("assignment");
    setAssignmentResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/operator/bundles/assign", {
        method: "POST",
        headers: { "Authorization": `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: form.get("workspaceId"),
          bundleKey: "sotf_transition",
          idempotencyKey: assignmentKey,
          expiresAt: null
        })
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not assign this bundle.");
      setAssignmentResult({ kind: "success", message: "SOTF Bundle access is active. Repeating this request is safe." });
      setAssignmentKey(newRequestKey("assignment"));
    } catch (error) {
      setAssignmentResult({ kind: "error", message: error instanceof Error ? error.message : "Could not assign this bundle." });
    } finally {
      setSubmitting(null);
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting("invite");
    setInviteResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/operator/bundles/invites", {
        method: "POST",
        headers: { "Authorization": `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: form.get("recipientEmail"),
          bundleKey: "sotf_transition",
          idempotencyKey: inviteKey,
          expiresAt: null
        })
      });
      const payload = await response.json() as { message?: string; inviteUrl?: string };
      if (!response.ok || !payload.inviteUrl) throw new Error(payload.message || "Could not issue this invite.");
      setInviteResult({ kind: "success", message: "Invite issued. Share this single-use link with the intended pilot user.", inviteUrl: payload.inviteUrl });
      setInviteKey(newRequestKey("invite"));
    } catch (error) {
      setInviteResult({ kind: "error", message: error instanceof Error ? error.message : "Could not issue this invite." });
    } finally {
      setSubmitting(null);
    }
  }

  return <div className="grid two" style={{ marginTop: 20 }}>
    <form className="card" onSubmit={submitAssignment}>
      <p className="eyebrow">Founder assignment</p>
      <h2>Grant an existing Workspace</h2>
      <p className="page-lede">Use the Personal Workspace ID. The active owner receives the canonical SOTF Bundle entitlement.</p>
      <label style={{ display: "grid", gap: 6, marginTop: 16 }}>
        <span>Workspace ID</span>
        <input name="workspaceId" type="text" required pattern="[0-9a-fA-F-]{36}" autoComplete="off" />
      </label>
      <button className="button" type="submit" disabled={submitting !== null} style={{ marginTop: 16 }}>
        {submitting === "assignment" ? "Granting…" : "Grant SOTF Bundle"}
      </button>
      {assignmentResult ? <p className={assignmentResult.kind === "error" ? "error" : "notice"} role="status" style={{ marginTop: 14 }}>{assignmentResult.message}</p> : null}
    </form>

    <form className="card" onSubmit={submitInvite}>
      <p className="eyebrow">Pilot invite</p>
      <h2>Invite an intended user</h2>
      <p className="page-lede">The link expires in seven days and can be claimed only by the matching signed-in email.</p>
      <label style={{ display: "grid", gap: 6, marginTop: 16 }}>
        <span>Email</span>
        <input name="recipientEmail" type="email" required autoComplete="email" />
      </label>
      <button className="button" type="submit" disabled={submitting !== null} style={{ marginTop: 16 }}>
        {submitting === "invite" ? "Issuing…" : "Issue SOTF Bundle invite"}
      </button>
      {inviteResult ? <div className={inviteResult.kind === "error" ? "error" : "notice"} role="status" style={{ marginTop: 14 }}>
        <p>{inviteResult.message}</p>
        {inviteResult.inviteUrl ? <p style={{ overflowWrap: "anywhere", marginTop: 8 }}><a href={inviteResult.inviteUrl}>{inviteResult.inviteUrl}</a></p> : null}
      </div> : null}
    </form>
  </div>;
}
