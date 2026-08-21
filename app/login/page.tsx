"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(null);
    const supabase = getWorkspaceClient();
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (result.error) { setError(result.error.message); return; }
    router.replace("/workspace");
  }

  return <main className="auth-page"><section className="auth-card">
    <p className="pill">Private by default</p>
    <h1 className="page-title">Lead Emergence Workspace</h1>
    <p className="page-lede">Your personal projects, priorities, notes, and leadership work. Only an approved existing Lead Emergence account with an active Workspace membership can sign in.</p>
    <form className="form-grid" onSubmit={submit}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <p className="error">{error}</p> : null}
      <button className="button" disabled={pending}>{pending ? "Working…" : "Sign in"}</button>
    </form>
    <p className="muted">This private deployment does not create new Workspace accounts.</p>
  </section></main>;
}
