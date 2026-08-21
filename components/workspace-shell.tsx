"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, BrainCircuit, BriefcaseBusiness, Compass, Crosshair, Menu, Moon, Radar, Settings, Sparkles, Target, X } from "lucide-react";
import { QuickCaptureDialog } from "@/components/quick-capture-dialog";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-provider";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { workspaceLoginHref } from "@/lib/workspace/return-path";

const links = [
  ["/workspace", "Command Center", Compass], ["/workspace/tasks", "Daily Focus", Target], ["/workspace/career", "Pipeline", BriefcaseBusiness],
  ["/workspace/capture", "Signals", Radar], ["/workspace/memory", "Memory", BrainCircuit], ["/workspace/integrations", "Integrations", Sparkles]
] as const;

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { ready, user, workspace, error, signOut } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [leaderMode, setLeaderMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const displayName = useMemo(() => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "there", [user]);
  useEffect(() => { if (ready && !user) router.replace(workspaceLoginHref(pathname)); }, [ready, user, router, pathname]);
  useEffect(() => {
    if (!workspace) return;
    void getWorkspaceClient().from("workspace_entitlements").select("enabled").eq("workspace_id", workspace.id).eq("feature_key", "leader_mode").maybeSingle()
      .then(({ data }) => setLeaderMode(Boolean(data?.enabled)));
  }, [workspace]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const handleSignOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      window.location.replace("/login");
    } catch (caught) {
      setSignOutError(caught instanceof Error ? caught.message : "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };
  if (!ready) return <main className="auth-page"><p className="muted">Loading your private workspace…</p></main>;
  if (!user) return null;
  if (error || !workspace) return <main className="auth-page"><div className="auth-card"><h1>Workspace unavailable</h1><p className="error">{error || "Workspace provisioning did not complete."}</p></div></main>;
  return <div className="app-shell">
    <button className="mobile-menu-button icon-button" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={19} /></button>
    <aside className="sidebar" data-open={navOpen}>
      <div className="sidebar-brand-row"><Link className="brand" href="/workspace" onClick={() => setNavOpen(false)}><span className="brand-mark"><Compass size={19} /></span><span>Lead Emergence<small>Workspace</small></span></Link><button className="mobile-nav-close icon-button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={18} /></button></div>
      <nav className="nav-list" aria-label="Workspace navigation"><p className="nav-section-title">Operational</p>{links.slice(0, 4).map(([href, label, Icon]) => <Link key={href} href={href} className="nav-link" data-active={pathname === href} onClick={() => setNavOpen(false)}><Icon size={18} /><span>{label}</span></Link>)}<p className="nav-section-title domains-label">Workspace</p>{links.slice(4).map(([href, label, Icon]) => <Link key={href} href={href} className="nav-link" data-active={pathname === href} onClick={() => setNavOpen(false)}><Icon size={18} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer"><div className="signal-status"><p className="eyebrow">Connection status</p><p><span className="status-dot" />Reconnect required</p></div><Link className="settings-link" href="/workspace/settings"><Settings size={17} />Settings</Link>{signOutError ? <p className="error" role="alert">{signOutError}</p> : null}<button className="sign-out" disabled={signingOut} onClick={() => void handleSignOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div>
    </aside>
    {navOpen ? <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
    <div className="workspace-stage"><header className="workspace-header"><div className="workspace-context"><div><p className="greeting">Welcome back, <em>{displayName}</em>.</p><p className="header-date">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p></div><div className="header-rule" /><div className="header-telemetry"><span className="eyebrow">Zulu time</span><strong>{new Date().toISOString().slice(11, 19)}Z</strong></div><div className="header-rule" /><div className="header-telemetry"><span className="eyebrow">Mode</span><strong>{leaderMode ? "Leader" : "Personal"}</strong></div></div><div className="header-actions"><button className="quick-capture-trigger" onClick={() => setCaptureOpen(true)}><Crosshair size={17} /><span>Quick capture</span><kbd>⌘K</kbd></button><button className="icon-button" aria-label="Theme is fixed to the Workspace command-center theme" title="Dark command-center theme"><Moon size={18} /></button><button className="icon-button" aria-label="Notifications are not available yet" title="Notifications are not available yet" disabled><Bell size={18} /></button><span className="avatar" aria-label={`Signed in as ${displayName}`}>{displayName.slice(0, 2).toUpperCase()}</span></div></header><main className="main">{children}</main></div>
    <QuickCaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
  </div>;
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider><ProtectedShell>{children}</ProtectedShell></WorkspaceProvider>;
}
