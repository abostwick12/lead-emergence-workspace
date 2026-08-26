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
    setEntryHref(`/auth/entry?next=${encodeURIComponent(next)}`);
    setLegacy(params.get("legacy") === "1");
    const code = params.get("error");
    if (code === "entry_unavailable") setError("Lead Emergence sign-in is temporarily unavailable. Try again or use the rollback sign-in.");
    if (code === "entry_denied") setError("Lead Emergence sign-in was cancelled or could not verify Personal access.");
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
    <p className="pill">Private by default</p>
    <h1 className="page-title">Lead Emergence Workspace</h1>
    <p className="page-lede">A private leadership system for seeing reality, choosing intentionally, and learning from what changes.</p>
    {!legacy ? <>
      <a className="button auth-primary" href={entryHref}><ShieldCheck size={17} />Continue with Lead Emergence <ArrowRight size={16} /></a>
      <p className="auth-support-copy">Your Lead Emergence identity and active Personal entitlement are verified before Workspace creates or resumes your private account. No second password is required.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="text-button auth-legacy-toggle" onClick={() => setLegacy(true)}><KeyRound size={15} />Use rollback sign-in</button>
    </> : <form className="form-grid" onSubmit={submit}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button" disabled={pending}>{pending ? "Working…" : "Sign in"}</button>
      <button type="button" className="text-button" onClick={() => setLegacy(false)}>Return to Lead Emergence sign-in</button>
    </form>}
    <p className="muted auth-privacy-note">Workspace permissions, plan capabilities, integrations, and private records remain product-local. <Link href="/privacy">Privacy and access details</Link></p>
  </section></main>;
}
