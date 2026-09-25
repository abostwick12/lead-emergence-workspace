"use client";

import { useEffect, useRef, useState } from "react";
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

type ConsentDiagnostic = {
  attempt_id: string;
  stage: "identity_checked" | "allow_started" | "approval_attempted" | "approval_result" | "approval_exception" | "redirect_selected";
  client_id?: string;
  identity?: "present" | "absent";
  outcome?: "success" | "error";
  error_code?: string;
  error_type?: "AuthApiError" | "AuthRetryableFetchError" | "AuthSessionMissingError" | "AuthUnknownError" | "TypeError" | "Error" | "OtherError";
  error_status?: number;
  redirect_kind?: "authorization_code" | "oauth_error" | "other" | "missing" | "unsafe";
  branch?: "oauth_redirect" | "stay_on_error" | "login_redirect" | "already_authorized_redirect";
};

const diagnosticErrorCode = (value: unknown) =>
  typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : "unclassified";

function diagnosticError(error: unknown) {
  if (!error || typeof error !== "object") return { error_code: "unclassified", error_type: "OtherError" as const };
  const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
  const knownTypes = ["AuthApiError", "AuthRetryableFetchError", "AuthSessionMissingError", "AuthUnknownError", "TypeError", "Error"];
  return {
    error_code: diagnosticErrorCode(candidate.code),
    error_type: typeof candidate.name === "string" && knownTypes.includes(candidate.name)
      ? candidate.name as ConsentDiagnostic["error_type"] : "OtherError" as const,
    ...(Number.isInteger(candidate.status) && Number(candidate.status) >= 400 && Number(candidate.status) <= 599
      ? { error_status: Number(candidate.status) }
      : {}),
  };
}

function diagnosticRedirectKind(value: string | undefined): ConsentDiagnostic["redirect_kind"] {
  if (!value) return "missing";
  if (!safeOAuthRedirect(value)) return "unsafe";
  const destination = new URL(value);
  if (destination.searchParams.has("error")) return "oauth_error";
  return destination.searchParams.has("code") ? "authorization_code" : "other";
}

async function emitConsentDiagnostic(event: ConsentDiagnostic) {
  try {
    await Promise.race([
      fetch("/api/oauth/consent-diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        keepalive: true,
        body: JSON.stringify(event),
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 750)),
    ]);
  } catch {
    // Diagnostic delivery must not change the customer's authorization decision.
  }
}

export default function OAuthConsentPage() {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptId = useRef<string | null>(null);
  const identityPresent = useRef(false);

  function diagnose(event: Omit<ConsentDiagnostic, "attempt_id">) {
    try {
      attemptId.current ??= crypto.randomUUID();
      return emitConsentDiagnostic({ attempt_id: attemptId.current, ...event });
    } catch {
      return Promise.resolve();
    }
  }

  useEffect(() => {
    void (async () => {
      const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
      if (!authorizationId) { setError("This assistant authorization request is incomplete."); return; }
      const supabase = getWorkspaceClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      identityPresent.current = !authError && !!auth.user;
      void diagnose({ stage: "identity_checked", identity: identityPresent.current ? "present" : "absent" });
      if (authError || !auth.user) {
        await diagnose({ stage: "redirect_selected", branch: "login_redirect" });
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
        await diagnose({ stage: "redirect_selected", branch: "already_authorized_redirect" });
        window.location.replace(authorization.data.redirect_url);
        return;
      }
      setDetails(authorization.data as ConsentDetails);
    })().catch(() => setError("Workspace could not verify this authorization request."));
  }, []);

  async function decide(approve: boolean) {
    if (!details || pending) return;
    const clientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(details.client.id)
      ? details.client.id.toLowerCase() : undefined;
    if (approve) void diagnose({ stage: "allow_started", client_id: clientId, identity: identityPresent.current ? "present" : "absent" });
    setPending(true);
    setError(null);
    const supabase = getWorkspaceClient();
    if (approve && allowed) void diagnose({ stage: "approval_attempted", client_id: clientId });
    let result;
    try {
      result = approve && allowed
        ? await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    } catch (caught) {
      if (approve && allowed) await diagnose({ stage: "approval_exception", client_id: clientId, ...diagnosticError(caught) });
      throw caught;
    }
    if (approve && allowed) {
      const canRedirect = !result.error && !!result.data?.redirect_url && safeOAuthRedirect(result.data.redirect_url);
      const diagnosticWrites = Promise.all([
        diagnose({
          stage: "approval_result",
          client_id: clientId,
          outcome: result.error ? "error" : "success",
          ...(result.error ? diagnosticError(result.error) : {}),
          redirect_kind: diagnosticRedirectKind(result.data?.redirect_url),
        }),
        diagnose({ stage: "redirect_selected", client_id: clientId, branch: canRedirect ? "oauth_redirect" : "stay_on_error" }),
      ]);
      if (canRedirect) await diagnosticWrites;
    }
    if (result.error || !result.data?.redirect_url || !safeOAuthRedirect(result.data.redirect_url)) {
      if (approve && !allowed) void diagnose({ stage: "redirect_selected", client_id: clientId, branch: "stay_on_error" });
      setError("The authorization decision could not be completed safely.");
      setPending(false);
      return;
    }
    if (approve && !allowed) await diagnose({ stage: "redirect_selected", client_id: clientId, branch: "oauth_redirect" });
    window.location.assign(result.data.redirect_url);
  }

  return <main className="auth-page"><section className="auth-card consent-card">
    <span className="consent-icon"><Bot size={25} /></span>
    <p className="eyebrow">Connect your AI assistant</p>
    <h1 className="page-title">Allow access to Workspace?</h1>
    <p className="page-lede"><strong>{details?.client.name || "Your AI assistant"}</strong> is asking to use controlled Lead Emergence Workspace tools on your behalf.</p>
    <div className="consent-list"><p><Check size={16} />Read your onboarding state, confirmed configuration, tasks, Quick Captures, personal memory, career opportunities, and integration connection status.</p><p><Check size={16} />Save your exact user-reported setup and propose interpretations for your confirmation.</p><p><Check size={16} />Create or update internal Workspace records only when you explicitly ask; task or memory deletion, capture discard, and configuration replacement require explicit confirmation.</p><p><Check size={16} />This approval does not connect external services, reveal connector credentials, send messages, or create calendar events. Those actions require separate provider consent and confirmation.</p></div>
    <p className="notice"><ShieldCheck size={16} />Workspace remains the system of record. The assistant cannot bypass your Personal plan, Workspace ownership, row-level security, registered connection, or disconnection state.</p>
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
