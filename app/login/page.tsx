"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(null); setMessage(null);
    const supabase = getWorkspaceClient();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/workspace` } });
    setPending(false);
    if (result.error) { setError(result.error.message); return; }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm the new Workspace account, then return here to sign in.");
      return;
    }
    router.replace("/workspace");
  }

  return <main className="auth-page"><section className="auth-card">
    <p className="pill">Private by default</p>
    <h1 className="page-title">Lead Emergence Workspace</h1>
    <p className="page-lede">Your personal projects, priorities, notes, and leadership work. Existing Lead Emergence accounts can sign in here without receiving ministry access.</p>
    <form className="form-grid" onSubmit={submit}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input required type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
      <button className="button" disabled={pending}>{pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create private workspace"}</button>
    </form>
    <p className="muted">{mode === "sign-in" ? "New here?" : "Already have an account?"} <button className="button secondary" type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
  </section></main>;
}
