"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [canLeave, setCanLeave] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const consentIdentity = useRef<{ id: string; email: string | null } | null>(null);
  const identityChanged = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    consentIdentity.current = null;
    identityChanged.current = false;
    void (async () => {
      const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
      if (!authorizationId) { setError("This assistant authorization request is incomplete."); return; }
      const supabase = getWorkspaceClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const identity = consentIdentity.current;
        if (!active || !identity || identityChanged.current) return;
        if (session?.user.id === identity.id && (session.user.email ?? null) === identity.email) return;
        identityChanged.current = true;
        setEmail(null);
        setAllowed(false);
        setDetails(null);
        setCanLeave(true);
        setError("Your signed-in account changed. Reload this page to verify the account before connecting.");
      });
      unsubscribe = () => subscription.unsubscribe();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active || identityChanged.current) return;
      if (authError || !auth.user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
        return;
      }
      consentIdentity.current = { id: auth.user.id, email: auth.user.email ?? null };
      setEmail(consentIdentity.current.email);
      const authorizationResponse = await fetch(`/api/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`, { cache: "no-store" });
      if (!active || identityChanged.current) return;
      if (!authorizationResponse.ok) {
        const failure = await authorizationResponse.json().catch(() => null) as { canLeave?: boolean } | null;
        if (failure?.canLeave) setCanLeave(true);
        setError(failure?.canLeave
          ? "The current Personal plan cannot authorize this connection. You can leave without connecting."
          : "This authorization request is no longer available.");
        return;
      }
      const authorization = await authorizationResponse.json() as ConsentDetails | { redirect_url: string };
      if (!active || identityChanged.current) return;
      if (!authorization) { setError("This authorization request is no longer available."); return; }
      const workspace = await resolvePersonalWorkspace(auth.user);
      const plan = await getPersonalPlan(workspace.id);
      const capabilities = resolveCapabilities(await listPlanCapabilities(plan.plan_key));
      if (!active || identityChanged.current) return;
      const allowedForConsent = plan.status === "active" && capabilities.workspace_mcp;
      setAllowed(allowedForConsent);
      if (!("authorization_id" in authorization)) {
        if (!safeOAuthRedirect(authorization.redirect_url) || !allowedForConsent) { setError("This connection is not available for the current Personal plan."); return; }
        window.location.replace(authorization.redirect_url);
        return;
      }
      setDetails(authorization as ConsentDetails);
    })().catch(() => {
      if (active && !identityChanged.current) setError("Workspace could not verify this authorization request.");
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function decide(approve: boolean) {
    if (!details || pending || identityChanged.current) return;
    const authorizationId = details.authorization_id;
    setPending(true);
    setError(null);
    try {
      if (approve) {
        const current = await getWorkspaceClient().auth.getUser().catch(() => null);
        const identity = consentIdentity.current;
        if (identityChanged.current || !identity || current?.error || !current?.data.user
          || current.data.user.id !== identity.id || (current.data.user.email ?? null) !== identity.email) {
          identityChanged.current = true;
          setEmail(null);
          setAllowed(false);
          setDetails(null);
          setCanLeave(true);
          setError("Your signed-in account changed. Reload this page to verify the account before connecting.");
          return;
        }
      }
      const response = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizationId, decision: approve && allowed ? "approve" : "deny" })
      });
      const result = response.ok ? await response.json() as { redirect_url?: string } : null;
      if (!result?.redirect_url || !safeOAuthRedirect(result.redirect_url)) {
        setError("The authorization decision could not be completed safely.");
        return;
      }
      window.location.assign(result.redirect_url);
    } catch {
      setError("The authorization decision could not be completed safely.");
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page"><section className="auth-card consent-card">
    <span className="consent-icon"><Bot size={25} /></span>
    <p className="eyebrow">Connect your AI assistant</p>
    <h1 className="page-title">Allow access to Workspace?</h1>
    {email ? <p className="notice">You are connecting as {email}</p> : null}
    <p className="page-lede"><strong>{details?.client.name || "Your AI assistant"}</strong> is asking to use controlled Lead Emergence Workspace tools on your behalf.</p>
    <div className="consent-list"><p><Check size={16} />Read your onboarding state, confirmed configuration, tasks, Quick Captures, personal memory, career opportunities, and integration connection status.</p><p><Check size={16} />Save your exact user-reported setup and propose interpretations for your confirmation.</p><p><Check size={16} />Create or update internal Workspace records only when you explicitly ask; task or memory deletion, capture discard, and configuration replacement require explicit confirmation.</p><p><Check size={16} />This approval does not connect external services, reveal connector credentials, send messages, or create calendar events. Those actions require separate provider consent and confirmation.</p></div>
    <p className="notice"><ShieldCheck size={16} />Workspace remains the system of record. The assistant cannot bypass your Personal plan, Workspace ownership, row-level security, registered connection, or disconnection state.</p>
    {details?.scope ? <p className="consent-scopes">Requested identity scopes: {details.scope.split(" ").join(", ")}</p> : null}
    {!allowed && details ? <p className="error" role="alert">AI assistant connections are not included for the current Personal plan.</p> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="consent-actions"><button className="button" disabled={!details || !allowed || pending} onClick={() => void decide(true)}><Check size={16} />{pending ? "Working…" : "Allow access"}</button><button className="button secondary" disabled={(!details && !canLeave) || pending} onClick={() => details ? void decide(false) : router.push("/workspace")}><X size={16} />Cancel</button></div>
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
