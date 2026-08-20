"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-provider";

const links = [
  ["/workspace", "Overview"], ["/workspace/tasks", "Tasks"], ["/workspace/capture", "Quick capture"],
  ["/workspace/career", "Career"], ["/workspace/memory", "Memory"], ["/workspace/integrations", "Integrations"], ["/workspace/settings", "Settings"]
] as const;

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { ready, user, workspace, error, signOut } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  if (!ready) return <main className="auth-page"><p className="muted">Loading your private workspace…</p></main>;
  if (!user) return null;
  if (error || !workspace) return <main className="auth-page"><div className="auth-card"><h1>Workspace unavailable</h1><p className="error">{error || "Workspace provisioning did not complete."}</p></div></main>;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/workspace">Lead Emergence<span>Workspace</span></Link>
      <nav className="nav-list" aria-label="Workspace navigation">
        {links.map(([href, label]) => <Link key={href} href={href} className="nav-link" data-active={pathname === href}>{label}</Link>)}
      </nav>
      <div className="sidebar-footer"><p>{workspace.name}</p><button className="sign-out" onClick={() => void signOut()}>Sign out</button></div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider><ProtectedShell>{children}</ProtectedShell></WorkspaceProvider>;
}
