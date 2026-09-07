"use client";

import Link from "next/link";
import { useState } from "react";
import { getWorkspaceClient } from "@/lib/supabase/client";

export function BundleInviteClaim({ token }: { token: string }) {
  const [state, setState] = useState<"ready" | "claiming" | "claimed" | "error">(token ? "ready" : "error");
  const [message, setMessage] = useState(token ? "" : "This bundle invite is invalid or unavailable.");

  async function claim() {
    setState("claiming");
    setMessage("");
    try {
      const { data, error } = await getWorkspaceClient().auth.getSession();
      if (error || !data.session?.access_token) throw new Error("Sign in again before claiming this invite.");
      const response = await fetch("/api/bundles/invites/claim", {
        method: "POST",
        headers: { "Authorization": `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "This bundle invite is invalid or unavailable.");
      window.history.replaceState({}, "", "/workspace/bundles/invite");
      setState("claimed");
      setMessage("Your SOTF Bundle is active in this Workspace.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "This bundle invite is invalid or unavailable.");
    }
  }

  if (state === "claimed") return <div className="notice" role="status" style={{ marginTop: 20 }}>
    <p>{message}</p>
    <Link className="button" href="/workspace/sotf" style={{ marginTop: 14 }}>Open SOTF Bundle</Link>
  </div>;

  return <div className="card" style={{ marginTop: 20 }}>
    <h2>Activate this bundle</h2>
    <p className="page-lede">The invite must match your signed-in email and can be used only for your Personal Workspace.</p>
    <button className="button" type="button" disabled={!token || state === "claiming"} onClick={claim} style={{ marginTop: 14 }}>
      {state === "claiming" ? "Activating…" : "Activate SOTF Bundle"}
    </button>
    {message ? <p className="error" role="alert" style={{ marginTop: 14 }}>{message}</p> : null}
  </div>;
}
