"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [entryHref, setEntryHref] = useState("/auth/entry?next=%2Fworkspace");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = normalizeWorkspaceReturnPath(params.get("next"));
    setEntryHref(`/auth/entry?next=${encodeURIComponent(next)}`);
    const code = params.get("error");
    if (code === "entry_unavailable") setError("Lead Emergence sign-in is temporarily unavailable. Try again shortly.");
    if (code === "entry_denied") setError("Lead Emergence sign-in was cancelled or could not verify Personal access.");
  }, []);

  return <main className="auth-page"><section className="auth-card">
    <p className="pill">Private by default</p>
    <h1 className="page-title">Lead Emergence Workspace</h1>
    <p className="page-lede">A private leadership system for seeing reality, choosing intentionally, and learning from what changes.</p>
    <a className="button auth-primary" href={entryHref}><ShieldCheck size={17} />Continue with Lead Emergence <ArrowRight size={16} /></a>
    <p className="auth-support-copy">Your Lead Emergence identity and active Personal entitlement are verified before Workspace creates or resumes your private account. No second password is required.</p>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <p className="muted auth-privacy-note">Workspace permissions, plan capabilities, integrations, and private records remain product-local. <Link href="/privacy">Privacy and access details</Link></p>
  </section></main>;
}
