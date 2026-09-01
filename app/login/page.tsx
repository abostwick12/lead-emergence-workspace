"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [entryHref, setEntryHref] = useState("/auth/entry?next=%2Fworkspace");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = normalizeWorkspaceReturnPath(params.get("next"));
    const signInHref = `/auth/entry?next=${encodeURIComponent(next)}`;
    setEntryHref(signInHref);
    const useLegacySignIn = params.get("legacy") === "1";
    setLegacy(useLegacySignIn);
    const code = params.get("error");
    const hasEntryError = code === "entry_unavailable" || code === "entry_denied";
    if (code === "entry_unavailable") setError("Lead Emergence sign-in is temporarily unavailable. Try again or use the rollback sign-in.");
    if (code === "entry_denied") setError("Lead Emergence sign-in was cancelled or could not verify Personal access.");
    if (!useLegacySignIn && !hasEntryError) window.location.replace(signInHref);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(null);
    const supabase = getWorkspaceClient();
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (result.error) { setError(result.error.message); return; }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(normalizeWorkspaceReturnPath(next));
  }

  return <main className="auth-page"><section className="auth-card">
    <p className="pill">{legacy ? "Private by default" : "One secure sign-in"}</p>
    {legacy ? <><h1 className="page-title">Lead Emergence Workspace</h1><p className="page-lede">A private leadership system for seeing reality, choosing intentionally, and learning from what changes.</p><form className="form-grid" onSubmit={submit}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button" disabled={pending}>{pending ? "Working…" : "Sign in"}</button>
      <button type="button" className="text-button" onClick={() => window.location.replace(entryHref)}>Return to Lead Emergence sign-in</button>
    </form></> : <>
      {error ? <><h1 className="page-title">Workspace sign-in needs attention</h1><p className="auth-support-copy">{error}</p><a className="button auth-primary" href={entryHref}><ShieldCheck size={17} />Return to Lead Emergence <ArrowRight size={16} /></a><button className="text-button auth-legacy-toggle" onClick={() => setLegacy(true)}><KeyRound size={15} />Use rollback sign-in</button></> : <><h1 className="page-title">Continuing with Lead Emergence</h1><p className="auth-support-copy">We&apos;re taking you to the one secure Lead Emergence sign-in. Your Personal access is confirmed there before Workspace opens.</p><p className="muted">If this does not continue automatically, <a href={entryHref}>continue with Lead Emergence</a>.</p></>}
    </>}
    <p className="muted auth-privacy-note">Workspace permissions, plan capabilities, integrations, and private records remain product-local. <Link href="/privacy">Privacy and access details</Link></p>
  </section></main>;
}
