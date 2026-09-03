"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  assistantConnectionLabel,
  type ProfessionalContextAssistantConnection,
  type ProfessionalContextPrivacyScope,
  type ProfessionalContextReadGrant,
} from "@/lib/workspace/professional-context-read-grants";

type GrantState = {
  connections: ProfessionalContextAssistantConnection[];
  grants: ProfessionalContextReadGrant[];
  csrfToken: string;
};

type GrantStateResponse = Partial<GrantState> & { message?: string };

const endpoint = "/api/workspace/professional-context/read-grants";

const scopeDetails: Record<ProfessionalContextPrivacyScope, {
  title: string;
  duration: string;
  enableLabel: string;
  renewLabel: string;
  revokeLabel: string;
}> = {
  private: {
    title: "Private access",
    duration: "10 minutes",
    enableLabel: "Enable Private Access",
    renewLabel: "Renew Private Access",
    revokeLabel: "Revoke Private Access",
  },
  sensitive: {
    title: "Sensitive access",
    duration: "5 minutes",
    enableLabel: "Enable Sensitive Access",
    renewLabel: "Renew Sensitive Access",
    revokeLabel: "Revoke Sensitive Access",
  },
};

export function ProfessionalContextReadGrants() {
  const [state, setState] = useState<GrantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await response.json() as GrantStateResponse;
      if (!response.ok || !result.connections || !result.grants || !result.csrfToken) {
        throw new Error(result.message || "Could not load protected-read access.");
      }
      setState(result as GrantState);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load protected-read access.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!state?.grants.length) return;
    const nextExpiration = Math.min(...state.grants.map((grant) => Date.parse(grant.expires_at)));
    const delay = Math.max(0, nextExpiration - Date.now()) + 100;
    const timer = window.setTimeout(() => void load(), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [state?.grants, load]);

  async function mutate(body: Record<string, unknown>, pendingKey: string) {
    if (!state?.csrfToken || pending) return;
    setPending(pendingKey);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, csrfToken: state.csrfToken }),
      });
      const result = await response.json() as GrantStateResponse;
      if (!response.ok || !result.connections || !result.grants || !result.csrfToken) {
        throw new Error(result.message || "Could not change protected-read access.");
      }
      setState(result as GrantState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change protected-read access.");
    } finally {
      setPending(null);
    }
  }

  if (!state && !error) return <div className="card"><p className="muted">Loading protected-read access…</p></div>;
  if (!state) return <div className="card"><p className="error" role="alert">{error}</p><button className="button secondary" onClick={() => void load()}>Try again</button></div>;

  return <div className="protected-read-stack">
    <div className="row protected-read-toolbar">
      <p className="muted">Status comes from the Workspace authorization service and refreshes when a grant expires.</p>
      <button className="button secondary" disabled={Boolean(pending)} onClick={() => void load()}><RefreshCw size={15} />Refresh status</button>
    </div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {!state.connections.length ? <div className="card">
      <h2>No connected assistant</h2>
      <p className="page-lede">Connect ChatGPT or Claude before granting temporary protected-read access.</p>
      <Link className="button secondary" href="/workspace/integrations#assistants">Review assistant connections</Link>
    </div> : state.connections.map((connection) => <section className="card protected-read-connection" key={connection.id}>
      <div className="row">
        <div><p className="eyebrow">Connected assistant</p><h2>{assistantConnectionLabel(connection)}</h2><p className="protected-read-client-id"><code>{connection.clientId}</code></p></div>
        <span className="pill connected">connected</span>
      </div>
      <p className="muted">These grants authorize temporary reads for this specific connection only. They never authorize Lewis to change Professional Context.</p>
      <div className="protected-read-grid">
        <GrantPanel connection={connection} scope="private" grants={state.grants} pending={pending} mutate={mutate} />
        <GrantPanel connection={connection} scope="sensitive" grants={state.grants} pending={pending} mutate={mutate} />
      </div>
    </section>)}
    <aside className="notice protected-read-storage-warning">
      <ShieldAlert size={18} aria-hidden="true" />
      <span>Do not store or submit classified, CUI, or operationally sensitive material as Professional Context. Temporary read grants do not change that boundary or create an end-to-end non-retention guarantee.</span>
    </aside>
  </div>;
}

function GrantPanel({
  connection,
  scope,
  grants,
  pending,
  mutate,
}: {
  connection: ProfessionalContextAssistantConnection;
  scope: ProfessionalContextPrivacyScope;
  grants: ProfessionalContextReadGrant[];
  pending: string | null;
  mutate: (body: Record<string, unknown>, pendingKey: string) => Promise<void>;
}) {
  const details = scopeDetails[scope];
  const grant = grants.find((candidate) =>
    candidate.client_id === connection.clientId && candidate.privacy_scope === scope
  );
  const pendingKey = `${connection.id}:${scope}`;
  const Icon = scope === "private" ? LockKeyhole : ShieldCheck;

  return <article className="protected-read-panel" data-scope={scope}>
    <div className="row">
      <div className="protected-read-heading"><Icon size={19} aria-hidden="true" /><h3>{details.title}</h3></div>
      <span className={`pill ${grant ? "connected" : ""}`}>{grant ? "active" : "inactive"}</span>
    </div>
    <p>{scope === "private"
      ? "Private context is excluded from ordinary Lewis access. This read-only grant opens it briefly for this connection."
      : "Sensitive context has stronger protection. Enable it separately only when Lewis needs that material for the current task."}</p>
    <dl className="protected-read-facts">
      <div><dt>Duration</dt><dd>{details.duration}</dd></div>
      <div><dt>Permission</dt><dd>Read-only</dd></div>
      {grant ? <div><dt>Expires</dt><dd><time dateTime={grant.expires_at}>{new Date(grant.expires_at).toLocaleString()}</time></dd></div> : null}
    </dl>
    <div className="confirmation-actions">
      <button
        className="button"
        disabled={Boolean(pending)}
        onClick={() => void mutate({ action: "grant", clientId: connection.clientId, privacyScope: scope }, pendingKey)}
      >{pending === pendingKey ? "Updating…" : grant ? details.renewLabel : details.enableLabel}</button>
      {grant ? <button
        className="button secondary"
        disabled={Boolean(pending)}
        onClick={() => void mutate({ action: "revoke", grantId: grant.grant_id }, pendingKey)}
      >{pending === pendingKey ? "Revoking…" : details.revokeLabel}</button> : null}
    </div>
    {grant ? <p className="muted">Revoking takes effect immediately. The status above is reloaded from the server after every change.</p> : null}
  </article>;
}
