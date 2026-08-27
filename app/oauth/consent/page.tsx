"use client";

import { useEffect, useState } from "react";
import { Bot, Check, ShieldCheck, X } from "lucide-react";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { resolvePersonalWorkspace } from "@/lib/workspace/provision";
import { getPersonalPlan, listPlanCapabilities } from "@/lib/workspace/repository";
import { resolveCapabilities } from "@/lib/workspace/capabilities";

type ConsentDetails = {
  authorization_id: string;
  client: { id: string; name?: string; uri?: string };
  scope?: string;
};

export default function OAuthConsentPage() {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
      if (!authorizationId) { setError("This assistant authorization request is incomplete."); return; }
      const supabase = getWorkspaceClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
        return;
      }
      const authorization = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (authorization.error || !authorization.data) { setError("This authorization request is no longer available."); return; }
      const workspace = await resolvePersonalWorkspace(auth.user);
      const plan = await getPersonalPlan(workspace.id);
      const capabilities = resolveCapabilities(await listPlanCapabilities(plan.plan_key));
      setAllowed(plan.status === "active" && capabilities.workspace_mcp);
      if (!("authorization_id" in authorization.data)) {
        if (!safeOAuthRedirect(authorization.data.redirect_url) || !capabilities.workspace_mcp) { setError("This connection is not available for the current Personal plan."); return; }
        window.location.replace(authorization.data.redirect_url);
        return;
      }
      setDetails(authorization.data as ConsentDetails);
    })().catch(() => setError("Workspace could not verify this authorization request."));
  }, []);

  async function decide(approve: boolean) {
    if (!details || pending) return;
    setPending(true);
    setError(null);
    const supabase = getWorkspaceClient();
    const result = approve && allowed
      ? await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    if (result.error || !result.data?.redirect_url || !safeOAuthRedirect(result.data.redirect_url)) {
      setError("The authorization decision could not be completed safely.");
      setPending(false);
      return;
    }
    window.location.assign(result.data.redirect_url);
  }

  return <main className="auth-page"><section className="auth-card consent-card">
    <span className="consent-icon"><Bot size={25} /></span>
    <p className="eyebrow">Connect your AI assistant</p>
    <h1 className="page-title">Allow access to Workspace?</h1>
    <p className="page-lede"><strong>{details?.client.name || "Your AI assistant"}</strong> is asking to use controlled Lead Emergence Workspace tools on your behalf.</p>
    <div className="consent-list"><p><Check size={16} />Read your onboarding state, confirmed configuration, priorities, commitments, and tasks.</p><p><Check size={16} />Save your exact user-reported setup and propose interpretations for your confirmation.</p><p><Check size={16} />Create, update, or permanently delete a Workspace task only when you explicitly ask.</p><p><Check size={16} />Create a Quick Capture only when you ask after onboarding is complete.</p></div>
    <p className="notice"><ShieldCheck size={16} />Workspace remains the system of record. The assistant cannot bypass your Personal plan, Workspace ownership, row-level security, or disconnection state.</p>
    {details?.scope ? <p className="consent-scopes">Requested identity scopes: {details.scope.split(" ").join(", ")}</p> : null}
    {!allowed && details ? <p className="error" role="alert">AI assistant connections are not included for the current Personal plan.</p> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="consent-actions"><button className="button" disabled={!details || !allowed || pending} onClick={() => void decide(true)}><Check size={16} />{pending ? "Working…" : "Allow access"}</button><button className="button secondary" disabled={!details || pending} onClick={() => void decide(false)}><X size={16} />Cancel</button></div>
  </section></main>;
}

function safeOAuthRedirect(value: string) {
  try {
    const destination = new URL(value);
    return destination.protocol === "https:" || (destination.protocol === "http:" && ["localhost", "127.0.0.1"].includes(destination.hostname));
  } catch {
    return false;
  }
}
